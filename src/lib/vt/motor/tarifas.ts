import {
  TARIFAS_DETRO_2026,
  TARIFAS_DETRO_2026_META,
  type TarifaDetro2026,
} from '@/lib/vt/dados/tarifasDetro2026'
import type { ModalPerna, PendenciaMotor } from '@/lib/vt/motor/tipos'

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
    // Fora do documento de regras: valor do cadastro de tarifas do sistema (Jaé); gestora deve confirmar.
    chave: 'onibus_municipal_rio',
    descricao: 'ônibus municipal do Rio (Jaé)',
    valorCentavos: 500,
    vigenteDesde: '2025-08-02',
    vigenteAte: null,
    fonte: 'Jaé — integrações e modais municipais do Rio (consulta de 14/11/2026)',
    url: 'https://jae.com.br/integracoes/',
    aConferir: true,
    regra: 'Proposta VT §5 (tarifa a conferir)',
  },
]

/** Valor da integração BUI por viagem integrada (Regras §4). */
export const TARIFA_INTEGRACAO_BUI = {
  valorCentavos: 940,
  vigenteDesde: '2025-12-19',
  vigenteAte: null as string | null,
  fonte: 'Rio Bilhete Único — Bilhete Único Intermunicipal',
  url: 'https://site.riobilheteunico.com.br/bilhete-unico-intermunicipal/',
  regra: 'Regras §4',
} as const

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
      'Linha intermunicipal não informada: tarifa a conferir.',
    )
  }
  if (!vigenteNaData(meta.vigenteDesde, meta.vigenteAte, dataServico)) {
    return indeterminada(
      'DETRO_FORA_DA_VIGENCIA',
      `Tarifa DETRO da linha ${linha} só está cadastrada a partir de ${meta.vigenteDesde}; serviço em ${dataServico} sem tarifa vigente cadastrada.`,
    )
  }

  const daLinha = tabela.filter((r) => r.linha === linha)
  if (daLinha.length === 0) {
    return indeterminada(
      'DETRO_LINHA_FORA_DA_TABELA',
      `Tarifa da linha ${linha} a conferir (linha não consta na Portaria DETRO cadastrada).`,
    )
  }

  const secaoInformada =
    secao === null || secao === undefined || String(secao).trim() === '' ? null : Number(secao)
  let candidatos = daLinha
  if (secaoInformada !== null) {
    if (Number.isNaN(secaoInformada)) {
      return indeterminada(
        'DETRO_SECAO_INVALIDA',
        `Seção "${secao}" da linha ${linha} inválida: a conferir.`,
      )
    }
    candidatos = daLinha.filter((r) => r.secao === secaoInformada)
    if (candidatos.length === 0) {
      return indeterminada(
        'DETRO_SECAO_NAO_ENCONTRADA',
        `Seção ${secaoInformada} da linha ${linha} não consta na Portaria: a conferir. Opções: ${daLinha.map(descreverOpcao).join('; ')}.`,
      )
    }
  }

  const valores = new Set(candidatos.map((r) => r.valorCentavos))
  if (valores.size > 1) {
    const rotulo = secaoInformada === null ? 'Seção' : 'Variante'
    return indeterminada(
      'DETRO_SECAO_AMBIGUA',
      `${rotulo} da linha ${linha} a conferir; opções: ${candidatos.map(descreverOpcao).join('; ')}.`,
    )
  }

  const valorCentavos = candidatos[0].valorCentavos
  const precisaConferir = candidatos.every((r) => r.precisaConferir)
  return { tipo: 'ok', valorCentavos, precisaConferir, registros: candidatos }
}
