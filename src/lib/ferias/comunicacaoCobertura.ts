import type { FeriasSolicitacao } from '@/types/ferias'

// ============================================================
// Checklist de comunicação da cobertura (migration 125, decisão
// da gestão 13/10/2026): informativo ao cliente, contato com o
// titular, contato com o ferista e encarregado/líder do posto.
// ============================================================

/** Quantos dos 4 itens do checklist de comunicação estão preenchidos. */
export function progressoComunicacao(
  s: Pick<FeriasSolicitacao, 'informativo_cliente_em' | 'contato_titular_em' | 'contato_ferista_em' | 'encarregado_lider'>
): number {
  return [s.informativo_cliente_em, s.contato_titular_em, s.contato_ferista_em, s.encarregado_lider]
    .filter((v) => v !== null && v !== undefined && v !== '').length
}
