import { buscarTarifaDetro, buscarTarifaModal, normalizarLinha, reais } from '@/lib/vt/motor/tarifas'
import type { PassoExplicacao, PendenciaMotor, PernaMotor } from '@/lib/vt/motor/tipos'

export interface PernaPrecificada {
  perna: PernaMotor
  rotulo: string
  /** Tarifa integral da perna, ou null quando indeterminada. */
  valorCentavos: number | null
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
  outro: 'outro modal',
}

export function rotuloPerna(perna: PernaMotor, indice: number): string {
  const linha = normalizarLinha(perna.linha)
  return `Perna ${indice + 1} (${NOMES_MODAL[perna.modal]}${linha ? ` ${linha}` : ''})`
}

/** Tarifa integral de uma perna (Regras §2, §3, §6, §7). */
export function precificarPerna(
  perna: PernaMotor,
  indice: number,
  dataServico: string,
): PernaPrecificada {
  const rotulo = rotuloPerna(perna, indice)
  const base = { perna, rotulo, pendenciasSeCobrada: [] as PendenciaMotor[] }

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
            mensagem: `Tarifa da linha ${linha} marcada para conferir na extração da Portaria DETRO (${r.registros[0].motivoConferir ?? 'registro duvidoso'}).`,
            regra: 'Regras §6, §11',
          },
        ]
      : []
    return {
      ...base,
      valorCentavos: r.valorCentavos,
      pendenciasIndeterminado: [],
      pendenciasSeCobrada,
      passo: {
        regra: 'Regras §6, §11',
        texto: `${rotulo}: tarifa integral ${reais(r.valorCentavos)} pela Portaria DETRO/PRES 1.960/2026 (linha ${linha}${perna.secao !== null && perna.secao !== undefined && perna.secao !== '' ? `, seção ${perna.secao}` : ''}).`,
      },
    }
  }

  const busca = buscarTarifaModal(perna.modal, dataServico)
  if (busca.tipo === 'sem_tarifa') {
    const ehBarca = perna.modal === 'barca'
    const pendencia: PendenciaMotor = {
      codigo: ehBarca ? 'BARCA_TARIFA_PROPRIA' : 'MODAL_SEM_TARIFA',
      mensagem: ehBarca
        ? 'Tarifa da barca a conferir: barcas têm tarifas e integrações próprias (inclusive com BUN) que não são automatizadas.'
        : `Sem tarifa cadastrada para ${NOMES_MODAL[perna.modal]}: a conferir.`,
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
      mensagem: `Tarifa de ${busca.tarifa.descricao} só está cadastrada a partir de ${busca.tarifa.vigenteDesde}; serviço em ${dataServico} sem tarifa vigente cadastrada.`,
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
  const pendenciasSeCobrada: PendenciaMotor[] = t.aConferir
    ? [
        {
          codigo: 'TARIFA_A_CONFERIR',
          mensagem: `Tarifa a conferir: ${t.descricao} ${reais(t.valorCentavos)} (${t.fonte}) ainda não confirmada pela gestora.`,
          regra: t.regra,
        },
      ]
    : []
  return {
    ...base,
    valorCentavos: t.valorCentavos,
    pendenciasIndeterminado: [],
    pendenciasSeCobrada,
    passo: {
      regra: t.regra,
      texto: `${rotulo}: tarifa integral ${reais(t.valorCentavos)} (${t.fonte}; vigente desde ${t.vigenteDesde})${t.aConferir ? ' — a conferir' : ''}.`,
    },
  }
}
