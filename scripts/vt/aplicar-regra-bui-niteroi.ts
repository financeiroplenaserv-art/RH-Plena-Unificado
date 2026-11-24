/**
 * AUTORIZADO PELA GESTORA (24/11/2026): regrava as 33 rotas cujo valor fechado muda com a regra
 * "intermunicipal + municipal de Niterói integram pelo BUI". Mesmo itinerário (mesmas linhas/horários),
 * nova evidência com o cálculo do motor novo, nova revisão confirmada; a anterior tem a vigência encerrada.
 *
 * Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/vt/aplicar-regra-bui-niteroi.ts [--aplicar --usuario=<perfil_id>]
 * Sem --aplicar: backup + dry-run (não grava nada além dos arquivos locais).
 */
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APLICAR = process.argv.includes('--aplicar')
const USUARIO = process.argv.find((a) => a.startsWith('--usuario='))?.slice('--usuario='.length) ?? null
const D = 'dados-locais/vt_regra_bui_niteroi_2026-11-24'
const HOJE = '2026-11-24'

function carregarEnv(caminho: string) {
  for (const linha of fs.readFileSync(caminho, 'utf8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv('.env')
if (APLICAR && !USUARIO) throw new Error('--aplicar exige --usuario=<perfil_id>')
const supabase = createClient(process.env.VITE_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!, { auth: { persistSession: false } })
const le = (f: string) => JSON.parse(fs.readFileSync(`${D}/${f}`, 'utf8'))
const reais = (c: number | null) => (c === null ? '-' : (c / 100).toFixed(2).replace('.', ','))

async function main() {
  Object.assign(import.meta, { env: { VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY } })
  const motor = await import('../../src/lib/vt/motor/idaVolta')
  const { fatosCartaoDoCadastro } = await import('../../src/lib/vt/motor/adaptadorItinerario')
  const { RepositorioItinerarioSupabase } = await import('../../src/lib/vt/repositorioItinerarioSupabase')
  const { resolverCustoDiarioNaData } = await import('../../src/lib/vt/temporalidade')
  const { decisaoDeLinha, ajusteDeLinha } = await import('../../src/lib/vt/adaptadoresSql')
  const repo = new RepositorioItinerarioSupabase(supabase as never)

  // Lista autorizada: afetadas pela regra com novo valor CONFIRMADO (as pendentes e a "outra causa" ficam fora).
  const antigo = new Map<string, any>(le('todas_antigo.json').map((x: any) => [x.decisao_id, x]))
  const novoMap = new Map<string, any>(le('todas_novo.json').map((x: any) => [x.decisao_id, x]))
  const lista: any[] = le('mudam.json').filter((m: any) => {
    const a = antigo.get(m.decisao_id)
    return a && a.novo !== novoMap.get(m.decisao_id).novo && m.status_motor_novo === 'confirmado'
  })
  console.log('rotas autorizadas:', lista.length)
  const ids = lista.map((x) => x.decisao_id)

  const get = async (q: PromiseLike<{ data: any; error: any }>) => { const { data, error } = await q; if (error) throw error; return data as any[] }
  const decisoes = await get(supabase.from('vt_trajeto_decisoes').select('*').in('id', ids))
  const trajetoIds = decisoes.map((d) => d.trajeto_legado_id).filter(Boolean)
  const backup = {
    decisoes: await get(supabase.from('vt_trajeto_decisoes').select('*').in('trajeto_legado_id', trajetoIds)),
    itinerarios: await get(supabase.from('vt_itinerarios').select('*').in('id', decisoes.map((d) => d.itinerario_id))),
    trajetos: await get(supabase.from('vt_trajetos').select('*').in('id', trajetoIds)),
    componentes: await get(supabase.from('vt_trajeto_decisao_componentes').select('*').in('decisao_trajeto_id', ids)),
    ajustes: await get(supabase.from('vt_beneficio_ajustes').select('*').in('decisao_trajeto_id', ids)),
  }
  fs.mkdirSync(`${D}/backup`, { recursive: true })
  if (!APLICAR || !fs.existsSync(`${D}/backup/backup_33_rotas.json`)) {
    fs.writeFileSync(`${D}/backup/backup_33_rotas.json`, JSON.stringify(backup, null, 1), 'utf8')
  }
  console.log('backup:', Object.fromEntries(Object.entries(backup).map(([k, v]) => [k, v.length])))

  const itins = new Map(backup.itinerarios.map((i) => [i.id, i]))
  const resultados: any[] = []
  for (const m of lista) {
    const d = decisoes.find((x) => x.id === m.decisao_id)
    const base: any = { decisao_id: m.decisao_id, posto: m.posto, ida: m.linhas_ida, volta: m.linhas_volta }
    try {
      if (!d || d.status !== 'confirmada' || d.vigente_ate) throw new Error('decisão não está confirmada/vigente')
      const ev = itins.get(d.itinerario_id)
      const it = ev.itinerario
      const pernas: any[] = [...it.pernas].sort((a, b) => a.sequencia - b.sequencia)
      const mk = (sentido: 'ida' | 'volta', id: string, tot: boolean) => ({
        id, numero: 1,
        distanciaMetros: tot ? ev.distancia_metros : (ev.distancia_metros == null ? null : 0),
        duracaoSegundos: tot ? ev.duracao_segundos : (ev.duracao_segundos == null ? null : 0),
        itinerario: {
          pernas: pernas.filter((p) => p.sentido === sentido),
          provedor: it.provedor, consultadoEm: it.consultadoEm, precisao: it.precisao, evidenciaHash: null,
          ...(tot && it.ajustesManuais?.length ? { ajustesManuais: it.ajustesManuais } : {}),
        },
        avisos: [] as string[],
      })
      const ida = mk('ida', it.calculoMotor.alternativaIdaId, true)
      const volta = mk('volta', it.calculoMotor.alternativaVoltaId, false)
      if (!ida.itinerario.pernas.length || !volta.itinerario.pernas.length) throw new Error('evidência sem ida ou volta')
      const { data: c, error } = await supabase.from('colaboradores')
        .select('cidade, vt_bu_situacao, vt_bu_consultado_em, vt_tarifa_cheia, vt_tarifa_cheia_motivo').eq('id', d.colaborador_id).single()
      if (error) throw error
      const cartao = fatosCartaoDoCadastro(c.vt_bu_situacao, c.vt_bu_consultado_em, { tarifaCheia: c.vt_tarifa_cheia === true, motivo: c.vt_tarifa_cheia_motivo })
      // Decisão da gestora (24/11/2026): linha D só quando casa ou posto fica no Rio.
      const { linhasDProibidas } = await import('../../src/lib/vt/revisaoHumana')
      const { data: dp } = await supabase.from('departamentos').select('cidade').eq('id', d.departamento_id).single()
      const proibidas = linhasDProibidas(c.cidade, dp?.cidade, ida.itinerario.pernas, volta.itinerario.pernas)
      if (proibidas.length) throw new Error(`linha ${proibidas.join(', ')} (vai para o Rio) em trajeto que fica fora do Rio — não regravar`)
      const dia = motor.calcularDiaIdaVolta(ida as never, volta as never, cartao, HOJE)
      base.antes = d.custo_diario_centavos; base.depois = dia.valorCentavos; base.esperado = m.valor_dia_novo_centavos; base.status_motor = dia.status
      if (dia.status !== 'confirmado' || dia.valorCentavos !== m.valor_dia_novo_centavos) {
        throw new Error(`DIVERGE da lista: motor ${dia.valorCentavos} (${dia.status}) x lista ${m.valor_dia_novo_centavos}`)
      }
      if (!APLICAR) { base.situacao = 'gravaria'; resultados.push(base); continue }
      const combinada = motor.combinarIdaVolta(ida as never, volta as never, dia, cartao, HOJE, it.calculoMotor.horarioReferencia, it.calculoMotor.enderecoCasa)
      const salvo = await repo.salvarEscolhaComRevisao({
        decisaoId: d.id, colaboradorId: d.colaborador_id, departamentoId: d.departamento_id, usuarioId: USUARIO!,
        alternativa: combinada, cotacaoId: motor.MOTOR_COTACAO_ID, cotacaoStatus: 'confirmavel', custoDiarioCentavos: dia.valorCentavos!,
      } as never, d.trajeto_legado_id, HOJE)
      const conf = await repo.confirmarDecisaoAberta(salvo.decisaoId, USUARIO!, new Date().toISOString())
      base.nova_decisao_id = salvo.decisaoId
      base.situacao = conf.status === 'confirmada' ? 'confirmada' : `gravada (${conf.status})`
    } catch (e) {
      base.situacao = 'nao_gravada'; base.motivo = e instanceof Error ? e.message : String(e)
    }
    resultados.push(base)
  }
  fs.writeFileSync(`${D}/${APLICAR ? 'resultado_aplicacao' : 'dryrun'}.json`, JSON.stringify(resultados, null, 1), 'utf8')
  for (const r of resultados) console.log(`${r.situacao} | ${r.posto} | ${r.ida} / ${r.volta} | ${reais(r.antes ?? null)} -> ${reais(r.depois ?? null)} (lista ${reais(r.esperado ?? null)}) ${r.motivo ?? ''}`)
  const cont: Record<string, number> = {}
  for (const r of resultados) cont[r.situacao] = (cont[r.situacao] ?? 0) + 1
  console.log(cont)

  if (APLICAR) {
    const ver: any[] = []
    for (const r of resultados.filter((x) => x.situacao === 'confirmada')) {
      const d0 = decisoes.find((x) => x.id === r.decisao_id)
      const todas = await get(supabase.from('vt_trajeto_decisoes').select('*').eq('trajeto_legado_id', d0.trajeto_legado_id))
      const vigentesConf = todas.filter((x) => x.status === 'confirmada' && !x.vigente_ate)
      const antiga = todas.find((x) => x.id === r.decisao_id)
      const ajs = (await get(supabase.from('vt_beneficio_ajustes').select('*').in('decisao_trajeto_id', todas.map((x) => x.id)))).map(ajusteDeLinha)
      const res = resolverCustoDiarioNaData({
        colaboradorId: d0.colaborador_id, departamentoId: d0.departamento_id, dataServico: HOJE,
        decisoes: todas.map(decisaoDeLinha), componentes: [], versoesPreco: [], ajustes: ajs,
      })
      const ev = await get(supabase.from('vt_itinerarios').select('itinerario').eq('id', vigentesConf[0]?.itinerario_id ?? '00000000-0000-0000-0000-000000000000'))
      const texto = JSON.stringify(ev)
      ver.push({
        decisao_antiga: r.decisao_id, nova: r.nova_decisao_id,
        uma_confirmada_vigente: vigentesConf.length === 1 && vigentesConf[0].id === r.nova_decisao_id,
        custo_novo_ok: vigentesConf[0]?.custo_diario_centavos === r.esperado,
        antiga_encerrada: !!antiga?.vigente_ate, vigente_ate_antiga: antiga?.vigente_ate,
        resolver: res.totalCentavos, resolver_ok: res.totalCentavos === r.esperado,
        sem_u_fffd: !texto.includes('�') && !texto.includes('\\ufffd'),
      })
    }
    const ok = ver.filter((v) => v.uma_confirmada_vigente && v.custo_novo_ok && v.antiga_encerrada && v.resolver_ok && v.sem_u_fffd).length
    fs.writeFileSync(`${D}/verificacao.json`, JSON.stringify({ total: ver.length, ok, detalhes: ver }, null, 1), 'utf8')
    console.log('verificação:', ok, '/', ver.length)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
