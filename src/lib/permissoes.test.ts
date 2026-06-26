import { describe, it, expect } from 'vitest'
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
} from './permissoes'

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
