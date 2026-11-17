import { describe, expect, it } from 'vitest'
import type { VtCargaLoteRow } from '@/types/vt'
import { codigoErroRpc, loteDeLinha } from '@/lib/vt/repositorioLoteSupabase'

const LINHA: VtCargaLoteRow = {
  id: 'lote-1',
  competencia: '2026-11',
  status: 'confirmado',
  versao_conteudo: 3,
  conteudo_hash: 'a'.repeat(64),
  versao_calculo: '3.0.0',
  versao_regras: { tarifas: '2026-11-01' },
  fonte: {
    tipo: 'gestao_escalas_flit',
    nomeArquivo: 'escalas.xlsx',
    conteudoHash: 'fonte-sha',
    importadoEm: '2026-11-01T10:00:00Z',
  },
  linhas: [],
  totais_por_colaborador: [],
  pendencias: [],
  necessidade_centavos: 1000,
  ajuste_centavos: -200,
  valor_centavos: 800,
  confirmacao: {
    versaoConteudo: 3,
    conteudoHash: 'a'.repeat(64),
    confirmadaPor: 'usuario-1',
    confirmadaEm: '2026-11-15T10:00:00Z',
  },
  lote_substituido_id: 'lote-anterior',
}

describe('repositório Supabase do lote', () => {
  it('converte todos os campos da linha para o domínio', () => {
    expect(loteDeLinha(LINHA)).toEqual({
      id: 'lote-1',
      competencia: '2026-11',
      status: 'confirmado',
      versaoConteudo: 3,
      conteudoHash: 'a'.repeat(64),
      versaoCalculo: '3.0.0',
      versaoRegras: { tarifas: '2026-11-01' },
      fonte: LINHA.fonte,
      linhas: [],
      totaisPorColaborador: [],
      pendencias: [],
      necessidadeCentavos: 1000,
      ajusteCentavos: -200,
      valorCentavos: 800,
      confirmacao: LINHA.confirmacao,
      loteSubstituidoId: 'lote-anterior',
    })
  })

  it('classifica erros de concorrência, duplicidade, pendência e aprovação', () => {
    expect(codigoErroRpc('O lote já está confirmado')).toBe('ja_confirmado')
    expect(codigoErroRpc('A versão do lote mudou')).toBe('conflito_versao')
    expect(codigoErroRpc('O lote tem pendências')).toBe('lote_parcial')
    expect(codigoErroRpc('Divergência sem aprovação')).toBe('divergencias_pendentes')
    expect(codigoErroRpc('Lote não encontrado')).toBe('nao_encontrado')
  })
})
