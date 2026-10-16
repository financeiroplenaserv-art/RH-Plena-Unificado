// Estado do formulário da tela pública do líder (/pedido/:token).
import { linhasIniciaisDoKit, type ContextoPedido, type ErroCampo, type ItemPublico } from '@/lib/materiais/pedidoLider'
import type { PecaPublica } from '@/lib/materiais/pecasCeu'

export type SecaoProduto = 'materiais' | 'portaria'

export interface LinhaProdutoForm {
  chave: string
  item_id: string | null
  variacao_id: string | null
  descricao_livre: string
  quantidade: string
  justificativa: string
  /** Etapa em que a linha aparece. */
  secao: SecaoProduto
  /** kit = veio do Kit Mensal; busca = "Preciso de outro item"; livre = "Não achei, enviar assim". */
  origem: 'kit' | 'busca' | 'livre'
}

/** Pessoa do pedido de uniforme/EPI/crachá: da lista da equipe (ref) ou "outra pessoa" (nome digitado). */
export interface PessoaForm {
  chave: string
  ref: string | null
  nome: string
}

export interface LinhaPecaForm {
  chave: string
  pessoa: string
  peca_id: string
  tamanho: string
  quantidade: string
}

export interface LinhaCrachaForm {
  chave: string
  /** Pessoa da equipe (ref opaco) ou null = "outra pessoa" (nome digitado). */
  ref: string | null
  nome: string
  cracha_nome: string
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
  'w-full rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'

export interface RascunhoPedido {
  versao: 2
  produtos: LinhaProdutoForm[]
  /** Itens escolhidos na busca (o link só recebe o kit; a busca traz o resto). */
  itensBusca: ItemPublico[]
  pessoas: PessoaForm[]
  pecas: LinhaPecaForm[]
  crachas: LinhaCrachaForm[]
  termos: Record<string, boolean>
  seuNome: string
  observacao: string
}

/**
 * Item CEU da linha: na peça com tamanho por item ("BOTA 38", "BOTA 40") é o
 * item do tamanho escolhido; sem tamanho escolhido vai o primeiro (o servidor
 * pede o tamanho).
 */
export function itemDaLinhaPeca(peca: PecaPublica | undefined, tamanho: string): string {
  if (!peca) return ''
  return (peca.opcoes.find((o) => o.tamanho === tamanho) ?? peca.opcoes[0])?.item_id ?? ''
}

/** Corpo do envio (validado de novo no servidor com validarEnvioPedido). */
export function montarPayloadPedido(r: RascunhoPedido, pecas: PecaPublica[]): Record<string, unknown> {
  const pessoa = new Map(r.pessoas.map((p) => [p.chave, p]))
  const peca = new Map(pecas.map((p) => [p.id, p]))
  const quem = (chave: string) => {
    const p = pessoa.get(chave)
    return p?.ref ? { colaborador_ref: p.ref, nome_digitado: '' } : { colaborador_ref: null, nome_digitado: p?.nome ?? '' }
  }
  return {
    seu_nome: r.seuNome,
    observacao: r.observacao,
    termos: r.termos,
    produtos: r.produtos
      .filter((l) => qtdNumero(l.quantidade) > 0)
      .map((l) => ({
        chave: l.chave,
        item_id: l.item_id,
        variacao_id: l.variacao_id,
        descricao_livre: l.item_id ? null : l.descricao_livre,
        quantidade: qtdNumero(l.quantidade),
        justificativa: l.justificativa,
      })),
    ceu: [
      ...r.pecas.map((l) => {
        const p = peca.get(l.peca_id)
        return {
          chave: l.chave,
          tipo: p?.tipo ?? 'uniforme',
          ...quem(l.pessoa),
          item_id: itemDaLinhaPeca(p, l.tamanho),
          tamanho: l.tamanho,
          quantidade: qtdNumero(l.quantidade) || l.quantidade,
        }
      }),
      ...r.crachas.map((l) => ({
        chave: l.chave,
        tipo: 'cracha',
        colaborador_ref: l.ref,
        nome_digitado: l.ref ? '' : l.nome,
        cracha_nome: l.cracha_nome,
        cracha_motivo: l.cracha_motivo,
        cracha_cordao: l.cracha_cordao,
        quantidade: 1,
      })),
    ],
  }
}

/** Erros de uma linha/campo (a lista é recalculada a cada tecla — some assim que o campo é corrigido). */
export function errosDe(erros: ErroCampo[], chave: string | null, campo?: string): string[] {
  return erros.filter((e) => e.chave === chave && (!campo || e.campo === campo)).map((e) => e.mensagem)
}

// Rascunho só no aparelho (sem rascunho no servidor — o link é público).
const chaveRascunho = (token: string, competencia: string) => `corh:pedido-lider:v2:${token.slice(0, 12)}:${competencia}`

export function lerRascunho(token: string, competencia: string): RascunhoPedido | null {
  try {
    const bruto = localStorage.getItem(chaveRascunho(token, competencia))
    if (!bruto) return null
    const r = JSON.parse(bruto) as RascunhoPedido
    return r && r.versao === 2 && Array.isArray(r.produtos) && Array.isArray(r.pecas) && Array.isArray(r.pessoas) ? r : null
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

/**
 * Rascunho do aparelho × kit carregado agora (o kit pode ter mudado no meio
 * do mês): remove linhas do kit cujo item saiu do kit/catálogo, acrescenta as
 * linhas de itens novos do kit (com a quantidade padrão) e preserva as linhas
 * de busca/livre como estão (linha de busca cujo item sumiu do rascunho de
 * itens da busca também sai — sem o ItemPublico ela não valida nem envia).
 * Quantidades digitadas nas linhas mantidas não são tocadas.
 */
export function reconciliarRascunhoComKit(
  rascunho: Pick<RascunhoPedido, 'produtos' | 'itensBusca'>,
  ctx: Pick<ContextoPedido, 'kit' | 'catalogo' | 'ultimasEntregas' | 'hoje' | 'recebeLimpeza'>
): Pick<RascunhoPedido, 'produtos' | 'itensBusca'> {
  const kitAtual = linhasIniciaisDoKit(ctx)
  const noKit = new Set(kitAtual.map((k) => k.item_id))
  const buscaPorId = new Map((rascunho.itensBusca ?? []).map((i) => [i.id, i]))
  const vistoKit = new Set<string>()
  const produtos = (rascunho.produtos ?? []).filter((l) => {
    if (l.origem === 'kit') {
      // Sem duplicar linha do mesmo item do kit (vale a primeira, com a quantidade digitada).
      if (!l.item_id || !noKit.has(l.item_id) || vistoKit.has(l.item_id)) return false
      vistoKit.add(l.item_id)
      return true
    }
    if (l.origem === 'busca') return !!l.item_id && buscaPorId.has(l.item_id)
    return true
  })
  const categoria = new Map(ctx.catalogo.map((c) => [c.id, c.categoria]))
  const novas: LinhaProdutoForm[] = kitAtual
    .filter((k) => !vistoKit.has(k.item_id))
    .map((k) => ({
      chave: novaChave(),
      item_id: k.item_id,
      variacao_id: k.variacao_id,
      descricao_livre: '',
      quantidade: String(k.quantidade),
      justificativa: '',
      secao: (categoria.get(k.item_id) === 'portaria' ? 'portaria' : 'materiais') as SecaoProduto,
      origem: 'kit' as const,
    }))
  return { produtos: [...produtos, ...novas], itensBusca: rascunho.itensBusca ?? [] }
}
