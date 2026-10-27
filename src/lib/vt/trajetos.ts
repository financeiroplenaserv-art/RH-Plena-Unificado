// Lógica pura do módulo VT — trajetos casa → posto e custo do dia.
// Ver docs/PLANO_MODULO_VT.md (Fase 1; precificação por bilhete nomeado, §2d).

import { removerAcentos } from '@/lib/utils'
import type { EscopoTrajetoVT, VtBilhete, VtTrajeto } from '@/types/vt'
import { bilhetesVigentes, custoDiaBilhetesCentavos } from '@/lib/vt/bilhetes'

/**
 * Custo do dia do trajeto em centavos: resolve bilhete_id (e bilhete_2_id,
 * quando presente) entre os bilhetes vigentes na data e soma os valores
 * diários. Null quando o 1º bilhete não resolve (ou quando o 2º, informado,
 * não resolve) — sem bilhete vigente não se calcula, para nunca cobrar a
 * menos em silêncio.
 */
export function custoDiaTrajetoCentavos(
  trajeto: VtTrajeto,
  bilhetes: VtBilhete[],
  hoje: string,
): number | null {
  const vigentes = bilhetesVigentes(bilhetes, hoje)
  const b1 = vigentes.find((b) => b.id === trajeto.bilhete_id)
  if (!b1) return null
  let b2: VtBilhete | null = null
  if (trajeto.bilhete_2_id) {
    b2 = vigentes.find((b) => b.id === trajeto.bilhete_2_id) ?? null
    if (!b2) return null
  }
  return custoDiaBilhetesCentavos(b1, b2)
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

/**
 * Aviso de consistência bilhete × trajeto (decisão da gestora, 24/10/2026):
 * quem mora E trabalha em Niterói recebe o valor de Niterói (BU NITERÓI,
 * R$ 11,20/dia), mesmo que o cartão dela seja o BUI — o cartão fica no
 * cadastro (vt_tipo_cartao), o valor segue o trajeto. E o inverso: casa e
 * posto em cidades diferentes não combinam com o bilhete municipal.
 * Só compara os bilhetes que o nome classifica (intermunicipal / BU Niterói);
 * os demais (trem, VLT, RJ, São Gonçalo...) não geram aviso. Sem cidade dos
 * dois lados não há base para julgar: sem aviso. É só aviso — nunca bloqueia.
 */
export function avisoBilheteIncompativel(
  cidadeCasa: string | null,
  cidadePosto: string | null,
  nomesBilhetes: (string | null | undefined)[],
): string | null {
  if (!cidadeCasa?.trim() || !cidadePosto?.trim()) return null
  const nomes = nomesBilhetes
    .filter((n): n is string => !!n)
    .map((n) => removerAcentos(n).toUpperCase())
  if (nomes.length === 0) return null
  const escopo = escopoSugerido(cidadeCasa, cidadePosto)
  const temIntermunicipal = nomes.some((n) => n.includes('INTERMUNICIPAL'))
  const soMunicipalNiteroi = nomes.every((n) => n.includes('BU NITEROI'))
  if (escopo === 'niteroi_municipal' && temIntermunicipal) {
    return 'Mora e trabalha em Niterói, mas o bilhete é intermunicipal — em geral vale o BU Niterói (R$ 11,20/dia)'
  }
  if (escopo === 'intermunicipal' && soMunicipalNiteroi) {
    return 'Casa e posto em cidades diferentes, mas o bilhete é o municipal de Niterói — confira o trajeto'
  }
  return null
}
