import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { VtEscalaColaboradorDialog } from '@/pages/vt/VtEscalaColaboradorDialog'
import type { LinhaLoteCargaVT, TotalColaboradorLoteCargaVT } from '@/lib/vt/contratosLoteCarga'

const leitura = vi.hoisted(() => ({ resposta: { situacao: 'vazia' } as Record<string, unknown> }))
vi.mock('@/lib/vt/escalaDiasRepositorio', () => ({
  MENSAGEM_178_AUSENTE: 'Falta aplicar a migration 178 (escala do relatório no banco).',
  lerEscalaDias: vi.fn(async () => leitura.resposta),
}))

const linha = (data: string, origemDia: LinhaLoteCargaVT['origemDia'] = 'escala'): LinhaLoteCargaVT => ({
  id: `l-${data}`,
  colaboradorId: 'p1',
  departamentoId: 'posto-a',
  data,
  origemDia,
  decisaoTrajetoId: 'd1',
  decisaoRevisao: 1,
  componentes: [],
  ajustes: [],
  custoDiaCentavos: 1120,
  pendenciaIds: [],
})

const TOTAL: TotalColaboradorLoteCargaVT = {
  colaboradorId: 'p1',
  status: 'completo',
  necessidadeCentavos: 3360,
  ajusteCentavos: -1120 + 1000,
  valorCentavos: 3240,
  excedenteTruncadoCentavos: 0,
  lancamentoAjusteIds: [],
  pendenciaIds: [],
  extraMensalCentavos: 1000,
  extraMensalMotivo: 'Cobre Montreal',
}

const base = {
  open: true,
  onOpenChange: () => {},
  colaboradorId: 'p1',
  nome: 'Maria Teste',
  competencia: '2026-12',
  linhas: [linha('2026-12-01'), linha('2026-12-02'), linha('2026-12-03', 'treinamento')],
  total: TOTAL,
  nomePosto: () => 'CBO',
}

const textoNormal = (el: HTMLElement) => (el.textContent ?? '').replace(/\u00a0/g, ' ')

describe('VtEscalaColaboradorDialog', () => {
  it('com o relatório em memória: cores por dia, legenda e a conta até o valor final', async () => {
    render(
      <VtEscalaColaboradorDialog
        {...base}
        marcasEmMemoria={{
          '2026-12-01': { marca: 'T', local: 'CBO' },
          '2026-12-02': { marca: 'T', local: 'CBO' },
          '2026-12-03': { marca: 'T', local: 'CBO' },
          '2026-12-04': { marca: 'F', local: 'CBO' },
          '2026-12-05': { marca: 'FR', local: 'CBO' },
          '2026-12-06': { marca: 'AT', local: 'CBO' },
        }}
      />,
    )
    expect(screen.getByRole('heading', { name: /Escala de Maria Teste — 12\/2026/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/^01\/12\/2026 \(terça\) — Trabalho \(gera VT\) — posto CBO/)).toHaveAttribute('data-tipo', 'trabalho_vt')
    expect(screen.getByLabelText(/^03\/12\/2026.*Treinamento/)).toHaveAttribute('data-tipo', 'treinamento')
    expect(screen.getByLabelText(/^04\/12\/2026.*Folga/)).toHaveAttribute('data-tipo', 'folga')
    expect(screen.getByLabelText(/^05\/12\/2026.*Férias/)).toHaveAttribute('data-tipo', 'ferias')
    expect(screen.getByLabelText(/^06\/12\/2026.*Atestado/)).toHaveAttribute('data-tipo', 'atestado')
    expect(screen.getByLabelText(/^20\/12\/2026.*Fora do relatório/)).toHaveAttribute('data-tipo', 'fora_relatorio')
    const legenda = screen.getByRole('list', { name: 'Legenda' })
    expect(within(legenda).getByText('Férias')).toBeInTheDocument()
    const conta = textoNormal(screen.getByTestId('conta-escala'))
    expect(conta).toContain('3 dias × R$ 11,20 no posto CBO = R$ 33,60')
    expect(conta).toContain('− R$ 11,20 ajuste do fechamento do mês anterior')
    expect(conta).toContain('+ R$ 10,00 extra no mês (Cobre Montreal)')
    expect(conta).toContain('Valor final: R$ 32,40')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('busca as marcas no banco quando o relatório não está na tela', async () => {
    leitura.resposta = {
      situacao: 'ok',
      dias: { '2026-12-04': { marca: 'F', local: 'CBO' } },
      nomeArquivo: 'dezembro.xlsx',
      importadoEm: '2026-11-28T15:00:00Z',
    }
    render(<VtEscalaColaboradorDialog {...base} />)
    expect(await screen.findByLabelText(/^04\/12\/2026.*Folga/)).toHaveAttribute('data-tipo', 'folga')
    expect(screen.getByText(/relatório dezembro\.xlsx em/)).toBeInTheDocument()
  })

  it('sem marcas gravadas avisa e mostra só os dias de trabalho', async () => {
    leitura.resposta = { situacao: 'vazia' }
    render(<VtEscalaColaboradorDialog {...base} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Escala detalhada indisponível — reimporte o relatório')
    expect(screen.getByLabelText(/^01\/12\/2026.*Trabalho/)).toHaveAttribute('data-tipo', 'trabalho_vt')
    expect(screen.getByLabelText(/^04\/12\/2026.*Sem escala detalhada/)).toHaveAttribute('data-tipo', 'sem_detalhe')
  })
})
