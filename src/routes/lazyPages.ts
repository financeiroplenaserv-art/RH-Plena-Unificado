import { lazy, type ComponentType } from 'react'

function lazyNamed<T extends Record<string, ComponentType<unknown>>>(
  factory: () => Promise<T>,
  name: keyof T
) {
  return lazy(() => factory().then((mod) => ({ default: mod[name] as ComponentType<unknown> })))
}

// RH
export const OcorrenciasPage = lazyNamed(() => import('@/pages/rh/OcorrenciasPage'), 'OcorrenciasPage')
export const OcorrenciaFormPage = lazyNamed(() => import('@/pages/rh/OcorrenciaFormPage'), 'OcorrenciaFormPage')
export const OcorrenciaDetailPage = lazyNamed(() => import('@/pages/rh/OcorrenciaDetailPage'), 'OcorrenciaDetailPage')
export const ColaboradorDetailPage = lazyNamed(() => import('@/pages/rh/ColaboradorDetailPage'), 'ColaboradorDetailPage')
export const ColaboradorFormPage = lazyNamed(() => import('@/pages/rh/ColaboradorFormPage'), 'ColaboradorFormPage')
export const ImportarRhPage = lazyNamed(() => import('@/pages/rh/ImportarPage'), 'ImportarPage')
export const ModelosPage = lazyNamed(() => import('@/pages/rh/ModelosPage'), 'ModelosPage')
export const AlertasPage = lazyNamed(() => import('@/pages/rh/AlertasPage'), 'AlertasPage')

// VR
export const VrProjetosPage = lazyNamed(() => import('@/pages/vr/VrProjetosPage'), 'VrProjetosPage')
export const VrProjetoFormPage = lazyNamed(() => import('@/pages/vr/VrProjetoFormPage'), 'VrProjetoFormPage')
export const VrProjetoDetailPage = lazyNamed(() => import('@/pages/vr/VrProjetoDetailPage'), 'VrProjetoDetailPage')

// CEU
export const CeuDashboardPage = lazyNamed(() => import('@/pages/ceu/CeuDashboardPage'), 'CeuDashboardPage')
export const CeuItensPage = lazyNamed(() => import('@/pages/ceu/CeuItensPage'), 'CeuItensPage')
export const CeuItemFormPage = lazyNamed(() => import('@/pages/ceu/CeuItemFormPage'), 'CeuItemFormPage')
export const CeuFornecedoresPage = lazyNamed(() => import('@/pages/ceu/CeuFornecedoresPage'), 'CeuFornecedoresPage')
export const CeuMovimentacoesPage = lazyNamed(() => import('@/pages/ceu/CeuMovimentacoesPage'), 'CeuMovimentacoesPage')
export const CeuEntregaFormPage = lazyNamed(() => import('@/pages/ceu/CeuEntregaFormPage'), 'CeuEntregaFormPage')
export const CeuLancamentoRapidoPage = lazyNamed(() => import('@/pages/ceu/CeuLancamentoRapidoPage'), 'CeuLancamentoRapidoPage')
export const CeuRelatoriosPage = lazyNamed(() => import('@/pages/ceu/CeuRelatoriosPage'), 'CeuRelatoriosPage')
export const CeuImportarPage = lazyNamed(() => import('@/pages/ceu/CeuImportarPage'), 'CeuImportarPage')

// Adicionais
export const AdicionaisContratosPage = lazyNamed(() => import('@/pages/adicionais/AdicionaisContratosPage'), 'AdicionaisContratosPage')
export const AdicionaisVinculosPage = lazyNamed(() => import('@/pages/adicionais/AdicionaisVinculosPage'), 'AdicionaisVinculosPage')
export const AdicionaisCalendarioPage = lazyNamed(() => import('@/pages/adicionais/AdicionaisCalendarioPage'), 'AdicionaisCalendarioPage')
export const AdicionaisRelatorioPage = lazyNamed(() => import('@/pages/adicionais/AdicionaisRelatorioPage'), 'AdicionaisRelatorioPage')
export const ImportarPontoPage = lazyNamed(() => import('@/pages/adicionais/ImportarPontoPage'), 'ImportarPontoPage')

// Outros
export const DepartamentosPage = lazyNamed(() => import('@/pages/DepartamentosPage'), 'DepartamentosPage')
export const EmpresasPage = lazyNamed(() => import('@/pages/EmpresasPage'), 'EmpresasPage')
export const ImportarEContadorPage = lazyNamed(() => import('@/pages/ImportarEContadorPage'), 'ImportarEContadorPage')
export const ConfiguracoesPage = lazyNamed(() => import('@/pages/ConfiguracoesPage'), 'ConfiguracoesPage')
