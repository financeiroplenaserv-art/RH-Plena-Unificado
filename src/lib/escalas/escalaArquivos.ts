import { supabase } from '@/lib/supabase'

const BUCKET = 'escala-arquivos'
const TABELA = 'escala_arquivos'
const LIMITE_LISTAGEM = 10

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MIME_XLS = 'application/vnd.ms-excel'

/**
 * crypto.randomUUID não existe em navegadores antigos — sem este fallback o
 * upload falhava em silêncio para quem usava um browser desatualizado.
 */
function idUnico(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

/** Nome seguro para a chave do storage (acentos e caracteres especiais podem ser rejeitados pelo bucket). */
function nomeSeguro(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
}

export interface EscalaArquivo {
  id: string
  nome_arquivo: string
  storage_path: string
  tamanho_bytes: number | null
  enviado_por: string | null
  created_at: string
  /** Nome de quem enviou (join com perfis). */
  enviado_por_nome: string | null
}

function mimePorNome(nome: string): string {
  return nome.toLowerCase().endsWith('.xls') ? MIME_XLS : MIME_XLSX
}

/** Lista os últimos Excels de escala enviados (mais recentes primeiro). */
export async function listarArquivos(): Promise<EscalaArquivo[]> {
  const { data, error } = await supabase
    .from(TABELA)
    .select('id, nome_arquivo, storage_path, tamanho_bytes, enviado_por, created_at, perfis(nome)')
    .order('created_at', { ascending: false })
    .limit(LIMITE_LISTAGEM)
  if (error) throw error
  return (data || []).map((row: Record<string, unknown>) => mapearLinha(row))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearLinha(row: any): EscalaArquivo {
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
 * não duplicar registros do mesmo Excel no servidor.
 */
export async function buscarArquivoIdentico(file: File): Promise<EscalaArquivo | null> {
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
 * Salva o Excel no bucket e registra os metadados. Se já existir um arquivo
 * idêntico (mesmo nome e tamanho), reutiliza o registro existente.
 */
export async function salvarArquivo(file: File, userId: string): Promise<EscalaArquivo> {
  const existente = await buscarArquivoIdentico(file)
  if (existente) return existente

  const agora = new Date()
  const pasta = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
  const storagePath = `${pasta}/${idUnico()}_${nomeSeguro(file.name)}`

  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type || mimePorNome(file.name),
    upsert: false,
  })
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
  return { ...(data as Omit<EscalaArquivo, 'enviado_por_nome'>), enviado_por_nome: null }
}

/** Baixa o Excel do bucket e devolve como File (reaproveita a pipeline de parsing). */
export async function baixarArquivo(arquivo: EscalaArquivo): Promise<File> {
  const { data, error } = await supabase.storage.from(BUCKET).download(arquivo.storage_path)
  if (error) throw error
  return new File([data], arquivo.nome_arquivo, { type: mimePorNome(arquivo.nome_arquivo) })
}

/** Remove o arquivo do bucket e o registro da tabela (apenas admin — RLS). */
export async function excluirArquivo(arquivo: EscalaArquivo): Promise<void> {
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
