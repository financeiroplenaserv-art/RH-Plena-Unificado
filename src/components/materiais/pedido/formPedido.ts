// Estado do formulário da tela pública do líder (/pedido/:token).
import { linhasIniciaisDoKit, type ContextoPedido, type ErroCampo, type ExcecoesLinha, type ItemPublico, type PartePedido } from '@/lib/materiais/pedidoLider'
import type { PecaPublica } from '@/lib/materiais/pecasCeu'
import { nomeLiderItem } from '@/lib/materiais/buscaItens'

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
  /**
   * kit = linha do Kit Mensal (o que o posto vai receber; só diminui);
   * mais = quantidade A MAIS de um item do kit (pedido extra);
   * busca = "Preciso de outro item"; livre = "Não achei, enviar assim".
   */
  origem: 'kit' | 'mais' | 'busca' | 'livre'
}

/**
 * Nome da linha na tela do líder: nome amigável com a variação ("Vassoura
 * Noviça", "Flanela Microfibra amarela"); texto livre = o que a pessoa
 * escreveu.
 */
export function nomeDaLinhaProduto(
  l: Pick<LinhaProdutoForm, 'item_id' | 'variacao_id' | 'descricao_livre'>,
  item?: Pick<ItemPublico, 'nome' | 'variacoes' | 'nome_lider'> | null
): string {
  if (!l.item_id) return l.descricao_livre?.trim() || 'Outro item'
  if (!item) return 'Item'
  const rotulo = l.variacao_id ? item.variacoes.find((v) => v.id === l.variacao_id)?.rotulo : null
  // nome_lider (migration 136) vence o nome do cadastro.
  return nomeLiderItem(item, rotulo)
}

/** Parte do pedido da linha: só a linha do kit é 'kit'; o resto é pedido extra. */
export const parteDaLinha = (l: Pick<LinhaProdutoForm, 'origem'>): PartePedido => (l.origem === 'kit' ? 'kit' : 'extra')

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
  /** 3 = kit confirmável + extras (16/10/2026). Rascunho 2 é convertido em reconciliarRascunhoComKit. */
  versao: 2 | 3
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
    // Linha do kit vai mesmo com 0 ("Não preciso este mês" — o inspetor vê
    // que o líder tirou); extra só com quantidade.
    produtos: r.produtos
      .filter((l) => l.origem === 'kit' || qtdNumero(l.quantidade) > 0)
      .map((l) => ({
        chave: l.chave,
        parte: parteDaLinha(l),
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
    return r && (r.versao === 2 || r.versao === 3) && Array.isArray(r.produtos) && Array.isArray(r.pecas) && Array.isArray(r.pessoas) ? r : null
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

const PREFIXO_RASCUNHO = 'corh:pedido-lider:'
const FORMATO_CHAVE_RASCUNHO = /^corh:pedido-lider:v2e?:[^:]+:(\d{4}-\d{2}-\d{2})$/
const chaveIdEnvio = (token: string, competencia: string) => `corh:pedido-lider:v2e:${token.slice(0, 12)}:${competencia}`

/**
 * Id da tentativa de envio (migration 143), guardado no aparelho até dar certo: se a rede
 * falhar DEPOIS de o servidor gravar, o reenvio do MESMO conteúdo reaproveita o id e o
 * servidor devolve o mesmo resultado sem duplicar linhas. Se o líder mudou algo entre as
 * tentativas, o conteúdo é outro e nasce um id novo. Sem armazenamento, gera um id solto.
 */
export function idEnvioDaTentativa(token: string, competencia: string, conteudo: string): string {
  const novo = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(16).padStart(8, '0')}-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`)
  try {
    const chave = chaveIdEnvio(token, competencia)
    const guardado = JSON.parse(localStorage.getItem(chave) ?? 'null') as { id?: string; conteudo?: string } | null
    if (guardado?.id && guardado.conteudo === conteudo) return guardado.id
    const id = novo()
    localStorage.setItem(chave, JSON.stringify({ id, conteudo }))
    return id
  } catch {
    return novo()
  }
}

/**
 * Faz a faxina dos rascunhos deste aparelho ao abrir o link (16/10/2026):
 * apaga os de competências passadas (de qualquer contrato), os de chave ou
 * versão de formato incompatível e os ilegíveis. O rascunho da competência
 * corrente (ou futura) fica. Devolve quantos apagou. Nunca lança.
 */
export function limparRascunhosAntigos(competenciaAtual: string): number {
  try {
    const chaves: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIXO_RASCUNHO)) chaves.push(k)
    }
    let apagados = 0
    for (const k of chaves) {
      const competencia = FORMATO_CHAVE_RASCUNHO.exec(k)?.[1]
      let apagar = !competencia || competencia < competenciaAtual
      if (!apagar && !k.startsWith('corh:pedido-lider:v2e:')) {
        try {
          const r = JSON.parse(localStorage.getItem(k) ?? 'null') as { versao?: number } | null
          apagar = !r || (r.versao !== 2 && r.versao !== 3)
        } catch {
          apagar = true
        }
      }
      if (apagar) {
        localStorage.removeItem(k)
        apagados++
      }
    }
    return apagados
  } catch {
    return 0
  }
}

export function apagarRascunho(token: string, competencia: string) {
  try {
    localStorage.removeItem(chaveRascunho(token, competencia))
    localStorage.removeItem(chaveIdEnvio(token, competencia))
  } catch {
    // idem
  }
}

type CtxKit = Pick<ContextoPedido, 'kit' | 'catalogo' | 'ultimasEntregas' | 'hoje' | 'recebeLimpeza' | 'kitConfirmado'>

const secaoDoItem = (ctx: Pick<ContextoPedido, 'catalogo'>, itemId: string): SecaoProduto =>
  ctx.catalogo.find((c) => c.id === itemId)?.categoria === 'portaria' ? 'portaria' : 'materiais'

/**
 * Linhas do "Seu kit do mês" (já com a quantidade que o posto vai receber).
 * Item que não vem este mês (periodicidade) fica de fora; kit já confirmado
 * no mês = nenhuma linha (o novo envio só traz extras).
 */
export function linhasKitDoForm(ctx: CtxKit): LinhaProdutoForm[] {
  if (ctx.kitConfirmado) return []
  return linhasIniciaisDoKit(ctx)
    .filter((k) => k.quantidade > 0)
    .map((k) => ({
      chave: novaChave(),
      item_id: k.item_id,
      variacao_id: k.variacao_id,
      descricao_livre: '',
      quantidade: String(k.quantidade),
      justificativa: '',
      secao: secaoDoItem(ctx, k.item_id),
      origem: 'kit' as const,
    }))
}

/** Itens do kit que NÃO vêm este mês (periodicidade) — a tela só avisa. */
export function itensKitForaDoMes(ctx: CtxKit): string[] {
  if (ctx.kitConfirmado) return []
  return linhasIniciaisDoKit(ctx).filter((k) => k.quantidade === 0).map((k) => k.item_id)
}

/** Quantidade máxima da linha do kit (o kit do mês; nunca aumenta). */
export function maximoDaLinhaKit(ctx: CtxKit, l: Pick<LinhaProdutoForm, 'item_id' | 'variacao_id'>): number {
  const linhas = linhasIniciaisDoKit(ctx).filter((x) => x.item_id === l.item_id)
  const k = linhas.find((x) => x.variacao_id === (l.variacao_id ?? null)) ?? linhas.find((x) => x.variacao_id == null)
  return k?.quantidade ?? 0
}

/**
 * Rascunho do aparelho × kit carregado agora (o kit pode ter mudado no meio
 * do mês, ou outro aparelho já ter confirmado o kit):
 * - linhas do kit: só as de itens que ainda estão no kit do mês (sem
 *   duplicar); a quantidade digitada é mantida até o kit do mês — o que
 *   passar (rascunho antigo, v2, em que o kit era editável para cima) vira
 *   uma linha "a mais" (pedido extra) com o motivo que o líder escreveu;
 * - itens novos do kit entram com a quantidade do kit;
 * - kit já confirmado no mês: as linhas do kit saem (o kit já vem);
 * - linhas "a mais"/busca/livre seguem (busca sem o item no rascunho sai —
 *   sem o ItemPublico ela não valida nem envia; "a mais" de item que saiu do
 *   catálogo também sai).
 */
export function reconciliarRascunhoComKit(
  rascunho: Pick<RascunhoPedido, 'produtos' | 'itensBusca'>,
  ctx: CtxKit
): Pick<RascunhoPedido, 'produtos' | 'itensBusca'> {
  // Linhas do kit do mês, por item E variação (o kit pode ter duas cores do
  // mesmo item). Linha do rascunho casa com a da mesma variação ou, se o kit
  // foi cadastrado sem variação ("qualquer cor"), com essa.
  const kitMes = (ctx.kitConfirmado ? [] : linhasIniciaisDoKit(ctx)).filter((k) => k.quantidade > 0)
  const chaveKit = (k: { item_id: string; variacao_id: string | null }) => `${k.item_id}|${k.variacao_id ?? ''}`
  const noCatalogo = new Set(ctx.catalogo.map((c) => c.id))
  const buscaPorId = new Map((rascunho.itensBusca ?? []).map((i) => [i.id, i]))
  const vistoKit = new Set<string>()
  const excedentes: LinhaProdutoForm[] = []
  const produtos: LinhaProdutoForm[] = []
  for (const l of rascunho.produtos ?? []) {
    const origem = (l.origem ?? 'kit') as LinhaProdutoForm['origem']
    if (origem === 'kit') {
      const daLinha = (k: (typeof kitMes)[number]) => k.item_id === l.item_id && !vistoKit.has(chaveKit(k))
      const k =
        kitMes.find((x) => daLinha(x) && x.variacao_id === (l.variacao_id ?? null)) ??
        kitMes.find((x) => daLinha(x) && x.variacao_id == null)
      if (!l.item_id || !k) continue
      vistoKit.add(chaveKit(k))
      const maximo = k.quantidade
      const qtd = qtdNumero(l.quantidade)
      if (qtd > maximo) {
        excedentes.push({
          ...l,
          chave: novaChave(),
          quantidade: String(Math.round((qtd - maximo) * 100) / 100),
          origem: 'mais',
        })
        produtos.push({ ...l, origem, quantidade: String(maximo), justificativa: '' })
      } else {
        produtos.push({ ...l, origem, justificativa: '' })
      }
      continue
    }
    if (origem === 'busca') {
      if (l.item_id && buscaPorId.has(l.item_id)) produtos.push(l)
      continue
    }
    if (origem === 'mais') {
      if (l.item_id && (noCatalogo.has(l.item_id) || buscaPorId.has(l.item_id))) produtos.push(l)
      continue
    }
    produtos.push(l)
  }
  const novas = linhasKitDoForm(ctx).filter((k) => k.item_id && !vistoKit.has(chaveKit({ item_id: k.item_id, variacao_id: k.variacao_id })))
  // Ordem da tela: kit primeiro, depois os extras.
  const kit = [...produtos.filter((l) => l.origem === 'kit'), ...novas]
  const extras = [...produtos.filter((l) => l.origem !== 'kit'), ...excedentes]
  return { produtos: [...kit, ...extras], itensBusca: rascunho.itensBusca ?? [] }
}

/** Pergunta curta (sem jargão) do motivo do extra. */
export function perguntaSimples(e: Pick<ExcecoesLinha, 'foraKit' | 'acimaKit'>, quantidade: number): string {
  if (e.foraKit) return 'Este item não vem todo mês. Por que você precisa?'
  if (e.acimaKit) return `Você está pedindo ${String(Math.round(quantidade * 100) / 100).replace('.', ',')} a mais. Por que precisa?`
  return ''
}

// ---------------- Quadros recolhíveis (16/10/2026) ----------------

/** Equipe em ordem alfabética (pt-BR, sem peso de acento/caixa); não altera a lista original. */
export function ordenarEquipe<T extends { nome: string }>(equipe: T[]): T[] {
  return [...equipe].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
}

const fmtQtd = (texto: string): string => {
  const n = qtdNumero(texto)
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/** Linha resumida do extra: "Flanela Microfibra amarela — 2". */
export const resumoLinhaProduto = (nome: string, quantidade: string): string => `${nome} — ${fmtQtd(quantidade)}`

/** Linha resumida de uniforme/EPI: "Walace D. · Bota PVC 41 — 1". */
export const resumoLinhaPeca = (pessoa: string, peca: string, tamanho: string, quantidade: string): string =>
  `${pessoa} · ${peca}${tamanho ? ` ${tamanho}` : ''} — ${fmtQtd(quantidade)}`

const MOTIVO_CURTO: Record<string, string> = {
  'Desgaste natural': 'desgaste',
  'Quebra no encaixe do prendedor': 'quebra no prendedor',
  Perda: 'perda',
  'Quebra por descuido': 'quebra por descuido',
}

/** Linha resumida do crachá: "Crachá · Dagno S. — perda". */
export const resumoLinhaCracha = (nome: string, motivo: string): string =>
  `Crachá · ${nome} — ${MOTIVO_CURTO[motivo] ?? (motivo.startsWith('Não se aplica') ? 'só o cordão' : 'sem motivo')}`
