import { supabase } from '@/lib/supabase'

const BUCKET = 'vr-arquivos'

export async function uploadVRArquivo(
  projetoId: string,
  tipo: 'pdf_anterior' | 'pdf_atual' | 'escala' | 'base',
  file: File
): Promise<{ path: string }> {
  const path = `${projetoId}/${tipo}/${crypto.randomUUID()}_${file.name}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: true
  })

  if (uploadError) throw uploadError

  return { path }
}
