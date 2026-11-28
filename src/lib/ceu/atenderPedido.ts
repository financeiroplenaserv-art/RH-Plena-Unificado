// CEU → Pedidos: "Atender selecionadas" lança a entrega no CEU (migration 177).
// Lógica pura da janela de confirmação: data sugerida, CA dos itens e
// conferência do retorno da RPC. Decisões da gestora em 26/11 e 28/11/2026
// (docs/HANDOFF_26-11-2026_MATERIAIS_EPI.md).

/** Data sugerida para a entrega: dia 1º do mês do pedido (competência 'AAAA-MM-DD'). */
export function dataSugeridaEntrega(competencia: string | null | undefined, hoje: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(competencia ?? '')
  if (m) return `${m[1]}-${m[2]}-01`
  return `${hoje.slice(0, 7)}-01`
}

/** Data 'AAAA-MM-DD' válida (o input type=date pode ficar vazio). */
export function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  const [a, m, d] = data.split('-').map(Number)
  const dt = new Date(a, m - 1, d)
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d
}

export interface ItemCa {
  id: string
  nome: string
  tipo: string
  ca?: string | null
}

/** EPI sem CA no cadastro: a janela destaca e oferece campo para digitar. */
export function epiSemCa(item: ItemCa | undefined | null): boolean {
  return !!item && item.tipo === 'EPI' && !(item.ca ?? '').trim()
}

export interface AtualizacaoCa {
  item_id: string
  ca: string
}

/**
 * CAs digitados na janela que devem ir para o cadastro do item ANTES de lançar
 * (o snapshot da entrega sai com o CA novo). Só itens EPI sem CA; o campo é
 * por ITEM (vale para todas as linhas dele). Vazio não bloqueia: vira aviso.
 */
export function casParaAtualizar(
  itens: (ItemCa | undefined)[],
  digitados: Record<string, string | undefined>
): { atualizacoes: AtualizacaoCa[]; semCa: string[] } {
  const atualizacoes: AtualizacaoCa[] = []
  const semCa: string[] = []
  const vistos = new Set<string>()
  for (const item of itens) {
    if (!item || vistos.has(item.id)) continue
    vistos.add(item.id)
    if (!epiSemCa(item)) continue
    const ca = (digitados[item.id] ?? '').trim()
    if (ca) atualizacoes.push({ item_id: item.id, ca })
    else semCa.push(item.nome)
  }
  return { atualizacoes, semCa }
}

export interface ResultadoAtenderLancar {
  atendidas: number
  entregas_criadas: number
  ja_atendidas: number
  linhas: { id: string; entrega_id: string | null; ja_atendida: boolean }[]
}

/** Lê o retorno da RPC atender_e_lancar_linhas_pedido_ceu (jsonb). */
export function lerResultadoAtender(data: unknown): ResultadoAtenderLancar | null {
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v))
  const atendidas = num(o.atendidas)
  const criadas = num(o.entregas_criadas)
  const ja = num(o.ja_atendidas)
  if (![atendidas, criadas, ja].every(Number.isFinite)) return null
  const linhas = Array.isArray(o.linhas)
    ? (o.linhas as Record<string, unknown>[]).map((l) => ({
        id: String(l.id),
        entrega_id: l.entrega_id == null ? null : String(l.entrega_id),
        ja_atendida: l.ja_atendida === true,
      }))
    : []
  return { atendidas, entregas_criadas: criadas, ja_atendidas: ja, linhas }
}

/** Anti-falso-sucesso: toda linha enviada voltou (atendida agora ou já atendida). */
export function conferirResultadoAtender(r: ResultadoAtenderLancar | null, ids: string[]): boolean {
  if (!r) return false
  if (r.atendidas + r.ja_atendidas !== ids.length) return false
  const voltaram = new Set(r.linhas.map((l) => l.id))
  return ids.every((id) => voltaram.has(id))
}

/** Texto do toast de sucesso. */
export function mensagemAtendimento(r: ResultadoAtenderLancar): string {
  const partes: string[] = []
  partes.push(r.atendidas === 1 ? '1 linha atendida' : `${r.atendidas} linhas atendidas`)
  partes.push(r.entregas_criadas === 1 ? '1 entrega lançada no CEU' : `${r.entregas_criadas} entregas lançadas no CEU`)
  if (r.ja_atendidas > 0) partes.push(r.ja_atendidas === 1 ? '1 já estava atendida' : `${r.ja_atendidas} já estavam atendidas`)
  return partes.join(' · ')
}

/** Contratos para onde a linha pode ir: ativos, diferentes do atual, por nome. */
export function contratosDestino<T extends { id: string; nome: string; ativo: boolean }>(contratos: T[], atual: string | null | undefined): T[] {
  return contratos.filter((c) => c.ativo && c.id !== atual).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
