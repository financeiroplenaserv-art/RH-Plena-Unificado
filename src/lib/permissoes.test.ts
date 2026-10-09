import { describe, it, expect, beforeEach } from 'vitest'
import type { NivelAcesso } from '@/types/database'
import {
  podeEditarEmpresa,
  podeExcluirEmpresa,
  podeEditarDepartamento,
  podeExcluirDepartamento,
  podeEditarColaboradorBasico,
  podeEditarColaboradorCompleto,
  podeCadastrarColaborador,
  podeEditarExtra,
  podeExcluirExtra,
  podeMarcarExtraComoPago,
  podeGerenciarVR,
  podeEditarContratoAdicional,
  podeEditarVinculoAdicional,
  podeCriarOcorrencia,
  podeVerDetalhesOcorrencia,
  podeAprovarOcorrencia,
  podeEmitirCrachaCEU,
  podeConferirPedidoCEU,
  podeAtenderPedidoCEU,
  podeEditarCatalogoMateriais,
  podeGerenciarFornecedoresMateriais,
  podeEditarKitMateriais,
  podeEditarRotaMateriais,
  podeAlterarRotaPedidoMateriais,
  podeSolicitarAlteracaoKit,
  podeDecidirAlteracaoKit,
  podeGerenciarLinksMateriais,
  podeVerSemPedidoMateriais,
  podePreencherPeloKitMateriais,
  podeValidarMateriais,
  podeAprovarMateriais,
  podeCriarPedidoExtraMateriais,
  podeReabrirPedidoMateriais,
  podeRegistrarEntregaCEU,
  podeValidarOcorrencia,
  podeCancelarOcorrencia,
  podeGerenciarModelosOcorrencia,
  podeGerenciarAlertas,
  podeVerConfiguracoes,
  podeConfigurarTokenEContador,
  podeVerAuditoria,
  verificarPermissao,
  setPermissoesCache,
  getPermissoesCache,
} from './permissoes'

import type { PermissaoPerfil } from '@/types/database'

const PERFIS: NivelAcesso[] = [
  'admin',
  'adm',
  'gestor',
  'rh',
  'dp1',
  'dp2',
  'dp3',
  'mesa',
  'inspetoria',
  'financeiro',
  'visualizador',
]

function perfisQuePermitem(fn: (p: NivelAcesso) => boolean): NivelAcesso[] {
  return PERFIS.filter(fn)
}

describe('Permissões de dados mestres', () => {
  it('somente adm pode excluir empresa', () => {
    expect(perfisQuePermitem(podeExcluirEmpresa)).toEqual(['admin', 'adm'])
  })

  it('gestor, dp e financeiro podem editar empresa', () => {
    expect(perfisQuePermitem(podeEditarEmpresa).sort()).toEqual(
      ['admin', 'adm', 'gestor', 'dp1', 'dp2', 'financeiro'].sort()
    )
  })

  it('gestor, dp, mesa e financeiro podem editar departamento', () => {
    expect(perfisQuePermitem(podeEditarDepartamento).sort()).toEqual(
      ['admin', 'adm', 'gestor', 'dp1', 'dp2', 'mesa', 'financeiro'].sort()
    )
  })

  it('somente adm, gestor e financeiro podem excluir departamento', () => {
    expect(perfisQuePermitem(podeExcluirDepartamento).sort()).toEqual(
      ['admin', 'adm', 'gestor', 'financeiro'].sort()
    )
  })
})

describe('Permissões de colaboradores', () => {
  it('visualizador não edita colaborador', () => {
    expect(podeEditarColaboradorBasico('visualizador')).toBe(false)
    expect(podeEditarColaboradorCompleto('visualizador')).toBe(false)
    expect(podeCadastrarColaborador('visualizador')).toBe(false)
  })

  it('mesa edita dados básicos mas não completos', () => {
    expect(podeEditarColaboradorBasico('mesa')).toBe(true)
    expect(podeEditarColaboradorCompleto('mesa')).toBe(false)
  })

  it('rh e dp editam dados completos', () => {
    expect(podeEditarColaboradorCompleto('rh')).toBe(true)
    expect(podeEditarColaboradorCompleto('dp1')).toBe(true)
    expect(podeEditarColaboradorCompleto('dp2')).toBe(true)
  })
})

describe('Permissões de extras', () => {
  it('somente mesa e inspetoria editam extras', () => {
    expect(perfisQuePermitem(podeEditarExtra).sort()).toEqual(
      ['admin', 'adm', 'mesa', 'inspetoria'].sort()
    )
  })

  it('somente mesa e inspetoria excluem extras (lançamento errado)', () => {
    expect(perfisQuePermitem(podeExcluirExtra).sort()).toEqual(
      ['admin', 'adm', 'mesa', 'inspetoria'].sort()
    )
  })

  it('financeiro e inspetoria podem marcar extra como pago', () => {
    expect(perfisQuePermitem(podeMarcarExtraComoPago).sort()).toEqual(
      ['admin', 'adm', 'financeiro', 'inspetoria'].sort()
    )
  })
})

describe('Permissões de VR', () => {
  it('somente adm e dp2 gerenciam VR', () => {
    expect(perfisQuePermitem(podeGerenciarVR).sort()).toEqual(
      ['admin', 'adm', 'dp2'].sort()
    )
  })
})

describe('Permissões de adicionais contratuais', () => {
  it('gestor, dp2, mesa e financeiro editam contratos', () => {
    expect(perfisQuePermitem(podeEditarContratoAdicional).sort()).toEqual(
      ['admin', 'adm', 'gestor', 'dp2', 'mesa', 'financeiro'].sort()
    )
  })

  it('dp1, dp2 e mesa editam vínculos', () => {
    expect(perfisQuePermitem(podeEditarVinculoAdicional).sort()).toEqual(
      ['admin', 'adm', 'dp1', 'dp2', 'mesa'].sort()
    )
  })
})

describe('Permissões de ocorrências', () => {
  it('gestor, rh, dp1, dp2, mesa e financeiro criam ocorrências', () => {
    expect(perfisQuePermitem(podeCriarOcorrencia).sort()).toEqual(
      ['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'financeiro'].sort()
    )
  })

  it('inspetoria pode ver detalhes da ocorrência', () => {
    expect(podeVerDetalhesOcorrencia('inspetoria')).toBe(true)
  })

  it('visualizador não vê detalhes da ocorrência', () => {
    expect(podeVerDetalhesOcorrencia('visualizador')).toBe(false)
  })

  it('somente gestor, rh, dp1 e dp2 aprovam ocorrência', () => {
    expect(perfisQuePermitem(podeAprovarOcorrencia).sort()).toEqual(
      ['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2'].sort()
    )
  })

  it('somente admin, adm, dp1 e dp2 validam documentos da ocorrência', () => {
    expect(perfisQuePermitem(podeValidarOcorrencia).sort()).toEqual(
      ['admin', 'adm', 'dp1', 'dp2'].sort()
    )
  })

  it('mesa pode cancelar ocorrência, mas dp2 não', () => {
    expect(podeCancelarOcorrencia('mesa')).toBe(true)
    expect(podeCancelarOcorrencia('dp2')).toBe(false)
  })
})

describe('Permissões de modelos, alertas e configurações', () => {
  it('somente gestor, rh, dp1 e dp2 gerenciam modelos', () => {
    expect(perfisQuePermitem(podeGerenciarModelosOcorrencia).sort()).toEqual(
      ['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2'].sort()
    )
  })

  it('somente dp1 gerencia alertas', () => {
    expect(perfisQuePermitem(podeGerenciarAlertas).sort()).toEqual(
      ['admin', 'adm', 'dp1'].sort()
    )
  })

  it('somente gestor vê configurações e auditoria', () => {
    expect(perfisQuePermitem(podeVerConfiguracoes).sort()).toEqual(
      ['admin', 'adm', 'gestor'].sort()
    )
    expect(perfisQuePermitem(podeVerAuditoria).sort()).toEqual(
      ['admin', 'adm', 'gestor'].sort()
    )
  })

  it('somente dp2 configura token do e-Contador', () => {
    expect(perfisQuePermitem(podeConfigurarTokenEContador).sort()).toEqual(
      ['admin', 'adm', 'dp2'].sort()
    )
  })
})

describe('Cache de permissões dinâmicas', () => {
  beforeEach(() => {
    setPermissoesCache([])
  })

  it('getPermissoesCache retorna o cache atual', () => {
    expect(getPermissoesCache()).toEqual([])
    const permissoes: PermissaoPerfil[] = [
      { perfil: 'visualizador', recurso: 'ocorrencia', acao: 'ver_detalhes', permitido: true },
    ]
    setPermissoesCache(permissoes)
    expect(getPermissoesCache()).toEqual(permissoes)
  })

  it('admin e adm sempre têm permissão, mesmo com cache vazio', () => {
    expect(verificarPermissao('admin', 'qualquer', 'acao')).toBe(true)
    expect(verificarPermissao('adm', 'qualquer', 'acao')).toBe(true)
  })

  it('verificarPermissao retorna false quando cache está vazio e perfil não é admin', () => {
    expect(verificarPermissao('visualizador', 'ocorrencia', 'criar')).toBe(false)
    expect(verificarPermissao('rh', 'configuracoes', 'ver')).toBe(false)
  })

  it('verificarPermissao respeita permissão explícita positiva no cache', () => {
    setPermissoesCache([
      { perfil: 'visualizador', recurso: 'ocorrencia', acao: 'ver_detalhes', permitido: true },
    ])
    expect(verificarPermissao('visualizador', 'ocorrencia', 'ver_detalhes')).toBe(true)
  })

  it('verificarPermissao respeita permissão explícita negativa no cache', () => {
    setPermissoesCache([
      { perfil: 'rh', recurso: 'ocorrencia', acao: 'criar', permitido: false },
    ])
    expect(verificarPermissao('rh', 'ocorrencia', 'criar')).toBe(false)
  })

  it('permissão "todos" concede acesso genérico ao perfil', () => {
    setPermissoesCache([
      { perfil: 'mesa', recurso: 'todos', acao: 'todos', permitido: true },
    ])
    expect(verificarPermissao('mesa', 'qualquer', 'acao')).toBe(true)
  })

  it('permissão "todos" negada bloqueia acesso genérico do perfil', () => {
    setPermissoesCache([
      { perfil: 'mesa', recurso: 'todos', acao: 'todos', permitido: false },
    ])
    expect(verificarPermissao('mesa', 'qualquer', 'acao')).toBe(false)
  })

  it('fallback hardcoded é usado quando não há regra no cache', () => {
    // rh tem fallback true para editar colaborador básico
    expect(podeEditarColaboradorBasico('rh')).toBe(true)
  })

  it('permissão negada no cache prevalece sobre fallback hardcoded', () => {
    setPermissoesCache([
      { perfil: 'rh', recurso: 'colaborador', acao: 'editar_basico', permitido: false },
    ])
    expect(podeEditarColaboradorBasico('rh')).toBe(false)
  })

  it('permissão positiva no cache prevalece sobre fallback hardcoded negativo', () => {
    // visualizador normalmente não pode criar ocorrência (fallback false)
    setPermissoesCache([
      { perfil: 'visualizador', recurso: 'ocorrencia', acao: 'criar', permitido: true },
    ])
    expect(podeCriarOcorrencia('visualizador')).toBe(true)
  })

  it('setPermissoesCache altera comportamento subsequente de verificarPermissao', () => {
    expect(verificarPermissao('dp1', 'auditoria', 'ver')).toBe(false)
    setPermissoesCache([
      { perfil: 'dp1', recurso: 'auditoria', acao: 'ver', permitido: true },
    ])
    expect(verificarPermissao('dp1', 'auditoria', 'ver')).toBe(true)
  })
})

describe('Emissão de crachás (ceu.emitir_cracha) e perfil dp3', () => {
  beforeEach(() => {
    setPermissoesCache([])
  })

  it('admin, adm, dp2, mesa e dp3 emitem crachás; os demais não', () => {
    expect(perfisQuePermitem(podeEmitirCrachaCEU).sort()).toEqual(['admin', 'adm', 'dp2', 'dp3', 'mesa'].sort())
  })

  it('dp3 não tem nenhuma outra permissão relevante no mapa padrão', () => {
    expect(podeRegistrarEntregaCEU('dp3')).toBe(false)
    expect(podeEditarColaboradorBasico('dp3')).toBe(false)
    expect(podeCriarOcorrencia('dp3')).toBe(false)
    expect(podeEditarExtra('dp3')).toBe(false)
    expect(podeGerenciarVR('dp3')).toBe(false)
    expect(podeVerAuditoria('dp3')).toBe(false)
    expect(verificarPermissao('dp3', 'rota', 'ceu')).toBe(false)
    expect(verificarPermissao('dp3', 'menu', 'dashboard')).toBe(false)
  })

  it('linhas dinâmicas do dp3 (migration 117) liberam só rota/menu de crachás', () => {
    setPermissoesCache([
      { perfil: 'dp3', recurso: 'ceu', acao: 'emitir_cracha', permitido: true },
      { perfil: 'dp3', recurso: 'menu', acao: 'crachas', permitido: true },
    ])
    expect(verificarPermissao('dp3', 'ceu', 'emitir_cracha')).toBe(true)
    expect(verificarPermissao('dp3', 'menu', 'crachas')).toBe(true)
    expect(verificarPermissao('dp3', 'rota', 'ceu')).toBe(false)
    expect(verificarPermissao('dp3', 'menu', 'ceu')).toBe(false)
  })

  it('revogar no cache (tela Permissões) prevalece sobre o padrão', () => {
    setPermissoesCache([{ perfil: 'dp2', recurso: 'ceu', acao: 'emitir_cracha', permitido: false }])
    expect(podeEmitirCrachaCEU('dp2')).toBe(false)
  })
})

describe('Permissões do módulo Materiais (migrations 121 a 123)', () => {
  beforeEach(() => setPermissoesCache([]))

  const comAdm = (...ps: NivelAcesso[]) => ['admin', 'adm', ...ps].sort()

  it('catálogo, kit, decisão de kit e links: só gestor (além de admin/adm)', () => {
    for (const fn of [
      podeEditarCatalogoMateriais,
      podeEditarKitMateriais,
      podeDecidirAlteracaoKit,
      podeGerenciarLinksMateriais,
      podeAprovarMateriais,
    ]) {
      expect(perfisQuePermitem(fn).sort()).toEqual(comAdm('gestor'))
    }
  })

  it('rota padrão, rota do pedido e reabertura: gestor e mesa', () => {
    for (const fn of [podeEditarRotaMateriais, podeAlterarRotaPedidoMateriais, podeReabrirPedidoMateriais]) {
      expect(perfisQuePermitem(fn).sort()).toEqual(comAdm('gestor', 'mesa'))
    }
  })

  it('solicitar alteração de kit e pedido extra: mesa e inspetoria (gestor não)', () => {
    for (const fn of [podeSolicitarAlteracaoKit, podeCriarPedidoExtraMateriais]) {
      expect(perfisQuePermitem(fn).sort()).toEqual(comAdm('mesa', 'inspetoria'))
    }
  })

  it('validar e preencher pelo kit: gestor e inspetoria; lista "sem pedido" inclui a mesa', () => {
    expect(perfisQuePermitem(podeValidarMateriais).sort()).toEqual(comAdm('gestor', 'inspetoria'))
    expect(perfisQuePermitem(podePreencherPeloKitMateriais).sort()).toEqual(comAdm('gestor', 'inspetoria'))
    expect(perfisQuePermitem(podeVerSemPedidoMateriais).sort()).toEqual(comAdm('gestor', 'inspetoria', 'mesa'))
  })

  it('aba CEU → Pedidos: inspetor confere, Beth (dp2) atende', () => {
    expect(perfisQuePermitem(podeConferirPedidoCEU).sort()).toEqual(comAdm('gestor', 'inspetoria'))
    expect(perfisQuePermitem(podeAtenderPedidoCEU).sort()).toEqual(comAdm('gestor', 'dp2'))
  })

  it('dp3 e visualizador não têm nenhuma ação de Materiais', () => {
    for (const fn of [
      podeEditarCatalogoMateriais,
      podeValidarMateriais,
      podeCriarPedidoExtraMateriais,
      podeVerSemPedidoMateriais,
    ]) {
      expect(fn('dp3')).toBe(false)
      expect(fn('visualizador')).toBe(false)
    }
  })

  it('fornecedores: mesa cadastra (decisão de 09/10/2026); catálogo segue só gestor; dp1/dp2 ainda não', () => {
    expect(podeGerenciarFornecedoresMateriais('gestor')).toBe(true)
    expect(podeGerenciarFornecedoresMateriais('mesa')).toBe(true)
    expect(podeGerenciarFornecedoresMateriais('admin')).toBe(true)
    for (const p of ['dp1', 'dp2', 'inspetoria', 'rh', 'financeiro', 'visualizador', 'dp3'] as const) {
      expect(podeGerenciarFornecedoresMateriais(p)).toBe(false)
    }
    expect(podeEditarCatalogoMateriais('mesa')).toBe(false)
  })

  it('linha dinâmica concedida pela tela Permissões prevalece sobre o padrão', () => {
    setPermissoesCache([{ perfil: 'rh', recurso: 'materiais', acao: 'ver_sem_pedido', permitido: true }])
    expect(podeVerSemPedidoMateriais('rh')).toBe(true)
  })
})
