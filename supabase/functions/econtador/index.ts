// Edge Function: econtador
//
// Responsável por toda a comunicação segura com a API Alterdata e-Contador.
// O token JWT nunca transita no frontend. Ele é criptografado nesta Edge Function
// e armazenado cifrado no banco.
//
// Variáveis de ambiente necessárias:
//   - ENCRYPTION_KEY: chave AES-256 em hexadecimal (64 caracteres hex)
//
// Endpoints:
//   POST /salvar-token       -> recebe { token }, criptografa e salva
//   GET  /empresas           -> lista empresas permitidas
//   GET  /funcionarios       -> lista funcionarios (query: empresaId, status)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'

const BASE_URL = 'https://dp.pack.alterdata.com.br/api/v1'
const PERMITIDAS = ['plena ea', 'plena tech']
const ALTERDATA_TIMEOUT_MS = 60000
const EDGE_TIMEOUT_MS = 60000

// Controle simples de rate limiting em memória (por usuário)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60_000

function getAllowedOrigins(): string[] {
  const env = Deno.env.get('ALLOWED_ORIGINS')
  if (!env) return []
  return env.split(',').map((o) => o.trim()).filter(Boolean)
}

function isOriginAllowed(origin: string): boolean {
  const allowed = getAllowedOrigins()
  if (allowed.length === 0) return true
  return allowed.includes(origin)
}

function getCorsHeaders(origin: string): Record<string, string> {
  const allowOrigin = isOriginAllowed(origin) ? origin : getAllowedOrigins()[0] || ''
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  }
}

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  entry.count++
  return { allowed: true }
}

interface EContadorResponseItem {
  id?: string
  attributes?: { nome?: string; codigo?: string }
}

// ============================================================
// Utilitários de criptografia (Web Crypto API)
// ============================================================

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes.buffer
}

async function criptografar(texto: string, chaveHex: string): Promise<{ ciphertext: string; iv: string; tag: string }> {
  const chave = await crypto.subtle.importKey(
    'raw',
    hexToBuffer(chaveHex),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(texto)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, encoded)

  // AES-GCM no Web Crypto retorna ciphertext + tag concatenados (tag nos últimos 16 bytes)
  const combined = new Uint8Array(ciphertext)
  const tagLength = 16
  const data = combined.slice(0, combined.length - tagLength)
  const tag = combined.slice(combined.length - tagLength)

  return {
    ciphertext: btoa(String.fromCharCode(...data)),
    iv: btoa(String.fromCharCode(...iv)),
    tag: btoa(String.fromCharCode(...tag)),
  }
}

async function descriptografar(ciphertext: string, iv: string, tag: string, chaveHex: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    hexToBuffer(chaveHex),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  const data = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const tagBytes = Uint8Array.from(atob(tag), c => c.charCodeAt(0))
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))

  const combined = new Uint8Array(data.length + tagBytes.length)
  combined.set(data, 0)
  combined.set(tagBytes, data.length)

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, chave, combined)
  return new TextDecoder().decode(decrypted)
}

// ============================================================
// Supabase client com service_role
// ============================================================

function getSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRole) {
    throw new Error('Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas')
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function getTokenCifrado(): Promise<{ valor_cifrado: string; iv: string; tag: string } | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('configuracoes')
    .select('valor_cifrado, iv, tag')
    .eq('chave', 'econtador_token')
    .single()

  if (error || !data?.valor_cifrado) return null
  return data as { valor_cifrado: string; iv: string; tag: string }
}

async function getToken(): Promise<string | null> {
  const chave = Deno.env.get('ENCRYPTION_KEY')
  if (!chave) throw new Error('ENCRYPTION_KEY não configurada')

  const cifrado = await getTokenCifrado()
  if (!cifrado) return null

  return descriptografar(cifrado.valor_cifrado, cifrado.iv, cifrado.tag, chave)
}

// ============================================================
// Helpers da API Alterdata
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

// ============================================================
// Handlers
// ============================================================

async function salvarToken(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.token !== 'string' || !body.token.trim()) {
    return new Response(JSON.stringify({ error: 'Token não informado' }), { status: 400 })
  }

  const chave = Deno.env.get('ENCRYPTION_KEY')
  if (!chave) {
    return new Response(JSON.stringify({ error: 'ENCRYPTION_KEY não configurada' }), { status: 500 })
  }

  // Valida o token antes de salvar
  try {
    await fetchAlterdata('/empresas?page[limit]=1&page[offset]=0', body.token.trim())
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Token inválido ou API indisponível: ' + (err instanceof Error ? err.message : 'erro') }), { status: 400 })
  }

  const cifrado = await criptografar(body.token.trim(), chave)
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('configuracoes')
    .upsert(
      {
        chave: 'econtador_token',
        valor: '[CRIPTOGRAFADO_NA_EDGE_FUNCTION]',
        descricao: 'Token JWT do eContador Alterdata (gerenciado pela Edge Function)',
        valor_cifrado: cifrado.ciphertext,
        iv: cifrado.iv,
        tag: cifrado.tag,
      },
      { onConflict: 'chave' }
    )

  if (error) {
    return new Response(JSON.stringify({ error: 'Erro ao salvar token: ' + error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}

async function listarEmpresas(): Promise<Response> {
  const token = await getToken()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Token do e-Contador não configurado' }), { status: 400 })
  }

  const data = await fetchAlterdata('/empresas?page[limit]=25&page[offset]=0', token) as { data?: EContadorResponseItem[] }
  const lista = (data.data || []).map((e) => ({
    id: String(e.id || ''),
    nome: String(e.attributes?.nome || 'Sem nome'),
    codigo: String(e.attributes?.codigo || ''),
  }))

  const permitidas = lista.filter((e) => {
    const nome = (e.nome || '').toLowerCase()
    return PERMITIDAS.some((p) => nome.includes(p))
  })

  return new Response(JSON.stringify(permitidas), { status: 200 })
}

interface FuncionarioAttributes {
  nome?: string
  status?: string
  [key: string]: unknown
}

interface FuncionarioItem {
  id?: string
  attributes?: FuncionarioAttributes
  relationships?: { departamento?: { data?: { id?: string } } }
}

function mapearFuncionario(item: FuncionarioItem, included: unknown[]): Record<string, unknown> {
  const attrs = item.attributes || {}
  const deptId = item.relationships?.departamento?.data?.id
  const departamento = deptId
    ? (included as Array<{ id?: string; attributes?: { nome?: string } }>).find((i) => i.id === deptId)
    : null

  return {
    id: String(item.id || ''),
    ...attrs,
    departamento: departamento?.attributes?.nome || attrs.departamento || null,
  }
}

async function listarFuncionarios(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const empresaId = url.searchParams.get('empresaId')
  const status = url.searchParams.get('status') || undefined

  if (!empresaId) {
    return new Response(JSON.stringify({ error: 'empresaId é obrigatório' }), { status: 400 })
  }

  const token = await getToken()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Token do e-Contador não configurado' }), { status: 400 })
  }

  const todos: Record<string, unknown>[] = []
  let offset = 0
  const limit = 100
  let hasMore = true

  while (hasMore) {
    let path = `/funcionarios?filter[funcionarios][empresa.id][EQ]=${empresaId}&page[limit]=${limit}&page[offset]=${offset}&include=departamento`
    if (status) path += `&filter[funcionarios][status][EQ]=${status}`

    const data = await fetchAlterdata(path, token) as {
      data?: FuncionarioItem[]
      included?: unknown[]
      links?: { next?: string }
      meta?: { totalResourceCount?: number }
    }

    if (!data.data || data.data.length === 0) break

    const included = data.included || []
    todos.push(...data.data.map((item) => mapearFuncionario(item, included)))

    if (data.links?.next) offset += limit
    else hasMore = false
  }

  return new Response(JSON.stringify(todos), { status: 200 })
}

// ============================================================
// Entrypoint
// ============================================================

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || ''
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verifica autenticação
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: corsHeaders })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS)

  try {
    const supabase = getSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers: corsHeaders })
    }

    // Rate limiting por usuário
    const rate = checkRateLimit(user.id)
    if (!rate.allowed) {
      return new Response(
        JSON.stringify({ error: 'Muitas requisições. Tente novamente em instantes.' }),
        { status: 429, headers: { ...corsHeaders, 'Retry-After': String(rate.retryAfter) } }
      )
    }

    // Verifica permissão (admin/adm, dp1 ou dp2)
    const { data: perfil } = await supabase
      .from('perfis')
      .select('nivel_acesso')
      .eq('id', user.id)
      .single()

    if (!perfil || !['admin', 'adm', 'dp1', 'dp2'].includes(perfil.nivel_acesso)) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), { status: 403, headers: corsHeaders })
    }

    const url = new URL(req.url)
    const path = url.pathname.replace(/^\/econtador/, '').replace(/^\//, '')

    let response: Response
    if (path === 'salvar-token' && req.method === 'POST') {
      response = await salvarToken(req)
    } else if (path === 'empresas' && req.method === 'GET') {
      response = await listarEmpresas()
    } else if (path === 'funcionarios' && req.method === 'GET') {
      response = await listarFuncionarios(req)
    } else {
      response = new Response(JSON.stringify({ error: 'Endpoint não encontrado' }), { status: 404 })
    }

    // Adiciona CORS na resposta
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    return response
  } catch (err) {
    console.error('Erro na Edge Function econtador:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro interno' }),
      { status: 500, headers: corsHeaders }
    )
  } finally {
    clearTimeout(timeoutId)
  }
})
