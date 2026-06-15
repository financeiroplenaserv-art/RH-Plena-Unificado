import { supabase } from '@/lib/supabase'

const BUCKET = 'vr-arquivos'

export async function uploadVRArquivo(
  projetoId: string,
  tipo: 'pdf_anterior' | 'pdf_atual' | 'escala' | 'base',
  file: File
): Promise<{ path: string; url: string }> {
  const path = `${projetoId}/${tipo}/${crypto.randomUUID()}_${file.name}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: true
  })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { path, url: data.publicUrl }
}

export async function removerVRArquivo(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
