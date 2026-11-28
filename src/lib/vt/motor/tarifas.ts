import {
  TARIFAS_DETRO_2026,
  TARIFAS_DETRO_2026_META,
  type TarifaDetro2026,
} from '@/lib/vt/dados/tarifasDetro2026'
import type { ModalPerna, OpcaoSecaoDetro, PendenciaMotor } from '@/lib/vt/motor/tipos'

/** Tarifa de um modal com vigência e fonte — nunca número solto no código. */
export interface TarifaModal {
  chave: string
  descricao: string
  valorCentavos: number
  vigenteDesde: string
  vigenteAte: string | null
  fonte: string
  url: string
  /** Valor ainda não confirmado pela gestora: calcula, mas gera pendência. */
  aConferir: boolean
  regra: string
}

const RIOCARD_TARIFAS = {
  fonte: 'Riocard Mais — tarifas vigentes (tabela de 28/09/2026)',
  url: 'http://www.riocardmais.com.br/Tarifas',
}

export const TARIFAS_MODAIS: readonly TarifaModal[] = [
  {
    chave: 'onibus_municipal_niteroi',
    descricao: 'ônibus municipal de Niterói (tarifa integral)',
    valorCentavos: 560,
    vigenteDesde: '2025-07-06',
    vigenteAte: null,
    fonte: 'Riocard Mais — Bilhete Único Niterói / Prefeitura de Niterói',
    url: 'https://site.riobilheteunico.com.br/bilhete-unico-niteroi/',
    aConferir: false,
    regra: 'Regras §3',
  },
  {
    chave: 'trem',
    descricao: 'trem',
    valorCentavos: 760,
    vigenteDesde: '2026-09-28',
    vigenteAte: null,
    ...RIOCARD_TARIFAS,
    aConferir: false,
    regra: 'Regras §7',
  },
  {
    chave: 'metro',
    descricao: 'metrô',
    valorCentavos: 790,
    vigenteDesde: '2026-09-28',
    vigenteAte: null,
    ...RIOCARD_TARIFAS,
    aConferir: false,
    regra: 'Regras §7',
  },
  {
    // Fora do documento de regras: valor do cadastro de tarifas do sistema; gestora deve confirmar.
    chave: 'onibus_municipal_sao_goncalo',
    descricao: 'ônibus municipal de São Gonçalo',
    valorCentavos: 555,
    vigenteDesde: '2026-09-28',
    vigenteAte: null,
    ...RIOCARD_TARIFAS,
    aConferir: true,
    regra: 'Proposta VT §5 (tarifa a conferir)',
  },
  {
    // Itaboraí (gratuito desde 23/05/2025) e Maricá (EPT "vermelhinho"): perna municipal custa R$ 0.
    chave: 'onibus_municipal_gratuito',
    descricao: 'ônibus municipal gratuito (Itaboraí/Maricá)',
    valorCentavos: 0,
    vigenteDesde: '2025-05-23',
    vigenteAte: null,
    fonte: 'Parecer VT de 21/11/2026 (§3.5): ônibus municipal gratuito em Itaboraí (desde 23/05/2025) e Maricá',
    url: '',
    aConferir: false,
    regra: 'Regras §6',
  },
  {
    // Confirmado pela gestora em 28/11/2026: R$ 5,00 no ônibus municipal do Rio,
    // SOMENTE pagando com o Jaé (modal 'onibus_municipal_rio' = sistema Jaé).
    chave: 'onibus_municipal_rio',
    descricao: 'ônibus municipal do Rio (Jaé)',
    valorCentavos: 500,
    vigenteDesde: '2025-08-02',
    vigenteAte: null,
    fonte: 'Jaé — integrações e modais municipais do Rio (consulta de 14/11/2026); valor confirmado pela gestora em 28/11/2026 (só no Jaé)',
    url: 'https://jae.com.br/integracoes/',
    aConferir: false,
    regra: 'Regras VT — ônibus municipal do Rio pelo Jaé (confirmado 28/11/2026)',
  },
]

/**
 * Ônibus municipal de Niterói com o Bilhete Único de Niterói (BUN) habilitado
 * (decisão da gestora, 19/11/2026; Regras §3 "Valores"). Vale para a viagem paga
 * e para a integração de 2 ônibus municipais (uma tarifa só), com limite de
 * 2 viagens por dia por pessoa; da 3ª viagem paga em diante vale a tarifa cheia
 * (`onibus_municipal_niteroi`, R$ 5,60 — também a do dinheiro e da exceção
 * "tarifa cheia"). Confirmado por pesquisa da gestora com usuários (21/11/2026); extrato formal de cartão VT seria a prova definitiva.
 */
export const TARIFA_NITEROI_BUN = {
  valorCentavos: 445,
  limiteViagensPorDia: 2,
  vigenteDesde: '2025-07-06',
  vigenteAte: null as string | null,
  fonte:
    'Lei municipal 3.887/2024 (subsídio tarifário) e Prefeitura de Niterói (04/07/2025): BUN continua a R$ 4,45',
  url: 'https://niteroi.rj.gov.br/prefeitura-mantem-tarifa-reduzida-para-usuarios-do-bilhete-unico-municipal/',
  regra: 'Regras §3 — Valores',
} as const

/** Valor da integração BUI por viagem integrada (Regras §4). */
export const TARIFA_INTEGRACAO_BUI = {
  valorCentavos: 940,
  vigenteDesde: '2025-12-19',
  vigenteAte: null as string | null,
  fonte: 'Rio Bilhete Único — Bilhete Único Intermunicipal',
  url: 'https://site.riobilheteunico.com.br/bilhete-unico-intermunicipal/',
  regra: 'Regras §4',
} as const

/**
 * Linhas DETRO da categoria "AC" (serviço com ar-condicionado/rodoviário): não está
 * confirmado que o BUI vale nelas — nunca presumir integração. Começou com 2144R/4144R
 * de Maricá (Parecer VT 21/11/2026, §3.5); a auditoria de 21/11/2026 achou o BUI
 * aplicado a outras linhas AC (6144R, 2590R, 2520D, 2425D, 4425D), então a regra
 * passou a valer para TODA linha com categoria AC na tabela DETRO.
 */
const LINHAS_CATEGORIA_AC: ReadonlySet<string> = new Set(
  TARIFAS_DETRO_2026.filter((r) => r.categoria === 'AC').map((r) => normalizarLinha(r.linha)).filter((c) => c !== ''),
)

export function ehLinhaCategoriaAC(linha: string | null | undefined): boolean {
  const codigo = normalizarLinha(linha)
  return codigo !== '' && LINHAS_CATEGORIA_AC.has(codigo)
}

export function vigenteNaData(desde: string, ate: string | null, data: string): boolean {
  return data >= desde && (ate === null || data <= ate)
}

export type BuscaTarifaModal =
  | { tipo: 'ok'; tarifa: TarifaModal }
  | { tipo: 'sem_tarifa' }
  | { tipo: 'fora_da_vigencia'; tarifa: TarifaModal }

export function buscarTarifaModal(
  modal: ModalPerna,
  dataServico: string,
  tabela: readonly TarifaModal[] = TARIFAS_MODAIS,
): BuscaTarifaModal {
  const t = tabela.find((x) => x.chave === modal)
  if (!t) return { tipo: 'sem_tarifa' }
  if (!vigenteNaData(t.vigenteDesde, t.vigenteAte, dataServico)) {
    return { tipo: 'fora_da_vigencia', tarifa: t }
  }
  return { tipo: 'ok', tarifa: t }
}

export function normalizarLinha(linha: string | null | undefined): string {
  return (linha ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

export function reais(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`
}

export type BuscaTarifaDetro =
  | { tipo: 'ok'; valorCentavos: number; precisaConferir: boolean; registros: TarifaDetro2026[] }
  | { tipo: 'indeterminado'; pendencia: PendenciaMotor }

/**
 * Trechos (seções) escolhíveis de uma linha DETRO. Só há opções quando a linha tem
 * mais de um valor possível (percurso inteiro + seções). Seção ilegível no PDF
 * (null) ou número de seção com mais de um valor (variantes por via) NÃO viram
 * opção: não dá para identificar com segurança, então ficam para conferência.
 */
export function opcoesSecaoDetro(
  linhaBruta: string | null | undefined,
  tabela: readonly TarifaDetro2026[] = TARIFAS_DETRO_2026,
): OpcaoSecaoDetro[] {
  const linha = normalizarLinha(linhaBruta)
  if (!linha) return []
  const daLinha = tabela.filter((r) => r.linha === linha)
  if (new Set(daLinha.map((r) => r.valorCentavos)).size < 2) return []
  const porSecao = new Map<number, TarifaDetro2026[]>()
  for (const r of daLinha) {
    if (r.secao === null) continue
    porSecao.set(r.secao, [...(porSecao.get(r.secao) ?? []), r])
  }
  const opcoes: OpcaoSecaoDetro[] = []
  for (const [secao, regs] of [...porSecao.entries()].sort((a, b) => a[0] - b[0])) {
    if (new Set(regs.map((r) => r.valorCentavos)).size !== 1) continue
    const nome = regs[0].denominacao + (regs[0].via ? ` ${regs[0].via}` : '')
    opcoes.push({
      secao,
      rotulo: secao === 0 ? `Percurso inteiro (${nome})` : nome,
      valorCentavos: regs[0].valorCentavos,
    })
  }
  return opcoes
}

function descreverOpcao(r: TarifaDetro2026): string {
  const partes = [`seção ${r.secao ?? '?'}`, r.denominacao]
  if (r.via) partes.push(r.via)
  if (r.categoria) partes.push(`cat. ${r.categoria}`)
  return `${partes.join(' ')}: ${reais(r.valorCentavos)}`
}

const REGRA_DETRO = 'Regras §6, §11'

function indeterminada(codigo: string, mensagem: string): BuscaTarifaDetro {
  return { tipo: 'indeterminado', pendencia: { codigo, mensagem, regra: REGRA_DETRO } }
}

/**
 * Tarifa DETRO por linha + seção, vigente na data (Regras §6, §11).
 * Nunca chuta: linha fora da tabela, seção ambígua ou data anterior à vigência
 * resultam em pendência com valor indeterminado.
 */
export function buscarTarifaDetro(
  linhaBruta: string | null | undefined,
  secao: number | string | null | undefined,
  dataServico: string,
  tabela: readonly TarifaDetro2026[] = TARIFAS_DETRO_2026,
  meta: { vigenteDesde: string; vigenteAte: string | null } = TARIFAS_DETRO_2026_META,
): BuscaTarifaDetro {
  const linha = normalizarLinha(linhaBruta)
  if (!linha) {
    return indeterminada(
      'DETRO_LINHA_NAO_INFORMADA',
      'A linha do ônibus intermunicipal não foi informada: valor a conferir.',
    )
  }
  if (!vigenteNaData(meta.vigenteDesde, meta.vigenteAte, dataServico)) {
    return indeterminada(
      'DETRO_FORA_DA_VIGENCIA',
      `O valor da linha ${linha} só está cadastrado a partir de ${meta.vigenteDesde}, então não há valor para ${dataServico}.`,
    )
  }

  const daLinha = tabela.filter((r) => r.linha === linha)
  if (daLinha.length === 0) {
    return indeterminada(
      'DETRO_LINHA_FORA_DA_TABELA',
      `O valor da linha ${linha} está a conferir: ela não consta na tabela oficial do DETRO que temos.`,
    )
  }

  const secaoInformada =
    secao === null || secao === undefined || String(secao).trim() === '' ? null : Number(secao)
  let candidatos = daLinha
  if (secaoInformada !== null) {
    if (Number.isNaN(secaoInformada)) {
      return indeterminada(
        'DETRO_SECAO_INVALIDA',
        `A seção "${secao}" da linha ${linha} não é válida: a conferir.`,
      )
    }
    candidatos = daLinha.filter((r) => r.secao === secaoInformada)
    if (candidatos.length === 0) {
      return indeterminada(
        'DETRO_SECAO_NAO_ENCONTRADA',
        `A seção ${secaoInformada} da linha ${linha} não consta na tabela oficial: a conferir. Opções: ${daLinha.map(descreverOpcao).join('; ')}.`,
      )
    }
  }

  const valores = new Set(candidatos.map((r) => r.valorCentavos))
  if (valores.size > 1 && secaoInformada === null) {
    const opcoes = opcoesSecaoDetro(linha, tabela)
    if (opcoes.length > 0) {
      return {
        tipo: 'indeterminado',
        pendencia: {
          codigo: 'DETRO_SECAO_ESCOLHER',
          mensagem: `Escolher o trecho (seção) da linha ${linha}: o valor depende de onde a pessoa embarca e desce. Opções: ${opcoes.map((o) => `${o.rotulo}: ${reais(o.valorCentavos)}`).join('; ')}.`,
          regra: REGRA_DETRO,
          linha,
          opcoesSecao: opcoes,
        },
      }
    }
  }
  if (valores.size > 1) {
    const rotulo = secaoInformada === null ? 'Seção' : 'Variante'
    return indeterminada(
      'DETRO_SECAO_AMBIGUA',
      `${rotulo === 'Seção' ? 'A seção' : 'A variante'} da linha ${linha} está a conferir, porque há mais de um valor possível: ${candidatos.map(descreverOpcao).join('; ')}.`,
    )
  }

  const valorCentavos = candidatos[0].valorCentavos
  const precisaConferir = candidatos.every((r) => r.precisaConferir)
  return { tipo: 'ok', valorCentavos, precisaConferir, registros: candidatos }
}
