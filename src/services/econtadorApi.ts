import { supabase } from '@/lib/supabase'
import { mapearFuncionario } from '@/mappers/econtadorMapper'
import type { EContadorEmpresa, EContadorFuncionario } from '@/types/econtador'

const BASE_URL = 'https://dp.pack.alterdata.com.br/api/v1'
const REQUEST_TIMEOUT_MS = 15000

export function isModoEdgeFunction(): boolean {
  return import.meta.env.VITE_USAR_EDGE_FUNCTION_ECONTADOR === 'true'
}

function usarEdgeFunction(): boolean {
  return isModoEdgeFunction()
}

function getEdgeFunctionUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL não configurada')
  return `${supabaseUrl}/functions/v1/econtador`
}

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Usuário não autenticado')
  return data.session.access_token
}

async function fetchEdgeFunction(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken()
  const url = `${getEdgeFunctionUrl()}/${path}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

async function getHeaders() {
  const token = await carregarToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/vnd.api+json',
    Accept: 'application/vnd.api+json',
  }
}

// ============================================================
// Modo Edge Function (seguro)
// ============================================================

async function salvarTokenEdge(token: string): Promise<void> {
  const response = await fetchEdgeFunction('salvar-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao salvar token' }))
    throw new Error(error.error || 'Erro ao salvar token')
  }
}

async function listarEmpresasEdge(): Promise<EContadorEmpresa[]> {
  const response = await fetchEdgeFunction('empresas')
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao consultar empresas' }))
    throw new Error(error.error || 'Erro ao consultar empresas')
  }
  return response.json()
}

interface ListarFuncionariosOptions {
  status?: string
  onProgress?: (atual: number, total: number) => void
}

async function listarFuncionariosEdge(
  empresaId: string,
  options: ListarFuncionariosOptions = {}
): Promise<EContadorFuncionario[]> {
  const { status, onProgress } = options
  onProgress?.(0, 0)

  let url = `funcionarios?empresaId=${encodeURIComponent(empresaId)}`
  if (status) url += `&status=${encodeURIComponent(status)}`

  const response = await fetchEdgeFunction(url)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao consultar funcionários' }))
    throw new Error(error.error || 'Erro ao consultar funcionários')
  }

  const todos = (await response.json()) as EContadorFuncionario[]
  onProgress?.(todos.length, todos.length)
  return todos
}

// ============================================================
// Modo Direto (legado) - mantido para compatibilidade até o deploy
// ============================================================

export const TOKEN_SALVO_NA_EDGE_FUNCTION = '[TOKEN_SALVO_NA_EDGE_FUNCTION]'

export async function carregarToken(): Promise<string> {
  // No modo Edge Function o token JWT nunca transita no frontend.
  // Verificamos apenas se existe um token cifrado salvo no banco.
  if (isModoEdgeFunction()) {
    const { data: config } = await supabase
      .from('configuracoes')
      .select('valor_cifrado')
      .eq('chave', 'econtador_token')
      .single()
    return config?.valor_cifrado ? TOKEN_SALVO_NA_EDGE_FUNCTION : ''
  }

  const { data: config } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'econtador_token')
    .single()
  return config?.valor || ''
}

async function salvarTokenDireto(token: string): Promise<void> {
  await supabase.from('configuracoes').upsert(
    {
      chave: 'econtador_token',
      valor: token,
      descricao: 'Token JWT do eContador Alterdata',
    },
    { onConflict: 'chave' }
  )
}

async function listarEmpresasDireto(): Promise<EContadorEmpresa[]> {
  const headers = await getHeaders()
  const response = await fetchWithTimeout(`${BASE_URL}/empresas?page[limit]=25&page[offset]=0`, { headers })
  if (!response.ok) throw new Error('Erro ao consultar empresas')

  const data = await response.json()
  const lista = (data.data || []).map((e: { id?: string; attributes?: { nome?: string; codigo?: string } }) => ({
    id: String(e.id || ''),
    nome: String(e.attributes?.nome || 'Sem nome'),
    codigo: String(e.attributes?.codigo || ''),
  }))

  const permitidas = ['plena ea', 'plena tech']
  return lista.filter((e: EContadorEmpresa) => {
    const nome = (e.nome || '').toLowerCase()
    return permitidas.some((p) => nome.includes(p))
  })
}

async function listarFuncionariosDireto(
  empresaId: string,
  options: ListarFuncionariosOptions = {}
): Promise<EContadorFuncionario[]> {
  const { status, onProgress } = options
  const headers = await getHeaders()
  const todos: EContadorFuncionario[] = []
  let offset = 0
  const limit = 100
  let hasMore = true

  while (hasMore) {
    let url = `${BASE_URL}/funcionarios?filter[funcionarios][empresa.id][EQ]=${empresaId}&page[limit]=${limit}&page[offset]=${offset}&include=departamento`
    if (status) url += `&filter[funcionarios][status][EQ]=${status}`

    const response = await fetchWithTimeout(url, { headers })
    if (response.status === 401) throw new Error('Token inválido ou expirado.')
    if (response.status === 403) throw new Error('Sem permissão. Verifique se é eContador Master.')
    if (!response.ok) {
      throw new Error(`Erro ${response.status} ao consultar funcionários.`)
    }

    const data = await response.json()
    if (!data.data || data.data.length === 0) {
      break
    }

    const included = data.included || []
    todos.push(...data.data.map((item: Record<string, unknown>) => mapearFuncionario(item, included)))
    onProgress?.(todos.length, data.meta?.totalResourceCount || 0)

    if (data.links?.next) offset += limit
    else hasMore = false
    if (offset > 5000) hasMore = false
  }

  return todos
}

// ============================================================
// API pública
// ============================================================

export async function salvarToken(token: string): Promise<void> {
  if (usarEdgeFunction()) {
    return salvarTokenEdge(token)
  }
  return salvarTokenDireto(token)
}

export async function validarToken(token: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/empresas?page[limit]=1&page[offset]=0`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/vnd.api+json',
          Accept: 'application/vnd.api+json',
        },
      }
    )
    return response.ok
  } catch {
    return false
  }
}

export async function listarEmpresas(): Promise<EContadorEmpresa[]> {
  if (usarEdgeFunction()) {
    return listarEmpresasEdge()
  }
  return listarEmpresasDireto()
}

export async function listarFuncionarios(
  empresaId: string,
  options: ListarFuncionariosOptions = {}
): Promise<EContadorFuncionario[]> {
  if (usarEdgeFunction()) {
    return listarFuncionariosEdge(empresaId, options)
  }
  return listarFuncionariosDireto(empresaId, options)
}
