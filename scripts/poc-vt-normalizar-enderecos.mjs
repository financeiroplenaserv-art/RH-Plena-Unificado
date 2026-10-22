/**
 * POC VT — normaliza os endereços do cadastro (Alterdata) e testa cada um
 * no OpenStreetMap/Nominatim, para validar a regra de limpeza antes de gerar
 * os links do Google Maps. Rode: node scripts/poc-vt-normalizar-enderecos.mjs
 *
 * Regras (aprendidas na rodada 2 da POC, 21/10/2026):
 *  - complemento de lote/quadra/bloco/casa/ap ("LT 59", "QD 31", "BLC 11 AP",
 *    "CS 3", "53 FUNDOS") é LIXO para geocodificar -> corta
 *  - número "0"/"S/N" -> sem número
 *  - rua dupla grudada ("RUA X RUA Y") -> fica a primeira
 *  - busca final: "rua [numero], bairro, cidade, RJ" (CEP só se faltar o resto)
 */

import { readFileSync, writeFileSync } from 'fs'

const dados = JSON.parse(readFileSync('dados-locais/poc_vt_amostra_raw.json', 'utf8'))

const LIXO = /\b(LT|LOTE|QD|QUADRA|BLC|BL|BLOCO|CS|CASA|AP|APT|APTO|FUNDOS|SL|SALA|CJ|CONJ)\b.*/i

function limparEndereco(endereco) {
  const partes = String(endereco || '').split(',').map((p) => p.trim()).filter(Boolean)
  if (partes.length === 0) return null
  let rua = partes[0]
  // rua dupla grudada: "RUA JARDIM FIGUEIRA RUA B" -> "RUA JARDIM FIGUEIRA"
  const m = rua.match(/^(.+?)\s+(RUA|AV|AVENIDA|TRAVESSA|ESTRADA|EST|RODOVIA|ALAMEDA)\s+/i)
  if (m) rua = m[1]
  let numero = partes[1] || ''
  if (/^(0|S\/?N)$/i.test(numero)) numero = ''
  // bairro = última parte limpa de lixo; complementos do meio são descartados
  let bairro = ''
  for (let i = partes.length - 1; i >= 1; i--) {
    const limpa = partes[i].replace(LIXO, '').trim()
    if (limpa && !/^\d+$/.test(limpa)) { bairro = limpa; break }
  }
  return { rua, numero, bairro }
}

function montarBusca(e) {
  const limpo = limparEndereco(e.endereco)
  if (!limpo) return null
  const partes = [limpo.rua + (limpo.numero ? ', ' + limpo.numero : '')]
  if (limpo.bairro) partes.push(limpo.bairro)
  partes.push(e.cidade, 'RJ')
  return partes.join(', ')
}

const norm = (s) => (s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const pares = new Map()
for (const c of dados) {
  const chave = norm(c.cidade) + ' -> ' + norm(c.cid_posto)
  if (!pares.has(chave)) pares.set(chave, [])
  pares.get(chave).push(c)
}
const ordenado = [...pares.entries()].sort((a, b) => b[1].length - a[1].length)
const amostra = []
for (const [par, lista] of ordenado) {
  const n = lista.length >= 30 ? 3 : lista.length >= 3 ? 2 : 1
  const idxs = [...new Set([0, Math.floor(lista.length / 2), lista.length - 1])].slice(0, n)
  for (const i of idxs) amostra.push({ ...lista[i], par })
}

const resultados = []
for (const e of amostra) {
  const busca = montarBusca(e)
  let ok = false, achou = ''
  try {
    const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(busca) + '&format=json&limit=1&countrycodes=br'
    const resp = await fetch(url, { headers: { 'User-Agent': 'corh-poc-vt' } })
    const json = await resp.json()
    ok = json.length > 0
    achou = json[0]?.display_name?.slice(0, 90) || ''
  } catch (err) { achou = 'erro: ' + err.message }
  resultados.push({ ...e, busca, ok, achou })
  console.log((ok ? 'OK   ' : 'FALHA') + ' | ' + busca + (achou ? '\n       -> ' + achou : ''))
  await new Promise((r) => setTimeout(r, 1100)) // respeita o Nominatim (1 req/s)
}

const falhas = resultados.filter((r) => !r.ok).length
console.log('\n=== RESUMO: ' + (resultados.length - falhas) + ' ok, ' + falhas + ' falhas de ' + resultados.length + ' ===')
writeFileSync('dados-locais/poc_vt_normalizacao_resultado.json', JSON.stringify(resultados, null, 2))
