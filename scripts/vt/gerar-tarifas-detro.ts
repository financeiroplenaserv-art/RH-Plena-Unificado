/**
 * Gera src/lib/vt/dados/tarifasDetro2026.ts a partir do CSV extraído da
 * Portaria DETRO/PRES 1.960/2026.
 *
 * Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/vt/gerar-tarifas-detro.ts
 *
 * Valores sempre em centavos inteiros. Linhas marcadas em "conferir" no CSV
 * ficam com precisaConferir = true (o motor gera pendência para elas).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const CSV = resolve(RAIZ, 'dados-locais/tarifas_detro_2026-11-18/tarifas_detro_2026_todas_as_linhas.csv')
const SAIDA = resolve(RAIZ, 'src/lib/vt/dados/tarifasDetro2026.ts')

const HASH_PDF = 'bd4e24cb5e7ed8b3bce347222d56c0a94c549ff4dbc1694c9e6deb9a6dd9cf3b'

/** Parser CSV com aspas (RFC 4180 simplificado), separador ";". */
function lerCsv(texto: string): string[][] {
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === ';') { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some((x) => x !== '')) linhas.push(linha)
      linha = []
    } else campo += c
  }
  if (campo !== '' || linha.length) { linha.push(campo); if (linha.some((x) => x !== '')) linhas.push(linha) }
  return linhas
}

function centavos(valor: string, ctx: string): number {
  const v = valor.trim()
  if (!/^\d+(,\d{1,2})?$/.test(v)) throw new Error(`Tarifa inválida "${valor}" em ${ctx}`)
  const [reais, cent = ''] = v.split(',')
  return Number(reais) * 100 + Number(cent.padEnd(2, '0'))
}

const bruto = readFileSync(CSV, 'utf8').replace(/^\uFEFF/, '')
const [cab, ...dados] = lerCsv(bruto)
const idx = (nome: string) => {
  const i = cab.findIndex((c) => c.trim() === nome)
  if (i < 0) throw new Error(`Coluna ausente no CSV: ${nome} (cabeçalho: ${cab.join('|')})`)
  return i
}
const col = {
  empresaCod: idx('empresa_cod'), linha: idx('linha'), secao: idx('secao'), denom: idx('denominacao'),
  via: idx('via'), cat: idx('cat'), tarifa: idx('tarifa_rs'), pagina: idx('pagina_pdf'),
  conferir: idx('conferir'), obs: idx('observacao'),
}

const linhasSaida: string[] = []
let conferir = 0
for (const [n, r] of dados.entries()) {
  const ctx = `linha ${n + 2} do CSV`
  const motivoConferir = (r[col.conferir] ?? '').trim()
  const secaoTxt = (r[col.secao] ?? '').trim()
  const secao = /^\d+$/.test(secaoTxt) ? Number(secaoTxt) : null
  const precisaConferir = motivoConferir !== '' || secao === null
  if (precisaConferir) conferir++
  const item: Record<string, unknown> = {
    empresaCodigo: Number((r[col.empresaCod] ?? '').trim()) || null,
    linha: (r[col.linha] ?? '').trim().toUpperCase().replace(/\s+/g, ''),
    secao,
    denominacao: (r[col.denom] ?? '').trim(),
    via: (r[col.via] ?? '').trim(),
    categoria: (r[col.cat] ?? '').trim(),
    valorCentavos: centavos(r[col.tarifa] ?? '', ctx),
    pagina: Number((r[col.pagina] ?? '').trim()) || null,
    precisaConferir,
  }
  const motivo = motivoConferir || (secao === null ? 'seção ilegível' : '')
  if (motivo) item.motivoConferir = motivo
  const obs = (r[col.obs] ?? '').trim()
  if (obs) item.observacao = obs
  linhasSaida.push('  ' + JSON.stringify(item) + ',')
}

const conteudo = `// ARQUIVO GERADO — não edite à mão.
// Gerador: scripts/vt/gerar-tarifas-detro.ts
// Origem: dados-locais/tarifas_detro_2026-11-18/tarifas_detro_2026_todas_as_linhas.csv
// Portaria DETRO/PRES 1.960/2026 — ${linhasSaida.length} linhas de tarifa, ${conferir} marcadas para conferir.

export interface TarifaDetro2026 {
  empresaCodigo: number | null
  /** Código da linha em maiúsculas, sem espaços (vazio = Portaria sem código). */
  linha: string
  /** Número da seção; 0 = percurso completo; null = ilegível no PDF. */
  secao: number | null
  denominacao: string
  via: string
  categoria: string
  valorCentavos: number
  pagina: number | null
  precisaConferir: boolean
  motivoConferir?: string
  observacao?: string
}

export const TARIFAS_DETRO_2026_META = {
  fonte: 'Portaria DETRO/PRES 1.960/2026',
  url: 'https://www.sindpass.com.br/wp-content/uploads/2026/02/Portaria-DETRO-Reajuste-2026.pdf',
  hashSha256: '${HASH_PDF}',
  vigenteDesde: '2026-02-15',
  vigenteAte: null as string | null,
} as const

export const TARIFAS_DETRO_2026: readonly TarifaDetro2026[] = [
${linhasSaida.join('\n')}
]
`
writeFileSync(SAIDA, conteudo, 'utf8')
console.log(`Gerado ${SAIDA}: ${linhasSaida.length} linhas, ${conferir} a conferir.`)
