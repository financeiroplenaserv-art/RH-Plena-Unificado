/**
 * Consolida (SOMENTE LEITURA do banco; só arquivos locais) a lista de rotas afetadas pela regra de 24/11/2026:
 * compara o valor do motor ANTES (todas_antigo.json, gerado com o código de HEAD) e DEPOIS (todas_novo.json),
 * separando o que muda por causa da regra do que é defasagem do valor gravado (motor atual × gravado).
 * Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/vt/consolidar-afetadas-bui-niteroi.ts
 */
import fs from 'node:fs'
import * as XLSX from '@e965/xlsx'

const D = 'dados-locais/vt_regra_bui_niteroi_2026-11-24'
const le = (f: string) => JSON.parse(fs.readFileSync(`${D}/${f}`, 'utf8'))
const antigo = new Map<string, any>(le('todas_antigo.json').map((x: any) => [x.decisao_id, x]))
const novo: any[] = le('todas_novo.json')
const mudam = new Map<string, any>(le('mudam.json').map((x: any) => [x.decisao_id, x]))
const r = (c: number | null) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','))
const DIAS = 22

// Detalhes de cada decisão vêm de mudam.json (quando há diferença contra o gravado) — para as demais
// afetadas pela regra o valor gravado já era igual ao motor antigo, então estão em mudam.json também.
const afetadas: any[] = []
const defasagem: any[] = []
for (const n of novo) {
  const a = antigo.get(n.decisao_id)
  const det = mudam.get(n.decisao_id)
  if (!det) continue
  if (a && a.novo !== n.novo) afetadas.push({ ...det, valor_antigo_motor: a.novo, valor_gravado: n.armazenado })
  else defasagem.push({ ...det, valor_gravado: n.armazenado })
}
const calc = (l: any[]) => l.filter((x) => x.valor_antigo_motor !== null && x.valor_dia_novo_centavos !== null)
const dif = (x: any) => x.valor_dia_novo_centavos - x.valor_antigo_motor
const linha = (x: any) => ({
  Colaborador: x.colaborador, Posto: x.posto, 'Linhas ida': x.linhas_ida, 'Linhas volta': x.linhas_volta,
  'Status da decisão': x.status_decisao,
  'Valor/dia atual (R$)': r(x.valor_antigo_motor), 'Valor/dia novo (R$)': r(x.valor_dia_novo_centavos),
  'Diferença/dia (R$)': x.valor_antigo_motor !== null && x.valor_dia_novo_centavos !== null ? r(dif(x)) : '',
  'Estimativa mensal x22 (R$)': x.valor_antigo_motor !== null && x.valor_dia_novo_centavos !== null ? r(dif(x) * DIAS) : '',
  'Valor gravado na decisão (R$)': r(x.valor_gravado), 'Status motor novo': x.status_motor_novo, Pendências: x.pendencias,
})
const ord = (l: any[]) => [...l].sort((p, q) => String(p.colaborador).localeCompare(String(q.colaborador), 'pt-BR'))
const c = calc(afetadas)
const soma = c.reduce((s, x) => s + dif(x), 0)
const pend = c.filter((x) => x.status_motor_novo !== 'confirmado')
const conf = c.filter((x) => x.status_motor_novo === 'confirmado')
const somaDe = (l: any[]) => l.reduce((s, x) => s + dif(x), 0)
const resumo: Record<string, number | string> = {
  rotas_afetadas_pela_regra: afetadas.length,
  novo_valor_confirmado: conf.length,
  'soma_diferenca_dia_(R$)_confirmadas': r(somaDe(conf)),
  'estimativa_mensal_x22_(R$)_confirmadas': r(somaDe(conf) * DIAS),
  novo_valor_ainda_pendente: pend.length,
  'soma_diferenca_dia_(R$)_pendentes': r(somaDe(pend)),
  'soma_diferenca_dia_(R$)_todas': r(somaDe(c)),
  'estimativa_mensal_x22_(R$)_todas': r(somaDe(c) * DIAS),
  rotas_com_valor_gravado_diferente_do_motor_antigo: afetadas.filter((x) => x.valor_gravado !== x.valor_antigo_motor).length,
  rotas_que_mudam_por_outra_causa_ja_existente: defasagem.length,
}
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ord(afetadas).map(linha)), 'Afetadas pela regra')
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ord(defasagem).map(linha)), 'Outra causa (nao e a regra)')
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Item', 'Valor'], ...Object.entries(resumo)]), 'Resumo')
fs.writeFileSync(`${D}/rotas_afetadas.xlsx`, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
fs.writeFileSync(`${D}/resumo.json`, JSON.stringify(resumo, null, 2))
console.log(JSON.stringify(resumo, null, 2))
console.log('--- afetadas ---')
for (const x of ord(afetadas)) console.log(`${x.posto} | ${x.linhas_ida} / ${x.linhas_volta} | ${r(x.valor_antigo_motor)} -> ${r(x.valor_dia_novo_centavos)} | ${x.status_motor_novo}`)
console.log('--- outra causa ---')
for (const x of ord(defasagem)) console.log(`${x.posto} | ${x.linhas_ida} / ${x.linhas_volta} | gravado ${r(x.valor_gravado)} -> ${r(x.valor_dia_novo_centavos)} ${x.status_motor_novo}`)
