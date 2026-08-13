import { supabase } from '@/lib/supabase'

const BUCKET = 'ponto-espelhos'
const TABELA = 'ponto_espelho_arquivos'
const LIMITE_LISTAGEM = 10
/** Limite de tamanho do bucket ponto-espelhos (50 MB — migration 094 e teto do plano Free). */
export const LIMITE_BYTES_ESPELHO = 50 * 1024 * 1024

export interface PontoEspelhoArquivo {
  id: string
  nome_arquivo: string
  storage_path: string
  tamanho_bytes: number | null
  enviado_por: string | null
  created_at: string
  /** Nome de quem enviou (join com perfis). */
  enviado_por_nome: string | null
}

/** Lista os últimos espelhos enviados (mais recentes primeiro). */
export async function listarArquivos(): Promise<PontoEspelhoArquivo[]> {
  const { data, error } = await supabase
    .from(TABELA)
    .select('id, nome_arquivo, storage_path, tamanho_bytes, enviado_por, created_at, perfis(nome)')
    .order('created_at', { ascending: false })
    .limit(LIMITE_LISTAGEM)
  if (error) throw error
  return (data || []).map((row: Record<string, unknown>) => mapearLinha(row))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearLinha(row: any): PontoEspelhoArquivo {
  const perfil = row.perfis as { nome?: string } | null
  return {
    id: row.id as string,
    nome_arquivo: row.nome_arquivo as string,
    storage_path: row.storage_path as string,
    tamanho_bytes: (row.tamanho_bytes as number | null) ?? null,
    enviado_por: (row.enviado_por as string | null) ?? null,
    created_at: row.created_at as string,
    enviado_por_nome: perfil?.nome ?? null,
  }
}

/**
 * Procura um arquivo já enviado com o mesmo nome e tamanho — usado para
 * perguntar ao usuário se quer reutilizar o que está no servidor em vez de
 * reenviar (evita duplicar registros do mesmo espelho).
 */
export async function buscarArquivoIdentico(file: File): Promise<PontoEspelhoArquivo | null> {
  const { data, error } = await supabase
    .from(TABELA)
    .select('id, nome_arquivo, storage_path, tamanho_bytes, enviado_por, created_at, perfis(nome)')
    .eq('nome_arquivo', file.name)
    .eq('tamanho_bytes', file.size)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  if (!data || data.length === 0) return null
  return mapearLinha(data[0])
}

/**
 * Salva o PDF no bucket e registra os metadados. Com `reenviar = false`
 * (padrão), reutiliza o registro de um arquivo idêntico já existente;
 * com `reenviar = true`, sempre grava um novo registro.
 */
export async function salvarArquivo(file: File, userId: string, reenviar = false): Promise<PontoEspelhoArquivo> {
  if (file.size > LIMITE_BYTES_ESPELHO) {
    const mb = (file.size / 1024 / 1024).toFixed(1).replace('.', ',')
    throw new Error(`o PDF tem ${mb} MB e o limite do servidor é 50 MB`)
  }

  if (!reenviar) {
    const existente = await buscarArquivoIdentico(file)
    if (existente) return existente
  }

  const agora = new Date()
  const pasta = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
  const storagePath = `${pasta}/${crypto.randomUUID()}_${file.name}`

  const opcoesUpload = { contentType: 'application/pdf', upsert: false }
  let { error: erroUpload } = await supabase.storage.from(BUCKET).upload(storagePath, file, opcoesUpload)
  if (erroUpload) {
    // Espelhos têm dezenas de MB — uma nova tentativa absorve instabilidade de rede
    await new Promise((resolve) => setTimeout(resolve, 2000))
    ;({ error: erroUpload } = await supabase.storage.from(BUCKET).upload(storagePath, file, opcoesUpload))
  }
  if (erroUpload) throw erroUpload

  const { data, error: erroInsert } = await supabase
    .from(TABELA)
    .insert({
      nome_arquivo: file.name,
      storage_path: storagePath,
      tamanho_bytes: file.size,
      enviado_por: userId,
    })
    .select('id, nome_arquivo, storage_path, tamanho_bytes, enviado_por, created_at')
    .single()
  if (erroInsert) throw erroInsert
  return { ...(data as Omit<PontoEspelhoArquivo, 'enviado_por_nome'>), enviado_por_nome: null }
}

/** Baixa o PDF do bucket e devolve como File (reaproveita a pipeline de parsing). */
export async function baixarArquivo(arquivo: PontoEspelhoArquivo): Promise<File> {
  const { data, error } = await supabase.storage.from(BUCKET).download(arquivo.storage_path)
  if (error) throw error
  return new File([data], arquivo.nome_arquivo, { type: 'application/pdf' })
}

/** Remove o arquivo do bucket e o registro da tabela (apenas admin — RLS). */
export async function excluirArquivo(arquivo: PontoEspelhoArquivo): Promise<void> {
  const { error: erroStorage } = await supabase.storage.from(BUCKET).remove([arquivo.storage_path])
  if (erroStorage) throw erroStorage
  const { data, error: erroDelete } = await supabase
    .from(TABELA)
    .delete()
    .eq('id', arquivo.id)
    .select('id')
  if (erroDelete) throw erroDelete
  if (!data || data.length === 0) throw new Error('Sem permissão para excluir este arquivo')
}
