import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { OcorrenciaAnexo, TipoDocumentoAnexo } from '@/types/database'

const COLUNAS_ANEXO = 'id, ocorrencia_id, nome_arquivo, tipo_arquivo, tamanho_bytes, descricao, tipo_documento, caminho_storage, url_publica, usuario_id, created_at'

const BUCKET_NAME = 'ocorrencia-anexos'

export function useAnexos() {
  const [anexos, setAnexos] = useState<OcorrenciaAnexo[]>([])
  const [loading, setLoading] = useState(false)

  const loadAnexos = useCallback(async (ocorrenciaId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ocorrencia_anexos')
      .select(COLUNAS_ANEXO)
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
    async (ocorrenciaId: string, file: File, descricao?: string, tipoDocumento?: TipoDocumentoAnexo) => {
      // Arquivo vazio (0 bytes): comum com foto ainda sincronizando da nuvem
      // (iCloud/OneDrive) ou download interrompido — subir assim grava um
      // objeto ilegível no bucket (página em branco ao abrir).
      if (file.size === 0) {
        toast.error(
          'O arquivo está vazio (0 bytes). Verifique se ele abre no computador antes de enviar — se estiver na nuvem (iCloud/OneDrive), baixe-o primeiro.'
        )
        return null
      }

      const ext = file.name.split('.').pop() || ''
      const nomeGerado = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${ext}`
      const path = `${ocorrenciaId}/${nomeGerado}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, { upsert: true })

      if (uploadError) {
        toast.error('Erro ao enviar arquivo: ' + uploadError.message)
        return null
      }

      // Confere se o objeto foi gravado íntegro (tamanho igual ao enviado).
      // Sem isso, um upload truncado/vazio virava anexo listado mas ilegível.
      const { data: objetos, error: erroListagem } = await supabase.storage
        .from(BUCKET_NAME)
        .list(ocorrenciaId, { search: nomeGerado })
      const objeto = objetos?.find((o) => o.name === nomeGerado)
      const tamanhoGravado = (objeto?.metadata as { size?: number } | null | undefined)?.size
      if (erroListagem || !objeto || (typeof tamanhoGravado === 'number' && tamanhoGravado !== file.size)) {
        await supabase.storage.from(BUCKET_NAME).remove([path])
        toast.error(
          'O arquivo não foi gravado corretamente. Tente enviar novamente — se estiver na nuvem (iCloud/OneDrive), baixe-o primeiro.'
        )
        return null
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const { data, error } = await supabase
        .from('ocorrencia_anexos')
        .insert({
          ocorrencia_id: ocorrenciaId,
          nome_arquivo: file.name,
          tipo_arquivo: file.type || 'application/octet-stream',
          tamanho_bytes: file.size,
          descricao: descricao || null,
          tipo_documento: tipoDocumento || 'comprovante',
          caminho_storage: path,
          url_publica: null,
          usuario_id: session?.user?.id ?? null,
        })
        .select(COLUNAS_ANEXO)
        .single()

      if (error) {
        // Desfaz o upload: sem isso o arquivo ficava órfão no bucket (sem
        // linha na tabela) — o anexo "sumia" sem ninguém notar.
        await supabase.storage.from(BUCKET_NAME).remove([path])
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

    // .select('id') após o delete: DELETE bloqueado por RLS retorna 0 linhas
    // SEM erro — sem essa checagem o toast fingiria sucesso.
    const { data, error } = await supabase
      .from('ocorrencia_anexos')
      .delete()
      .eq('id', anexo.id)
      .select('id')

    if (error) {
      toast.error('Erro ao remover anexo: ' + error.message)
      return false
    }

    if (!data || data.length === 0) {
      toast.error('Sem permissão para remover este anexo')
      return false
    }

    setAnexos((prev) => prev.filter((a) => a.id !== anexo.id))
    toast.success('Anexo removido')
    return true
  }, [])

  return { anexos, loading, loadAnexos, uploadAnexo, removerAnexo }
}
