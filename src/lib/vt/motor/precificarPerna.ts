import {
  buscarTarifaDetro,
  buscarTarifaModal,
  normalizarLinha,
  reais,
  TARIFA_NITEROI_BUN,
  vigenteNaData,
} from '@/lib/vt/motor/tarifas'
import type { PassoExplicacao, PendenciaMotor, PernaMotor, PoliticaIntegracao } from '@/lib/vt/motor/tipos'

export interface PernaPrecificada {
  perna: PernaMotor
  rotulo: string
  /**
   * Valor da perna, ou null quando indeterminada. Ônibus municipal de Niterói com a
   * política 'presumida' vale o BUN (R$ 4,45); nos demais casos, a tarifa integral.
   */
  valorCentavos: number | null
  /** Tarifa cheia da perna (Niterói: R$ 5,60, usada além do limite diário do BUN). */
  valorCheiaCentavos: number | null
  /** true quando valorCentavos é o valor do BUN (sujeito ao limite de viagens por dia). */
  comValorBun: boolean
  /** Pendências que impedem o valor (valorCentavos = null). */
  pendenciasIndeterminado: PendenciaMotor[]
  /** Pendências que só valem se a tarifa integral da perna for efetivamente cobrada. */
  pendenciasSeCobrada: PendenciaMotor[]
  passo: PassoExplicacao
}

const NOMES_MODAL: Record<PernaMotor['modal'], string> = {
  onibus_municipal_niteroi: 'ônibus municipal de Niterói',
  onibus_municipal_sao_goncalo: 'ônibus municipal de São Gonçalo',
  onibus_municipal_rio: 'ônibus municipal do Rio',
  onibus_intermunicipal: 'ônibus intermunicipal',
  trem: 'trem',
  metro: 'metrô',
  barca: 'barca',
  vlt: 'VLT',
  brt: 'BRT',
  van: 'van',
  outro: 'outro transporte',
}

const ONIBUS: ReadonlyArray<PernaMotor['modal']> = [
  'onibus_municipal_niteroi',
  'onibus_municipal_sao_goncalo',
  'onibus_municipal_rio',
  'onibus_intermunicipal',
]

const ESCOPO_ONIBUS: Partial<Record<PernaMotor['modal'], string>> = {
  onibus_municipal_niteroi: 'municipal de Niterói',
  onibus_municipal_sao_goncalo: 'municipal de São Gonçalo',
  onibus_municipal_rio: 'municipal do Rio',
  onibus_intermunicipal: 'intermunicipal',
}

/** Nome da condução em linguagem simples: "Ônibus 404M (intermunicipal)", "Trem". */
export function rotuloPerna(perna: PernaMotor): string {
  const linha = normalizarLinha(perna.linha)
  if (ONIBUS.includes(perna.modal)) {
    const escopo = ESCOPO_ONIBUS[perna.modal]
    return linha ? `Ônibus ${linha} (${escopo})` : `Ônibus ${escopo}`
  }
  const nome = NOMES_MODAL[perna.modal]
  const base = nome.charAt(0).toUpperCase() + nome.slice(1)
  return linha ? `${base} ${linha}` : base
}

/** Tarifa integral de uma perna. */
export function precificarPerna(
  perna: PernaMotor,
  dataServico: string,
  politica: PoliticaIntegracao = 'presumida',
): PernaPrecificada {
  const rotulo = rotuloPerna(perna)
  const base = {
    perna,
    rotulo,
    pendenciasSeCobrada: [] as PendenciaMotor[],
    comValorBun: false,
    valorCheiaCentavos: null as number | null,
  }

  if (perna.modal === 'onibus_intermunicipal') {
    const r = buscarTarifaDetro(perna.linha, perna.secao, dataServico)
    if (r.tipo === 'indeterminado') {
      return {
        ...base,
        valorCentavos: null,
        pendenciasIndeterminado: [r.pendencia],
        passo: { regra: r.pendencia.regra, texto: `${rotulo}: ${r.pendencia.mensagem}` },
      }
    }
    const linha = normalizarLinha(perna.linha)
    const pendenciasSeCobrada: PendenciaMotor[] = r.precisaConferir
      ? [
          {
            codigo: 'DETRO_REGISTRO_A_CONFERIR',
            mensagem: `O valor da linha ${linha} está a conferir: o registro da tabela oficial do DETRO ficou duvidoso (${r.registros[0].motivoConferir ?? 'sem detalhe'}).`,
            regra: 'Regras §6, §11',
          },
        ]
      : []
    return {
      ...base,
      valorCentavos: r.valorCentavos,
      valorCheiaCentavos: r.valorCentavos,
      pendenciasIndeterminado: [],
      pendenciasSeCobrada,
      passo: {
        regra: 'Regras §6, §11',
        texto: `${rotulo}: ${reais(r.valorCentavos)}, valor oficial do DETRO para esta linha${perna.secao !== null && perna.secao !== undefined && perna.secao !== '' ? ` (seção ${perna.secao})` : ''}.`,
      },
    }
  }

  const busca = buscarTarifaModal(perna.modal, dataServico)
  if (busca.tipo === 'sem_tarifa') {
    const ehBarca = perna.modal === 'barca'
    const pendencia: PendenciaMotor = {
      codigo: ehBarca ? 'BARCA_TARIFA_PROPRIA' : 'MODAL_SEM_TARIFA',
      mensagem: ehBarca
        ? 'O valor da barca está a conferir: a barca tem tarifa e integrações próprias, que o sistema ainda não calcula.'
        : `Ainda não temos o valor de ${NOMES_MODAL[perna.modal]} cadastrado: a conferir.`,
      regra: ehBarca ? 'Regras §3, §5' : 'Regras §8',
    }
    return {
      ...base,
      valorCentavos: null,
      pendenciasIndeterminado: [pendencia],
      passo: { regra: pendencia.regra, texto: `${rotulo}: ${pendencia.mensagem}` },
    }
  }
  if (busca.tipo === 'fora_da_vigencia') {
    const pendencia: PendenciaMotor = {
      codigo: 'MODAL_FORA_DA_VIGENCIA',
      mensagem: `O valor de ${busca.tarifa.descricao} só está cadastrado a partir de ${busca.tarifa.vigenteDesde}, então não há valor para ${dataServico}.`,
      regra: busca.tarifa.regra,
    }
    return {
      ...base,
      valorCentavos: null,
      pendenciasIndeterminado: [pendencia],
      passo: { regra: pendencia.regra, texto: `${rotulo}: ${pendencia.mensagem}` },
    }
  }

  const t = busca.tarifa
  if (
    perna.modal === 'onibus_municipal_niteroi' &&
    politica === 'presumida' &&
    vigenteNaData(TARIFA_NITEROI_BUN.vigenteDesde, TARIFA_NITEROI_BUN.vigenteAte, dataServico)
  ) {
    return {
      ...base,
      valorCentavos: TARIFA_NITEROI_BUN.valorCentavos,
      valorCheiaCentavos: t.valorCentavos,
      comValorBun: true,
      pendenciasIndeterminado: [],
      passo: {
        regra: TARIFA_NITEROI_BUN.regra,
        texto: `${rotulo}: ${reais(TARIFA_NITEROI_BUN.valorCentavos)} com o Bilhete Único de Niterói.`,
      },
    }
  }
  const pendenciasSeCobrada: PendenciaMotor[] = t.aConferir
    ? [
        {
          codigo: 'TARIFA_A_CONFERIR',
          mensagem: `Valor a conferir: ${t.descricao} está em ${reais(t.valorCentavos)}, mas ainda não foi confirmado pela gestora.`,
          regra: t.regra,
        },
      ]
    : []
  return {
    ...base,
    valorCentavos: t.valorCentavos,
    valorCheiaCentavos: t.valorCentavos,
    pendenciasIndeterminado: [],
    pendenciasSeCobrada,
    passo: {
      regra: t.regra,
      texto: `${rotulo}: ${reais(t.valorCentavos)}${t.aConferir ? ' (valor a conferir)' : ''}.`,
    },
  }
}
