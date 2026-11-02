// Lógica pura do módulo VT — normalização de endereços residenciais
// (regras validadas na POC de 21/10/2026, scripts/poc-vt-normalizar-enderecos.mjs).
// Os endereços vêm sujos da Alterdata: número "0", lote/quadra/bloco no meio do
// texto ("LT 59", "53 FUNDOS", "CS 3"), rua dupla grudada. Para geocodificar
// (fase futura) e para montar o link do Google Maps, o endereço é limpo antes.

import { removerAcentos } from '@/lib/utils'
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

// Faixas de CEP por UF (Correios). Determinístico — não é palpite: o CEP
// 20000-000 a 28999-999 é sempre RJ.
const FAIXAS_CEP_UF: Array<[number, number, string]> = [
  [1000, 19999, 'SP'], [20000, 28999, 'RJ'], [29000, 29999, 'ES'], [30000, 39999, 'MG'],
  [40000, 48999, 'BA'], [49000, 49999, 'SE'], [50000, 56999, 'PE'], [57000, 57999, 'AL'],
  [58000, 58999, 'PB'], [59000, 59999, 'RN'], [60000, 63999, 'CE'], [64000, 64999, 'PI'],
  [65000, 65999, 'MA'], [66000, 68899, 'PA'], [68900, 68999, 'AP'], [69000, 69299, 'AM'],
  [69300, 69399, 'RR'], [69400, 69899, 'AM'], [69900, 69999, 'AC'], [70000, 73699, 'DF'],
  [73700, 76799, 'GO'], [76800, 76999, 'RO'], [77000, 77999, 'TO'], [78000, 78899, 'MT'],
  [79000, 79999, 'MS'], [80000, 87999, 'PR'], [88000, 89999, 'SC'], [90000, 99999, 'RS'],
]

/** CEP com 8 dígitos formatado "00000-000"; null quando inválido. */
export function cepFormatado(cep: string | null | undefined): string | null {
  const digitos = String(cep || '').replace(/\D/g, '')
  if (digitos.length !== 8 || /^0+$/.test(digitos)) return null
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`
}

/** UF pela faixa do CEP; null quando o CEP é inválido. */
export function ufDoCep(cep: string | null | undefined): string | null {
  const formatado = cepFormatado(cep)
  if (!formatado) return null
  const prefixo = Number(formatado.slice(0, 5))
  return FAIXAS_CEP_UF.find(([de, ate]) => prefixo >= de && prefixo <= ate)?.[2] ?? null
}

// Faixas de CEP por município da nossa região de operação (Correios) —
// determinístico, não é palpite. Fora dessas faixas: null (sem aviso).
// Caso real (28/10/2026): Thiago Lontra cadastrado em "Niterói" com endereço
// no Jardim Catarina (CEP 244xx = São Gonçalo) e José Orlando Targino idem
// (Tribobó, 24750) — a cidade errada derrubou o bilhete no lote de 24/10.
const FAIXAS_CEP_CIDADE: Array<[number, number, string]> = [
  [20000, 23999, 'RIO DE JANEIRO'],
  [24000, 24399, 'NITEROI'],
  [24400, 24799, 'SAO GONCALO'],
  [24800, 24899, 'ITABORAI'],
  [24900, 24999, 'MARICA'],
  [25000, 25299, 'DUQUE DE CAXIAS'],
  [26000, 26299, 'NOVA IGUACU'],
  [26500, 26599, 'NILOPOLIS'],
  [27900, 27999, 'MACAE'],
]

/** Município pela faixa do CEP (só a região de operação); null quando fora ou inválido. */
export function cidadeDoCep(cep: string | null | undefined): string | null {
  const formatado = cepFormatado(cep)
  if (!formatado) return null
  const prefixo = Number(formatado.slice(0, 5))
  return FAIXAS_CEP_CIDADE.find(([de, ate]) => prefixo >= de && prefixo <= ate)?.[2] ?? null
}

/**
 * Aviso quando a cidade cadastrada diverge do município do CEP (cadastro
 * errado roteiriza errado — o link do Maps e a classificação de bilhete
 * partem da cidade). Null quando confere ou quando não há base (CEP fora da
 * região mapeada). Só aviso — nunca bloqueia.
 */
export function avisoCidadeDivergeDoCep(cidade: string | null, cep: string | null | undefined): string | null {
  const doCep = cidadeDoCep(cep)
  if (!doCep || !cidade?.trim()) return null
  const cadastro = removerAcentos(cidade.trim()).toUpperCase()
  if (cadastro === doCep) return null
  const nome = doCep.charAt(0) + doCep.slice(1).toLowerCase()
  return `O CEP da casa é de ${nome}, mas o cadastro diz ${cidade.trim()} — confira o endereço (o trajeto é calculado pela cidade).`
}

// "cidade - UF, 00000-000": sem UF e CEP o Google confunde ruas de nome comum
// ("Rua Sete") e cidades homônimas ("São Gonçalo"), e não acha loteamentos
// que ele não conhece pelo nome do bairro (caso Spar Inoã, 24/10/2026).
function cidadeUfCep(cidade: string | null, cep?: string | null): string[] {
  const uf = ufDoCep(cep)
  const formatado = cepFormatado(cep)
  const partes: string[] = []
  if (cidade && uf) partes.push(`${cidade} - ${uf}`)
  else if (cidade) partes.push(cidade)
  else if (uf) partes.push(uf)
  if (formatado) partes.push(formatado)
  return partes
}

/**
 * Texto de origem para o link do Google Maps: "rua, numero, bairro, cidade - UF, CEP"
 * quando exato; "rua, bairro, cidade - UF, CEP" quando não. Sem nada aproveitável,
 * só a cidade (e o CEP, se houver).
 */
export function textoOrigemCasa(endereco: string | null, cidade: string | null, cep?: string | null): string {
  const limpo = normalizarEnderecoCasa(endereco)
  const partes: string[] = []
  if (limpo) {
    const ruaNumero = limpo.numero ? `${limpo.rua}, ${limpo.numero}` : limpo.rua
    partes.push(ruaNumero)
    if (limpo.bairro) partes.push(limpo.bairro)
  }
  partes.push(...cidadeUfCep(cidade, cep))
  return partes.join(', ')
}

/** Destino do link: endereço do posto + cidade - UF, CEP; sem endereço, o nome do posto. */
export function textoDestinoPosto(dep: {
  endereco: string | null
  cidade: string | null
  cep?: string | null
  nome_curto: string | null
  nome: string
}): string {
  const partes = [dep.endereco?.trim(), ...cidadeUfCep(dep.cidade, dep.cep)].filter(Boolean) as string[]
  return dep.endereco?.trim() || dep.cidade ? partes.join(', ') : dep.nome_curto || dep.nome
}

/** Link gratuito do Google Maps (modo transporte público), sem chave de API. */
export function linkGoogleMapsTransito(origem: string, destino: string): string {
  const o = encodeURIComponent(origem)
  const d = encodeURIComponent(destino)
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=transit`
}
