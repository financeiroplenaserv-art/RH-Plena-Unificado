import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { gerarPDFOcorrencia } from '@/lib/pdf'
import { useAnexos } from '@/hooks/useAnexos'
import { getOcorrenciaAnexoUrl } from '@/lib/storage'
import { useTestemunhas } from '@/hooks/useTestemunhas'
import { useAuditoria } from '@/hooks/useAuditoria'
import type { Ocorrencia, Colaborador, FormaAssinaturaOcorrencia, TipoDocumentoAnexo } from '@/types/database'

const COLUNAS_OCORRENCIA_DETALHE = `id, colaborador_id, empresa_id, colaborador_nome, tipo_ocorrencia, macro_grupo, titulo, data_ocorrencia, descricao, status, tipo_penalidade, base_legal, gravidade, data_hora_ocorrido, local_ocorrido, defesa_funcionario, medida_corretiva, prazo_acompanhamento, testemunha_1_nome, testemunha_1_cargo, testemunha_2_nome, testemunha_2_cargo, forma_assinatura, usuario_id, created_at, updated_at`

export function useOcorrenciaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [ocorrencia, setOcorrencia] = useState<Ocorrencia | null>(null)
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [empresa, setEmpresa] = useState<{ nome: string; cnpj: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [ativando, setAtivando] = useState(false)

  const [descricaoUpload, setDescricaoUpload] = useState('')
  const [tipoDocumentoUpload, setTipoDocumentoUpload] = useState<TipoDocumentoAnexo>('comprovante')
  const [salvandoAssinatura, setSalvandoAssinatura] = useState(false)

  const { anexos, loading: loadingAnexos, loadAnexos, uploadAnexo, removerAnexo } = useAnexos()
  const [urlsAssinadas, setUrlsAssinadas] = useState<Record<string, string>>({})
  const {
    testemunhas,
    loading: loadingTest,
    loadTestemunhas,
    adicionarTestemunha,
    removerTestemunha,
  } = useTestemunhas()
  const { logs, loadLogs } = useAuditoria()

  const [novaTestemunha, setNovaTestemunha] = useState({
    nome: '',
    cargo: '',
    departamento: '',
    cpf: '',
  })
  const [mostrarFormTestemunha, setMostrarFormTestemunha] = useState(false)

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const { data: ocorData } = await supabase
      .from('ocorrencias')
      .select(COLUNAS_OCORRENCIA_DETALHE)
      .eq('id', id)
      .single()

    if (ocorData) {
      const o = ocorData as Ocorrencia
      setOcorrencia(o)

      const { data: colabData } = await supabase
        .from('colaboradores')
        .select('id, matricula, nome_completo, cpf, rg, ctps, pis_pasep, data_admissao, data_demissao, data_nascimento, cargo, departamento, departamento_id, email, telefone, celular, cidade, estado, cep, endereco, status, tipo_contrato, empresa_id, afastamento_motivo, afastamento_data_inicio, afastamento_data_fim, tamanho_camisa, tamanho_calca, tamanho_calcado, created_at, updated_at')
        .eq('id', o.colaborador_id)
        .single()
      if (colabData) setColaborador(colabData as Colaborador)

      if (o.empresa_id) {
        const { data: empData } = await supabase
          .from('empresas')
          .select('nome, cnpj')
          .eq('id', o.empresa_id)
          .single()
        if (empData) setEmpresa(empData as { nome: string; cnpj: string | null })
      } else if (colabData?.empresa_id) {
        const { data: empData } = await supabase
          .from('empresas')
          .select('nome, cnpj')
          .eq('id', colabData.empresa_id)
          .single()
        if (empData) setEmpresa(empData as { nome: string; cnpj: string | null })
      }

      loadAnexos(id)
      loadTestemunhas(id)
      loadLogs({ tabela: 'ocorrencias', registroId: id })
    }
    setLoading(false)
  }, [id, loadAnexos, loadTestemunhas, loadLogs])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!anexos.length) {
      setUrlsAssinadas({})
      return
    }

    let cancelado = false
    const gerar = async () => {
      const urls: Record<string, string> = {}
      await Promise.all(
        anexos.map(async (a) => {
          try {
            urls[a.id] = await getOcorrenciaAnexoUrl(a.caminho_storage)
          } catch (err) {
            console.error(`Erro ao gerar URL assinada para anexo ${a.id}:`, err)
          }
        })
      )
      if (!cancelado) setUrlsAssinadas(urls)
    }

    gerar()
    return () => {
      cancelado = true
    }
  }, [anexos])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return

    const isVideo = file.type.startsWith('video/')
    const isAudio = file.type.startsWith('audio/')
    const maxSize = isVideo ? 100 * 1024 * 1024 : isAudio ? 20 * 1024 * 1024 : 10 * 1024 * 1024

    if (file.size > maxSize) {
      toast.error(`Arquivo muito grande. Máximo ${isVideo ? '100MB' : isAudio ? '20MB' : '10MB'}.`)
      return
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/avi',
      'video/x-ms-wmv',
      'video/webm',
      'video/x-matroska',
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/ogg',
      'audio/aac',
      'audio/mp4',
      'audio/x-m4a',
      'audio/webm',
    ]
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo não permitido. Use PDF, JPG, PNG, DOC, XLS, TXT, MP4, MOV, MP3, WAV, OGG ou AAC.')
      return
    }

    await uploadAnexo(id, file, descricaoUpload || undefined, tipoDocumentoUpload)
    setDescricaoUpload('')
    setTipoDocumentoUpload('comprovante')
    if (fileInputRef.current) fileInputRef.current.value = ''
    loadData()
  }

  const handleFormaAssinaturaChange = async (forma: FormaAssinaturaOcorrencia | null) => {
    if (!id || !ocorrencia) return

    setSalvandoAssinatura(true)
    const { error } = await supabase
      .from('ocorrencias')
      .update({ forma_assinatura: forma })
      .eq('id', id)

    if (error) {
      toast.error('Erro ao salvar forma de assinatura: ' + error.message)
    } else {
      setOcorrencia((prev) => (prev ? { ...prev, forma_assinatura: forma } : null))
      toast.success('Forma de assinatura registrada')
    }
    setSalvandoAssinatura(false)
  }

  const handleAtivar = async () => {
    if (!id || !ocorrencia) return

    if (anexos.length === 0) {
      toast.error('Não é possível ativar sem documentos anexados. Anexe os comprovantes primeiro.')
      return
    }

    setAtivando(true)
    const { error } = await supabase.from('ocorrencias').update({ status: 'Ativa' }).eq('id', id)

    if (error) {
      toast.error('Erro ao ativar: ' + error.message)
    } else {
      toast.success('Ocorrência ativada com sucesso')
      setOcorrencia((prev) => (prev ? { ...prev, status: 'Ativa' } : null))
    }
    setAtivando(false)
  }

  const handleCancelar = async () => {
    if (!id || !ocorrencia) return

    const { error } = await supabase.from('ocorrencias').update({ status: 'Cancelada' }).eq('id', id)

    if (error) toast.error('Erro ao cancelar: ' + error.message)
    else {
      toast.success('Ocorrência cancelada')
      setOcorrencia((prev) => (prev ? { ...prev, status: 'Cancelada' } : null))
    }
  }

  const handleAddTestemunha = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !novaTestemunha.nome.trim()) return

    await adicionarTestemunha({
      ocorrencia_id: id,
      nome: novaTestemunha.nome,
      cargo: novaTestemunha.cargo || null,
      departamento: novaTestemunha.departamento || null,
      cpf: novaTestemunha.cpf || null,
    })
    setNovaTestemunha({ nome: '', cargo: '', departamento: '', cpf: '' })
    setMostrarFormTestemunha(false)
  }

  const handleNovaTestemunhaChange = (
    field: keyof typeof novaTestemunha,
    value: string
  ) => {
    setNovaTestemunha((prev) => ({ ...prev, [field]: value }))
  }

  const handleGerarPDF = async () => {
    if (colaborador && ocorrencia) {
      const emp = empresa
        ? { nome: empresa.nome || undefined, cnpj: empresa.cnpj || undefined }
        : undefined
      await gerarPDFOcorrencia(colaborador, ocorrencia, anexos, testemunhas, emp)
    }
  }

  return {
    id,
    ocorrencia,
    colaborador,
    empresa,
    loading,
    ativando,
    salvandoAssinatura,
    anexos,
    loadingAnexos,
    removerAnexo,
    urlsAssinadas,
    testemunhas,
    loadingTest,
    removerTestemunha,
    logs,
    descricaoUpload,
    tipoDocumentoUpload,
    fileInputRef,
    novaTestemunha,
    mostrarFormTestemunha,
    setDescricaoUpload,
    setTipoDocumentoUpload,
    setMostrarFormTestemunha,
    handleFileSelect,
    handleFormaAssinaturaChange,
    handleAtivar,
    handleCancelar,
    handleAddTestemunha,
    handleNovaTestemunhaChange,
    handleGerarPDF,
  }
}
