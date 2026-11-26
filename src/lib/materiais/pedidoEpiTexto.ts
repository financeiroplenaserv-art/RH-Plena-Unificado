// Leitura do texto do pedido de EPI de uma planilha mensal ("EPIs Dezembro.26.xlsx"):
// "02 Luvas látex G", "01 Bota 40+02 luvas látex M", "01 Botina 40+01 luva PVC+02 máscaras".
//
// Função PURA (sem banco). Só devolve o que o texto diz; quem decide o item do catálogo é o
// script de importação. Regra do projeto — "importação nunca grava palpite": o que não é
// de-para confirmado pela gestora sai marcado como pendência (`pendencia`), com a sugestão.

import { normalizarTexto } from './normalizar'

export type PecaEpi =
  | 'luva_latex'
  | 'luva_nitrilica'
  | 'luva_pvc'
  | 'luva_termica'
  | 'luva_pigmentada'
  | 'bota'
  | 'botina'
  | 'mascara'
  | 'oculos'
  | 'avental'
  | 'manguito'
  | 'desconhecida'

export interface ParteEpi {
  /** Trecho original (entre os "+"). */
  texto: string
  peca: PecaEpi
  quantidade: number
  /** true = o texto trazia o número ("02 luvas"); false = assumido 1. */
  quantidadeExplicita: boolean
  /** Tamanho como vai para o catálogo (P/M/G/EG ou número de calçado); null = sem tamanho. */
  tamanho: string | null
  /** Tamanho como estava escrito ("extra G", "9"); null = não havia. */
  tamanhoOriginal: string | null
  /** De-para confirmado aplicado (ex.: "nitrílica 9 → G"); vazio = casamento direto. */
  dePara: string
  /** Preenchido quando a parte NÃO pode ser gravada sem a gestora decidir. */
  pendencia: string | null
}

export type ResultadoPedidoEpi =
  | { tipo: 'ignorar'; motivo: string }
  | { tipo: 'pedido'; partes: ParteEpi[] }

const IGNORAR: { padrao: RegExp; motivo: string }[] = [
  { padrao: /^demitid[oa]$/, motivo: 'demitido(a)' },
  { padrao: /^nao precisa\b/, motivo: 'não precisa' },
  { padrao: /^nao teve pedido$/, motivo: 'não teve pedido' },
  { padrao: /^contrato rescindido$/, motivo: 'contrato rescindido' },
  { padrao: /^abandono$/, motivo: 'abandono' },
]

/** Remove parênteses ("(I)", "(periculosidade)"…) e espaços sobrando do nome da planilha. */
export function limparNomePlanilha(nome: string | null | undefined): string {
  return String(nome ?? '')
    .replace(/\([^)]*\)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const NUMERO_INICIAL = /^(\d{1,2})\s+(?=\S)/

function lerTamanho(resto: string): { bruto: string | null; sobra: string } {
  // "extra g" / "extra eg" / "eg" / "xg" / letras / números de 1 a 2 dígitos
  const m = resto.match(/(?:^|\s)(extra\s+e?g|eg|egg|xg|xgg|gg|pp|p|m|g|\d{1,2})(?=\s|$)/)
  if (!m) return { bruto: null, sobra: resto }
  const bruto = m[1].replace(/\s+/g, ' ')
  return { bruto, sobra: (resto.slice(0, m.index) + ' ' + resto.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, ' ').trim() }
}

const CAMINHOS: { peca: PecaEpi; padrao: RegExp }[] = [
  { peca: 'luva_latex', padrao: /\bluvas? (de )?latex\b/ },
  { peca: 'luva_nitrilica', padrao: /\bluvas? nitril(?:ic|i)a?s?\b/ },
  { peca: 'luva_pvc', padrao: /\bluvas? pvc\b/ },
  { peca: 'luva_termica', padrao: /\bluvas? termicas?\b/ },
  { peca: 'luva_pigmentada', padrao: /\bluvas? (de malha )?pigmentadas?\b/ },
  { peca: 'botina', padrao: /\bbotinas?\b/ },
  { peca: 'bota', padrao: /\bbotas?\b/ },
  { peca: 'mascara', padrao: /\bmascaras?\b/ },
  { peca: 'oculos', padrao: /\boculos\b/ },
  { peca: 'avental', padrao: /\bavental\b|\baventais\b/ },
  { peca: 'manguito', padrao: /\bmanguitos?\b/ },
]

const NOME_PECA: Record<PecaEpi, string> = {
  luva_latex: 'luva látex',
  luva_nitrilica: 'luva nitrílica',
  luva_pvc: 'luva PVC',
  luva_termica: 'luva térmica',
  luva_pigmentada: 'luva pigmentada',
  bota: 'bota',
  botina: 'botina',
  mascara: 'máscara',
  oculos: 'óculos',
  avental: 'avental',
  manguito: 'manguito',
  desconhecida: 'peça',
}

/** Lê UMA parte ("02 Luvas látex G"). */
export function lerParteEpi(textoParte: string): ParteEpi {
  const original = textoParte.trim()
  let n = normalizarTexto(original)
  let quantidade = 1
  let quantidadeExplicita = false
  const mq = n.match(NUMERO_INICIAL)
  if (mq) {
    quantidade = Number(mq[1])
    quantidadeExplicita = true
    n = n.slice(mq[0].length)
  }
  const base: ParteEpi = { texto: original, peca: 'desconhecida', quantidade, quantidadeExplicita, tamanho: null, tamanhoOriginal: null, dePara: '', pendencia: null }
  const achada = CAMINHOS.find((c) => c.padrao.test(n))
  if (!achada) return { ...base, pendencia: `peça não reconhecida: "${original}"` }
  const parte: ParteEpi = { ...base, peca: achada.peca }
  if (quantidade < 1) return { ...parte, pendencia: 'quantidade zero' }

  // Resto do texto sem o nome da peça: o que sobrar é tamanho (ou lixo).
  const resto = n.replace(achada.padrao, ' ').replace(/\s+/g, ' ').trim()
  const { bruto, sobra } = lerTamanho(resto)
  parte.tamanhoOriginal = bruto
  if (sobra) return { ...parte, pendencia: `texto não reconhecido em "${original}": "${sobra}"` }

  switch (achada.peca) {
    case 'luva_latex': {
      if (!bruto) return { ...parte, pendencia: 'luva látex sem tamanho' }
      if (/^extra e?g$/.test(bruto)) return { ...parte, tamanho: 'EG', dePara: 'extra G → EG' }
      if (['p', 'm', 'g', 'eg'].includes(bruto)) return { ...parte, tamanho: bruto.toUpperCase() }
      return { ...parte, pendencia: `tamanho "${bruto}" da luva látex não é P/M/G/EG` }
    }
    case 'luva_nitrilica': {
      if (!bruto) return { ...parte, pendencia: 'luva nitrílica sem tamanho' }
      if (bruto === '8') return { ...parte, tamanho: 'M', dePara: 'nitrílica 8 → M' }
      if (bruto === '9') return { ...parte, tamanho: 'G', dePara: 'nitrílica 9 → G' }
      if (/^extra e?g$/.test(bruto)) return { ...parte, tamanho: 'EG', dePara: 'extra G → EG' }
      if (['m', 'g', 'eg'].includes(bruto)) return { ...parte, tamanho: bruto.toUpperCase() }
      return { ...parte, pendencia: `tamanho "${bruto}" da luva nitrílica sem de-para confirmado` }
    }
    case 'bota':
    case 'botina': {
      if (!bruto || !/^\d{2}$/.test(bruto)) return { ...parte, pendencia: `${NOME_PECA[achada.peca]} sem número de calçado` }
      return { ...parte, tamanho: bruto }
    }
    case 'luva_pvc':
    case 'mascara':
    case 'oculos':
      if (bruto) return { ...parte, pendencia: `${NOME_PECA[achada.peca]} não tem tamanho, mas o texto traz "${bruto}"` }
      return parte
    // Decisões da gestora (26/11/2026): luva térmica = LUVA TÉRMICA Tam. 11 (único tamanho do
    // catálogo, qualquer tamanho escrito); avental = AVENTAL (cód. 686); manguito = MANGUITO;
    // luva pigmentada = LUVA DE MALHA PIGMENTADA (cód. 642).
    case 'luva_termica':
      return { ...parte, tamanho: null, dePara: bruto ? `luva térmica ${bruto} → LUVA TÉRMICA Tam. 11 (único tamanho)` : 'luva térmica → LUVA TÉRMICA Tam. 11' }
    case 'luva_pigmentada': // = LUVA DE MALHA PIGMENTADA (gestora, 26/11/2026)
    case 'avental':
    case 'manguito':
      if (bruto) return { ...parte, pendencia: `${NOME_PECA[achada.peca]} não tem tamanho, mas o texto traz "${bruto}"` }
      return parte
    default:
      return parte
  }
}

/** Lê o texto inteiro da célula (partes separadas por "+"). */
export function lerPedidoEpi(texto: string | null | undefined): ResultadoPedidoEpi {
  const bruto = String(texto ?? '').trim()
  if (!bruto) return { tipo: 'ignorar', motivo: 'vazio' }
  const n = normalizarTexto(bruto)
  for (const r of IGNORAR) if (r.padrao.test(n)) return { tipo: 'ignorar', motivo: r.motivo }
  const partes = bruto.split('+').map((p) => p.trim()).filter(Boolean).map(lerParteEpi)
  if (partes.length === 0) return { tipo: 'ignorar', motivo: 'vazio' }
  return { tipo: 'pedido', partes }
}
