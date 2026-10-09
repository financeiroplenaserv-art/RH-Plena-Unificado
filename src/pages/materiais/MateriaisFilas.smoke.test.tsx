import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Perfil } from '@/types/database'

// Smoke das filas internas da Fase 1 (pedidos, detalhe, validação, painel,
// sem pedido e CEU → Pedidos). Hooks mockados; foco no que aparece na tela.

// Hooks mockados devolvem SEMPRE o mesmo objeto (como os reais, com useCallback):
// carregar novo a cada render dispararia os useEffect em loop.
function estabilizar<T extends Record<string, unknown>>(modulo: T): T {
  const cache = new Map<string, unknown>()
  const saida: Record<string, unknown> = {}
  for (const [nome, valor] of Object.entries(modulo)) {
    saida[nome] =
      typeof valor === 'function' && nome.startsWith('use')
        ? () => {
            if (!cache.has(nome)) cache.set(nome, (valor as () => unknown)())
            return cache.get(nome)
          }
        : valor
  }
  return saida as T
}

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

vi.mock('@/hooks/useAuth', () => estabilizar({ useAuth: () => ({ user: perfil, loading: false }) }))

const contrato = { id: 'c1', departamento_id: 'd1', nome: 'Abaeté', rota: 2, recebe_limpeza: true, ativo: true, observacao: null }
const departamentos = [{ id: 'd1', nome: 'CONDOMINIO ABAETE', nome_curto: 'ABAETÉ', status: 'Ativo' }]

vi.mock('@/hooks/useMateriaisContratos', () => estabilizar({
  useMateriaisContratos: () => ({
    contratos: [contrato],
    itensNoKit: {},
    statusLinks: {},
    departamentos,
    loading: false,
    estruturaPendente: false,
    carregar: vi.fn(),
    salvar: vi.fn(),
    definirRota: vi.fn(),
  }),
}))

vi.mock('@/hooks/useMateriaisCatalogo', () => estabilizar({
  useMateriaisCatalogo: () => ({
    itens: [{ id: 'i1', nome: 'Detergente neutro', categoria: 'limpeza', unidade_pedido: 'bombona 5L', fornecedor_id: null, validade_meses: null, tem_variacao: false, ativo: true, ordem: null }],
    variacoes: [],
    precos: [],
    loading: false,
    estruturaPendente: false,
    carregar: vi.fn(),
  }),
}))

const pedido = {
  id: 'p1', contrato_id: 'c1', competencia: '2026-10-01', tipo: 'mensal', origem: 'lider', preenchido_pelo_escritorio: false,
  rota_override: null, rota_override_motivo: null, rota_override_por: null, responsavel_nome: 'Maria', observacao: null,
  termos_aceitos: null, status_produtos: 'em_validacao', status_ceu: 'enviado', enviado_em: '2026-10-03T13:00:00Z',
  reaberto_por: null, reaberto_em: null, criado_por: null,
}
const linhaBase = {
  pedido_id: 'p1', repete_linha_id: null, decisao_repeticao: null, item_id: 'i1', variacao_id: null, descricao_livre: null,
  qtd_kit: 2, qtd_validada: null, qtd_aprovada: null, qtd_entregue: null, preco_unitario: 20, excecao_validade: false,
  excecao_fora_kit: false, ultima_entrega_em: null, motivo_ajuste: null, ajustado_por: null, ajustado_em: null,
}
const itens = [
  { ...linhaBase, id: 'l1', envio_id: 'e1', possivel_repeticao: false, qtd_pedida: 4, justificativa: 'Obra no prédio', excecao_acima_kit: true },
  { ...linhaBase, id: 'l2', envio_id: 'e2', possivel_repeticao: true, qtd_pedida: 1, justificativa: null, excecao_acima_kit: false },
]
const envios = [
  { id: 'e1', pedido_id: 'p1', sequencia: 1, origem: 'original', seu_nome: 'Maria', enviado_em: '2026-10-03T13:00:00Z', ip: null, user_agent: null },
  { id: 'e2', pedido_id: 'p1', sequencia: 2, origem: 'complemento', seu_nome: 'João', enviado_em: '2026-10-05T13:00:00Z', ip: null, user_agent: null },
]

vi.mock('@/hooks/useMateriaisPedidos', () => estabilizar({
  useMateriaisPedidos: () => ({ pedidos: [pedido], itens, ceuItens: [], loading: false, estruturaPendente: false, carregar: vi.fn() }),
  usePedidoMaterial: () => ({
    pedido, envios, itens, ceuItens: [], comentarios: [], kit: [], loading: false, estruturaPendente: false,
    carregar: vi.fn(), validar: vi.fn(), aprovar: vi.fn(), comentar: vi.fn(),
  }),
  useMateriaisPainel: () => ({
    linhas: [
      {
        contratoId: 'c1', nome: 'Abaeté', pedidoIds: ['p1'], pedidoMensalId: 'p1', status: ['validado'], valorPedido: 80, limite: 40,
        media6: 35, media12: 30, excedeu: true, diferenca: 40, percentual: 2, preenchidoPeloEscritorio: false, excecoes: 1, aprovavel: true, semPreco: 0,
      },
    ],
    loading: false,
    estruturaPendente: false,
    carregar: vi.fn(),
    aprovarLote: vi.fn(),
  }),
  useMateriaisSemPedido: () => ({
    lista: [{ contrato_id: 'c1', nome: 'Abaeté', departamento_id: 'd1', rota: 2, ultimo_responsavel: 'Maria', link_aberto_no_mes: true, tem_link: true, pedido_id: 'p9' }],
    config: { dia_limite: 15, dia_aviso: 10, aviso_recibo: '' },
    loading: false,
    estruturaPendente: false,
    carregar: vi.fn(),
    preencherPeloKit: vi.fn(),
    reabrir: vi.fn(),
  }),
  criarPedidoExtra: vi.fn(),
}))

vi.mock('@/hooks/useCeuPedidos', () => estabilizar({
  carregarApoioCeu: vi.fn(async () => ({ erro: null, colaboradores: [], departamentos: [], itens: [], tamanhos: [], contratos: [] })),
  useCeuPedidos: () => ({
    linhas: [
      {
        id: 'x1', pedido_id: 'p1', envio_id: 'e1', possivel_repeticao: false, nome_digitado: 'Michele Alves', colaborador_id: null,
        identificado_por: null, identificado_em: null, fora_da_equipe: false, tipo: 'epi', item_id: 'bota', tamanho: '41',
        tamanho_cadastro: null, qtd_pedida: 2, qtd_conferida: null, alerta_tamanho: false, ultima_entrega_em: null,
        cracha_nome: null, cracha_motivo: null, cracha_cordao: null, status: 'a_identificar', conferido_por: null, conferido_em: null,
        atendido_por: null, atendido_em: null, motivo_ajuste: null,
      },
      {
        id: 'x2', pedido_id: 'p1', envio_id: 'e1', possivel_repeticao: false, nome_digitado: 'Ana', colaborador_id: 'k2',
        identificado_por: null, identificado_em: null, fora_da_equipe: false, tipo: 'epi', item_id: 'bota', tamanho: '38',
        tamanho_cadastro: '38', qtd_pedida: 3, qtd_conferida: null, alerta_tamanho: false, ultima_entrega_em: null,
        cracha_nome: null, cracha_motivo: null, cracha_cordao: null, status: 'conferido', conferido_por: null, conferido_em: null,
        atendido_por: null, atendido_em: null, motivo_ajuste: null,
      },
    ],
    pedidos: [pedido],
    envios,
    contratos: [contrato],
    departamentos,
    colaboradores: [
      { id: 'k1', nome_completo: 'Michelle Alves da Silva', departamento_id: 'd1', departamento: null, empresa_id: null, status: 'Ativo' },
      { id: 'k2', nome_completo: 'Ana Souza', departamento_id: 'd1', departamento: null, empresa_id: null, status: 'Ativo' },
    ],
    itens: [{ id: 'bota', nome: 'Botina de segurança', tipo: 'EPI', estoque: 1, prazo_uso_dias: 180 }],
    tamanhos: new Map([['k1', { colaborador_id: 'k1', tamanho_camisa: null, tamanho_calca: null, tamanho_calcado: '40', tamanho_luva: null }]]),
    ultimasEntregas: new Map(),
    loading: false,
    estruturaPendente: false,
    carregar: vi.fn(),
    identificar: vi.fn(),
    conferir: vi.fn(),
    atender: vi.fn(),
  }),
}))

import { MateriaisPedidosPage } from './MateriaisPedidosPage'
import { MateriaisPedidoDetalhePage } from './MateriaisPedidoDetalhePage'
import { MateriaisValidacaoPage } from './MateriaisValidacaoPage'
import { MateriaisPainelPage } from './MateriaisPainelPage'
import { MateriaisSemPedidoPage } from './MateriaisSemPedidoPage'
import { CeuPedidosPage } from '@/pages/ceu/CeuPedidosPage'

function renderizar(componente: React.ReactElement, rota = '/') {
  return render(<MemoryRouter initialEntries={[rota]}>{componente}</MemoryRouter>)
}

describe('Filas de Materiais — smoke test', () => {
  beforeEach(() => {
    sessionStorage.clear()
    perfil.nivel_acesso = 'gestor'
  })

  it('Pedidos do mês: contrato, exceções, repetição e posto pelo nome_curto', () => {
    renderizar(<MateriaisPedidosPage />)
    expect(screen.getByText('Pedidos do mês')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abaeté' })).toBeTruthy()
    expect(screen.getByText('ABAETÉ')).toBeTruthy()
    expect(screen.getByText('1 exceção')).toBeTruthy()
    expect(screen.getByText('repetição')).toBeTruthy()
    // gestor não faz pedido extra (mesa/inspetoria)
    expect(screen.queryByText('Pedido extra')).toBeNull()
  })

  it('Pedidos do mês: inspetoria vê o botão "Pedido extra"', () => {
    perfil.nivel_acesso = 'inspetoria'
    renderizar(<MateriaisPedidosPage />)
    expect(screen.getByText('Pedido extra')).toBeTruthy()
  })

  it('Detalhe: inspetor vê exceção, justificativa, origem e ações de validação', () => {
    render(
      <MemoryRouter initialEntries={['/materiais/pedidos/p1']}>
        <Routes>
          <Route path="/materiais/pedidos/:id" element={<MateriaisPedidoDetalhePage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Acima do kit')).toBeTruthy()
    expect(screen.getByText(/Obra no prédio/)).toBeTruthy()
    expect(screen.getByText('possível repetição')).toBeTruthy()
    expect(screen.getAllByText('Complemento').length).toBeGreaterThan(0)
    expect(screen.getByText('Validar')).toBeTruthy()
    expect(screen.getByText('Devolver ao líder')).toBeTruthy()
    expect(screen.getByLabelText(/Repetição de Detergente/)).toBeTruthy()
  })

  it('Validação: lista o pedido com exceção', () => {
    renderizar(<MateriaisValidacaoPage />)
    expect(screen.getByText('Aguardando validação')).toBeTruthy()
    expect(screen.getByText('Abaeté')).toBeTruthy()
  })

  it('Painel: destaca quem passou do limite', () => {
    renderizar(<MateriaisPainelPage />)
    expect(screen.getByText('acima do limite')).toBeTruthy()
    expect(screen.getByText('200%')).toBeTruthy()
    expect(screen.getByText('Ajustar item a item')).toBeTruthy()
  })

  it('Sem pedido: ações conforme o perfil e aviso de quem só pediu uniforme', () => {
    renderizar(<MateriaisSemPedidoPage />)
    expect(screen.getByText('Contratos que ainda não pediram')).toBeTruthy()
    expect(screen.getByText('Preencher pelo kit')).toBeTruthy()
    expect(screen.getByText('Reabrir link')).toBeTruthy()
    expect(screen.getByText(/faltam os produtos/)).toBeTruthy()
    expect(screen.getByText('abriu, não enviou')).toBeTruthy()
  })

  it('Sem pedido: mesa reabre o link mas não preenche pelo kit', () => {
    perfil.nivel_acesso = 'mesa'
    renderizar(<MateriaisSemPedidoPage />)
    expect(screen.queryByText('Preencher pelo kit')).toBeNull()
    expect(screen.getByText('Reabrir link')).toBeTruthy()
  })

  it('CEU → Pedidos: sugere o colaborador, mostra divergência de tamanho e o que falta comprar', () => {
    renderizar(<CeuPedidosPage />)
    expect(screen.getByText('Michele Alves')).toBeTruthy()
    const select = screen.getByLabelText('Colaborador para Michele Alves') as HTMLSelectElement
    expect(select.value).toBe('k1')
    expect(screen.getByText('Cadastro: 40')).toBeTruthy()
    expect(screen.getByText('Confirmar identificação')).toBeTruthy()
    expect(screen.getByText('O que falta comprar')).toBeTruthy()
    expect(screen.getByLabelText('Atender Ana')).toBeTruthy()
  })
})
