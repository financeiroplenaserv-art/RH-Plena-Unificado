/**
 * POC VT — auditoria de geocodificação em TODOS os colaboradores ativos/afastados.
 * Para cada um: tenta o endereço exato normalizado; se falhar, tenta bairro+cidade.
 * Resultado: quantos % resolvem em cada nível (define o tamanho da fila humana).
 *
 * Rode: node scripts/poc-vt-auditoria-geocode.mjs
 * (usa Nominatim/OSM, gratuito, 1 req/s — demora ~10 min para ~320 pessoas)
 */

import { readFileSync, writeFileSync } from 'fs'

const dados = JSON.parse(readFileSync('dados-locais/poc_vt_todos_enderecos.json', 'utf8'))

const LIXO = /\b(LT|LOTE|QD|QUADRA|BLC|BL|BLOCO|CS|CASA|AP|APT|APTO|FUNDOS|SL|SALA|CJ|CONJ)\b.*/i

function limpar(endereco) {
  const partes = String(endereco || '').split(',').map((p) => p.trim()).filter(Boolean)
  if (!partes.length) return null
  let rua = partes[0]
  const m = rua.match(/^(.+?)\s+(RUA|AV|AVENIDA|TRAVESSA|ESTRADA|EST|RODOVIA|ALAMEDA)\s+/i)
  if (m) rua = m[1]
  let numero = partes[1] || ''
  if (/^(0|S\/?N)$/i.test(numero)) numero = ''
  let bairro = ''
  for (let i = partes.length - 1; i >= 1; i--) {
    const limpa = partes[i].replace(LIXO, '').trim()
    if (limpa && !/^\d+$/.test(limpa)) { bairro = limpa; break }
  }
  return { rua, numero, bairro }
}

async function busca(q) {
  const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=json&limit=1&countrycodes=br'
  const resp = await fetch(url, { headers: { 'User-Agent': 'corh-poc-vt-auditoria' } })
  const json = await resp.json()
  return json.length > 0
}

const resultado = []
let i = 0
for (const c of dados) {
  i++
  const limpo = limpar(c.endereco)
  let nivel = 'falha'
  if (limpo) {
    const exato = [limpo.rua + (limpo.numero ? ', ' + limpo.numero : ''), limpo.bairro, c.cidade, 'RJ'].filter(Boolean).join(', ')
    if (await busca(exato)) {
      nivel = 'exato'
    } else {
      await new Promise((r) => setTimeout(r, 1100))
      const bairroCidade = [limpo.bairro, c.cidade, 'RJ'].filter(Boolean).join(', ')
      if (limpo.bairro && (await busca(bairroCidade))) nivel = 'bairro'
    }
  }
  resultado.push({ nome: c.nome_completo, cidade: c.cidade, nivel })
  if (i % 25 === 0) console.log(i + '/' + dados.length + ' processados...')
  await new Promise((r) => setTimeout(r, 1100))
}

const contagem = { exato: 0, bairro: 0, falha: 0 }
for (const r of resultado) contagem[r.nivel]++
console.log('\n=== AUDITORIA COMPLETA (' + resultado.length + ' colaboradores) ===')
console.log('exato:  ' + contagem.exato + ' (' + Math.round((contagem.exato / resultado.length) * 100) + '%)')
console.log('bairro: ' + contagem.bairro + ' (' + Math.round((contagem.bairro / resultado.length) * 100) + '%)')
console.log('falha:  ' + contagem.falha + ' (' + Math.round((contagem.falha / resultado.length) * 100) + '%)')
console.log('\nFalhas (fila humana):')
for (const r of resultado.filter((r) => r.nivel === 'falha')) console.log('  ' + r.nome + ' — ' + r.cidade)
writeFileSync('dados-locais/poc_vt_auditoria_geocode.json', JSON.stringify(resultado, null, 2))
console.log('\nDetalhe em dados-locais/poc_vt_auditoria_geocode.json')
