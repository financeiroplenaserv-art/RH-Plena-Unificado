// Pedido do líder pelo link público (/pedido/:token) — lógica pura.
//
// ESTE ARQUIVO É COPIADO PARA DENTRO DA EDGE FUNCTION
// supabase/functions/pedido-materiais/index.ts (o deploy é de arquivo único),
// junto com buscaItens.ts e pecasCeu.ts. Por isso só importa TIPOS dos
// arquivos irmãos (o script remove as linhas de import). Ao mudar aqui, rode
// `node scripts/sincronizar-pedido-materiais.mjs` — o teste
// pedidoLider.test.ts falha se as cópias divergirem.
//
// Regras (docs/PLANO_MATERIAIS_FASE1.md §4): o link é público, então o único
// dado pessoal que sai daqui é a lista da equipe com PRIMEIRO NOME + INICIAL
// do sobrenome e um identificador opaco (decisão da gestão, 09/10/2026,
// reiterada em 14/10/2026) — nada de CPF, matrícula, foto, tamanhos, preço.
// O cliente não é confiável: o servidor revalida tudo com validarEnvioPedido
// e recalcula as exceções (acima do kit, antes da validade, fora do kit), que
// exigem justificativa mas NÃO bloqueiam o pedido — vão para o inspetor.

import type { MembroEquipePublico, PecaPublica } from './pecasCeu'

// 'portaria' é o único valor com regra própria; as demais contam como material (recebe_limpeza).
export type CategoriaPublica = 'limpeza' | 'portaria' | 'descartaveis' | 'acessorios' | 'piscina'
export type TipoLinhaCeu = 'uniforme' | 'epi' | 'cracha'
export type DestinoFilaPublico = 'novo' | 'mesclar' | 'extra'

export const LIMITES_PEDIDO = {
  nome: 120,
  texto: 500,
  tamanho: 20,
  crachaNome: 40,
  qtdMaxima: 999,
  fatorKit: 10,
  qtdCeuMaxima: 20,
  linhasProdutos: 200,
  linhasCeu: 150,
} as const

// Seções do formulário (ordem e textos dos Google Forms atuais —
// docs/materiais-referencia/). Cada seção usada exige a sua declaração
// ("Sim, concordo" virou caixa de confirmação obrigatória).
export type SecaoPedido = 'materiais' | 'uniforme' | 'epi' | 'cracha' | 'portaria'

export const TERMOS_PEDIDO: { id: SecaoPedido; texto: string }[] = [
  {
    id: 'materiais',
    texto:
      'Declaro que as informações acima são verdadeiras e me comprometo a cuidar e utilizar os materiais para a sua devida finalidade, com zelo e sem desperdício, respeitando a diluição correta dos produtos.',
  },
  {
    id: 'uniforme',
    texto: 'Declaro que as informações acima são verdadeiras e me comprometo a manter e zelar pelo estado bem apresentável do uniforme.',
  },
  {
    id: 'epi',
    texto:
      "Declaro que as informações acima são verdadeiras e me comprometo a utilizar, manter e conservar os EPI's de acordo com as normas de segurança.",
  },
  {
    id: 'cracha',
    texto:
      'Declaro que as informações fornecidas são verdadeiras e estou ciente que a substituição por mau uso do crachá gera custo. Estou ciente também que a entrega do novo crachá será no próximo mês.',
  },
  {
    id: 'portaria',
    texto: 'Declaro que as informações acima são verdadeiras e me responsabilizo pelo uso adequado de todos os materiais.',
  },
]

export const MOTIVOS_CRACHA = [
  'Desgaste natural',
  'Quebra no encaixe do prendedor',
  'Perda',
  'Quebra por descuido',
  'Não se aplica. Pedido apenas do cordão com prendedor.',
]

/** Lista genérica (pedido interno do escritório — PedidoExtraDialog). O link do líder usa os tamanhos de cada peça. */
export const TAMANHOS_SUGERIDOS = [
  'P', 'M', 'G', 'GG', 'XGG', 'XXGG', 'EG', 'Único', '8', '9',
  '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46',
]

// ---------- Dados públicos devolvidos por `carregar` ----------

export interface ItemPublico {
  id: string
  nome: string
  categoria: CategoriaPublica
  unidade: string
  validade_meses: number | null
  variacoes: { id: string; rotulo: string }[]
}

export interface KitPublico {
  item_id: string
  variacao_id: string | null
  quantidade: number
  periodicidade_meses: number
}

export interface ItemCeuPublico {
  id: string
  nome: string
  tipo: 'uniforme' | 'epi'
}

export interface PrecoSimples {
  item_id: string
  variacao_id: string | null
  preco: number
  vigente_desde: string
}

export interface ContextoPedido {
  hoje: string
  recebeLimpeza: boolean
  /**
   * Itens que podem ser pedidos. No navegador: os do kit + os escolhidos na
   * busca "Preciso de outro item". No servidor: o catálogo ativo inteiro
   * (nunca devolvido ao link).
   */
  catalogo: ItemPublico[]
  kit: KitPublico[]
  /** Itens CEU (um por tamanho) das peças do contrato. */
  itensCeu: ItemCeuPublico[]
  /** Peças do kit de uniforme do contrato (tamanhos válidos por item). */
  pecas?: PecaPublica[]
  /** Equipe do contrato (ref opaco + nome curto). */
  equipe?: MembroEquipePublico[]
  /** item_id → última competência (AAAA-MM-DD) em que o item foi entregue/aprovado ao contrato. */
  ultimasEntregas: Record<string, string>
  precos?: PrecoSimples[]
}

// ---------- Saída para a RPC mat_registrar_envio ----------

export interface LinhaProdutoRpc {
  item_id: string | null
  variacao_id: string | null
  descricao_livre: string | null
  qtd_kit: number | null
  qtd_pedida: number
  preco_unitario: number | null
  justificativa: string | null
  excecao_acima_kit: boolean
  excecao_validade: boolean
  excecao_fora_kit: boolean
  ultima_entrega_em: string | null
}

export interface LinhaCeuRpc {
  tipo: TipoLinhaCeu
  /** Identificador opaco da equipe; o servidor troca por colaborador_id. */
  colaborador_ref: string | null
  nome_digitado: string
  item_id: string | null
  tamanho: string | null
  qtd_pedida: number
  cracha_nome: string | null
  cracha_motivo: string | null
  cracha_cordao: boolean | null
}

/** Erro ligado a uma linha (chave do formulário) e a um campo — a tela mostra ao lado do campo. */
export interface ErroCampo {
  chave: string | null
  campo: string
  mensagem: string
}

export interface ResultadoValidacaoPedido {
  ok: boolean
  erros: string[]
  errosCampo: ErroCampo[]
  seuNome: string
  observacao: string | null
  termos: Record<string, boolean>
  produtos: LinhaProdutoRpc[]
  ceu: LinhaCeuRpc[]
}

// ---------- Utilitários ----------

export function normalizarTextoPedido(texto: string | null | undefined): string {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function somarMeses(data: string, meses: number): string {
  const [a, m, d] = data.slice(0, 10).split('-').map(Number)
  const total = a * 12 + (m - 1) + meses
  const ano = Math.floor(total / 12)
  const mes = (total % 12) + 1
  const ultimo = new Date(ano, mes, 0).getDate()
  const dia = Math.min(d, ultimo)
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

function numero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number(valor.trim().replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

const arred2 = (n: number) => Math.round(n * 100) / 100

// ---------- Janela do pedido (dia 1 ao dia limite; reabertura) ----------

export interface JanelaPublica {
  competencia: string
  prazo: string
  dentroDoPrazo: boolean
  reaberta: boolean
  aberta: boolean
}

export function janelaPublica(hoje: string, diaLimite = 15, reabertoAte: string | null = null): JanelaPublica {
  const competencia = hoje.slice(0, 7) + '-01'
  const dia = Number(hoje.slice(8, 10))
  const prazo = `${hoje.slice(0, 8)}${String(diaLimite).padStart(2, '0')}`
  const dentroDoPrazo = dia <= diaLimite
  const reaberta = !dentroDoPrazo && !!reabertoAte && reabertoAte >= hoje
  return { competencia, prazo, dentroDoPrazo, reaberta, aberta: dentroDoPrazo || reaberta }
}

// ---------- Kit e exceções ----------

/** Quantidade do kit para o item/variação (variação exata; senão a linha do item sem variação). */
export function qtdKitPublico(kit: KitPublico[], itemId: string | null, variacaoId: string | null): number | null {
  if (!itemId) return null
  const exato = kit.find((k) => k.item_id === itemId && (k.variacao_id ?? null) === (variacaoId ?? null))
  if (exato) return Number(exato.quantidade)
  const base = kit.find((k) => k.item_id === itemId && k.variacao_id == null)
  return base ? Number(base.quantidade) : null
}

/** Teto de sanidade: 10× o kit (mínimo 10), nunca acima de 999. */
export function tetoQuantidade(qtdKit: number | null): number {
  if (qtdKit != null && qtdKit > 0) {
    return Math.min(LIMITES_PEDIDO.qtdMaxima, Math.max(10, qtdKit * LIMITES_PEDIDO.fatorKit))
  }
  return LIMITES_PEDIDO.qtdMaxima
}

export interface ExcecoesLinha {
  qtdKit: number | null
  acimaKit: boolean
  validade: boolean
  foraKit: boolean
  exigeJustificativa: boolean
}

export function excecoesLinhaPedido(
  ctx: Pick<ContextoPedido, 'kit' | 'catalogo' | 'ultimasEntregas' | 'hoje'>,
  itemId: string | null,
  variacaoId: string | null,
  quantidade: number
): ExcecoesLinha {
  const qtdKit = qtdKitPublico(ctx.kit, itemId, variacaoId)
  const foraKit = quantidade > 0 && qtdKit == null
  const acimaKit = qtdKit != null && quantidade > qtdKit
  let validade = false
  const item = itemId ? ctx.catalogo.find((c) => c.id === itemId) : undefined
  const ultima = itemId ? ctx.ultimasEntregas[itemId] : undefined
  if (quantidade > 0 && item?.validade_meses && ultima) {
    validade = somarMeses(ultima, item.validade_meses) > ctx.hoje
  }
  return { qtdKit, acimaKit, validade, foraKit, exigeJustificativa: acimaKit || validade || foraKit }
}

export function motivoExcecao(e: ExcecoesLinha): string {
  const motivos: string[] = []
  if (e.foraKit) motivos.push('fora do kit')
  if (e.acimaKit) motivos.push(`acima do kit (${e.qtdKit})`)
  if (e.validade) motivos.push('antes da validade do último')
  return motivos.join(', ')
}

const fmtQtd = (n: number) => String(arred2(n)).replace('.', ',')

/**
 * Pergunta amigável da justificativa (a tela mostra em vermelho, com o campo
 * logo abaixo). Ex.: "Você pediu 8, mas o kit do mês é 5. Pode contar para a
 * gente o motivo?"
 */
export function perguntaJustificativa(e: ExcecoesLinha, quantidade: number): string {
  if (e.foraKit) return 'Este item não faz parte do kit do posto. Pode contar para a gente por que precisa dele?'
  if (e.acimaKit && e.validade)
    return `Você pediu ${fmtQtd(quantidade)}, mas o kit do mês é ${fmtQtd(e.qtdKit ?? 0)} e o último ainda está no prazo de uso. Pode contar para a gente o motivo?`
  if (e.acimaKit) return `Você pediu ${fmtQtd(quantidade)}, mas o kit do mês é ${fmtQtd(e.qtdKit ?? 0)}. Pode contar para a gente o motivo?`
  if (e.validade) return 'O último deste item ainda está no prazo de uso. Pode contar para a gente por que precisa trocar?'
  return ''
}

/**
 * Linhas iniciais do formulário: o Kit Mensal do contrato (só produtos).
 * Item com periodicidade N (> 1) já entregue nos N-1 meses anteriores começa
 * em 0 (o líder pode aumentar, com justificativa se passar do kit).
 */
export function linhasIniciaisDoKit(
  ctx: Pick<ContextoPedido, 'kit' | 'catalogo' | 'ultimasEntregas' | 'hoje' | 'recebeLimpeza'>
): { item_id: string; variacao_id: string | null; quantidade: number }[] {
  const competencia = ctx.hoje.slice(0, 7) + '-01'
  const ordem = new Map(ctx.catalogo.map((c, i) => [c.id, i]))
  return ctx.kit
    .filter((k) => {
      const item = ctx.catalogo.find((c) => c.id === k.item_id)
      if (!item) return false
      return ctx.recebeLimpeza || item.categoria === 'portaria'
    })
    .map((k) => {
      let quantidade = Number(k.quantidade)
      const ultima = ctx.ultimasEntregas[k.item_id]
      if (k.periodicidade_meses > 1 && ultima) {
        const inicio = somarMeses(competencia, -(k.periodicidade_meses - 1))
        if (ultima >= inicio && ultima < competencia) quantidade = 0
      }
      return { item_id: k.item_id, variacao_id: k.variacao_id ?? null, quantidade }
    })
    .sort((a, b) => (ordem.get(a.item_id) ?? 0) - (ordem.get(b.item_id) ?? 0))
}

/** Preço vigente na data: o da variação prevalece sobre o do item. */
export function precoVigentePedido(
  precos: PrecoSimples[],
  itemId: string,
  variacaoId: string | null,
  data: string
): number | null {
  const maisRecente = (lista: PrecoSimples[]) =>
    lista
      .filter((p) => p.vigente_desde <= data)
      .sort((a, b) => (a.vigente_desde < b.vigente_desde ? 1 : a.vigente_desde > b.vigente_desde ? -1 : 0))[0]
  const doItem = precos.filter((p) => p.item_id === itemId)
  const daVariacao = variacaoId ? maisRecente(doItem.filter((p) => p.variacao_id === variacaoId)) : undefined
  const base = daVariacao ?? maisRecente(doItem.filter((p) => p.variacao_id == null))
  return base ? Number(base.preco) : null
}

// ---------- Linhas de uniforme/EPI/crachá ----------

/**
 * Linha de uniforme/EPI/crachá sem nada escolhido — é IGNORADA (não é erro
 * nem pendência). Uniforme/EPI: sem peça e sem tamanho (a pessoa sozinha não
 * é pedido). Crachá: sem pessoa, sem nome, sem motivo.
 */
export function linhaCeuVazia(c: Record<string, unknown>): boolean {
  if (c.tipo === 'cracha') {
    return !texto(c.colaborador_ref) && !texto(c.nome_digitado) && !texto(c.cracha_nome) && !texto(c.cracha_motivo)
  }
  return !texto(c.item_id) && !texto(c.tamanho)
}

/** Tamanhos válidos para o item (pelas peças do contrato); null = qualquer (sem peças no contexto). */
export function tamanhosDoItemCeu(pecas: PecaPublica[] | undefined, itemId: string): string[] | null {
  if (!pecas) return null
  const tamanhos: string[] = []
  for (const p of pecas) for (const o of p.opcoes) if (o.item_id === itemId) tamanhos.push(o.tamanho)
  return tamanhos
}

// ---------- Validação do envio (cliente e servidor) ----------

export function validarEnvioPedido(entrada: unknown, ctx: ContextoPedido): ResultadoValidacaoPedido {
  const errosCampo: ErroCampo[] = []
  const erro = (chave: string | null, campo: string, mensagem: string) => errosCampo.push({ chave, campo, mensagem })
  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>

  const seuNome = texto(e.seu_nome)
  if (seuNome.length < 2) erro(null, 'seu_nome', 'Informe o seu nome.')
  else if (seuNome.length > LIMITES_PEDIDO.nome) erro(null, 'seu_nome', `O seu nome passa de ${LIMITES_PEDIDO.nome} caracteres.`)

  const obs = texto(e.observacao)
  if (obs.length > LIMITES_PEDIDO.texto) erro(null, 'observacao', `A observação passa de ${LIMITES_PEDIDO.texto} caracteres.`)

  const termosEntrada = (e.termos && typeof e.termos === 'object' ? e.termos : {}) as Record<string, unknown>
  const termos: Record<string, boolean> = {}
  for (const t of TERMOS_PEDIDO) termos[t.id] = termosEntrada[t.id] === true

  // ---- Produtos ----
  const produtosEntrada = Array.isArray(e.produtos) ? e.produtos : []
  if (produtosEntrada.length > LIMITES_PEDIDO.linhasProdutos) erro(null, 'geral', 'Pedido com linhas de produto demais.')
  const catalogo = new Map(ctx.catalogo.map((c) => [c.id, c]))
  const agrupados = new Map<
    string,
    { item: ItemPublico; variacao_id: string | null; qtd: number; justificativas: string[]; chave: string | null }
  >()
  const livres: LinhaProdutoRpc[] = []

  for (const bruto of produtosEntrada.slice(0, LIMITES_PEDIDO.linhasProdutos)) {
    const p = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
    const chave = texto(p.chave) || null
    const qtd = numero(p.quantidade)
    const itemId = texto(p.item_id) || null
    const nomeLinha = itemId ? catalogo.get(itemId)?.nome ?? 'Item' : texto(p.descricao_livre) || 'Outro item'
    if (qtd == null || qtd < 0) {
      erro(chave, 'quantidade', `${nomeLinha}: quantidade inválida.`)
      continue
    }
    if (qtd === 0) continue
    const justificativa = texto(p.justificativa)
    if (justificativa.length > LIMITES_PEDIDO.texto) erro(chave, 'justificativa', `${nomeLinha}: justificativa passa de ${LIMITES_PEDIDO.texto} caracteres.`)

    if (!itemId) {
      // Texto livre ("Não achei, enviar assim"): sempre exceção fora do kit,
      // o inspetor decide o item.
      const descricao = texto(p.descricao_livre)
      if (!descricao) {
        erro(chave, 'descricao', 'Outro item: escreva o que precisa.')
        continue
      }
      if (descricao.length > LIMITES_PEDIDO.nome) erro(chave, 'descricao', `Outro item: descrição passa de ${LIMITES_PEDIDO.nome} caracteres.`)
      if (qtd > LIMITES_PEDIDO.qtdMaxima) erro(chave, 'quantidade', `${descricao}: quantidade acima do permitido (${LIMITES_PEDIDO.qtdMaxima}).`)
      if (!justificativa) erro(chave, 'justificativa', `${descricao}: conte para a gente por que precisa (item fora do kit).`)
      livres.push({
        item_id: null,
        variacao_id: null,
        descricao_livre: descricao.slice(0, LIMITES_PEDIDO.nome),
        qtd_kit: null,
        qtd_pedida: arred2(qtd),
        preco_unitario: null,
        justificativa: justificativa || null,
        excecao_acima_kit: false,
        excecao_validade: false,
        excecao_fora_kit: true,
        ultima_entrega_em: null,
      })
      continue
    }

    const item = catalogo.get(itemId)
    if (!item) {
      erro(chave, 'geral', 'Há um item que não está mais no catálogo. Recarregue a página.')
      continue
    }
    if (!ctx.recebeLimpeza && item.categoria !== 'portaria') continue
    const variacaoId = texto(p.variacao_id) || null
    if (variacaoId && !item.variacoes.some((v) => v.id === variacaoId)) {
      erro(chave, 'variacao', `${item.nome}: opção inválida. Recarregue a página.`)
      continue
    }
    if (!variacaoId && item.variacoes.length > 0 && qtdKitPublico(ctx.kit, item.id, null) == null) {
      erro(chave, 'variacao', `${item.nome}: escolha a opção.`)
      continue
    }
    const chaveGrupo = `${item.id}|${variacaoId ?? ''}`
    const atual = agrupados.get(chaveGrupo)
    if (atual) {
      atual.qtd += qtd
      if (justificativa) atual.justificativas.push(justificativa)
    } else {
      agrupados.set(chaveGrupo, { item, variacao_id: variacaoId, qtd, justificativas: justificativa ? [justificativa] : [], chave })
    }
  }

  const produtos: LinhaProdutoRpc[] = []
  for (const g of agrupados.values()) {
    const qtd = arred2(g.qtd)
    const exc = excecoesLinhaPedido(ctx, g.item.id, g.variacao_id, qtd)
    const rotulo = g.variacao_id ? g.item.variacoes.find((v) => v.id === g.variacao_id)?.rotulo : null
    const nome = rotulo ? `${g.item.nome} (${rotulo})` : g.item.nome
    const teto = tetoQuantidade(exc.qtdKit)
    if (qtd > teto) erro(g.chave, 'quantidade', `${nome}: quantidade acima do permitido (${teto}).`)
    const justificativa = g.justificativas.join(' / ').slice(0, LIMITES_PEDIDO.texto)
    if (exc.exigeJustificativa && !justificativa) erro(g.chave, 'justificativa', `${nome}: conte para a gente o motivo (${motivoExcecao(exc)}).`)
    produtos.push({
      item_id: g.item.id,
      variacao_id: g.variacao_id,
      descricao_livre: null,
      qtd_kit: exc.qtdKit,
      qtd_pedida: qtd,
      preco_unitario: ctx.precos ? precoVigentePedido(ctx.precos, g.item.id, g.variacao_id, ctx.hoje) : null,
      justificativa: justificativa || null,
      excecao_acima_kit: exc.acimaKit,
      excecao_validade: exc.validade,
      excecao_fora_kit: exc.foraKit,
      ultima_entrega_em: ctx.ultimasEntregas[g.item.id] ?? null,
    })
  }
  produtos.push(...livres)

  // ---- Uniforme, EPI e crachá ----
  const ceuEntrada = (Array.isArray(e.ceu) ? e.ceu : []).filter(
    (b) => !linhaCeuVazia((b && typeof b === 'object' ? b : {}) as Record<string, unknown>)
  )
  if (ceuEntrada.length > LIMITES_PEDIDO.linhasCeu) erro(null, 'geral', 'Pedido com linhas de uniforme/EPI/crachá demais.')
  const itensCeu = new Map(ctx.itensCeu.map((i) => [i.id, i]))
  const equipe = ctx.equipe ? new Map(ctx.equipe.map((m) => [m.ref, m])) : null
  const ceu: LinhaCeuRpc[] = []
  ceuEntrada.slice(0, LIMITES_PEDIDO.linhasCeu).forEach((bruto, i) => {
    const c = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
    const chave = texto(c.chave) || null
    const tipo = c.tipo
    const rotuloLinha = `${tipo === 'cracha' ? 'Crachá' : 'Uniforme/EPI'} ${i + 1}`
    if (tipo !== 'uniforme' && tipo !== 'epi' && tipo !== 'cracha') {
      erro(chave, 'geral', `${rotuloLinha}: tipo inválido.`)
      return
    }

    // Pessoa: da lista da equipe (ref opaco) ou "outra pessoa" (nome digitado).
    let ref = texto(c.colaborador_ref) || null
    let nome = texto(c.nome_digitado)
    if (ref) {
      const membro = equipe?.get(ref)
      if (equipe && !membro) {
        erro(chave, 'pessoa', `${rotuloLinha}: a pessoa escolhida não está mais na lista. Recarregue a página.`)
        ref = null
      } else if (membro) {
        nome = membro.nome
      }
    }
    if (!ref && tipo === 'cracha' && !nome) nome = texto(c.cracha_nome)
    if (!nome) erro(chave, 'pessoa', `${rotuloLinha}: escolha para quem é.`)
    else if (nome.length > LIMITES_PEDIDO.nome) erro(chave, 'pessoa', `${rotuloLinha}: nome passa de ${LIMITES_PEDIDO.nome} caracteres.`)
    const qtdBruta = c.quantidade == null || c.quantidade === '' ? 1 : numero(c.quantidade)
    const qtd = qtdBruta == null ? NaN : qtdBruta
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > LIMITES_PEDIDO.qtdCeuMaxima) {
      erro(chave, 'quantidade', `${rotuloLinha}: quantidade deve ser de 1 a ${LIMITES_PEDIDO.qtdCeuMaxima}.`)
    }

    if (tipo === 'cracha') {
      const crachaNome = texto(c.cracha_nome)
      const motivo = texto(c.cracha_motivo)
      // Pessoa da equipe: o nome do crachá pode ficar em branco (o escritório
      // usa o do cadastro). "Outra pessoa": o nome digitado vai no crachá.
      if (!ref && !crachaNome && !nome) erro(chave, 'cracha_nome', `${rotuloLinha}: informe o nome que vai no crachá.`)
      if (crachaNome.length > LIMITES_PEDIDO.crachaNome) erro(chave, 'cracha_nome', `${rotuloLinha}: nome do crachá passa de ${LIMITES_PEDIDO.crachaNome} caracteres.`)
      if (!MOTIVOS_CRACHA.includes(motivo)) erro(chave, 'motivo', `${rotuloLinha}: escolha o motivo.`)
      ceu.push({
        tipo,
        colaborador_ref: ref,
        nome_digitado: nome.slice(0, LIMITES_PEDIDO.nome),
        item_id: null,
        tamanho: null,
        qtd_pedida: Number.isInteger(qtd) ? qtd : 1,
        cracha_nome: crachaNome.slice(0, LIMITES_PEDIDO.crachaNome) || (ref ? null : nome.slice(0, LIMITES_PEDIDO.crachaNome) || null),
        cracha_motivo: motivo.slice(0, LIMITES_PEDIDO.nome) || null,
        cracha_cordao: c.cracha_cordao === true,
      })
      return
    }

    const itemId = texto(c.item_id)
    const item = itemId ? itensCeu.get(itemId) : undefined
    if (!item || item.tipo !== tipo) erro(chave, 'peca', `${rotuloLinha}: escolha a peça na lista.`)
    const tamanho = texto(c.tamanho)
    if (tamanho.length > LIMITES_PEDIDO.tamanho) erro(chave, 'tamanho', `${rotuloLinha}: tamanho passa de ${LIMITES_PEDIDO.tamanho} caracteres.`)
    if (item) {
      const validos = tamanhosDoItemCeu(ctx.pecas, item.id)
      if (validos && validos.some((t) => t !== '')) {
        if (!tamanho) erro(chave, 'tamanho', `${rotuloLinha}: escolha o tamanho.`)
        else if (!validos.includes(tamanho)) erro(chave, 'tamanho', `${rotuloLinha}: tamanho fora da lista desta peça.`)
      }
    }
    ceu.push({
      tipo,
      colaborador_ref: ref,
      nome_digitado: nome.slice(0, LIMITES_PEDIDO.nome),
      item_id: item ? item.id : null,
      tamanho: tamanho.slice(0, LIMITES_PEDIDO.tamanho) || null,
      qtd_pedida: Number.isInteger(qtd) ? qtd : 1,
      cracha_nome: null,
      cracha_motivo: null,
      cracha_cordao: null,
    })
  })

  if (produtos.length === 0 && ceu.length === 0) erro(null, 'vazio', 'O pedido está vazio: informe ao menos um item.')

  const secoes = secoesUsadas(produtos, ceu, ctx.catalogo, ctx.recebeLimpeza)
  const semTermo = TERMOS_PEDIDO.filter((t) => secoes.includes(t.id) && !termos[t.id])
  if (semTermo.length > 0) erro(null, 'termos', 'Marque a declaração de cada parte do pedido antes de enviar.')

  return {
    ok: errosCampo.length === 0,
    erros: errosCampo.map((x) => x.mensagem),
    errosCampo,
    seuNome,
    observacao: obs ? obs.slice(0, LIMITES_PEDIDO.texto) : null,
    termos,
    produtos,
    ceu,
  }
}

/**
 * Seções com linhas no envio — cada uma exige a sua declaração. Texto livre
 * conta como "materiais" (ou "portaria", no contrato que não recebe limpeza).
 */
export function secoesUsadas(
  produtos: { item_id: string | null }[],
  ceu: { tipo: TipoLinhaCeu }[],
  catalogo: ItemPublico[],
  recebeLimpeza = true
): SecaoPedido[] {
  const usadas = new Set<SecaoPedido>()
  for (const p of produtos) {
    const cat = p.item_id ? catalogo.find((c) => c.id === p.item_id)?.categoria : recebeLimpeza ? null : 'portaria'
    usadas.add(cat === 'portaria' ? 'portaria' : 'materiais')
  }
  for (const c of ceu) usadas.add(c.tipo)
  return TERMOS_PEDIDO.map((t) => t.id).filter((id) => usadas.has(id))
}

// ---------- Resumo do mês (sem dados pessoais) ----------

export interface EnvioResumo {
  tipo_pedido: 'mensal' | 'extra'
  origem: 'original' | 'complemento'
  seu_nome: string
  enviado_em: string
}

export interface ResumoMes {
  envios: EnvioResumo[]
  produtos: { descricao: string; unidade: string | null; quantidade: number }[]
  contagem: { uniforme_epi: number; cracha: number }
}

export function montarResumoMes(
  envios: EnvioResumo[],
  linhasProdutos: { item_id: string | null; variacao_id: string | null; descricao_livre: string | null; qtd_pedida: number }[],
  linhasCeu: { tipo: string }[],
  nomes: { itens: Record<string, { nome: string; unidade: string }>; variacoes: Record<string, string> }
): ResumoMes {
  const mapa = new Map<string, { descricao: string; unidade: string | null; quantidade: number }>()
  for (const l of linhasProdutos) {
    const qtd = Number(l.qtd_pedida) || 0
    if (qtd <= 0) continue
    let chave: string
    let descricao: string
    let unidade: string | null = null
    if (l.item_id) {
      const item = nomes.itens[l.item_id]
      const rotulo = l.variacao_id ? nomes.variacoes[l.variacao_id] : null
      chave = `${l.item_id}|${l.variacao_id ?? ''}`
      descricao = (item?.nome ?? 'Item') + (rotulo ? ` (${rotulo})` : '')
      unidade = item?.unidade ?? null
    } else {
      descricao = (l.descricao_livre ?? 'Outros materiais').trim()
      chave = `livre|${normalizarTextoPedido(descricao)}`
    }
    const atual = mapa.get(chave)
    if (atual) atual.quantidade = arred2(atual.quantidade + qtd)
    else mapa.set(chave, { descricao, unidade, quantidade: arred2(qtd) })
  }
  return {
    envios: [...envios].sort((a, b) => (a.enviado_em < b.enviado_em ? -1 : a.enviado_em > b.enviado_em ? 1 : 0)),
    produtos: [...mapa.values()].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')),
    contagem: {
      uniforme_epi: linhasCeu.filter((l) => l.tipo === 'uniforme' || l.tipo === 'epi').length,
      cracha: linhasCeu.filter((l) => l.tipo === 'cracha').length,
    },
  }
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function nomeMes(competencia: string): string {
  return MESES[Number(competencia.slice(5, 7)) - 1] ?? ''
}

/** dd/mm de um instante, no horário de Brasília. */
export function diaMesBrasilia(iso: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(
    new Date(iso)
  )
  return partes
}

/** "Pedido de outubro enviado em 03/10 por Maria" (null se ainda não houve envio). */
export function tituloResumo(resumo: ResumoMes, competencia: string): string | null {
  const primeiro = resumo.envios[0]
  if (!primeiro) return null
  return `Pedido de ${nomeMes(competencia)} enviado em ${diaMesBrasilia(primeiro.enviado_em)} por ${primeiro.seu_nome}`
}

/** Texto do aviso sobre o próximo envio (mescla até aprovar/conferir; depois, pedido extra). */
export function textoDestino(destino: { produtos: DestinoFilaPublico; ceu: DestinoFilaPublico }): string | null {
  const { produtos, ceu } = destino
  if (produtos === 'novo' && ceu === 'novo') return null
  if (produtos === 'mesclar' && ceu === 'mesclar') return 'Um novo envio será somado ao pedido deste mês.'
  if (produtos === 'extra' && ceu === 'extra') return 'O pedido deste mês já foi conferido: um novo envio vira pedido extra.'
  const p = produtos === 'extra' ? 'produtos viram pedido extra' : 'produtos são somados ao pedido do mês'
  const c = ceu === 'extra' ? 'uniformes, EPIs e crachás viram pedido extra' : 'uniformes, EPIs e crachás são somados ao pedido do mês'
  return `Num novo envio, ${p}; ${c}.`
}
