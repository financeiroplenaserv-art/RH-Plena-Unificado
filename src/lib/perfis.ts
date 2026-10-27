import type { NivelAcesso } from '@/types/database'

/** Rótulos de exibição dos níveis de acesso (tela Permissões e seção Usuários). */
export const PERFIS: { valor: NivelAcesso; label: string }[] = [
  { valor: 'adm', label: 'Administrador (adm)' },
  { valor: 'gestor', label: 'Gestor' },
  { valor: 'rh', label: 'RH' },
  { valor: 'dp1', label: 'DP1' },
  { valor: 'dp2', label: 'DP2' },
  { valor: 'dp3', label: 'DP3 (crachás e VT)' },
  { valor: 'mesa', label: 'Mesa' },
  { valor: 'inspetoria', label: 'Inspetoria' },
  { valor: 'financeiro', label: 'Financeiro' },
  { valor: 'visualizador', label: 'Visualizador' },
]

export function rotuloPerfil(nivel: NivelAcesso): string {
  return PERFIS.find((p) => p.valor === nivel)?.label ?? nivel
}
