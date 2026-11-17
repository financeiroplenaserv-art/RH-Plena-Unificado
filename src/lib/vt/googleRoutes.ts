import type {
  ItinerarioVT,
  ModalTransporteVT,
  PernaItinerarioVT,
  SistemaTarifarioVT,
} from '@/lib/vt/contratosTarifarios'

export interface TransitStepGoogle {
  travelMode?: string
  transitDetails?: {
    stopDetails?: {
      departureStop?: { name?: string }
      arrivalStop?: { name?: string }
      departureTime?: string
      arrivalTime?: string
    }
    transitLine?: {
      name?: string
      nameShort?: string
      vehicle?: { type?: string }
      agencies?: { name?: string }[]
    }
  }
}

export interface RotaGoogle {
  distanceMeters?: number
  duration?: string
  legs?: { steps?: TransitStepGoogle[] }[]
}

export interface RespostaGoogleRoutes {
  routes?: RotaGoogle[]
}

export interface AlternativaRotaGoogleVT {
  id: string
  numero: number
  distanciaMetros: number | null
  duracaoSegundos: number | null
  itinerario: ItinerarioVT
  avisos: string[]
}

interface ContextoRotaGoogle {
  consultadoEm: string
  precisao: ItinerarioVT['precisao']
  sentido: PernaItinerarioVT['sentido']
  municipioOrigem: string
  municipioDestino: string
}

function modalDoVeiculo(tipo: string | undefined): { modal: ModalTransporteVT; conhecido: boolean } {
  switch (tipo) {
    case 'BUS': return { modal: 'onibus', conhecido: true }
    case 'MINIBUS': return { modal: 'micro_onibus', conhecido: true }
    case 'SUBWAY': return { modal: 'metro', conhecido: true }
    case 'TRAIN':
    case 'HEAVY_RAIL':
    case 'COMMUTER_TRAIN':
      return { modal: 'trem', conhecido: true }
    case 'TRAM':
    case 'LIGHT_RAIL':
      return { modal: 'vlt', conhecido: true }
    case 'FERRY': return { modal: 'barca', conhecido: true }
    case 'VAN':
    case 'SHARE_TAXI':
      return { modal: 'van', conhecido: true }
    default: return { modal: 'onibus', conhecido: false }
  }
}

function duracaoSegundos(duracao: string | undefined): number | null {
  if (!duracao) return null
  const segundos = Number(duracao.replace(/s$/, ''))
  return Number.isFinite(segundos) ? segundos : null
}

function classificacaoTarifaria(agencia: string | undefined, contexto: ContextoRotaGoogle): {
  escopo: PernaItinerarioVT['escopo']
  sistemaTarifario: SistemaTarifarioVT
  municipioOrigem: string
  municipioDestino: string
  conhecida: boolean
} {
  const texto = (agencia ?? '').toLowerCase()
  const desconhecida = {
    escopo: 'desconhecido' as const,
    sistemaTarifario: 'desconhecido' as const,
    municipioOrigem: 'desconhecida',
    municipioDestino: 'desconhecida',
    conhecida: false,
  }
  if (!texto) return desconhecida
  if (/semove - s[aã]o gon/.test(texto)) {
    return {
      escopo: 'municipal',
      sistemaTarifario: 'riocard',
      municipioOrigem: 'São Gonçalo',
      municipioDestino: 'São Gonçalo',
      conhecida: true,
    }
  }
  if (/semove - intermunicipal|rio ita|auto litoral|litoral rio|1001|nossa senhora|santo antonio|inbornsa|intermunicipal/.test(texto)) {
    return {
      escopo: 'intermunicipal',
      sistemaTarifario: 'detro',
      municipioOrigem: contexto.municipioOrigem,
      municipioDestino: contexto.municipioDestino,
      conhecida: true,
    }
  }
  if (/prefeitura de niter/.test(texto)) {
    return {
      escopo: 'municipal',
      sistemaTarifario: 'riocard',
      municipioOrigem: 'Niterói',
      municipioDestino: 'Niterói',
      conhecida: true,
    }
  }
  if (/prefeitura (do|de) rio|riocard|ja[eé]/.test(texto)) {
    return {
      escopo: 'municipal',
      sistemaTarifario: 'jae',
      municipioOrigem: 'Rio de Janeiro',
      municipioDestino: 'Rio de Janeiro',
      conhecida: true,
    }
  }
  return desconhecida
}

function pernaDoPasso(
  passo: TransitStepGoogle,
  sequencia: number,
  contexto: ContextoRotaGoogle,
  avisos: string[],
): PernaItinerarioVT {
  const detalhe = passo.transitDetails
  const linha = detalhe?.transitLine
  const agencia = linha?.agencies?.[0]?.name
  const tarifaria = classificacaoTarifaria(agencia, contexto)
  const veiculo = modalDoVeiculo(linha?.vehicle?.type)

  if (!linha?.nameShort && !linha?.name) avisos.push(`Condução ${sequencia}: linha não identificada pelo Google.`)
  if (!tarifaria.conhecida) {
    avisos.push(`Condução ${sequencia}: operadora sem classificação tarifária (${agencia ?? 'não informada'}).`)
  }
  if (!veiculo.conhecido) avisos.push(`Condução ${sequencia}: veículo não reconhecido (${linha?.vehicle?.type ?? 'não informado'}).`)
  if (!detalhe?.stopDetails?.departureTime || !detalhe.stopDetails.arrivalTime) {
    avisos.push(`Condução ${sequencia}: horário de embarque ou desembarque ausente.`)
  }

  return {
    sequencia,
    linha: linha?.nameShort ?? linha?.name ?? null,
    variante: null,
    operadora: agencia ?? null,
    modal: veiculo.modal,
    categoriaServico: veiculo.conhecido ? 'urbano_convencional' : 'desconhecida',
    sistemaTarifario: tarifaria.sistemaTarifario,
    escopo: tarifaria.escopo,
    municipioOrigem: tarifaria.municipioOrigem,
    municipioDestino: tarifaria.municipioDestino,
    sentido: contexto.sentido,
    embarque: {
      local: detalhe?.stopDetails?.departureStop?.name ?? 'Não informado',
      dataHoraPrevista: detalhe?.stopDetails?.departureTime ?? null,
    },
    desembarque: {
      local: detalhe?.stopDetails?.arrivalStop?.name ?? 'Não informado',
      dataHoraPrevista: detalhe?.stopDetails?.arrivalTime ?? null,
    },
    tarifaCentavos: null,
    tarifaVigenteDesde: null,
  }
}

export function adaptarRotasGoogle(
  resposta: RespostaGoogleRoutes,
  contexto: ContextoRotaGoogle,
): AlternativaRotaGoogleVT[] {
  return (resposta.routes ?? []).map((rota, indice) => {
    const avisos: string[] = []
    const pernas = (rota.legs?.[0]?.steps ?? [])
      .filter((passo) => passo.travelMode === 'TRANSIT')
      .map((passo, sequencia) => pernaDoPasso(passo, sequencia + 1, contexto, avisos))
    if (pernas.length === 0) avisos.push('A alternativa não contém transporte público identificado.')

    return {
      id: `google-${indice + 1}`,
      numero: indice + 1,
      distanciaMetros: typeof rota.distanceMeters === 'number' ? rota.distanceMeters : null,
      duracaoSegundos: duracaoSegundos(rota.duration),
      itinerario: {
        pernas,
        provedor: 'google_routes',
        consultadoEm: contexto.consultadoEm,
        precisao: contexto.precisao,
        evidenciaHash: null,
      },
      avisos,
    }
  })
}

export function removerPernaAlternativa(
  alternativa: AlternativaRotaGoogleVT,
  sequencia: number,
): AlternativaRotaGoogleVT {
  const removida = alternativa.itinerario.pernas.find((perna) => perna.sequencia === sequencia)
  if (!removida) throw new Error('A condução escolhida não existe nesta alternativa.')
  if (alternativa.itinerario.pernas.length === 1) {
    throw new Error('Não é possível tirar a única condução do itinerário.')
  }

  const pernas = alternativa.itinerario.pernas
    .filter((perna) => perna.sequencia !== sequencia)
    .map((perna, indice) => ({ ...perna, sequencia: indice + 1 }))
  return {
    ...alternativa,
    distanciaMetros: null,
    duracaoSegundos: null,
    itinerario: {
      ...alternativa.itinerario,
      pernas,
      ajustesManuais: [
        ...(alternativa.itinerario.ajustesManuais ?? []),
        { tipo: 'remocao_perna', perna: { ...removida } },
      ],
    },
    avisos: [
      ...alternativa.avisos,
      `Condução ${removida.linha ?? sequencia} retirada manualmente. Revise a caminhada e os horários; distância e duração totais ficaram indeterminadas.`,
    ],
  }
}
