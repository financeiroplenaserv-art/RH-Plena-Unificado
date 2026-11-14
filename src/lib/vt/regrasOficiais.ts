import type { RegraOficialVT } from '@/lib/vt/contratosTarifarios'

export const REGRA_VT_FEDERAL = 'vt-federal-10854-125'
export const REGRA_BUN_ONIBUS = 'bun-onibus-integracao-1h'
export const REGRA_BUI = 'bui-integracao-2-servicos'
export const REGRA_BUI_EXCECAO_NITEROI = 'bui-excecao-municipal-niteroi'
export const REGRA_JAE = 'jae-municipal-rio'
export const REGRA_METRORIO = 'metrorio-integracoes-especificas'
export const REGRA_DETRO_2026 = 'detro-portaria-1960-2026'
export const REGRA_RIOCARD_TARIFAS = 'riocard-tarifas-2026-09-28'

const CONSULTA = '2026-11-14'

export const REGRAS_OFICIAIS_VT: readonly RegraOficialVT[] = [
  {
    id: REGRA_VT_FEDERAL,
    tipo: 'tarifa',
    produto: 'COMUM',
    vigenteDesde: '2021-11-10',
    vigenteAte: null,
    fonte: {
      titulo: 'Decreto federal 10.854/2021 — arts. 124 e 125',
      url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/decreto/d10854.htm',
      publicadoEm: '2021-11-10',
      consultadoEm: CONSULTA,
    },
    parametros: { tarifaIntegral: true, integracaoNaoEhDesconto: true },
  },
  {
    id: REGRA_BUN_ONIBUS,
    tipo: 'integracao',
    produto: 'BUN',
    vigenteDesde: '2025-07-06',
    vigenteAte: null,
    fonte: {
      titulo: 'Riocard Mais — Bilhete Único Niterói',
      url: 'https://site.riobilheteunico.com.br/bilhete-unico-niteroi/',
      publicadoEm: null,
      consultadoEm: CONSULTA,
    },
    parametros: {
      maximoServicos: 2,
      intervaloMaximoMinutos: 60,
      usosPorDia: 2,
      intervaloMinimoEntreUsosMinutos: 60,
      linhasDiferentes: true,
      mesmoSentido: true,
      tarifaIntegralVtCentavos: 560,
      tarifaSocialCatracaCentavos: 445,
    },
  },
  {
    id: REGRA_BUI,
    tipo: 'integracao',
    produto: 'BUI',
    vigenteDesde: '2025-12-19',
    vigenteAte: null,
    fonte: {
      titulo: 'Rio Bilhete Único — Bilhete Único Intermunicipal',
      url: 'https://site.riobilheteunico.com.br/bilhete-unico-intermunicipal/',
      publicadoEm: '2026-11-12',
      consultadoEm: CONSULTA,
    },
    parametros: {
      maximoServicos: 2,
      intervaloMaximoMinutos: 180,
      usosPorDia: 2,
      intervaloMinimoEntreUsosMinutos: 60,
      valorIntegracaoCentavos: 940,
      rendaMaximaCentavos: 320520,
      idadeMinima: 6,
      idadeMaxima: 64,
      personalizadoUsuarioObrigatorio: true,
    },
  },
  {
    id: REGRA_BUI_EXCECAO_NITEROI,
    tipo: 'integracao',
    produto: 'BUI',
    vigenteDesde: '2026-11-12',
    vigenteAte: null,
    fonte: {
      titulo: 'Rio Bilhete Único — exceção dos ônibus municipais de Niterói',
      url: 'https://site.riobilheteunico.com.br/bilhete-unico-intermunicipal/',
      publicadoEm: '2026-11-12',
      consultadoEm: CONSULTA,
    },
    parametros: { municipalNiteroiIntegraSomenteBun: true },
  },
  {
    id: REGRA_JAE,
    tipo: 'tarifa',
    produto: 'JAE',
    vigenteDesde: '2025-08-02',
    vigenteAte: null,
    fonte: {
      titulo: 'Jaé — integrações e modais municipais do Rio',
      url: 'https://jae.com.br/integracoes/',
      publicadoEm: null,
      consultadoEm: CONSULTA,
    },
    parametros: { tarifaOnibusBrtVltCentavos: 500 },
  },
  {
    id: REGRA_METRORIO,
    tipo: 'integracao',
    produto: 'MODAL',
    vigenteDesde: '2025-08-02',
    vigenteAte: null,
    fonte: {
      titulo: 'MetrôRio — meios e tarifas',
      url: 'https://www.metrorio.com.br/como-pagar/meios-e-tarifas',
      publicadoEm: null,
      consultadoEm: CONSULTA,
    },
    parametros: {
      intervaloMaximoMinutos: 120,
      metroBrtVanSomenteJae: true,
      tarifaMetroCentavos: 790,
    },
  },
  {
    id: REGRA_DETRO_2026,
    tipo: 'tarifa',
    produto: 'COMUM',
    vigenteDesde: '2026-02-15',
    vigenteAte: null,
    fonte: {
      titulo: 'Portaria DETRO/PRES 1.960/2026',
      url: 'https://www.sindpass.com.br/wp-content/uploads/2026/02/Portaria-DETRO-Reajuste-2026.pdf',
      publicadoEm: '2026-02-15',
      consultadoEm: CONSULTA,
    },
    parametros: {
      '484M': 710,
      '483M': 910,
      '492M': 910,
      '100D': 1040,
      '515M': 710,
      '516M': 710,
    },
  },
  {
    id: REGRA_RIOCARD_TARIFAS,
    tipo: 'tarifa',
    produto: 'MODAL',
    vigenteDesde: '2026-09-28',
    vigenteAte: null,
    fonte: {
      titulo: 'Riocard Mais — tarifas vigentes',
      url: 'http://www.riocardmais.com.br/Tarifas',
      publicadoEm: '2026-09-28',
      consultadoEm: CONSULTA,
    },
    parametros: {
      niteroiIntegralCentavos: 560,
      saoGoncaloMunicipalCentavos: 555,
      tremCentavos: 760,
      metroCentavos: 790,
      barcaCentavos: 500,
      barcaCharitasCentavos: 770,
    },
  },
]
