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
  podeMarcarExtraComoPago,
  podeGerenciarVR,
  podeEditarContratoAdicional,
  podeEditarVinculoAdicional,
  podeCriarOcorrencia,
  podeVerDetalhesOcorrencia,
  podeAprovarOcorrencia,
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

  it('somente financeiro pode marcar extra como pago', () => {
    expect(perfisQuePermitem(podeMarcarExtraComoPago).sort()).toEqual(
      ['admin', 'adm', 'financeiro'].sort()
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

  it('somente dp2 e mesa editam vínculos', () => {
    expect(perfisQuePermitem(podeEditarVinculoAdicional).sort()).toEqual(
      ['admin', 'adm', 'dp2', 'mesa'].sort()
    )
  })
})

describe('Permissões de ocorrências', () => {
  it('gestor, rh, dp1, dp2 e mesa criam ocorrências', () => {
    expect(perfisQuePermitem(podeCriarOcorrencia).sort()).toEqual(
      ['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa'].sort()
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
