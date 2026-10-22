// Lógica pura do módulo VT — trajetos casa → posto e custo do dia.
// Ver docs/PLANO_MODULO_VT.md (Fase 1; precificação por combinação nomeada, §2d).

import { removerAcentos } from '@/lib/utils'
import type { EscopoTrajetoVT, VtCombinacao, VtTrajeto } from '@/types/vt'
import { combinacoesVigentes, custoDiaCombinacoesCentavos } from '@/lib/vt/combinacoes'

/**
 * Custo do dia do trajeto em centavos: resolve combinacao_id (e
 * combinacao_2_id, quando presente) entre as combinações vigentes na data e
 * soma os valores diários. Null quando a 1ª combinação não resolve (ou quando
 * a 2ª, informada, não resolve) — sem combinação vigente não se calcula, para
 * nunca cobrar a menos em silêncio.
 */
export function custoDiaTrajetoCentavos(
  trajeto: VtTrajeto,
  combinacoes: VtCombinacao[],
  hoje: string,
): number | null {
  const vigentes = combinacoesVigentes(combinacoes, hoje)
  const c1 = vigentes.find((c) => c.id === trajeto.combinacao_id)
  if (!c1) return null
  let c2: VtCombinacao | null = null
  if (trajeto.combinacao_2_id) {
    c2 = vigentes.find((c) => c.id === trajeto.combinacao_2_id) ?? null
    if (!c2) return null
  }
  return custoDiaCombinacoesCentavos(c1, c2)
}

export interface ParEscala {
  colaborador_id: string
  departamento_id: string
}

/**
 * Pares únicos colaborador × departamento presentes na escala (um trajeto por
 * par). Linhas sem departamento_id são ignoradas.
 */
export function paresDaEscala(
  linhas: { colaborador_id: string; departamento_id: string | null }[],
): ParEscala[] {
  const vistos = new Set<string>()
  const pares: ParEscala[] = []
  for (const l of linhas) {
    if (!l.departamento_id) continue
    const chave = `${l.colaborador_id}|${l.departamento_id}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    pares.push({ colaborador_id: l.colaborador_id, departamento_id: l.departamento_id })
  }
  return pares
}

function normalizarCidade(cidade: string | null): string {
  return removerAcentos((cidade || '').trim()).toUpperCase()
}

/**
 * Escopo tarifário sugerido pela comparação cidade da casa × cidade do posto
 * (normalizadas: sem acento, maiúsculas, sem espaços nas pontas):
 * mesma cidade Niterói -> municipal Niterói (BUN); mesma cidade, outra ->
 * municipal de outra cidade; cidades diferentes -> intermunicipal (BUI).
 * Classificação INFORMACIONAL (não precifica mais — §2d do plano).
 * Cidade vazia dos dois lados não é "igual": sem dado, cai em intermunicipal
 * (o trajeto sempre passa por confirmação humana antes de entrar no cálculo).
 */
export function escopoSugerido(cidadeCasa: string | null, cidadePosto: string | null): EscopoTrajetoVT {
  const casa = normalizarCidade(cidadeCasa)
  const posto = normalizarCidade(cidadePosto)
  if (casa && casa === posto) {
    return casa === 'NITEROI' ? 'niteroi_municipal' : 'municipal_outra'
  }
  return 'intermunicipal'
}
