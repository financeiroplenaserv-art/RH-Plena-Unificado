import { supabase } from '@/lib/supabase'
import { mapearFuncionario } from '@/mappers/econtadorMapper'
import type { EContadorEmpresa, EContadorFuncionario } from '@/types/econtador'

const BASE_URL = 'https://dp.pack.alterdata.com.br/api/v1'

interface EContadorResponseItem {
  id?: string
  attributes?: { nome?: string; codigo?: string }
}

export async function carregarToken(): Promise<string> {
  const { data: config } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'econtador_token')
    .single()
  return config?.valor || ''
}

export async function salvarToken(token: string): Promise<void> {
  await supabase.from('configuracoes').upsert(
    {
      chave: 'econtador_token',
      valor: token,
      descricao: 'Token JWT do eContador Alterdata',
    },
    { onConflict: 'chave' }
  )
}

async function getHeaders() {
  const token = await carregarToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/vnd.api+json',
    Accept: 'application/vnd.api+json',
  }
}

export async function listarEmpresas(): Promise<EContadorEmpresa[]> {
  const headers = await getHeaders()
  const response = await fetch(`${BASE_URL}/empresas?page[limit]=25&page[offset]=0`, { headers })
  if (!response.ok) throw new Error('Erro ao consultar empresas')

  const data = await response.json()
  const lista = (data.data || []).map((e: EContadorResponseItem) => ({
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

interface ListarFuncionariosOptions {
  status?: string
  onProgress?: (atual: number, total: number) => void
}

export async function listarFuncionarios(
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

    const response = await fetch(url, { headers })
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
