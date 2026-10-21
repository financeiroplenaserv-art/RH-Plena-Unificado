import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Perfil } from '@/types/database'
import type { MatCompra, MatCompraItem } from '@/types/materiais'
import { normalizarChegadas } from '@/lib/materiais/chegadas'
import { normalizarSeparacao } from '@/lib/materiais/deposito'

// Smoke do fluxo do depósito da Plena (migration 154): chegada por TOTAL do item na
// aba Chegadas e a aba Separação dos inspetores. Hooks mockados — nada vai ao banco.

const estado = { nivel: 'mesa' as Perfil['nivel_acesso'] }
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
    fornecedores: [{ id: 'essex', nome: 'Essex', ativo: true, entrega_deposito: true }],
    loading: false,
    estruturaPendente: false,
    carregar: vi.fn(),
    salvar: vi.fn(),
  }),
}))

const compraDeposito: MatCompra = {
  id: 'cd', competencia: '2026-10-01', fornecedor_id: 'essex', numero: 'COMP-2026-10-002', tipo: 'mensal', status: 'enviada',
  antes_da_janela: false, data_corte: '2026-10-20T10:00:00Z', entrega_prevista: null, enviada_em: '2026-10-20T10:00:00Z', enviada_por: null,
  cancelada_em: null, cancelada_motivo: null, observacao: null, criado_por: null, created_at: '2026-10-20T10:00:00Z', entrega_deposito: true,
}
const celula = (p: Partial<MatCompraItem>): MatCompraItem =>
  ({
    id: 'x', compra_id: 'cd', item_id: 'rzk', variacao_id: null, contrato_id: 'aba', item_nome: 'RZK 101 5L', variacao_rotulo: null,
    unidade: 'GL', categoria: 'limpeza', contrato_nome: 'Abaeté', rota: 1, quantidade: 3, preco_unitario: 40, qtd_recebida: null,
    motivo_recebimento: null, recebido_em: null, entrega_local: 'posto', ...p,
  }) as MatCompraItem

const registrarChegada = vi.fn(async () => true)
const carregarChegadas = vi.fn()
const carregarItens = vi.fn(async () => [
  celula({ id: 'a' }),
  celula({ id: 'b', contrato_id: 'tel', contrato_nome: 'Telex Sede', rota: 3, quantidade: 2 }),
])
const dadosChegadas = normalizarChegadas({ competencia: '2026-10-01', hoje: '2026-10-21', remanejamentos: [], pedidos: [] })

const sepLinha = (p: Record<string, unknown>) => ({
  linha_id: 'l1', pedido_id: 'p1', competencia: '2026-10-01', contrato_id: 'aba', contrato_nome: 'Abaeté', rota: 1, parte: 'kit',
  item_id: 'rzk', variacao_id: null, item_nome: 'RZK 101 5L', variacao_rotulo: null, unidade: 'GL', qtd_compra: 3, qtd_recebida: 3,
  qtd_separada: null, separado_em: null, separado_por: null, motivo_entrega: null, status_pedido: 'em_compra', compra_id: 'cd',
  compra_numero: 'COMP-2026-10-002', compra_status: 'recebida', competencia_compra: '2026-10-01', fornecedor_nome: 'Essex', ...p,
})
const dadosSeparacao = normalizarSeparacao({
  competencia: '2026-10-01',
  hoje: '2026-10-21',
  linhas: [
    sepLinha({}),
    sepLinha({ linha_id: 'l2', contrato_id: 'mon', contrato_nome: 'Montreal', rota: 0, qtd_compra: 2, qtd_recebida: null }),
  ],
})
const registrarSeparacao = vi.fn(async () => true)
const carregarSeparacao = vi.fn()

vi.mock('@/hooks/useMateriaisCompras', () => ({
  carregarDadosChegadas: vi.fn(async () => dadosChegadas),
  carregarLevarDoDeposito: vi.fn(async () => []),
  useChegadasMateriais: () => ({
    compras: [compraDeposito],
    dados: dadosChegadas,
    loading: false,
    estruturaPendente: false,
    carregar: carregarChegadas,
    carregarItens,
    registrarChegada,
    confirmarRemanejamento: vi.fn(async () => true),
  }),
  useSeparacaoDeposito: () => ({
    dados: dadosSeparacao,
    loading: false,
    estruturaPendente: false,
    carregar: carregarSeparacao,
    registrar: registrarSeparacao,
  }),
}))

import { MateriaisChegadasPage } from './MateriaisChegadasPage'
import { MateriaisSeparacaoPage } from './MateriaisSeparacaoPage'

describe('Depósito Plena (migration 154) — smoke', () => {
  beforeEach(() => {
    estado.nivel = 'mesa'
    registrarChegada.mockClear()
    registrarSeparacao.mockClear()
  })

  it('Chegadas: compra de depósito pede o TOTAL do item e divide entre os postos', async () => {
    render(
      <MemoryRouter initialEntries={['/materiais/chegadas?mes=2026-10&compra=cd']}>
        <Routes>
          <Route path="/materiais/chegadas" element={<MateriaisChegadasPage />} />
        </Routes>
      </MemoryRouter>
    )
    await vi.waitFor(() => expect(screen.getByLabelText('Chegou no depósito — RZK 101 5L')).toBeTruthy())
    expect(screen.getAllByText(/entrega no depósito Plena/).length).toBeGreaterThan(0)
    // sem coluna por contrato: o posto não aparece nesta tela
    expect(screen.queryByText('Telex Sede')).toBeNull()
    // chegou menos sem motivo: avisa e não grava
    fireEvent.change(screen.getByLabelText('Chegou no depósito — RZK 101 5L'), { target: { value: '4' } })
    expect(screen.getByText(/Chegou menos: informe o motivo/)).toBeTruthy()
    fireEvent.click(screen.getByText('Salvar chegada'))
    expect(registrarChegada).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Motivo — RZK 101 5L'), { target: { value: 'faltou no fornecedor' } })
    fireEvent.click(screen.getByText('Salvar chegada'))
    await vi.waitFor(() => expect(registrarChegada).toHaveBeenCalledTimes(1))
    expect((registrarChegada.mock.calls as unknown as unknown[][])[0][1]).toEqual([
      { id: 'a', qtd_recebida: 3, motivo: null },
      { id: 'b', qtd_recebida: 1, motivo: 'faltou no fornecedor' },
    ])
  })

  it('Separação: inspetoria separa por posto; posto que não chegou fica aguardando', async () => {
    estado.nivel = 'inspetoria'
    render(
      <MemoryRouter initialEntries={['/materiais/separacao?mes=2026-10']}>
        <Routes>
          <Route path="/materiais/separacao" element={<MateriaisSeparacaoPage />} />
        </Routes>
      </MemoryRouter>
    )
    await vi.waitFor(() => expect(screen.getByText('Abaeté')).toBeTruthy())
    expect(screen.getByText('Montreal')).toBeTruthy()
    expect(screen.getByText('depósito plena')).toBeTruthy()
    expect(screen.getAllByText('aguardando').length).toBeGreaterThan(0)
    const botoes = screen.getAllByText('Separei tudo')
    fireEvent.click(botoes[0])
    await vi.waitFor(() => expect(registrarSeparacao).toHaveBeenCalledTimes(1))
    expect((registrarSeparacao.mock.calls as unknown as unknown[][])[0][0]).toEqual([{ id: 'l1', qtd: 3, motivo: null }])
  })

  it('Separação: financeiro só consulta (sem botões de gravar)', async () => {
    estado.nivel = 'financeiro'
    render(
      <MemoryRouter initialEntries={['/materiais/separacao?mes=2026-10']}>
        <Routes>
          <Route path="/materiais/separacao" element={<MateriaisSeparacaoPage />} />
        </Routes>
      </MemoryRouter>
    )
    await vi.waitFor(() => expect(screen.getByText('Abaeté')).toBeTruthy())
    expect(screen.queryByText('Separei tudo')).toBeNull()
    expect(screen.queryByText('Salvar separação')).toBeNull()
  })
})
