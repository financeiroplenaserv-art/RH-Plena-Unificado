// Lógica pura do módulo VT — trajetos casa → posto e custo do dia.
// Ver docs/PLANO_MODULO_VT.md (Fase 1; precificação por bilhete nomeado, §2d).

import { removerAcentos } from '@/lib/utils'
import type { EscopoTrajetoVT, TipoCartaoVT, VtBilhete, VtTrajeto } from '@/types/vt'
import { bilhetesVigentes, custoDiaBilhetesCentavos } from '@/lib/vt/bilhetes'

/**
 * Custo do dia do trajeto em centavos: resolve bilhete_id (e bilhete_2_id,
 * quando presente) entre os bilhetes vigentes na data e soma os valores
 * diários + o valor extra manual do trajeto (migration 166). Null quando o
 * 1º bilhete não resolve (ou quando o 2º, informado, não resolve) — sem
 * bilhete vigente não se calcula, para nunca cobrar a menos em silêncio.
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
  // Migration 166: valor extra manual por dia soma ao custo (?? 0 = leitura
  // de trajeto de antes da migration, com a coluna ausente na resposta).
  return custoDiaBilhetesCentavos(b1, b2) + (trajeto.valor_extra_centavos ?? 0)
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
 * Aviso de consistência bilhete × trajeto (decisão da gestora, 24/10/2026;
 * ampliado em 27/10/2026): quem mora E trabalha em Niterói recebe o valor de
 * Niterói (BU NITERÓI), mesmo que o cartão dela seja o BUI — o cartão fica no
 * cadastro (vt_tipo_cartao), o valor segue o trajeto. E o inverso: casa e
 * posto em cidades diferentes não combinam com o bilhete municipal. Também
 * avisa quando casa e posto são a MESMA cidade fora de Niterói com bilhete de
 * Niterói/intermunicipal, e Niterói × Niterói com o bilhete de São Gonçalo.
 * Só compara os bilhetes que o nome classifica (intermunicipal / BU Niterói /
 * São Gonçalo); os demais (trem, VLT, RJ...) não geram aviso. Sem cidade dos
 * dois lados não há base para julgar: sem aviso. É só aviso — nunca bloqueia
 * e nunca cita valor (o valor muda de vigência — não repetir o problema do
 * "R$ 11,20" fixo).
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
  const temBuNiteroi = nomes.some((n) => n.includes('BU NITEROI'))
  const temSaoGoncalo = nomes.some((n) => n.includes('SAO GONCALO'))
  // TODOS os bilhetes são BU Niterói (o 2º bilhete pode ser um trecho
  // municipal legítimo — ex.: casa em SG + posto em Niterói).
  const soMunicipalNiteroi = nomes.every((n) => n.includes('BU NITEROI'))
  if (escopo === 'niteroi_municipal' && temIntermunicipal) {
    return 'Mora e trabalha em Niterói, mas o bilhete é intermunicipal — em geral vale o BU Niterói'
  }
  if (escopo === 'niteroi_municipal' && temSaoGoncalo) {
    return 'Mora e trabalha em Niterói, mas o bilhete é o de São Gonçalo — em geral vale o BU Niterói'
  }
  if (escopo === 'municipal_outra' && (temBuNiteroi || temIntermunicipal)) {
    return `Mora e trabalha em ${cidadeCasa.trim()}, mas o bilhete é de outra cidade — confira o trajeto`
  }
  if (escopo === 'intermunicipal' && soMunicipalNiteroi) {
    return 'Casa e posto em cidades diferentes, mas o bilhete é o municipal de Niterói — confira o trajeto'
  }
  return null
}

/** Rótulo do cartão que o bilhete exige (migration 165 — decisão da gestora, 27/10/2026). */
export const ROTULO_CARTAO_NECESSARIO: Record<TipoCartaoVT, string> = {
  bun: 'BUN (Niterói)',
  bui: 'BUI (intermunicipal)',
  jae: 'JAE (RJ)',
  comum: 'comum',
}

/**
 * Linha discreta sob o select de bilhete da aba Trajetos: o cartão que o(s)
 * bilhete(s) escolhido(s) pedem, com "· com integração" quando o bilhete
 * depende de integração (2+ conduções numa tarifa só). Com 2 bilhetes, junta
 * com " + ". Null quando nenhum bilhete está classificado (catálogo ainda sem
 * cartao_necessario — migration 165 não aplicada ou bilhete novo).
 */
export function descricaoCartaoDosBilhetes(
  bilhetes: (Pick<VtBilhete, 'cartao_necessario' | 'usa_integracao'> | null | undefined)[],
): string | null {
  const partes = bilhetes
    .filter((b): b is Pick<VtBilhete, 'cartao_necessario' | 'usa_integracao'> => !!b?.cartao_necessario)
    .map(
      (b) =>
        `${ROTULO_CARTAO_NECESSARIO[b.cartao_necessario!]}${b.usa_integracao ? ' · com integração' : ''}`
    )
  if (partes.length === 0) return null
  return `cartão: ${partes.join(' + ')}`
}

/**
 * Aviso de integração do trajeto × situação do BU na Riocard (decisão da
 * gestora, 28/10/2026 — migration 167; SUBSTITUI o avisoCartaoDoTrajeto de
 * 27/10): o cartão físico é o mesmo (Riocard) para todos — o que manda é a
 * tarifa carregada e se a integração (Bilhete Único) está ATIVADA no cartão.
 * Cruzar "cartão necessário do bilhete" com o vt_tipo_cartao do cadastro
 * gerava falsos positivos (quem tem BU ativado pode receber a tarifa de
 * Niterói mesmo com cadastro dizendo BUI). Só aviso — nunca bloqueia.
 * Trajeto sem bilhete com integração: null (a tarifa vale e pronto).
 * buAtivado null = situação ainda não consultada na Riocard.
 */
export function avisoIntegracaoDoTrajeto(
  bilhetes: (Pick<VtBilhete, 'usa_integracao' | 'nome'> | null | undefined)[],
  buAtivado: boolean | null | undefined,
  buSituacao: string | null | undefined,
): string | null {
  const dependeDeIntegracao = bilhetes.some((b) => b?.usa_integracao === true)
  if (!dependeDeIntegracao) return null
  if (buAtivado === true) return null
  if (buAtivado === false) {
    const situacao = buSituacao?.trim()
    const trecho = situacao ? `, mas no site da Riocard o BU dele consta como '${situacao}'` : ''
    return `Este trajeto depende de integração (Bilhete Único)${trecho} — sem a ativação, o valor carregado não cobre o trajeto. Providenciar a ativação ou trocar o bilhete.`
  }
  return 'Este trajeto depende de integração (Bilhete Único) e a situação do BU dele ainda não foi consultada na Riocard — confira antes de gravar a carga.'
}
