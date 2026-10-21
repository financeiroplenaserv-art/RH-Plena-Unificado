import type { CeuPedidoItem, MatPedidoItem } from '@/types/materiais'
import { quantidadeComUnidade } from './unidades'
import { nomeMes } from './pedidoLider'

// Carta ao líder (decisão da gestora, 17/10/2026 — obrigatória para outubro):
// um documento por contrato que diz ao líder TUDO o que ele pediu no mês, O
// QUE VAI SER ENVIADO e a justificativa de cada item não atendido ou atendido
// em parte. As justificativas vêm dos motivos já gravados no pedido (ajuste do
// kit, validação do inspetor, aprovação com ajuste, "não atendido" na compra,
// entrega menor na chegada/separação, linha descartada por repetição) e da
// fila da Beth (uniforme/EPI/crachá). Vai no malote em PDF e para o líder
// assinar por ferramenta digital externa.
//
// LGPD: pessoas da equipe só como "Primeiro N." (nomesCurtos — mesma regra do
// link do líder); nunca CPF, matrícula nem preço. Lógica pura: a montagem das
// linhas é testada sem PDF (o desenho fica em cartaLiderPdf.ts).

export type SecaoCarta = 'kit' | 'extra' | 'uniforme' | 'cracha'
export type SituacaoLinhaCarta = 'atendido' | 'parcial' | 'nao_atendido' | 'em_analise'

export interface LinhaCarta {
  secao: SecaoCarta
  descricao: string
  pediu: string
  vamosEnviar: string
  observacao: string
  situacao: SituacaoLinhaCarta
}

export interface CartaLider {
  contratoId: string
  contratoNome: string
  competencia: string
  responsavel: string | null
  linhas: LinhaCarta[]
  emAnalise: boolean
}

export const ROTULO_SECAO_CARTA: Record<SecaoCarta, string> = {
  kit: 'Kit do mês',
  extra: 'Pedido a mais',
  uniforme: 'Uniforme e EPI',
  cracha: 'Crachá',
}

const ORDEM_SECAO: SecaoCarta[] = ['kit', 'extra', 'uniforme', 'cracha']

const juntar = (partes: (string | null | undefined)[]) =>
  [...new Set(partes.map((p) => (p ?? '').trim()).filter(Boolean))].join('; ')

const EM_ANALISE = 'Em análise pelo escritório'

/** Quantidade final da linha de produto: entregue (registrado) > planejado na compra > aprovado. */
export function quantidadeFinalProduto(l: MatPedidoItem): number | null {
  if (l.qtd_aprovada == null) return null
  if (l.atendimento === 'nao_atendido') return 0
  if (l.atendimento) {
    const partesEstoque = l.atendimento === 'escritorio' || (l.qtd_estoque ?? 0) > 0
    const estoqueRegistrado = !partesEstoque || l.qtd_entregue_estoque != null
    const fornecedorRegistrado = (l.qtd_compra ?? 0) === 0 || l.qtd_recebida_fornecedor != null
    // Migration 151: a parte remanejada de outro posto só conta como entregue depois de confirmada.
    const remanejadoRegistrado = (l.qtd_remanejada ?? 0) === 0 || l.qtd_entregue_remanejada != null
    if (estoqueRegistrado && fornecedorRegistrado && remanejadoRegistrado && l.qtd_entregue != null) return Number(l.qtd_entregue)
    if (l.atendimento === 'escritorio') return Number(l.qtd_aprovada)
    return Number(l.qtd_estoque ?? 0) + Number(l.qtd_compra ?? 0) + Number(l.qtd_remanejada ?? 0)
  }
  return Number(l.qtd_aprovada)
}

export interface NomesProduto {
  /** Nome do item + variação (ex.: "Flanela Microfibra amarela"). */
  descricao: (l: MatPedidoItem) => string
  unidade: (l: MatPedidoItem) => string | null
  /** Nome do item original quando o inspetor/gestor trocou o item. */
  original?: (l: MatPedidoItem) => string | null
  /** Nome do posto de onde vem o remanejado (migration 151). */
  origemRemanejado?: (l: MatPedidoItem) => string | null
}

/**
 * Texto de "Vamos enviar" quando parte (ou tudo) vem de outro posto (decisão da
 * gestora, 19/10/2026): "3 unidades (remanejado do posto ABAETÉ)" ou, dividida,
 * "5 unidades (2 remanejadas do posto ABAETÉ)".
 */
export function textoVamosEnviar(final: number, unidade: string | null, l: MatPedidoItem, origem: string | null): string {
  const base = quantidadeComUnidade(final, unidade)
  const rem = Number(l.qtd_entregue_remanejada ?? l.qtd_remanejada ?? 0)
  if (!(rem > 0) || final === 0) return base
  const posto = origem ? `do posto ${origem}` : 'de outro posto'
  if (rem >= final) return `${base} (remanejado ${posto})`
  return `${base} (${rem} ${rem === 1 ? 'remanejada' : 'remanejadas'} ${posto})`
}

/** Linhas de produto (kit e pedido a mais). Linha que o líder tirou e ninguém pôs de volta não aparece. */
export function linhasCartaProdutos(linhas: MatPedidoItem[], nomes: NomesProduto): LinhaCarta[] {
  const out: LinhaCarta[] = []
  for (const l of linhas) {
    const pedida = Number(l.qtd_pedida)
    const incluido = !!l.incluido_em
    if (pedida === 0 && !incluido && (l.qtd_aprovada == null || Number(l.qtd_aprovada) === 0)) continue
    const un = nomes.unidade(l)
    const final = quantidadeFinalProduto(l)
    const secao: SecaoCarta = l.parte === 'kit' ? 'kit' : 'extra'
    const descricao = l.item_id ? nomes.descricao(l) : (l.descricao_livre ?? 'Outro material')
    const pediu = incluido ? '—' : quantidadeComUnidade(pedida, un)
    if (final == null) {
      out.push({ secao, descricao, pediu, vamosEnviar: '—', observacao: EM_ANALISE, situacao: 'em_analise' })
      continue
    }
    const situacao: SituacaoLinhaCarta = final === 0 ? 'nao_atendido' : incluido || final >= pedida ? 'atendido' : 'parcial'
    const original = l.item_original_id && nomes.original ? nomes.original(l) : null
    const motivos = juntar([
      l.decisao_repeticao === 'descartar' ? 'Item repetido em outro envio deste mês' : null,
      original ? `Trocado de ${original}` : null,
      Number(l.qtd_aprovada) !== pedida ? l.motivo_ajuste : null,
      l.motivo_nao_atendido,
      l.motivo_entrega,
      (l.qtd_remanejada ?? 0) > 0 ? l.remanejamento_obs : null,
    ])
    let observacao = motivos
    if (incluido) observacao = juntar(['Incluído pelo escritório', motivos])
    else if (!observacao && situacao !== 'atendido') observacao = 'Ajustado pelo escritório'
    else if (!observacao && final > pedida) observacao = 'Enviaremos a mais'
    const origem = (l.qtd_remanejada ?? 0) > 0 && nomes.origemRemanejado ? nomes.origemRemanejado(l) : null
    out.push({ secao, descricao, pediu, vamosEnviar: textoVamosEnviar(final, un, l, origem), observacao, situacao })
  }
  return out
}

export interface NomesCeu {
  /** Nome da peça (sem o tamanho, que vem da linha). */
  peca: (l: CeuPedidoItem) => string
  /** "Michelle A." — SEMPRE já encurtado (nomesCurtos). */
  pessoa: (l: CeuPedidoItem) => string
}

/** Linhas de uniforme/EPI e crachá da fila da Beth. */
export function linhasCartaCeu(linhas: CeuPedidoItem[], nomes: NomesCeu): LinhaCarta[] {
  const out: LinhaCarta[] = []
  for (const l of linhas) {
    const pedida = Number(l.qtd_pedida)
    if (!(pedida > 0)) continue
    const cracha = l.tipo === 'cracha'
    const secao: SecaoCarta = cracha ? 'cracha' : 'uniforme'
    const pessoa = nomes.pessoa(l)
    const descricao = cracha
      ? `Crachá — ${pessoa}${l.cracha_motivo ? ` (${l.cracha_motivo})` : ''}`
      : `${nomes.peca(l)}${l.tamanho ? ` ${l.tamanho}` : ''} — ${pessoa}`
    const pediu = String(pedida)
    if (l.status === 'a_identificar' || l.status === 'pendente') {
      out.push({ secao, descricao, pediu, vamosEnviar: '—', observacao: EM_ANALISE, situacao: 'em_analise' })
      continue
    }
    const final =
      l.status === 'cancelado'
        ? 0
        : l.status === 'atendido'
          ? Number(l.qtd_atendida ?? l.qtd_conferida ?? pedida)
          : Number(l.qtd_conferida ?? pedida)
    const situacao: SituacaoLinhaCarta = final === 0 ? 'nao_atendido' : final >= pedida ? 'atendido' : 'parcial'
    let observacao = juntar([l.motivo_ajuste, l.motivo_atendimento])
    if (!observacao && situacao !== 'atendido') observacao = 'Ajustado pelo escritório'
    out.push({ secao, descricao, pediu, vamosEnviar: String(final), observacao, situacao })
  }
  return out
}

export function ordenarLinhasCarta(linhas: LinhaCarta[]): LinhaCarta[] {
  return [...linhas].sort(
    (a, b) => ORDEM_SECAO.indexOf(a.secao) - ORDEM_SECAO.indexOf(b.secao) || a.descricao.localeCompare(b.descricao, 'pt-BR')
  )
}

export function montarCarta(d: {
  contratoId: string
  contratoNome: string
  competencia: string
  responsavel: string | null
  produtos: LinhaCarta[]
  ceu: LinhaCarta[]
}): CartaLider {
  const linhas = ordenarLinhasCarta([...d.produtos, ...d.ceu])
  return {
    contratoId: d.contratoId,
    contratoNome: d.contratoNome,
    competencia: d.competencia,
    responsavel: d.responsavel,
    linhas,
    emAnalise: linhas.some((l) => l.situacao === 'em_analise'),
  }
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Lotes feitos pelo escritório (importação, complemento, decisões da gestora...).
const USER_AGENT_ESCRITORIO = /^(importado-planilha|completar-kit|decisoes-gestora|comentarios-inspetores|a-confirmar-inspetor)/

/** Nome digitado por alguém do posto? Falso para vazio, "Escritório ..." e "Importado ...". */
export function nomeEhDoPosto(nome: string | null | undefined): boolean {
  const n = semAcento(nome ?? '')
  if (!n) return false
  return !/^(escritorio|importado)\b/.test(n)
}

/**
 * Nome do líder para a saudação: o `seu_nome` do envio MAIS RECENTE feito por uma pessoa do
 * posto (ignora envios do escritório/importação, por nome ou por user_agent de lote). Sem envio
 * válido, cai no responsável do pedido, com a mesma regra. Sem nome válido: null.
 */
export function nomeDoLiderNosEnvios(
  envios: { seu_nome: string | null; user_agent?: string | null; enviado_em?: string }[],
  responsavelPedido?: string | null
): string | null {
  for (let i = envios.length - 1; i >= 0; i--) {
    const e = envios[i]
    if (e.user_agent && USER_AGENT_ESCRITORIO.test(semAcento(e.user_agent))) continue
    if (nomeEhDoPosto(e.seu_nome)) return e.seu_nome!.trim()
  }
  return nomeEhDoPosto(responsavelPedido) ? responsavelPedido!.trim() : null
}

/** Saudação da carta: "Olá, Ana S." ou, sem nome do líder, "Olá, equipe do ABAETÉ." */
export function saudacaoCarta(carta: { responsavel: string | null; contratoNome: string }): string {
  const nome = carta.responsavel?.trim()
  if (nome) return `Olá, ${nome}${nome.endsWith('.') ? '' : '.'}` // "Ana S." já termina em ponto
  const contrato = carta.contratoNome?.trim()
  return contrato ? `Olá, equipe do ${contrato}.` : 'Olá.'
}

/** "outubro de 2026" */
export function mesPorExtenso(competencia: string): string {
  return `${nomeMes(competencia)} de ${competencia.slice(0, 4)}`
}

/** Nome de arquivo sem acento nem espaço: carta-lider_vila-de-cascais_2026-10.pdf */
export function nomeArquivoCarta(contratoNome: string, competencia: string): string {
  const slug =
    contratoNome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'contrato'
  return `carta-lider_${slug}_${competencia.slice(0, 7)}.pdf`
}

/** Tamanho de fonte da tabela para a carta caber em 1 página A4 (compactação, como nos recibos do CEU). */
export function fonteDaTabela(nLinhas: number): number {
  if (nLinhas <= 18) return 9.5
  if (nLinhas <= 26) return 8.5
  if (nLinhas <= 34) return 7.5
  if (nLinhas <= 44) return 6.5
  return 6
}

/** Nomes de arquivo únicos dentro do .zip (dois contratos com o mesmo nome curto). */
export function nomesUnicos(nomes: string[]): string[] {
  const vistos = new Map<string, number>()
  return nomes.map((n) => {
    const k = n.toLowerCase()
    const c = (vistos.get(k) ?? 0) + 1
    vistos.set(k, c)
    return c === 1 ? n : n.replace(/\.pdf$/i, `_${c}.pdf`)
  })
}
