/**
 * Liberação de módulos em construção.
 *
 * Férias — oculto em produção (15/10/2026). Em 14/10/2026 um deploy feito a
 * partir da branch de módulo `materiais-fase1` publicou módulos em construção
 * sem autorização; em 15/10/2026 a gestora mandou tirar Materiais e Férias do
 * ar até ela liberar. Com `false`, o menu Férias some, as rotas /ferias*
 * redirecionam para o Dashboard e o atalho em Relatórios é ocultado. O código
 * do módulo NÃO foi apagado; banco e permissões não foram alterados.
 *
 * Só mude para `true` com liberação expressa da gestora.
 */
export const MODULO_FERIAS_LIBERADO = false

/**
 * VT (Vale-Transporte) — Fase 1 em construção na branch `vt-fase1`
 * (plano: docs/PLANO_MODULO_VT.md). Com `false`, o menu Vale-Transporte some e
 * as rotas /vt* redirecionam para o Dashboard. Só mude para `true` com
 * liberação expressa da gestora (mesmo incidente de 14/10/2026 citado acima).
 */
export const MODULO_VT_LIBERADO = false
