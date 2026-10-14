// Carga inicial do módulo Materiais a partir da planilha de conferência REVISADA
// pela gestão (dados-locais/materiais_conferencia_2026-10-09.xlsx).
// Plano: docs/PLANO_MATERIAIS_FASE1.md §8. Tabelas-alvo: fornecedores (só INSERT),
// mat_itens, mat_item_variacoes, mat_precos, mat_aliases, mat_contratos,
// mat_kit_itens e mat_historico_consumo (fonte 'planilha_completa').
//
// Uso:
//   npx tsx --tsconfig tsconfig.scripts.json scripts/materiais/carregar-materiais.ts [opções]
//
//   (sem opções)         DRY-RUN: lê produção (SÓ SELECT), monta a carga, grava o relatório
//                        em dados-locais/ e NÃO escreve nada no banco.
//   --aplicar            grava de verdade (backup das tabelas-alvo antes; um arquivo SQL por etapa,
//                        cada um em transação; confirmação de contagens no fim).
//   --ensaio             executa as 8 etapas numa ÚNICA transação que termina em erro proposital
//                        (ROLLBACK), devolvendo as contagens de dentro da transação. Nada fica gravado.
//   --offline            reaproveita os JSONs de produção já baixados em dados-locais/materiais_prod/
//   --planilha=<xlsx>    padrão: dados-locais/materiais_conferencia_2026-10-09.xlsx
//   --kit-cota           inclui também as 197 linhas "só cota MODELO" (padrão: NÃO entram)
//
// Idempotência: tudo usa chave natural + ON CONFLICT DO NOTHING (cadastro: nunca sobrescreve
// edição feita depois no CORH) — exceto o histórico, regravado por (contrato,item,variação,mês,fonte).
// Acentos: o SQL vai sempre por ARQUIVO UTF-8 (executar-arquivo-sql-management-api.ps1).
// NUNCA versionar dados-locais/ (dados pessoais).

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import * as XLSXns from '@e965/xlsx'
import {
  compararPreferenciaDepartamento,
  encontrarDepartamentoFuzzy,
  departamentosSelecionaveis,
  idsGrupoDepartamento,
  normalizarDepartamento,
  type DepartamentoFuzzy,
} from '../../src/lib/departamentos'
import { normalizarTexto } from '../../src/lib/materiais/normalizar'

const XLSX = ((XLSXns as unknown as { default?: typeof XLSXns }).default ?? XLSXns) as typeof XLSXns

// ---------- argumentos ----------
const APLICAR = process.argv.includes('--aplicar')
const OFFLINE = process.argv.includes('--offline')
const ENSAIO = process.argv.includes('--ensaio')
const INCLUIR_COTA = process.argv.includes('--kit-cota')
function arg(nome: string): string | null {
  const a = process.argv.find((x) => x.startsWith(`--${nome}=`))
  return a ? a.slice(nome.length + 3) : null
}
const PLANILHA = arg('planilha') || 'dados-locais/materiais_conferencia_2026-10-09.xlsx'
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const DIR_PROD = 'dados-locais/materiais_prod'
const RELATORIO = `dados-locais/relatorio_carga_materiais_${HOJE}${APLICAR ? '_APLICADO' : '_dryrun'}.md`

// ---------- regras fixas (decisões da gestão, 09/10/2026) ----------
const REGRA_ESCRITORIO = { contrato: 'ESCRITÓRIO PLENA', nomeCurto: 'ADM PLENA' }
const TELEX_NOME_CURTO = 'CENTRO AUDITIVO TELEX' // todos os contratos "TELEX ..."
// Contratos descartados por decisão da gestão (14/10/2026): sem contrato, sem kit, sem histórico.
const EXCLUIR_CONTRATOS: Record<string, string> = {
  'MB LOFT': 'contrato encerrado em 13/10/2026',
  'PUNTA DEL MAR': 'contrato inexistente — histórico descartado',
  'MODELO SUSO': 'era só a base dos formulários',
}
// Vínculos conferidos e confirmados pela gestão (nome do contrato → nome_curto do departamento).
const VINCULO_CONFIRMADO: Record<string, string> = {
  'PALAZZO ITAÚBA': 'PALAZZO',
  TECH: 'PLENA TECH ADMINISTRATIVO',
  TATHIANA: 'THATIANA',
}
// Itens cujo kit não diz a variação: a variação é derivada do que cada contrato pediu (ver derivarVariacoes).
// Exceção (gestão, 14/10/2026): uma das marcas era o modelo antigo — toda a quantidade do kit vai para a
// variação do pedido MAIS RECENTE do histórico (se o mês mais recente tiver duas variações, NÃO decide: avisa).
const KIT_VARIACAO_MAIS_RECENTE = new Set(['MÉRITO BARRETO|Mop Cabeleira Pequena UN', 'VILA DE CASCAIS|Mop Cabeleira Pequena UN'])
const ITENS_VARIACAO_PELO_HISTORICO = ['Mop Cabeleira Pequena UN', 'Mop Cabeleira Grande UN', 'Flanela Microfibra UN', 'Cera 5L']
// Grafia duplicada vista na planilha (acento trocado) — funde no contrato de pedido oficial.
const FUNDIR_CONTRATO: Record<string, string> = { 'SPLÉNDIDO': 'SPLÊNDIDO' }
// Aba Catálogo, coluna "Categoria" → 5 categorias do banco (migration 127).
type Categoria = 'limpeza' | 'portaria' | 'descartaveis' | 'acessorios' | 'piscina'
const CATEGORIA: Record<string, Categoria> = {
  limpeza: 'limpeza',
  'descartáveis': 'descartaveis',
  'utensílios': 'acessorios',
  'outros (piscina)': 'piscina',
}

// ---------- tipos ----------
type Linha = Record<string, string | number | null>
interface Dep extends DepartamentoFuzzy {
  status: string | null
}
const avisos: { tipo: string; texto: string }[] = []
const aviso = (tipo: string, texto: string) => avisos.push({ tipo, texto })

// ---------- produção (SÓ SELECT) ----------
function consultarProducao(nome: string, sql: string): unknown[] {
  const arquivo = path.join(DIR_PROD, `${nome}.json`)
  if (!OFFLINE) {
    fs.mkdirSync(DIR_PROD, { recursive: true })
    // Consultas só com ASCII (acento inline corrompe no PowerShell 5.1).
    execFileSync(
      'powershell',
      ['-NoProfile', '-File', 'scripts/lib/executar-sql-arquivo.ps1', '-Saida', arquivo, '-Query', sql],
      { stdio: 'pipe' }
    )
  }
  return JSON.parse(fs.readFileSync(arquivo, 'utf-8'))
}

// ---------- planilha ----------
function lerAba(wb: ReturnType<typeof XLSX.read>, nome: string): Linha[] {
  const ws = wb.Sheets[nome]
  if (!ws) throw new Error(`Aba não encontrada na planilha: "${nome}"`)
  return XLSX.utils.sheet_to_json<Linha>(ws, { defval: null })
}
const txt = (v: unknown): string | null => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const mesParaData = (m: string | null): string | null => (m && /^\d{4}-\d{2}$/.test(m) ? `${m}-01` : null)

// ---------- SQL ----------
const q = (v: string | null): string => (v === null ? 'null' : `'${v.replace(/'/g, "''")}'`)
const n = (v: number | null): string => (v === null ? 'null' : String(v))
const b = (v: boolean): string => (v ? 'true' : 'false')
const lotes = <T,>(arr: T[], tam: number): T[][] => {
  const r: T[][] = []
  for (let i = 0; i < arr.length; i += tam) r.push(arr.slice(i, i + tam))
  return r
}

function main() {
  console.log(`Modo: ${APLICAR ? 'APLICAR (grava no banco)' : 'DRY-RUN (nada é gravado)'}${OFFLINE ? ' [offline]' : ''}`)
  if (!fs.existsSync(PLANILHA)) throw new Error(`Planilha não encontrada: ${PLANILHA}`)
  const wb = XLSX.read(fs.readFileSync(PLANILHA))
  const abaCatalogo = lerAba(wb, 'Catálogo')
  const abaVar = lerAba(wb, 'Variações')
  const abaAlias = lerAba(wb, 'Nomes antigos')
  const abaKit = lerAba(wb, 'Kit Mensal')
  const abaHist = lerAba(wb, 'Histórico mensal')
  const abaForn = lerAba(wb, 'Fornecedores')
  const abaPend = lerAba(wb, 'Pendências')

  // ---- produção ----
  const deps = consultarProducao('deps', 'select id, nome, nome_curto, empresa_id, status from departamentos order by nome') as Dep[]
  const fornProd = consultarProducao('forn', 'select id, nome, cnpj from fornecedores order by nome') as {
    id: string
    nome: string | null
    cnpj: string | null
  }[]
  const contagens = consultarProducao(
    'cnt',
    `select 'mat_itens' t, count(*) from mat_itens union all select 'mat_item_variacoes', count(*) from mat_item_variacoes
     union all select 'mat_precos', count(*) from mat_precos union all select 'mat_aliases', count(*) from mat_aliases
     union all select 'mat_contratos', count(*) from mat_contratos union all select 'mat_kit_itens', count(*) from mat_kit_itens
     union all select 'mat_historico_consumo', count(*) from mat_historico_consumo`
  ) as { t: string; count: number }[]
  const jaTemDados = contagens.filter((c) => Number(c.count) > 0)

  // ---- 1. fornecedores ----
  const fornSheet = abaForn.map((r) => txt(r['Nome'])).filter((x): x is string => !!x)
  const fornExistentes = new Map(fornProd.filter((f) => f.nome && f.nome.trim()).map((f) => [normalizarTexto(f.nome), f]))
  const fornNovos = fornSheet.filter((nm) => !fornExistentes.has(normalizarTexto(nm)))
  const fornSemNome = fornProd.filter((f) => !f.nome || !f.nome.trim())
  // Os existentes (só CNPJ) são fornecedores de uniformes (gestão, 14/10/2026): ficam como estão; os 13 da planilha são acrescentados.
  void fornSemNome

  // ---- 2. itens / variações / preços ----
  interface Item {
    nome: string
    categoria: Categoria
    unidade: string
    fornecedor: string | null
    validade: number | null
    temVariacao: boolean
    ativo: boolean
    ordem: number
    preco: number | null
    mesPreco: string | null
  }
  const itens: Item[] = []
  const semMapaCategoria = new Set<string>()
  abaCatalogo.forEach((r, i) => {
    const nome = txt(r['Nome padronizado'])
    if (!nome) return
    const cat = txt(r['Categoria']) || ''
    if (!(cat in CATEGORIA)) semMapaCategoria.add(cat)
    itens.push({
      nome,
      categoria: CATEGORIA[cat] ?? 'limpeza',
      unidade: txt(r['Unidade de pedido']) || 'unidade',
      fornecedor: txt(r['Fornecedor atual']),
      validade: num(r['Validade (meses)']),
      temVariacao: txt(r['Tem variação (S/N)']) === 'S',
      ativo: (txt(r['Situação no catálogo']) || 'ativo').startsWith('ativo'),
      ordem: i + 1,
      preco: num(r['Preço atual (R$)']),
      mesPreco: txt(r['Mês do preço']),
    })
  })
  if (semMapaCategoria.size) aviso('Catálogo', `Categorias sem mapa (viraram "limpeza"): ${[...semMapaCategoria].join(', ')}`)
  const itemPorNome = new Map(itens.map((i) => [i.nome, i]))
  if (new Set(itens.map((i) => i.nome.toLowerCase())).size !== itens.length) aviso('Catálogo', 'Nomes de itens que colidem em minúsculas (índice único lower(nome))')
  const fornDesconhecidos = new Set(itens.map((i) => i.fornecedor).filter((f): f is string => !!f && !fornSheet.includes(f)))
  if (fornDesconhecidos.size) aviso('Fornecedores', `Fornecedor do catálogo fora da aba Fornecedores: ${[...fornDesconhecidos].join(', ')}`)

  interface Var {
    item: string
    rotulo: string
    fornecedor: string | null
    preco: number | null
    mesPreco: string | null
    ordem: number
  }
  const variacoes: Var[] = abaVar.map((r, i) => ({
    item: txt(r['Item'])!,
    rotulo: txt(r['Variação'])!,
    fornecedor: txt(r['Fornecedor']),
    preco: num(r['Preço atual (R$)']),
    mesPreco: txt(r['Mês do preço']),
    ordem: i + 1,
  }))
  const chaveVar = (item: string, rot: string | null) => `${item}|${rot ?? ''}`
  const varSet = new Set(variacoes.map((v) => chaveVar(v.item, v.rotulo)))
  variacoes.forEach((v) => {
    if (!itemPorNome.has(v.item)) aviso('Variações', `Variação "${v.rotulo}" aponta para item inexistente: ${v.item}`)
  })

  interface Preco {
    item: string
    variacao: string | null
    fornecedor: string | null
    preco: number
    desde: string
  }
  const precos: Preco[] = []
  const itensSemPreco: string[] = []
  const precoPorChave = new Map<string, number>()
  for (const it of itens) {
    if (it.preco !== null) {
      const desde = mesParaData(it.mesPreco)
      if (!desde) aviso('Preços', `Item "${it.nome}" tem preço sem mês — ignorado`)
      else {
        precos.push({ item: it.nome, variacao: null, fornecedor: it.fornecedor, preco: it.preco, desde })
        precoPorChave.set(chaveVar(it.nome, null), it.preco)
      }
    } else if (!it.temVariacao) itensSemPreco.push(`${it.nome}${it.ativo ? '' : ' (inativo)'}`)
  }
  for (const v of variacoes) {
    if (v.preco === null) {
      itensSemPreco.push(`${v.item} / ${v.rotulo}`)
      continue
    }
    const desde = mesParaData(v.mesPreco)
    if (!desde) {
      aviso('Preços', `Variação ${v.item}/${v.rotulo} tem preço sem mês — ignorada`)
      continue
    }
    precos.push({ item: v.item, variacao: v.rotulo, fornecedor: v.fornecedor, preco: v.preco, desde })
    precoPorChave.set(chaveVar(v.item, v.rotulo), v.preco)
  }

  // ---- 3. aliases ----
  interface Alias {
    legado: string // normalizado
    original: string
    item: string
    variacao: string | null
    fator: number
  }
  const aliases = new Map<string, Alias>()
  let aliasIgnorados = 0
  let aliasDuplicadosIguais = 0
  for (const r of abaAlias) {
    const original = txt(r['Nome antigo (como está na planilha)'])
    const item = txt(r['Nome padronizado'])
    if (!original || !item) continue
    if (item === '(ignorar)') {
      aliasIgnorados++
      continue
    }
    if (!itemPorNome.has(item)) {
      aviso('Aliases', `Nome antigo "${original}" → item inexistente "${item}" — ignorado`)
      continue
    }
    const variacao = txt(r['Variação'])
    if (variacao && !varSet.has(chaveVar(item, variacao))) {
      aviso('Aliases', `Nome antigo "${original}" → variação inexistente "${item}/${variacao}" — ignorado`)
      continue
    }
    const legado = normalizarTexto(original)
    const novo: Alias = { legado, original, item, variacao, fator: num(r['Fator de unidade']) ?? 1 }
    const ex = aliases.get(legado)
    if (ex) {
      if (ex.item === novo.item && ex.variacao === novo.variacao && ex.fator === novo.fator) aliasDuplicadosIguais++
      else aviso('Aliases', `Nomes antigos "${ex.original}" e "${original}" normalizam igual mas apontam para destinos diferentes`)
      continue
    }
    aliases.set(legado, novo)
  }

  // ---- 4. contratos de pedido + departamentos ----
  const selecionaveis = departamentosSelecionaveis(deps)
  const depPorId = new Map(deps.map((d) => [d.id, d]))
  const contratoCanon = (nome: string) => FUNDIR_CONTRATO[nome] ?? nome

  interface Contrato {
    nome: string
    nomePlanilha: Set<string>
    deptPlanilha: string | null
    recebeLimpeza: boolean
    ativo: boolean
    observacao: string | null
    depId: string | null
    depCurto: string | null
    resolucao: string
    nKit: number
    nHist: number
  }
  const contratos = new Map<string, Contrato>()
  const getC = (nomeRaw: string): Contrato => {
    const nome = contratoCanon(nomeRaw)
    let c = contratos.get(nome)
    if (!c) {
      c = {
        nome,
        nomePlanilha: new Set(),
        deptPlanilha: null,
        recebeLimpeza: true,
        ativo: true,
        observacao: null,
        depId: null,
        depCurto: null,
        resolucao: '',
        nKit: 0,
        nHist: 0,
      }
      contratos.set(nome, c)
    }
    if (nomeRaw !== nome) c.nomePlanilha.add(nomeRaw)
    return c
  }
  const excluidos: Record<string, { kit: number; hist: number }> = {}
  const contaExcl = (nome: string, campo: 'kit' | 'hist') => {
    excluidos[nome] ??= { kit: 0, hist: 0 }
    excluidos[nome][campo]++
  }
  for (const r of abaKit) {
    const nome = txt(r['Contrato de pedido (padronizado)'])
    if (!nome) continue
    if (nome in EXCLUIR_CONTRATOS) {
      if (txt(r['Item padronizado']) && txt(r['Origem']) === 'kit') contaExcl(nome, 'kit')
      continue
    }
    const c = getC(nome)
    c.deptPlanilha ??= txt(r['Departamento CORH (id)'])
    c.recebeLimpeza = txt(r['Recebe limpeza (S/N)']) !== 'N'
  }
  for (const r of abaHist) {
    const nome = txt(r['Contrato padronizado'])
    if (!nome) continue
    if (nome in EXCLUIR_CONTRATOS) {
      contaExcl(nome, 'hist')
      continue
    }
    const c = getC(nome)
    c.deptPlanilha ??= txt(r['Departamento CORH (id)'])
    c.nHist++
    if (txt(r['Situação do contrato']) === 'contrato encerrado') c.ativo = false
  }

  const ativoComCurto = (d: Dep | undefined) => !!d && d.status === 'Ativo' && !!d.nome_curto?.trim()
  function acharPorNomeCurto(nc: string): Dep | null {
    const alvo = normalizarDepartamento(nc)
    return selecionaveis.find((d) => normalizarDepartamento(d.nome_curto || '') === alvo) ?? null
  }
  for (const c of contratos.values()) {
    let dep: Dep | null = null
    if (c.nome === REGRA_ESCRITORIO.contrato) {
      dep = acharPorNomeCurto(REGRA_ESCRITORIO.nomeCurto)
      c.resolucao = 'regra fixa → ADM PLENA'
    } else if (c.nome.startsWith('TELEX')) {
      dep = acharPorNomeCurto(TELEX_NOME_CURTO)
      c.resolucao = 'regra fixa → CENTRO AUDITIVO TELEX'
    } else if (VINCULO_CONFIRMADO[c.nome]) {
      dep = acharPorNomeCurto(VINCULO_CONFIRMADO[c.nome])
      c.resolucao = 'vínculo confirmado pela gestão'
    } else if (c.deptPlanilha) {
      const original = depPorId.get(c.deptPlanilha)
      if (ativoComCurto(original)) {
        dep = original!
        c.resolucao = 'id da planilha (ativo)'
      } else if (original) {
        // linha da planilha ficou inativa/sem nome_curto (fusões de 09/10): procura irmã Ativa
        const irmas = [...idsGrupoDepartamento(deps, original.id)]
          .map((id) => depPorId.get(id)!)
          .filter(ativoComCurto)
          .sort(compararPreferenciaDepartamento)
        if (irmas.length) {
          dep = irmas[0]
          c.resolucao = `irmã ativa de ${original.nome_curto} (${original.status})`
        } else c.resolucao = `departamento da planilha (${original.nome_curto}) está ${original.status} e não tem irmã ativa`
      } else c.resolucao = 'id da planilha não existe mais em produção'
    }
    if (!dep) {
      // última tentativa: fuzzy só entre os selecionáveis (ativos com nome_curto) — nunca ILIKE
      const f = encontrarDepartamentoFuzzy(selecionaveis, null, c.nome.replace(/\s*\(.*\)\s*$/, ''))
      if (f) {
        dep = f as Dep
        c.resolucao += (c.resolucao ? '; ' : '') + `fuzzy → ${f.nome_curto} (CONFIRMAR)`
      }
    }
    c.depId = dep?.id ?? null
    c.depCurto = dep?.nome_curto ?? null
    // divergência com o nome_curto sugerido pela planilha (informativo)
    if (dep && c.deptPlanilha && c.deptPlanilha !== dep.id && !c.resolucao.startsWith('irmã') && !c.resolucao.startsWith('regra'))
      aviso('Contratos', `${c.nome}: departamento da planilha ≠ resolvido (${c.resolucao})`)
  }
  const contratosComDep = [...contratos.values()].filter((c) => c.depId)
  const contratosSemDep = [...contratos.values()].filter((c) => !c.depId)
  const nomesComDep = new Set(contratosComDep.map((c) => c.nome))

  // ---- 5. kit ----
  interface KitLinha {
    contrato: string
    item: string
    variacao: string | null
    qtd: number
    periodicidade: number
    obs: string | null
  }
  const kit: KitLinha[] = []
  const kitCotaIgnorada: number[] = [0]
  const kitSemVariacao = new Map<string, Set<string>>() // item → contratos
  const kitChave = new Set<string>()
  for (const r of abaKit) {
    const nomeRaw = txt(r['Contrato de pedido (padronizado)'])
    const item = txt(r['Item padronizado'])
    if (!nomeRaw || !item) continue // linha-marcador de contrato sem kit
    const origem = txt(r['Origem'])
    const qtd = num(r['Quantidade'])
    if (origem !== 'kit' && !INCLUIR_COTA) {
      kitCotaIgnorada[0]++
      continue
    }
    if (qtd === null) {
      if (origem === 'kit') aviso('Kit', `${nomeRaw} / ${item}: quantidade vazia — ignorada`)
      continue
    }
    const contrato = contratoCanon(nomeRaw)
    if (contrato in EXCLUIR_CONTRATOS) continue
    if (!itemPorNome.has(item)) {
      aviso('Kit', `${contrato} / ${item}: item fora do catálogo — ignorado`)
      continue
    }
    const variacao = txt(r['Variação'])
    const chave = `${contrato}|${item}|${variacao ?? ''}`
    if (kitChave.has(chave)) {
      aviso('Kit', `Linha duplicada ignorada: ${chave}`)
      continue
    }
    kitChave.add(chave)
    if (!variacao && itemPorNome.get(item)!.temVariacao) {
      if (!kitSemVariacao.has(item)) kitSemVariacao.set(item, new Set())
      kitSemVariacao.get(item)!.add(contrato)
    }
    kit.push({
      contrato,
      item,
      variacao,
      qtd,
      periodicidade: num(r['Periodicidade (meses)']) ?? 1,
      obs: txt(r['Texto original (quando livre)']),
    })
  }
  const kitBase = kit.filter((k) => nomesComDep.has(k.contrato))
  const kitForaPorDep = kit.length - kitBase.length

  // ---- 6. histórico ----
  interface Hist {
    contrato: string
    item: string
    variacao: string | null
    mes: string
    qtd: number
    valor: number | null
    legado: string | null
  }
  const hist: Hist[] = []
  const histChave = new Map<string, Hist>()
  let histSemValor = 0
  for (const r of abaHist) {
    const nomeRaw = txt(r['Contrato padronizado'])
    const item = txt(r['Item padronizado'])
    const mes = mesParaData(txt(r['Mês (AAAA-MM)']))
    const qtd = num(r['Qtd. padronizada (x fator)'])
    if (nomeRaw && nomeRaw in EXCLUIR_CONTRATOS) continue
    if (!nomeRaw || !item || !mes || qtd === null) {
      aviso('Histórico', `Linha inválida ignorada: ${JSON.stringify([nomeRaw, item, r['Mês (AAAA-MM)'], r['Qtd. padronizada (x fator)']])}`)
      continue
    }
    if (!itemPorNome.has(item)) {
      aviso('Histórico', `Item fora do catálogo: ${item}`)
      continue
    }
    const variacao = txt(r['Variação'])
    const h: Hist = { contrato: contratoCanon(nomeRaw), item, variacao, mes, qtd, valor: num(r['Valor (R$)']), legado: txt(r['Nomes antigos usados']) }
    if (h.valor === null) histSemValor++
    const chave = `${h.contrato}|${item}|${variacao ?? ''}|${mes}`
    const ex = histChave.get(chave)
    if (ex) {
      ex.qtd += h.qtd // contratos fundidos (SPLÉNDIDO→SPLÊNDIDO) podem colidir: soma
      ex.valor = ex.valor === null && h.valor === null ? null : (ex.valor ?? 0) + (h.valor ?? 0)
      continue
    }
    histChave.set(chave, h)
    hist.push(h)
  }
  const histCarga = hist.filter((h) => nomesComDep.has(h.contrato))
  const histForaPorDep = hist.length - histCarga.length

  // ---- 6b. variação do kit derivada do histórico ----
  // Regra (decisão da gestão, 14/10/2026), para Mop Cabeleira Pequena/Grande, Flanela e Cera, quando o
  // kit não diz a variação: distribui a quantidade do kit entre as variações PEDIDAS pelo contrato nos
  // últimos 6 meses do histórico (a janela termina no último mês da planilha), proporcionalmente à
  // quantidade pedida de cada variação (só linhas com variação informada). Arredondamento pelo maior
  // resto, que preserva o TOTAL do kit; empate no resto: maior quantidade pedida, depois pedido mais
  // recente, depois ordem alfabética. Sem dado nos 6 meses, usa todo o histórico com variação; sem
  // nada, se o catálogo só tem UMA variação para o item, usa essa; senão fica nula (listado).
  const mesesHist = [...new Set(hist.map((h) => h.mes))].sort()
  const janela = new Set(mesesHist.slice(-6))
  interface Derivacao {
    contrato: string
    item: string
    qtdKit: number
    origem: string
    partes: { variacao: string | null; qtd: number }[]
    base: string
  }
  const derivacoes: Derivacao[] = []
  const kitCarga: KitLinha[] = []
  for (const k of kitBase) {
    if (k.variacao || !ITENS_VARIACAO_PELO_HISTORICO.includes(k.item) || !itemPorNome.get(k.item)!.temVariacao) {
      kitCarga.push(k)
      continue
    }
    const linhas = hist.filter((h) => h.contrato === k.contrato && h.item === k.item && h.variacao)
    let origem = 'últimos 6 meses'
    let usadas = linhas.filter((h) => janela.has(h.mes))
    if (!usadas.length && linhas.length) {
      usadas = linhas
      origem = 'todo o histórico (sem pedido com variação nos últimos 6 meses)'
    }
    let partes: { variacao: string | null; qtd: number }[]
    let base = ''
    const recente = KIT_VARIACAO_MAIS_RECENTE.has(`${k.contrato}|${k.item}`) && linhas.length > 0
    if (recente) {
      const ultimoMes = linhas.map((h) => h.mes).sort().slice(-1)[0]
      const vs = [...new Set(linhas.filter((h) => h.mes === ultimoMes).map((h) => h.variacao!))]
      if (vs.length === 1) {
        partes = [{ variacao: vs[0], qtd: k.qtd }]
        origem = `variação do pedido mais recente (${ultimoMes.slice(0, 7)})`
        base = `${vs[0]} em ${ultimoMes.slice(0, 7)}`
      } else {
        aviso('Kit', `${k.contrato}/${k.item}: o mês mais recente (${ultimoMes.slice(0, 7)}) tem ${vs.length} variações (${vs.join(', ')}) — NÃO decidido, usando a regra de proporção`)
        partes = []
      }
      if (partes.length) {
        derivacoes.push({ contrato: k.contrato, item: k.item, qtdKit: k.qtd, origem, partes, base })
        for (const p of partes) kitCarga.push({ ...k, variacao: p.variacao, qtd: p.qtd })
        continue
      }
    }
    if (usadas.length && Number.isInteger(k.qtd)) {
      const tot = new Map<string, { qtd: number; ultimo: string }>()
      for (const h of usadas) {
        const t = tot.get(h.variacao!) ?? { qtd: 0, ultimo: '' }
        t.qtd += h.qtd
        if (h.mes > t.ultimo) t.ultimo = h.mes
        tot.set(h.variacao!, t)
      }
      const soma = [...tot.values()].reduce((a, t) => a + t.qtd, 0)
      const cand = [...tot.entries()].map(([variacao, t]) => {
        const exato = (k.qtd * t.qtd) / soma
        return { variacao, base: Math.floor(exato), resto: exato - Math.floor(exato), qtdPedida: t.qtd, ultimo: t.ultimo }
      })
      let faltam = k.qtd - cand.reduce((a, c) => a + c.base, 0)
      const ordem = [...cand].sort(
        (a, b) => b.resto - a.resto || b.qtdPedida - a.qtdPedida || (a.ultimo < b.ultimo ? 1 : a.ultimo > b.ultimo ? -1 : 0) || a.variacao.localeCompare(b.variacao, 'pt-BR')
      )
      for (const c of ordem) if (faltam > 0) { c.base++; faltam-- }
      partes = cand.filter((c) => c.base > 0).sort((a, b) => b.base - a.base || a.variacao.localeCompare(b.variacao, 'pt-BR')).map((c) => ({ variacao: c.variacao, qtd: c.base }))
      base = [...tot.entries()].map(([v, t]) => `${v} ${t.qtd}`).join(', ')
    } else {
      const vs = variacoes.filter((v) => v.item === k.item)
      if (vs.length === 1) {
        partes = [{ variacao: vs[0].rotulo, qtd: k.qtd }]
        origem = 'variação única do item no catálogo'
      } else {
        partes = [{ variacao: null, qtd: k.qtd }]
        origem = 'SEM dado de variação — fica nula'
      }
    }
    derivacoes.push({ contrato: k.contrato, item: k.item, qtdKit: k.qtd, origem, partes, base })
    for (const p of partes) kitCarga.push({ ...k, variacao: p.variacao, qtd: p.qtd })
  }

  // ---- totais de kit em R$ por contrato ----
  const totais = new Map<string, { bruto: number; mensal: number; semPreco: string[]; linhas: number }>()
  for (const k of kitCarga) {
    const t = totais.get(k.contrato) ?? { bruto: 0, mensal: 0, semPreco: [], linhas: 0 }
    const p = precoPorChave.get(chaveVar(k.item, k.variacao))
    t.linhas++
    if (p === undefined) t.semPreco.push(`${k.item}${k.variacao ? '/' + k.variacao : ''}`)
    else {
      t.bruto += k.qtd * p
      t.mensal += (k.qtd * p) / k.periodicidade
    }
    totais.set(k.contrato, t)
  }

  // ---- pendências da planilha ----
  const pendAbertas = abaPend.filter((p) => !txt(p['Decisão da gestora']))
  const pendResolvidas = abaPend.length - pendAbertas.length

  // ---- relatório ----
  const L: string[] = []
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  L.push(`# Carga Materiais — ${APLICAR ? 'APLICADA' : 'DRY-RUN'} — ${HOJE}`, '')
  L.push(`Planilha: ${PLANILHA}`, `Produção: SÓ SELECT. Tabelas-alvo já com dados: ${jaTemDados.length ? jaTemDados.map((c) => `${c.t}=${c.count}`).join(', ') : 'nenhuma (todas vazias)'}`, '')
  L.push('## Contagens (o que seria gravado)', '', '| Tabela | Linhas |', '|---|---|')
  L.push(`| fornecedores (novos; ${fornProd.length} existentes preservados) | ${fornNovos.length} |`)
  L.push(`| mat_itens | ${itens.length} (${itens.filter((i) => i.ativo).length} ativos, ${itens.filter((i) => !i.ativo).length} inativos) |`)
  L.push(`| mat_item_variacoes | ${variacoes.length} |`)
  L.push(`| mat_precos | ${precos.length} |`)
  L.push(`| mat_aliases | ${aliases.size} (ignorados "(ignorar)": ${aliasIgnorados}; duplicados idênticos fundidos: ${aliasDuplicadosIguais}) |`)
  L.push(`| mat_contratos | ${contratosComDep.length} de ${contratos.size} (${contratosSemDep.length} sem departamento ficam de fora) |`)
  L.push(`| mat_kit_itens | ${kitCarga.length} (de ${kit.length}; ${kitForaPorDep} em contratos fora da carga; linhas só-cota MODELO ${INCLUIR_COTA ? 'incluídas' : 'NÃO incluídas'}: ${kitCotaIgnorada[0]}) |`)
  L.push(`| mat_historico_consumo | ${histCarga.length} (de ${hist.length}; ${histForaPorDep} em contratos fora da carga; ${histSemValor} sem valor) |`, '')

  L.push('## Contratos de pedido', '', '| Contrato | Departamento | Resolução | Limpeza | Ativo | Kit | Hist. |', '|---|---|---|---|---|---|---|')
  for (const c of [...contratos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))) {
    const nk = kit.filter((k) => k.contrato === c.nome).length
    L.push(`| ${c.nome} | ${c.depCurto ?? '**SEM MATCH**'} | ${c.resolucao || '—'} | ${c.recebeLimpeza ? 'S' : 'N'} | ${c.ativo ? 'S' : 'N'} | ${nk} | ${c.nHist} |`)
  }
  L.push('', '## Totais do kit em R$ por contrato', '', 'Bruto = Σ quantidade × preço vigente (definição do plano §3.2). Mensalizado divide pela periodicidade. "Sem preço" = linhas do kit sem preço cadastrado. Kit sem variação definida usa o preço do ITEM (referência) — o valor real depende da variação escolhida.', '', '| Contrato | Linhas | Bruto | Mensalizado | Linhas sem preço |', '|---|---|---|---|---|')
  let somaBruto = 0
  for (const [c, t] of [...totais.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))) {
    somaBruto += t.bruto
    L.push(`| ${c} | ${t.linhas} | ${brl(t.bruto)} | ${brl(t.mensal)} | ${t.semPreco.length ? t.semPreco.join('; ') : '—'} |`)
  }
  L.push(`| **Soma** | ${kitCarga.length} | ${brl(somaBruto)} | | |`)
  const semKit = [...contratosComDep].filter((c) => !kit.some((k) => k.contrato === c.nome))
  L.push('', `Contratos na carga SEM nenhuma linha de kit (${semKit.length}): ${semKit.map((c) => c.nome + (c.recebeLimpeza ? '' : ' [sem limpeza]')).join(', ')}`)

  L.push('', '## Itens sem preço', '', itensSemPreco.length ? itensSemPreco.map((x) => `- ${x}`).join('\n') : 'nenhum')
  L.push('', '## Variação do kit derivada do histórico (regra: proporção dos últimos 6 meses com pedido, maior resto preservando o total)', '', '| Contrato | Item | Kit | Resultado | Base (qtd pedida por variação) | Origem |', '|---|---|---|---|---|---|')
  for (const d of derivacoes.sort((a, b) => a.item.localeCompare(b.item) || a.contrato.localeCompare(b.contrato, 'pt-BR')))
    L.push(`| ${d.contrato} | ${d.item} | ${d.qtdKit} | ${d.partes.map((p) => `${p.qtd} ${p.variacao ?? '(sem variação)'}`).join(' + ')} | ${d.base || '—'} | ${d.origem} |`)
  L.push('', `Contratos/itens que ficaram SEM variação: ${derivacoes.filter((d) => d.partes.some((p) => !p.variacao)).map((d) => d.contrato + '/' + d.item).join('; ') || 'nenhum'}`)
  L.push('', '## Contratos sem match de departamento', '', contratosSemDep.length ? contratosSemDep.map((c) => `- ${c.nome} (${c.nHist} registros de histórico; kit ${kit.filter((k) => k.contrato === c.nome).length}): ${c.resolucao || 'sem departamento'}`).join('\n') : 'nenhum')
  L.push('', '## Contratos descartados por decisão da gestão (sem contrato, kit nem histórico)', '', ...Object.entries(EXCLUIR_CONTRATOS).map(([c, m]) => `- ${c}: ${m} — kit ${excluidos[c]?.kit ?? 0} linhas, histórico ${excluidos[c]?.hist ?? 0} linhas descartadas`))
  L.push('', '## Avisos', '', avisos.length ? avisos.map((a) => `- [${a.tipo}] ${a.texto}`).join('\n') : 'nenhum')
  L.push('', `## Pendências da planilha: ${abaPend.length} no total, ${pendResolvidas} com "Decisão da gestora" preenchida, ${pendAbertas.length} em aberto`, '')
  for (const p of pendAbertas) L.push(`- [${p['Prioridade']}] ${p['Tipo']}: ${String(p['Descrição']).slice(0, 110)}`)
  fs.mkdirSync('dados-locais', { recursive: true })

  // ---- SQL ----
  const etapas: { nome: string; sql: string[] }[] = []
  const fornId = (nm: string | null) => (nm ? `(select id from public.fornecedores where lower(nome) = lower(${q(nm)}) order by created_at limit 1)` : 'null')
  etapas.push({
    nome: '1_fornecedores',
    sql: fornNovos.map(
      (nm) =>
        `insert into public.fornecedores (nome, ativo) select ${q(nm)}, true where not exists (select 1 from public.fornecedores where lower(nome) = lower(${q(nm)}));`
    ),
  })
  etapas.push({
    nome: '2_itens',
    sql: lotes(itens, 100).map(
      (l) =>
        `insert into public.mat_itens (nome, categoria, unidade_pedido, fornecedor_id, validade_meses, tem_variacao, ativo, ordem) values\n` +
        l.map((i) => `(${q(i.nome)}, ${q(i.categoria)}, ${q(i.unidade)}, ${fornId(i.fornecedor)}, ${n(i.validade)}, ${b(i.temVariacao)}, ${b(i.ativo)}, ${i.ordem})`).join(',\n') +
        `\non conflict (lower(nome)) do nothing;`
    ),
  })
  const itemId = (nm: string) => `(select id from public.mat_itens where lower(nome) = lower(${q(nm)}))`
  const varId = (it: string, rot: string | null) =>
    rot ? `(select id from public.mat_item_variacoes where item_id = ${itemId(it)} and rotulo = ${q(rot)})` : 'null'
  etapas.push({
    nome: '3_variacoes',
    sql: lotes(variacoes, 100).map(
      (l) =>
        `insert into public.mat_item_variacoes (item_id, rotulo, ordem) values\n` +
        l.map((v) => `(${itemId(v.item)}, ${q(v.rotulo)}, ${v.ordem})`).join(',\n') +
        `\non conflict (item_id, rotulo) do nothing;`
    ),
  })
  etapas.push({
    nome: '4_precos',
    sql: lotes(precos, 100).map(
      (l) =>
        `insert into public.mat_precos (item_id, variacao_id, fornecedor_id, preco, vigente_desde)\n` +
        `select v.item_id, v.variacao_id, v.fornecedor_id, v.preco, v.desde from (values\n` +
        l.map((p) => `(${itemId(p.item)}::uuid, ${varId(p.item, p.variacao)}::uuid, ${fornId(p.fornecedor)}::uuid, ${p.preco}::numeric, ${q(p.desde)}::date)`).join(',\n') +
        `\n) as v(item_id, variacao_id, fornecedor_id, preco, desde)\n` +
        `where not exists (select 1 from public.mat_precos x where x.item_id = v.item_id and x.variacao_id is not distinct from v.variacao_id and x.preco = v.preco and x.vigente_desde = v.desde);`
    ),
  })
  etapas.push({
    nome: '5_aliases',
    sql: lotes([...aliases.values()], 100).map(
      (l) =>
        `insert into public.mat_aliases (nome_legado, item_id, variacao_id, fator) values\n` +
        l.map((a) => `(${q(a.legado)}, ${itemId(a.item)}, ${varId(a.item, a.variacao)}, ${a.fator})`).join(',\n') +
        `\non conflict (nome_legado) do nothing;`
    ),
  })
  etapas.push({
    nome: '6_contratos',
    sql: lotes(contratosComDep, 100).map(
      (l) =>
        `insert into public.mat_contratos (departamento_id, nome, recebe_limpeza, ativo, observacao) values\n` +
        l.map((c) => `(${q(c.depId)}, ${q(c.nome)}, ${b(c.recebeLimpeza)}, ${b(c.ativo)}, ${q(c.observacao)})`).join(',\n') +
        `\non conflict (lower(nome)) do nothing;`
    ),
  })
  const contratoId = (nm: string) => `(select id from public.mat_contratos where lower(nome) = lower(${q(nm)}))`
  etapas.push({
    nome: '7_kit',
    sql: lotes(kitCarga, 100).map(
      (l) =>
        `insert into public.mat_kit_itens (contrato_id, item_id, variacao_id, quantidade, periodicidade_meses, observacao) values\n` +
        l.map((k) => `(${contratoId(k.contrato)}, ${itemId(k.item)}, ${varId(k.item, k.variacao)}, ${k.qtd}, ${k.periodicidade}, ${q(k.obs)})`).join(',\n') +
        `\non conflict (contrato_id, item_id, (coalesce(variacao_id, '00000000-0000-0000-0000-000000000000'::uuid))) do nothing;`
    ),
  })
  etapas.push({
    nome: '8_historico',
    sql: lotes(histCarga, 400).map(
      (l) =>
        `insert into public.mat_historico_consumo (contrato_id, item_id, variacao_id, competencia, quantidade, valor, nome_legado, fonte)\n` +
        `select c.id, i.id, v.id, h.comp, h.qtd, h.valor, h.legado, 'planilha_completa' from (values\n` +
        l.map((h) => `(${q(h.contrato)}, ${q(h.item)}, ${q(h.variacao)}, ${q(h.mes)}::date, ${h.qtd}::numeric, ${n(h.valor)}::numeric, ${q(h.legado)})`).join(',\n') +
        `\n) as h(contrato, item, variacao, comp, qtd, valor, legado)\n` +
        `join public.mat_contratos c on lower(c.nome) = lower(h.contrato)\n` +
        `join public.mat_itens i on lower(i.nome) = lower(h.item)\n` +
        `left join public.mat_item_variacoes v on v.item_id = i.id and v.rotulo = h.variacao\n` +
        `on conflict (contrato_id, item_id, (coalesce(variacao_id, '00000000-0000-0000-0000-000000000000'::uuid)), competencia, fonte)\n` +
        `do update set quantidade = excluded.quantidade, valor = excluded.valor, nome_legado = excluded.nome_legado;`
    ),
  })

  // O SQL do dry-run também é gravado (para revisão), sem executar.
  const dirSql = `dados-locais/materiais_carga_sql_${HOJE}`
  fs.mkdirSync(dirSql, { recursive: true })
  for (const e of etapas) {
    fs.writeFileSync(path.join(dirSql, `${e.nome}.sql`), `begin;\n${e.sql.join('\n')}\ncommit;\n`, 'utf-8')
  }
  L.push('', `## SQL gerado (não executado no dry-run)`, '', `Pasta ${dirSql}: ${etapas.map((e) => `${e.nome} (${e.sql.length} stmt)`).join(', ')}`)

  if (ENSAIO && !APLICAR) {
    const tabelas = ['fornecedores', 'mat_itens', 'mat_item_variacoes', 'mat_precos', 'mat_aliases', 'mat_contratos', 'mat_kit_itens', 'mat_historico_consumo']
    const contagem = tabelas.map((t) => `(select count(*) from public.${t})`).join(" || ',' || ")
    const corpo = [
      'begin;',
      ...etapas.map((e) => e.sql.join(String.fromCharCode(10))),
      `do $ens$ begin raise exception 'ENSAIO_OK contagens(${tabelas.join(',')})=%', ${contagem}; end $ens$;`,
      'rollback;',
    ].join(String.fromCharCode(10))
    const arq = path.join(dirSql, 'ensaio_unica_transacao.sql')
    fs.writeFileSync(arq, corpo, 'utf-8')
    let out: string
    try {
      out = execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-arquivo-sql-management-api.ps1', '-Arquivo', arq], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 })
    } catch (e) {
      out = String((e as { stdout?: string }).stdout ?? e)
    }
    L.push('', '## Ensaio em transação única (ROLLBACK)', '', '```', out.slice(0, 2000), '```')
    console.log('Resultado do ensaio:', out.slice(0, 2000))
  }

  if (APLICAR) {
    if (contratosSemDep.length > 0)
      console.warn('ATENÇÃO: há contratos sem departamento — ficarão de fora da carga (ver relatório).')
    // backup
    const dirBk = `dados-locais/backup_materiais_carga_${HOJE}`
    fs.mkdirSync(dirBk, { recursive: true })
    for (const t of ['fornecedores', 'mat_itens', 'mat_item_variacoes', 'mat_precos', 'mat_aliases', 'mat_contratos', 'mat_kit_itens', 'mat_historico_consumo']) {
      execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-sql-arquivo.ps1', '-Saida', path.join(dirBk, `${t}.json`), '-Query', `select * from public.${t}`], { stdio: 'pipe' })
    }
    console.log(`Backup salvo em ${dirBk}`)
    for (const e of etapas) {
      const f = path.join(dirSql, `${e.nome}.sql`)
      console.log(`Executando ${e.nome} ...`)
      const out = execFileSync('powershell', ['-NoProfile', '-File', 'scripts/lib/executar-arquivo-sql-management-api.ps1', '-Arquivo', f], { encoding: 'utf-8' })
      if (!out.startsWith('ok')) throw new Error(`Etapa ${e.nome} falhou: ${out}`)
    }
    const pos = consultarProducao(
      'cnt_pos',
      `select 'fornecedores' t, count(*) from fornecedores union all select 'mat_itens', count(*) from mat_itens union all select 'mat_item_variacoes', count(*) from mat_item_variacoes
       union all select 'mat_precos', count(*) from mat_precos union all select 'mat_aliases', count(*) from mat_aliases union all select 'mat_contratos', count(*) from mat_contratos
       union all select 'mat_kit_itens', count(*) from mat_kit_itens union all select 'mat_historico_consumo', count(*) from mat_historico_consumo`
    ) as { t: string; count: number }[]
    L.push('', '## Contagens após a carga', '', pos.map((p) => `- ${p.t}: ${p.count}`).join('\n'))
  }

  fs.writeFileSync(RELATORIO, L.join('\n') + '\n', 'utf-8')
  console.log(L.join('\n'))
  console.log(`\nRelatório: ${RELATORIO}`)
}

main()
