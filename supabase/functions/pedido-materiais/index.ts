// Edge Function: pedido-materiais
// Link público do líder (QR code no quadro do contrato) para o pedido mensal
// de materiais, uniformes, EPIs, crachás e kit portaria —
// docs/PLANO_MATERIAIS_FASE1.md §4. SEM login e SEM PIN (decisão da gestão,
// 09/10/2026).
//
// Dados pessoais no link público: SÓ a lista da equipe do contrato com
// primeiro nome + inicial do sobrenome ("Michelle A.") e um identificador
// opaco (HMAC) por pessoa — decisão da gestão de 09/10/2026, reiterada em
// 14/10/2026. Nunca sobrenome completo, CPF, matrícula, foto, tamanhos ou
// cargo por extenso. No envio o servidor troca o identificador pelo
// colaborador_id. CENTRO AUDITIVO TELEX: os 4 contratos de pedido mostram a
// equipe do departamento inteiro (exceção aceita pela gestão em 14/10/2026).
//
// Ações (POST, campo `acao`):
//   públicas (token do link):  carregar, buscar_item, enviar
//   internas (JWT admin/adm/gestor — materiais.gerenciar_links):
//                              gerar_link, ver_link, revogar_link
//
// `carregar` devolve SÓ os itens do Kit Mensal do contrato (nunca o catálogo
// inteiro); "Preciso de outro item" usa `buscar_item` (termo ≥ 3 letras, até 8
// itens ativos, busca fuzzy local — src/lib/materiais/buscaItens.ts).
//
// Kit confirmável + pedido extra (decisão da gestão, 16/10/2026 — migration
// 135): cada linha de produto vai para a RPC com `parte` ('kit' = o que o
// posto vai receber, só diminui; 'extra' = além do kit, motivo OPCIONAL).
// `carregar` informa `kit_confirmado` (o kit do mês já veio em outro envio:
// o novo envio só traz extras). A RPC aprova o kit na hora quando
// materiais_config.kit_aprovacao_automatica está ligada.
//
// Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (padrão da plataforma) e
// ENCRYPTION_KEY (já existe — mesma da function econtador; cifra o token para
// o escritório reexibir o link/QR e deriva a chave HMAC dos identificadores
// da equipe). Opcional: ALLOWED_ORIGINS.
//
// Deploy (verify_jwt false — a chamada pública não tem JWT):
//   powershell scripts/lib/implantar-edge-function.ps1 -Slug pedido-materiais -Arquivo supabase/functions/pedido-materiais/index.ts
//
// Os blocos "LÓGICA PURA" abaixo são cópia de arquivos de src/ (deploy de
// arquivo único). Não edite aqui: edite os arquivos de src e rode
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

// Dependências de src/lib/departamentos.ts (vêm de src/lib/utils.ts no app).
function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function distanciaLevenshtein(a: string, b: string): number {
  return distanciaEdicao(a, b)
}

// >>> LÓGICA PURA: src/lib/materiais/pecasCeu.ts (cópia — não editar aqui)
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
  /** Migration 141: sem estoque — o colaborador compra na loja com autorização (sem tamanho no pedido). */
  compra_na_loja?: boolean
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
  /** Compra na loja com autorização: o link não pede tamanho (só aparece quando true). */
  compra_na_loja?: boolean
}

interface GrupoPeca {
  chave: string
  base: string
  tipo: TipoPeca
  itens: { id: string; tamanho: string | null; ativo: boolean; compra_na_loja: boolean }[]
}

export function agruparItensEmPecas(itens: ItemCeuCadastro[]): Map<string, GrupoPeca> {
  const grupos = new Map<string, GrupoPeca>()
  for (const i of itens) {
    const { base, tamanho } = separarTamanhoDoNome(i.nome)
    const chave = chavePeca(base, i.tipo)
    const g = grupos.get(chave) ?? { chave, base, tipo: i.tipo, itens: [] }
    // O nome exibido vem de um item ativo, se houver.
    if (i.ativo && !g.itens.some((x) => x.ativo)) g.base = base
    g.itens.push({ id: i.id, tamanho, ativo: i.ativo, compra_na_loja: i.compra_na_loja === true })
    grupos.set(chave, g)
  }
  return grupos
}

/** A peça é "compra na loja" quando TODOS os seus itens ativos estão marcados. */
export function pecaCompraNaLoja(g: GrupoPeca): boolean {
  const ativos = g.itens.filter((i) => i.ativo)
  return ativos.length > 0 && ativos.every((i) => i.compra_na_loja)
}

/** Opções de tamanho da peça: os tamanhos ATIVOS do cadastro; sem tamanho no cadastro, a lista genérica. */
export function opcoesDoGrupo(g: GrupoPeca): OpcaoPeca[] {
  const ativos = g.itens.filter((i) => i.ativo)
  // Compra na loja: sem escolha de tamanho (opção única, tamanho vazio).
  if (pecaCompraNaLoja(g)) return [{ tamanho: '', item_id: ativos[0].id }]
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
      .map((g) => ({ id: g.chave, rotulo: nomeAmigavelPeca(g.base), tipo: g.tipo, funcoes: [] as FuncaoPeca[], opcoes: opcoesDoGrupo(g), ...(pecaCompraNaLoja(g) ? { compra_na_loja: true } : {}) }))
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
      ...(pecaCompraNaLoja(g) ? { compra_na_loja: true } : {}),
      ordem: c.ordem ?? 9999,
    })
  }
  const pecas = [...porChave.values()]
    .sort((a, b) => (a.tipo !== b.tipo ? (a.tipo === 'uniforme' ? -1 : 1) : a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo, 'pt-BR')))
    .map((p) => ({ id: p.id, rotulo: p.rotulo, tipo: p.tipo, funcoes: p.funcoes, opcoes: p.opcoes, ...(p.compra_na_loja ? { compra_na_loja: true } : {}) }))
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
// <<< FIM: src/lib/materiais/pecasCeu.ts

// >>> LÓGICA PURA: src/lib/materiais/buscaItens.ts (cópia — não editar aqui)
// Busca tolerante a erro de digitação no catálogo de materiais — lógica pura.
// Usada pelo campo único "O que mais você precisa?" do link do líder (ação
// `buscar_item` da Edge Function pedido-materiais): o líder digita "cab",
// "cabo vasora", "detergete", "piaçava", "disco 350" e recebe até 8
// sugestões ATIVAS.
//
// Variações (decisão da gestão, 16/10/2026): item com variações vira UM
// resultado por variação, com nome de exibição completo ("Vassoura Noviça",
// "Disco branco 350 mm", "Flanela Microfibra amarela") — a busca olha também
// o rótulo da variação e os nomes antigos (`mat_aliases`) ligados a ela. No
// link do líder cada quadro tem um item e uma variação já definidos aqui.
//
// ESTE ARQUIVO É COPIADO PARA DENTRO DA EDGE FUNCTION
// supabase/functions/pedido-materiais/index.ts por
// `node scripts/sincronizar-pedido-materiais.mjs` (sem imports).
//
// Decisão (14/10/2026): busca fuzzy LOCAL, instantânea e gratuita — sem
// chamada externa. Normalização sem acento + prefixo + Levenshtein por
// palavra + trigramas, olhando o nome do item e os nomes antigos/grafias
// reais de `mat_aliases`.
//
// PONTO DE EXTENSÃO (não implementado): quando `buscarItens` não devolver
// nada, a function poderia consultar um classificador externo (ex.: Jev, da
// TypeSafe) com o termo e a lista de nomes do catálogo, aceitando só
// respostas de alta confiança. Ver `FallbackBusca` abaixo — hoje a function
// não passa nenhum fallback e o líder usa "Não achei, enviar assim".
//
// Visão do líder (migration 136, decisões da gestora de 16/10/2026):
// - `nome_lider`: nome de exibição no link ("Removedor desengraxante 5L");
//   itens com o MESMO nome_lider viram UM resultado (preferência para o do
//   kit do contrato; sem isso, o primeiro na ordem do catálogo). Os itens
//   seguem separados no banco (preço, kit e histórico próprios).
// - Variações ocultas (marca) e itens exclusivos de outro contrato saem
//   ANTES da busca, no servidor (`visaoDoLider` em pedidoLider.ts e
//   `exclusivoDeOutroContrato` abaixo).

export interface ItemBuscavel {
  id: string
  nome: string
  /** Nomes antigos e grafias do ITEM (mat_aliases.nome_legado sem variacao_id). */
  aliases?: string[]
  /** Variações ativas: com elas, cada variação é um resultado próprio. */
  variacoes?: { id: string; rotulo: string }[]
  /** Nomes antigos ligados a uma variação (mat_aliases com variacao_id), por id da variação. */
  aliasesPorVariacao?: Record<string, string[]>
  /** Itens (ou variações) do kit do contrato: pequena preferência no desempate. */
  noKit?: boolean
  /** Ids das variações que estão no kit (o item inteiro no kit = noKit). */
  variacoesNoKit?: string[]
  /** Nome no link do líder (migration 136). Mesmo nome_lider = um resultado só. */
  nome_lider?: string | null
}

/**
 * Item exclusivo de outros contratos (mat_itens.contratos_exclusivos,
 * migration 136): lista preenchida que não inclui o contrato. NULL ou vazia
 * = item de todos os contratos.
 */
export function exclusivoDeOutroContrato(
  item: { contratos_exclusivos?: string[] | null },
  contratoId: string | null | undefined
): boolean {
  const lista = item.contratos_exclusivos ?? []
  if (lista.length === 0) return false
  return !contratoId || !lista.includes(contratoId)
}

/**
 * Nome do item no link do líder: o `nome_lider` quando preenchido (com a
 * variação visível, se houver); senão a regra de `nomeExibicaoItem`.
 */
export function nomeLiderItem(
  item: { nome: string; nome_lider?: string | null },
  rotuloVariacao?: string | null
): string {
  const lider = (item.nome_lider ?? '').trim()
  return lider ? nomeExibicaoItem(lider, rotuloVariacao) : nomeExibicaoItem(item.nome, rotuloVariacao)
}

// Palavras de cadastro que não ajudam a pessoa a reconhecer o item.
// Conservador: só a unidade no FIM do nome ("Pedra Sanitária UN", "Saco de
// lixo PCT") e "Especial" quando há uma variação para pôr no lugar
// ("Vassoura Especial" + "Noviça" = "Vassoura Noviça").
const UNIDADE_NO_FIM = /\s+(UN|UND|UNID|PCT)\.?$/i
const GENERICAS_COM_VARIACAO = /\s+especial\b/gi

/**
 * Nome amigável do item (com a variação, quando houver): "Vassoura Especial
 * UN" + "Noviça" = "Vassoura Noviça"; "Disco branco UN" + "350 mm" = "Disco
 * branco 350 mm"; "Pedra Sanitária UN" = "Pedra Sanitária". Na dúvida (o nome
 * ficaria vazio), mantém o nome do cadastro.
 */
export function nomeExibicaoItem(nome: string, rotuloVariacao?: string | null): string {
  const original = (nome ?? '').trim()
  let base = original.replace(UNIDADE_NO_FIM, '').trim()
  const rotulo = (rotuloVariacao ?? '').trim()
  if (rotulo) {
    const semGenerica = base.replace(GENERICAS_COM_VARIACAO, '').replace(/\s+/g, ' ').trim()
    if (semGenerica) base = semGenerica
  }
  if (!base) base = original
  if (!rotulo) return base
  // Rótulo que já está no nome ("Mop Cabo grande" + "grande") não repete.
  if (` ${normalizarBusca(base)}`.endsWith(` ${normalizarBusca(rotulo)}`)) return base
  return `${base} ${rotulo}`
}

/** Assinatura do fallback futuro (não usado hoje). Deve devolver ids do catálogo. */
export type FallbackBusca = (termo: string, nomes: { id: string; nome: string }[]) => Promise<string[]>

export const BUSCA_MIN_CARACTERES = 3
// 8 resultados (decisão da gestora, 16/10/2026): "vassoura" cabe inteira
// (Piaçava ficava de fora com 5); busca maior ("disco") pede para detalhar.
export const BUSCA_MAX_RESULTADOS = 8
const NOTA_MINIMA = 0.6

export function normalizarBusca(texto: string | null | undefined): string {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const VAZIAS_BUSCA = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'com', 'em', 'e', 'p', 'c'])

function palavrasBusca(texto: string): string[] {
  return normalizarBusca(texto)
    .split(' ')
    .filter((p) => p && !VAZIAS_BUSCA.has(p))
}

/** Levenshtein com corte: devolve limite + 1 quando passa do limite. */
export function distanciaEdicao(a: string, b: string, limite = 99): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > limite) return limite + 1
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const atual = [i]
    let menor = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      atual.push(v)
      if (v < menor) menor = v
    }
    if (menor > limite) return limite + 1
    anterior = atual
  }
  return anterior[b.length]
}

function trigramasDe(texto: string): Set<string> {
  const s = `  ${texto} `
  const t = new Set<string>()
  for (let i = 0; i < s.length - 2; i++) t.add(s.slice(i, i + 3))
  return t
}

export function similaridadeTrigramas(a: string, b: string): number {
  const ta = trigramasDe(a)
  const tb = trigramasDe(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let comuns = 0
  for (const x of ta) if (tb.has(x)) comuns++
  return comuns / (ta.size + tb.size - comuns)
}

/** Erros de digitação aceitos por palavra: 0 até 3 letras, 1 até 5, 2 a partir de 6. */
function tolerancia(n: number): number {
  return n <= 3 ? 0 : n <= 5 ? 1 : 2
}

/** Nota de 0 a 1 de uma palavra digitada contra uma palavra do nome. */
function notaPalavra(t: string, p: string): number {
  if (t === p) return 1
  if (p.startsWith(t)) return t.length >= 2 ? 0.92 : 0.5
  if (t.startsWith(p) && p.length >= 3) return 0.8
  const tol = tolerancia(t.length)
  if (tol > 0) {
    if (distanciaEdicao(t, p, tol) <= tol) return 0.82
  }
  if (tol > 0 && t.length >= 5) {
    // prefixo com erro: "vasor" ~ "vassoura"
    if (p.length > t.length && distanciaEdicao(t, p.slice(0, t.length), tol) <= tol) return 0.72
    if (p.length > t.length + 1 && distanciaEdicao(t, p.slice(0, t.length + 1), tol) <= tol) return 0.72
  }
  return similaridadeTrigramas(t, p) * 0.7
}

/** Nota de um termo contra um nome (média das palavras digitadas, cada uma no melhor par). */
export function notaNome(termo: string, nome: string): number {
  const ts = palavrasBusca(termo)
  const ps = palavrasBusca(nome)
  if (ts.length === 0 || ps.length === 0) return 0
  let soma = 0
  let melhorPalavra = 0
  for (const t of ts) {
    let melhor = 0
    for (const p of ps) melhor = Math.max(melhor, notaPalavra(t, p))
    soma += melhor
    melhorPalavra = Math.max(melhorPalavra, melhor)
  }
  let nota = soma / ts.length
  // Várias palavras: uma delas casando bem já sugere o item ("cabo vasora"
  // traz os cabos e as vassouras quando não existe "cabo de vassoura").
  if (ts.length > 1) nota = Math.max(nota, melhorPalavra * 0.75)
  const tn = normalizarBusca(termo)
  const nn = normalizarBusca(nome)
  if (nn.startsWith(tn)) nota = Math.min(1, nota + 0.08)
  return Math.max(nota, similaridadeTrigramas(tn, nn) * 0.9)
}

export interface ResultadoBusca<T> {
  item: T
  /** Variação do resultado (item com variações = um resultado por variação). */
  variacao: { id: string; rotulo: string } | null
  /** Nome de exibição completo (nomeExibicaoItem). */
  nome: string
  nota: number
  /** Nome (ou alias) que casou melhor. */
  casouCom: string
}

/** Preferência do kit do contrato no desempate (não faz item ruim passar na frente de item bom). */
const BONUS_KIT = 0.03

/**
 * Até `limite` resultados que casam com o termo, do melhor para o pior. Item
 * com variações gera um resultado por variação. Termo com menos de
 * BUSCA_MIN_CARACTERES letras não busca (evita "listar tudo"). Em empate,
 * vem primeiro o do kit do contrato e uma variação de cada item antes da
 * segunda do mesmo item ("vassoura" mostra vassouras diferentes).
 */
export function buscarItens<T extends ItemBuscavel>(
  termo: string,
  itens: T[],
  limite = BUSCA_MAX_RESULTADOS,
  notaMinima = NOTA_MINIMA
): ResultadoBusca<T>[] {
  const tn = normalizarBusca(termo)
  if (tn.replace(/ /g, '').length < BUSCA_MIN_CARACTERES) return []
  type Candidato = ResultadoBusca<T> & { ordemNoItem: number; kit: boolean; ordemItem: number }
  const candidatos: Candidato[] = []
  itens.forEach((item, ordemItem) => {
    const variacoes = item.variacoes ?? []
    const lider = (item.nome_lider ?? '').trim()
    const alvos: { variacao: { id: string; rotulo: string } | null; nomes: string[]; aliases: string[]; kit: boolean }[] =
      variacoes.length === 0
        ? [{ variacao: null, nomes: lider ? [lider, item.nome] : [item.nome], aliases: item.aliases ?? [], kit: !!item.noKit }]
        : variacoes.map((v) => ({
            variacao: v,
            nomes: [
              nomeLiderItem(item, v.rotulo),
              `${item.nome} ${v.rotulo}`,
              ...(lider ? [nomeExibicaoItem(item.nome, v.rotulo)] : []),
            ],
            aliases: [...(item.aliasesPorVariacao?.[v.id] ?? []), ...(item.aliases ?? [])],
            kit: !!item.noKit || (item.variacoesNoKit ?? []).includes(v.id),
          }))
    alvos.forEach((alvo, ordemNoItem) => {
      let melhor = 0
      let casouCom = alvo.nomes[0]
      for (const n of alvo.nomes) {
        const nota = notaNome(tn, n)
        if (nota > melhor) {
          melhor = nota
          casouCom = n
        }
      }
      for (const a of alvo.aliases) {
        // alias vale um pouco menos que o nome oficial (desempate)
        const n = notaNome(tn, a) * 0.97
        if (n > melhor) {
          melhor = n
          casouCom = a
        }
      }
      if (melhor < notaMinima) return
      candidatos.push({
        item,
        variacao: alvo.variacao,
        nome: nomeLiderItem(item, alvo.variacao?.rotulo),
        nota: Math.min(1, melhor) + (alvo.kit ? BONUS_KIT : 0),
        casouCom,
        ordemNoItem,
        kit: alvo.kit,
        ordemItem,
      })
    })
  })
  // Mesmo nome_lider (+ variação visível) = um resultado só: fica o do kit do
  // contrato; sem kit, o primeiro na ordem do catálogo. Vale a melhor nota do grupo.
  const porNomeLider = new Map<string, Candidato>()
  const unicos: Candidato[] = []
  for (const c of candidatos) {
    if (!(c.item.nome_lider ?? '').trim()) {
      unicos.push(c)
      continue
    }
    const chave = normalizarBusca(c.nome)
    const atual = porNomeLider.get(chave)
    if (!atual) {
      porNomeLider.set(chave, c)
      continue
    }
    const nota = Math.max(atual.nota - (atual.kit ? BONUS_KIT : 0), c.nota - (c.kit ? BONUS_KIT : 0))
    const fica = atual.kit !== c.kit ? (c.kit ? c : atual) : atual.ordemItem <= c.ordemItem ? atual : c
    fica.nota = nota + (fica.kit ? BONUS_KIT : 0)
    porNomeLider.set(chave, fica)
  }
  candidatos.length = 0
  candidatos.push(...unicos, ...porNomeLider.values())
  // Ordem entre as variações do mesmo item que empataram: a 1ª de cada item
  // vem antes da 2ª de qualquer item.
  const faixa = (n: number) => Math.round(n * 100)
  const vistosPorFaixa = new Map<string, number>()
  const ordenados = candidatos.sort(
    (a, b) => b.nota - a.nota || a.ordemNoItem - b.ordemNoItem || a.nome.localeCompare(b.nome, 'pt-BR')
  )
  const posicaoNoItem = new Map<Candidato, number>()
  for (const c of ordenados) {
    const chave = `${faixa(c.nota)}|${c.item.id}`
    const n = vistosPorFaixa.get(chave) ?? 0
    posicaoNoItem.set(c, n)
    vistosPorFaixa.set(chave, n + 1)
  }
  return ordenados
    .sort(
      (a, b) =>
        faixa(b.nota) - faixa(a.nota) ||
        posicaoNoItem.get(a)! - posicaoNoItem.get(b)! ||
        b.nota - a.nota ||
        a.ordemNoItem - b.ordemNoItem ||
        a.nome.localeCompare(b.nome, 'pt-BR')
    )
    .slice(0, Math.max(0, Math.min(limite, BUSCA_MAX_RESULTADOS)))
    .map(({ item, variacao, nome, nota, casouCom }) => ({ item, variacao, nome, nota, casouCom }))
}
// <<< FIM: src/lib/materiais/buscaItens.ts

// >>> LÓGICA PURA: src/lib/materiais/pedidoLider.ts (cópia — não editar aqui)
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

/** A peça deste item é "compra na loja com autorização" (migration 141)? Então não leva tamanho. */
export function itemCeuCompraNaLoja(pecas: PecaPublica[] | undefined, itemId: string): boolean {
  return !!pecas?.some((p) => p.compra_na_loja === true && p.opcoes.some((o) => o.item_id === itemId))
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
    // Compra na loja com autorização (migration 141): sem tamanho, mesmo que o cliente mande.
    const semTamanho = !!item && itemCeuCompraNaLoja(ctx.pecas, item.id)
    const tamanho = semTamanho ? '' : texto(c.tamanho)
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
// <<< FIM: src/lib/materiais/pedidoLider.ts

// >>> LÓGICA PURA: src/lib/departamentos.ts (cópia — não editar aqui)

// >>> SYNC-ECONTADOR: INÍCIO — esta região é copiada verbatim para
// supabase/functions/sync-econtador/index.ts por
// scripts/sincronizar-sync-econtador.mjs (deploy da function é arquivo único).
// Edite AQUI e rode o script; src/lib/econtador.test.ts falha se divergir.
// A região só pode usar removerAcentos/distanciaLevenshtein (a function os
// define no próprio bloco de infra, como no pedido-materiais) — nada de
// imports novos aqui dentro.

export interface DepartamentoFuzzy {
  id: string
  nome: string
  nome_curto: string | null
  empresa_id?: string | null
  status?: string | null
}

function normalizarTexto(texto: string): string {
  return removerAcentos(texto)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normalização usada nos matches de departamento (sem acentos/pontuação, maiúsculas). */
export function normalizarDepartamento(texto: string): string {
  return normalizarTexto(texto)
}

function tokens(texto: string): string[] {
  return texto.split(' ').filter((t) => t.length >= 2)
}

function scoreSimilaridade(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - distanciaLevenshtein(a, b) / maxLen
}

function tokensBatem(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false
  return a.every((ta) => b.some((tb) => ta === tb || ta.startsWith(tb) || tb.startsWith(ta)))
}

/**
 * Desempate determinístico entre matches de um mesmo passo do fuzzy (a lista
 * chega em ordenações diferentes conforme a tela, e o `find` devolvia o
 * primeiro do array — 27 ativos resolviam diferente por tela). Preferência:
 * (a) status Ativo, depois (b) tem nome_curto, depois (c) nome mais longo
 * (mais específico). O id fecha o desempate para independência total da ordem.
 */
export function compararPreferenciaDepartamento(a: DepartamentoFuzzy, b: DepartamentoFuzzy): number {
  const ativoA = a.status === 'Ativo' ? 1 : 0
  const ativoB = b.status === 'Ativo' ? 1 : 0
  if (ativoA !== ativoB) return ativoB - ativoA
  const curtoA = a.nome_curto?.trim() ? 1 : 0
  const curtoB = b.nome_curto?.trim() ? 1 : 0
  if (curtoA !== curtoB) return curtoB - curtoA
  if (a.nome.length !== b.nome.length) return b.nome.length - a.nome.length
  return a.id.localeCompare(b.id)
}

/**
 * Redirecionamentos explícitos de linha INATIVA → linha ATIVA (decisão da
 * gestão, 15/10/2026). Usado pela importação e-Contador: a Alterdata manda o
 * texto do contrato antigo (ex.: "...RESIDENCIAL DALIAS"), que casa exato com
 * a linha inativa — sem esta tabela, o match dependeria de semelhança de
 * grafia. Fusão Dalias → ITAGUAÍ de 09/10/2026 (as DUAS linhas inativas
 * DALIAS apontam para a linha Rosas/ITAGUAÍ).
 */
export const REDIRECIONAMENTOS_DEPARTAMENTO_INATIVO: Record<string, string> = {
  '52e9ab9f-2d2a-47d7-8eee-2214c671343d': '8eb83a32-e1f7-454f-9e53-3134bf887a26', // DALIAS → ITAGUAÍ
  '97806df1-396b-4a05-97f5-9ddb8c49582f': '8eb83a32-e1f7-454f-9e53-3134bf887a26', // DALIAS → ITAGUAÍ
}

/**
 * Resolve o destino efetivo de um departamento encontrado pelo fuzzy na
 * importação: linha Ativa volta como está; linha Inativa segue o redirect
 * explícito (REDIRECIONAMENTOS_DEPARTAMENTO_INATIVO) ou, sem ele, a irmã
 * ATIVA com o mesmo nome_curto normalizado. Inativa sem destino devolve null
 * (contrato encerrado de verdade — o nome vai para naoResolvidos).
 */
export function redirecionarDepartamentoInativo(
  departamentos: DepartamentoFuzzy[],
  dep: DepartamentoFuzzy
): DepartamentoFuzzy | null {
  if (dep.status !== 'Inativo') return dep
  const explicito = REDIRECIONAMENTOS_DEPARTAMENTO_INATIVO[dep.id]
  if (explicito) {
    const alvo = departamentos.find((d) => d.id === explicito)
    if (alvo) return alvo
  }
  const curto = dep.nome_curto ? normalizarTexto(dep.nome_curto) : ''
  if (curto) {
    const irma = departamentos
      .filter((d) => d.status === 'Ativo' && d.nome_curto && normalizarTexto(d.nome_curto) === curto)
      .sort(compararPreferenciaDepartamento)[0]
    if (irma) return irma
  }
  return null
}

/**
 * Encontra um departamento pelo NOME: nome exato > nome_curto exato > tokens >
 * substring > similaridade (threshold 0.8). Filtra pela empresa quando
 * informada. Empates dentro de cada passo são resolvidos por
 * compararPreferenciaDepartamento. (Versão sem match por ID — usada na
 * importação e-Contador, que só recebe o nome textual da Alterdata.)
 */
export function encontrarDepartamentoFuzzyPorNome(
  departamentos: DepartamentoFuzzy[],
  nomeTextual?: string | null,
  empresaId?: string | null
): DepartamentoFuzzy | null {
  const nome = (nomeTextual || '').trim()
  if (!nome) return null

  const nomeNorm = normalizarTexto(nome)

  // Filtra pela empresa quando informada, para evitar match errado entre empresas
  const candidatos = empresaId
    ? departamentos.filter((d) => !d.empresa_id || d.empresa_id === empresaId)
    : departamentos

  // 2. Match exato por nome
  const porNomeExato = candidatos
    .filter((d) => normalizarTexto(d.nome) === nomeNorm)
    .sort(compararPreferenciaDepartamento)[0]
  if (porNomeExato) return porNomeExato

  // 3. Match exato por nome_curto
  const porNomeCurtoExato = candidatos
    .filter((d) => d.nome_curto && normalizarTexto(d.nome_curto) === nomeNorm)
    .sort(compararPreferenciaDepartamento)[0]
  if (porNomeCurtoExato) return porNomeCurtoExato

  // 4. Match por tokens (ordem não importa)
  const tokensNome = tokens(nomeNorm)
  const porTokens = candidatos
    .filter((d) => {
      const tokensDepNome = tokens(normalizarTexto(d.nome))
      const tokensDepCurto = d.nome_curto ? tokens(normalizarTexto(d.nome_curto)) : []
      return tokensBatem(tokensNome, tokensDepNome) || tokensBatem(tokensNome, tokensDepCurto)
    })
    .sort(compararPreferenciaDepartamento)[0]
  if (porTokens) return porTokens

  // 5. Match por substring
  const porSubstring = candidatos
    .filter((d) => {
      const nomeDep = normalizarTexto(d.nome)
      const nomeCurtoDep = d.nome_curto ? normalizarTexto(d.nome_curto) : ''
      return (
        (nomeDep && (nomeDep.includes(nomeNorm) || nomeNorm.includes(nomeDep))) ||
        (nomeCurtoDep && (nomeCurtoDep.includes(nomeNorm) || nomeNorm.includes(nomeCurtoDep)))
      )
    })
    .sort(compararPreferenciaDepartamento)[0]
  if (porSubstring) return porSubstring

  // 6. Match por similaridade (Levenshtein) — o maior score manda; o
  // comparador só desempata scores iguais.
  let melhorScore = 0
  let melhor: DepartamentoFuzzy | null = null
  for (const d of candidatos) {
    const scoreNome = scoreSimilaridade(nomeNorm, normalizarTexto(d.nome))
    const scoreCurto = d.nome_curto ? scoreSimilaridade(nomeNorm, normalizarTexto(d.nome_curto)) : 0
    const score = Math.max(scoreNome, scoreCurto)
    if (
      score > melhorScore ||
      (score === melhorScore && melhor !== null && compararPreferenciaDepartamento(d, melhor) < 0)
    ) {
      melhorScore = score
      melhor = d
    }
  }
  if (melhorScore >= 0.8) return melhor

  return null
}

// <<< SYNC-ECONTADOR: FIM

/**
 * Encontra um departamento por ID, nome exato, tokens, substring ou similaridade.
 * Prioriza match por ID > nome exato > nome_curto exato > tokens > substring > similaridade (threshold 0.8).
 * Empates dentro de cada passo são resolvidos por compararPreferenciaDepartamento.
 */
export function encontrarDepartamentoFuzzy(
  departamentos: DepartamentoFuzzy[],
  departamentoId?: string | null,
  nomeTextual?: string | null,
  empresaId?: string | null
): DepartamentoFuzzy | null {
  // 1. Match exato por ID (prioridade máxima, não filtra por empresa)
  if (departamentoId) {
    const porId = departamentos.find((d) => d.id === departamentoId)
    if (porId) return porId
  }

  return encontrarDepartamentoFuzzyPorNome(departamentos, nomeTextual, empresaId)
}

/**
 * Grupo de "linhas irmãs" de um departamento: o id alvo + todas as linhas
 * com o mesmo nome ou nome_curto normalizado, de QUALQUER status — o cadastro
 * tem duplicadas do mesmo posto (grafias/status/nome_curto diferentes) e o
 * colaborador pode apontar para qualquer uma. Mesma regra de expansão de
 * `idsColaboradoresDoDepartamento`. Conjunto vazio quando o id não existe.
 */
export function idsGrupoDepartamento(
  departamentos: DepartamentoFuzzy[],
  departamentoId: string
): Set<string> {
  const alvo = departamentos.find((d) => d.id === departamentoId)
  if (!alvo) return new Set()
  const chaves = new Set<string>([normalizarTexto(alvo.nome)])
  if (alvo.nome_curto) chaves.add(normalizarTexto(alvo.nome_curto))
  return new Set(
    departamentos
      .filter(
        (d) =>
          chaves.has(normalizarTexto(d.nome)) ||
          (d.nome_curto ? chaves.has(normalizarTexto(d.nome_curto)) : false)
      )
      .map((d) => d.id)
  )
}

/**
 * Lista para seletores de departamento (autocompletes de filtro/cadastro):
 * apenas linhas Ativas com nome_curto, deduplicadas pelo nome_curto
 * normalizado (o cadastro tem irmãs do mesmo posto — ex.: BLUE TERMINAL 2×)
 * e ordenadas por nome_curto (pt-BR). Entre duplicadas, vale a primeira na
 * ordenação estável — qualquer id do par funciona porque os filtros expandem
 * o grupo de irmãs (idsGrupoDepartamento).
 */
export function departamentosSelecionaveis<T extends DepartamentoFuzzy>(departamentos: T[]): T[] {
  const vistos = new Set<string>()
  return departamentos
    .filter((d) => d.status === 'Ativo' && !!d.nome_curto?.trim())
    .filter((d) => {
      const chave = normalizarTexto(d.nome_curto || '')
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
    .sort((a, b) => (a.nome_curto || '').localeCompare(b.nome_curto || '', 'pt-BR'))
}

/**
 * Retorna o nome curto do departamento encontrado, ou fallback para nome textual.
 * Se a linha resolvida não tem nome_curto (duplicada legada), procura uma linha
 * "irmã" com o mesmo nome normalizado que tenha nome_curto (prefere Ativa) —
 * ex.: colaborador aponta para "ALIANCA S A INDUSTRIA..." sem nome_curto, mas
 * exibimos "CBO" da linha irmã.
 */
export function nomeCurtoDepartamentoFuzzy(
  departamentos: DepartamentoFuzzy[],
  departamentoId?: string | null,
  nomeTextual?: string | null,
  empresaId?: string | null
): string {
  const dep = encontrarDepartamentoFuzzy(departamentos, departamentoId, nomeTextual, empresaId)
  if (dep?.nome_curto?.trim()) return dep.nome_curto.trim()
  if (dep) {
    const chaveNome = normalizarTexto(dep.nome)
    const irmaos = departamentos.filter(
      (d) => d.id !== dep.id && d.nome_curto?.trim() && normalizarTexto(d.nome) === chaveNome
    )
    const irma = irmaos.find((d) => d.status === 'Ativo') || irmaos[0]
    if (irma) return irma.nome_curto!.trim()
    return dep.nome.trim()
  }
  return nomeTextual?.trim() || '—'
}

export interface ColaboradorDepartamento {
  id: string
  departamento_id?: string | null
  departamento?: string | null
  empresa_id?: string | null
}

/**
 * IDs dos colaboradores de um departamento buscado por nome_curto/nome
 * (filtros de relatórios e listagens). O texto legado de
 * `colaboradores.departamento` não bate com o cadastro por acento/pontuação
 * ("ALIANCA S A INDUSTRIA..." vs "Aliança S.A. Indústria..."), então ILIKE
 * no banco não encontrava — aqui cada colaborador tem o departamento
 * resolvido por encontrarDepartamentoFuzzy (id > nome exato > nome_curto >
 * tokens > substring > similaridade).
 */
export function idsColaboradoresDoDepartamento(
  departamentos: DepartamentoFuzzy[],
  colaboradores: ColaboradorDepartamento[],
  termo: string
): Set<string> {
  const ids = new Set<string>()
  const t = normalizarTexto(termo.trim())
  if (!t) return ids

  const alvos = departamentos.filter(
    (d) => normalizarTexto(d.nome) === t || (d.nome_curto ? normalizarTexto(d.nome_curto) === t : false)
  )
  if (alvos.length === 0) {
    const fuzzy = encontrarDepartamentoFuzzy(departamentos, null, termo)
    if (fuzzy) alvos.push(fuzzy)
  }

  // O cadastro pode ter LINHAS DUPLICADAS para o mesmo departamento (ex.:
  // "Aliança S/A - Indústria..." com nome_curto CBO e "ALIANCA S A INDUSTRIA..."
  // sem nome_curto) — o colaborador pode apontar para qualquer uma delas.
  // Expande o alvo para todas as linhas com o mesmo nome ou nome_curto
  // normalizado.
  const chaves = new Set<string>()
  alvos.forEach((d) => {
    chaves.add(normalizarTexto(d.nome))
    if (d.nome_curto) chaves.add(normalizarTexto(d.nome_curto))
  })
  const alvosExpandidos = departamentos.filter(
    (d) => chaves.has(normalizarTexto(d.nome)) || (d.nome_curto ? chaves.has(normalizarTexto(d.nome_curto)) : false)
  )

  if (alvosExpandidos.length === 0) {
    // Sem departamento correspondente: fallback pelo texto livre do cadastro.
    for (const c of colaboradores) {
      if (c.departamento && normalizarTexto(c.departamento).includes(t)) ids.add(c.id)
    }
    return ids
  }

  const alvoIds = new Set(alvosExpandidos.map((d) => d.id))
  for (const c of colaboradores) {
    const dep = encontrarDepartamentoFuzzy(departamentos, c.departamento_id, c.departamento, c.empresa_id)
    if (dep && alvoIds.has(dep.id)) ids.add(c.id)
  }
  return ids
}
// <<< FIM: src/lib/departamentos.ts

// ============================================================
// Infra
// ============================================================

const LIMITE_CHAMADAS_MINUTO = 30
const LIMITE_BUSCAS_MINUTO = 60
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

/** IPv4 com cada octeto ≤ 255 (a coluna do log é inet — octeto inválido derruba o insert). */
function ipv4Valido(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  return !!m && m.slice(1).every((octeto) => Number(octeto) <= 255)
}

function ipDaRequisicao(req: Request): string | null {
  // O gateway do Supabase ACRESCENTA o IP real no FIM do x-forwarded-for —
  // o primeiro valor é o mais fácil de forjar. cf-connecting-ip tem prioridade.
  const encadeados = (req.headers.get('x-forwarded-for') || '')
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean)
  const ip = (req.headers.get('cf-connecting-ip') || encadeados[encadeados.length - 1] || '').trim()
  // Só aceita o que o Postgres converte para inet sem erro.
  if (ipv4Valido(ip) || /^[0-9a-fA-F:]{2,45}$/.test(ip)) return ip
  return null
}

async function sha256Hex(valor: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor))
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

/**
 * Chave HMAC dos identificadores da equipe, derivada da ENCRYPTION_KEY
 * (SHA-256 de "pedido-materiais:equipe:" + chave). null sem a secret: o link
 * funciona, mas sem a lista da equipe (só "outra pessoa").
 */
async function chaveHmacEquipe(): Promise<CryptoKey | null> {
  const hex = Deno.env.get('ENCRYPTION_KEY')
  if (!hex || hex.length !== 64) return null
  const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`pedido-materiais:equipe:${hex}`))
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

/** Identificador opaco do colaborador NESTE contrato: 12 caracteres base64url do HMAC (72 bits). */
async function refColaborador(chave: CryptoKey, contratoId: string, colaboradorId: string): Promise<string> {
  const assinatura = new Uint8Array(
    await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(`${contratoId}:${colaboradorId}`))
  )
  return base64Url(assinatura).slice(0, 12)
}

async function registrarLog(sb: SupabaseClient, contratoId: string | null, evento: string, ip: string | null, ua: string | null) {
  // Falha de log NUNCA derruba a ação (ex.: inet inválido no passado zerava
  // TODAS as ações com 500). Erros do supabase-js vêm no retorno, não em exceção.
  try {
    const { error } = await sb.from('mat_acesso_log').insert({ contrato_id: contratoId, evento, ip, user_agent: ua ? ua.slice(0, 300) : null })
    if (error) console.error('registrarLog falhou (ignorado):', error.message)
  } catch (e) {
    console.error('registrarLog falhou (ignorado):', e)
  }
}

/**
 * > 30 chamadas/min por IP (sem contar buscas); envios: > 5/h por IP;
 * buscas ("Preciso de outro item"): > 60/min por IP.
 */
async function conferirLimite(sb: SupabaseClient, ip: string | null, tipo: 'leitura' | 'envio' | 'busca', ua: string | null) {
  if (!ip) return
  const umMinuto = new Date(Date.now() - 60_000).toISOString()
  let estourou: boolean
  if (tipo === 'busca') {
    const { count } = await sb
      .from('mat_acesso_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .eq('evento', 'buscar')
      .gte('created_at', umMinuto)
    estourou = (count ?? 0) >= LIMITE_BUSCAS_MINUTO
  } else {
    const { count } = await sb
      .from('mat_acesso_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .neq('evento', 'buscar')
      .gte('created_at', umMinuto)
    estourou = (count ?? 0) >= LIMITE_CHAMADAS_MINUTO
  }
  if (!estourou && tipo === 'envio') {
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
  departamento_id: string
  /** Departamentos cuja equipe também entra no link (migration 129; caso Telex × DuoConnect). */
  departamentos_equipe_extra: string[]
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
  // '*' de propósito: funciona antes e depois da migration 129
  // (departamentos_equipe_extra); mat_contratos não tem segredo.
  const { data: contrato } = await sb.from('mat_contratos').select('*').eq('id', acesso.contrato_id).maybeSingle()
  if (!contrato || !contrato.ativo) return null
  return {
    id: contrato.id,
    nome: contrato.nome,
    recebe_limpeza: contrato.recebe_limpeza,
    departamento_id: contrato.departamento_id,
    departamentos_equipe_extra: Array.isArray(contrato.departamentos_equipe_extra) ? contrato.departamentos_equipe_extra : [],
  }
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

/**
 * Catálogo ATIVO completo (só no servidor — nunca vai inteiro para o link),
 * com variação oculta e contratos exclusivos (migration 136). Passe sempre
 * por `visaoDoLider` antes de devolver qualquer coisa ao link.
 */
async function catalogoAtivo(sb: SupabaseClient): Promise<ItemCatalogoServidor[]> {
  const [rItens, rVar] = await Promise.all([
    sb
      .from('mat_itens')
      .select('id, nome, nome_lider, contratos_exclusivos, contratos_ocultos, categoria, unidade_pedido, validade_meses, ordem')
      .eq('ativo', true)
      .order('ordem', { nullsFirst: false })
      .order('nome'),
    sb.from('mat_item_variacoes').select('id, item_id, rotulo, oculta_lider, ordem').eq('ativo', true).order('ordem', { nullsFirst: false }).order('rotulo'),
  ])
  const erro = rItens.error ?? rVar.error
  if (erro) throw new Error(erro.message)
  const variacoes = new Map<string, { id: string; rotulo: string; oculta_lider: boolean }[]>()
  for (const v of rVar.data ?? []) {
    const lista = variacoes.get(v.item_id) ?? []
    lista.push({ id: v.id, rotulo: v.rotulo, oculta_lider: v.oculta_lider === true })
    variacoes.set(v.item_id, lista)
  }
  return (rItens.data ?? []).map((i) => ({
    id: i.id,
    nome: i.nome,
    nome_lider: i.nome_lider ?? null,
    contratos_exclusivos: i.contratos_exclusivos ?? null,
    contratos_ocultos: i.contratos_ocultos ?? null,
    categoria: i.categoria,
    unidade: i.unidade_pedido,
    validade_meses: i.validade_meses,
    variacoes: variacoes.get(i.id) ?? [],
  }))
}

/**
 * Peças de uniforme/EPI do contrato (mat_contrato_ceu_itens, migration 129)
 * agrupadas por nome base. Sem a tabela (migration ainda não aplicada) ou sem
 * configuração: todas as peças ativas do CEU (fallback).
 */
async function pecasDoContratoBanco(sb: SupabaseClient, contratoId: string) {
  const [rItens, rCfg] = await Promise.all([
    sb.from('itens').select('id, nome, tipo, situacao, compra_na_loja').in('tipo', ['Uniforme', 'EPI']).order('nome'),
    sb.from('mat_contrato_ceu_itens').select('item_id, rotulo, funcoes, ordem, ativo').eq('contrato_id', contratoId),
  ])
  if (rItens.error) throw new Error(rItens.error.message)
  // 42P01 = tabela inexistente (129 não aplicada): segue com o fallback.
  if (rCfg.error && rCfg.error.code !== '42P01') throw new Error(rCfg.error.message)
  const itens: ItemCeuCadastro[] = (rItens.data ?? []).map((i) => ({
    id: i.id,
    nome: i.nome,
    tipo: i.tipo === 'EPI' ? 'epi' : 'uniforme',
    ativo: !i.situacao || String(i.situacao).toUpperCase() === 'A',
    compra_na_loja: i.compra_na_loja === true,
  }))
  const resultado = pecasDoContrato((rCfg.data ?? []) as ConfigPecaContrato[], itens)
  const nomePorId = new Map(itens.map((i) => [i.id, i.nome]))
  const itensCeu: ItemCeuPublico[] = []
  const vistos = new Set<string>()
  for (const p of resultado.pecas) {
    for (const o of p.opcoes) {
      if (vistos.has(o.item_id)) continue
      vistos.add(o.item_id)
      itensCeu.push({ id: o.item_id, nome: nomePorId.get(o.item_id) ?? p.rotulo, tipo: p.tipo })
    }
  }
  return { ...resultado, itensCeu, itensCadastro: itens }
}

/**
 * Snapshots da linha já identificada (pessoa da lista da equipe), gravados
 * no envio — sem esperar a identificação manual: última entrega da PEÇA
 * (qualquer tamanho) e o item dela, medida do cadastro (ceu_tamanhos) e o
 * alerta de divergência. Nada disso volta para o link (só vai para a RPC).
 */
async function snapshotsIdentificados(
  sb: SupabaseClient,
  linhas: { tipo: string; colaborador_id: string | null; item_id: string | null; tamanho: string | null }[],
  itensCadastro: ItemCeuCadastro[]
) {
  const ids = [...new Set(linhas.filter((l) => l.colaborador_id && l.item_id).map((l) => l.colaborador_id!))]
  const vazio = new Map<number, { ultima_entrega_em: string | null; ultima_entrega_item_id: string | null; tamanho_cadastro: string | null; alerta_tamanho: boolean }>()
  if (ids.length === 0) return vazio
  const [rEnt, rTam] = await Promise.all([
    sb.from('entregas').select('colaborador_id, item_id, data_entrega').in('colaborador_id', ids).limit(5000),
    sb.from('ceu_tamanhos').select('colaborador_id, tamanho_camisa, tamanho_calca, tamanho_calcado, tamanho_luva').in('colaborador_id', ids),
  ])
  // Snapshot é apoio à conferência: erro de leitura não derruba o envio.
  const entregasPor = new Map<string, { item_id: string; data_entrega: string }[]>()
  for (const e of rEnt.data ?? []) {
    const lista = entregasPor.get(e.colaborador_id) ?? []
    lista.push({ item_id: e.item_id, data_entrega: e.data_entrega })
    entregasPor.set(e.colaborador_id, lista)
  }
  const tamanhosPor = new Map((rTam.data ?? []).map((t) => [t.colaborador_id as string, t as TamanhosCadastro]))
  const nomePorId = new Map(itensCadastro.map((i) => [i.id, i.nome]))
  linhas.forEach((l, i) => {
    if (!l.colaborador_id || !l.item_id || l.tipo === 'cracha') return
    const ultima = ultimaEntregaDaPeca(entregasPor.get(l.colaborador_id) ?? [], itensDaMesmaPeca(itensCadastro, l.item_id))
    const nome = nomePorId.get(l.item_id) ?? ''
    // Compra na loja: sem tamanho no pedido e sem alerta de tamanho (migration 141).
    if (itensCadastro.find((x) => x.id === l.item_id)?.compra_na_loja) {
      vazio.set(i, {
        ultima_entrega_em: ultima?.data ?? null,
        ultima_entrega_item_id: ultima?.item_id ?? null,
        tamanho_cadastro: null,
        alerta_tamanho: false,
      })
      return
    }
    const tamanhoCadastro = tamanhoCadastroParaItem(nome, tamanhosPor.get(l.colaborador_id))
    const tamanhoPedido = l.tamanho || separarTamanhoDoNome(nome).tamanho
    vazio.set(i, {
      ultima_entrega_em: ultima?.data ?? null,
      ultima_entrega_item_id: ultima?.item_id ?? null,
      tamanho_cadastro: tamanhoCadastro,
      alerta_tamanho: tamanhosDivergemPeca(tamanhoPedido, tamanhoCadastro),
    })
  })
  return vazio
}

interface EquipeServidor {
  publica: MembroEquipePublico[]
  /** ref → colaborador_id (só no servidor). */
  idPorRef: Map<string, string>
}

/**
 * Equipe do contrato = colaboradores ATIVOS do departamento principal + dos
 * departamentos de departamentos_equipe_extra (cada um pela regra de
 * idsColaboradoresDoDepartamento — fuzzy + linhas irmãs; nunca ILIKE).
 * Telex: os 4 contratos de pedido recebem a mesma equipe (CENTRO AUDITIVO
 * TELEX + DUOCONNECT) — decisões da gestão de 14/10/2026.
 */
async function equipeDoContrato(sb: SupabaseClient, contrato: ContratoDoToken): Promise<EquipeServidor> {
  const vazia: EquipeServidor = { publica: [], idPorRef: new Map() }
  const chave = await chaveHmacEquipe()
  if (!chave) return vazia
  const [rDeps, rColabs] = await Promise.all([
    sb.from('departamentos').select('id, nome, nome_curto, empresa_id, status'),
    sb.from('colaboradores').select('id, nome_completo, cargo, departamento_id, departamento, empresa_id').eq('status', 'Ativo'),
  ])
  const erro = rDeps.error ?? rColabs.error
  if (erro) throw new Error(erro.message)
  const deps = (rDeps.data ?? []) as DepartamentoFuzzy[]
  const colabs = rColabs.data ?? []
  const ids = idsEquipeDoContrato(deps, colabs, [contrato.departamento_id, ...contrato.departamentos_equipe_extra])
  if (ids.size === 0) return vazia
  const membros: { ref: string; nome_completo: string; cargo: string | null }[] = []
  const idPorRef = new Map<string, string>()
  for (const c of colabs) {
    if (!ids.has(c.id) || !c.nome_completo) continue
    const ref = await refColaborador(chave, contrato.id, c.id)
    if (idPorRef.has(ref)) continue // colisão (72 bits — praticamente impossível): fica de fora da lista
    idPorRef.set(ref, c.id)
    membros.push({ ref, nome_completo: c.nome_completo, cargo: c.cargo })
  }
  return { publica: montarEquipePublica(membros), idPorRef }
}

/** Kit + últimas entregas do contrato (base das exceções e da periodicidade). */
async function kitDoContrato(sb: SupabaseClient, contratoId: string) {
  const [rKit, rHist, rPed] = await Promise.all([
    sb.from('mat_kit_itens').select('item_id, variacao_id, quantidade, periodicidade_meses').eq('contrato_id', contratoId),
    sb.from('mat_historico_consumo').select('item_id, competencia, quantidade').eq('contrato_id', contratoId).gt('quantidade', 0),
    sb.from('mat_pedidos').select('id, competencia').eq('contrato_id', contratoId).in('status_produtos', STATUS_PRODUTOS_ENTREGUE),
  ])
  const erro = rKit.error ?? rHist.error ?? rPed.error
  if (erro) throw new Error(erro.message)

  // Última entrega do item AO CONTRATO. Fase 1 ainda não registra entrega de
  // produtos: vale a competência do último pedido aprovado e, antes dele, o
  // histórico das planilhas.
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
  const kit: KitPublico[] = (rKit.data ?? []).map((k) => ({
    item_id: k.item_id,
    variacao_id: k.variacao_id,
    quantidade: Number(k.quantidade),
    periodicidade_meses: Number(k.periodicidade_meses ?? 1),
  }))
  return { kit, ultimas }
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
    // Visão do líder (migration 136): nome_lider e marca oculta.
    const { data } = await sb.from('mat_itens').select('id, nome, nome_lider, unidade_pedido').in('id', idsItens)
    for (const i of data ?? []) nomes.itens[i.id] = { nome: (i.nome_lider ?? '').trim() || i.nome, unidade: i.unidade_pedido }
  }
  if (idsVar.length > 0) {
    const { data } = await sb.from('mat_item_variacoes').select('id, rotulo, oculta_lider').in('id', idsVar)
    for (const v of data ?? []) if (v.oculta_lider !== true) nomes.variacoes[v.id] = v.rotulo
  }

  const destino: { produtos: DestinoFilaPublico; ceu: DestinoFilaPublico } = mensal
    ? {
        produtos: PRODUTOS_ACEITAM_MESCLA.includes(mensal.status_produtos) ? 'mesclar' : 'extra',
        ceu: CEU_ACEITA_MESCLA.includes(mensal.status_ceu) ? 'mesclar' : 'extra',
      }
    : { produtos: 'novo', ceu: 'novo' }

  return { resumo: montarResumoMes(envios, produtos, ceu, nomes), destino }
}

/**
 * O kit do mês já foi confirmado (há linha 'kit' em pedido não cancelado do
 * contrato na competência — migration 135): um novo envio só traz extras.
 */
async function kitConfirmadoNoMes(sb: SupabaseClient, contratoId: string, competencia: string): Promise<boolean> {
  const { data: pedidos, error } = await sb
    .from('mat_pedidos')
    .select('id')
    .eq('contrato_id', contratoId)
    .eq('competencia', competencia)
    .neq('status_produtos', 'cancelado')
  if (error) throw new Error(error.message)
  const ids = (pedidos ?? []).map((p) => p.id)
  if (ids.length === 0) return false
  const { data, error: e2 } = await sb.from('mat_pedido_itens').select('id').in('pedido_id', ids).eq('parte', 'kit').limit(1)
  if (e2) throw new Error(e2.message)
  return (data ?? []).length > 0
}

/** Itens do catálogo que o contrato pode pedir (sem limpeza: só portaria). */
function catalogoPermitido<T extends ItemPublico>(catalogo: T[], recebeLimpeza: boolean): T[] {
  return recebeLimpeza ? catalogo : catalogo.filter((c) => c.categoria === 'portaria')
}

// ============================================================
// Ações públicas
// ============================================================

async function acaoCarregar(sb: SupabaseClient, corpo: Corpo, ip: string | null, ua: string | null) {
  await conferirLimite(sb, ip, 'leitura', ua)
  const contrato = await contratoPorToken(sb, corpo.token)
  if (!contrato) {
    await registrarLog(sb, null, 'carregar', ip, ua)
    throw new ErroHttp(404, 'token_invalido', 'Link inválido ou substituído por um novo. Peça o link atualizado ao inspetor.')
  }
  await registrarLog(sb, contrato.id, 'carregar', ip, ua)
  const hoje = hojeBrasilia()
  const [janela, catalogo, kitInfo, pecasInfo, equipe, { data: aliases }] = await Promise.all([
    janelaDoContrato(sb, contrato.id, hoje),
    catalogoAtivo(sb),
    kitDoContrato(sb, contrato.id),
    pecasDoContratoBanco(sb, contrato.id),
    equipeDoContrato(sb, contrato),
    sb.from('mat_aliases').select('nome_legado, item_id, variacao_id'),
  ])
  const [{ resumo, destino }, kitConfirmado] = await Promise.all([
    resumoDoMes(sb, contrato.id, janela.competencia),
    kitConfirmadoNoMes(sb, contrato.id, janela.competencia),
  ])

  // `catalogo` = SÓ os itens do Kit Mensal (o resto vai em `catalogo_busca`, só nomes),
  // já na visão do líder (marca oculta, exclusivos de outro contrato fora — migration 136).
  const visao = visaoDoLider(catalogo, kitInfo.kit, contrato.id)
  const noKit = new Set(visao.kit.map((k) => k.item_id))
  const itensDoKit = catalogoPermitido(visao.catalogo, contrato.recebe_limpeza).filter((c) => noKit.has(c.id))
  const idsDoKit = new Set(itensDoKit.map((c) => c.id))
  const ultimas: Record<string, string> = {}
  for (const [id, comp] of Object.entries(kitInfo.ultimas)) if (idsDoKit.has(id)) ultimas[id] = comp

  return {
    contrato: { nome: contrato.nome, recebe_limpeza: contrato.recebe_limpeza },
    hoje,
    janela,
    catalogo: itensDoKit,
    // Busca local no celular (decisão da gestora, 16/10/2026): só nomes — sem
    // preço, fornecedor, contratos exclusivos nem a marcação de variação oculta.
    catalogo_busca: catalogoBuscavelDoLider(catalogo, kitInfo.kit, aliases ?? [], contrato.id, contrato.recebe_limpeza),
    kit: visao.kit.filter((k) => idsDoKit.has(k.item_id)),
    pecas: pecasInfo.pecas,
    sem_kit_uniforme: pecasInfo.semKitUniforme,
    equipe: equipe.publica,
    ultimas_entregas: ultimas,
    resumo,
    destino,
    kit_confirmado: kitConfirmado,
  }
}

/**
 * "O que mais você precisa?": até 8 resultados ATIVOS (item ou variação) que
 * casam com o termo (≥ 3 letras). Devolve só nome, categoria, unidade,
 * validade e variações — nunca a lista completa. Busca fuzzy local (sem chamada externa); ponto de
 * extensão para um fallback futuro documentado em buscaItens.ts.
 */
async function acaoBuscarItem(sb: SupabaseClient, corpo: Corpo, ip: string | null, ua: string | null) {
  await conferirLimite(sb, ip, 'busca', ua)
  const contrato = await contratoPorToken(sb, corpo.token)
  if (!contrato) {
    // Registra ANTES de lançar: a sondagem de token conta no rate limit de busca.
    await registrarLog(sb, null, 'buscar', ip, ua)
    throw new ErroHttp(404, 'token_invalido', 'Link inválido ou substituído por um novo. Peça o link atualizado ao inspetor.')
  }
  const termo = typeof corpo.termo === 'string' ? corpo.termo.slice(0, 80) : ''
  if (normalizarBusca(termo).replace(/ /g, '').length < BUSCA_MIN_CARACTERES) return { itens: [] }
  await registrarLog(sb, contrato.id, 'buscar', ip, ua)

  const secao = corpo.secao === 'portaria' || corpo.secao === 'materiais' ? corpo.secao : null
  const [catalogo, { data: kit }] = await Promise.all([
    catalogoAtivo(sb),
    sb.from('mat_kit_itens').select('item_id, variacao_id').eq('contrato_id', contrato.id),
  ])
  // Visão do líder (migration 136): exclusivos de outro contrato e variações
  // ocultas (marca) saem ANTES da busca — o líder nunca recebe esses ids.
  const { data: aliases } = await sb.from('mat_aliases').select('nome_legado, item_id, variacao_id')
  const achados = buscarItens(
    termo,
    catalogoBuscavelDoLider(
      catalogo,
      (kit ?? []).map((k) => ({ item_id: k.item_id, variacao_id: k.variacao_id, quantidade: 1, periodicidade_meses: 1 })),
      aliases ?? [],
      contrato.id,
      contrato.recebe_limpeza
    ).filter((c) => (secao === 'portaria' ? c.categoria === 'portaria' : secao === 'materiais' ? c.categoria !== 'portaria' : true)),
    BUSCA_MAX_RESULTADOS
  )
  // Um resultado por VARIAÇÃO (16/10/2026): o quadro do líder nasce com o
  // item e a variação definidos. `variacoes` segue com as do item (o
  // navegador valida a variação escolhida contra elas).
  return {
    itens: achados.map(({ item, variacao, nome }) => ({
      id: item.id,
      nome: item.nome,
      nome_lider: item.nome_lider ?? null,
      nome_exibicao: nome,
      variacao_id: variacao?.id ?? null,
      categoria: item.categoria,
      unidade: item.unidade,
      validade_meses: item.validade_meses,
      variacoes: item.variacoes,
    })),
  }
}

async function acaoEnviar(sb: SupabaseClient, corpo: Corpo, ip: string | null, ua: string | null) {
  await conferirLimite(sb, ip, 'envio', ua)
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
  const [catalogo, kitInfo, pecasInfo, equipe, rPrecos, kitConfirmado] = await Promise.all([
    catalogoAtivo(sb),
    kitDoContrato(sb, contrato.id),
    pecasDoContratoBanco(sb, contrato.id),
    equipeDoContrato(sb, contrato),
    sb.from('mat_precos').select('item_id, variacao_id, preco, vigente_desde').lte('vigente_desde', hoje),
    kitConfirmadoNoMes(sb, contrato.id, janela.competencia),
  ])
  // Visão do líder (migration 136): o servidor valida contra o MESMO catálogo
  // e kit que o link mostra; item exclusivo de outro contrato é recusado.
  const visao = visaoDoLider(catalogo, kitInfo.kit, contrato.id)
  const ctx: ContextoPedido = {
    hoje,
    recebeLimpeza: contrato.recebe_limpeza,
    catalogo: visao.catalogo,
    kit: visao.kit,
    indisponiveis: visao.indisponiveis,
    itensCeu: pecasInfo.itensCeu,
    pecas: pecasInfo.pecas,
    equipe: equipe.publica,
    ultimasEntregas: kitInfo.ultimas,
    precos: (rPrecos.data ?? []).map((p) => ({ ...p, preco: Number(p.preco) })),
    kitConfirmado,
  }
  const v = validarEnvioPedido(corpo.pedido, ctx)
  if (!v.ok) {
    await registrarLog(sb, contrato.id, 'envio_recusado', ip, ua)
    throw new ErroHttp(422, 'validacao', 'Confira os campos do pedido.', v.erros.slice(0, 20))
  }
  // Identificador opaco → colaborador_id (já identificado; a RPC grava a
  // linha como 'pendente' de conferência).
  const ceuIdentificado = v.ceu.map(({ colaborador_ref, ...l }) => ({
    ...l,
    colaborador_id: colaborador_ref ? equipe.idPorRef.get(colaborador_ref) ?? null : null,
  }))
  const snapshots = await snapshotsIdentificados(sb, ceuIdentificado, pecasInfo.itensCadastro)
  const ceu = ceuIdentificado.map((l, i) => ({ ...l, ...(snapshots.get(i) ?? {}) }))
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
    p_ceu: ceu,
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
    const bruto = await req.text()
    if (bruto.length > 200_000) throw new ErroHttp(413, 'requisicao', 'Pedido grande demais')
    let corpo: Corpo
    try {
      corpo = JSON.parse(bruto || '{}') as Corpo
    } catch {
      throw new ErroHttp(400, 'requisicao', 'Requisição inválida')
    }

    let resultado: unknown
    switch (corpo.acao) {
      case 'carregar':
        resultado = await acaoCarregar(sb, corpo, ip, ua)
        break
      case 'buscar_item':
        resultado = await acaoBuscarItem(sb, corpo, ip, ua)
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
