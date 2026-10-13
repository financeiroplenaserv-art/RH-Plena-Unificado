import type { FeriasFuncao } from '@/types/ferias'

// ============================================================
// Resolução de funções operacionais (catálogo ferias_funcoes)
// ------------------------------------------------------------
// colaboradores.cargo é texto livre e sujo (caixa, acentos,
// espaços sobrando). O catálogo tem aliases com as grafias
// reais da base; cargo e alias passam pela mesma normalização.
// ============================================================

/** trim + maiúsculas + sem acentos + espaços colapsados (estilo normalizarDepartamento). */
export function normalizarCargo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resolve o cargo livre do colaborador para uma função do catálogo,
 * casando com o nome ou com os aliases (todos normalizados).
 * Ignora funções inativas; em empate (alias duplicado entre funções),
 * prefere a de maior nível.
 */
export function resolverFuncao(
  cargo: string | null | undefined,
  funcoes: FeriasFuncao[]
): FeriasFuncao | null {
  const alvo = normalizarCargo(cargo ?? '')
  if (!alvo) return null

  let melhor: FeriasFuncao | null = null
  for (const funcao of funcoes) {
    if (!funcao.ativo) continue
    const grafias = [funcao.nome, ...(funcao.aliases ?? [])]
    const casa = grafias.some((g) => g && normalizarCargo(g) === alvo)
    if (casa && (melhor === null || funcao.nivel > melhor.nivel)) {
      melhor = funcao
    }
  }
  return melhor
}

/**
 * RN-02.3 (migration 113, decisão da gestão 25/09/2026): a cobertura é uma
 * matriz explícita — a função cobre a vaga quando a vaga está em
 * `cobre_funcoes`. Cobrir a PRÓPRIA função é sempre implícito (não precisa
 * constar no array). O `nivel` não decide elegibilidade (só desempate/score).
 */
export function podeCobrirFuncao(funcaoCobridor: FeriasFuncao, funcaoVaga: FeriasFuncao): boolean {
  if (funcaoCobridor.id === funcaoVaga.id) return true
  return (funcaoCobridor.cobre_funcoes ?? []).includes(funcaoVaga.id)
}
