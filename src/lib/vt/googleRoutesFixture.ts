import type { RespostaGoogleRoutes } from './googleRoutes'

function passo({
  linha,
  nome,
  operadora,
  embarque,
  desembarque,
  partida,
  chegada,
}: {
  linha: string
  nome: string
  operadora: string
  embarque: string
  desembarque: string
  partida: string
  chegada: string
}) {
  return {
    travelMode: 'TRANSIT',
    transitDetails: {
      stopDetails: {
        departureStop: { name: embarque },
        arrivalStop: { name: desembarque },
        departureTime: partida,
        arrivalTime: chegada,
      },
      transitLine: {
        nameShort: linha,
        name: nome,
        vehicle: { type: 'BUS' },
        agencies: [{ name: operadora }],
      },
    },
  }
}

export const RESPOSTA_ACACIO: RespostaGoogleRoutes = {
  routes: [
    {
      distanceMeters: 20064,
      duration: '3326s',
      legs: [{
        steps: [passo({
          linha: '39A',
          nome: 'Piratininga - Centro',
          operadora: 'Prefeitura de Niterói',
          embarque: 'Rua da Conceição, 178',
          desembarque: 'Av. Dr. Acúrcio Torres, 260, Piratininga',
          partida: '2026-11-23T06:57:24Z',
          chegada: '2026-11-23T07:37:53Z',
        })],
      }],
    },
    {
      distanceMeters: 17703,
      duration: '4666s',
      legs: [{
        steps: [
          passo({
            linha: 'OC3A',
            nome: 'Oceânica 3a',
            operadora: 'Prefeitura de Niterói',
            embarque: 'Rua da Conceição, 178',
            desembarque: 'Rua Dr. Godofredo García Justo, 794 - Piratininga',
            partida: '2026-11-23T07:24:24Z',
            chegada: '2026-11-23T07:48:06Z',
          }),
          passo({
            linha: '1910D',
            nome: 'Piratininga - Castelo AC (Seção)',
            operadora: 'Semove - Intermunicipal',
            embarque: 'Estr. Francisco da Cruz Nunes, 3918, Piratininga',
            desembarque: 'Av. Dr. Acúrcio Torres, 260, Piratininga',
            partida: '2026-11-23T07:59:57Z',
            chegada: '2026-11-23T08:27:13Z',
          }),
        ],
      }],
    },
  ],
}

export const RESPOSTA_ALCEMIR: RespostaGoogleRoutes = {
  routes: [
    {
      distanceMeters: 17132,
      duration: '3773s',
      legs: [{
        steps: [
          passo({
            linha: '536R',
            nome: 'Niterói - Várzea das Moças (via Maria Paula)',
            operadora: 'Semove - Intermunicipal',
            embarque: 'Brs 1,2,3,4,5,I - Al. São Boaventura, 1191-1211',
            desembarque: 'Estr. Velha de Maricá, 980 - Maria Paula',
            partida: '2026-11-23T06:25:18Z',
            chegada: '2026-11-23T06:55:07Z',
          }),
          passo({
            linha: '35',
            nome: 'Baldeador - Centro',
            operadora: 'Prefeitura de Niterói',
            embarque: 'Estr. Velha de Maricá, 980 - Maria Paula',
            desembarque: 'Estr. Caetano Monteiro, 1077, Badu',
            partida: '2026-11-23T07:04:03Z',
            chegada: '2026-11-23T07:15:33Z',
          }),
        ],
      }],
    },
    {
      distanceMeters: 12974,
      duration: '4370s',
      legs: [{
        steps: [
          passo({
            linha: '2590R',
            nome: 'Ponta Negra - Castelo',
            operadora: 'Semove - Intermunicipal',
            embarque: 'BRS 1,2,3,4,5,I - Al. São Boaventura, 1040',
            desembarque: 'Rod. Amaral Peixoto, 593-665',
            partida: '2026-11-23T06:14:05Z',
            chegada: '2026-11-23T06:34:45Z',
          }),
          passo({
            linha: '584',
            nome: 'Niterói - Araruama (AC)',
            operadora: 'Semove - Intermunicipal',
            embarque: 'Rod. Amaral Peixoto, 593-665',
            desembarque: 'Av. Abdias José dos Santos, 216-240',
            partida: '2026-11-23T06:43:57Z',
            chegada: '2026-11-23T06:48:37Z',
          }),
          passo({
            linha: '35',
            nome: 'Baldeador - Centro',
            operadora: 'Prefeitura de Niterói',
            embarque: 'Rod. Pref. João Sampaio, 241 - Rio do Ouro',
            desembarque: 'Estr. Caetano Monteiro, 1077, Badu',
            partida: '2026-11-23T07:01:40Z',
            chegada: '2026-11-23T07:15:33Z',
          }),
        ],
      }],
    },
    {
      distanceMeters: 8052,
      duration: '2979s',
      legs: [{
        steps: [
          passo({
            linha: '542R',
            nome: 'Anaia - Niterói',
            operadora: 'Semove - Intermunicipal',
            embarque: 'BRS 1,2,3,4,5,I',
            desembarque: 'Terminal Rodoviario João Goulart',
            partida: '2026-11-23T06:23:13Z',
            chegada: '2026-11-23T06:44:49Z',
          }),
          passo({
            linha: '39A',
            nome: 'Piratininga - Centro',
            operadora: 'Prefeitura de Niterói',
            embarque: 'Rua Doze, Centro',
            desembarque: 'Rua da Conceição, 178',
            partida: '2026-11-23T06:52:00Z',
            chegada: '2026-11-23T06:57:24Z',
          }),
        ],
      }],
    },
    {
      distanceMeters: 15204,
      duration: '3574s',
      legs: [{
        steps: [
          passo({
            linha: '62',
            nome: 'Fonseca - Centro',
            operadora: 'Prefeitura de Niterói',
            embarque: 'Al. São Boaventura, 1084-1096 - Fonseca',
            desembarque: 'Rua Barão do Amazonas 439, Centro',
            partida: '2026-11-23T06:26:28Z',
            chegada: '2026-11-23T06:39:09Z',
          }),
          passo({
            linha: '39A',
            nome: 'Piratininga - Centro',
            operadora: 'Prefeitura de Niterói',
            embarque: 'Rua da Conceição, 178',
            desembarque: 'Estr. Francisco da Cruz Nunes, 1640, Cantagalo',
            partida: '2026-11-23T06:57:24Z',
            chegada: '2026-11-23T07:18:41Z',
          }),
        ],
      }],
    },
    {
      distanceMeters: 14572,
      duration: '4380s',
      legs: [{
        steps: [
          passo({
            linha: '62',
            nome: 'Fonseca - Centro',
            operadora: 'Prefeitura de Niterói',
            embarque: 'Al. São Boaventura, 1084-1096 - Fonseca',
            desembarque: 'Rua da Conceição, 178',
            partida: '2026-11-23T06:26:28Z',
            chegada: '2026-11-23T06:39:09Z',
          }),
          passo({
            linha: '771D',
            nome: 'Pendotiba - Candelária',
            operadora: 'Semove - Intermunicipal',
            embarque: 'Rua da Conceição, 178',
            desembarque: 'Estr. Caetano Monteiro, 4800-4922',
            partida: '2026-11-23T06:02:25Z',
            chegada: '2026-11-23T06:44:41Z',
          }),
        ],
      }],
    },
    {
      distanceMeters: 15346,
      duration: '4792s',
      legs: [{
        steps: [
          passo({
            linha: '62',
            nome: 'Fonseca - Centro',
            operadora: 'Prefeitura de Niterói',
            embarque: 'Al. São Boaventura, 1084-1096 - Fonseca',
            desembarque: 'Rua da Conceição, 178',
            partida: '2026-11-23T06:26:28Z',
            chegada: '2026-11-23T06:39:09Z',
          }),
          passo({
            linha: '770D',
            nome: 'Itaipu - Candelária',
            operadora: 'Semove - Intermunicipal',
            embarque: 'Rua da Conceição, 178',
            desembarque: 'Estr. Francisco da Cruz Nunes, 1000-1048',
            partida: '2026-11-23T06:03:09Z',
            chegada: '2026-11-23T06:46:12Z',
          }),
        ],
      }],
    },
  ],
}
