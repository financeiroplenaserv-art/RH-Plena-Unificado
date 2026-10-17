import type { CeuTamanhos } from '@/types/database'
import type { CeuPedidoItem, MatPedidoEnvio, MatPedidoItem } from '@/types/materiais'
import { tamanhoDoNomeItem, tamanhoParaItem } from '@/lib/ceu/tamanhosPuro'
import { idsColaboradoresDoDepartamento, type ColaboradorDepartamento, type DepartamentoFuzzy } from '@/lib/departamentos'
import { diasEntre } from './datas'
import { normalizarTexto } from './normalizar'
import { tamanhosDivergem } from './pedidos'
import { tetoQuantidade } from './pedidoLider'

// Lógica pura das filas internas da Fase 1 (docs/PLANO_MATERIAIS_FASE1.md
// §4.3, §5.1 e §6): validação do inspetor, aprovação do gestor, conferência
// e atendimento de uniforme/EPI/crachá. O banco reconfere tudo nas RPCs; aqui
// só se monta o payload e se avisa antes de enviar.

// ------------------------------------------------------------------
// Produtos
// ------------------------------------------------------------------

type LinhaExcecao = Pick<MatPedidoItem, 'excecao_acima_kit' | 'excecao_validade' | 'excecao_fora_kit' | 'item_id'> &
  Partial<Pick<MatPedidoItem, 'parte'>>

// Kit confirmável + pedido extra (decisão da gestão, 16/10/2026 — migration
// 135): a linha 'kit' é o que o posto vai receber (só diminui); a 'extra' é
// o que passa do kit. Linha sem `parte` (antes da 135, pedido extra
// operacional) conta como extra.

/** Linha do Kit Mensal confirmada pelo líder (ou preenchida pelo escritório). */
export function ehLinhaKit(l: Partial<Pick<MatPedidoItem, 'parte'>>): boolean {
  return l.parte === 'kit'
}

/** Linha do kit aprovada na gravação: validação/aprovação a ignoram; muda só pelo ajuste do kit. */
export function kitAprovadoAutomatico(l: Partial<Pick<MatPedidoItem, 'parte' | 'aprovado_automatico'>>): boolean {
  return l.parte === 'kit' && l.aprovado_automatico === true
}

/**
 * Exceção = o que o inspetor precisa olhar: pedido extra (acima/fora do kit,
 * texto livre). Na linha do kit, "antes da validade" é só aviso interno
 * (decisão de 16/10/2026) — não conta como exceção.
 */
export function temExcecao(l: LinhaExcecao): boolean {
  if (ehLinhaKit(l)) return false
  return l.excecao_acima_kit || l.excecao_validade || l.excecao_fora_kit
}

/** Rótulos curtos das exceções da linha ("Outros materiais" = texto livre). */
export function rotulosExcecao(l: LinhaExcecao): string[] {
  const r: string[] = []
  if (l.excecao_acima_kit) r.push(l.parte === 'extra' ? 'A mais do kit' : 'Acima do kit')
  if (l.excecao_validade) r.push('Antes da validade')
  if (l.excecao_fora_kit) r.push(l.item_id ? 'Fora do kit' : 'Outros materiais')
  return r
}

export interface EdicaoKit {
  qtd: number | null
  motivo: string
  /** Troca do item (null = mantém). */
  itemId: string | null
  variacaoId: string | null
}

/**
 * Ajuste de uma linha do KIT pelo inspetor/gestor (RPC
 * ajustar_linha_kit_materiais): diminuir, tirar (0) ou trocar o item, sempre
 * com motivo. Nunca acima do kit (para dar mais, o caminho é o pedido extra).
 */
export function montarAjusteKit(
  l: Pick<MatPedidoItem, 'id' | 'qtd_kit' | 'qtd_pedida' | 'qtd_validada' | 'item_id' | 'variacao_id'>,
  e: EdicaoKit,
  itemTemVariacoes = false
): { payload: { linhaId: string; qtd: number; motivo: string; itemId: string | null; variacaoId: string | null } | null; erro: string | null } {
  const atual = Number(l.qtd_validada ?? l.qtd_pedida)
  const qtd = e.qtd ?? atual
  const teto = Math.max(Number(l.qtd_kit ?? 0), Number(l.qtd_pedida))
  if (!Number.isFinite(qtd) || qtd < 0) return { payload: null, erro: 'Quantidade inválida' }
  if (qtd > teto) return { payload: null, erro: `O kit só diminui (máximo ${teto}). Para dar mais, use o pedido extra.` }
  const troca = !!e.itemId && (e.itemId !== l.item_id || (e.variacaoId ?? null) !== (l.variacao_id ?? null))
  if (troca && itemTemVariacoes && !e.variacaoId) return { payload: null, erro: 'Escolha a opção do item de troca' }
  if (!troca && qtd === atual) return { payload: null, erro: 'Nada mudou: altere a quantidade ou troque o item' }
  const motivo = e.motivo.trim()
  if (!motivo) return { payload: null, erro: 'Informe o motivo do ajuste' }
  return {
    payload: { linhaId: l.id, qtd, motivo, itemId: troca ? e.itemId : null, variacaoId: troca ? e.variacaoId ?? null : null },
    erro: null,
  }
}

/** Quantidade que vale para valor/consumo: aprovada > validada > pedida. */
export function qtdEfetiva(l: Pick<MatPedidoItem, 'qtd_aprovada' | 'qtd_validada' | 'qtd_pedida'>): number {
  return Number(l.qtd_aprovada ?? l.qtd_validada ?? l.qtd_pedida)
}

export interface OrigemLinha {
  origem: 'original' | 'complemento'
  sequencia: number
  seuNome: string
  enviadoEm: string
}

/** De qual envio veio a linha (original/complemento, data e "Seu nome"). */
export function origemDaLinha(
  linha: Pick<MatPedidoItem, 'envio_id'>,
  envios: Pick<MatPedidoEnvio, 'id' | 'origem' | 'sequencia' | 'seu_nome' | 'enviado_em'>[]
): OrigemLinha | null {
  const e = envios.find((x) => x.id === linha.envio_id)
  return e ? { origem: e.origem, sequencia: e.sequencia, seuNome: e.seu_nome, enviadoEm: e.enviado_em } : null
}

export type DecisaoRepeticao = 'somar' | 'descartar' | null

/** Edição do inspetor/gestor numa linha (qtd null = manter a pedida/validada). */
export interface EdicaoLinha {
  qtd: number | null
  motivo: string
  decisao?: DecisaoRepeticao
}

export interface PayloadValidacao {
  id: string
  qtd_validada: number | null
  motivo: string | null
  decisao_repeticao: 'somar' | 'descartar' | null
}

/**
 * Payload de validar_pedido_materiais. Só vão as linhas editadas; as demais
 * são validadas pela quantidade pedida no banco. Qualquer alteração da
 * quantidade (para cima ou para baixo) exige motivo, exceto "descartar" a
 * repetição (motivo padrão "repetição"), e nunca pode passar do teto de
 * sanidade do envio do líder (tetoQuantidade — pedidoLider.ts).
 */
export function montarValidacao(
  linhas: (Pick<MatPedidoItem, 'id' | 'qtd_pedida' | 'qtd_kit'> & Partial<Pick<MatPedidoItem, 'parte' | 'aprovado_automatico'>>)[],
  edicoes: Record<string, EdicaoLinha | undefined>
): { itens: PayloadValidacao[]; erros: string[] } {
  const itens: PayloadValidacao[] = []
  const erros: string[] = []
  linhas.forEach((l, i) => {
    const e = edicoes[l.id]
    // Kit já aprovado: muda só pelo ajuste do kit (o banco também ignora).
    if (!e || kitAprovadoAutomatico(l)) return
    const decisao = e.decisao ?? null
    const motivo = e.motivo.trim() || null
    if (decisao === 'descartar') {
      itens.push({ id: l.id, qtd_validada: 0, motivo: motivo ?? 'repetição', decisao_repeticao: 'descartar' })
      return
    }
    const qtd = e.qtd
    if (qtd != null && (!Number.isFinite(qtd) || qtd < 0)) {
      erros.push(`Linha ${i + 1}: quantidade inválida`)
      return
    }
    const teto = tetoQuantidade(l.qtd_kit == null ? null : Number(l.qtd_kit))
    if (qtd != null && qtd > teto) {
      erros.push(`Linha ${i + 1}: quantidade acima do teto (${teto})`)
      return
    }
    if (qtd != null && qtd !== Number(l.qtd_pedida) && !motivo) {
      erros.push(`Linha ${i + 1}: informe o motivo da alteração`)
      return
    }
    if (qtd == null && !decisao && !motivo) return
    itens.push({ id: l.id, qtd_validada: qtd, motivo, decisao_repeticao: decisao })
  })
  return { itens, erros }
}

export interface PayloadAprovacao {
  id: string
  qtd_aprovada: number
  motivo_ajuste: string | null
}

/**
 * Payload de aprovar_pedido_materiais (ajuste item a item). Linha sem edição
 * fica "aprovar como está" (validada, ou pedida). Qualquer alteração da
 * quantidade pedida (para cima ou para baixo) exige motivo (vale o motivo de
 * ajuste já registrado pelo inspetor) e nunca pode passar do teto de sanidade
 * do envio do líder (tetoQuantidade — pedidoLider.ts).
 */
export function montarAprovacao(
  linhas: (Pick<MatPedidoItem, 'id' | 'qtd_pedida' | 'qtd_kit' | 'motivo_ajuste'> & Partial<Pick<MatPedidoItem, 'parte' | 'aprovado_automatico'>>)[],
  edicoes: Record<string, EdicaoLinha | undefined>
): { itens: PayloadAprovacao[]; erros: string[] } {
  const itens: PayloadAprovacao[] = []
  const erros: string[] = []
  linhas.forEach((l, i) => {
    const e = edicoes[l.id]
    if (!e || e.qtd == null || kitAprovadoAutomatico(l)) return
    if (!Number.isFinite(e.qtd) || e.qtd < 0) {
      erros.push(`Linha ${i + 1}: quantidade inválida`)
      return
    }
    const teto = tetoQuantidade(l.qtd_kit == null ? null : Number(l.qtd_kit))
    if (e.qtd > teto) {
      erros.push(`Linha ${i + 1}: quantidade acima do teto (${teto})`)
      return
    }
    const motivo = e.motivo.trim() || null
    if (e.qtd !== Number(l.qtd_pedida) && !motivo && !(l.motivo_ajuste ?? '').trim()) {
      erros.push(`Linha ${i + 1}: informe o motivo do ajuste`)
      return
    }
    itens.push({ id: l.id, qtd_aprovada: e.qtd, motivo_ajuste: motivo })
  })
  return { itens, erros }
}

// ------------------------------------------------------------------
// Identificação do nome digitado (uniforme/EPI/crachá)
// ------------------------------------------------------------------

function similaridadeTokens(a: string, b: string): number {
  if (a === b) return 1
  // Inicial ("A" ou "A.") ou abreviação ("Mich") do nome do cadastro
  if (b.startsWith(a)) return a.length === 1 ? 0.7 : 0.9
  const max = Math.max(a.length, b.length)
  const d = distanciaEdicao(a, b)
  const r = 1 - d / max
  return r >= 0.7 ? r * 0.9 : 0
}

function distanciaEdicao(a: string, b: string): number {
  const linha = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0]
    linha[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = linha[j]
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1))
      anterior = temp
    }
  }
  return linha[b.length]
}

/**
 * Pontuação 0–1 entre o nome digitado pelo líder e o nome do cadastro. Cada
 * palavra digitada procura a melhor palavra do cadastro (igual, abreviação,
 * inicial ou erro de digitação); o primeiro nome pesa o dobro.
 */
export function pontuarNome(digitado: string, nomeCadastro: string): number {
  const td = normalizarTexto(digitado).split(' ').filter(Boolean)
  const tc = normalizarTexto(nomeCadastro).split(' ').filter(Boolean)
  if (td.length === 0 || tc.length === 0) return 0
  if (td.join(' ') === tc.join(' ')) return 1
  let soma = 0
  let pesos = 0
  td.forEach((t, i) => {
    const peso = i === 0 ? 2 : 1
    const candidatos = i === 0 ? tc : tc.slice(1)
    let melhor = 0
    candidatos.forEach((c, j) => {
      // o primeiro nome digitado vale mais quando casa com o primeiro do cadastro
      const s = similaridadeTokens(t, c) * (i === 0 && j > 0 ? 0.8 : 1)
      if (s > melhor) melhor = s
    })
    soma += melhor * peso
    pesos += peso
  })
  return Math.round((soma / pesos) * 100) / 100
}

export interface CandidatoColaborador {
  id: string
  nome_completo: string
}

export interface SugestaoColaborador {
  id: string
  nome: string
  score: number
}

/** Pontuação mínima para sugerir. */
export const SCORE_MINIMO_SUGESTAO = 0.55

/**
 * Sugestões para o nome digitado, ordenadas pela pontuação. A tela passa só a
 * equipe do contrato (idsColaboradoresDoDepartamento) — quem é de fora
 * (ferista) é escolhido pela busca livre (`buscarColaboradores`).
 */
export function sugerirColaboradores(
  digitado: string,
  candidatos: CandidatoColaborador[],
  limite = 3,
  minimo = SCORE_MINIMO_SUGESTAO
): SugestaoColaborador[] {
  return candidatos
    .map((c) => ({ id: c.id, nome: c.nome_completo, score: pontuarNome(digitado, c.nome_completo) }))
    .filter((s) => s.score >= minimo)
    .sort((a, b) => b.score - a.score || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite)
}

/** Busca livre entre todos os ativos (contém o termo ou parece com ele). */
export function buscarColaboradores(
  termo: string,
  candidatos: CandidatoColaborador[],
  limite = 8
): SugestaoColaborador[] {
  const t = normalizarTexto(termo)
  if (t.length < 2) return []
  return candidatos
    .map((c) => {
      const n = normalizarTexto(c.nome_completo)
      const score = n.includes(t) ? 1 : pontuarNome(termo, c.nome_completo)
      return { id: c.id, nome: c.nome_completo, score }
    })
    .filter((s) => s.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite)
}

export interface AnaliseTamanho {
  /** Tamanho do cadastro (ceu_tamanhos) para a peça. */
  tamanhoCadastro: string | null
  /** Tamanho considerado do pedido (digitado; senão o embutido no nome da peça). */
  tamanhoPedido: string | null
  diverge: boolean
}

/** Mesma regra do Lançamento Rápido (tamanhoParaItem/tamanhoDoNomeItem). */
export function analisarTamanho(
  nomeItem: string | null,
  tamanhoDigitado: string | null,
  tamanhos: CeuTamanhos | null | undefined
): AnaliseTamanho {
  if (!nomeItem) return { tamanhoCadastro: null, tamanhoPedido: tamanhoDigitado, diverge: false }
  const tamanhoCadastro = tamanhoParaItem(nomeItem, tamanhos ?? null)
  const tamanhoPedido = tamanhoDigitado?.trim() || tamanhoDoNomeItem(nomeItem)
  return { tamanhoCadastro, tamanhoPedido, diverge: tamanhosDivergem(tamanhoPedido, tamanhoCadastro) }
}

/** Peça entregue há menos que o prazo de uso do item (alerta, não bloqueia). */
export function entregaRecente(
  ultima: string | null,
  prazoUsoDias: number | null | undefined,
  hoje: string,
  /** Item de troca frequente (itens.sem_alerta_prazo, migration 142): nunca avisa. */
  semAlertaPrazo = false
): boolean {
  if (semAlertaPrazo || !ultima || !prazoUsoDias || prazoUsoDias <= 0) return false
  const dias = diasEntre(ultima, hoje)
  return dias >= 0 && dias < prazoUsoDias
}

// ------------------------------------------------------------------
// Atendimento (Beth)
// ------------------------------------------------------------------

/** Quantidade a entregar: conferida (ou pedida). */
export function qtdParaAtender(l: Pick<CeuPedidoItem, 'qtd_conferida' | 'qtd_pedida'>): number {
  return Number(l.qtd_conferida ?? l.qtd_pedida)
}

export interface PayloadAtendimento {
  id: string
  qtd_atendida: number
  motivo: string | null
}

/** Atendimento com quantidade: menor que o conferido exige motivo; maior é recusado. */
export function montarAtendimento(
  linhas: Pick<CeuPedidoItem, 'id' | 'qtd_conferida' | 'qtd_pedida' | 'status'>[],
  edicoes: Record<string, { qtd: number | null; motivo: string } | undefined>
): { itens: PayloadAtendimento[]; erros: string[] } {
  const itens: PayloadAtendimento[] = []
  const erros: string[] = []
  linhas.forEach((l, i) => {
    if (l.status !== 'conferido' && l.status !== 'ajustado') {
      erros.push(`Linha ${i + 1}: só linhas conferidas pela inspetoria podem ser atendidas`)
      return
    }
    const base = qtdParaAtender(l)
    const e = edicoes[l.id]
    const qtd = e?.qtd ?? base
    const motivo = e?.motivo.trim() || null
    if (!Number.isInteger(qtd) || qtd < 0 || qtd > base) {
      erros.push(`Linha ${i + 1}: quantidade entregue deve ficar entre 0 e ${base}`)
      return
    }
    if (qtd < base && !motivo) {
      erros.push(`Linha ${i + 1}: informe o motivo da entrega menor`)
      return
    }
    itens.push({ id: l.id, qtd_atendida: qtd, motivo })
  })
  return { itens, erros }
}

export interface FaltaComprar {
  item_id: string
  /** Quantidade conferida ainda não atendida. */
  aAtender: number
  /** Saldo do CEU (itens.estoque — referência manual). */
  saldo: number | null
  falta: number
}

/**
 * "O que falta comprar": por peça, o conferido ainda não atendido menos o saldo
 * de referência do CEU. Só orientação — nunca bloqueia o atendimento.
 */
export function faltaComprar(
  linhas: Pick<CeuPedidoItem, 'item_id' | 'status' | 'qtd_conferida' | 'qtd_pedida'>[],
  saldos: Map<string, number | null | undefined>
): FaltaComprar[] {
  const soma = new Map<string, number>()
  for (const l of linhas) {
    if (!l.item_id || (l.status !== 'conferido' && l.status !== 'ajustado')) continue
    soma.set(l.item_id, (soma.get(l.item_id) ?? 0) + qtdParaAtender(l))
  }
  return [...soma.entries()]
    .map(([item_id, aAtender]) => {
      const s = saldos.get(item_id)
      const saldo = s == null ? null : Number(s)
      return { item_id, aAtender, saldo, falta: Math.max(0, aAtender - Math.max(0, saldo ?? 0)) }
    })
    .sort((a, b) => b.falta - a.falta)
}

/** Situação da linha para os filtros da aba CEU → Pedidos. */
export type EtapaCeu = 'identificar' | 'conferir' | 'atender' | 'concluida'

export function etapaLinhaCeu(status: CeuPedidoItem['status']): EtapaCeu {
  if (status === 'a_identificar') return 'identificar'
  if (status === 'pendente') return 'conferir'
  if (status === 'conferido' || status === 'ajustado') return 'atender'
  return 'concluida'
}

/** Tipo da linha do pedido a partir do tipo do item do CEU ('Uniforme', 'EPI'...). */
export function tipoPedidoDoItem(tipoItem: string | null | undefined): 'uniforme' | 'epi' | null {
  const t = normalizarTexto(tipoItem)
  if (t === 'uniforme') return 'uniforme'
  if (t === 'epi' || t === 'equipamento') return 'epi'
  return null
}

/**
 * Equipe do contrato de pedido: colaboradores do departamento (pelo nome_curto,
 * expandindo linhas irmãs — nunca ILIKE; AGENTS.md §11).
 */
export function idsEquipeDoContrato(
  departamentos: DepartamentoFuzzy[],
  colaboradores: ColaboradorDepartamento[],
  departamentoId: string | null | undefined
): Set<string> {
  const dep = departamentos.find((d) => d.id === departamentoId)
  if (!dep) return new Set()
  return idsColaboradoresDoDepartamento(departamentos, colaboradores, dep.nome_curto?.trim() || dep.nome)
}
