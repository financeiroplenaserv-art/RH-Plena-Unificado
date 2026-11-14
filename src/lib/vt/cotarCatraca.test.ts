import { describe, expect, it } from 'vitest'
import { cotarCatraca } from '@/lib/vt/cotarCatraca'
import { REGRAS_OFICIAIS_VT } from '@/lib/vt/regrasOficiais'
import type { FatosCartaoVT, ItinerarioVT, PernaItinerarioVT } from '@/lib/vt/contratosTarifarios'

const CARTAO_BUI: FatosCartaoVT = {
  personalizacao: 'usuario',
  vinculadoCpf: true,
  bui: 'ativo',
  bun: 'ativo',
  jae: 'disponivel',
  situacaoConsultadaEm: '2026-11-14',
}

function perna(parcial: Partial<PernaItinerarioVT>): PernaItinerarioVT {
  return {
    sequencia: 1,
    linha: 'L1',
    variante: null,
    operadora: 'Operadora',
    modal: 'onibus',
    categoriaServico: 'urbano_convencional',
    sistemaTarifario: 'riocard',
    escopo: 'municipal',
    municipioOrigem: 'Niterói',
    municipioDestino: 'Niterói',
    sentido: 'ida',
    embarque: { local: 'A', dataHoraPrevista: '2026-11-16T09:00:00Z' },
    desembarque: { local: 'B', dataHoraPrevista: '2026-11-16T09:20:00Z' },
    tarifaCentavos: null,
    tarifaVigenteDesde: '2026-01-01',
    ...parcial,
  }
}

function segunda(parcial: Partial<PernaItinerarioVT> = {}): PernaItinerarioVT {
  return perna({
    sequencia: 2,
    linha: 'L2',
    embarque: { local: 'C', dataHoraPrevista: '2026-11-16T09:30:00Z' },
    ...parcial,
  })
}

function rota(pernas: PernaItinerarioVT[]): ItinerarioVT {
  return { pernas, provedor: 'manual', consultadoEm: '2026-11-14T12:00:00Z', precisao: 'manual', evidenciaHash: 'teste' }
}

function cotar(pernas: PernaItinerarioVT[], cartao: FatosCartaoVT = CARTAO_BUI) {
  return cotarCatraca(rota(pernas), cartao, REGRAS_OFICIAIS_VT, '2026-11-16')
}

const sgMunicipal = () => perna({ municipioOrigem: 'São Gonçalo', municipioDestino: 'São Gonçalo' })
const inter484 = () => perna({ linha: '484M', escopo: 'intermunicipal', municipioOrigem: 'São Gonçalo', municipioDestino: 'Niterói', sistemaTarifario: 'detro' })
const rioMunicipal = () => perna({ municipioOrigem: 'Rio de Janeiro', municipioDestino: 'Rio de Janeiro', sistemaTarifario: 'jae' })

describe('cotarCatraca — BUN', () => {
  it('duas linhas diferentes, mesmo sentido e 30 minutos: segunda condução gratuita', () => {
    const resultado = cotar([perna({}), segunda()])
    expect(resultado.status).toBe('confirmavel')
    expect(resultado.alternativaEscolhidaId).toBe('bun')
    expect(resultado.totalEstimadoCentavos).toBe(560)
    expect(resultado.pernas[1].cobradoEstimadoCentavos).toBe(0)
    expect(resultado.integracoes.some((integracao) => integracao.aceita)).toBe(true)
  })

  it('mesma linha não integra', () => {
    const resultado = cotar([perna({}), segunda({ linha: 'L1' })])
    expect(resultado.alternativaEscolhidaId).toBe('tarifa_integral')
    expect(resultado.totalEstimadoCentavos).toBe(1120)
  })

  it('mais de 1 hora ou horário ausente não confirma a integração', () => {
    const tarde = cotar([perna({}), segunda({ embarque: { local: 'C', dataHoraPrevista: '2026-11-16T10:31:00Z' } })])
    expect(tarde.status).toBe('parcial')
    expect(tarde.alternativaEscolhidaId).toBe('tarifa_integral')
    expect(tarde.pendencias.some((item) => item.codigo === 'JANELA_BUN_EXCEDIDA')).toBe(true)

    const semHora = cotar([perna({}), segunda({ embarque: { local: 'C', dataHoraPrevista: null } })])
    expect(semHora.status).toBe('parcial')
    expect(semHora.pendencias.some((item) => item.codigo === 'HORARIOS_OBRIGATORIOS')).toBe(true)
  })

  it('BUN sem vínculo ao CPF não é aplicado', () => {
    const resultado = cotar([perna({}), segunda()], { ...CARTAO_BUI, vinculadoCpf: false })
    expect(resultado.alternativaEscolhidaId).toBe('tarifa_integral')
    expect(resultado.totalEstimadoCentavos).toBe(1120)
  })
})

describe('cotarCatraca — BUI', () => {
  it('municipal de SG + 484M: BUI de R$ 9,40, com diferença na segunda perna', () => {
    const resultado = cotar([sgMunicipal(), segunda(inter484())])
    expect(resultado.status).toBe('confirmavel')
    expect(resultado.alternativaEscolhidaId).toBe('bui')
    expect(resultado.totalEstimadoCentavos).toBe(940)
    expect(resultado.pernas.map((perna) => perna.cobradoEstimadoCentavos)).toEqual([555, 385])
  })

  it('intermunicipal + municipal de Niterói: exceção oficial, BUI não cobre a segunda perna', () => {
    const resultado = cotar([inter484(), segunda({})])
    expect(resultado.status).toBe('confirmavel')
    expect(resultado.alternativaEscolhidaId).toBe('tarifa_integral')
    expect(resultado.totalEstimadoCentavos).toBe(1270)
    expect(resultado.integracoes.some((integracao) => integracao.regraId.includes('excecao') && !integracao.aceita)).toBe(true)
  })

  it('BUI suspenso usa tarifa cheia; BUI não consultado deixa a escolha parcial', () => {
    const suspenso = cotar([inter484(), segunda(rioMunicipal())], { ...CARTAO_BUI, bui: 'suspenso' })
    expect(suspenso.alternativaEscolhidaId).toBe('tarifa_integral')
    expect(suspenso.totalEstimadoCentavos).toBe(1210)

    const desconhecido = cotar([inter484(), segunda(rioMunicipal())], { ...CARTAO_BUI, bui: 'nao_consultado' })
    expect(desconhecido.status).toBe('parcial')
    expect(desconhecido.totalEstimadoCentavos).toBe(1210)
    expect(desconhecido.pendencias.some((item) => item.codigo === 'BUI_NAO_CONSULTADO')).toBe(true)
  })

  it('Personalizado Empresa não habilita BUI', () => {
    const resultado = cotar([inter484(), segunda(rioMunicipal())], { ...CARTAO_BUI, personalizacao: 'empresa' })
    expect(resultado.alternativaEscolhidaId).toBe('tarifa_integral')
    expect(resultado.totalEstimadoCentavos).toBe(1210)
  })

  it('intermunicipal + municipal do Rio com BUI não acrescenta Jaé', () => {
    const resultado = cotar([inter484(), segunda(rioMunicipal())])
    expect(resultado.status).toBe('confirmavel')
    expect(resultado.alternativaEscolhidaId).toBe('bui')
    expect(resultado.totalEstimadoCentavos).toBe(940)
    expect(resultado.alternativas.find((alternativa) => alternativa.id === 'bui')?.cartoesNecessarios).toEqual(['riocard_bui'])
  })

  it('sem BUI, a parte municipal do Rio usa Jaé e tarifa separada', () => {
    const resultado = cotar([inter484(), segunda(rioMunicipal())], { ...CARTAO_BUI, bui: 'nao_possui' })
    expect(resultado.alternativaEscolhidaId).toBe('tarifa_integral')
    expect(resultado.totalEstimadoCentavos).toBe(1210)
    expect(resultado.alternativas[0].cartoesNecessarios).toEqual(expect.arrayContaining(['comum', 'jae']))
  })

  it('trem + metrô tem BUI, com janela específica de 120 minutos', () => {
    const trem = perna({ modal: 'trem', escopo: 'intermunicipal', municipioOrigem: 'São Gonçalo', municipioDestino: 'Rio de Janeiro', sistemaTarifario: 'supervia' })
    const metro = segunda({ modal: 'metro', municipioOrigem: 'Rio de Janeiro', municipioDestino: 'Rio de Janeiro', sistemaTarifario: 'metrorio' })
    const resultado = cotar([trem, metro])
    expect(resultado.status).toBe('confirmavel')
    expect(resultado.alternativaEscolhidaId).toBe('bui')
    expect(resultado.totalEstimadoCentavos).toBe(940)

    const foraDaJanela = cotar([trem, { ...metro, embarque: { local: 'C', dataHoraPrevista: '2026-11-16T11:01:00Z' } }])
    expect(foraDaJanela.status).toBe('parcial')
    expect(foraDaJanela.pendencias.some((item) => item.codigo === 'JANELA_BUI_EXCEDIDA')).toBe(true)
  })

  it('Metrô+BRT fica parcial pela regra específica do Jaé, nunca BUI genérico', () => {
    const metro = perna({ modal: 'metro', escopo: 'intermunicipal', sistemaTarifario: 'metrorio' })
    const brt = segunda({ modal: 'brt', municipioOrigem: 'Rio de Janeiro', municipioDestino: 'Rio de Janeiro', sistemaTarifario: 'jae' })
    const resultado = cotar([metro, brt])
    expect(resultado.status).toBe('parcial')
    expect(resultado.alternativaEscolhidaId).toBe('tarifa_integral')
    expect(resultado.pendencias.some((item) => item.codigo === 'METRO_BRT_VAN_REGRA_ESPECIFICA')).toBe(true)
  })

  it('492M direta: tarifa comum R$ 9,10 é melhor que BUI', () => {
    const resultado = cotar([perna({ linha: '492M', escopo: 'intermunicipal', municipioOrigem: 'São Gonçalo', municipioDestino: 'Niterói', sistemaTarifario: 'detro' })])
    expect(resultado.status).toBe('confirmavel')
    expect(resultado.alternativaEscolhidaId).toBe('tarifa_integral')
    expect(resultado.totalEstimadoCentavos).toBe(910)
  })

  it('100D direta: BUI reduz a catraca para R$ 9,40, sem decidir a base patronal', () => {
    const resultado = cotar([perna({ linha: '100D', escopo: 'intermunicipal', municipioOrigem: 'Niterói', municipioDestino: 'Rio de Janeiro', sistemaTarifario: 'detro' })])
    expect(resultado.status).toBe('confirmavel')
    expect(resultado.alternativaEscolhidaId).toBe('bui_direto')
    expect(resultado.totalEstimadoCentavos).toBe(940)
    expect(resultado.alternativas.find((alternativa) => alternativa.id === 'bui_direto')?.motivo).toContain('patronal')
  })

  it('primeira tarifa acima do teto na integração fica parcial', () => {
    const primeira = perna({ linha: '100D', escopo: 'intermunicipal', municipioOrigem: 'Niterói', municipioDestino: 'Rio de Janeiro', sistemaTarifario: 'detro' })
    const resultado = cotar([primeira, segunda(rioMunicipal())])
    expect(resultado.status).toBe('parcial')
    expect(resultado.pendencias.some((item) => item.codigo === 'BUI_PRIMEIRA_TARIFA_ACIMA_TETO')).toBe(true)
  })
})

describe('cotarCatraca — limites de evidência', () => {
  it('rota vazia ou sem regras vigentes é indeterminada', () => {
    expect(cotar([]).status).toBe('indeterminado')
    expect(cotarCatraca(rota([perna({})]), CARTAO_BUI, [], '2026-11-16').status).toBe('indeterminado')
  })

  it('três pernas nunca são apresentadas como uma única integração', () => {
    const resultado = cotar([sgMunicipal(), segunda(inter484()), perna({ sequencia: 3, linha: 'L3' })])
    expect(resultado.status).toBe('parcial')
    expect(resultado.pendencias.some((item) => item.codigo === 'SEQUENCIA_COM_MAIS_DE_DUAS_PERNAS')).toBe(true)
  })

  it('tarifa desconhecida não gera valor inventado', () => {
    const desconhecida = perna({ escopo: 'intermunicipal', linha: 'SEM TARIFA', municipioOrigem: 'Maricá', municipioDestino: 'Niterói' })
    const resultado = cotar([desconhecida])
    expect(resultado.status).toBe('indeterminado')
    expect(resultado.totalEstimadoCentavos).toBeNull()
  })
})
