// Peças de uniforme/EPI do contrato e equipe do link do líder — lógica pura.
//
// ESTE ARQUIVO É COPIADO PARA DENTRO DA EDGE FUNCTION
// supabase/functions/pedido-materiais/index.ts (deploy de arquivo único) por
// `node scripts/sincronizar-pedido-materiais.mjs`. Só importa de arquivos que
// também são copiados (o script remove as linhas de import — na function tudo
// fica no mesmo escopo); o teste pedidoLider.test.ts falha se as cópias divergirem.
//
// - O cadastro `itens` do CEU tem UM item por tamanho ("BOTA PVC CANO CURTO
//   38 - Tam. 38"). Aqui eles viram uma PEÇA com os tamanhos como opções. O
//   agrupamento é DERIVADO em tempo de execução pelo nome base (não é gravado):
//   tamanho novo cadastrado no CEU aparece sozinho; tamanho inativado some.
// - A função da peça (ASG, portaria...) vem do kit de uniforme do contrato
//   (mat_contrato_ceu_itens, migration 129); a do colaborador, do cargo.
// - Equipe no link público: SÓ primeiro nome + inicial do sobrenome
//   ("Michelle A."; homônimos ganham mais letras). Decisão da gestão de
//   09/10/2026, reiterada em 14/10/2026. Nada de sobrenome completo, CPF,
//   matrícula, foto ou tamanhos.

import { idsColaboradoresDoDepartamento, type ColaboradorDepartamento, type DepartamentoFuzzy } from '../departamentos'

export type TipoPeca = 'uniforme' | 'epi'

export type FuncaoPeca =
  | 'asg'
  | 'portaria'
  | 'encarregado'
  | 'manutencao'
  | 'jardinagem'
  | 'recepcao'
  | 'administrativo'
  | 'monitoramento'

export const FUNCOES_PECA: { id: FuncaoPeca; rotulo: string }[] = [
  { id: 'asg', rotulo: 'ASG' },
  { id: 'portaria', rotulo: 'Porteiro/Vigia' },
  { id: 'encarregado', rotulo: 'Encarregado/Zelador/Líder' },
  { id: 'manutencao', rotulo: 'Manutenção' },
  { id: 'jardinagem', rotulo: 'Jardinagem' },
  { id: 'recepcao', rotulo: 'Recepção' },
  { id: 'administrativo', rotulo: 'Administrativo' },
  { id: 'monitoramento', rotulo: 'Monitoramento' },
]

const IDS_FUNCOES = new Set<string>(FUNCOES_PECA.map((f) => f.id))

export function ehFuncaoPeca(valor: unknown): valor is FuncaoPeca {
  return typeof valor === 'string' && IDS_FUNCOES.has(valor)
}

function soLetras(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

function normalizarPeca(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Função de um cargo (texto livre e sujo do cadastro: "PORTEIRO (a)",
 * "AUXILIAR DE SERV GERAIS (LIMPEZA)", "AUXILIARDE JARDINAGEM"). null = não
 * reconhecido (o link mostra todas as peças do contrato).
 */
export function funcaoDoCargo(cargo: string | null | undefined): FuncaoPeca | null {
  const c = soLetras(cargo)
  if (!c) return null
  if (c.includes('MONITORAMENTO') || c.startsWith('OPERADOR')) return 'monitoramento'
  if (c.includes('PORTEIR') || c.includes('PORTARIA') || c.includes('VIGIA') || c.includes('VIGILANT') || c.includes('CONTROLADORDEACESSO'))
    return 'portaria'
  if (c.includes('JARDIN')) return 'jardinagem'
  if (c.includes('MANUTEN') || c.includes('ELETRIC') || c.includes('HIDRAUL') || c.includes('TECNICO')) return 'manutencao'
  if (c.includes('ADMINISTRAT') || c.includes('ASSISTENTE') || c.includes('ANALISTA') || c.includes('COMERCIAL') || c.includes('GERENTE') || c.includes('CHEFE') || c.includes('ESTAGI') || c.includes('AUXILIARDETI'))
    return 'administrativo'
  if (c.includes('ENCARREGAD') || c.includes('ZELADOR') || c.includes('LIDER') || c.includes('LIDERES') || c.includes('SUPERVISOR') || c.includes('INSPETOR'))
    return 'encarregado'
  if (c.includes('RECEPC') || c.includes('ATENDIMENTO')) return 'recepcao'
  if (c.includes('SERVICOSGERAIS') || c.includes('SERVGERAIS') || c.startsWith('ASG') || c.includes('SERVENTE') || c.includes('FAXIN') || c.includes('LIMPEZA') || c.includes('COPEIR'))
    return 'asg'
  return null
}

/**
 * Funções citadas num texto de formulário ("UTILIZADA POR AUXILIARES DE
 * SERVIÇOS GERAIS / LÍDERES / AUXILARES DE MANUTENÇÃO"). Sem repetição, na
 * ordem de FUNCOES_PECA.
 */
export function funcoesDoTexto(texto: string | null | undefined): FuncaoPeca[] {
  const partes = (texto ?? '').split(/[/,;]| E | OU /i)
  const achadas = new Set<FuncaoPeca>()
  for (const p of partes) {
    const f = funcaoDoCargo(p)
    if (f) achadas.add(f)
  }
  return FUNCOES_PECA.map((f) => f.id).filter((id) => achadas.has(id))
}

export function rotuloFuncoes(funcoes: FuncaoPeca[]): string {
  return FUNCOES_PECA.filter((f) => funcoes.includes(f.id))
    .map((f) => f.rotulo)
    .join(' / ')
}

// ---------- Tamanho embutido no nome do item ----------

const TAMANHOS_LETRA = ['PP', 'P', 'M', 'G', 'GG', 'EG', 'XG', 'XGG', 'XXGG']

/**
 * Separa o tamanho do nome do item CEU. Mesma regra de tamanhoDoNomeItem
 * (src/lib/ceu/tamanhosPuro.ts — o teste trava a paridade): "Tam. X" no fim
 * ou último token com 2 dígitos / letra de tamanho. "LUVA NITRÍLICA EXTRA EG"
 * agrupa com as demais nitrílicas ("extra G" = EG).
 */
export function separarTamanhoDoNome(nome: string): { base: string; tamanho: string | null } {
  let base = nome.trim()
  let tamanho: string | null = null
  const m = base.match(/tam\.?\s*:?\s*([a-z0-9]+)/i)
  if (m) {
    tamanho = m[1].toUpperCase()
    base = base.slice(0, m.index).replace(/[\s\-–—]+$/, '')
  }
  const tokens = base.split(/\s+/).filter(Boolean)
  const ultimo = (tokens[tokens.length - 1] ?? '').toUpperCase()
  if (tokens.length > 1 && (/^\d{2}$/.test(ultimo) || TAMANHOS_LETRA.includes(ultimo))) {
    if (!tamanho) tamanho = ultimo
    if (ultimo === tamanho) tokens.pop()
  }
  if (tamanho && tokens.length > 1 && tokens[tokens.length - 1].toUpperCase() === 'EXTRA') tokens.pop()
  base = tokens.join(' ').replace(/[\s\-–—]+$/, '')
  return { base, tamanho }
}

const PALAVRAS_VAZIAS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'EM', 'COM', 'E', 'TIPO'])

/** Chave da peça: tokens do nome base sem palavras vazias, em ordem alfabética. */
export function chavePeca(nomeBase: string, tipo: TipoPeca): string {
  const tokens = normalizarPeca(nomeBase)
    .split(' ')
    .filter((t) => t && !PALAVRAS_VAZIAS.has(t))
    .sort()
  return `${tipo}:${tokens.join(' ')}`
}

function pesoTamanho(t: string): number {
  const i = TAMANHOS_LETRA.indexOf(t)
  if (i >= 0) return i
  const n = Number(t)
  if (Number.isFinite(n)) return 100 + n
  return 1000
}

export function ordenarTamanhos(lista: string[]): string[] {
  return [...lista].sort((a, b) => pesoTamanho(a) - pesoTamanho(b) || a.localeCompare(b))
}

const ROUPA = /\b(CAMISA|CALCA|JALECO|BLUSA|BERMUDA|BLAZER|CASACO|TERNO|CONJUNTO|MACACAO|CAMISETA|COLETE)\b/
const CALCADO = /\b(BOTA|BOTINA|SAPATO|TENIS|CALCADO)\b/

/**
 * Tamanhos para uma peça que NÃO tem tamanho no cadastro (um item só):
 * roupa → P a XXGG (os do formulário); calçado → 34 a 46; o resto é tamanho
 * único (sem botões).
 */
export function tamanhosGenericos(nomeBase: string): string[] {
  const n = normalizarPeca(nomeBase)
  if (CALCADO.test(n)) return Array.from({ length: 13 }, (_, i) => String(34 + i))
  if (ROUPA.test(n)) return ['P', 'M', 'G', 'GG', 'XGG', 'XXGG']
  return []
}

const SIGLAS = new Set(['ASG', 'PVC', 'UV', 'EPI', 'PU', 'TI', 'PFF2', 'N95', 'CNOOP', 'TECH', 'II'])

/** "CAMISA MALHA POLO AZUL CLARA - ASG" → "Camisa malha polo azul clara — ASG". */
export function nomeAmigavelPeca(nome: string): string {
  const limpo = nome.trim().replace(/\s+-\s+/g, ' — ')
  let primeira = true
  return limpo
    .split(' ')
    .map((p) => {
      if (!p) return p
      const so = normalizarPeca(p).replace(/ /g, '')
      if (SIGLAS.has(so)) return p.toUpperCase()
      const minusc = p.toLocaleLowerCase('pt-BR')
      if (primeira && /[a-zà-ú]/i.test(minusc)) {
        primeira = false
        return minusc.charAt(0).toLocaleUpperCase('pt-BR') + minusc.slice(1)
      }
      return minusc
    })
    .join(' ')
}

// ---------- Agrupamento em peças ----------

export interface ItemCeuCadastro {
  id: string
  nome: string
  tipo: TipoPeca
  ativo: boolean
}

export interface OpcaoPeca {
  /** '' = tamanho único */
  tamanho: string
  item_id: string
}

export interface PecaPublica {
  /** Chave da peça (derivada do nome base) — não é dado pessoal. */
  id: string
  rotulo: string
  tipo: TipoPeca
  /** Vazio = serve para qualquer função. */
  funcoes: FuncaoPeca[]
  opcoes: OpcaoPeca[]
}

interface GrupoPeca {
  chave: string
  base: string
  tipo: TipoPeca
  itens: { id: string; tamanho: string | null; ativo: boolean }[]
}

export function agruparItensEmPecas(itens: ItemCeuCadastro[]): Map<string, GrupoPeca> {
  const grupos = new Map<string, GrupoPeca>()
  for (const i of itens) {
    const { base, tamanho } = separarTamanhoDoNome(i.nome)
    const chave = chavePeca(base, i.tipo)
    const g = grupos.get(chave) ?? { chave, base, tipo: i.tipo, itens: [] }
    // O nome exibido vem de um item ativo, se houver.
    if (i.ativo && !g.itens.some((x) => x.ativo)) g.base = base
    g.itens.push({ id: i.id, tamanho, ativo: i.ativo })
    grupos.set(chave, g)
  }
  return grupos
}

/** Opções de tamanho da peça: os tamanhos ATIVOS do cadastro; sem tamanho no cadastro, a lista genérica. */
export function opcoesDoGrupo(g: GrupoPeca): OpcaoPeca[] {
  const ativos = g.itens.filter((i) => i.ativo)
  const comTamanho = ativos.filter((i) => i.tamanho)
  if (comTamanho.length > 0) {
    const porTamanho = new Map<string, string>()
    for (const i of comTamanho) if (!porTamanho.has(i.tamanho!)) porTamanho.set(i.tamanho!, i.id)
    return ordenarTamanhos([...porTamanho.keys()]).map((t) => ({ tamanho: t, item_id: porTamanho.get(t)! }))
  }
  const unico = ativos[0]
  if (!unico) return []
  const genericos = tamanhosGenericos(g.base)
  return genericos.length > 0 ? genericos.map((t) => ({ tamanho: t, item_id: unico.id })) : [{ tamanho: '', item_id: unico.id }]
}

/**
 * Itens do CEU que NUNCA aparecem no link público do líder (nem no fallback
 * de contrato sem kit, nem se alguém os recolocar num kit). Continuam ativos
 * no CEU — a Beth os entrega como exceção.
 * - 0e528c08-…: "CAMISA MALHA POLO AZUL CLARA - ASG" (a "331"), modelo
 *   antigo/descontinuado. Decisão da gestora em 15/10/2026 (limpeza pesada).
 */
export const ITENS_CEU_OCULTOS_LINK: ReadonlySet<string> = new Set(['0e528c08-54ff-45f4-a1af-12fc54d4b106'])

export interface ConfigPecaContrato {
  item_id: string
  rotulo: string | null
  funcoes: string[] | null
  ordem: number | null
  ativo: boolean
}

/**
 * Peças que o líder vê: as do kit de uniforme do contrato (cada linha da
 * configuração aponta para UM item da peça — qualquer tamanho — e a peça
 * inteira entra). Sem configuração, cai em todas as peças ativas do CEU
 * (fallback; `semKitUniforme` avisa a tela).
 */
export function pecasDoContrato(
  config: ConfigPecaContrato[],
  todosItens: ItemCeuCadastro[]
): { pecas: PecaPublica[]; semKitUniforme: boolean } {
  // Itens ocultos saem antes de agrupar: a peça deles (nome próprio) some, e
  // uma linha de kit que aponte para eles é ignorada (sem chave de peça).
  const itens = todosItens.filter((i) => !ITENS_CEU_OCULTOS_LINK.has(i.id))
  const grupos = agruparItensEmPecas(itens)
  const chavePorItem = new Map<string, string>()
  for (const g of grupos.values()) for (const i of g.itens) chavePorItem.set(i.id, g.chave)

  const ativas = config.filter((c) => c.ativo)
  if (ativas.length === 0) {
    const pecas = [...grupos.values()]
      .map((g) => ({ id: g.chave, rotulo: nomeAmigavelPeca(g.base), tipo: g.tipo, funcoes: [] as FuncaoPeca[], opcoes: opcoesDoGrupo(g) }))
      .filter((p) => p.opcoes.length > 0)
      .sort((a, b) => (a.tipo === b.tipo ? a.rotulo.localeCompare(b.rotulo, 'pt-BR') : a.tipo === 'uniforme' ? -1 : 1))
    return { pecas, semKitUniforme: true }
  }

  const porChave = new Map<string, PecaPublica & { ordem: number }>()
  for (const c of ativas) {
    const chave = chavePorItem.get(c.item_id)
    const g = chave ? grupos.get(chave) : undefined
    if (!g) continue
    const funcoes = (c.funcoes ?? []).filter(ehFuncaoPeca)
    const atual = porChave.get(g.chave)
    if (atual) {
      // Mesma peça em duas linhas: une as funções (vazio = todas).
      atual.funcoes = atual.funcoes.length === 0 || funcoes.length === 0 ? [] : [...new Set([...atual.funcoes, ...funcoes])]
      continue
    }
    const opcoes = opcoesDoGrupo(g)
    if (opcoes.length === 0) continue
    porChave.set(g.chave, {
      id: g.chave,
      rotulo: c.rotulo?.trim() || nomeAmigavelPeca(g.base),
      tipo: g.tipo,
      funcoes,
      opcoes,
      ordem: c.ordem ?? 9999,
    })
  }
  const pecas = [...porChave.values()]
    .sort((a, b) => (a.tipo !== b.tipo ? (a.tipo === 'uniforme' ? -1 : 1) : a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo, 'pt-BR')))
    .map((p) => ({ id: p.id, rotulo: p.rotulo, tipo: p.tipo, funcoes: p.funcoes, opcoes: p.opcoes }))
  return { pecas, semKitUniforme: false }
}

/** Peças para a função da pessoa; função desconhecida ou nada que case = todas. */
export function pecasParaFuncao(pecas: PecaPublica[], funcao: FuncaoPeca | null): PecaPublica[] {
  if (!funcao) return pecas
  const daFuncao = pecas.filter((p) => p.funcoes.length === 0 || p.funcoes.includes(funcao))
  return daFuncao.length > 0 ? daFuncao : pecas
}

// ---------- Equipe (primeiro nome + inicial) ----------

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'd'])

function capitalizar(p: string): string {
  const m = p.toLocaleLowerCase('pt-BR')
  return m.charAt(0).toLocaleUpperCase('pt-BR') + m.slice(1)
}

function tokensNome(nome: string): string[] {
  return nome
    .trim()
    .split(/\s+/)
    .filter((t) => t && !PARTICULAS.has(t.toLocaleLowerCase('pt-BR')))
    .map((t) => t.replace(/[^\p{L}'-]/gu, ''))
    .filter(Boolean)
}

/**
 * Nomes curtos SEMPRE só "Primeiro N." (primeiro nome + inicial do 1º
 * sobrenome) — decisão da gestora: nunca revelar mais que a inicial (a
 * desambiguação progressiva podia expor o sobrenome inteiro quando um era
 * prefixo do outro, ex.: "Ana Silva Costa" × "Ana Silveira Prata").
 * Colisões dentro da mesma lista desambiguam SEM revelar o sobrenome:
 * primeiro a inicial do 2º sobrenome ("Ana S. C."); persistindo a colisão
 * (ou sem 2º sobrenome), um contador determinístico pela ordem da lista
 * ("Ana S. 2", "Ana S. 3" — o primeiro fica sem número).
 */
export function nomesCurtos(nomes: string[]): string[] {
  const partes = nomes.map(tokensNome)
  const primeiro = (i: number) => capitalizar(partes[i][0] ?? 'Colaborador')
  const sobrenomes = (i: number) => partes[i].slice(1)

  const rotuloBase = (i: number): string => {
    const s = sobrenomes(i)
    if (s.length === 0) return primeiro(i)
    return `${primeiro(i)} ${capitalizar(s[0].charAt(0))}.`
  }
  const rotuloComSegundo = (i: number): string | null => {
    const s = sobrenomes(i)
    if (s.length < 2) return null
    return `${rotuloBase(i)} ${capitalizar(s[1].charAt(0))}.`
  }

  const resultado = nomes.map((_, i) => rotuloBase(i))
  const conflitos = () => {
    const contagem = new Map<string, number[]>()
    resultado.forEach((r, i) => contagem.set(r.toLocaleLowerCase('pt-BR'), [...(contagem.get(r.toLocaleLowerCase('pt-BR')) ?? []), i]))
    return [...contagem.values()].filter((l) => l.length > 1)
  }

  // 1º passo: quem tem 2º sobrenome ganha a inicial dele ("Ana S. C.") —
  // o formato "... X. Y." nunca colide com o formato base "... X.".
  for (const grupo of conflitos()) {
    for (const i of grupo) {
      const comSegundo = rotuloComSegundo(i)
      if (comSegundo) resultado[i] = comSegundo
    }
  }
  // 2º passo: contador pela ordem da lista (o 1º do grupo fica sem número).
  for (const grupo of conflitos()) grupo.forEach((i, k) => (resultado[i] = k === 0 ? resultado[i] : `${resultado[i]} ${k + 1}`))
  return resultado
}

export interface MembroEquipePublico {
  /** Identificador opaco (HMAC no servidor) — nunca o uuid do colaborador. */
  ref: string
  nome: string
  funcao: FuncaoPeca | null
}

// ---------- Grupos da equipe no link (17/10/2026) ----------

export type GrupoEquipe = 'limpeza' | 'portaria'

export const GRUPOS_EQUIPE: { id: GrupoEquipe; rotulo: string }[] = [
  { id: 'limpeza', rotulo: 'Limpeza e encarregado' },
  { id: 'portaria', rotulo: 'Portaria' },
]

/**
 * Grupo de uma função, para dividir a lista da equipe em contratos grandes.
 * Portaria = portaria, recepção e monitoramento (ficam no balcão/guarita).
 * Limpeza e encarregado = ASG, encarregado, manutenção, jardinagem e
 * administrativo (apoio do posto). Função não reconhecida (null) não decide
 * grupo: a pessoa aparece nos dois.
 */
export function grupoDaFuncao(funcao: FuncaoPeca | null | undefined): GrupoEquipe | null {
  if (!funcao) return null
  if (funcao === 'portaria' || funcao === 'recepcao' || funcao === 'monitoramento') return 'portaria'
  return 'limpeza'
}

/** O seletor de grupo só faz sentido se a equipe tem gente dos dois grupos. */
export function equipeTemDoisGrupos(equipe: { funcao: FuncaoPeca | null }[]): boolean {
  const grupos = new Set(equipe.map((m) => grupoDaFuncao(m.funcao)).filter(Boolean))
  return grupos.size === 2
}

/** Equipe do grupo escolhido (função não reconhecida entra nos dois). */
export function equipeDoGrupo<T extends { funcao: FuncaoPeca | null }>(equipe: T[], grupo: GrupoEquipe | null): T[] {
  if (!grupo) return equipe
  return equipe.filter((m) => {
    const g = grupoDaFuncao(m.funcao)
    return g === null || g === grupo
  })
}

/** Lista da equipe para o link público, ordenada pelo nome exibido. */
export function montarEquipePublica(membros: { ref: string; nome_completo: string; cargo: string | null }[]): MembroEquipePublico[] {
  const curtos = nomesCurtos(membros.map((m) => m.nome_completo))
  return membros
    .map((m, i) => ({ ref: m.ref, nome: curtos[i], funcao: funcaoDoCargo(m.cargo) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// ---------- Snapshots da linha identificada (servidor e fila CEU → Pedidos) ----------

export interface TamanhosCadastro {
  tamanho_camisa: string | null
  tamanho_calca: string | null
  tamanho_calcado: string | null
  tamanho_luva: string | null
}

/**
 * Medida do cadastro (ceu_tamanhos) que vale para o item. Mesma regra de
 * tamanhoParaItem (src/lib/ceu/tamanhosPuro.ts — o teste trava a paridade).
 */
export function tamanhoCadastroParaItem(nomeItem: string, t: TamanhosCadastro | null | undefined): string | null {
  if (!t) return null
  const nome = nomeItem.toLowerCase()
  if (nome.includes('luva')) return t.tamanho_luva
  if (nome.includes('camisa') || nome.includes('jaleco')) return t.tamanho_camisa
  if (nome.includes('calça') || nome.includes('calca')) return t.tamanho_calca
  if (/bota|botina|sapato|calçado|calcado|tênis|tenis|sandália|sandalia/.test(nome)) return t.tamanho_calcado
  return null
}

/** Mesma regra de tamanhosDivergem (src/lib/materiais/pedidos.ts). */
export function tamanhosDivergemPeca(pedido: string | null | undefined, cadastro: string | null | undefined): boolean {
  const norm = (x: string | null | undefined) => (x ?? '').toUpperCase().replace(/\s+/g, '')
  if (!norm(pedido) || !norm(cadastro)) return false
  return norm(pedido) !== norm(cadastro)
}

/** Ids de TODOS os itens (qualquer tamanho, ativos ou não) da mesma peça do item. */
export function itensDaMesmaPeca(itens: ItemCeuCadastro[], itemId: string): Set<string> {
  const alvo = itens.find((i) => i.id === itemId)
  if (!alvo) return new Set([itemId])
  const chave = chavePeca(separarTamanhoDoNome(alvo.nome).base, alvo.tipo)
  return new Set(itens.filter((i) => i.tipo === alvo.tipo && chavePeca(separarTamanhoDoNome(i.nome).base, i.tipo) === chave).map((i) => i.id))
}

/**
 * Última entrega da PEÇA ao colaborador (qualquer tamanho): pediu "BOTA PVC
 * 39" e recebeu a 38 em março → devolve a entrega de março e o item (38).
 */
export function ultimaEntregaDaPeca(
  entregas: { item_id: string; data_entrega: string }[],
  idsDaPeca: Set<string>
): { data: string; item_id: string } | null {
  let melhor: { data: string; item_id: string } | null = null
  for (const e of entregas) {
    if (!idsDaPeca.has(e.item_id) || !e.data_entrega) continue
    if (!melhor || e.data_entrega > melhor.data) melhor = { data: e.data_entrega.slice(0, 10), item_id: e.item_id }
  }
  return melhor
}

// ---------- Equipe do contrato de pedido ----------

/**
 * Colaboradores da equipe do contrato: união do departamento principal com
 * os departamentos extras (mat_contratos.departamentos_equipe_extra —
 * decisão da gestão de 14/10/2026, caso Telex × DuoConnect), cada um pela
 * regra de idsColaboradoresDoDepartamento (fuzzy + linhas irmãs, sem ILIKE).
 */
export function idsEquipeDoContrato(
  departamentos: DepartamentoFuzzy[],
  colaboradores: ColaboradorDepartamento[],
  departamentoIds: string[]
): Set<string> {
  const ids = new Set<string>()
  for (const depId of new Set(departamentoIds)) {
    const alvo = departamentos.find((d) => d.id === depId)
    if (!alvo) continue
    for (const id of idsColaboradoresDoDepartamento(departamentos, colaboradores, alvo.nome_curto?.trim() || alvo.nome)) ids.add(id)
  }
  return ids
}
