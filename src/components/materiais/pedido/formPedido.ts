// Estado do formulário da tela pública do líder (/pedido/:token).

export interface LinhaProdutoForm {
  chave: string
  item_id: string | null
  variacao_id: string | null
  descricao_livre: string
  quantidade: string
  justificativa: string
}

export interface LinhaCeuForm {
  chave: string
  tipo: 'uniforme' | 'epi' | 'cracha'
  nome: string
  item_id: string
  tamanho: string
  quantidade: string
  cracha_motivo: string
  cracha_cordao: boolean
}

let contador = 0
export const novaChave = () => `l${Date.now().toString(36)}${(contador++).toString(36)}`

export const qtdNumero = (texto: string): number => {
  const n = Number(texto.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export const CAMPO =
  'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

export interface RascunhoPedido {
  produtos: LinhaProdutoForm[]
  ceu: LinhaCeuForm[]
  termos: Record<string, boolean>
  seuNome: string
  observacao: string
}

/** Corpo do envio (validado de novo no servidor com validarEnvioPedido). */
export function montarPayloadPedido(r: RascunhoPedido): Record<string, unknown> {
  return {
    seu_nome: r.seuNome,
    observacao: r.observacao,
    termos: r.termos,
    produtos: r.produtos
      .filter((l) => qtdNumero(l.quantidade) > 0)
      .map((l) => ({
        item_id: l.item_id,
        variacao_id: l.variacao_id,
        descricao_livre: l.item_id ? null : l.descricao_livre,
        quantidade: qtdNumero(l.quantidade),
        justificativa: l.justificativa,
      })),
    ceu: r.ceu.map((l) =>
      l.tipo === 'cracha'
        ? { tipo: 'cracha', nome_digitado: l.nome, cracha_nome: l.nome, cracha_motivo: l.cracha_motivo, cracha_cordao: l.cracha_cordao, quantidade: 1 }
        : { tipo: l.tipo, nome_digitado: l.nome, item_id: l.item_id, tamanho: l.tamanho, quantidade: qtdNumero(l.quantidade) || l.quantidade }
    ),
  }
}

// Rascunho só no aparelho (sem rascunho no servidor — o link é público).
const chaveRascunho = (token: string, competencia: string) => `corh:pedido-lider:${token.slice(0, 12)}:${competencia}`

export function lerRascunho(token: string, competencia: string): RascunhoPedido | null {
  try {
    const bruto = localStorage.getItem(chaveRascunho(token, competencia))
    if (!bruto) return null
    const r = JSON.parse(bruto) as RascunhoPedido
    return Array.isArray(r.produtos) && Array.isArray(r.ceu) ? r : null
  } catch {
    return null
  }
}

export function salvarRascunho(token: string, competencia: string, r: RascunhoPedido) {
  try {
    localStorage.setItem(chaveRascunho(token, competencia), JSON.stringify(r))
  } catch {
    // armazenamento indisponível (aba anônima etc.): segue sem rascunho
  }
}

export function apagarRascunho(token: string, competencia: string) {
  try {
    localStorage.removeItem(chaveRascunho(token, competencia))
  } catch {
    // idem
  }
}
