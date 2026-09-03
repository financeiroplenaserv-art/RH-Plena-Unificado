// Edge Function: sync-performancelab
// Sincroniza os dados da API pública do PerformanceLab (checklists, visitas
// dos inspetores e eventos) para as tabelas bi_* do Supabase. Pensada para
// rodar 1x ao dia via pg_cron (ver docs/APLICAR_MIGRATION_102.md).
//
// Variáveis de ambiente necessárias (supabase secrets set):
//   - PLAB_LOGIN / PLAB_SENHA: autenticação Basic da API PerformanceLab
//   - PLAB_TOKEN: token do tenant (vai no path da URL)
//
// Acesso: job de máquina — exige Authorization: Bearer <SYNC_CRON_KEY>
// (secret dedicada; o projeto usa as novas API keys sb_secret/sb_publishable,
// então o JWT legado SUPABASE_SERVICE_ROLE_KEY não é o que o agendador tem).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'

const BASE = 'https://sla.performancelab.com.br/v3/powerbi/pwbi'

type Registro = Record<string, unknown>

const str = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : null
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/**
 * Converte "YYYY-MM-DD HH:MM[:SS]" da API para ISO; "0000-..." vira null.
 * A API devolve data/hora no fuso de Brasília, sem indicador de fuso — por
 * isso o sufixo é -03:00 (não Z): marcar como UTC deixava tudo 3h adiantado.
 * Data pura (sem hora) vira meio-dia para nunca cair no dia anterior.
 */
const dt = (s: unknown): string | null => {
  const txt = str(s)
  if (!txt || txt.startsWith('0000')) return null
  if (!txt.includes(' ')) return `${txt}T12:00:00-03:00`
  return txt.replace(' ', 'T') + '-03:00'
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

const diaSeguinte = (dia: string) => {
  const d = new Date(`${dia}T12:00:00-03:00`)
  d.setUTCDate(d.getUTCDate() + 1)
  return iso(d)
}

async function getPlab(endpoint: string, auth: string, token: string, params: Record<string, string> = {}): Promise<Registro[]> {
  const url = new URL(`${BASE}/${endpoint}/${token}/.json`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const r = await fetch(url.toString(), { headers: { Authorization: auth } })
  if (!r.ok) {
    // A API responde 404 com corpo {"status":false,"message":"Não foram
    // encontrados ..."} quando a consulta não retorna linhas — isso NÃO é
    // erro: significa lista vazia no período (em 23/08/2026 o sync passou a
    // falhar porque nenhum checklist restava na janela de 35 dias).
    if (r.status === 404) {
      const corpo = await r.text().catch(() => '')
      if (corpo.includes('Não foram encontrad')) return []
    }
    throw new Error(`${endpoint}: HTTP ${r.status}`)
  }
  const j: unknown = await r.json()
  return Array.isArray(j) ? (j as Registro[]) : []
}

/** Remove do espelho os registros da janela que já não existem no PL. */
async function reconciliar(
  supabase: ReturnType<typeof createClient>,
  tabela: string,
  colunaData: string,
  inicio: string,
  fim: string,
  idsPl: number[],
): Promise<number> {
  const { data, error } = await supabase
    .from(tabela)
    .select('id')
    .gte(colunaData, `${inicio}T00:00:00-03:00`)
    .lt(colunaData, `${fim}T00:00:00-03:00`)
  if (error) throw new Error(`reconciliação ${tabela}: ${error.message}`)

  const idsAtuais = new Set(idsPl)
  const idsRemover = (data ?? [])
    .map((linha) => Number(linha.id))
    .filter((id) => !idsAtuais.has(id))

  let removidos = 0
  for (let inicioLote = 0; inicioLote < idsRemover.length; inicioLote += 500) {
    const lote = idsRemover.slice(inicioLote, inicioLote + 500)
    const { error: erroDelete } = await supabase.from(tabela).delete().in('id', lote)
    if (erroDelete) throw new Error(`reconciliação ${tabela}: ${erroDelete.message}`)
    removidos += lote.length
  }
  return removidos
}

/** Checklist ativo no PL: campo `ativo` numérico (1 = ativo, 0 = inativo) —
 *  confirmado via debug em 03/09/2026 (os inativos da tela do PL chegam com
 *  ativo: 0). Sem o campo, considera ativo (fail-open). */
function checklistAtivo(c: Registro): boolean {
  if (typeof c.ativo === 'number') return c.ativo === 1
  if (typeof c.ativo === 'boolean') return c.ativo
  return true
}

Deno.serve(async (req: Request) => {
  // Guarda de acesso: apenas chamadas de máquina com a chave dedicada do cron.
  const cronKey = Deno.env.get('SYNC_CRON_KEY')
  const authHeader = req.headers.get('authorization') || ''
  if (!cronKey || authHeader !== `Bearer ${cronKey}`) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Corpo opcional: {"debug": true} devolve amostra dos campos do checklist
  // na resposta (usado para mapear campos novos da API; o cron manda '{}')
  const corpo: Registro = await req.json().catch(() => ({})) as Registro
  const debug = corpo?.debug === true

  const LOGIN = Deno.env.get('PLAB_LOGIN')
  const SENHA = Deno.env.get('PLAB_SENHA')
  const TOKEN = Deno.env.get('PLAB_TOKEN')
  if (!LOGIN || !SENHA || !TOKEN) {
    return new Response(JSON.stringify({ error: 'Secrets PLAB_* não configurados' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const AUTH = 'Basic ' + btoa(`${LOGIN}:${SENHA}`)

  // Cliente criado fora do try para o catch também conseguir gravar o log
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const fim = new Date()
    const ini = new Date(Date.now() - 90 * 864e5)
    const P = { data_inicial: iso(ini), data_final: iso(fim) }
    const Pck = { data_inicio: iso(ini), data_final: iso(fim) }
    const fimRecon = diaSeguinte(P.data_final)

    // 1) Locais + filtro do grupo PLENA
    const locais = await getPlab('local', AUTH, TOKEN)
    const plena = new Set<number>(
      locais
        .filter((l) => String(l.grupos_nomes || '').includes('PLENA'))
        .map((l) => Number(l.id)),
    )
    const locaisPlena = locais.filter((l) => plena.has(Number(l.id)))
    await supabase.from('bi_locais').upsert(
      locaisPlena.map((l) => ({
        id: Number(l.id),
        nome: str(l.nome), sigla: str(l.sigla), cidade: str(l.cidade), uf: str(l.uf),
        regional: str(l.regional), grupos_nomes: str(l.grupos_nomes),
        status: num(l.status), data_criacao: dt(l.data_criacao),
      })),
    )

    // 2) Checklists — SOMENTE os ativos (decisão da gestão, 03/09/2026): no PL
    // o cadastro tem o toggle "Status" (Ativo/Inativo) e os inativos não
    // interessam ao painel. A API marca com o campo numérico `ativo`
    // (1 = ativo, 0 = inativo — confirmado via debug).
    const cksRaw = (await getPlab('checklistlab', AUTH, TOKEN, Pck))
      .filter((c) => plena.has(Number(c.local_id)))
    const cks = cksRaw.filter(checklistAtivo)
    console.log(`checklists: ${cksRaw.length} na janela, ${cks.length} ativos`)
    await supabase.from('bi_checklists').upsert(
      cks.map((c) => ({
        id: Number(c.id), numero: num(c.numero), ano: num(c.ano),
        checklist_id: num(c.checklist_id), checklist_nome: str(c.checklist_nome),
        local_id: num(c.local_id), site_nome: str(c.site_nome),
        responsavel_id: num(c.responsavel_id), responsavel_nome: str(c.responsavel_nome),
        data_planejada: dt(c.data_planejada), data_inicio: dt(c.data_inicio),
        data_termino: dt(c.data_termino), conclusao_nome: str(c.conclusao_nome),
        url: str(c.url),
      })),
    )
    // Remoção explícita dos inativos ANTES da reconciliação: os nunca
    // iniciados têm data_inicio NULL e o filtro de data da reconciliação não
    // os alcança (ficariam congelados no espelho até a limpeza de 90 dias).
    // Os QAs órfãos são removidos pelo bi_limpar_dados_antigos no passo 6.
    const idsInativos = cksRaw
      .filter((c) => !checklistAtivo(c))
      .map((c) => Number(c.id))
      .filter(Number.isFinite)
    let removidosInativos = 0
    for (let i = 0; i < idsInativos.length; i += 500) {
      const lote = idsInativos.slice(i, i + 500)
      const { error: erroInativos } = await supabase.from('bi_checklists').delete().in('id', lote)
      if (erroInativos) throw new Error(`remoção de checklists inativos: ${erroInativos.message}`)
      removidosInativos += lote.length
    }
    const removidosCk = removidosInativos + await reconciliar(
      supabase, 'bi_checklists', 'data_inicio', Pck.data_inicio, fimRecon,
      cks.map((c) => Number(c.id)).filter(Number.isFinite),
    )

    // 3) Perguntas/respostas (1 chamada por checklist_id)
    const idsCk = [...new Set(cks.map((c) => Number(c.checklist_id)).filter(Boolean))]
    for (const cid of idsCk) {
      try {
        const qas = await getPlab('checklistlab_qas', AUTH, TOKEN, { checklist_id: String(cid), ...Pck })
        const rows = qas
          .filter((q) => plena.has(Number(q.local_id)))
          .map((q) => ({ id: Number(q.id), qas: q.qas ?? null }))
        if (rows.length) await supabase.from('bi_checklist_qas').upsert(rows)
      } catch (e) {
        console.error('qas', cid, e)
      }
    }

    // 4) Coletas (Inspeções > Coletas Importadas)
    const coletas = (await getPlab('coletas', AUTH, TOKEN, P))
      .filter((v) => plena.has(Number(v.local_id)))
    await supabase.from('bi_coletas').upsert(
      coletas.map((v) => ({
        id: Number(v.id), local_id: num(v.local_id), funcionario: str(v.funcionario),
        usuario_id: num(v.usuario_id),
        data_local: dt(v.data_local), data_termino: dt(v.data_termino),
        area: str(v.area), site_nome: str(v.site_nome), site_cidade: str(v.site_cidade),
        site_uf: str(v.site_uf), motivo_visita: str(v.motivo_visita),
        observacao: str(v.observacao), tipo_coleta: str(v.tipo_coleta),
        tempo_minutos: num(v.tempo_minutos),
      })),
    )
    const removidosColetas = await reconciliar(
      supabase, 'bi_coletas', 'data_local', P.data_inicial, fimRecon,
      coletas.map((v) => Number(v.id)).filter(Number.isFinite),
    )

    // 5) Eventos + análises
    const eventos = (await getPlab('eventos', AUTH, TOKEN, P))
      .filter((e) => plena.has(Number(e.local_id)))
    await supabase.from('bi_eventos').upsert(
      eventos.map((e) => ({
        id: Number(e.id), numero: num(e.numero), ano: num(e.ano),
        local_id: num(e.local_id), evento_id: num(e.evento_id),
        evento_nome: str(e.evento_nome), subtipo_nome: str(e.subtipo_nome),
        site_nome: str(e.site_nome), site_cidade: str(e.site_cidade), site_uf: str(e.site_uf),
        usuario_nome: str(e.usuario_nome), usuario_ultimo_nome: str(e.usuario_ultimo_nome),
        data_evento: dt(e.data_evento), data_finalizacao: dt(e.data_finalizacao),
        status_texto: str(e.status_texto), sla: str(e.sla),
        observacao: str(e.observacao), acoes_realizadas: str(e.acoes_realizadas),
        acoes_realizadas_finalizacao: str(e.acoes_realizadas_finalizacao),
      })),
    )
    const removidosEventos = await reconciliar(
      supabase, 'bi_eventos', 'data_evento', P.data_inicial, fimRecon,
      eventos.map((e) => Number(e.id)).filter(Number.isFinite),
    )

    const analises = await getPlab('eventos_analises', AUTH, TOKEN, P)
    await supabase.from('bi_eventos_analises').upsert(
      analises.map((a) => ({
        id: Number(a.id), evento_id: num(a.evento_id),
        responsavel_nome: str(a.responsavel_nome), tipo_analise_nome: str(a.tipo_analise_nome),
        descricao: str(a.descricao), data_analise: dt(a.data_analise),
      })),
    )
    const removidosAnalises = await reconciliar(
      supabase, 'bi_eventos_analises', 'data_analise', P.data_inicial, fimRecon,
      analises.map((a) => Number(a.id)).filter(Number.isFinite),
    )

    // 6) Limpeza: retém 90 dias de histórico, mesma janela do sync
    const { data: limpeza, error: erroLimpeza } = await supabase.rpc('bi_limpar_dados_antigos')
    if (erroLimpeza) console.error('limpeza:', erroLimpeza)
    else console.log('limpeza:', limpeza)

    // 7) Log da execução (lido pela página para mostrar "Atualizado em ...")
    const removidos = removidosCk + removidosColetas + removidosEventos + removidosAnalises
    const totais = {
      locais: locaisPlena.length,
      checklists: cks.length,
      coletas: coletas.length,
      eventos: eventos.length,
      analises: analises.length,
    }
    // bi_sync_log não tem coluna `removidos` — inserir só as colunas da tabela,
    // senão o PostgREST rejeita o insert e o sucesso nunca é registrado
    const { error: erroLogOk } = await supabase.from('bi_sync_log').insert({ ok: true, ...totais })
    if (erroLogOk) console.error('falha ao gravar bi_sync_log:', erroLogOk)

    // Diagnóstico pontual ({"debug": true}): campos do checklist e
    // distribuição de `status`, para confirmar o campo de ativo/inativo
    let debugInfo: Registro | undefined
    if (debug) {
      const dist: Record<string, number> = {}
      cksRaw.forEach((c) => {
        const k = String(c.ativo ?? '(sem campo)')
        dist[k] = (dist[k] || 0) + 1
      })
      debugInfo = {
        campos_checklist: Object.keys(cksRaw[0] || {}),
        dist_ativo_checklist: dist,
        exemplo_checklist: cksRaw[0] || null,
      }
    }

    return new Response(JSON.stringify({ ok: true, ...totais, removidos, ...(debugInfo ? { debug: debugInfo } : {}) }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('sync-performancelab:', e)
    const mensagem = e instanceof Error ? e.message : 'Erro na sincronização'
    // Registra a falha para a página alertar que o sync parou
    const { error: erroLog } = await supabase
      .from('bi_sync_log')
      .insert({ ok: false, erro: mensagem })
    if (erroLog) console.error('falha ao gravar bi_sync_log:', erroLog)
    return new Response(
      JSON.stringify({ error: mensagem }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
