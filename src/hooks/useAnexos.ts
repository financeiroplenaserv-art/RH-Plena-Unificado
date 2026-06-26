import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { getOcorrenciaAnexoUrl } from '@/lib/storage'
import type { OcorrenciaAnexo } from '@/types/database'

const BUCKET_NAME = 'ocorrencia-anexos'

export function useAnexos() {
  const [anexos, setAnexos] = useState<OcorrenciaAnexo[]>([])
  const [loading, setLoading] = useState(false)

  const loadAnexos = useCallback(async (ocorrenciaId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ocorrencia_anexos')
      .select('*')
      .eq('ocorrencia_id', ocorrenciaId)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Erro ao carregar anexos: ' + error.message)
    } else {
      setAnexos((data as OcorrenciaAnexo[]) || [])
    }
    setLoading(false)
  }, [])

  const uploadAnexo = useCallback(
    async (ocorrenciaId: string, file: File, descricao?: string) => {
      const ext = file.name.split('.').pop() || ''
      const path = `${ocorrenciaId}/${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, { upsert: true })

      if (uploadError) {
        toast.error('Erro ao enviar arquivo: ' + uploadError.message)
        return null
      }

      const { data, error } = await supabase
        .from('ocorrencia_anexos')
        .insert({
          ocorrencia_id: ocorrenciaId,
          nome_arquivo: file.name,
          tipo_arquivo: file.type || 'application/octet-stream',
          tamanho_bytes: file.size,
          descricao: descricao || null,
          caminho_storage: path,
          url_publica: null,
        })
        .select()
        .single()

      if (error) {
        toast.error('Erro ao salvar anexo: ' + error.message)
        return null
      }

      setAnexos((prev) => [data as OcorrenciaAnexo, ...prev])
      toast.success('Anexo enviado')
      return data as OcorrenciaAnexo
    },
    []
  )

  const removerAnexo = useCallback(async (anexo: OcorrenciaAnexo) => {
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([anexo.caminho_storage])

    if (storageError) {
      console.warn('Erro ao remover arquivo do storage:', storageError.message)
    }

    const { error } = await supabase
      .from('ocorrencia_anexos')
      .delete()
      .eq('id', anexo.id)

    if (error) {
      toast.error('Erro ao remover anexo: ' + error.message)
      return false
    }

    setAnexos((prev) => prev.filter((a) => a.id !== anexo.id))
    toast.success('Anexo removido')
    return true
  }, [])

  const gerarUrlAssinada = useCallback(async (caminhoStorage: string) => {
    return getOcorrenciaAnexoUrl(caminhoStorage)
  }, [])

  return { anexos, loading, loadAnexos, uploadAnexo, removerAnexo, gerarUrlAssinada }
}
