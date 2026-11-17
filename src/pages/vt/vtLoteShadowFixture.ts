import type { EntradaConstruirLote } from '@/hooks/useVtLoteCarga'
import type { ComponenteDecisaoTrajetoVT, DecisaoTrajetoVT } from '@/lib/vt/contratosTarifarios'

export const NOMES_LOTE_SHADOW: Readonly<Record<string, string>> = {
  'shadow-pessoa-a': 'Pessoa exemplo A',
  'shadow-pessoa-b': 'Pessoa exemplo B',
  'shadow-pessoa-c': 'Pessoa exemplo C',
}

const PESSOAS = Object.keys(NOMES_LOTE_SHADOW)

function decisao(colaboradorId: string): DecisaoTrajetoVT {
  return {
    id: `decisao-${colaboradorId}`,
    trajetoLegadoId: null,
    colaboradorId,
    departamentoId: 'shadow-posto',
    revisao: 1,
    cotacaoId: null,
    status: 'confirmada',
    confirmadaPor: 'shadow-usuario',
    confirmadaEm: '2026-11-01T10:00:00.000Z',
    vigenteDesde: '2026-11-01',
    vigenteAte: null,
    origem: 'manual',
    referenciasLegadasNaoResolvidas: [],
  }
}

function componente(decisaoTrajetoId: string): ComponenteDecisaoTrajetoVT {
  return {
    id: `componente-${decisaoTrajetoId}`,
    decisaoTrajetoId,
    pacoteId: `pacote-${decisaoTrajetoId.replace('decisao-', '')}`,
    ordem: 1,
  }
}

export function entradaLoteShadow({
  substituicao = false,
  comPendencia = false,
}: {
  substituicao?: boolean
  comPendencia?: boolean
} = {}): EntradaConstruirLote {
  const pessoasComDias = substituicao
    ? ['shadow-pessoa-a', 'shadow-pessoa-c']
    : ['shadow-pessoa-a', 'shadow-pessoa-b']
  const valores: Record<string, number> = {
    'shadow-pessoa-a': substituicao ? 1200 : 1000,
    'shadow-pessoa-b': 1120,
    'shadow-pessoa-c': 1400,
  }

  return {
    id: substituicao ? 'shadow-lote-2' : 'shadow-lote-1',
    competencia: '2026-11',
    versaoCalculo: '3.0.0-shadow',
    versaoRegras: { tarifas: substituicao ? 'shadow-v2' : 'shadow-v1' },
    fonte: {
      tipo: 'gestao_escalas_flit',
      nomeArquivo: 'cenario-sintetico.xlsx',
      conteudoHash: substituicao ? 'shadow-fonte-v2' : 'shadow-fonte-v1',
      importadoEm: '2026-11-15T12:00:00.000Z',
    },
    dias: pessoasComDias.map((colaboradorId) => ({
      colaboradorId,
      departamentoId: 'shadow-posto',
      data: '2026-11-10',
      origemDia: 'escala',
    })),
    decisoes: PESSOAS.map(decisao),
    componentes: PESSOAS.map((pessoa) => componente(`decisao-${pessoa}`)),
    versoesPreco: PESSOAS
      .filter((pessoa) => !(comPendencia && pessoa === 'shadow-pessoa-b'))
      .map((pessoa) => ({
        id: `preco-${pessoa}-${substituicao ? 'v2' : 'v1'}`,
        pacoteId: `pacote-${pessoa}`,
        valorDiarioCentavos: valores[pessoa],
        vigenteDesde: '2026-11-01',
        vigenteAte: null,
      })),
    loteSubstituidoId: substituicao ? 'shadow-lote-1' : undefined,
  }
}
