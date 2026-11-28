import { describe, expect, it } from 'vitest'
import { avisoCargaParcial, bannerEstadoLote } from '@/lib/vt/estadoLote'
import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'

const lote = (status: 'rascunho' | 'confirmado'): LoteCargaVT => ({
  id: 'l1',
  competencia: '2026-12',
  status,
  versaoConteudo: 2,
  conteudoHash: 'a'.repeat(64),
  versaoCalculo: 'x',
  versaoRegras: {},
  fonte: { tipo: 'gestao_escalas_flit', nomeArquivo: 'a.xlsx', conteudoHash: 'b', importadoEm: '2026-11-28T10:00:00Z' },
  linhas: [],
  totaisPorColaborador: [{ colaboradorId: 'p1' }] as never,
  pendencias: [],
  necessidadeCentavos: 0,
  ajusteCentavos: 0,
  valorCentavos: 0,
  confirmacao: null,
  loteSubstituidoId: null,
})

describe('bannerEstadoLote', () => {
  it('sem lote no banco e com relatório na tela: vermelho "AINDA NÃO está salva"', () => {
    const b = bannerEstadoLote({ competencia: '2026-12', lote: null, carregado: true, temRelatorioNaTela: true })
    expect(b?.tom).toBe('vermelho')
    expect(b?.titulo).toMatch(/AINDA NÃO está salva/)
  })
  it('sem lote e sem relatório (outra pessoa abrindo a aba): vermelho "Nenhuma carga salva"', () => {
    const b = bannerEstadoLote({ competencia: '2026-12', lote: null, carregado: true, temRelatorioNaTela: false })
    expect(b?.titulo).toMatch(/Nenhuma carga salva/)
  })
  it('rascunho salvo: âmbar; confirmado: verde; sem leitura concluída: nada', () => {
    expect(bannerEstadoLote({ competencia: '2026-12', lote: lote('rascunho'), carregado: true, temRelatorioNaTela: false })?.tom).toBe('ambar')
    expect(bannerEstadoLote({ competencia: '2026-12', lote: lote('confirmado'), carregado: true, temRelatorioNaTela: false })?.tom).toBe('verde')
    expect(bannerEstadoLote({ competencia: '2026-12', lote: null, carregado: false, temRelatorioNaTela: true })).toBeNull()
  })
})

describe('avisoCargaParcial', () => {
  it('cita o último dia do relatório', () => {
    const diasFaltando = Array.from({ length: 16 }, (_, i) => `2026-12-${String(i + 16).padStart(2, '0')}`)
    const a = avisoCargaParcial({ primeiro: '2026-12-01', ultimo: '2026-12-15', diasFaltando, completo: false })
    expect(a).toMatch(/até 15\/12\/2026/)
    expect(a).toMatch(/NÃO confirme/)
  })
  it('completo ou ausente: sem aviso', () => {
    expect(avisoCargaParcial({ primeiro: '2026-12-01', ultimo: '2026-12-31', diasFaltando: [], completo: true })).toBeNull()
    expect(avisoCargaParcial(null)).toBeNull()
  })
})
