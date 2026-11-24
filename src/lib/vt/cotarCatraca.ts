import { removerAcentos } from '@/lib/utils'
import { tarifaLinhaDetro } from '@/lib/vt/tarifasOficiais'
import {
  REGRA_BUI,
  REGRA_BUI_NITEROI_INTEGRA,
  REGRA_BUN_ONIBUS,
  REGRA_DETRO_2026,
  REGRA_JAE,
  REGRA_METRORIO,
  REGRA_RIOCARD_TARIFAS,
  REGRA_VT_FEDERAL,
  REGRAS_OFICIAIS_VT,
} from '@/lib/vt/regrasOficiais'
import type {
  AlternativaCotacaoVT,
  CobrancaPernaVT,
  CotacaoCatraca,
  FatosCartaoVT,
  IntegracaoCotadaVT,
  ItinerarioVT,
  PendenciaCotacaoVT,
  PernaItinerarioVT,
  RegraOficialVT,
} from '@/lib/vt/contratosTarifarios'

interface AlternativaInterna {
  resumo: AlternativaCotacaoVT
  pernas: CobrancaPernaVT[]
  regraIds: string[]
  pendencias: PendenciaCotacaoVT[]
  integracao?: IntegracaoCotadaVT
}

const TARIFA_BUI = 940

function norm(texto: string): string {
  return removerAcentos(texto.trim()).toUpperCase()
}

function pendencia(codigo: string, mensagem: string, pernaSequencia: number | null = null): PendenciaCotacaoVT {
  return { codigo, mensagem, pernaSequencia }
}

function ehOnibus(perna: PernaItinerarioVT): boolean {
  return perna.modal === 'onibus' || perna.modal === 'micro_onibus'
}

function ehMunicipal(perna: PernaItinerarioVT, cidade: string): boolean {
  return perna.escopo === 'municipal' && norm(perna.municipioOrigem) === norm(cidade)
}

function ehNiteroiMunicipal(perna: PernaItinerarioVT): boolean {
  return ehOnibus(perna) && ehMunicipal(perna, 'Niterói')
}

function ehRioMunicipal(perna: PernaItinerarioVT): boolean {
  return perna.escopo === 'municipal' && norm(perna.municipioOrigem) === norm('Rio de Janeiro')
}

export function tarifaIntegralPerna(
  perna: PernaItinerarioVT,
  regras: readonly RegraOficialVT[] = REGRAS_OFICIAIS_VT,
): number | null {
  if (perna.tarifaCentavos != null) return perna.tarifaCentavos
  if (perna.modal === 'trem') return 760
  if (perna.modal === 'metro') return 790
  if (perna.modal === 'barca') return norm(perna.embarque.local).includes('CHARITAS') ? 770 : 500
  if (perna.escopo === 'intermunicipal') return tarifaLinhaDetro(perna.linha, regras)
  if (perna.escopo !== 'municipal') return null
  if (ehMunicipal(perna, 'Niterói') && ehOnibus(perna)) return 560
  if (ehMunicipal(perna, 'São Gonçalo') && ehOnibus(perna)) return 555
  if (ehRioMunicipal(perna) && ['onibus', 'micro_onibus', 'brt', 'vlt', 'van'].includes(perna.modal)) return 500
  return null
}

function cartoesTarifaIntegral(pernas: PernaItinerarioVT[]): AlternativaCotacaoVT['cartoesNecessarios'] {
  const cartoes = new Set<AlternativaCotacaoVT['cartoesNecessarios'][number]>()
  for (const perna of pernas) {
    if (ehRioMunicipal(perna)) cartoes.add('jae')
    else if (ehNiteroiMunicipal(perna)) cartoes.add('riocard_bun')
    else cartoes.add('comum')
  }
  return [...cartoes]
}

function alternativaIntegral(pernas: PernaItinerarioVT[], regras: readonly RegraOficialVT[]): AlternativaInterna {
  const cobrancas = pernas.map((perna) => {
    const tarifa = tarifaIntegralPerna(perna, regras)
    return {
      sequencia: perna.sequencia,
      tarifaIntegralCentavos: tarifa,
      cobradoEstimadoCentavos: tarifa,
      integracaoAplicadaId: null,
      motivo: tarifa == null ? 'Tarifa integral não identificada para esta linha/modal.' : 'Tarifa integral, sem integração.',
    }
  })
  const faltantes = cobrancas.filter((perna) => perna.cobradoEstimadoCentavos == null)
  const total = faltantes.length === 0
    ? cobrancas.reduce((soma, perna) => soma + (perna.cobradoEstimadoCentavos ?? 0), 0)
    : null
  return {
    resumo: {
      id: 'tarifa_integral',
      descricao: 'Tarifa integral sem integração',
      status: total == null ? 'indeterminado' : 'confirmavel',
      totalEstimadoCentavos: total,
      cartoesNecessarios: cartoesTarifaIntegral(pernas),
      motivo: total == null ? 'Há pernas sem tarifa conhecida.' : 'Todas as pernas têm tarifa integral identificada.',
    },
    pernas: cobrancas,
    regraIds: [REGRA_VT_FEDERAL, REGRA_RIOCARD_TARIFAS, REGRA_DETRO_2026, REGRA_JAE],
    pendencias: faltantes.map((perna) => pendencia(
      'TARIFA_DESCONHECIDA',
      'Informe a tarifa vigente da linha/modal antes de confirmar o valor.',
      perna.sequencia,
    )),
  }
}

function intervaloMinutos(pernas: PernaItinerarioVT[]): number | null {
  if (pernas.length !== 2) return null
  const inicio = Date.parse(pernas[0].embarque.dataHoraPrevista ?? '')
  const fim = Date.parse(pernas[1].embarque.dataHoraPrevista ?? '')
  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return null
  return Math.round((fim - inicio) / 60000)
}

function problemaSequencia(pernas: PernaItinerarioVT[]): PendenciaCotacaoVT | null {
  if (pernas.some((perna) => !perna.linha?.trim())) {
    return pendencia('LINHA_OBRIGATORIA', 'A integração exige linhas identificadas e diferentes.')
  }
  if (norm(pernas[0].linha ?? '') === norm(pernas[1].linha ?? '')) {
    return pendencia('MESMA_LINHA', 'Duas validações na mesma linha não caracterizam integração.')
  }
  if (pernas[0].sentido !== pernas[1].sentido) {
    return pendencia('SENTIDOS_DIFERENTES', 'A integração exige serviços no mesmo sentido da viagem.')
  }
  if (pernas.some((perna) => perna.categoriaServico !== 'urbano_convencional')) {
    return pendencia('SERVICO_NAO_CONVENCIONAL', 'A integração só vale para serviços urbanos convencionais.')
  }
  return null
}

function avaliarBun(pernas: PernaItinerarioVT[], cartao: FatosCartaoVT, regras: readonly RegraOficialVT[]): AlternativaInterna | null {
  if (pernas.length !== 2 || !pernas.every(ehNiteroiMunicipal)) return null
  const regraId = REGRA_BUN_ONIBUS
  if (cartao.bun === 'nao_possui' || cartao.vinculadoCpf === false || ['empresa', 'ao_portador'].includes(cartao.personalizacao)) {
    return null
  }
  const pendencias: PendenciaCotacaoVT[] = []
  const sequencia = problemaSequencia(pernas)
  if (sequencia) pendencias.push(sequencia)
  const intervalo = intervaloMinutos(pernas)
  if (intervalo == null) {
    pendencias.push(pendencia('HORARIOS_OBRIGATORIOS', 'Informe os horários previstos das duas validações para verificar a janela de 1 hora.'))
  } else if (intervalo < 0 || intervalo > 60) {
    pendencias.push(pendencia('JANELA_BUN_EXCEDIDA', `As validações estão a ${intervalo} minutos; o BUN permite até 60.`))
  }
  if (cartao.bun === 'nao_consultado' || cartao.vinculadoCpf == null || cartao.personalizacao === 'desconhecida') {
    pendencias.push(pendencia('BUN_NAO_CONFIRMADO', 'Confirme o BUN ativo e o vínculo do cartão ao CPF.'))
  }
  const primeira = tarifaIntegralPerna(pernas[0], regras)
  const segunda = tarifaIntegralPerna(pernas[1], regras)
  if (primeira == null || segunda == null) {
    pendencias.push(pendencia('TARIFA_DESCONHECIDA', 'A integração BUN exige a tarifa integral das duas pernas.'))
  }
  const total = primeira == null || segunda == null ? null : primeira
  const status = pendencias.length > 0 ? 'parcial' : 'confirmavel'
  return {
    resumo: {
      id: 'bun',
      descricao: 'BUN — duas linhas municipais de Niterói em até 1 hora',
      status: total == null ? 'indeterminado' : status,
      totalEstimadoCentavos: total,
      cartoesNecessarios: ['riocard_bun'],
      motivo: pendencias.length === 0 ? 'Integração BUN válida; a segunda condução não cobra.' : 'A integração BUN não pode ser confirmada com os dados atuais.',
    },
    pernas: pernas.map((perna, indice) => ({
      sequencia: perna.sequencia,
      tarifaIntegralCentavos: tarifaIntegralPerna(perna, regras),
      cobradoEstimadoCentavos: indice === 0 ? primeira : 0,
      integracaoAplicadaId: regraId,
      motivo: indice === 0 ? 'Primeira condução pela tarifa integral do VT.' : 'Segunda condução coberta pela integração BUN.',
    })),
    regraIds: [regraId],
    pendencias,
    integracao: { regraId, pernas: pernas.map((perna) => perna.sequencia), aceita: false, motivo: 'Integração BUN avaliada.' },
  }
}

function pendenciaElegibilidadeBui(cartao: FatosCartaoVT): PendenciaCotacaoVT | null {
  if (cartao.bui === 'nao_consultado') return pendencia('BUI_NAO_CONSULTADO', 'Consulte a situação atual do BUI antes de confirmar a integração.')
  if (cartao.personalizacao === 'desconhecida') return pendencia('CARTAO_DESCONHECIDO', 'Confirme se o cartão é Personalizado Usuário.')
  if (cartao.vinculadoCpf == null) return pendencia('CPF_NAO_CONFIRMADO', 'Confirme o vínculo do cartão ao CPF.')
  return null
}

function podeAvaliarBui(cartao: FatosCartaoVT): boolean {
  return !['suspenso', 'nao_possui'].includes(cartao.bui)
    && cartao.personalizacao !== 'empresa'
    && cartao.personalizacao !== 'ao_portador'
    && cartao.vinculadoCpf !== false
}

function avaliarBuiDireto(pernas: PernaItinerarioVT[], cartao: FatosCartaoVT, regras: readonly RegraOficialVT[]): AlternativaInterna | null {
  if (pernas.length !== 1 || pernas[0].escopo !== 'intermunicipal' || !ehOnibus(pernas[0]) || !podeAvaliarBui(cartao)) return null
  const perna = pernas[0]
  const tarifa = tarifaIntegralPerna(perna, regras)
  if (tarifa == null || tarifa <= TARIFA_BUI) return null
  const pendencias: PendenciaCotacaoVT[] = []
  const elegibilidade = pendenciaElegibilidadeBui(cartao)
  if (elegibilidade) pendencias.push(elegibilidade)
  if (!perna.linha?.trim()) pendencias.push(pendencia('LINHA_OBRIGATORIA', 'Identifique a linha intermunicipal antes de aplicar o BUI direto.'))
  return {
    resumo: {
      id: 'bui_direto',
      descricao: 'BUI em linha intermunicipal direta acima de R$ 9,40',
      status: pendencias.length > 0 ? 'parcial' : 'confirmavel',
      totalEstimadoCentavos: TARIFA_BUI,
      cartoesNecessarios: ['riocard_bui'],
      motivo: 'Na catraca, o BUI pode reduzir a linha direta para R$ 9,40; a escolha do pacote patronal exige análise separada.',
    },
    pernas: [{
      sequencia: perna.sequencia,
      tarifaIntegralCentavos: tarifa,
      cobradoEstimadoCentavos: TARIFA_BUI,
      integracaoAplicadaId: REGRA_BUI,
      motivo: 'Tarifa direta com BUI ativo e elegível.',
    }],
    regraIds: [REGRA_BUI],
    pendencias,
    integracao: { regraId: REGRA_BUI, pernas: [perna.sequencia], aceita: false, motivo: 'BUI direto avaliado na catraca.' },
  }
}

function avaliarBuiIntegracao(pernas: PernaItinerarioVT[], cartao: FatosCartaoVT, regras: readonly RegraOficialVT[]): AlternativaInterna | null {
  if (pernas.length !== 2 || !pernas.some((perna) => perna.escopo === 'intermunicipal') || !podeAvaliarBui(cartao)) return null
  // Intermunicipal + municipal de Niterói integra pelo BUI (extratos Riocard, 24/11/2026).
  // Niterói com os demais modais (barca, SG, Rio) não tem evidência: fica fora do BUI.
  if (pernas.some(ehNiteroiMunicipal) && !pernas.some((perna) => perna.escopo === 'intermunicipal' && ehOnibus(perna))) return null
  if (pernas.some((perna) => perna.modal === 'metro') && pernas.some((perna) => ['brt', 'van'].includes(perna.modal))) return null
  if (pernas.some((perna) => perna.modal === 'van' && perna.escopo === 'municipal')) return null

  const pendencias: PendenciaCotacaoVT[] = []
  const sequencia = problemaSequencia(pernas)
  if (sequencia) pendencias.push(sequencia)
  const temMetro = pernas.some((perna) => perna.modal === 'metro')
  const limite = temMetro ? 120 : 180
  const intervalo = intervaloMinutos(pernas)
  if (intervalo == null) {
    pendencias.push(pendencia('HORARIOS_OBRIGATORIOS', `Informe os horários das validações para verificar a janela de ${limite} minutos.`))
  } else if (intervalo < 0 || intervalo > limite) {
    pendencias.push(pendencia('JANELA_BUI_EXCEDIDA', `As validações estão a ${intervalo} minutos; esta integração permite até ${limite}.`))
  }
  const elegibilidade = pendenciaElegibilidadeBui(cartao)
  if (elegibilidade) pendencias.push(elegibilidade)

  const primeira = tarifaIntegralPerna(pernas[0], regras)
  const segunda = tarifaIntegralPerna(pernas[1], regras)
  if (primeira == null || segunda == null) {
    pendencias.push(pendencia('TARIFA_DESCONHECIDA', 'A integração BUI exige a tarifa integral e a ordem das duas pernas.'))
  }
  if (primeira != null && segunda != null && primeira + segunda <= TARIFA_BUI) return null
  if (primeira != null && primeira > TARIFA_BUI) {
    pendencias.push(pendencia('BUI_PRIMEIRA_TARIFA_ACIMA_TETO', 'A primeira tarifa já supera R$ 9,40; a mecânica do excedente precisa de confirmação da operadora.'))
  }
  const total = primeira == null || segunda == null ? null : Math.max(primeira, TARIFA_BUI)
  const status = pendencias.length > 0 ? 'parcial' : 'confirmavel'
  return {
    resumo: {
      id: 'bui',
      descricao: temMetro ? 'BUI — dois serviços, janela específica do MetrôRio de 120 minutos' : 'BUI — dois serviços em até 3 horas',
      status: total == null ? 'indeterminado' : status,
      totalEstimadoCentavos: total,
      cartoesNecessarios: ['riocard_bui'],
      motivo: pendencias.length === 0 ? 'Integração BUI válida para os dois serviços.' : 'A integração BUI não pode ser confirmada com os dados atuais.',
    },
    pernas: pernas.map((perna, indice) => {
      const integral = indice === 0 ? primeira : segunda
      const cobrado = total == null ? null : indice === 0 ? integral : Math.max(0, total - (primeira ?? 0))
      return {
        sequencia: perna.sequencia,
        tarifaIntegralCentavos: integral,
        cobradoEstimadoCentavos: cobrado,
        integracaoAplicadaId: REGRA_BUI,
        motivo: indice === 0 ? 'Primeira tarifa na ordem da integração.' : 'Segunda tarifa limitada à diferença da integração BUI.',
      }
    }),
    regraIds: [REGRA_BUI, ...(pernas.some(ehNiteroiMunicipal) ? [REGRA_BUI_NITEROI_INTEGRA] : []), ...(temMetro ? [REGRA_METRORIO] : [])],
    pendencias,
    integracao: { regraId: REGRA_BUI, pernas: pernas.map((perna) => perna.sequencia), aceita: false, motivo: 'Integração BUI avaliada.' },
  }
}

function resumo(alternativa: AlternativaInterna): AlternativaCotacaoVT {
  return alternativa.resumo
}

export function cotarCatraca(
  itinerario: ItinerarioVT,
  cartao: FatosCartaoVT,
  regras: readonly RegraOficialVT[],
  dataServico: string,
): CotacaoCatraca {
  const vigentes = regras.filter((regra) => regra.vigenteDesde <= dataServico && (!regra.vigenteAte || regra.vigenteAte >= dataServico))
  const ids = new Set(vigentes.map((regra) => regra.id))
  const pernas = [...itinerario.pernas].sort((a, b) => a.sequencia - b.sequencia)
  const integral = alternativaIntegral(pernas, vigentes)
  const alternativas: AlternativaInterna[] = [integral]
  const integracoes: IntegracaoCotadaVT[] = []
  const pendencias: PendenciaCotacaoVT[] = []

  if (pernas.length === 0) {
    return {
      status: 'indeterminado',
      alternativaEscolhidaId: null,
      alternativas: [],
      totalEstimadoCentavos: null,
      pernas: [],
      integracoes: [],
      regraIds: [],
      pendencias: [pendencia('ROTA_VAZIA', 'A rota não contém pernas de transporte público.')],
    }
  }
  if (vigentes.length === 0) {
    return {
      status: 'indeterminado',
      alternativaEscolhidaId: integral.resumo.id,
      alternativas: [integral.resumo],
      totalEstimadoCentavos: null,
      pernas: integral.pernas,
      integracoes: [],
      regraIds: [],
      pendencias: [pendencia('REGRAS_NAO_CARREGADAS', `Não há regras oficiais vigentes em ${dataServico}.`)],
    }
  }

  if (pernas.length > 2) {
    pendencias.push(pendencia('SEQUENCIA_COM_MAIS_DE_DUAS_PERNAS', 'Sequências com três ou mais pernas exigem avaliação separada dos excedentes e das combinações de benefícios.'))
    integracoes.push({ regraId: REGRA_BUI, pernas: pernas.map((perna) => perna.sequencia), aceita: false, motivo: 'A mesma integração não cobre mais de dois serviços.' })
  } else {
    if (ids.has(REGRA_BUN_ONIBUS)) {
      const bun = avaliarBun(pernas, cartao, vigentes)
      if (bun) {
        alternativas.push(bun)
        if (bun.integracao) integracoes.push(bun.integracao)
      }
    }
    if (ids.has(REGRA_BUI)) {
      const bui = pernas.length === 1 ? avaliarBuiDireto(pernas, cartao, vigentes) : avaliarBuiIntegracao(pernas, cartao, vigentes)
      if (bui) {
        alternativas.push(bui)
        if (bui.integracao) integracoes.push(bui.integracao)
      }
    }
    if (pernas.some(ehNiteroiMunicipal) && pernas.some((perna) => !ehNiteroiMunicipal(perna) && !(perna.escopo === 'intermunicipal' && ehOnibus(perna)))) {
      integracoes.push({
        regraId: REGRA_BUI_NITEROI_INTEGRA,
        pernas: pernas.map((perna) => perna.sequencia),
        aceita: false,
        motivo: 'Sem evidência de integração do ônibus municipal de Niterói com este modal; só entre dois ônibus de Niterói (BUN) ou com intermunicipal (BUI).',
      })
    }
  }

  const comPreco = alternativas.filter((alternativa) => alternativa.resumo.totalEstimadoCentavos != null)
  const confirmaveis = comPreco.filter((alternativa) => alternativa.resumo.status === 'confirmavel')
  const parciais = comPreco.filter((alternativa) => alternativa.resumo.status === 'parcial')
  const escolhida = confirmaveis.length > 0
    ? confirmaveis.reduce((menor, atual) => (atual.resumo.totalEstimadoCentavos! < menor.resumo.totalEstimadoCentavos! ? atual : menor))
    : parciais.length > 0
      ? parciais.reduce((menor, atual) => (atual.resumo.totalEstimadoCentavos! < menor.resumo.totalEstimadoCentavos! ? atual : menor))
      : integral

  let status = escolhida.resumo.status
  const todasPendencias = [...pendencias, ...escolhida.pendencias]
  if (pernas.length > 2) status = 'parcial'
  if (pernas.some((perna) => perna.modal === 'metro') && pernas.some((perna) => ['brt', 'van'].includes(perna.modal))) {
    status = 'parcial'
    todasPendencias.push(pendencia(
      'METRO_BRT_VAN_REGRA_ESPECIFICA',
      'Metrô+BRT/van integra somente com Jaé e depende de linhas/estações elegíveis; não aplicar BUI nem tarifa genérica.',
    ))
  }
  if (status === 'confirmavel') {
    const alternativaIncompletaMaisBarata = parciais.find((alternativa) =>
      alternativa !== escolhida && alternativa.resumo.totalEstimadoCentavos! < escolhida.resumo.totalEstimadoCentavos!,
    )
    if (alternativaIncompletaMaisBarata) {
      status = 'parcial'
      todasPendencias.push(...alternativaIncompletaMaisBarata.pendencias)
    }
  }

  const escolhidaId = escolhida.resumo.id
  for (const integracao of integracoes) {
    const alternativaIntegracao = alternativas.find((alternativa) => alternativa.integracao === integracao)
    integracao.aceita = alternativaIntegracao === escolhida && status === 'confirmavel'
  }

  const pendenciasUnicas = [...new Map(todasPendencias.map((item) => [`${item.codigo}:${item.pernaSequencia}`, item])).values()]
  return {
    status: escolhida.resumo.totalEstimadoCentavos == null ? 'indeterminado' : status,
    alternativaEscolhidaId: escolhidaId,
    alternativas: alternativas.map(resumo),
    totalEstimadoCentavos: escolhida.resumo.totalEstimadoCentavos,
    pernas: escolhida.pernas,
    integracoes,
    regraIds: [...new Set([REGRA_VT_FEDERAL, ...escolhida.regraIds])],
    pendencias: pendenciasUnicas,
  }
}
