import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VtLoteCargaReal } from '@/pages/vt/VtLoteCargaReal'
import type { VtColaborador } from '@/hooks/useVt'
import type { ComponenteDecisaoTrajetoVT, DecisaoTrajetoVT, VersaoPrecoPacoteVT } from '@/lib/vt/contratosTarifarios'

const DECISAO: DecisaoTrajetoVT = {
  id: 'decisao-1',
  trajetoLegadoId: 'trajeto-1',
  colaboradorId: 'pessoa-1',
  departamentoId: 'posto-1',
  revisao: 1,
  cotacaoId: null,
  status: 'confirmada',
  confirmadaPor: 'usuario-1',
  confirmadaEm: '2026-01-01T10:00:00Z',
  vigenteDesde: '2026-01-01',
  vigenteAte: null,
  referenciasLegadasNaoResolvidas: [],
}

const COMPONENTE: ComponenteDecisaoTrajetoVT = {
  id: 'componente-1',
  decisaoTrajetoId: DECISAO.id,
  pacoteId: 'pacote-1',
  ordem: 1,
}

const PRECO: VersaoPrecoPacoteVT = {
  id: 'preco-1',
  pacoteId: 'pacote-1',
  valorDiarioCentavos: 1000,
  vigenteDesde: '2026-01-01',
  vigenteAte: null,
}

vi.mock('@/lib/vt/carregarDominioLote', () => ({
  carregarDominioLote: vi.fn(async () => ({
    decisoes: [DECISAO],
    componentes: [COMPONENTE],
    versoesPreco: [PRECO],
    ajustesBeneficio: [],
  })),
}))
// Banco: sem fechamento do mês anterior; a gravação para o Fechamento devolve uma linha por carga.
const banco = vi.hoisted(() => ({ cargasGravadas: [] as Record<string, unknown>[], extras: [] as Record<string, unknown>[] }))
vi.mock('@/lib/supabase', () => {
  const consulta = (tabela: string) => {
    const q: Record<string, unknown> = {}
    let linhas: Record<string, unknown>[] = []
    for (const m of ['select', 'eq', 'in']) q[m] = () => q
    if (tabela === 'vt_extras_mensais') {
      linhas = banco.extras
      q.insert = (row: Record<string, unknown>) => {
        const nova = { id: `x${banco.extras.length + 1}`, ...row }
        banco.extras.push(nova)
        linhas = [nova]
        return q
      }
    }
    q.upsert = (rows: Record<string, unknown>[]) => {
      if (tabela === 'vt_cargas') banco.cargasGravadas.push(...rows)
      linhas = rows.map((_, i) => ({ id: `c${i}` }))
      return q
    }
    q.then = (ok: (v: unknown) => void) => ok({ data: linhas, error: null })
    return q
  }
  return { supabase: { from: consulta } }
})
// Escala detalhada (migration 178): gravação e leitura simuladas.
const escalaBanco = vi.hoisted(() => ({ gravacoes: [] as unknown[], falhar: false }))
vi.mock('@/lib/vt/escalaDiasRepositorio', () => ({
  MENSAGEM_178_AUSENTE: 'Falta aplicar a migration 178 (escala do relatório no banco).',
  gravarEscalaDiasCompetencia: vi.fn(async (params: unknown) => {
    if (escalaBanco.falhar) throw new Error('Falta aplicar a migration 178 (escala do relatório no banco).')
    escalaBanco.gravacoes.push(params)
    return { gravadas: 1, removidas: 0 }
  }),
  lerEscalaDias: vi.fn(async () => ({ situacao: 'vazia' })),
}))
vi.mock('@/lib/vt/repositorioLoteSupabase', async () => {
  const { RepositorioLoteCargaEmMemoria } = await import('@/lib/vt/confirmarLote')
  return { RepositorioLoteCargaSupabase: RepositorioLoteCargaEmMemoria }
})

const COLABORADORES: VtColaborador[] = [
  {
    id: 'pessoa-1',
    nome_completo: 'Pessoa Trabalhou',
    departamento: 'POSTO',
    departamento_id: 'posto-1',
    cidade: 'Niterói',
    endereco: null,
    vt_optante: true,
    vt_tipo_cartao: 'bun',
    cargo: null,
  },
  {
    id: 'pessoa-sem-dias',
    nome_completo: 'Pessoa Sem Dias',
    departamento: 'POSTO',
    departamento_id: 'posto-1',
    cidade: 'Niterói',
    endereco: null,
    vt_optante: true,
    vt_tipo_cartao: 'bun',
    cargo: null,
  },
]

describe('vertical real do lote', () => {
  it('constrói, inclui optante sem dias, confirma e libera o Excel', async () => {
    render(
      <VtLoteCargaReal
        competencia="2026-11"
        dias={[{ colaboradorId: 'pessoa-1', departamentoId: 'posto-1', data: '2026-11-10', origemDia: 'escala' }]}
        colaboradores={COLABORADORES}
        nomeArquivo="escalas.xlsx"
        departamentos={[]}
        usuarioId="usuario-1"
      />,
    )

    const botaoConstruir = screen.getByRole('button', { name: 'Construir rascunho' })
    await waitFor(() => expect(botaoConstruir).toBeEnabled())
    fireEvent.click(botaoConstruir)
    expect(await screen.findByText('Pessoa Sem Dias')).toBeInTheDocument()
    expect(screen.getByText('rascunho')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar lote' }))
    expect(await screen.findByText('confirmado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Baixar Excel do lote' })).toBeInTheDocument()
    // Confirmar grava a carga para a aba Fechamento (uma linha por pessoa completa).
    expect(await screen.findByText(/carga\(s\) gravada\(s\)/)).toBeInTheDocument()
    expect(banco.cargasGravadas.length).toBeGreaterThan(0)
    expect(banco.cargasGravadas.every((c) => c.status === 'gravada' && c.competencia === '2026-11')).toBe(true)
  })

  it('ordena a tabela pelo nome: A→Z por padrão, Z→A e ordem original ao clicar no cabeçalho', async () => {
    render(
      <VtLoteCargaReal
        competencia="2026-11"
        dias={[{ colaboradorId: 'pessoa-1', departamentoId: 'posto-1', data: '2026-11-10', origemDia: 'escala' }]}
        colaboradores={COLABORADORES}
        nomeArquivo="escalas.xlsx"
        departamentos={[]}
        usuarioId="usuario-1"
      />,
    )
    const botaoConstruir = screen.getByRole('button', { name: 'Construir rascunho' })
    await waitFor(() => expect(botaoConstruir).toBeEnabled())
    fireEvent.click(botaoConstruir)
    await screen.findByText('Pessoa Sem Dias')
    const ordem = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent ?? '')
    expect(ordem()[0]).toContain('Pessoa Sem Dias')
    const cabecalho = screen.getByRole('button', { name: /Colaborador/ })
    fireEvent.click(cabecalho)
    expect(ordem()[0]).toContain('Pessoa Trabalhou')
    fireEvent.click(cabecalho)
    expect(ordem()).toHaveLength(2)
  })

  it('lança o extra do mês com motivo, recalcula o rascunho e mostra "só extra" para quem não tem dias', async () => {
    banco.extras.length = 0
    render(
      <VtLoteCargaReal
        competencia="2026-11"
        dias={[{ colaboradorId: 'pessoa-1', departamentoId: 'posto-1', data: '2026-11-10', origemDia: 'escala' }]}
        colaboradores={COLABORADORES}
        nomeArquivo="escalas.xlsx"
        departamentos={[]}
        usuarioId="usuario-1"
        podeGerenciar
      />,
    )
    const botaoConstruir = screen.getByRole('button', { name: 'Construir rascunho' })
    await waitFor(() => expect(botaoConstruir).toBeEnabled())
    fireEvent.click(botaoConstruir)
    await screen.findByText('rascunho')

    fireEvent.change(screen.getByLabelText('Pessoa do extra'), { target: { value: 'pessoa-sem-dias' } })
    fireEvent.change(screen.getByLabelText('Extra no mês (R$)'), { target: { value: '15,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gravar extra' }))
    expect(await screen.findByText('O motivo é obrigatório.')).toBeInTheDocument()
    expect(banco.extras).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Motivo do extra'), { target: { value: 'Cobre outro contrato' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gravar extra' }))
    // Recalcula na hora ou, se o salvamento automático ainda estiver rodando, logo em seguida (fila).
    expect(await screen.findByText(/Extra gravado\. (Rascunho recalculado|O rascunho será recalculado em seguida)\./)).toBeInTheDocument()
    expect(banco.extras).toHaveLength(1)
    expect(banco.extras[0]).toMatchObject({ colaborador_id: 'pessoa-sem-dias', competencia: '2026-11', valor_centavos: 1500, motivo: 'Cobre outro contrato' })
    expect(await screen.findByText('só extra, sem dias de trabalho')).toBeInTheDocument()
  })

  it('salva o rascunho no banco sozinho ao importar (importacaoSeq) e avisa quando o relatório é parcial', async () => {
    const props = {
      competencia: '2026-12',
      cobertura: { primeiro: '2026-12-01', ultimo: '2026-12-15', diasFaltando: ['2026-12-16'], completo: false },
      dias: [{ colaboradorId: 'pessoa-1', departamentoId: 'posto-1', data: '2026-12-10', origemDia: 'escala' as const }],
      colaboradores: COLABORADORES,
      nomeArquivo: 'escalas.xlsx',
      departamentos: [],
      usuarioId: 'usuario-1',
      podeGerenciar: true,
    }
    const { rerender } = render(<VtLoteCargaReal {...props} importacaoSeq={0} />)
    expect(await screen.findByText(/AINDA NÃO está salva no banco/)).toBeInTheDocument()
    expect(screen.getByTestId('aviso-parcial')).toHaveTextContent('até 15/12/2026')

    rerender(<VtLoteCargaReal {...props} importacaoSeq={1} />)
    expect(await screen.findByText(/Rascunho de 2026-12 SALVO no banco/)).toBeInTheDocument()
    expect(screen.getByText('rascunho')).toBeInTheDocument()
  })

  it('o botão "Arquivo Riocard" só habilita com o lote confirmado', async () => {
    render(
      <VtLoteCargaReal
        competencia="2026-11"
        dias={[{ colaboradorId: 'pessoa-1', departamentoId: 'posto-1', data: '2026-11-10', origemDia: 'escala' }]}
        colaboradores={COLABORADORES}
        nomeArquivo="escalas.xlsx"
        departamentos={[]}
        usuarioId="usuario-1"
        podeGerenciar
      />,
    )
    expect(screen.getByRole('button', { name: 'Arquivo Riocard' })).toBeDisabled()
    const botaoConstruir = screen.getByRole('button', { name: 'Construir rascunho' })
    await waitFor(() => expect(botaoConstruir).toBeEnabled())
    fireEvent.click(botaoConstruir)
    await screen.findByText('rascunho')
    expect(screen.getByRole('button', { name: 'Arquivo Riocard' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar lote' }))
    await screen.findByText('confirmado')
    expect(screen.getByRole('button', { name: 'Arquivo Riocard' })).toBeEnabled()
  })

  it('quem não importou nada vê a situação do banco e não consegue construir', async () => {
    render(
      <VtLoteCargaReal competencia={null} dias={[]} colaboradores={COLABORADORES} nomeArquivo={null} departamentos={[]} usuarioId="usuario-2" />,
    )
    expect(await screen.findByText('Nenhuma carga salva no banco')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Construir rascunho' })).toBeDisabled()
  })

  it('grava a escala do relatório junto com o rascunho automático e abre o pop-up ao clicar no nome', async () => {
    escalaBanco.gravacoes.length = 0
    escalaBanco.falhar = false
    const marcas = {
      '2026-12-10': { marca: 'T', local: 'POSTO' },
      '2026-12-11': { marca: 'F', local: 'POSTO' },
    }
    const props = {
      competencia: '2026-12',
      dias: [{ colaboradorId: 'pessoa-1', departamentoId: 'posto-1', data: '2026-12-10', origemDia: 'escala' as const }],
      escala: { competencia: '2026-12', nomeArquivo: 'escalas.xlsx', porColaborador: new Map([['pessoa-1', marcas]]) },
      colaboradores: COLABORADORES,
      nomeArquivo: 'escalas.xlsx',
      departamentos: [{ id: 'posto-1', nome: 'CONDOMINIO POSTO', nome_curto: 'POSTO' }] as never,
      usuarioId: 'usuario-1',
      podeGerenciar: true,
    }
    const { rerender } = render(<VtLoteCargaReal {...props} importacaoSeq={0} />)
    rerender(<VtLoteCargaReal {...props} importacaoSeq={1} />)
    await screen.findByText('rascunho')
    await waitFor(() => expect(escalaBanco.gravacoes.length).toBeGreaterThan(0))
    expect(escalaBanco.gravacoes[0]).toMatchObject({ competencia: '2026-12', nomeArquivo: 'escalas.xlsx', usuarioId: 'usuario-1' })
    expect(screen.queryByTestId('aviso-escala')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver a escala de Pessoa Trabalhou' }))
    expect(await screen.findByRole('heading', { name: /Escala de Pessoa Trabalhou — 12\/2026/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/^10\/12\/2026.*Trabalho \(gera VT\) — posto POSTO/)).toHaveAttribute('data-tipo', 'trabalho_vt')
    expect(screen.getByLabelText(/^11\/12\/2026.*Folga/)).toHaveAttribute('data-tipo', 'folga')
    expect((screen.getByTestId('conta-escala').textContent ?? '').replace(/\u00a0/g, ' ')).toContain('1 dia × R$ 10,00 no posto POSTO = R$ 10,00')
  })

  it('falha ao gravar a escala vira aviso visível sem bloquear o rascunho', async () => {
    escalaBanco.falhar = true
    const props = {
      competencia: '2026-12',
      dias: [{ colaboradorId: 'pessoa-1', departamentoId: 'posto-1', data: '2026-12-10', origemDia: 'escala' as const }],
      escala: { competencia: '2026-12', nomeArquivo: 'escalas.xlsx', porColaborador: new Map([['pessoa-1', {}]]) },
      colaboradores: COLABORADORES,
      nomeArquivo: 'escalas.xlsx',
      departamentos: [],
      usuarioId: 'usuario-1',
      podeGerenciar: true,
    }
    const { rerender } = render(<VtLoteCargaReal {...props} importacaoSeq={0} />)
    rerender(<VtLoteCargaReal {...props} importacaoSeq={1} />)
    expect(await screen.findByTestId('aviso-escala')).toHaveTextContent('Falta aplicar a migration 178')
    expect(await screen.findByText('rascunho')).toBeInTheDocument()
    escalaBanco.falhar = false
  })
})
