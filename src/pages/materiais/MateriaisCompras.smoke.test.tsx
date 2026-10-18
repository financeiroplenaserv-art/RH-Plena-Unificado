import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Perfil } from '@/types/database'
import type { MatCompra, MatCompraItem } from '@/types/materiais'
import { normalizarPrevia } from '@/lib/materiais/compra'

// Smoke das telas da Fase 2 (Compras e detalhe da compra) e dos botões da
// carta ao líder. Hooks mockados — nada vai ao banco.

const estado = { nivel: 'gestor' as Perfil['nivel_acesso'], pendente: false }
const perfil = (): Perfil => ({
  id: 'u1',
  email: 'x@example.com',
  nome: 'Teste',
  nivel_acesso: estado.nivel,
  empresa_id: null,
  consentimento_lgpd: true,
  consentimento_lgpd_data: null,
  consentimento_lgpd_versao: null,
  consentimento_lgpd_finalidades: null,
  created_at: '2026-01-01T00:00:00Z',
})

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: perfil(), loading: false }) }))
vi.mock('@/hooks/useMateriaisFornecedores', () => ({
  useMateriaisFornecedores: () => ({
    fornecedores: [
      { id: 'antolimp', nome: 'Antolimp', ativo: true },
      { id: 'contecom', nome: 'Contecom', ativo: true },
    ],
    loading: false,
    estruturaPendente: false,
    carregar: vi.fn(),
    salvar: vi.fn(),
  }),
}))

const linhaPrevia = (p: Record<string, unknown>) => ({
  linha_id: 'l1', pedido_id: 'p1', pedido_tipo: 'mensal', competencia: '2026-10-01', status_pedido: 'aprovado',
  contrato_id: 'c1', contrato_nome: 'Abaeté', rota: 1, parte: 'kit', item_id: 'cloro', variacao_id: null,
  descricao_livre: null, item_nome: 'Cloro 5L', variacao_rotulo: null, unidade: 'GL', categoria: 'limpeza', ordem: 1,
  preparo_escritorio: false, qtd_aprovada: 4, preco_pedido: 10, preco_vigente: 12, fornecedor_padrao_id: 'antolimp',
  fornecedor_padrao_nome: 'Antolimp', saldo_estoque: 0, created_at: '2026-10-05T10:00:00Z', ...p,
})
const previa = normalizarPrevia({
  competencia: '2026-10-01',
  hoje: '2026-10-18',
  linhas: [
    linhaPrevia({}),
    linhaPrevia({ linha_id: 'l2', contrato_id: 'c2', contrato_nome: 'Telex Sede', rota: 3, qtd_aprovada: 2, parte: 'extra' }),
    linhaPrevia({ linha_id: 'l3', item_id: 'livro', item_nome: 'Livro de Ocorrências', preparo_escritorio: true, fornecedor_padrao_id: null, qtd_aprovada: 1 }),
  ],
  pendentes: [{ pedido_id: 'p9', contrato_id: 'c9', contrato_nome: 'Vila de Cascais', status_pedido: 'em_validacao', linhas_pendentes: 3 }],
  escritorio: [{ item_id: 'livro', item_nome: 'Livro de Ocorrências', unidade: 'UN', total_aprovado: 1, total_pendente: 2, separado: 0, contratos: 1 }],
  contratos_sem_rota: 0,
  ultima_contagem: null,
  dia_inicio_compra: 20,
  dia_fim_compra: 25,
  dia_limite_aprovacao: 20,
})
const gerar = vi.fn(async () => ({ linhas: 3, compras: [] }))
const compra: MatCompra = {
  id: 'comp1', competencia: '2026-10-01', fornecedor_id: 'antolimp', numero: 'COMP-2026-10-001', tipo: 'mensal', status: 'rascunho',
  antes_da_janela: true, data_corte: '2026-10-18T10:00:00Z', entrega_prevista: null, enviada_em: null, enviada_por: null,
  cancelada_em: null, cancelada_motivo: null, observacao: null, criado_por: null, created_at: '2026-10-18T10:00:00Z',
}
const celula = (p: Partial<MatCompraItem>): MatCompraItem => ({
  id: Math.random().toString(36), compra_id: 'comp1', item_id: 'cloro', variacao_id: null, contrato_id: 'c1', item_nome: 'Cloro 5L',
  variacao_rotulo: null, unidade: 'GL', categoria: 'limpeza', contrato_nome: 'Abaeté', rota: 1, quantidade: 4, preco_unitario: 12,
  qtd_recebida: null, motivo_recebimento: null, recebido_em: null, entrega_local: 'posto', ...p,
})

vi.mock('@/hooks/useMateriaisCompras', () => ({
  useMateriaisCompras: () => ({ previa, compras: [compra], loading: false, estruturaPendente: estado.pendente, carregar: vi.fn(), gerar }),
  useCompraMaterial: () => ({
    compra,
    itens: [celula({}), celula({ contrato_id: 'c2', contrato_nome: 'Telex Sede', rota: 3, quantidade: 2 })],
    loading: false,
    estruturaPendente: estado.pendente,
    carregar: vi.fn(),
    enviar: vi.fn(async () => true),
    cancelar: vi.fn(async () => true),
  }),
}))
vi.mock('@/hooks/useCartaLider', () => ({ useCartaLider: () => ({ gerando: false, montar: vi.fn(async () => []) }) }))

import { MateriaisComprasPage } from './MateriaisComprasPage'
import { MateriaisCompraDetalhePage } from './MateriaisCompraDetalhePage'

describe('Compras (Fase 2) — smoke', () => {
  beforeEach(() => {
    estado.nivel = 'gestor'
    estado.pendente = false
    gerar.mockClear()
  })

  it('comprador vê a prévia agrupada, os avisos (sem trava) e gera os rascunhos', async () => {
    render(
      <MemoryRouter>
        <MateriaisComprasPage />
      </MemoryRouter>
    )
    expect(screen.getByText('Cloro 5L')).toBeTruthy()
    expect(screen.getByText(/Ainda não é o dia da compra/)).toBeTruthy()
    expect(screen.getByText(/1 contrato\(s\) com extras aguardando/)).toBeTruthy()
    expect(screen.getByText(/O estoque ainda não foi contado/)).toBeTruthy()
    expect(screen.getAllByText('Livro de Ocorrências').length).toBeGreaterThan(0)
    expect(screen.getByText(/Lista do escritório/)).toBeTruthy()
    expect(screen.getByText('COMP-2026-10-001')).toBeTruthy()
    expect(screen.getByText('gerada antes do dia da compra')).toBeTruthy()
    fireEvent.click(screen.getByText('Gerar pedidos aos fornecedores'))
    expect(screen.getByText('Gerar pedidos aos fornecedores?')).toBeTruthy()
    fireEvent.click(screen.getByText('Gerar rascunhos'))
    await vi.waitFor(() => expect(gerar).toHaveBeenCalledTimes(1))
    const calls = gerar.mock.calls as unknown as unknown[][]
    const payload = calls[0][2] as { id: string; qtd_compra?: number; fornecedor_id?: string }[]
    expect(payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'l1', qtd_compra: 4, fornecedor_id: 'antolimp' }),
        expect.objectContaining({ id: 'l2', qtd_compra: 2 }),
        { id: 'l3' },
      ])
    )
  })

  it('financeiro só consulta: sem botão de gerar nem de carta', () => {
    estado.nivel = 'financeiro'
    render(
      <MemoryRouter>
        <MateriaisComprasPage />
      </MemoryRouter>
    )
    expect(screen.getByText('Cloro 5L')).toBeTruthy()
    expect(screen.queryByText('Gerar pedidos aos fornecedores')).toBeNull()
    expect(screen.queryByText(/Cartas aos líderes/)).toBeNull()
  })

  it('detalhe: matriz por rota, totais e ações do rascunho', () => {
    render(
      <MemoryRouter initialEntries={['/materiais/compras/comp1']}>
        <Routes>
          <Route path="/materiais/compras/:id" element={<MateriaisCompraDetalhePage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Compra COMP-2026-10-001')).toBeTruthy()
    expect(screen.getByText('Rota 1')).toBeTruthy()
    expect(screen.getByText('Rota 3')).toBeTruthy()
    expect(screen.getByText('Telex Sede')).toBeTruthy()
    expect(screen.getByText('Baixar Excel')).toBeTruthy()
    expect(screen.getByText('Baixar com valores')).toBeTruthy()
    expect(screen.getByText('Marcar como enviada')).toBeTruthy()
    expect(screen.getAllByText('6').length).toBeGreaterThan(0)
  })

  it('sem a migration, aviso de preparação', () => {
    estado.pendente = true
    render(
      <MemoryRouter>
        <MateriaisComprasPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/Módulo em preparação/)).toBeTruthy()
  })
})
