import { RESPOSTA_ACACIO, RESPOSTA_ALCEMIR } from '@/lib/vt/googleRoutesFixture'
import {
  VtRevisaoRota,
  type CenarioRevisaoRotaShadow,
  type ContextoRevisaoRotaReal,
} from '@/pages/vt/VtRevisaoRota'
import type { FatosCartaoVT } from '@/lib/vt/contratosTarifarios'

const CARTAO_ACACIO: FatosCartaoVT = {
  personalizacao: 'usuario',
  vinculadoCpf: true,
  bui: 'ativo',
  bun: 'ativo',
  jae: 'disponivel',
  situacaoConsultadaEm: '2026-10-28',
}

const CARTAO_ALCEMIR: FatosCartaoVT = {
  personalizacao: 'usuario',
  vinculadoCpf: true,
  bui: 'suspenso',
  bun: 'nao_consultado',
  jae: 'nao_informado',
  situacaoConsultadaEm: '2026-10-28',
}

const CENARIOS: CenarioRevisaoRotaShadow[] = [
  {
    id: 'acacio',
    rotulo: 'Acacio — Niterói',
    resposta: RESPOSTA_ACACIO,
    origem: 'RUA QUINZE DE NOVEMBRO, 280, CENTRO, Niterói - RJ, 24020-125',
    destino: 'PRAIA DE PIRATININGA, 2, Niterói - RJ, 24358-310',
    municipioOrigem: 'Niterói',
    municipioDestino: 'Niterói',
    cartao: CARTAO_ACACIO,
  },
  {
    id: 'alcemir',
    rotulo: 'Alcemir — São Gonçalo',
    resposta: RESPOSTA_ALCEMIR,
    origem: 'Travessa Cosme e Damião, Neves, São Gonçalo - RJ, 24425-700',
    destino: 'RUA JOÃO BATISTA DA COSTA, 450, Niterói - RJ, 24320-285',
    municipioOrigem: 'São Gonçalo',
    municipioDestino: 'Niterói',
    cartao: CARTAO_ALCEMIR,
  },
]

export type { ContextoRevisaoRotaReal }

export function VtRevisaoRotaShadow({ contextoReal }: { contextoReal?: ContextoRevisaoRotaReal }) {
  return <VtRevisaoRota contextoReal={contextoReal} cenariosShadow={CENARIOS} />
}
