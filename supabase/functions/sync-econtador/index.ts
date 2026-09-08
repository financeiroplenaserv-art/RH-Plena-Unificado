// Edge Function: sync-econtador
//
// Job de máquina (pg_cron) que importa os colaboradores da API Alterdata
// e-Contador direto para o banco, com service role. É o PORT para o backend
// da importação que hoje roda no frontend (src/hooks/useEContador.ts +
// src/hooks/useColaboradores.ts#upsertPorMatricula) — o objetivo é PARIDADE
// de comportamento com a importação manual, não "melhorar" formatos/regras.
//
// Acesso: SOMENTE job de máquina — Authorization: Bearer <ECONTADOR_CRON_KEY>
// (secret dedicada, mesmo padrão do SYNC_CRON_KEY do sync-performancelab).
// Sem caminho de usuário logado. Deploy SEM verificação de JWT do gateway
// (--no-verify-jwt / verify_jwt: false), senão o gateway rejeita a chave.
//
// Variáveis de ambiente necessárias (supabase secrets set):
//   - ECONTADOR_CRON_KEY: chave aleatória do agendador (guarda de acesso)
//   - ENCRYPTION_KEY: chave AES-256 em hexadecimal (64 chars) — a MESMA usada
//     pela Edge Function `econtador` para cifrar o token na tabela
//     `configuracoes` (chave 'econtador_token')
//
// Parâmetro opcional: ?empresa=<idAlterdata> roda só uma empresa (mitigação
// de timeout; sem o param roda todas as permitidas em sequência).
//
// Falha geral (token ausente/inválido, API Alterdata fora, erro inesperado):
// grava linha em historico_importacoes_econtador com
// empresa_nome = '(falha geral do job)' — proposital: a falha precisa aparecer
// na tela de histórico, senão o job morre em silêncio.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'

const BASE_URL = 'https://dp.pack.alterdata.com.br/api/v1'
const PERMITIDAS = ['plena ea', 'plena tech']
const ALTERDATA_TIMEOUT_MS = 60000
const CHUNK_GRAVACAO = 200
const PAGINA_POSTGREST = 1000 // o PostgREST corta em 1000 linhas por requisição

type Registro = Record<string, unknown>
type ClienteSupabase = ReturnType<typeof createClient>

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// ============================================================
// Criptografia AES-256-GCM (port de supabase/functions/econtador/index.ts)
// — aqui só a DESCRIPTOGRAFIA é necessária (quem cifra é a function econtador)
// ============================================================

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes.buffer
}

async function descriptografar(ciphertext: string, iv: string, tag: string, chaveHex: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    hexToBuffer(chaveHex),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  const data = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  const tagBytes = Uint8Array.from(atob(tag), (c) => c.charCodeAt(0))
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0))

  // AES-GCM no Web Crypto espera ciphertext + tag concatenados
  const combined = new Uint8Array(data.length + tagBytes.length)
  combined.set(data, 0)
  combined.set(tagBytes, data.length)

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, chave, combined)
  return new TextDecoder().decode(decrypted)
}

async function getToken(supabase: ClienteSupabase): Promise<string | null> {
  const chave = Deno.env.get('ENCRYPTION_KEY')
  if (!chave) throw new Error('ENCRYPTION_KEY não configurada')

  const { data, error } = await supabase
    .from('configuracoes')
    .select('valor_cifrado, iv, tag')
    .eq('chave', 'econtador_token')
    .single()

  if (error || !data?.valor_cifrado) return null
  return descriptografar(data.valor_cifrado, data.iv, data.tag, chave)
}

// ============================================================
// API Alterdata (port de supabase/functions/econtador/index.ts)
// ============================================================

async function fetchAlterdata(path: string, token: string, timeoutMs = ALTERDATA_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
      signal: controller.signal,
    })

    if (response.status === 401) throw new Error('Token inválido ou expirado')
    if (response.status === 403) throw new Error('Sem permissão. Verifique se é eContador Master.')
    if (!response.ok) throw new Error(`Erro ${response.status} ao consultar Alterdata`)

    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

interface EmpresaAlterdata {
  id: string
  nome: string
  codigo: string
}

/** Lista as empresas da conta e filtra as PERMITIDAS (Plena EA / Plena Tech). */
async function listarEmpresasAlterdata(token: string): Promise<EmpresaAlterdata[]> {
  const data = await fetchAlterdata('/empresas?page[limit]=25&page[offset]=0', token) as {
    data?: { id?: string; attributes?: { nome?: string; codigo?: string } }[]
  }
  return (data.data || [])
    .map((e) => ({
      id: String(e.id || ''),
      nome: String(e.attributes?.nome || 'Sem nome'),
      codigo: String(e.attributes?.codigo || ''),
    }))
    .filter((e) => PERMITIDAS.some((p) => e.nome.toLowerCase().includes(p)))
}

interface FuncionarioItem {
  id?: string
  attributes?: Record<string, unknown>
  relationships?: { departamento?: { data?: { id?: string } } }
}

/** Funcionário já mapeado — espelha EContadorFuncionario de src/types/econtador.ts. */
interface FuncionarioMapeado {
  id: string
  codigo: string
  nome: string
  cpf: string
  status: string
  departamento: string | null
  [campo: string]: string | null
}

function asStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  return String(value)
}

function mapearFuncionario(item: FuncionarioItem, included: unknown[]): Registro {
  const attrs = item.attributes || {}
  const deptId = item.relationships?.departamento?.data?.id
  const departamento = deptId
    ? (included as { id?: string; attributes?: { nome?: string } }[]).find((i) => i.id === deptId)
    : null

  const camposString = [
    'nome', 'codigo', 'cpf', 'pis', 'identidade', 'carteiradetrabalho', 'status',
    'demissao', 'afastamentodescricao', 'admissao', 'nomefuncao', 'telefone',
    'telefonecelular', 'email', 'cep', 'cidade', 'nascimento', 'dataAtualizacao',
    'rua', 'numero', 'complemento', 'bairro', 'estado', 'afastamento', 'retorno',
  ]

  const normalizado: Registro = {}
  for (const campo of camposString) {
    normalizado[campo] = asStringOrNull(attrs[campo])
  }

  return {
    id: String(item.id || ''),
    ...normalizado,
    departamento: asStringOrNull(departamento?.attributes?.nome) || asStringOrNull(attrs.departamento),
  }
}

/**
 * Busca TODOS os funcionários da empresa (sem filtro de status — o status do
 * CORH é derivado depois de demissão/afastamento), com paginação em loop
 * (links.next, lote de 100) — mesmo caminho do /funcionarios da function
 * econtador. As coerções String(... ?? '') espelham o listarFuncionarios do
 * hook (useEContador.ts:87-98).
 */
async function listarFuncionariosAlterdata(token: string, empresaId: string): Promise<FuncionarioMapeado[]> {
  const todos: FuncionarioMapeado[] = []
  let offset = 0
  const limit = 100
  let hasMore = true

  while (hasMore) {
    const path = `/funcionarios?filter[funcionarios][empresa.id][EQ]=${encodeURIComponent(empresaId)}&page[limit]=${limit}&page[offset]=${offset}&include=departamento`
    const data = await fetchAlterdata(path, token) as {
      data?: FuncionarioItem[]
      included?: unknown[]
      links?: { next?: string }
    }

    if (!data.data || data.data.length === 0) break

    const included = data.included || []
    todos.push(
      ...data.data.map((item) => {
        const f = mapearFuncionario(item, included)
        return {
          ...f,
          nome: String(f.nome ?? ''),
          codigo: String(f.codigo ?? ''),
          cpf: String(f.cpf ?? ''),
          status: String(f.status ?? ''),
          departamento: typeof f.departamento === 'string' ? f.departamento : null,
        } as FuncionarioMapeado
      })
    )

    if (data.links?.next) offset += limit
    else hasMore = false
  }

  return todos
}

// ============================================================
// Departamentos — match fuzzy (port de src/lib/departamentos.ts e dos
// helpers removerAcentos/distanciaLevenshtein de src/lib/utils.ts;
// reimplementados aqui porque o Deno não resolve o alias "@/")
// ============================================================

function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + custo)
    }
  }
  return dp[m][n]
}

/** Normalização dos matches de departamento: sem acentos/pontuação, maiúsculas. */
function normalizarDepartamento(texto: string): string {
  return removerAcentos(texto)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

interface DepartamentoFuzzy {
  id: string
  nome: string
  nome_curto: string | null
  empresa_id?: string | null
  status?: string | null
}

/**
 * Encontra departamento por nome exato > nome_curto exato > tokens >
 * substring > similaridade (Levenshtein >= 0.8). O match por ID não se aplica
 * aqui (o e-Contador só manda o nome textual). Filtra pela empresa quando
 * informada para não casar departamento entre empresas.
 */
function encontrarDepartamentoFuzzy(
  departamentos: DepartamentoFuzzy[],
  nomeTextual: string,
  empresaId?: string | null
): DepartamentoFuzzy | null {
  const nome = nomeTextual.trim()
  if (!nome) return null
  const nomeNorm = normalizarDepartamento(nome)

  const candidatos = empresaId
    ? departamentos.filter((d) => !d.empresa_id || d.empresa_id === empresaId)
    : departamentos

  const porNomeExato = candidatos.find((d) => normalizarDepartamento(d.nome) === nomeNorm)
  if (porNomeExato) return porNomeExato

  const porNomeCurtoExato = candidatos.find(
    (d) => d.nome_curto && normalizarDepartamento(d.nome_curto) === nomeNorm
  )
  if (porNomeCurtoExato) return porNomeCurtoExato

  const tokensNome = tokens(nomeNorm)
  const porTokens = candidatos.find((d) => {
    const tokensDepNome = tokens(normalizarDepartamento(d.nome))
    const tokensDepCurto = d.nome_curto ? tokens(normalizarDepartamento(d.nome_curto)) : []
    return tokensBatem(tokensNome, tokensDepNome) || tokensBatem(tokensNome, tokensDepCurto)
  })
  if (porTokens) return porTokens

  const porSubstring = candidatos.find((d) => {
    const nomeDep = normalizarDepartamento(d.nome)
    const nomeCurtoDep = d.nome_curto ? normalizarDepartamento(d.nome_curto) : ''
    return (
      (nomeDep && (nomeDep.includes(nomeNorm) || nomeNorm.includes(nomeDep))) ||
      (nomeCurtoDep && (nomeCurtoDep.includes(nomeNorm) || nomeNorm.includes(nomeCurtoDep)))
    )
  })
  if (porSubstring) return porSubstring

  let melhorScore = 0
  let melhor: DepartamentoFuzzy | null = null
  for (const d of candidatos) {
    const scoreNome = scoreSimilaridade(nomeNorm, normalizarDepartamento(d.nome))
    const scoreCurto = d.nome_curto ? scoreSimilaridade(nomeNorm, normalizarDepartamento(d.nome_curto)) : 0
    const score = Math.max(scoreNome, scoreCurto)
    if (score > melhorScore) {
      melhorScore = score
      melhor = d
    }
  }
  if (melhorScore >= 0.8) return melhor

  return null
}

/**
 * Port de useEContador.sincronizarDepartamentos (useEContador.ts:112-173):
 * reutiliza departamento existente via match fuzzy ANTES de criar — o
 * e-Contador manda o nome sem acento ("ALIANCA S A INDUSTRIA NAVAL") e o
 * cadastro tem acento ("Aliança S.A. Indústria Naval"); match exato por
 * lower-case criava linha duplicada.
 */
async function sincronizarDepartamentos(
  supabase: ClienteSupabase,
  lista: FuncionarioMapeado[],
  empresaId: string | null
): Promise<Map<string, string>> {
  const nomesUnicos = Array.from(
    new Set(lista.map((f) => f.departamento?.trim()).filter(Boolean))
  ) as string[]

  if (nomesUnicos.length === 0) return new Map<string, string>()

  let query = supabase.from('departamentos').select('id, nome, nome_curto, empresa_id, status')
  if (empresaId) {
    query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
  }
  query = query.eq('status', 'Ativo')

  const { data: existentes, error: erroBusca } = await query
  if (erroBusca) throw erroBusca

  const departamentos = (existentes || []) as DepartamentoFuzzy[]
  const map = new Map<string, string>()
  const novos: string[] = []

  for (const nomeEContador of nomesUnicos) {
    const nomeChave = nomeEContador.toLowerCase()
    const existente = encontrarDepartamentoFuzzy(departamentos, nomeEContador, empresaId)
    if (existente) {
      map.set(nomeChave, existente.id)
      continue
    }
    novos.push(nomeEContador)
  }

  if (novos.length > 0) {
    const { data: inseridos, error: erroInsert } = await supabase
      .from('departamentos')
      .insert(novos.map((nome) => ({ nome, empresa_id: empresaId, status: 'Ativo' })))
      .select('id, nome')

    if (erroInsert) throw erroInsert

    for (const d of (inseridos || []) as { id: string; nome: string }[]) {
      map.set(d.nome.toLowerCase(), d.id)
    }
  }

  return map
}

// ============================================================
// Regras puras da importação (port de src/lib/econtador.ts)
// ============================================================

/**
 * Decisão da gestão (12/08/2026): funcionário INATIVO/demitido que não casa
 * com nenhum registro do CORH e cujo INSERT falha por matrícula duplicada é
 * um registro histórico antigo cuja matrícula foi reutilizada por outro
 * colaborador — ignora em silêncio. Em quem está ATIVO continua erro.
 */
function deveIgnorarErroImportacao(err: unknown, funcionario: { demissao?: string | null; status?: string | null }): boolean {
  const inativo = Boolean(funcionario.demissao) || funcionario.status === 'Inativo'
  if (!inativo || !err || typeof err !== 'object') return false
  const { code, message } = err as { code?: unknown; message?: unknown }
  return code === '23505' && typeof message === 'string' && message.includes('matricula')
}

/**
 * Mensagem legível de qualquer formato de erro: Error comum, PostgrestError
 * (objeto simples com code/message — NÃO é instanceof Error), string solta
 * ou string com JSON serializado (formato legado do histórico).
 */
function extrairMensagemErro(err: unknown): string {
  if (!err) return 'Erro desconhecido'
  if (err instanceof Error) return err.message
  if (typeof err === 'string') {
    const texto = err.trim()
    if (texto.startsWith('{')) {
      try {
        const parsed: unknown = JSON.parse(texto)
        if (parsed && typeof parsed === 'object') {
          const { message } = parsed as { message?: unknown }
          if (typeof message === 'string' && message) return message
        }
      } catch {
        // não é JSON válido — devolve o texto como está
      }
    }
    return texto || 'Erro desconhecido'
  }
  if (typeof err === 'object') {
    const { message, code } = err as { message?: unknown; code?: unknown }
    if (typeof message === 'string' && message) {
      return typeof code === 'string' && code ? `[${code}] ${message}` : message
    }
    try {
      return JSON.stringify(err).slice(0, 500)
    } catch {
      return 'Erro não serializável'
    }
  }
  return String(err)
}

// ============================================================
// Datas — paridade com o hook
// ============================================================

/** "Hoje" (YYYY-MM-DD) no fuso de Brasília — o CORH fala o horário de Brasília. */
function hojeBrasil(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Mesmo recorte do hook: `valor.split('T')[0]` (a API manda ISO de Brasília). */
function dataDe(iso: string | null): string | null {
  return iso ? iso.split('T')[0] : null
}

// ============================================================
// Empresas internas (port de useEContador.importarFuncionarios,
// useEContador.ts:246-304)
// ============================================================

interface EmpresaDB {
  id: string
  nome: string | null
  codigo_alterdata: string | null
}

/** Resolve a empresa interna por codigo_alterdata ou nome (com os atalhos "tech"/"ea" do hook). */
function resolverEmpresaId(empresasDB: EmpresaDB[], codigo?: string, nome?: string): string | null {
  const mapPorCodigo = new Map<string, string>()
  const mapPorNome = new Map<string, string>()
  empresasDB.forEach((e) => {
    if (e.codigo_alterdata) mapPorCodigo.set(e.codigo_alterdata, e.id)
    if (e.nome) {
      const nomeLower = e.nome.toLowerCase().trim()
      mapPorNome.set(nomeLower, e.id)
      if (nomeLower.includes('tech')) mapPorNome.set('tech', e.id)
      if (nomeLower.includes('ea')) mapPorNome.set('ea', e.id)
    }
  })

  if (codigo) {
    const id = mapPorCodigo.get(codigo)
    if (id) return id
  }
  if (nome) {
    const nomeLower = nome.toLowerCase()
    const idPorNome = mapPorNome.get(nomeLower.trim())
    if (idPorNome) return idPorNome
    if (nomeLower.includes('tech')) return mapPorNome.get('tech') || null
    if (nomeLower.includes('ea')) return mapPorNome.get('ea') || null
    const parcial = empresasDB.find((e) => {
      if (!e.nome) return false
      const n = e.nome.toLowerCase()
      return nomeLower.includes(n) || n.includes(nomeLower)
    })
    if (parcial) return parcial.id
  }
  return null
}

// ============================================================
// upsertPorMatricula EM MEMÓRIA (port de useColaboradores.ts:225-310)
//
// O hook consultava o banco a cada funcionário (lento demais para um job).
// Aqui os colaboradores atuais são carregados UMA VEZ (paginado em lotes de
// 1000 — o PostgREST corta em 1000) e as MESMAS regras são aplicadas sobre
// mapas em memória:
//   - match por CPF e por matrícula separadamente, no escopo da empresa
//     (quando empresa_id informada, só casa registro DAQUELA empresa);
//   - conflito: CPF e matrícula apontando para registros diferentes -> erro;
//   - UPDATE quase total; empresa_id só é preenchido se o registro existente
//     ainda não tinha;
//   - achou por CPF e a matrícula nova já existe em OUTRO registro -> não
//     sobrescreve a matrícula (idem para CPF achado por matrícula);
//   - INSERT com tipo_contrato 'CLT'.
// O índice único de matrícula é GLOBAL (migration 079): conflito fora do
// escopo da empresa não é detectado em memória — estoura 23505 na gravação
// e cai no fallback linha a linha (deveIgnorarErroImportacao).
// ============================================================

interface RegColab {
  id: string | null // null = insert pendente decidido nesta execução
  empresa_id: string | null
  cpf: string | null
  matricula: string | null
  pendente?: number // índice do insert pendente na lista de decisões
  dono?: Decisao[] // lista de decisões à qual `pendente` se refere (1 por empresa)
}

interface Decisao {
  tipo: 'insert' | 'update'
  id?: string
  dados: Registro
  f: FuncionarioMapeado
  acoesExtras: number // merges sobre insert pendente (contam como "atualizado")
}

interface MapasColab {
  porCpf: Map<string, RegColab[]>
  porMatricula: Map<string, RegColab[]>
}

function registrarNosMapas(mapas: MapasColab, reg: RegColab) {
  if (reg.cpf) {
    const l = mapas.porCpf.get(reg.cpf) || []
    if (!l.includes(reg)) l.push(reg)
    mapas.porCpf.set(reg.cpf, l)
  }
  if (reg.matricula) {
    const l = mapas.porMatricula.get(reg.matricula) || []
    if (!l.includes(reg)) l.push(reg)
    mapas.porMatricula.set(reg.matricula, l)
  }
}

/**
 * Espelha o maybeSingle do hook: se MAIS DE UM registro casa (duplicidade de
 * cadastro), o PostgREST devolve erro que o hook DESCARTA tratando como
 * "não encontrado" — aqui, mesma coisa. O filter por identidade do objeto
 * evita contar duas vezes o mesmo registro indexado por chaves distintas.
 */
function encontrarUnico(lista: RegColab[] | undefined, empresaId: string | null): RegColab | null {
  if (!lista) return null
  const noEscopo = lista.filter((r) => !empresaId || r.empresa_id === empresaId)
  const unicos = Array.from(new Set(noEscopo))
  return unicos.length === 1 ? unicos[0] : null
}

/** Existe OUTRO registro (diferente de `reg`) com esta chave, no escopo da empresa? */
function existeOutro(lista: RegColab[] | undefined, reg: RegColab, empresaId: string | null): boolean {
  if (!lista) return false
  return lista.some((r) => r !== reg && (!empresaId || r.empresa_id === empresaId))
}

/**
 * Monta a linha do colaborador exatamente como o hook (useEContador.ts:317-390):
 * status derivado de demissão/afastamento, cargo = último trecho de
 * nomefuncao após " - ", endereço concatenado e dados_completos JSONB.
 */
function montarDadosColaborador(
  f: FuncionarioMapeado,
  empresaId: string | null,
  empresa: EmpresaDB | null,
  departamentosMap: Map<string, string>,
  hoje: string
): Registro {
  let status = 'Ativo'
  let afastamentoMotivo = f.afastamentodescricao || null
  let afastamentoDataInicio = dataDe(f.afastamento)
  let afastamentoDataFim = dataDe(f.retorno)

  if (f.demissao) {
    status = 'Inativo'
  } else if (f.status === 'Inativo') {
    status = 'Inativo'
  } else if (afastamentoMotivo && afastamentoMotivo !== '' && afastamentoMotivo !== 'Férias') {
    if (afastamentoDataFim) {
      // O hook compara Dates em meia-noite local de Brasília; como ambos são
      // YYYY-MM-DD, a comparação de strings ISO é equivalente.
      if (afastamentoDataFim < hoje) {
        status = 'Ativo'
        afastamentoMotivo = null
        afastamentoDataInicio = null
        afastamentoDataFim = null
      } else {
        status = 'Afastado'
      }
    } else {
      status = 'Afastado'
    }
  }

  const cargo = f.nomefuncao ? f.nomefuncao.split(' - ').pop() || f.nomefuncao : null
  const partesEnd = [f.rua, f.numero, f.complemento, f.bairro].filter(Boolean)
  const endereco = partesEnd.length > 0 ? partesEnd.join(', ') : null

  const dadosCompletos: Registro = {}
  Object.entries(f).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') dadosCompletos[k] = v
  })
  if (empresa) {
    dadosCompletos.codigoEmpresa = empresa.codigo_alterdata
    dadosCompletos.nomeEmpresa = empresa.nome
  }

  return {
    matricula: f.codigo || f.id,
    nome_completo: f.nome,
    cpf: f.cpf || null,
    rg: f.identidade || null,
    ctps: f.carteiradetrabalho || null,
    pis_pasep: f.pis || null,
    data_admissao: dataDe(f.admissao),
    data_demissao: dataDe(f.demissao),
    data_nascimento: dataDe(f.nascimento),
    cargo,
    departamento: f.departamento,
    departamento_id: f.departamento
      ? departamentosMap.get(f.departamento.toLowerCase()) || null
      : null,
    email: f.email || null,
    telefone: f.telefone || null,
    celular: f.telefonecelular || null,
    cidade: f.cidade || null,
    estado: f.estado || null,
    cep: f.cep || null,
    endereco,
    status,
    tipo_contrato: 'CLT',
    empresa_id: empresaId,
    afastamento_motivo: afastamentoMotivo,
    afastamento_data_inicio: afastamentoDataInicio,
    afastamento_data_fim: afastamentoDataFim,
    dados_completos: dadosCompletos,
  }
}

/**
 * Aplica as regras de upsertPorMatricula em memória e devolve as decisões
 * (inserts e updates) já mescladas. Os mapas são compartilhados entre as
 * empresas do job e MUTADOS a cada decisão, para que duplicidades dentro do
 * próprio lote se comportem como no loop sequencial do hook.
 */
function decidirUpserts(
  lista: FuncionarioMapeado[],
  empresaId: string | null,
  empresa: EmpresaDB | null,
  departamentosMap: Map<string, string>,
  mapas: MapasColab,
  detalhesErros: { nome: string; erro: string }[]
): { decisoes: Decisao[]; errosDecisao: number } {
  const decisoes: Decisao[] = []
  const hoje = hojeBrasil()
  let errosDecisao = 0

  for (const f of lista) {
    try {
      const dados = montarDadosColaborador(f, empresaId, empresa, departamentosMap, hoje)
      const cpf = dados.cpf as string | null
      const matricula = dados.matricula as string | null

      const porCpf = cpf ? encontrarUnico(mapas.porCpf.get(cpf), empresaId) : null
      const porMatricula = matricula ? encontrarUnico(mapas.porMatricula.get(matricula), empresaId) : null

      // Conflito grave: CPF e matrícula apontam para registros diferentes
      if (porCpf && porMatricula && porCpf !== porMatricula) {
        throw new Error(
          `Conflito de dados na empresa ${empresaId}: CPF ${cpf} pertence a um registro e matrícula ${matricula} pertence a outro. Verifique duplicatas no cadastro.`
        )
      }

      let existente = porCpf || porMatricula

      // Registro com id null de OUTRA empresa do job (os mapas são
      // compartilhados entre as empresas): o insert já foi gravado mas não
      // temos o id — trata como "não encontrado" e deixa o banco decidir
      // (23505 de matrícula global cai no fallback linha a linha).
      if (existente && existente.id === null && existente.dono !== decisoes) {
        existente = null
      }

      if (existente && existente.id === null && existente.pendente !== undefined) {
        // Casou com um INSERT decidido nesta execução: o loop sequencial do
        // hook atualizaria a linha recém-criada — aqui, mescla os dados no
        // insert pendente (empresa_id do pendente é preservada, como no
        // update de registro que já tem empresa) e conta como "atualizado".
        const pendente = decisoes[existente.pendente]
        const mesclado = { ...dados, empresa_id: pendente.dados.empresa_id ?? dados.empresa_id }
        if (porCpf === existente && matricula && existente.matricula !== matricula &&
            existeOutro(mapas.porMatricula.get(matricula), existente, empresaId)) {
          delete mesclado.matricula
        }
        if (porMatricula === existente && cpf && existente.cpf !== cpf &&
            existeOutro(mapas.porCpf.get(cpf), existente, empresaId)) {
          delete mesclado.cpf
        }
        pendente.dados = mesclado
        pendente.acoesExtras++
        if ('cpf' in mesclado) existente.cpf = mesclado.cpf as string | null
        if ('matricula' in mesclado) existente.matricula = mesclado.matricula as string | null
        registrarNosMapas(mapas, existente)
        continue
      }

      if (existente) {
        const dadosUpdate: Registro = { ...dados }
        if (existente.empresa_id) {
          delete dadosUpdate.empresa_id
        }

        // Achou por CPF e a matrícula nova já existe em outro registro (da
        // mesma empresa): não sobrescreve a matrícula.
        if (porCpf && matricula && porCpf.matricula !== matricula &&
            existeOutro(mapas.porMatricula.get(matricula), existente, empresaId)) {
          delete dadosUpdate.matricula
        }

        // Achou por matrícula e o CPF novo já existe em outro registro (da
        // mesma empresa): não sobrescreve o CPF.
        if (porMatricula && cpf && porMatricula.cpf !== cpf &&
            existeOutro(mapas.porCpf.get(cpf), existente, empresaId)) {
          delete dadosUpdate.cpf
        }

        decisoes.push({ tipo: 'update', id: existente.id!, dados: dadosUpdate, f, acoesExtras: 0 })
        if ('cpf' in dadosUpdate) existente.cpf = dadosUpdate.cpf as string | null
        if ('matricula' in dadosUpdate) existente.matricula = dadosUpdate.matricula as string | null
        if (!existente.empresa_id) existente.empresa_id = empresaId
        registrarNosMapas(mapas, existente)
        continue
      }

      const indice = decisoes.length
      decisoes.push({ tipo: 'insert', dados, f, acoesExtras: 0 })
      registrarNosMapas(mapas, {
        id: null,
        empresa_id: empresaId,
        cpf,
        matricula,
        pendente: indice,
        dono: decisoes,
      })
    } catch (err) {
      errosDecisao++
      detalhesErros.push({ nome: f.nome, erro: extrairMensagemErro(err) })
      console.error('Erro na decisão de upsert:', f.nome, err)
    }
  }

  return { decisoes, errosDecisao }
}

// ============================================================
// Gravação em lote
// ============================================================

interface Contadores {
  importados: number
  atualizados: number
  erros: number
  detalhesErros: { nome: string; erro: string }[]
}

/**
 * Grava as decisões EM LOTE (o loop sequencial do frontend é lento demais
 * para um job): updates via upsert em chunks incluindo `id` (linhas já
 * mescladas em memória, com empresa_id preservada quando já existia) e
 * inserts em chunks. Se um chunk falhar, refaz LINHA A LINHA para isolar o
 * erro: 23505 de matrícula em inativo/demitido é ignorado em silêncio
 * (matrícula histórica reutilizada — ver deveIgnorarErroImportacao); em
 * ativo, conta como erro.
 */
async function gravarDecisoes(
  supabase: ClienteSupabase,
  decisoes: Decisao[],
  cont: Contadores
): Promise<void> {
  const tratarErroLinha = (err: unknown, d: Decisao) => {
    if (deveIgnorarErroImportacao(err, d.f)) {
      console.info('Importação e-Contador: ignorado (inativo com matrícula já em uso no CORH):', d.f.nome)
      return
    }
    cont.erros++
    cont.detalhesErros.push({ nome: d.f.nome, erro: extrairMensagemErro(err) })
    console.error('Erro ao gravar:', d.f.nome, err)
  }

  const gravarChunk = async (lote: Decisao[], tipo: 'insert' | 'update') => {
    const linhas = lote.map((d) => (tipo === 'update' ? { id: d.id, ...d.dados } : d.dados))
    const builder = supabase.from('colaboradores')
    const { error } = tipo === 'update'
      ? await builder.upsert(linhas)
      : await builder.insert(linhas)

    if (!error) {
      for (const d of lote) {
        if (d.tipo === 'insert') {
          cont.importados++
          cont.atualizados += d.acoesExtras
        } else {
          cont.atualizados++
        }
      }
      return
    }

    // Chunk falhou: isola linha a linha para não perder o chunk inteiro
    console.warn(`Chunk de ${tipo} falhou (${extrairMensagemErro(error)}); refazendo linha a linha`)
    for (const d of lote) {
      const linha = tipo === 'update' ? { id: d.id, ...d.dados } : d.dados
      const { error: erroLinha } = tipo === 'update'
        ? await supabase.from('colaboradores').upsert([linha])
        : await supabase.from('colaboradores').insert([linha])
      if (erroLinha) {
        tratarErroLinha(erroLinha, d)
      } else if (d.tipo === 'insert') {
        cont.importados++
        cont.atualizados += d.acoesExtras
      } else {
        cont.atualizados++
      }
    }
  }

  const updates = decisoes.filter((d) => d.tipo === 'update')
  const inserts = decisoes.filter((d) => d.tipo === 'insert')

  for (let i = 0; i < updates.length; i += CHUNK_GRAVACAO) {
    await gravarChunk(updates.slice(i, i + CHUNK_GRAVACAO), 'update')
  }
  for (let i = 0; i < inserts.length; i += CHUNK_GRAVACAO) {
    await gravarChunk(inserts.slice(i, i + CHUNK_GRAVACAO), 'insert')
  }
}

// ============================================================
// Histórico (port de useEContador.salvarHistorico, useEContador.ts:208-230)
// — usuario_id = null: a listagem exibe "Automático (agendado)".
// ============================================================

async function salvarHistorico(
  supabase: ClienteSupabase,
  item: {
    empresa_id: string | null
    empresa_nome: string | null
    quantidade: number
    importados: number
    atualizados: number
    erros: number
    detalhes_erros: { nome: string; erro: string }[]
  }
): Promise<void> {
  const { error } = await supabase.from('historico_importacoes_econtador').insert({
    usuario_id: null,
    empresa_id: item.empresa_id,
    empresa_nome: item.empresa_nome,
    quantidade: item.quantidade,
    importados: item.importados,
    atualizados: item.atualizados,
    erros: item.erros,
    detalhes_erros: item.detalhes_erros,
  })
  // Falha ao gravar o histórico não pode derrubar o job — só loga
  if (error) console.error('Falha ao gravar historico_importacoes_econtador:', error)
}

// ============================================================
// Fluxo por empresa
// ============================================================

interface ResultadoEmpresa {
  empresa: string
  quantidade: number
  importados: number
  atualizados: number
  erros: number
}

async function processarEmpresa(
  supabase: ClienteSupabase,
  token: string,
  empresaAlt: EmpresaAlterdata,
  empresasDB: EmpresaDB[],
  mapas: MapasColab
): Promise<ResultadoEmpresa> {
  const cont: Contadores = { importados: 0, atualizados: 0, erros: 0, detalhesErros: [] }

  // 1) Funcionários da empresa na Alterdata, modo "todos" (sem filtro de status)
  const lista = await listarFuncionariosAlterdata(token, empresaAlt.id)
  console.log(`${empresaAlt.nome}: ${lista.length} funcionários na API`)

  // 2) Resolve a empresa interna por codigo_alterdata ou nome; cria se não
  // existir (mesma regra do hook — useEContador.ts:280-304)
  let empresaId = resolverEmpresaId(empresasDB, empresaAlt.id, empresaAlt.nome)
  if (!empresaId && empresaAlt.nome) {
    const { data: novaEmpresa, error: erroEmpresa } = await supabase
      .from('empresas')
      .insert({ nome: empresaAlt.nome, codigo_alterdata: empresaAlt.id || null, cnpj: null })
      .select('id, nome, codigo_alterdata')
      .single()

    if (erroEmpresa) {
      const msg = 'Erro ao criar empresa: ' + erroEmpresa.message
      console.error(msg, erroEmpresa)
      cont.detalhesErros.push({ nome: empresaAlt.nome, erro: msg })
      cont.erros++
    } else if (novaEmpresa) {
      empresaId = novaEmpresa.id as string
      empresasDB.push(novaEmpresa as EmpresaDB)
    }
  }
  const empresa = empresasDB.find((e) => e.id === empresaId) || null

  // 3) Departamentos com match fuzzy antes de inserir (nunca duplicar por acento)
  let departamentosMap = new Map<string, string>()
  try {
    departamentosMap = await sincronizarDepartamentos(supabase, lista, empresaId)
  } catch (err) {
    const msg = extrairMensagemErro(err)
    console.error('Erro ao sincronizar departamentos:', err)
    cont.detalhesErros.push({ nome: 'Sincronização de departamentos', erro: msg })
    cont.erros++
  }

  // 4) Regras de upsertPorMatricula em memória -> decisões
  const { decisoes, errosDecisao } = decidirUpserts(
    lista,
    empresaId,
    empresa,
    departamentosMap,
    mapas,
    cont.detalhesErros
  )
  cont.erros += errosDecisao

  // 5) Gravação em lote
  await gravarDecisoes(supabase, decisoes, cont)

  // 6) Histórico: 1 linha por empresa (usuario_id null = job agendado)
  await salvarHistorico(supabase, {
    empresa_id: empresaAlt.id || null,
    empresa_nome: empresaAlt.nome || null,
    quantidade: lista.length,
    importados: cont.importados,
    atualizados: cont.atualizados,
    erros: cont.erros,
    detalhes_erros: cont.detalhesErros,
  })

  console.log(
    `${empresaAlt.nome}: ${cont.importados} novos | ${cont.atualizados} atualizados | ${cont.erros} erros`
  )
  return {
    empresa: empresaAlt.nome,
    quantidade: lista.length,
    importados: cont.importados,
    atualizados: cont.atualizados,
    erros: cont.erros,
  }
}

// ============================================================
// Entrypoint
// ============================================================

Deno.serve(async (req: Request) => {
  // Cliente criado fora do try para o catch também conseguir gravar o histórico
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  // Guarda de acesso: SOMENTE job de máquina — sem caminho de usuário logado
  const cronKey = Deno.env.get('ECONTADOR_CRON_KEY')
  const authHeader = req.headers.get('authorization') || ''
  if (!cronKey || authHeader !== `Bearer ${cronKey}`) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

  const empresaFiltro = new URL(req.url).searchParams.get('empresa')

  try {
    const token = await getToken(supabase)
    if (!token) throw new Error('Token do e-Contador não configurado')

    let empresasAlt = await listarEmpresasAlterdata(token)
    if (empresaFiltro) {
      empresasAlt = empresasAlt.filter((e) => e.id === empresaFiltro)
    }
    if (empresasAlt.length === 0) {
      throw new Error(
        empresaFiltro
          ? `Empresa ${empresaFiltro} não encontrada entre as permitidas (Plena EA / Plena Tech)`
          : 'Nenhuma empresa Plena encontrada no e-Contador com este token'
      )
    }

    // Empresas internas e colaboradores atuais carregados UMA VEZ para todas
    // as empresas do job. Colaboradores paginados em lotes de 1000 — o
    // PostgREST corta em 1000 linhas por requisição.
    const { data: empresasData, error: erroEmpresas } = await supabase
      .from('empresas')
      .select('id, nome, codigo_alterdata')
    if (erroEmpresas) throw erroEmpresas
    const empresasDB = (empresasData || []) as EmpresaDB[]

    const mapas: MapasColab = { porCpf: new Map(), porMatricula: new Map() }
    let offset = 0
    for (;;) {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('id, cpf, matricula, empresa_id')
        .range(offset, offset + PAGINA_POSTGREST - 1)
      if (error) throw error
      for (const row of (data || []) as { id: string; cpf: string | null; matricula: string | null; empresa_id: string | null }[]) {
        registrarNosMapas(mapas, {
          id: row.id,
          empresa_id: row.empresa_id,
          cpf: row.cpf,
          matricula: row.matricula,
        })
      }
      if (!data || data.length < PAGINA_POSTGREST) break
      offset += PAGINA_POSTGREST
    }
    console.log(`${mapas.porCpf.size} CPFs e ${mapas.porMatricula.size} matrículas carregados`)

    const resultados: ResultadoEmpresa[] = []
    for (const empresaAlt of empresasAlt) {
      try {
        resultados.push(await processarEmpresa(supabase, token, empresaAlt, empresasDB, mapas))
      } catch (err) {
        // Falha isolada de UMA empresa (ex.: API falhou no meio da paginação):
        // registra no histórico para não morrer em silêncio e segue para a
        // próxima empresa — falha geral continua sendo o catch externo.
        const mensagem = extrairMensagemErro(err)
        console.error(`Falha ao processar ${empresaAlt.nome}:`, err)
        await salvarHistorico(supabase, {
          empresa_id: empresaAlt.id || null,
          empresa_nome: empresaAlt.nome || null,
          quantidade: 0,
          importados: 0,
          atualizados: 0,
          erros: 1,
          detalhes_erros: [{ nome: '(job)', erro: mensagem }],
        })
        resultados.push({
          empresa: empresaAlt.nome,
          quantidade: 0,
          importados: 0,
          atualizados: 0,
          erros: 1,
        })
      }
    }

    return new Response(JSON.stringify({ ok: true, empresas: resultados }), {
      status: 200,
      headers: JSON_HEADERS,
    })
  } catch (e) {
    // Falha geral (token inválido/ausente, API Alterdata fora, erro
    // inesperado): grava no histórico — a falha precisa aparecer na tela,
    // senão o job morre em silêncio.
    console.error('sync-econtador:', e)
    const mensagem = extrairMensagemErro(e)
    await salvarHistorico(supabase, {
      empresa_id: null,
      empresa_nome: '(falha geral do job)',
      quantidade: 0,
      importados: 0,
      atualizados: 0,
      erros: 1,
      detalhes_erros: [{ nome: '(job)', erro: mensagem }],
    })
    return new Response(JSON.stringify({ error: mensagem }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
})
