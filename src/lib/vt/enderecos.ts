// Lógica pura do módulo VT — normalização de endereços residenciais
// (regras validadas na POC de 21/10/2026, scripts/poc-vt-normalizar-enderecos.mjs).
// Os endereços vêm sujos da Alterdata: número "0", lote/quadra/bloco no meio do
// texto ("LT 59", "53 FUNDOS", "CS 3"), rua dupla grudada. Para geocodificar
// (fase futura) e para montar o link do Google Maps, o endereço é limpo antes.

import type { PrecisaoOrigemVT } from '@/types/vt'

// Complemento de lote/quadra/bloco/casa/apartamento é lixo para geocodificar:
// corta o token e tudo o que segue ("QD 31", "BLC 11 AP", "53 FUNDOS").
const LIXO_COMPLEMENTO = /\b(LT|LOTE|QD|QUADRA|BLC|BL|BLOCO|CS|CASA|AP|APT|APTO|FUNDOS|SL|SALA|CJ|CONJ)\b.*/i

// Rua dupla grudada: "RUA JARDIM FIGUEIRA RUA B" -> fica só a primeira.
const RUA_DUPLA = /^(.+?)\s+(RUA|AV|AVENIDA|TRAVESSA|ESTRADA|EST|RODOVIA|ALAMEDA)\s+/i

export interface EnderecoCasaNormalizado {
  rua: string
  numero: string // '' = sem número (cadastro veio "0"/"S/N" ou sem a parte)
  bairro: string
}

/**
 * Normaliza o endereço residencial do cadastro ("rua, numero, complemento, bairro").
 * Retorna null quando não há nada aproveitável.
 */
export function normalizarEnderecoCasa(endereco: string | null): EnderecoCasaNormalizado | null {
  const partes = String(endereco || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (partes.length === 0) return null
  let rua = partes[0]
  const dupla = rua.match(RUA_DUPLA)
  if (dupla) rua = dupla[1]
  let numero = partes[1] || ''
  if (/^(0|S\/?N)$/i.test(numero)) numero = ''
  // bairro = última parte limpa de lixo e não numérica; complementos do meio
  // ("LT 59", "CS 3") são descartados.
  let bairro = ''
  for (let i = partes.length - 1; i >= 1; i--) {
    const limpa = partes[i].replace(LIXO_COMPLEMENTO, '').trim()
    if (limpa && !/^\d+$/.test(limpa)) {
      bairro = limpa
      break
    }
  }
  return { rua, numero, bairro }
}

/**
 * Precisão alcançável do endereço: 'exato' só com rua + número válido;
 * qualquer outra situação (inclusive endereço nulo) cai para 'bairro' —
 * o trajeto nasce marcado e exige confirmação humana.
 */
export function precisaoDoEndereco(endereco: string | null): PrecisaoOrigemVT {
  const limpo = normalizarEnderecoCasa(endereco)
  if (limpo && limpo.rua && limpo.numero) return 'exato'
  return 'bairro'
}

/**
 * Texto de origem para o link do Google Maps: "rua, numero, bairro, cidade"
 * quando exato; "bairro, cidade" quando não. Sem nada aproveitável, só a cidade.
 */
export function textoOrigemCasa(endereco: string | null, cidade: string | null): string {
  const limpo = normalizarEnderecoCasa(endereco)
  const partes: string[] = []
  if (limpo) {
    const ruaNumero = limpo.numero ? `${limpo.rua}, ${limpo.numero}` : limpo.rua
    partes.push(ruaNumero)
    if (limpo.bairro) partes.push(limpo.bairro)
  }
  if (cidade) partes.push(cidade)
  return partes.join(', ')
}

/** Link gratuito do Google Maps (modo transporte público), sem chave de API. */
export function linkGoogleMapsTransito(origem: string, destino: string): string {
  const o = encodeURIComponent(origem)
  const d = encodeURIComponent(destino)
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=transit`
}
