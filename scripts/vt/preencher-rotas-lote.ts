/**
 * EXCEÇÃO AUTORIZADA PELA GESTORA (21/11/2026): preenche a aba "Rotas a confirmar"
 * de uma vez, depois do recomeço do VT. A regra normal continua sendo o gestor
 * escolher a rota de cada pessoa na tela.
 *
 * Para cada optante ATIVO com posto principal: consulta o Google (ida e volta,
 * no horário do turno da escala quando houver), calcula cada alternativa pelo
 * motor e escolhe a de MENOR CUSTO entre as que o motor calcula sem pendência
 * (empate: a primeira do Google). A volta é a mesma rota no sentido contrário;
 * sem ela, a volta mais barata calculável. Só grava e confirma quando o dia sai
 * "confirmado" pelo motor — o resto fica na fila para revisão humana.
 *
 * Uso (raiz do projeto):
 *   npx vite-node scripts/vt/preencher-rotas-lote.ts                 # simulação (consulta o Google, não grava)
 *   npx vite-node scripts/vt/preencher-rotas-lote.ts --aplicar --usuario=<perfil_id>
 * As respostas do Google ficam em cache na pasta de saída: a gravação reaproveita
 * a simulação sem consultar de novo.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'

const APLICAR = process.argv.includes('--aplicar')
const USUARIO = process.argv.find((a) => a.startsWith('--usuario='))?.slice('--usuario='.length) ?? null
// --somente=<arquivo.json com [{id: colaborador_id}]>: refaz só essas pessoas (ex.: correção de classificação).
const SOMENTE = process.argv.find((a) => a.startsWith('--somente='))?.slice('--somente='.length) ?? null
const LIMITE = Number(process.argv.find((a) => a.startsWith('--limite='))?.slice('--limite='.length) ?? 0)
const SAIDA = 'dados-locais/vt_rotas_lote_2026-11-21'
const CACHE = path.join(SAIDA, 'google')

function carregarEnv(caminho: string) {
  for (const linha of fs.readFileSync(caminho, 'utf8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    if (process.env[k] === undefined) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv('.env')
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
const GOOGLE = process.env.GOOGLE_MAPS_API_KEY
if (!SERVICE) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente no .env')
if (!GOOGLE) throw new Error('GOOGLE_MAPS_API_KEY ausente no ambiente')
if (APLICAR && !USUARIO) throw new Error('--aplicar exige --usuario=<perfil_id> (quem autorizou)')

// Cliente próprio com a chave de serviço (script local; nunca vai para o frontend).
// Passado explicitamente às funções de src — o cliente único de '@/lib/supabase' usa a chave pública.
const supabase = createClient<Database>(process.env.VITE_SUPABASE_URL!, SERVICE, { auth: { persistSession: false } })

async function consultarGoogle(chave: string, corpo: Record<string, unknown>): Promise<unknown> {
  const arq = path.join(CACHE, `${chave}.json`)
  if (fs.existsSync(arq)) return JSON.parse(fs.readFileSync(arq, 'utf8'))
  const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE!,
      'X-Goog-FieldMask': 'routes.legs.steps.travelMode,routes.legs.steps.transitDetails,routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify({ ...corpo, travelMode: 'TRANSIT', computeAlternativeRoutes: true }),
  })
  if (!r.ok) throw new Error(`Google HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const dados = await r.json()
  fs.writeFileSync(arq, JSON.stringify(dados))
  await new Promise((res) => setTimeout(res, 250))
  return dados
}

async function main() {
  fs.mkdirSync(CACHE, { recursive: true })
  const [
    { adaptarRotasGoogle },
    motor,
    { encontrarAlternativaInversa },
    { motivosRevisaoHumana, linhasDProibidas },
    { RepositorioItinerarioSupabase },
    { criarTrajetoParaRevisao },
    { resolverPostoDoRelatorio },
    { normalizarDepartamento },
    { escolherHorarioDoTurno },
    { chegadaComFolgaBRT, partidaProximaSegundaBRT, FOLGA_CHEGADA_MINUTOS },
    { fatosCartaoDoCadastro },
    { textoOrigemCasa, textoDestinoPosto },
    { hojeBrasil },
  ] = await Promise.all([
    import('../../src/lib/vt/googleRoutes'),
    import('../../src/lib/vt/motor/idaVolta'),
    import('../../src/lib/vt/rotaInversa'),
    import('../../src/lib/vt/revisaoHumana'),
    import('../../src/lib/vt/repositorioItinerarioSupabase'),
    import('../../src/lib/vt/criarTrajetoRevisao'),
    import('../../src/lib/vt/carga'),
    import('../../src/lib/departamentos'),
    import('../../src/lib/vt/horarioTurno'),
    import('../../src/lib/vt/partidaRota'),
    import('../../src/lib/vt/motor/adaptadorItinerario'),
    import('../../src/lib/vt/enderecos'),
    import('../../src/lib/utils'),
  ])
  type Alt = ReturnType<typeof motor.calcularAlternativaSentido>
  const hoje = hojeBrasil()
  const repo = new RepositorioItinerarioSupabase(supabase)

  const { data: deps, error: e1 } = await supabase.from('departamentos').select('*')
  if (e1) throw e1
  const { data: colabs, error: e2 } = await supabase.from('colaboradores')
    .select('id, nome_completo, endereco, cidade, cep, departamento_id, vt_bu_situacao, vt_bu_consultado_em, vt_tarifa_cheia, vt_tarifa_cheia_motivo')
    .eq('vt_optante', true).eq('status', 'Ativo').order('nome_completo')
  if (e2) throw e2
  const filtro = SOMENTE ? new Set((JSON.parse(fs.readFileSync(SOMENTE, 'utf8')) as { id: string }[]).map((x) => x.id)) : null
  const base0 = filtro ? colabs!.filter((c) => filtro.has(c.id)) : colabs!
  const lista = LIMITE > 0 ? base0.slice(0, LIMITE) : base0
  // Rota já confirmada que agora ficou pendente: abre uma revisão nova (sem rota) para ela
  // voltar à fila — a confirmada antiga não vale mais (a revisão mais nova manda).
  const abrirRevisaoSeConfirmada = async (colaboradorId: string, departamentoId: string): Promise<string> => {
    if (!APLICAR) return ''
    const { data: t } = await supabase.from('vt_trajetos').select('id').eq('colaborador_id', colaboradorId).eq('departamento_id', departamentoId).limit(1)
    if (!t?.length) return ''
    const atual = await repo.buscarDecisaoPorTrajeto(t[0].id)
    if (atual?.status !== 'confirmada') return ''
    const aberta = await (repo as unknown as { garantirDecisaoAberta: (id: string, d: string) => Promise<{ id: string }> }).garantirDecisaoAberta(t[0].id, hoje)
    return ` — rota confirmada anterior substituída pela revisão aberta ${aberta.id}`
  }

  // Mesma consulta de src/lib/vt/turnosDoPosto.ts (60 dias, posto resolvido pela regra do VT), com o cliente do script.
  const desde = (() => { const [a, m, d] = hoje.split('-').map(Number); const x = new Date(a, m - 1, d - 60); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` })()
  const chaveDep = (d: { nome: string; nome_curto: string | null }) => normalizarDepartamento(d.nome_curto?.trim() || d.nome)
  async function turnosNoPosto(colaboradorId: string, departamentoId: string) {
    const { data, error } = await supabase.from('locais_trabalho_diario')
      .select('data, turno, local_trabalho:locais_trabalho(nome, nome_curto)')
      .eq('colaborador_id', colaboradorId).gte('data', desde).lte('data', hoje)
      .not('turno', 'is', null).order('data', { ascending: false }).limit(200)
    if (error) throw error
    const alvo = deps!.find((d) => d.id === departamentoId)!
    const regs: { data: string; turno: string | null }[] = []
    for (const l of (data ?? []) as unknown as { data: string; turno: string | null; local_trabalho: { nome: string; nome_curto: string | null } | { nome: string; nome_curto: string | null }[] | null }[]) {
      const local = Array.isArray(l.local_trabalho) ? l.local_trabalho[0] : l.local_trabalho
      const texto = local?.nome_curto?.trim() || local?.nome?.trim() || ''
      const d = texto ? resolverPostoDoRelatorio(deps!, texto) : null
      if (d && (d.id === departamentoId || chaveDep(d) === chaveDep(alvo))) regs.push({ data: l.data, turno: l.turno })
    }
    return regs
  }

  const linhas: Record<string, unknown>[] = []
  let n = 0
  for (const c of lista) {
    n++
    const base = { nome: c.nome_completo, colaborador_id: c.id }
    const dep = deps!.find((d) => d.id === c.departamento_id)
    if (!dep) { linhas.push({ ...base, situacao: 'pendente', motivo: 'sem posto principal no cadastro' }); continue }
    const reg = { ...base, posto: dep.nome_curto ?? dep.nome }
    try {
      const origem = textoOrigemCasa(c.endereco, c.cidade, c.cep ?? null)
      const destino = textoDestinoPosto(dep)
      const cartao = fatosCartaoDoCadastro(c.vt_bu_situacao ?? null, c.vt_bu_consultado_em ?? null, {
        tarifaCheia: c.vt_tarifa_cheia === true, motivo: c.vt_tarifa_cheia_motivo ?? null,
      })
      const turno = escolherHorarioDoTurno(await turnosNoPosto(c.id, dep.id), hoje)
      const entrada = turno?.entrada ?? '06:00'
      const saida = turno?.saida ?? '18:00'
      const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))
      const noturno = !!turno && min(saida) <= min(entrada)
      const corpoIda = turno
        ? { origin: { address: origem }, destination: { address: destino }, arrivalTime: chegadaComFolgaBRT(entrada) }
        : { origin: { address: origem }, destination: { address: destino }, departureTime: partidaProximaSegundaBRT(entrada) }
      const corpoVolta = { origin: { address: destino }, destination: { address: origem }, departureTime: partidaProximaSegundaBRT(saida, noturno ? 1 : 0) }
      const consultadoEm = new Date().toISOString()
      const respIda = await consultarGoogle(`${c.id}_${dep.id}_ida`, corpoIda)
      const respVolta = await consultarGoogle(`${c.id}_${dep.id}_volta`, corpoVolta)
      const precisao = /\d/.test(c.endereco ?? '') ? 'exata' as const : 'bairro' as const
      const calc = (sentido: 'ida' | 'volta', resp: unknown): Alt[] => motor.ordenarPorCusto(
        adaptarRotasGoogle((resp ?? {}) as never, {
          consultadoEm, precisao, sentido,
          municipioOrigem: sentido === 'ida' ? (c.cidade ?? 'desconhecida') : (dep.cidade ?? 'desconhecida'),
          municipioDestino: sentido === 'ida' ? (dep.cidade ?? 'desconhecida') : (c.cidade ?? 'desconhecida'),
        }).map((a) => motor.calcularAlternativaSentido(a, cartao, hoje)),
      )
      // Decisão da gestora (24/11/2026): linha D só quando casa ou posto fica no Rio — nunca escolhida em lote.
      const semLinhaDProibida = (x: Alt) => linhasDProibidas(c.cidade, dep.cidade, x.alternativa.itinerario.pernas).length === 0
      const idas = calc('ida', respIda).filter((x) => semLinhaDProibida(x) && x.resultado.status === 'confirmado' && (x.resultado.valorCentavos ?? 0) > 0)
      const voltasTodas = calc('volta', respVolta).filter(semLinhaDProibida)
      const voltas = voltasTodas.filter((x) => x.resultado.status === 'confirmado' && (x.resultado.valorCentavos ?? 0) > 0)
      if (idas.length === 0 || voltas.length === 0) {
        const extra = await abrirRevisaoSeConfirmada(c.id, dep.id)
        linhas.push({ ...reg, situacao: 'pendente', motivo: (idas.length === 0 ? 'nenhuma ida calculável sem pendência (trecho DETRO, linha sem tarifa ou endereço)' : 'nenhuma volta calculável sem pendência') + extra })
        continue
      }
      const ida = idas[0]
      // A volta segue a ida (auditoria 21/11/2026): procura a mesma rota entre TODAS as voltas;
      // se ela existe mas tem pendência, a pessoa fica na fila — nunca troca por outra volta mais barata.
      const inversa = encontrarAlternativaInversa(ida.alternativa, voltasTodas)
      if (inversa && !voltas.includes(inversa)) {
        const extra = await abrirRevisaoSeConfirmada(c.id, dep.id)
        linhas.push({ ...reg, situacao: 'pendente', motivo: 'a volta pela mesma rota da ida tem pendência (trecho DETRO ou tarifa)' + extra })
        continue
      }
      const volta = inversa ?? voltas[0]
      const conferir = motivosRevisaoHumana(ida.alternativa.itinerario.pernas, volta.alternativa.itinerario.pernas, c.cidade, dep.cidade)
      if (conferir.length) {
        const extra = await abrirRevisaoSeConfirmada(c.id, dep.id)
        linhas.push({ ...reg, situacao: 'pendente', motivo: `revisão humana: ${conferir.join('; ')}` + extra })
        continue
      }
      const dia = motor.calcularDiaIdaVolta(ida.alternativa, volta.alternativa, cartao, hoje)
      const linhasTxt = (a: Alt) => a.alternativa.itinerario.pernas.map((p) => p.linha ?? p.modal).join(' → ')
      const info = { ...reg, turno: turno?.texto ?? 'sem turno na escala (06:00/18:00)', ida: linhasTxt(ida), volta: linhasTxt(volta), valor_dia: dia.valorCentavos }
      if (dia.status !== 'confirmado' || !dia.valorCentavos || dia.valorCentavos <= 0) {
        const extra = await abrirRevisaoSeConfirmada(c.id, dep.id)
        linhas.push({ ...info, situacao: 'pendente', motivo: `dia ${dia.status}: ${dia.pendencias.map((p) => p.codigo).join(', ')}${extra}` })
        continue
      }
      if (!APLICAR) { linhas.push({ ...info, situacao: 'confirmaria' }); continue }

      const preparado = await criarTrajetoParaRevisao({
        colaboradorId: c.id, departamentoId: dep.id, cidadeCasa: c.cidade ?? null,
        enderecoCasa: c.endereco ?? null, cidadePosto: dep.cidade ?? null, hoje,
      }, supabase)
      const horario = turno
        ? { origem: 'turno_escala' as const, modoIda: 'chegada' as const, folgaMinutos: FOLGA_CHEGADA_MINUTOS, entrada, saida, texto: turno.texto, noturno }
        : { origem: 'manual' as const, modoIda: 'saida' as const, entrada, saida, texto: `saída de casa ${entrada}, saída do posto ${saida}` }
      const combinada = motor.combinarIdaVolta(ida.alternativa, volta.alternativa, dia, cartao, hoje, horario, origem)
      const salvo = await repo.salvarEscolhaComRevisao({
        decisaoId: preparado.decisaoId, colaboradorId: c.id, departamentoId: dep.id, usuarioId: USUARIO!,
        alternativa: combinada, cotacaoId: motor.MOTOR_COTACAO_ID, cotacaoStatus: 'confirmavel', custoDiarioCentavos: dia.valorCentavos,
      }, preparado.trajetoId, hoje)
      const conf = await repo.confirmarDecisaoAberta(salvo.decisaoId, USUARIO!, new Date().toISOString())
      linhas.push({ ...info, situacao: conf.status === 'confirmada' ? 'confirmada' : `gravada (${conf.status})`, decisao_id: salvo.decisaoId })
    } catch (erro) {
      linhas.push({ ...reg, situacao: 'erro', motivo: erro instanceof Error ? erro.message : String(erro) })
    }
    if (n % 20 === 0) console.log(`${n}/${lista.length}`)
  }

  fs.writeFileSync(path.join(SAIDA, `${APLICAR ? 'resultado_aplicacao' : 'resultado_simulacao'}${SOMENTE ? '_correcao' : ''}.json`), JSON.stringify(linhas, null, 1))
  const cont: Record<string, number> = {}
  for (const l of linhas) cont[l.situacao as string] = (cont[l.situacao as string] ?? 0) + 1
  console.log(JSON.stringify({ aplicar: APLICAR, total: linhas.length, ...cont }, null, 1))
}

main().catch((e) => { console.error(e); process.exit(1) })
