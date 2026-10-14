// Matching de linhas de um arquivo de entregas (CSV/Excel) contra o cadastro
// de colaboradores e o catálogo de itens do CEU. Nasceu do lançamento em lote
// de EPIs de 09/2026 (scripts/_aposentados/lancar-epis-setembro.mjs) — mesmas regras de
// conversão, agora com prévia interativa na tela CEU → Importar.

import type { Colaborador, ItemCEU } from '@/types/database'

export interface LinhaEntregaArquivo {
  colaborador: string
  quantidade: number
  item: string
  tamanho: string
  descricaoOriginal: string
}

export type StatusLinhaEntrega = 'ok' | 'aviso' | 'erro'

/**
 * Como o item foi resolvido. Regra permanente (incidente de 13/07/2026):
 * só `exato` nasce aceito; `regra` e `palpite` são inferências e exigem
 * confirmação humana (a linha nasce desmarcada na prévia).
 */
export type MatchTipoItem = 'exato' | 'regra' | 'palpite'

export interface LinhaEntregaAnalisada {
  indice: number
  original: LinhaEntregaArquivo
  colaborador: Colaborador | null
  item: ItemCEU | null
  /** Como o item foi resolvido (null quando não resolvido). */
  matchTipoItem: MatchTipoItem | null
  /** true quando o colaborador foi casado por prefixo/nome truncado. */
  colaboradorAproximado: boolean
  /** Itens oferecidos para escolha manual quando a linha não resolve sozinha. */
  candidatosItem: ItemCEU[]
  status: StatusLinhaEntrega
  mensagens: string[]
  incluir: boolean
}

/** Linha com inferência (item por regra/palpite ou colaborador aproximado) — exige confirmação. */
export function linhaInferida(l: LinhaEntregaAnalisada): boolean {
  return l.matchTipoItem === 'regra' || l.matchTipoItem === 'palpite' || l.colaboradorAproximado
}

export function normalizarTexto(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------- colaborador ----------

/** Remove observações entre parênteses do nome ("RICARDO ... (periculosidade)"). */
export function limparNomeColaborador(nome: string): string {
  return nome.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

export interface ResultadoColaborador {
  colaborador: Colaborador | null
  /** true quando o casamento foi por prefixo (nome truncado no arquivo). */
  aproximado: boolean
}

export function resolverColaborador(nomeArquivo: string, colaboradores: Colaborador[]): ResultadoColaborador {
  const nome = normalizarTexto(limparNomeColaborador(nomeArquivo))
  if (!nome) return { colaborador: null, aproximado: false }

  const porMatricula = colaboradores.find((c) => c.matricula && c.matricula === nomeArquivo.trim())
  if (porMatricula) return { colaborador: porMatricula, aproximado: false }

  const exatos = colaboradores.filter((c) => normalizarTexto(c.nome_completo) === nome)
  if (exatos.length > 0) {
    return { colaborador: exatos.find((c) => c.status === 'Ativo') || exatos[0], aproximado: false }
  }
  // fallback: nome do arquivo pode estar truncado (ex.: "MARCOS VINICIUS STELLET MONT")
  const parciais = colaboradores.filter((c) => {
    const n = normalizarTexto(c.nome_completo)
    return n.startsWith(nome) || nome.startsWith(n)
  })
  if (parciais.length > 0) {
    return { colaborador: parciais.find((c) => c.status === 'Ativo') || parciais[0], aproximado: true }
  }
  return { colaborador: null, aproximado: false }
}

// ---------- item ----------

/** Palavra-chave que identifica o item no catálogo. */
function chaveBuscaItem(item: string): string {
  const n = normalizarTexto(item)
  if (n.includes('nitril')) return 'nitril'
  if (n.includes('pvc')) return 'pvc'
  // palavra inteira: "espuma"/"capuz" não podem acionar a luva de eletricista
  if (/\bpu\b/.test(n)) return ' pu' // evita casar com outras palavras
  if (n.includes('latex')) return 'latex'
  if (n.includes('botina')) return 'botina'
  if (n.startsWith('bota')) return 'bota'
  if (n.includes('mascara')) return 'mascara'
  if (n.includes('oculos')) return 'oculos'
  if (n.includes('avental')) return 'avental'
  if (n.includes('protetor')) return 'protetor'
  return n
}

export function normalizarTamanho(t: string): string {
  const n = normalizarTexto(t).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
  if (['extra g', 'xg', 'eg', 'xgg', 'gg'].includes(n)) return 'eg'
  if (n === 'g' || n === 'g verde') return 'g'
  if (n === 'm' || n === 'm verde') return 'm'
  if (n === 'p' || n === 'p verde') return 'p'
  return n
}

const LETRAS_TAMANHO = ['p', 'm', 'g', 'gg', 'eg', 'xg', 'pp', 'xgg']

/** Extrai o tamanho do nome do item do catálogo ("... - Tam. G" ou sufixo "42"/"G"). */
export function tamanhoDoNomeItem(nome: string): string | null {
  const m = nome.match(/tam\.?\s*:?\s*([a-z0-9]+)/i)
  if (m) return normalizarTamanho(m[1])
  const tokens = normalizarTexto(nome).split(/[\s\-–—]+/).filter(Boolean)
  const ultimo = tokens[tokens.length - 1]
  if (!ultimo) return null
  if (/^\d{1,2}$/.test(ultimo)) return ultimo
  if (LETRAS_TAMANHO.includes(ultimo)) return normalizarTamanho(ultimo)
  return null
}

// Escolhas fixas confirmadas pelo histórico de entregas (item em uso atual):
// máscara → respirador com válvula; óculos → lente incolor; avental → AVENTAL
// liso; protetor → auricular; luva PVC → item exato "LUVA PVC" (a busca por
// "pvc" também casaria com as botas).
const PREFERE_EXATO: Record<string, string> = {
  mascara: 'mascara respirador com valvula',
  oculos: 'oculos lente incolor',
  avental: 'avental',
  protetor: 'protetor auricular',
  pvc: 'luva pvc',
}

// Nitrílica usa numeração 8/9; o catálogo tem letras (M/G): 8→M, 9→G.
const MAPA_NUM_NITRILICA: Record<string, string> = { '7': 'p', '8': 'm', '9': 'g', '10': 'eg' }

export interface ResultadoItem {
  item: ItemCEU | null
  /** Como o item foi resolvido; null quando não resolvido (escolha manual). */
  matchTipo: MatchTipoItem | null
  /** Candidatos considerados — exibidos para escolha manual quando não resolve. */
  candidatos: ItemCEU[]
}

export function resolverItem(
  itemArquivo: string,
  tamanhoArquivo: string,
  itensAtivos: ItemCEU[]
): ResultadoItem {
  // tamanho pode vir grudado no nome ("luva nitrílica9", "luva latex g")
  let tamanho = tamanhoArquivo.trim()
  if (!tamanho) {
    const m = itemArquivo.match(/(\d{1,2})\s*$/)
    if (m) tamanho = m[1]
    else {
      const tokens = normalizarTexto(itemArquivo).split(/[\s\-–—]+/).filter(Boolean)
      const ultimo = tokens[tokens.length - 1]
      if (ultimo && LETRAS_TAMANHO.includes(ultimo)) tamanho = ultimo
    }
  }

  // 0) casamento EXATO (único aceito sem confirmação): código ou nome normalizado
  //    estritamente idêntico ao do catálogo, incluindo o tamanho quando houver
  const nomeNorm = normalizarTexto(itemArquivo)
  const porCodigo = itensAtivos.find((i) => i.codigo && normalizarTexto(String(i.codigo)) === nomeNorm)
  if (porCodigo) return { item: porCodigo, matchTipo: 'exato', candidatos: [porCodigo] }
  const exato = itensAtivos.find((i) => normalizarTexto(i.nome) === nomeNorm)
  if (exato) return { item: exato, matchTipo: 'exato', candidatos: [exato] }

  const kw = chaveBuscaItem(itemArquivo)
  let candidatos = itensAtivos.filter((i) => normalizarTexto(i.nome).includes(kw))
  if (kw === 'bota') candidatos = candidatos.filter((i) => !normalizarTexto(i.nome).includes('botina'))

  let tam = ''
  if (tamanho) {
    tam = normalizarTamanho(tamanho)
    if (kw === 'nitril' && MAPA_NUM_NITRILICA[tam]) tam = MAPA_NUM_NITRILICA[tam]
  }

  // 1) escolha fixa confirmada pelo histórico (regra — nasce desmarcada na prévia)
  const nomePreferido = PREFERE_EXATO[kw.trim()]
  if (nomePreferido) {
    const achado = candidatos.find((i) => normalizarTexto(i.nome) === nomePreferido)
    if (achado) return { item: achado, matchTipo: 'regra', candidatos }
  }
  // 2) por tamanho: só resolve quando UM candidato tem o tamanho pedido;
  //    2+ candidatos com o mesmo tamanho = escolha manual, nunca palpite
  if (tam) {
    const comTamanho = candidatos.filter((i) => tamanhoDoNomeItem(i.nome) === tam)
    if (comTamanho.length === 1) return { item: comTamanho[0], matchTipo: 'regra', candidatos }
    if (comTamanho.length > 1) return { item: null, matchTipo: null, candidatos }
  }
  // 3) candidato único: tamanho divergente do pedido = não resolvido;
  //    sem tamanho no arquivo = palpite (nunca automático)
  if (candidatos.length === 1) {
    const unico = candidatos[0]
    if (tam && tamanhoDoNomeItem(unico.nome) !== tam) {
      return { item: null, matchTipo: null, candidatos }
    }
    return { item: unico, matchTipo: 'palpite', candidatos }
  }
  // 4) sem tamanho no arquivo: prefere item também sem tamanho no nome (palpite)
  if (!tam) {
    const semTamanho = candidatos.find((i) => !tamanhoDoNomeItem(i.nome))
    if (semTamanho) return { item: semTamanho, matchTipo: 'palpite', candidatos }
  }
  return { item: null, matchTipo: null, candidatos }
}

// ---------- análise completa ----------

/** Chave de duplicidade: mesmo colaborador + item + quantidade já entregue na data. */
export function chaveDuplicidade(colaboradorId: string, itemId: string, quantidade: number): string {
  return `${colaboradorId}|${itemId}|${quantidade}`
}

export function analisarLinhas(
  linhas: LinhaEntregaArquivo[],
  colaboradores: Colaborador[],
  itensAtivos: ItemCEU[],
  entregasExistentes: Set<string> = new Set()
): LinhaEntregaAnalisada[] {
  return linhas.map((original, indice) => {
    const mensagens: string[] = []
    let status: StatusLinhaEntrega = 'ok'
    let incluir = true

    const { colaborador, aproximado } = resolverColaborador(original.colaborador, colaboradores)
    if (!colaborador) {
      status = 'erro'
      incluir = false
      mensagens.push(`Colaborador não encontrado: "${original.colaborador}"`)
    } else {
      if (colaborador.status !== 'Ativo') {
        status = 'aviso'
        incluir = false // decisão 09/2026: inativos/afastados ficam de fora por padrão
        mensagens.push(`Colaborador ${colaborador.status} — desmarcado; marque para incluir`)
      }
      if (aproximado) {
        status = 'aviso'
        incluir = false // casamento aproximado nunca nasce aceito — confirmação humana
        mensagens.push('Nome aproximado (truncado no arquivo?) — confira e marque para confirmar')
      }
    }

    const { item, matchTipo, candidatos } = resolverItem(original.item, original.tamanho, itensAtivos)
    if (!item) {
      status = 'erro'
      incluir = false
      mensagens.push(
        candidatos.length > 0
          ? 'Item não resolvido — escolha manualmente'
          : `Nenhum item do catálogo corresponde a "${original.item}"`
      )
    } else if (matchTipo === 'regra' || matchTipo === 'palpite') {
      // regra permanente (incidente 13/07/2026): inferência nunca nasce aceita
      status = 'aviso'
      incluir = false
      mensagens.push(
        matchTipo === 'regra'
          ? 'Item inferido pela conversão do histórico — confirme ou troque ao lado'
          : 'Item inferido (palpite) — confirme ou escolha outro ao lado'
      )
    }

    if (colaborador && item && entregasExistentes.has(chaveDuplicidade(colaborador.id, item.id, original.quantidade))) {
      status = 'aviso'
      incluir = false
      mensagens.push('Já existe entrega igual nesta data — desmarcada para não duplicar')
    }

    if (!(original.quantidade > 0)) {
      status = 'erro'
      incluir = false
      mensagens.push('Quantidade inválida')
    }

    return {
      indice,
      original,
      colaborador,
      item,
      matchTipoItem: item ? matchTipo : null,
      colaboradorAproximado: aproximado,
      candidatosItem: candidatos.length > 0 ? candidatos : itensAtivos,
      status,
      mensagens,
      incluir,
    }
  })
}

// ---------- leitura do arquivo ----------

/** Mapeia o cabeçalho do arquivo para os campos esperados (aceita variações). */
function campoDoCabecalho(cabecalho: string): keyof LinhaEntregaArquivo | null {
  const n = normalizarTexto(cabecalho)
  if (n.includes('colab') || n === 'nome') return 'colaborador'
  if (n.includes('quant') || n === 'qtd') return 'quantidade'
  if (n === 'item' || n.includes('produto')) return 'item'
  if (n.includes('tamanho') || n === 'tam') return 'tamanho'
  if (n.includes('descricao')) return 'descricaoOriginal'
  return null
}

/** Converte linhas cruas (objetos por cabeçalho) no formato esperado. */
export function mapearLinhasArquivo(rows: Record<string, unknown>[]): LinhaEntregaArquivo[] {
  if (rows.length === 0) return []
  const chaves = Object.keys(rows[0])
  const mapa = new Map<string, keyof LinhaEntregaArquivo>()
  for (const chave of chaves) {
    const campo = campoDoCabecalho(chave)
    if (campo && ![...mapa.values()].includes(campo)) mapa.set(chave, campo)
  }
  if (!mapa.size) return []

  const linhas: LinhaEntregaArquivo[] = []
  for (const row of rows) {
    const get = (campo: keyof LinhaEntregaArquivo) => {
      const chave = [...mapa.entries()].find(([, c]) => c === campo)?.[0]
      const valor = chave ? row[chave] : undefined
      return valor === undefined || valor === null ? '' : String(valor).trim()
    }
    const colaborador = get('colaborador')
    const item = get('item')
    if (!colaborador && !item) continue // linha vazia
    const tamanho = get('tamanho')
    const quantidade = parseInt(get('quantidade'), 10) || 1
    linhas.push({
      colaborador,
      quantidade,
      item,
      tamanho,
      descricaoOriginal: get('descricaoOriginal') || `${String(quantidade).padStart(2, '0')} ${item}${tamanho ? ` ${tamanho}` : ''}`,
    })
  }
  return linhas
}

/**
 * Detecta arquivo de entregas pelo cabeçalho (tem colaborador E item), para
 * trocar o tipo de importação automaticamente quando a usuária sobe o CSV de
 * entregas com "Itens" selecionado (o tipo padrão da tela).
 */
export function pareceEntregas(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false
  const campos = new Set(
    Object.keys(rows[0])
      .map(campoDoCabecalho)
      .filter((c) => c !== null)
  )
  return campos.has('colaborador') && campos.has('item')
}

/** Detecta o separador de um CSV de texto e devolve as linhas como objetos. */
export function parseCsvEntregas(texto: string): Record<string, string>[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim())
  if (linhas.length < 2) return []
  const separador = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ';' : ','
  const cabecalhos = linhas[0].split(separador).map((h) => h.trim().replace(/^["']|["']$/g, ''))
  return linhas.slice(1).map((linha) => {
    const valores = linha.split(separador).map((v) => v.trim().replace(/^["']|["']$/g, ''))
    const row: Record<string, string> = {}
    cabecalhos.forEach((h, i) => {
      row[h] = valores[i] || ''
    })
    return row
  })
}
