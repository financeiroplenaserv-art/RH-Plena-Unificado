import type { AlternativaRotaGoogleVT } from '@/lib/vt/googleRoutes'
import { ehCodigoLinhaMunicipalNiteroi } from '@/lib/vt/googleRoutes'
import type { ModalTransporteVT, PernaItinerarioVT, SistemaTarifarioVT } from '@/lib/vt/contratosTarifarios'
import { TARIFAS_DETRO_2026 } from '@/lib/vt/dados/tarifasDetro2026'
import { normalizarLinha } from '@/lib/vt/motor/tarifas'

/**
 * Rota informada à mão pelo RH (25/11/2026): a gestora já sabe qual ônibus a pessoa usa.
 * A lista digitada vira pernas no mesmo formato do adaptador do Google, para o MESMO motor
 * calcular o valor. Linha que não é reconhecida NUNCA recebe preço: vira pendência.
 */

export type TipoConducaoManual =
  | 'linha'
  | 'onibus_municipal_niteroi'
  | 'onibus_municipal_sao_goncalo'
  | 'onibus_municipal_rio'
  | 'onibus_municipal_gratuito'
  | 'trem'
  | 'metro'
  | 'barca'
  | 'vlt'
  | 'brt'
  | 'van'

export interface ConducaoManual {
  id: string
  tipo: TipoConducaoManual
  /** Código digitado (só quando tipo = 'linha'). */
  codigo?: string
  /** Trecho DETRO escolhido, quando a linha cobra por seção. */
  secao?: { secao: number; rotulo: string } | null
}

/** Meios que a pessoa escolhe numa lista (não têm código de linha). */
export const OPCOES_MODAL_MANUAL: readonly { tipo: Exclude<TipoConducaoManual, 'linha'>; rotulo: string }[] = [
  { tipo: 'onibus_municipal_niteroi', rotulo: 'Ônibus municipal de Niterói' },
  { tipo: 'onibus_municipal_sao_goncalo', rotulo: 'Ônibus municipal de São Gonçalo' },
  { tipo: 'onibus_municipal_rio', rotulo: 'Ônibus municipal do Rio' },
  { tipo: 'onibus_municipal_gratuito', rotulo: 'Ônibus municipal gratuito (Itaboraí/Maricá)' },
  { tipo: 'barca', rotulo: 'Barca' },
  { tipo: 'metro', rotulo: 'Metrô' },
  { tipo: 'trem', rotulo: 'Trem' },
  { tipo: 'vlt', rotulo: 'VLT' },
  { tipo: 'brt', rotulo: 'BRT' },
  { tipo: 'van', rotulo: 'Van' },
]

export type ClassificacaoLinha =
  | { tipo: 'detro'; texto: string }
  | { tipo: 'municipal_niteroi'; texto: string }
  | { tipo: 'desconhecida'; texto: string }

/** Código na tabela DETRO → intermunicipal; formato municipal de Niterói → ônibus de Niterói; senão, desconhecida. */
export function classificarCodigoLinha(codigoBruto: string | null | undefined): ClassificacaoLinha {
  const codigo = normalizarLinha(codigoBruto)
  if (!codigo) return { tipo: 'desconhecida', texto: 'Digite o código da linha.' }
  if (TARIFAS_DETRO_2026.some((r) => r.linha === codigo)) {
    return { tipo: 'detro', texto: 'Intermunicipal (DETRO)' }
  }
  if (ehCodigoLinhaMunicipalNiteroi(codigo)) {
    return { tipo: 'municipal_niteroi', texto: 'Ônibus municipal de Niterói' }
  }
  return { tipo: 'desconhecida', texto: 'Linha não encontrada — não dá para calcular o valor' }
}

export function descreverConducao(c: ConducaoManual): { titulo: string; classificacao: string; reconhecida: boolean } {
  if (c.tipo === 'linha') {
    const cl = classificarCodigoLinha(c.codigo)
    return { titulo: normalizarLinha(c.codigo) || '—', classificacao: cl.texto, reconhecida: cl.tipo !== 'desconhecida' }
  }
  const rotulo = OPCOES_MODAL_MANUAL.find((o) => o.tipo === c.tipo)?.rotulo ?? c.tipo
  return { titulo: rotulo, classificacao: 'Meio escolhido na lista', reconhecida: true }
}

let contador = 0
export function novoIdConducao(): string {
  contador += 1
  return `cm-${contador}`
}

/** Volta pré-preenchida: as mesmas conduções em ordem inversa (cada uma com id novo e o mesmo trecho DETRO). */
export function inverterConducoes(lista: readonly ConducaoManual[]): ConducaoManual[] {
  return [...lista].reverse().map((c) => ({ ...c, id: novoIdConducao() }))
}

const MODAL_DO_TIPO: Record<Exclude<TipoConducaoManual, 'linha'>, ModalTransporteVT> = {
  onibus_municipal_niteroi: 'onibus',
  onibus_municipal_sao_goncalo: 'onibus',
  onibus_municipal_rio: 'onibus',
  onibus_municipal_gratuito: 'onibus',
  trem: 'trem',
  metro: 'metro',
  barca: 'barca',
  vlt: 'vlt',
  brt: 'brt',
  van: 'van',
}

const SISTEMA_DO_TIPO: Record<Exclude<TipoConducaoManual, 'linha'>, SistemaTarifarioVT> = {
  onibus_municipal_niteroi: 'riocard',
  onibus_municipal_sao_goncalo: 'riocard',
  onibus_municipal_rio: 'jae',
  onibus_municipal_gratuito: 'gratuito',
  trem: 'supervia',
  metro: 'metrorio',
  barca: 'aquaviario',
  vlt: 'desconhecido',
  brt: 'desconhecido',
  van: 'desconhecido',
}

const MUNICIPIO_DO_TIPO: Partial<Record<TipoConducaoManual, string>> = {
  onibus_municipal_niteroi: 'Niterói',
  onibus_municipal_sao_goncalo: 'São Gonçalo',
  onibus_municipal_rio: 'Rio de Janeiro',
  onibus_municipal_gratuito: 'Itaboraí',
}

/** Classificação tarifária (sistema/escopo/município) dos tipos de ônibus municipal — compartilhada com a correção da revisão de rota. */
export function classificacaoDoTipoMunicipal(
  tipo: 'onibus_municipal_niteroi' | 'onibus_municipal_sao_goncalo' | 'onibus_municipal_rio' | 'onibus_municipal_gratuito',
): { sistemaTarifario: SistemaTarifarioVT; escopo: 'municipal'; municipioOrigem: string; municipioDestino: string } {
  const municipio = MUNICIPIO_DO_TIPO[tipo] ?? 'desconhecida'
  return { sistemaTarifario: SISTEMA_DO_TIPO[tipo], escopo: 'municipal', municipioOrigem: municipio, municipioDestino: municipio }
}

/** Passo entre embarques presumidos (min): 3 conduções = 40 min, dentro da janela do BUN (1 h). */
export const PASSO_EMBARQUE_PRESUMIDO_MIN = 20

function embarquePresumido(dataServico: string, hora: string, indice: number): string | null {
  const base = Date.parse(`${dataServico}T${/^\d{2}:\d{2}$/.test(hora) ? hora : '06:00'}:00-03:00`)
  if (Number.isNaN(base)) return null
  return new Date(base + indice * PASSO_EMBARQUE_PRESUMIDO_MIN * 60_000).toISOString()
}

export interface EntradaRotaManual {
  conducoes: readonly ConducaoManual[]
  sentido: 'ida' | 'volta'
  /** Município de onde o sentido PARTE e para onde CHEGA (a volta já vem trocada). */
  municipioOrigem: string
  municipioDestino: string
  dataServico: string
  /** HH:MM usado só para presumir os horários de embarque. */
  horaReferencia: string
  consultadoEm: string
  motivo: string
  autorId: string
}

/**
 * Converte a lista digitada em alternativa no formato do Google (provedor 'manual').
 * Devolve null com a lista vazia. Distância, duração e horários reais ficam nulos; o horário de
 * embarque é PRESUMIDO (passo de 20 min) só para o motor aceitar a integração que o RH informou —
 * isso fica registrado na evidência (`rotaManual.horariosPresumidos`).
 */
export function construirAlternativaManual(e: EntradaRotaManual): AlternativaRotaGoogleVT | null {
  if (e.conducoes.length === 0) return null
  const avisos: string[] = [
    'Rota informada manualmente: os horários de embarque são presumidos (sem consulta ao Google).',
  ]
  const pernas: PernaItinerarioVT[] = e.conducoes.map((c, i) => {
    const sequencia = i + 1
    const base = {
      sequencia,
      variante: null,
      operadora: null,
      sentido: e.sentido,
      embarque: { local: 'Informado manualmente', dataHoraPrevista: embarquePresumido(e.dataServico, e.horaReferencia, i) },
      desembarque: { local: 'Informado manualmente', dataHoraPrevista: null },
      tarifaCentavos: null,
      tarifaVigenteDesde: null,
    }
    if (c.tipo !== 'linha') {
      const municipal = c.tipo.startsWith('onibus_municipal')
      const municipio = MUNICIPIO_DO_TIPO[c.tipo] ?? 'desconhecida'
      return {
        ...base,
        linha: null,
        modal: MODAL_DO_TIPO[c.tipo],
        categoriaServico: 'urbano_convencional',
        sistemaTarifario: SISTEMA_DO_TIPO[c.tipo],
        escopo: municipal ? 'municipal' : 'desconhecido',
        municipioOrigem: municipio,
        municipioDestino: municipio,
      }
    }
    const codigo = normalizarLinha(c.codigo)
    const cl = classificarCodigoLinha(codigo)
    if (cl.tipo === 'detro') {
      return {
        ...base,
        linha: codigo,
        modal: 'onibus',
        categoriaServico: 'urbano_convencional',
        sistemaTarifario: 'detro',
        escopo: 'intermunicipal',
        municipioOrigem: e.municipioOrigem,
        municipioDestino: e.municipioDestino,
        ...(c.secao ? { secaoDetro: c.secao.secao, secaoDetroRotulo: c.secao.rotulo } : {}),
      }
    }
    if (cl.tipo === 'municipal_niteroi') {
      return {
        ...base,
        linha: codigo,
        modal: 'onibus',
        categoriaServico: 'urbano_convencional',
        sistemaTarifario: 'riocard',
        escopo: 'municipal',
        municipioOrigem: 'Niterói',
        municipioDestino: 'Niterói',
      }
    }
    avisos.push(`Condução ${sequencia}: a linha ${codigo || '(sem código)'} não foi encontrada — sem tarifa conhecida, o valor fica indeterminado.`)
    return {
      ...base,
      linha: codigo || null,
      modal: 'onibus',
      categoriaServico: 'desconhecida',
      sistemaTarifario: 'desconhecido',
      escopo: 'desconhecido',
      municipioOrigem: 'desconhecida',
      municipioDestino: 'desconhecida',
    }
  })
  return {
    id: `manual-${e.sentido}`,
    numero: 1,
    distanciaMetros: null,
    duracaoSegundos: null,
    itinerario: {
      pernas,
      provedor: 'manual',
      consultadoEm: e.consultadoEm,
      precisao: 'manual',
      evidenciaHash: null,
      rotaManual: {
        motivo: e.motivo.trim(),
        autorId: e.autorId,
        informadaEm: e.consultadoEm,
        horariosPresumidos: true,
      },
    },
    avisos,
  }
}
