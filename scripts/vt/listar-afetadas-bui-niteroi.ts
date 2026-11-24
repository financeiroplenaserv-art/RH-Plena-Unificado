/**
 * SOMENTE LEITURA. Lista as rotas do VT cujo valor/dia muda com a regra de 24/11/2026
 * (intermunicipal + municipal de Niterói integram pelo BUI, R$ 9,40 por sentido).
 *
 * Recalcula ida e volta da evidência (vt_itinerarios.itinerario.pernas, por `sentido`) com o
 * motor atual e compara com vt_trajeto_decisoes.custo_diario_centavos gravado.
 * Não escreve nada no banco. Saída (com nomes — NÃO enviar para fora) em
 * dados-locais/vt_regra_bui_niteroi_2026-11-24/.
 *
 * Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/vt/listar-afetadas-bui-niteroi.ts
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import * as XLSX from '@e965/xlsx'

const SAIDA = 'dados-locais/vt_regra_bui_niteroi_2026-11-24'
const HOJE = '2026-11-24'
const DIAS_MES = 22

function carregarEnv(caminho: string) {
  for (const linha of fs.readFileSync(caminho, 'utf8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv('.env')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!,
  { auth: { persistSession: false } },
)

type Linha = Record<string, any>

async function paginar(montar: (de: number, ate: number) => PromiseLike<{ data: Linha[] | null; error: any }>): Promise<Linha[]> {
  const todas: Linha[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar(de, de + 999)
    if (error) throw error
    todas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return todas
}

const reais = (c: number | null) => (c === null ? '' : (c / 100).toFixed(2).replace('.', ','))

async function main() {
  Object.assign(import.meta, {
    env: { VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY },
  })
  const { calcularDia, pernasMotorDoItinerario, fatosCartaoDoCadastro } = await import('../../src/lib/vt/motor')

  const decisoes = await paginar((de, ate) =>
    supabase.from('vt_trajeto_decisoes')
      .select('id, colaborador_id, departamento_id, revisao, status, cotacao_id, itinerario_id, custo_diario_centavos, vigente_ate')
      .is('vigente_ate', null)
      .in('status', ['confirmada', 'sugerida'])
      .not('itinerario_id', 'is', null)
      .order('id')
      .range(de, ate),
  )
  console.log('decisões vigentes com itinerário:', decisoes.length)

  const itinerarios = new Map<string, Linha>()
  const ids = [...new Set(decisoes.map((d) => d.itinerario_id as string))]
  for (let i = 0; i < ids.length; i += 50) {
    const { data, error } = await supabase.from('vt_itinerarios').select('id, itinerario').in('id', ids.slice(i, i + 50))
    if (error) throw error
    for (const r of data ?? []) itinerarios.set(r.id, r)
  }
  const colabIds = [...new Set(decisoes.map((d) => d.colaborador_id as string))]
  const colabs = new Map<string, Linha>()
  for (let i = 0; i < colabIds.length; i += 100) {
    const { data, error } = await supabase.from('colaboradores')
      .select('id, nome_completo, vt_bu_situacao, vt_bu_consultado_em, vt_tarifa_cheia, vt_tarifa_cheia_motivo')
      .in('id', colabIds.slice(i, i + 100))
    if (error) throw error
    for (const r of data ?? []) colabs.set(r.id, r)
  }
  const deptIds = [...new Set(decisoes.map((d) => d.departamento_id as string))]
  const depts = new Map<string, Linha>()
  for (let i = 0; i < deptIds.length; i += 100) {
    const { data, error } = await supabase.from('departamentos').select('id, nome, nome_curto').in('id', deptIds.slice(i, i + 100))
    if (error) throw error
    for (const r of data ?? []) depts.set(r.id, r)
  }

  const nomeLinha = (p: any) => (p.linha?.trim() ? String(p.linha).trim().toUpperCase() : p.modal)
  const ehNit = (p: any) => p.modal === 'onibus' && p.escopo === 'municipal' && p.municipioOrigem === 'Niterói' && p.municipioDestino === 'Niterói'
  const ehInter = (p: any) => p.escopo === 'intermunicipal'
  const temPar = (pernas: any[]) => pernas.some(ehNit) && pernas.some(ehInter)

  const mudam: Linha[] = []
  const todas: Linha[] = []
  let semCalculo = 0
  let igual = 0
  for (const d of decisoes) {
    const it = itinerarios.get(d.itinerario_id)?.itinerario
    const pernas: any[] = (it?.pernas ?? []).slice().sort((a: any, b: any) => a.sequencia - b.sequencia)
    const ida = pernas.filter((p) => p.sentido === 'ida')
    const volta = pernas.filter((p) => p.sentido === 'volta')
    if (!ida.length || !volta.length) { semCalculo++; continue }
    const c = colabs.get(d.colaborador_id)
    const cartao = fatosCartaoDoCadastro(c?.vt_bu_situacao, c?.vt_bu_consultado_em, {
      tarifaCheia: c?.vt_tarifa_cheia,
      motivo: c?.vt_tarifa_cheia_motivo,
    })
    const r = calcularDia({
      itinerario: { ida: pernasMotorDoItinerario(ida).pernas, volta: pernasMotorDoItinerario(volta).pernas },
      cartao,
      dataServico: HOJE,
    })
    const atual = d.custo_diario_centavos as number | null
    const novo = r.valorCentavos
    todas.push({ decisao_id: d.id, novo, armazenado: atual })
    if (novo === atual) { igual++; continue }
    const dep = depts.get(d.departamento_id)
    mudam.push({
      colaborador: c?.nome_completo ?? '?',
      posto: dep?.nome_curto ?? dep?.nome ?? '?',
      status_decisao: d.status,
      linhas_ida: ida.map(nomeLinha).join(' → '),
      linhas_volta: volta.map(nomeLinha).join(' → '),
      par_niteroi_intermunicipal: temPar(ida) || temPar(volta) ? 'sim' : 'não (outra causa)',
      valor_dia_atual_centavos: atual,
      valor_dia_novo_centavos: novo,
      diferenca_dia_centavos: novo !== null && atual !== null ? novo - atual : null,
      status_motor_novo: r.status,
      pendencias: r.pendencias.map((p) => p.codigo).join(', '),
      decisao_id: d.id,
    })
  }

  const resumoDe = (lista: Linha[]) => {
    const calc = lista.filter((x) => x.diferenca_dia_centavos !== null)
    const soma = calc.reduce((s, x) => s + x.diferenca_dia_centavos, 0)
    return { quantidade: lista.length, comDiferenca: calc.length, somaDia: soma, estimativaMes: soma * DIAS_MES }
  }
  const confirmadas = mudam.filter((x) => x.status_decisao === 'confirmada')
  const sugeridas = mudam.filter((x) => x.status_decisao !== 'confirmada')
  const causaRegra = (l: Linha[]) => l.filter((x) => x.par_niteroi_intermunicipal === 'sim')
  const resumo = {
    decisoes_analisadas: decisoes.length,
    sem_ida_ou_volta_na_evidencia: semCalculo,
    sem_mudanca: igual,
    confirmadas_que_mudam: resumoDe(confirmadas),
    confirmadas_por_causa_da_regra: resumoDe(causaRegra(confirmadas)),
    sugeridas_que_mudam: resumoDe(sugeridas),
    sugeridas_por_causa_da_regra: resumoDe(causaRegra(sugeridas)),
  }

  fs.mkdirSync(SAIDA, { recursive: true })
  const paraPlanilha = (lista: Linha[]) =>
    lista
      .sort((a, b) => String(a.colaborador).localeCompare(String(b.colaborador), 'pt-BR'))
      .map((x) => ({
        Colaborador: x.colaborador,
        Posto: x.posto,
        'Linhas ida': x.linhas_ida,
        'Linhas volta': x.linhas_volta,
        'Par Niterói + intermunicipal': x.par_niteroi_intermunicipal,
        'Valor/dia atual (R$)': reais(x.valor_dia_atual_centavos),
        'Valor/dia novo (R$)': reais(x.valor_dia_novo_centavos),
        'Diferença/dia (R$)': reais(x.diferenca_dia_centavos),
        'Estimativa mensal x22 (R$)': x.diferenca_dia_centavos === null ? '' : reais(x.diferenca_dia_centavos * DIAS_MES),
        'Status motor novo': x.status_motor_novo,
        Pendências: x.pendencias,
      }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paraPlanilha(confirmadas)), 'Confirmadas')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paraPlanilha(sugeridas)), 'Sugeridas (abertas)')
  const linhasResumo = [
    ['Decisões analisadas', resumo.decisoes_analisadas],
    ['Sem mudança', resumo.sem_mudanca],
    ['Sem ida/volta na evidência', resumo.sem_ida_ou_volta_na_evidencia],
    ...(['confirmadas_que_mudam', 'confirmadas_por_causa_da_regra', 'sugeridas_que_mudam', 'sugeridas_por_causa_da_regra'] as const).flatMap((k) => [
      [k, `${(resumo as any)[k].quantidade} rotas`],
      [`${k} — soma da diferença/dia (R$)`, reais((resumo as any)[k].somaDia)],
      [`${k} — estimativa mensal x22 (R$)`, reais((resumo as any)[k].estimativaMes)],
    ]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Item', 'Valor'], ...linhasResumo]), 'Resumo')
  fs.writeFileSync(`${SAIDA}/rotas_afetadas.xlsx`, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  fs.writeFileSync(`${SAIDA}/resumo.json`, JSON.stringify(resumo, null, 2), 'utf8')
  fs.writeFileSync(`${SAIDA}/todas_${process.env.ROTULO ?? 'novo'}.json`, JSON.stringify(todas), 'utf8')
  fs.writeFileSync(`${SAIDA}/mudam.json`, JSON.stringify(mudam, null, 2), 'utf8')
  console.log(JSON.stringify(resumo, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
