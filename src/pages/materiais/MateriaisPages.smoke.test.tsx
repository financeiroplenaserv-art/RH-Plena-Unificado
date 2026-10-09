import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Perfil } from '@/types/database'

const perfil: Perfil = {
  id: 'u1',
  email: 'gestor@example.com',
  nome: 'Gestor Teste',
  nivel_acesso: 'gestor',
  empresa_id: null,
  consentimento_lgpd: true,
  consentimento_lgpd_data: null,
  consentimento_lgpd_versao: null,
  consentimento_lgpd_finalidades: null,
  created_at: '2026-01-01T00:00:00Z',
}

// Estado compartilhado dos mocks: cada teste decide se a estrutura existe.
const estado = { pendente: false }

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: perfil, loading: false }),
}))

vi.mock('@/hooks/useMateriaisCatalogo', () => ({
  useMateriaisCatalogo: () => ({
    itens: [
      { id: 'i1', nome: 'Detergente neutro', categoria: 'limpeza', unidade_pedido: 'bombona 5L', fornecedor_id: 'f1', validade_meses: null, tem_variacao: false, ativo: true, ordem: null },
    ],
    variacoes: [],
    precos: [{ id: 'p1', item_id: 'i1', variacao_id: null, fornecedor_id: null, preco: 20, vigente_desde: '2026-01-01' }],
    loading: false,
    estruturaPendente: estado.pendente,
    carregar: vi.fn(),
    salvarItem: vi.fn(),
    salvarVariacao: vi.fn(),
    alternarVariacao: vi.fn(),
    registrarPreco: vi.fn(),
  }),
}))

vi.mock('@/hooks/useMateriaisFornecedores', () => ({
  useMateriaisFornecedores: () => ({
    fornecedores: [{ id: 'f1', nome: 'Fornecedor Alfa', cnpj: null, telefone: null, email: null, ativo: true }],
    loading: false,
    estruturaPendente: estado.pendente,
    carregar: vi.fn(),
    salvar: vi.fn(),
  }),
}))

vi.mock('@/hooks/useMateriaisContratos', () => ({
  useMateriaisContratos: () => ({
    contratos: [
      { id: 'c1', departamento_id: 'd1', nome: 'Telex Sede', rota: 2, recebe_limpeza: true, ativo: true, observacao: null },
      { id: 'c2', departamento_id: 'd1', nome: 'Telex Barra/Tij/Ipa', rota: 1, recebe_limpeza: true, ativo: true, observacao: null },
    ],
    itensNoKit: { c1: 1 },
    statusLinks: { c1: { contrato_id: 'c1', gerado_em: '2026-10-09T12:00:00Z', gerado_por: null, versao: 1, ativo: true } },
    departamentos: [{ id: 'd1', nome: 'CENTRO AUDITIVO TELEX LTDA', nome_curto: 'TELEX', status: 'Ativo' }],
    loading: false,
    estruturaPendente: estado.pendente,
    carregar: vi.fn(),
    salvar: vi.fn(),
    definirRota: vi.fn(),
  }),
}))

vi.mock('@/hooks/useMateriaisKit', () => ({
  useMateriaisKit: () => ({
    kit: [{ id: 'k1', contrato_id: 'c1', item_id: 'i1', variacao_id: null, quantidade: 3, periodicidade_meses: 1, observacao: null }],
    consumos: [],
    loading: false,
    estruturaPendente: estado.pendente,
    carregar: vi.fn(),
    salvarLinha: vi.fn(),
    removerLinha: vi.fn(),
    solicitarAlteracao: vi.fn(),
  }),
  useMateriaisAlteracoesKit: () => ({
    alteracoes: [
      {
        id: 'a1', contrato_id: 'c1', item_id: 'i1', variacao_id: null, quantidade_nova: 4, motivo: 'Mais um andar',
        solicitado_em: '2026-10-01T12:00:00Z', status: 'pendente', decidido_por: null, decidido_em: null, comentario_decisao: null,
      },
    ],
    loading: false,
    estruturaPendente: estado.pendente,
    carregar: vi.fn(),
    decidir: vi.fn(),
  }),
}))

import { setPermissoesCache } from '@/lib/permissoes'
import { MateriaisContratosPage } from './MateriaisContratosPage'
import { MateriaisKitPage } from './MateriaisKitPage'
import { MateriaisCatalogoPage } from './MateriaisCatalogoPage'
import { MateriaisFornecedoresPage } from './MateriaisFornecedoresPage'
import { MateriaisAlteracoesKitPage } from './MateriaisAlteracoesKitPage'

function renderizar(componente: React.ReactElement, rota = '/') {
  return render(<MemoryRouter initialEntries={[rota]}>{componente}</MemoryRouter>)
}

describe('Páginas Materiais — smoke test', () => {
  beforeEach(() => {
    estado.pendente = false
    sessionStorage.clear()
  })

  it('Contratos: lista vários contratos do mesmo departamento pelo nome_curto', () => {
    renderizar(<MateriaisContratosPage />)
    expect(screen.getByText('Contratos de pedido')).toBeTruthy()
    expect(screen.getByText('Telex Sede')).toBeTruthy()
    expect(screen.getAllByText('TELEX')).toHaveLength(2)
    expect(screen.getByText('Aplicar')).toBeTruthy()
    // Gestor gerencia o link/QR do líder; situação do link na coluna Link.
    expect(screen.getByLabelText('Link e QR code de Telex Sede')).toBeTruthy()
    expect(screen.queryByText('Revogado')).toBeNull()
  })

  it('Kit Mensal: mostra o limite em R$ (kit × preço vigente)', () => {
    renderizar(<MateriaisKitPage />, '/materiais/kit?contrato=c1')
    expect(screen.getAllByText('Kit Mensal').length).toBeGreaterThan(0)
    expect(screen.getByText('Detergente neutro')).toBeTruthy()
    // 3 × R$ 20,00 = R$ 60,00 (limite e subtotal)
    expect(screen.getAllByText(/R\$\s*60,00/).length).toBeGreaterThanOrEqual(2)
  })

  it('Catálogo: lista itens com preço vigente', () => {
    renderizar(<MateriaisCatalogoPage />)
    expect(screen.getByText('Catálogo de materiais')).toBeTruthy()
    expect(screen.getByText('Detergente neutro')).toBeTruthy()
    expect(screen.getByText(/R\$\s*20,00/)).toBeTruthy()
  })

  it('Fornecedores: lista o cadastro único', () => {
    renderizar(<MateriaisFornecedoresPage />)
    expect(screen.getAllByText('Fornecedores').length).toBeGreaterThan(0)
    expect(screen.getByText('Fornecedor Alfa')).toBeTruthy()
  })

  it('Alterações de kit: gestor vê os botões de decisão', () => {
    renderizar(<MateriaisAlteracoesKitPage />)
    expect(screen.getByText('Mais um andar')).toBeTruthy()
    expect(screen.getByText('Aprovar')).toBeTruthy()
  })

  it('shell: sem rota.materiais (dp2/financeiro) só aparece a aba Fornecedores', () => {
    setPermissoesCache([])
    const { unmount } = renderizar(<MateriaisFornecedoresPage />)
    expect(screen.queryByRole('link', { name: /Catálogo/ })).toBeNull()
    expect(screen.getByRole('link', { name: /Fornecedores/ })).toBeTruthy()
    unmount()
    setPermissoesCache([{ perfil: 'gestor', recurso: 'rota', acao: 'materiais', permitido: true }])
    renderizar(<MateriaisFornecedoresPage />)
    expect(screen.getByRole('link', { name: /Catálogo/ })).toBeTruthy()
    setPermissoesCache([])
  })

  it('sem as tabelas no banco, todas as telas mostram o aviso de preparação', () => {
    estado.pendente = true
    for (const [Pagina, rota] of [
      [MateriaisContratosPage, '/'],
      [MateriaisKitPage, '/materiais/kit?contrato=c1'],
      [MateriaisCatalogoPage, '/'],
      [MateriaisFornecedoresPage, '/'],
      [MateriaisAlteracoesKitPage, '/'],
    ] as const) {
      const { unmount } = renderizar(<Pagina />, rota)
      expect(screen.getByText(/Módulo em preparação/)).toBeTruthy()
      unmount()
    }
  })
})
