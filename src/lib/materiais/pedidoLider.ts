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
// e recalcula as exceções.
//
// Conceito do Kit Mensal (decisão da gestão, 16/10/2026): o kit é o que o
// posto VAI RECEBER. O líder só confirma — pode tirar ("Não preciso este
// mês") ou diminuir, nunca aumentar nessa parte, sem precisar de motivo.
// Tudo o que passa do kit é PEDIDO EXTRA (parte 'extra'): item fora do kit,
// texto livre ou a quantidade A MAIS de um item do kit (linha separada). O
// motivo do extra é OPCIONAL (o inspetor vê o extra destacado, com ou sem
// motivo). "Antes da validade" virou só aviso interno. As linhas do kit
// (parte 'kit') saem aprovadas automaticamente quando a configuração
// materiais_config.kit_aprovacao_automatica está ligada (padrão) — a RPC
// mat_registrar_envio decide (migration 135).

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

/**
 * Uniforme e EPI andam juntos na mesma etapa: a tela mostra UMA caixa só
 * (marcar vale para as duas declarações, que o servidor segue exigindo).
 */
export const TERMO_UNIFORME_EPI =
  "Declaro que as informações acima são verdadeiras e me comprometo a manter e zelar pelo uniforme e a utilizar, manter e conservar os EPI's de acordo com as normas de segurança."

/** Junta uniforme + EPI numa declaração só quando os dois pedem; o resto fica como está. */
export function agruparDeclaracoes(secoes: SecaoPedido[]): (SecaoPedido | 'uniforme_epi')[] {
  const junta = secoes.includes('uniforme') && secoes.includes('epi')
  const saida: (SecaoPedido | 'uniforme_epi')[] = []
  for (const s of secoes) {
    if (junta && s === 'uniforme') saida.push('uniforme_epi')
    else if (junta && s === 'epi') continue
    else saida.push(s)
  }
  return saida
}

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
  /** Nome no link do líder (migration 136); ausente/NULL = nome do cadastro sem a unidade. */
  nome_lider?: string | null
}

/**
 * Item como o SERVIDOR lê do catálogo (nunca vai assim para o link): com a
 * marcação de variação oculta e a lista de contratos exclusivos (migration 136).
 */
export interface ItemCatalogoServidor extends Omit<ItemPublico, 'variacoes'> {
  variacoes: { id: string; rotulo: string; oculta_lider?: boolean }[]
  contratos_exclusivos?: string[] | null
  /** Contratos para os quais o item fica ESCONDIDO no link (migration 137). */
  contratos_ocultos?: string[] | null
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
  /**
   * O kit deste mês já foi confirmado (há linhas 'kit' no pedido mensal da
   * competência): um novo envio só traz extras — qualquer linha de kit vira
   * extra no servidor.
   */
  kitConfirmado?: boolean
  /**
   * Itens exclusivos de OUTROS contratos (migration 136): linha com eles é
   * recusada no envio (o link nunca os oferece). Calculado por visaoDoLider.
   */
  indisponiveis?: string[]
}

/**
 * O que o líder vê do catálogo e do kit (migration 136, decisões da gestora
 * de 16/10/2026). Lógica pura usada pela Edge Function em `carregar`,
 * `buscar_item` e `enviar` — o filtro é do SERVIDOR.
 *
 * - Variação oculta (é marca: "Mop Cabeleira Pequena" Max Teck/Starclean)
 *   some da lista. Linha do kit com variação oculta vira linha do ITEM
 *   (variacao_id null; duas marcas no kit somam numa linha só, vale a menor
 *   periodicidade). Com TODAS as variações ocultas o item fica sem variação e
 *   a linha é gravada com variacao_id null.
 * - Item exclusivo de outros contratos (contratos_exclusivos preenchido sem
 *   este contrato) sai do catálogo e entra em `indisponiveis` — EXCETO se o
 *   gestor o pôs no kit deste contrato (a tela interna avisa sem bloquear; a
 *   escolha do gestor vale).
 * - Item escondido para este contrato (contratos_ocultos, migration 137: ex.
 *   "Esponja dupla face" na CNOOC) sai do catálogo igual ao exclusivo de
 *   outro contrato, com a mesma exceção do kit.
 * - `nome_lider` segue no item (o navegador mostra; a busca agrupa).
 */
export function visaoDoLider(
  catalogo: ItemCatalogoServidor[],
  kit: KitPublico[],
  contratoId: string | null
): { catalogo: ItemPublico[]; kit: KitPublico[]; indisponiveis: string[] } {
  const noKit = new Set(kit.map((k) => k.item_id))
  const ocultas = new Set<string>()
  const indisponiveis: string[] = []
  const visiveis: ItemPublico[] = []
  for (const item of catalogo) {
    const lista = item.contratos_exclusivos ?? []
    const escondido = !!contratoId && (item.contratos_ocultos ?? []).includes(contratoId)
    if (
      ((lista.length > 0 && (!contratoId || !lista.includes(contratoId))) || escondido) &&
      !noKit.has(item.id)
    ) {
      indisponiveis.push(item.id)
      continue
    }
    for (const v of item.variacoes) if (v.oculta_lider) ocultas.add(v.id)
    visiveis.push({
      id: item.id,
      nome: item.nome,
      categoria: item.categoria,
      unidade: item.unidade,
      validade_meses: item.validade_meses,
      variacoes: item.variacoes.filter((v) => !v.oculta_lider).map((v) => ({ id: v.id, rotulo: v.rotulo })),
      ...(item.nome_lider ? { nome_lider: item.nome_lider } : {}),
    })
  }
  const kitLider: KitPublico[] = []
  const porChave = new Map<string, KitPublico>()
  for (const k of kit) {
    const variacao = k.variacao_id && ocultas.has(k.variacao_id) ? null : k.variacao_id ?? null
    const chave = `${k.item_id}|${variacao ?? ''}`
    const atual = porChave.get(chave)
    if (atual) {
      atual.quantidade = Math.round((atual.quantidade + k.quantidade) * 100) / 100
      atual.periodicidade_meses = Math.min(atual.periodicidade_meses, k.periodicidade_meses)
      continue
    }
    const linha = { ...k, variacao_id: variacao }
    porChave.set(chave, linha)
    kitLider.push(linha)
  }
  return { catalogo: visiveis, kit: kitLider, indisponiveis }
}

/**
 * Item do catálogo buscável que vai para o celular (decisão da gestora,
 * 16/10/2026: a busca "O que mais você precisa?" roda no aparelho). Só nomes:
 * nunca preço, fornecedor, contratos exclusivos nem a marcação de oculta.
 * Compatível com `ItemBuscavel` de buscaItens.ts.
 */
export interface ItemBuscavelPublico extends ItemPublico {
  /** Nomes antigos do item + rótulos das marcas ocultas (só como termo de busca). */
  aliases?: string[]
  aliasesPorVariacao?: Record<string, string[]>
  noKit?: boolean
  variacoesNoKit?: string[]
}

/**
 * Catálogo buscável do contrato, na visão do líder (mesma que o `enviar`
 * aplica): sem itens inativos (o catálogo do servidor já vem só com ativos),
 * sem exclusivos de outro contrato, sem variação oculta, restrito ao que o
 * contrato pode pedir (sem limpeza: só portaria). Função pura usada pelo
 * `carregar` e pelo `buscar_item` do servidor.
 */
export function catalogoBuscavelDoLider(
  catalogo: ItemCatalogoServidor[],
  kit: KitPublico[],
  aliases: { nome_legado: string; item_id: string; variacao_id: string | null }[],
  contratoId: string | null,
  recebeLimpeza: boolean
): ItemBuscavelPublico[] {
  const visao = visaoDoLider(catalogo, kit, contratoId)
  const candidatos = recebeLimpeza ? visao.catalogo : visao.catalogo.filter((c) => c.categoria === 'portaria')
  const ids = new Set(candidatos.map((c) => c.id))
  const variacoesVisiveis = new Set(candidatos.flatMap((c) => c.variacoes.map((v) => v.id)))
  const aliasesPorItem = new Map<string, string[]>()
  const aliasesPorVariacao = new Map<string, Record<string, string[]>>()
  // Marca oculta ("Max Teck"): o líder não vê, mas pode digitar — o rótulo
  // entra como termo de busca do item inteiro.
  for (const item of catalogo) {
    if (!ids.has(item.id)) continue
    for (const v of item.variacoes) {
      if (!v.oculta_lider || !v.rotulo) continue
      const lista = aliasesPorItem.get(item.id) ?? []
      lista.push(v.rotulo)
      aliasesPorItem.set(item.id, lista)
    }
  }
  for (const a of aliases) {
    if (!ids.has(a.item_id)) continue
    // Alias de variação oculta (marca) vale para o item inteiro.
    if (a.variacao_id && variacoesVisiveis.has(a.variacao_id)) {
      const porVar = aliasesPorVariacao.get(a.item_id) ?? {}
      ;(porVar[a.variacao_id] ??= []).push(a.nome_legado)
      aliasesPorVariacao.set(a.item_id, porVar)
      continue
    }
    const lista = aliasesPorItem.get(a.item_id) ?? []
    lista.push(a.nome_legado)
    aliasesPorItem.set(a.item_id, lista)
  }
  // Kit do contrato: só desempate (a busca procura no kit E no catálogo).
  const kitItem = new Set<string>()
  const kitVariacoes = new Map<string, string[]>()
  for (const k of visao.kit) {
    if (!k.variacao_id) kitItem.add(k.item_id)
    else kitVariacoes.set(k.item_id, [...(kitVariacoes.get(k.item_id) ?? []), k.variacao_id])
  }
  return candidatos.map((c) => ({
    ...c,
    aliases: aliasesPorItem.get(c.id) ?? [],
    aliasesPorVariacao: aliasesPorVariacao.get(c.id) ?? {},
    noKit: kitItem.has(c.id),
    variacoesNoKit: kitVariacoes.get(c.id) ?? [],
  }))
}

/** Parte da linha de produto: o kit do mês (vai receber) ou o pedido extra. */
export type PartePedido = 'kit' | 'extra'

// ---------- Saída para a RPC mat_registrar_envio ----------

export interface LinhaProdutoRpc {
  parte: PartePedido
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
  /** Kit do mês (parte kit) ou kit cadastrado/do mês (parte extra); null = fora do kit. */
  qtdKit: number | null
  acimaKit: boolean
  /** Aviso INTERNO (não é mostrado ao líder e não exige motivo desde 16/10/2026). */
  validade: boolean
  foraKit: boolean
  /** Pedido extra: a tela sugere contar o motivo (OPCIONAL — nunca trava o envio). */
  pedeMotivo: boolean
}

/**
 * Linhas do kit do mês: o Kit Mensal do contrato (só produtos). Item com
 * periodicidade N (> 1) já entregue nos N-1 meses anteriores fica em 0 (não
 * vem este mês; se precisar, o líder pede como extra).
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

/**
 * Quantidade do KIT DO MÊS para o item/variação (variação exata; senão a linha
 * do item sem variação), já com a periodicidade aplicada. null = o item não
 * está no kit (ou o kit do mês já foi confirmado — ctx.kitConfirmado).
 */
export function qtdKitDoMes(
  ctx: Pick<ContextoPedido, 'kit' | 'catalogo' | 'ultimasEntregas' | 'hoje' | 'recebeLimpeza' | 'kitConfirmado'>,
  itemId: string | null,
  variacaoId: string | null
): number | null {
  if (!itemId || ctx.kitConfirmado) return null
  const linhas = linhasIniciaisDoKit(ctx)
  const exato = linhas.find((k) => k.item_id === itemId && k.variacao_id === (variacaoId ?? null))
  if (exato) return exato.quantidade
  const base = linhas.find((k) => k.item_id === itemId && k.variacao_id == null)
  return base ? base.quantidade : null
}

function validadeNaoVencida(
  ctx: Pick<ContextoPedido, 'catalogo' | 'ultimasEntregas' | 'hoje'>,
  itemId: string | null,
  quantidade: number
): boolean {
  const item = itemId ? ctx.catalogo.find((c) => c.id === itemId) : undefined
  const ultima = itemId ? ctx.ultimasEntregas[itemId] : undefined
  if (quantidade > 0 && item?.validade_meses && ultima) return somarMeses(ultima, item.validade_meses) > ctx.hoje
  return false
}

/**
 * Exceções de uma linha. Parte 'kit': nunca é exceção (o servidor separa o
 * que passar do kit do mês como extra); só o aviso interno de validade.
 * Parte 'extra': acima do kit (item do kit) ou fora do kit (item fora dele).
 */
export function excecoesLinhaPedido(
  ctx: Pick<ContextoPedido, 'kit' | 'catalogo' | 'ultimasEntregas' | 'hoje' | 'recebeLimpeza' | 'kitConfirmado'>,
  itemId: string | null,
  variacaoId: string | null,
  quantidade: number,
  parte: PartePedido = 'extra'
): ExcecoesLinha {
  const validade = validadeNaoVencida(ctx, itemId, quantidade)
  const kitMes = qtdKitDoMes(ctx, itemId, variacaoId)
  if (parte === 'kit') return { qtdKit: kitMes, acimaKit: false, validade, foraKit: false, pedeMotivo: false }
  const kitBase = qtdKitPublico(ctx.kit, itemId, variacaoId)
  const acimaKit = quantidade > 0 && kitBase != null
  const foraKit = quantidade > 0 && kitBase == null
  return { qtdKit: kitMes ?? kitBase, acimaKit, validade, foraKit, pedeMotivo: acimaKit || foraKit }
}

export function motivoExcecao(e: ExcecoesLinha): string {
  const motivos: string[] = []
  if (e.foraKit) motivos.push('fora do kit')
  if (e.acimaKit) motivos.push('a mais do kit')
  if (e.validade) motivos.push('antes da validade do último')
  return motivos.join(', ')
}

const fmtQtd = (n: number) => String(arred2(n)).replace('.', ',')

/**
 * Convite para contar o motivo do extra (OPCIONAL). Ex.: "Você está pedindo 3
 * a mais do que o kit. Se puder, conte para a gente o motivo."
 */
export function perguntaMotivo(e: ExcecoesLinha, quantidade: number): string {
  if (e.foraKit) return 'Este item não está no kit do posto. Se puder, conte para a gente por que precisa.'
  if (e.acimaKit) return `Você está pedindo ${fmtQtd(quantidade)} a mais do que o kit. Se puder, conte para a gente o motivo.`
  return ''
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
  // Parte 'kit' (ou ausente — cliente antigo): até a quantidade do kit do
  // mês é kit; o que passar vira linha EXTRA separada (sem erro). Parte
  // 'extra': sempre extra. Linha de kit com 0 ("Não preciso este mês") é
  // registrada para o inspetor ver que o líder tirou o item.
  const produtosEntrada = Array.isArray(e.produtos) ? e.produtos : []
  if (produtosEntrada.length > LIMITES_PEDIDO.linhasProdutos) erro(null, 'geral', 'Pedido com linhas de produto demais.')
  const catalogo = new Map(ctx.catalogo.map((c) => [c.id, c]))
  const agrupados = new Map<
    string,
    {
      item: ItemPublico
      variacao_id: string | null
      kit: number
      extra: number
      temKit: boolean
      justificativas: string[]
      chave: string | null
    }
  >()
  const livres: LinhaProdutoRpc[] = []

  for (const bruto of produtosEntrada.slice(0, LIMITES_PEDIDO.linhasProdutos)) {
    const p = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
    const chave = texto(p.chave) || null
    const qtd = numero(p.quantidade)
    const parte: PartePedido = p.parte === 'extra' ? 'extra' : 'kit'
    const itemId = texto(p.item_id) || null
    const nomeLinha = itemId ? catalogo.get(itemId)?.nome ?? 'Item' : texto(p.descricao_livre) || 'Outro item'
    if (qtd == null || qtd < 0) {
      erro(chave, 'quantidade', `${nomeLinha}: quantidade inválida.`)
      continue
    }
    if (qtd === 0 && (parte === 'extra' || !itemId)) continue
    const justificativa = texto(p.justificativa)
    if (justificativa.length > LIMITES_PEDIDO.texto) erro(chave, 'justificativa', `${nomeLinha}: motivo passa de ${LIMITES_PEDIDO.texto} caracteres.`)

    if (!itemId) {
      // Texto livre ("Não achei, enviar assim"): sempre extra fora do kit,
      // o inspetor decide o item. Motivo opcional.
      const descricao = texto(p.descricao_livre)
      if (!descricao) {
        erro(chave, 'descricao', 'Outro item: escreva o que precisa.')
        continue
      }
      if (descricao.length > LIMITES_PEDIDO.nome) erro(chave, 'descricao', `Outro item: descrição passa de ${LIMITES_PEDIDO.nome} caracteres.`)
      if (qtd > LIMITES_PEDIDO.qtdMaxima) erro(chave, 'quantidade', `${descricao}: quantidade acima do permitido (${LIMITES_PEDIDO.qtdMaxima}).`)
      livres.push({
        parte: 'extra',
        item_id: null,
        variacao_id: null,
        descricao_livre: descricao.slice(0, LIMITES_PEDIDO.nome),
        qtd_kit: null,
        qtd_pedida: arred2(qtd),
        preco_unitario: null,
        justificativa: justificativa.slice(0, LIMITES_PEDIDO.texto) || null,
        excecao_acima_kit: false,
        excecao_validade: false,
        excecao_fora_kit: true,
        ultima_entrega_em: null,
      })
      continue
    }

    if (ctx.indisponiveis?.includes(itemId)) {
      // Item exclusivo de outro contrato (migration 136): recusado, nunca
      // convertido em texto livre — o link não oferece esse item, então só
      // chega aqui por cliente adulterado ou link aberto há muito tempo.
      erro(chave, 'geral', 'Há um item que não está disponível para este posto. Recarregue a página.')
      continue
    }
    const item = catalogo.get(itemId)
    if (!item) {
      erro(chave, 'geral', 'Há um item que não está mais no catálogo. Recarregue a página.')
      continue
    }
    if (!ctx.recebeLimpeza && item.categoria !== 'portaria') {
      if (qtd > 0) erro(chave, 'geral', `${item.nome}: este posto recebe apenas material de portaria.`)
      continue
    }
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
    const atual =
      agrupados.get(chaveGrupo) ??
      { item, variacao_id: variacaoId, kit: 0, extra: 0, temKit: false, justificativas: [] as string[], chave }
    if (parte === 'kit') {
      atual.kit += qtd
      atual.temKit = true
    } else {
      atual.extra += qtd
    }
    if (justificativa) atual.justificativas.push(justificativa)
    agrupados.set(chaveGrupo, atual)
  }

  const linhasKit: LinhaProdutoRpc[] = []
  const linhasExtra: LinhaProdutoRpc[] = []
  for (const g of agrupados.values()) {
    const kitMes = qtdKitDoMes(ctx, g.item.id, g.variacao_id)
    const kitBase = qtdKitPublico(ctx.kit, g.item.id, g.variacao_id)
    const qtdKit = kitMes != null && kitMes > 0 ? arred2(Math.min(g.kit, kitMes)) : 0
    const qtdExtra = arred2(g.extra + g.kit - qtdKit)
    const rotulo = g.variacao_id ? g.item.variacoes.find((v) => v.id === g.variacao_id)?.rotulo : null
    const nome = rotulo ? `${g.item.nome} (${rotulo})` : g.item.nome
    const teto = tetoQuantidade(kitBase)
    if (qtdKit + qtdExtra > teto) erro(g.chave, 'quantidade', `${nome}: quantidade acima do permitido (${teto}).`)
    const preco = ctx.precos ? precoVigentePedido(ctx.precos, g.item.id, g.variacao_id, ctx.hoje) : null
    const ultima = ctx.ultimasEntregas[g.item.id] ?? null
    if (g.temKit && kitMes != null && kitMes > 0) {
      linhasKit.push({
        parte: 'kit',
        item_id: g.item.id,
        variacao_id: g.variacao_id,
        descricao_livre: null,
        qtd_kit: kitMes,
        qtd_pedida: qtdKit,
        preco_unitario: preco,
        justificativa: null,
        excecao_acima_kit: false,
        excecao_validade: validadeNaoVencida(ctx, g.item.id, qtdKit),
        excecao_fora_kit: false,
        ultima_entrega_em: ultima,
      })
    }
    if (qtdExtra > 0) {
      const exc = excecoesLinhaPedido(ctx, g.item.id, g.variacao_id, qtdExtra, 'extra')
      linhasExtra.push({
        parte: 'extra',
        item_id: g.item.id,
        variacao_id: g.variacao_id,
        descricao_livre: null,
        qtd_kit: exc.qtdKit,
        qtd_pedida: qtdExtra,
        preco_unitario: preco,
        justificativa: g.justificativas.join(' / ').slice(0, LIMITES_PEDIDO.texto) || null,
        excecao_acima_kit: exc.acimaKit,
        excecao_validade: exc.validade,
        excecao_fora_kit: exc.foraKit,
        ultima_entrega_em: ultima,
      })
    }
  }
  const produtos: LinhaProdutoRpc[] = [...linhasKit, ...linhasExtra, ...livres]

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

  // Envio vazio NÃO é erro (decisão de 17/10/2026): o líder pode concluir sem
  // pedir nada — fica registrado como "o posto não precisa de nada este mês".
  // A tela mostra uma observação amigável (`envioSemPedido`).

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
 * O envio não pede nada? (nenhuma linha de produto com quantidade, nenhum
 * uniforme/EPI/crachá). Vale para o envio sem linhas e para o kit todo
 * zerado com "Não preciso este mês". Só informativo — nunca bloqueia.
 */
export function envioSemPedido(
  produtos: { qtd_pedida: number }[],
  ceu: unknown[]
): boolean {
  return ceu.length === 0 && produtos.every((p) => !(p.qtd_pedida > 0))
}

/** Texto amigável para a revisão final quando não há nada pedido. */
export const AVISO_ENVIO_SEM_PEDIDO = 'Você não pediu nada este mês. Pode enviar assim mesmo.'

/**
 * Seções com linhas no envio — cada uma exige a sua declaração. Texto livre
 * conta como "materiais" (ou "portaria", no contrato que não recebe limpeza).
 * Linha com quantidade 0 (item do kit que o líder tirou) não conta.
 */
export function secoesUsadas(
  produtos: { item_id: string | null; qtd_pedida?: number }[],
  ceu: { tipo: TipoLinhaCeu }[],
  catalogo: ItemPublico[],
  recebeLimpeza = true
): SecaoPedido[] {
  const usadas = new Set<SecaoPedido>()
  for (const p of produtos) {
    if (p.qtd_pedida === 0) continue
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
  if (resumo.produtos.length === 0 && resumo.contagem.uniforme_epi === 0 && resumo.contagem.cracha === 0) {
    return `Em ${diaMesBrasilia(primeiro.enviado_em)}, ${primeiro.seu_nome} avisou que o posto não precisa de nada em ${nomeMes(competencia)}`
  }
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
