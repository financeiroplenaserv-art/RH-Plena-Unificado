import { supabase } from '@/lib/supabase'

const DEFAULT_EXPIRES_IN = 15 * 60 // 15 minutos

export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = DEFAULT_EXPIRES_IN
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) {
    throw new Error(`Erro ao gerar URL assinada: ${error.message}`)
  }

  if (!data?.signedUrl) {
    throw new Error('URL assinada não retornada pelo storage')
  }

  return data.signedUrl
}

export async function getOcorrenciaAnexoUrl(path: string): Promise<string> {
  return getSignedUrl('ocorrencia-anexos', path)
}

export async function getVRArquivoUrl(path: string): Promise<string> {
  return getSignedUrl('vr-arquivos', path)
}
