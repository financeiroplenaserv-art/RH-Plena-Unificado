// Edge Function: pedido-materiais
// Link público do líder (QR code no quadro do contrato) para o pedido mensal
// de materiais, uniformes, EPIs, crachás e kit portaria —
// docs/PLANO_MATERIAIS_FASE1.md §4. SEM login e SEM PIN (decisão da gestão,
// 09/10/2026): por isso nada de dado pessoal sai daqui.
//
// Ações (POST, campo `acao`):
//   públicas (token do link):  carregar, enviar
//   internas (JWT admin/adm/gestor — materiais.gerenciar_links):
//                              gerar_link, ver_link, revogar_link
//
// Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (padrão da plataforma) e
// ENCRYPTION_KEY (já existe — mesma da function econtador; cifra o token para
// o escritório reexibir o link/QR). Opcional: ALLOWED_ORIGINS.
//
// Deploy (verify_jwt false — a chamada pública não tem JWT):
//   powershell scripts/lib/implantar-edge-function.ps1 -Slug pedido-materiais -Arquivo supabase/functions/pedido-materiais/index.ts
//
// O bloco "LÓGICA PURA" abaixo é cópia de src/lib/materiais/pedidoLider.ts
// (deploy de arquivo único). Não edite aqui: edite o arquivo de src e rode
// `node scripts/sincronizar-pedido-materiais.mjs`.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'

// CORS — chamada pelo navegador (tela pública e tela Contratos). Mesmo padrão
// das functions econtador/suporte/sync-performancelab. NÃO REMOVER.
function getAllowedOrigins(): string[] {
  const env = Deno.env.get('ALLOWED_ORIGINS')
  if (!env) return []
  return env.split(',').map((o) => o.trim()).filter(Boolean)
}

function getCorsHeaders(origin: string): Record<string, string> {
  const allowed = getAllowedOrigins()
  const allowOrigin = allowed.length === 0 ? origin : (allowed.includes(origin) ? origin : allowed[0])
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  }
}

// >>> LÓGICA PURA (cópia de src/lib/materiais/pedidoLider.ts — não editar aqui)
// Pedido do líder pelo link público (/pedido/:token) — lógica pura.
//
// ESTE ARQUIVO É COPIADO, SEM ALTERAÇÃO, PARA DENTRO DA EDGE FUNCTION
// supabase/functions/pedido-materiais/index.ts (o deploy é de arquivo único).
// Por isso não tem nenhum import. Ao mudar aqui, rode
// `node scripts/sincronizar-pedido-materiais.mjs` — o teste
// pedidoLider.test.ts falha se as duas cópias divergirem.
//
// Regras (docs/PLANO_MATERIAIS_FASE1.md §4): o link é público, então nada de
// dado pessoal sai daqui (sem equipe, tamanhos cadastrados, CPF, preço). O
// cliente não é confiável: o servidor revalida tudo com validarEnvioPedido e
// recalcula as exceções (acima do kit, antes da validade, fora do kit), que
// exigem justificativa mas NÃO bloqueiam o pedido — vão para o inspetor.

export type CategoriaPublica = 'limpeza' | 'portaria' | 'outros'
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
  catalogo: ItemPublico[]
  kit: KitPublico[]
  itensCeu: ItemCeuPublico[]
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
  nome_digitado: string
  item_id: string | null
  tamanho: string | null
  qtd_pedida: number
  cracha_nome: string | null
  cracha_motivo: string | null
  cracha_cordao: boolean | null
}

export interface ResultadoValidacaoPedido {
  ok: boolean
  erros: string[]
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

// ---------- Validação do envio (cliente e servidor) ----------

export function validarEnvioPedido(entrada: unknown, ctx: ContextoPedido): ResultadoValidacaoPedido {
  const erros: string[] = []
  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>

  const seuNome = texto(e.seu_nome)
  if (seuNome.length < 2) erros.push('Informe o seu nome.')
  else if (seuNome.length > LIMITES_PEDIDO.nome) erros.push(`O seu nome passa de ${LIMITES_PEDIDO.nome} caracteres.`)

  const obs = texto(e.observacao)
  if (obs.length > LIMITES_PEDIDO.texto) erros.push(`A observação passa de ${LIMITES_PEDIDO.texto} caracteres.`)

  const termosEntrada = (e.termos && typeof e.termos === 'object' ? e.termos : {}) as Record<string, unknown>
  const termos: Record<string, boolean> = {}
  for (const t of TERMOS_PEDIDO) termos[t.id] = termosEntrada[t.id] === true

  // ---- Produtos ----
  const produtosEntrada = Array.isArray(e.produtos) ? e.produtos : []
  if (produtosEntrada.length > LIMITES_PEDIDO.linhasProdutos) erros.push('Pedido com linhas de produto demais.')
  const catalogo = new Map(ctx.catalogo.map((c) => [c.id, c]))
  const agrupados = new Map<string, { item: ItemPublico; variacao_id: string | null; qtd: number; justificativas: string[] }>()
  const livres: LinhaProdutoRpc[] = []

  for (const bruto of produtosEntrada.slice(0, LIMITES_PEDIDO.linhasProdutos)) {
    const p = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
    const qtd = numero(p.quantidade)
    const itemId = texto(p.item_id) || null
    const nomeLinha = itemId ? catalogo.get(itemId)?.nome ?? 'Item' : texto(p.descricao_livre) || 'Outros materiais'
    if (qtd == null || qtd < 0) {
      erros.push(`${nomeLinha}: quantidade inválida.`)
      continue
    }
    if (qtd === 0) continue
    const justificativa = texto(p.justificativa)
    if (justificativa.length > LIMITES_PEDIDO.texto) erros.push(`${nomeLinha}: justificativa passa de ${LIMITES_PEDIDO.texto} caracteres.`)

    if (!itemId) {
      if (!ctx.recebeLimpeza) continue
      const descricao = texto(p.descricao_livre)
      if (!descricao) {
        erros.push('Outros materiais: descreva o item.')
        continue
      }
      if (descricao.length > LIMITES_PEDIDO.nome) erros.push(`Outros materiais: descrição passa de ${LIMITES_PEDIDO.nome} caracteres.`)
      if (qtd > LIMITES_PEDIDO.qtdMaxima) erros.push(`${descricao}: quantidade acima do permitido (${LIMITES_PEDIDO.qtdMaxima}).`)
      if (!justificativa) erros.push(`${descricao}: justifique (item fora do kit).`)
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
      erros.push('Há um item que não está mais no catálogo. Recarregue a página.')
      continue
    }
    if (!ctx.recebeLimpeza && item.categoria !== 'portaria') continue
    const variacaoId = texto(p.variacao_id) || null
    if (variacaoId && !item.variacoes.some((v) => v.id === variacaoId)) {
      erros.push(`${item.nome}: variação inválida. Recarregue a página.`)
      continue
    }
    if (!variacaoId && item.variacoes.length > 0 && qtdKitPublico(ctx.kit, item.id, null) == null) {
      erros.push(`${item.nome}: escolha a variação.`)
      continue
    }
    const chave = `${item.id}|${variacaoId ?? ''}`
    const atual = agrupados.get(chave)
    if (atual) {
      atual.qtd += qtd
      if (justificativa) atual.justificativas.push(justificativa)
    } else {
      agrupados.set(chave, { item, variacao_id: variacaoId, qtd, justificativas: justificativa ? [justificativa] : [] })
    }
  }

  const produtos: LinhaProdutoRpc[] = []
  for (const g of agrupados.values()) {
    const qtd = arred2(g.qtd)
    const exc = excecoesLinhaPedido(ctx, g.item.id, g.variacao_id, qtd)
    const rotulo = g.variacao_id ? g.item.variacoes.find((v) => v.id === g.variacao_id)?.rotulo : null
    const nome = rotulo ? `${g.item.nome} (${rotulo})` : g.item.nome
    const teto = tetoQuantidade(exc.qtdKit)
    if (qtd > teto) erros.push(`${nome}: quantidade acima do permitido (${teto}).`)
    const justificativa = g.justificativas.join(' / ').slice(0, LIMITES_PEDIDO.texto)
    if (exc.exigeJustificativa && !justificativa) erros.push(`${nome}: justifique (${motivoExcecao(exc)}).`)
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

  // ---- Uniforme, EPI e crachá (tudo digitado; nada vem do cadastro) ----
  const ceuEntrada = Array.isArray(e.ceu) ? e.ceu : []
  if (ceuEntrada.length > LIMITES_PEDIDO.linhasCeu) erros.push('Pedido com linhas de uniforme/EPI/crachá demais.')
  const itensCeu = new Map(ctx.itensCeu.map((i) => [i.id, i]))
  const ceu: LinhaCeuRpc[] = []
  ceuEntrada.slice(0, LIMITES_PEDIDO.linhasCeu).forEach((bruto, i) => {
    const c = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
    const tipo = c.tipo
    const rotuloLinha = `${tipo === 'cracha' ? 'Crachá' : 'Uniforme/EPI'} ${i + 1}`
    if (tipo !== 'uniforme' && tipo !== 'epi' && tipo !== 'cracha') {
      erros.push(`${rotuloLinha}: tipo inválido.`)
      return
    }
    // Crachá: o formulário pede só o nome que vai no crachá; ele também
    // serve de nome digitado para a identificação interna.
    const nome = texto(c.nome_digitado) || (tipo === 'cracha' ? texto(c.cracha_nome) : '')
    if (!nome) erros.push(`${rotuloLinha}: informe o nome do colaborador.`)
    else if (nome.length > LIMITES_PEDIDO.nome) erros.push(`${rotuloLinha}: nome passa de ${LIMITES_PEDIDO.nome} caracteres.`)
    const qtdBruta = c.quantidade == null || c.quantidade === '' ? 1 : numero(c.quantidade)
    const qtd = qtdBruta == null ? NaN : qtdBruta
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > LIMITES_PEDIDO.qtdCeuMaxima) {
      erros.push(`${rotuloLinha}: quantidade deve ser de 1 a ${LIMITES_PEDIDO.qtdCeuMaxima}.`)
    }

    if (tipo === 'cracha') {
      const crachaNome = texto(c.cracha_nome)
      const motivo = texto(c.cracha_motivo)
      if (!crachaNome) erros.push(`${rotuloLinha}: informe o nome que vai no crachá.`)
      else if (crachaNome.length > LIMITES_PEDIDO.crachaNome) erros.push(`${rotuloLinha}: nome do crachá passa de ${LIMITES_PEDIDO.crachaNome} caracteres.`)
      if (!MOTIVOS_CRACHA.includes(motivo)) erros.push(`${rotuloLinha}: escolha o motivo.`)
      ceu.push({
        tipo,
        nome_digitado: nome.slice(0, LIMITES_PEDIDO.nome),
        item_id: null,
        tamanho: null,
        qtd_pedida: Number.isInteger(qtd) ? qtd : 1,
        cracha_nome: crachaNome.slice(0, LIMITES_PEDIDO.crachaNome) || null,
        cracha_motivo: motivo.slice(0, LIMITES_PEDIDO.nome) || null,
        cracha_cordao: c.cracha_cordao === true,
      })
      return
    }

    const itemId = texto(c.item_id)
    const item = itemId ? itensCeu.get(itemId) : undefined
    if (!item || item.tipo !== tipo) erros.push(`${rotuloLinha}: escolha a peça na lista.`)
    const tamanho = texto(c.tamanho)
    if (tamanho.length > LIMITES_PEDIDO.tamanho) erros.push(`${rotuloLinha}: tamanho passa de ${LIMITES_PEDIDO.tamanho} caracteres.`)
    ceu.push({
      tipo,
      nome_digitado: nome.slice(0, LIMITES_PEDIDO.nome),
      item_id: item ? item.id : null,
      tamanho: tamanho.slice(0, LIMITES_PEDIDO.tamanho) || null,
      qtd_pedida: Number.isInteger(qtd) ? qtd : 1,
      cracha_nome: null,
      cracha_motivo: null,
      cracha_cordao: null,
    })
  })

  if (produtos.length === 0 && ceu.length === 0) erros.push('O pedido está vazio: informe ao menos um item.')

  const secoes = secoesUsadas(produtos, ceu, ctx.catalogo)
  const semTermo = TERMOS_PEDIDO.filter((t) => secoes.includes(t.id) && !termos[t.id])
  if (semTermo.length > 0) erros.push('Marque a declaração de cada parte do pedido antes de enviar.')

  return {
    ok: erros.length === 0,
    erros,
    seuNome,
    observacao: obs ? obs.slice(0, LIMITES_PEDIDO.texto) : null,
    termos,
    produtos,
    ceu,
  }
}

/** Seções com linhas no envio — cada uma exige a sua declaração. */
export function secoesUsadas(
  produtos: { item_id: string | null }[],
  ceu: { tipo: TipoLinhaCeu }[],
  catalogo: ItemPublico[]
): SecaoPedido[] {
  const usadas = new Set<SecaoPedido>()
  for (const p of produtos) {
    const cat = p.item_id ? catalogo.find((c) => c.id === p.item_id)?.categoria : null
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
// <<< FIM DA LÓGICA PURA

// ============================================================
// Infra
// ============================================================

const LIMITE_CHAMADAS_MINUTO = 30
const LIMITE_ENVIOS_HORA = 5
const PERFIS_LINKS = ['admin', 'adm', 'gestor']
const STATUS_PRODUTOS_ENTREGUE = ['aprovado', 'em_compra', 'entregue', 'entregue_parcial']
const PRODUTOS_ACEITAM_MESCLA = ['rascunho', 'nao_se_aplica', 'enviado', 'em_validacao', 'validado']
const CEU_ACEITA_MESCLA = ['nao_se_aplica', 'enviado', 'em_identificacao']

type Corpo = Record<string, unknown>

class ErroHttp extends Error {
  constructor(public status: number, public codigo: string, message: string, public detalhes?: string[]) {
    super(message)
  }
}

function hojeBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function ipDaRequisicao(req: Request): string | null {
  const bruto = req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0]
  const ip = (bruto || '').trim()
  // Só aceita o que o Postgres converte para inet sem erro.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || /^[0-9a-fA-F:]{2,45}$/.test(ip)) return ip
  return null
}

async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function novoToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)))
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  return bytes
}

async function chaveAes(uso: 'encrypt' | 'decrypt'): Promise<CryptoKey | null> {
  const hex = Deno.env.get('ENCRYPTION_KEY')
  if (!hex || hex.length !== 64) return null
  return crypto.subtle.importKey('raw', hexToBytes(hex), { name: 'AES-GCM', length: 256 }, false, [uso])
}

/** AES-256-GCM; formato "v1:<iv b64>:<cifra+tag b64>". */
async function cifrarToken(token: string): Promise<string | null> {
  const chave = await chaveAes('encrypt')
  if (!chave) return null
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cifra = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(token)))
  return `v1:${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...cifra))}`
}

async function decifrarToken(valor: string): Promise<string | null> {
  const chave = await chaveAes('decrypt')
  const [versao, ivB64, cifraB64] = valor.split(':')
  if (!chave || versao !== 'v1' || !ivB64 || !cifraB64) return null
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
  const cifra = Uint8Array.from(atob(cifraB64), (c) => c.charCodeAt(0))
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, chave, cifra)
  return new TextDecoder().decode(claro)
}

async function registrarLog(sb: SupabaseClient, contratoId: string | null, evento: string, ip: string | null, ua: string | null) {
  await sb.from('mat_acesso_log').insert({ contrato_id: contratoId, evento, ip, user_agent: ua ? ua.slice(0, 300) : null })
}

/** > 30 chamadas/min por IP; envios: > 5/h por IP. */
async function conferirLimite(sb: SupabaseClient, ip: string | null, envio: boolean, ua: string | null) {
  if (!ip) return
  const umMinuto = new Date(Date.now() - 60_000).toISOString()
  const { count } = await sb
    .from('mat_acesso_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', umMinuto)
  let estourou = (count ?? 0) >= LIMITE_CHAMADAS_MINUTO
  if (!estourou && envio) {
    const umaHora = new Date(Date.now() - 3_600_000).toISOString()
    const { count: envios } = await sb
      .from('mat_acesso_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .eq('evento', 'envio')
      .gte('created_at', umaHora)
    estourou = (envios ?? 0) >= LIMITE_ENVIOS_HORA
  }
  if (estourou) {
    await registrarLog(sb, null, 'limite_ip', ip, ua)
    throw new ErroHttp(429, 'limite', 'Muitas tentativas a partir desta conexão. Aguarde alguns minutos e tente de novo.')
  }
}

interface ContratoDoToken {
  id: string
  nome: string
  recebe_limpeza: boolean
}

async function contratoPorToken(sb: SupabaseClient, token: unknown): Promise<ContratoDoToken | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null
  const hash = await sha256Hex(token)
  const { data: acesso } = await sb
    .from('mat_contrato_acesso')
    .select('contrato_id')
    .eq('token_hash', hash)
    .eq('ativo', true)
    .maybeSingle()
  if (!acesso) return null
  const { data: contrato } = await sb
    .from('mat_contratos')
    .select('id, nome, recebe_limpeza, ativo')
    .eq('id', acesso.contrato_id)
    .maybeSingle()
  if (!contrato || !contrato.ativo) return null
  return { id: contrato.id, nome: contrato.nome, recebe_limpeza: contrato.recebe_limpeza }
}

async function lerConfig(sb: SupabaseClient): Promise<{ diaLimite: number }> {
  const { data } = await sb.from('configuracoes').select('valor').eq('chave', 'materiais_config').maybeSingle()
  try {
    const v = data?.valor ? (typeof data.valor === 'string' ? JSON.parse(data.valor) : data.valor) : {}
    const dia = Number(v?.dia_limite)
    return { diaLimite: Number.isInteger(dia) && dia >= 1 && dia <= 28 ? dia : 15 }
  } catch {
    return { diaLimite: 15 }
  }
}

async function janelaDoContrato(sb: SupabaseClient, contratoId: string, hoje: string): Promise<JanelaPublica> {
  const { diaLimite } = await lerConfig(sb)
  const competencia = hoje.slice(0, 7) + '-01'
  const { data: reab } = await sb
    .from('mat_reaberturas')
    .select('ate')
    .eq('contrato_id', contratoId)
    .eq('competencia', competencia)
    .gte('ate', hoje)
    .order('ate', { ascending: false })
    .limit(1)
  return janelaPublica(hoje, diaLimite, reab?.[0]?.ate ?? null)
}

/** Catálogo ativo + kit + peças do CEU + últimas entregas — o contexto da validação. */
async function contextoDoContrato(sb: SupabaseClient, contrato: ContratoDoToken, hoje: string, comPrecos: boolean): Promise<ContextoPedido> {
  const [rItens, rVar, rKit, rCeu, rHist, rPed] = await Promise.all([
    sb.from('mat_itens').select('id, nome, categoria, unidade_pedido, validade_meses, ordem').eq('ativo', true).order('ordem', { nullsFirst: false }).order('nome'),
    sb.from('mat_item_variacoes').select('id, item_id, rotulo, ordem').eq('ativo', true).order('ordem', { nullsFirst: false }).order('rotulo'),
    sb.from('mat_kit_itens').select('item_id, variacao_id, quantidade, periodicidade_meses').eq('contrato_id', contrato.id),
    sb.from('itens').select('id, nome, tipo, situacao').in('tipo', ['Uniforme', 'EPI']).order('nome'),
    sb.from('mat_historico_consumo').select('item_id, competencia, quantidade').eq('contrato_id', contrato.id).gt('quantidade', 0),
    sb.from('mat_pedidos').select('id, competencia').eq('contrato_id', contrato.id).in('status_produtos', STATUS_PRODUTOS_ENTREGUE),
  ])
  const erro = rItens.error ?? rVar.error ?? rKit.error ?? rCeu.error ?? rHist.error ?? rPed.error
  if (erro) throw new Error(erro.message)

  const variacoes = new Map<string, { id: string; rotulo: string }[]>()
  for (const v of rVar.data ?? []) {
    const lista = variacoes.get(v.item_id) ?? []
    lista.push({ id: v.id, rotulo: v.rotulo })
    variacoes.set(v.item_id, lista)
  }
  const catalogo: ItemPublico[] = (rItens.data ?? []).map((i) => ({
    id: i.id,
    nome: i.nome,
    categoria: i.categoria,
    unidade: i.unidade_pedido,
    validade_meses: i.validade_meses,
    variacoes: variacoes.get(i.id) ?? [],
  }))

  // Última entrega do item AO CONTRATO (base da exceção de validade e da
  // periodicidade). Fase 1 ainda não registra entrega de produtos: vale a
  // competência do último pedido aprovado e, antes dele, o histórico das planilhas.
  const ultimas: Record<string, string> = {}
  const marcar = (itemId: string | null, comp: string) => {
    if (itemId && (!ultimas[itemId] || ultimas[itemId] < comp)) ultimas[itemId] = comp
  }
  for (const h of rHist.data ?? []) marcar(h.item_id, h.competencia)
  const pedidos = new Map((rPed.data ?? []).map((p) => [p.id, p.competencia as string]))
  if (pedidos.size > 0) {
    const { data: linhas } = await sb
      .from('mat_pedido_itens')
      .select('pedido_id, item_id, qtd_pedida, qtd_aprovada')
      .in('pedido_id', [...pedidos.keys()])
      .not('item_id', 'is', null)
    for (const l of linhas ?? []) {
      if (Number(l.qtd_aprovada ?? l.qtd_pedida) > 0) marcar(l.item_id, pedidos.get(l.pedido_id)!)
    }
  }

  const ctx: ContextoPedido = {
    hoje,
    recebeLimpeza: contrato.recebe_limpeza,
    catalogo,
    kit: (rKit.data ?? []).map((k) => ({
      item_id: k.item_id,
      variacao_id: k.variacao_id,
      quantidade: Number(k.quantidade),
      periodicidade_meses: Number(k.periodicidade_meses ?? 1),
    })),
    itensCeu: (rCeu.data ?? [])
      .filter((i) => !i.situacao || String(i.situacao).toUpperCase() === 'A')
      .map((i) => ({ id: i.id, nome: i.nome, tipo: i.tipo === 'EPI' ? 'epi' : 'uniforme' })),
    ultimasEntregas: ultimas,
  }
  if (comPrecos) {
    const { data: precos } = await sb.from('mat_precos').select('item_id, variacao_id, preco, vigente_desde').lte('vigente_desde', hoje)
    ctx.precos = (precos ?? []).map((p) => ({ ...p, preco: Number(p.preco) }))
  }
  return ctx
}

/** Resumo do mês (sem nomes de colaboradores) + destino de um novo envio. */
async function resumoDoMes(sb: SupabaseClient, contratoId: string, competencia: string) {
  const { data: pedidos, error } = await sb
    .from('mat_pedidos')
    .select('id, tipo, status_produtos, status_ceu')
    .eq('contrato_id', contratoId)
    .eq('competencia', competencia)
    .neq('status_produtos', 'cancelado')
  if (error) throw new Error(error.message)
  const ids = (pedidos ?? []).map((p) => p.id)
  const tipoPorPedido = new Map((pedidos ?? []).map((p) => [p.id, p.tipo as 'mensal' | 'extra']))
  const mensal = (pedidos ?? []).find((p) => p.tipo === 'mensal') ?? null

  let envios: EnvioResumo[] = []
  let produtos: { item_id: string | null; variacao_id: string | null; descricao_livre: string | null; qtd_pedida: number }[] = []
  let ceu: { tipo: string }[] = []
  if (ids.length > 0) {
    const [rEnv, rProd, rCeu] = await Promise.all([
      sb.from('mat_pedido_envios').select('pedido_id, origem, seu_nome, enviado_em').in('pedido_id', ids),
      sb.from('mat_pedido_itens').select('item_id, variacao_id, descricao_livre, qtd_pedida').in('pedido_id', ids),
      sb.from('ceu_pedido_itens').select('tipo').in('pedido_id', ids).neq('status', 'cancelado'),
    ])
    envios = (rEnv.data ?? []).map((e) => ({
      tipo_pedido: tipoPorPedido.get(e.pedido_id) ?? 'mensal',
      origem: e.origem,
      seu_nome: e.seu_nome,
      enviado_em: e.enviado_em,
    }))
    produtos = (rProd.data ?? []).map((p) => ({ ...p, qtd_pedida: Number(p.qtd_pedida) }))
    ceu = rCeu.data ?? []
  }

  // Nomes de TODOS os itens citados (inclusive inativos hoje).
  const idsItens = [...new Set(produtos.map((p) => p.item_id).filter(Boolean))] as string[]
  const idsVar = [...new Set(produtos.map((p) => p.variacao_id).filter(Boolean))] as string[]
  const nomes = { itens: {} as Record<string, { nome: string; unidade: string }>, variacoes: {} as Record<string, string> }
  if (idsItens.length > 0) {
    const { data } = await sb.from('mat_itens').select('id, nome, unidade_pedido').in('id', idsItens)
    for (const i of data ?? []) nomes.itens[i.id] = { nome: i.nome, unidade: i.unidade_pedido }
  }
  if (idsVar.length > 0) {
    const { data } = await sb.from('mat_item_variacoes').select('id, rotulo').in('id', idsVar)
    for (const v of data ?? []) nomes.variacoes[v.id] = v.rotulo
  }

  const destino: { produtos: DestinoFilaPublico; ceu: DestinoFilaPublico } = mensal
    ? {
        produtos: PRODUTOS_ACEITAM_MESCLA.includes(mensal.status_produtos) ? 'mesclar' : 'extra',
        ceu: CEU_ACEITA_MESCLA.includes(mensal.status_ceu) ? 'mesclar' : 'extra',
      }
    : { produtos: 'novo', ceu: 'novo' }

  return { resumo: montarResumoMes(envios, produtos, ceu, nomes), destino }
}

// ============================================================
// Ações públicas
// ============================================================

async function acaoCarregar(sb: SupabaseClient, corpo: Corpo, ip: string | null, ua: string | null) {
  await conferirLimite(sb, ip, false, ua)
  const contrato = await contratoPorToken(sb, corpo.token)
  if (!contrato) {
    await registrarLog(sb, null, 'carregar', ip, ua)
    throw new ErroHttp(404, 'token_invalido', 'Link inválido ou substituído por um novo. Peça o link atualizado ao inspetor.')
  }
  await registrarLog(sb, contrato.id, 'carregar', ip, ua)
  const hoje = hojeBrasilia()
  const [janela, ctx] = await Promise.all([janelaDoContrato(sb, contrato.id, hoje), contextoDoContrato(sb, contrato, hoje, false)])
  const { resumo, destino } = await resumoDoMes(sb, contrato.id, janela.competencia)
  return {
    contrato: { nome: contrato.nome, recebe_limpeza: contrato.recebe_limpeza },
    hoje,
    janela,
    catalogo: ctx.recebeLimpeza ? ctx.catalogo : ctx.catalogo.filter((c) => c.categoria === 'portaria'),
    kit: ctx.kit,
    itens_ceu: ctx.itensCeu,
    ultimas_entregas: ctx.ultimasEntregas,
    resumo,
    destino,
  }
}

async function acaoEnviar(sb: SupabaseClient, corpo: Corpo, ip: string | null, ua: string | null) {
  await conferirLimite(sb, ip, true, ua)
  const contrato = await contratoPorToken(sb, corpo.token)
  if (!contrato) {
    await registrarLog(sb, null, 'envio_recusado', ip, ua)
    throw new ErroHttp(404, 'token_invalido', 'Link inválido ou substituído por um novo. Peça o link atualizado ao inspetor.')
  }
  const hoje = hojeBrasilia()
  const janela = await janelaDoContrato(sb, contrato.id, hoje)
  if (!janela.aberta) {
    await registrarLog(sb, contrato.id, 'envio_recusado', ip, ua)
    throw new ErroHttp(409, 'fora_janela', 'O prazo do pedido deste mês terminou. Fale com o inspetor.')
  }
  const ctx = await contextoDoContrato(sb, contrato, hoje, true)
  const v = validarEnvioPedido(corpo.pedido, ctx)
  if (!v.ok) {
    await registrarLog(sb, contrato.id, 'envio_recusado', ip, ua)
    throw new ErroHttp(422, 'validacao', 'Confira os campos do pedido.', v.erros.slice(0, 20))
  }
  // mat_registrar_envio grava o log 'envio' e faz a mescla/pedido extra.
  const { data, error } = await sb.rpc('mat_registrar_envio', {
    p_contrato: contrato.id,
    p_hoje: hoje,
    p_seu_nome: v.seuNome,
    p_termos: v.termos,
    p_observacao: v.observacao,
    p_ip: ip,
    p_user_agent: ua ? ua.slice(0, 300) : null,
    p_produtos: v.produtos,
    p_ceu: v.ceu,
  })
  if (error) {
    await registrarLog(sb, contrato.id, 'envio_recusado', ip, ua)
    throw new Error(error.message)
  }
  return { ok: true, ...(data as Record<string, unknown>) }
}

// ============================================================
// Ações internas (escritório)
// ============================================================

async function exigirGestor(sb: SupabaseClient, req: Request): Promise<string> {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer /i, '')
  if (!jwt) throw new ErroHttp(401, 'nao_autorizado', 'Não autorizado')
  const { data: usuario, error } = await sb.auth.getUser(jwt)
  if (error || !usuario?.user) throw new ErroHttp(401, 'nao_autorizado', 'Não autorizado')
  const { data: perfil } = await sb.from('perfis').select('nivel_acesso').eq('id', usuario.user.id).single()
  if (!perfil || !PERFIS_LINKS.includes(String(perfil.nivel_acesso))) {
    throw new ErroHttp(403, 'sem_permissao', 'Sem permissão para gerenciar links de pedido')
  }
  return usuario.user.id
}

function contratoIdDoCorpo(corpo: Corpo): string {
  const id = typeof corpo.contrato_id === 'string' ? corpo.contrato_id : ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroHttp(400, 'requisicao', 'Contrato inválido')
  return id
}

async function acaoGerarLink(sb: SupabaseClient, req: Request, corpo: Corpo, ip: string | null, ua: string | null) {
  const usuarioId = await exigirGestor(sb, req)
  const contratoId = contratoIdDoCorpo(corpo)
  const { data: contrato } = await sb.from('mat_contratos').select('id, ativo').eq('id', contratoId).maybeSingle()
  if (!contrato) throw new ErroHttp(404, 'requisicao', 'Contrato não encontrado')
  if (!contrato.ativo) throw new ErroHttp(409, 'requisicao', 'Contrato inativo não recebe link')

  const { data: atual } = await sb.from('mat_contrato_acesso').select('versao').eq('contrato_id', contratoId).maybeSingle()
  const token = novoToken()
  const versao = (atual?.versao ?? 0) + 1
  const gerado_em = new Date().toISOString()
  const { error } = await sb.from('mat_contrato_acesso').upsert(
    {
      contrato_id: contratoId,
      token_hash: await sha256Hex(token),
      token_cifrado: await cifrarToken(token),
      versao,
      gerado_em,
      gerado_por: usuarioId,
      ativo: true,
    },
    { onConflict: 'contrato_id' }
  )
  if (error) throw new Error(error.message)
  await registrarLog(sb, contratoId, 'link_gerado', ip, ua)
  return { token, versao, gerado_em }
}

async function acaoVerLink(sb: SupabaseClient, req: Request, corpo: Corpo) {
  await exigirGestor(sb, req)
  const contratoId = contratoIdDoCorpo(corpo)
  const { data } = await sb
    .from('mat_contrato_acesso')
    .select('token_cifrado, versao, gerado_em, ativo')
    .eq('contrato_id', contratoId)
    .maybeSingle()
  if (!data || !data.ativo) throw new ErroHttp(404, 'sem_link', 'Este contrato não tem link ativo. Gere um novo.')
  const token = data.token_cifrado ? await decifrarToken(data.token_cifrado).catch(() => null) : null
  if (!token) throw new ErroHttp(409, 'sem_link', 'Não foi possível reexibir este link. Gere um novo (o anterior deixa de valer).')
  return { token, versao: data.versao, gerado_em: data.gerado_em }
}

async function acaoRevogarLink(sb: SupabaseClient, req: Request, corpo: Corpo) {
  await exigirGestor(sb, req)
  const contratoId = contratoIdDoCorpo(corpo)
  const { data, error } = await sb
    .from('mat_contrato_acesso')
    .update({ ativo: false })
    .eq('contrato_id', contratoId)
    .select('contrato_id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new ErroHttp(404, 'sem_link', 'Este contrato não tem link.')
  return { ok: true }
}

// ============================================================
// Servidor
// ============================================================

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req.headers.get('origin') || '')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido', codigo: 'requisicao' }), { status: 405, headers: cors })
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const ip = ipDaRequisicao(req)
  const ua = req.headers.get('user-agent')

  try {
    const texto = await req.text()
    if (texto.length > 200_000) throw new ErroHttp(413, 'requisicao', 'Pedido grande demais')
    let corpo: Corpo
    try {
      corpo = JSON.parse(texto || '{}') as Corpo
    } catch {
      throw new ErroHttp(400, 'requisicao', 'Requisição inválida')
    }

    let resultado: unknown
    switch (corpo.acao) {
      case 'carregar':
        resultado = await acaoCarregar(sb, corpo, ip, ua)
        break
      case 'enviar':
        resultado = await acaoEnviar(sb, corpo, ip, ua)
        break
      case 'gerar_link':
        resultado = await acaoGerarLink(sb, req, corpo, ip, ua)
        break
      case 'ver_link':
        resultado = await acaoVerLink(sb, req, corpo)
        break
      case 'revogar_link':
        resultado = await acaoRevogarLink(sb, req, corpo)
        break
      default:
        throw new ErroHttp(400, 'requisicao', 'Ação inválida')
    }
    return new Response(JSON.stringify(resultado), { status: 200, headers: cors })
  } catch (err) {
    if (err instanceof ErroHttp) {
      return new Response(JSON.stringify({ error: err.message, codigo: err.codigo, detalhes: err.detalhes ?? [] }), {
        status: err.status,
        headers: cors,
      })
    }
    console.error('pedido-materiais:', err)
    return new Response(JSON.stringify({ error: 'Erro interno. Tente de novo em instantes.', codigo: 'interno' }), {
      status: 500,
      headers: cors,
    })
  }
})
