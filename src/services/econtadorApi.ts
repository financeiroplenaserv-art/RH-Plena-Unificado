import { supabase } from '@/lib/supabase'
import type { EContadorEmpresa, EContadorFuncionario } from '@/types/econtador'

const REQUEST_TIMEOUT_MS = 30000

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

export const TOKEN_SALVO_NA_EDGE_FUNCTION = '[TOKEN_SALVO_NA_EDGE_FUNCTION]'

export async function carregarToken(): Promise<string> {
  // O token JWT nunca transita no frontend. Verificamos apenas, via Edge
  // Function, se existe um token cifrado salvo no banco.
  const response = await fetchEdgeFunction('token-status')
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao verificar token' }))
    throw new Error(error.error || 'Erro ao verificar token')
  }
  const { configurado } = (await response.json()) as { configurado?: boolean }
  return configurado ? TOKEN_SALVO_NA_EDGE_FUNCTION : ''
}

export async function salvarToken(token: string): Promise<void> {
  const response = await fetchEdgeFunction('salvar-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao salvar token' }))
    throw new Error(error.error || 'Erro ao salvar token')
  }
}

export async function removerToken(): Promise<void> {
  const response = await fetchEdgeFunction('remover-token', {
    method: 'POST',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao remover token' }))
    throw new Error(error.error || 'Erro ao remover token')
  }
}

export async function listarEmpresas(): Promise<EContadorEmpresa[]> {
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

export async function listarFuncionarios(
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
