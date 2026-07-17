import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LoadingScreen } from '@/components/LoadingScreen'
import { gerarPDFOcorrencia } from '@/lib/pdf'
import { useAnexos } from '@/hooks/useAnexos'
import { getOcorrenciaAnexoUrl } from '@/lib/storage'
import { useTestemunhas } from '@/hooks/useTestemunhas'
import { useAuditoria } from '@/hooks/useAuditoria'
import { useAuth } from '@/hooks/useAuth'
import {
  podeGerarPDFOcorrencia,
  podeAprovarOcorrencia,
  podeCancelarOcorrencia,
  podeAnexarOcorrencia,
  podeAdicionarTestemunha,
  podeVerAuditoria,
  podeEditarOcorrencia,
} from '@/lib/permissoes'
import { RhShell } from './RhShell'
import {
  Paperclip,
  UserPlus,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Ocorrencia, Colaborador } from '@/types/database'
import { DetailHeader } from '@/components/ocorrencias/ocorrencia-detail/DetailHeader'
import { StatusBanner } from '@/components/ocorrencias/ocorrencia-detail/StatusBanner'
import { ColaboradorCard } from '@/components/ocorrencias/ocorrencia-detail/ColaboradorCard'
import { DadosOcorrenciaCard } from '@/components/ocorrencias/ocorrencia-detail/DadosOcorrenciaCard'
import { AnexosTab } from '@/components/ocorrencias/ocorrencia-detail/AnexosTab'
import { TestemunhasTab } from '@/components/ocorrencias/ocorrencia-detail/TestemunhasTab'
import { AuditoriaTab } from '@/components/ocorrencias/ocorrencia-detail/AuditoriaTab'

export function OcorrenciaDetailPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeGerarPDF = perfil ? podeGerarPDFOcorrencia(perfil) : false
  const podeAprovar = perfil ? podeAprovarOcorrencia(perfil) : false
  const podeCancelar = perfil ? podeCancelarOcorrencia(perfil) : false
  const podeAnexar = perfil ? podeAnexarOcorrencia(perfil) : false
  const podeTestemunha = perfil ? podeAdicionarTestemunha(perfil) : false
  const podeAuditoria = perfil ? podeVerAuditoria(perfil) : false
  const podeEditar = perfil ? podeEditarOcorrencia(perfil) : false

  const { id } = useParams<{ id: string }>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [ocorrencia, setOcorrencia] = useState<Ocorrencia | null>(null)
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [empresa, setEmpresa] = useState<{ nome: string; cnpj: string | null } | null>(null)
  const [mostrarCancelar, setMostrarCancelar] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ativando, setAtivando] = useState(false)

  const [descricaoUpload, setDescricaoUpload] = useState('')

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

    const COLUNAS_OCORRENCIA_DETALHE = `id, colaborador_id, empresa_id, colaborador_nome, tipo_ocorrencia, macro_grupo, titulo, data_ocorrencia, descricao, status, tipo_penalidade, base_legal, gravidade, data_hora_ocorrido, local_ocorrido, defesa_funcionario, medida_corretiva, prazo_acompanhamento, testemunha_1_nome, testemunha_1_cargo, testemunha_2_nome, testemunha_2_cargo, usuario_id, created_at, updated_at`

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

    await uploadAnexo(id, file, descricaoUpload || undefined)
    setDescricaoUpload('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    loadData()
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
    setMostrarCancelar(false)
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

  if (loading) {
    return <LoadingScreen mensagem="Carregando ocorrência..." />
  }

  if (!ocorrencia) {
    return <div className="text-center py-8 text-sm text-slate-400">Ocorrência não encontrada</div>
  }

  const isPendente = ocorrencia.status === 'Pendente'
  const isCancelada = ocorrencia.status === 'Cancelada'

  return (
    <RhShell>
      <DetailHeader
        ocorrencia={ocorrencia}
        colaborador={colaborador}
        podeGerarPDF={podeGerarPDF}
        podeEditar={podeEditar}
        podeAprovar={podeAprovar}
        podeCancelar={podeCancelar}
        ativando={ativando}
        anexosCount={anexos.length}
        onGerarPDF={handleGerarPDF}
        onAtivar={handleAtivar}
        onCancelar={() => setMostrarCancelar(true)}
      />

      <StatusBanner ocorrencia={ocorrencia} anexosCount={anexos.length} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <ColaboradorCard
            colaborador={colaborador}
            colaboradorNomeFallback={ocorrencia.colaborador_nome}
          />
          <DadosOcorrenciaCard ocorrencia={ocorrencia} empresa={empresa} />
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="anexos" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="anexos" className="gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Documentos ({anexos.length})
              </TabsTrigger>
              <TabsTrigger value="testemunhas" className="gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Testemunhas ({testemunhas.length})
              </TabsTrigger>
              {podeAuditoria && (
                <TabsTrigger value="auditoria" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Auditoria
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="anexos">
              <AnexosTab
                anexos={anexos}
                urlsAssinadas={urlsAssinadas}
                loadingAnexos={loadingAnexos}
                podeAnexar={podeAnexar}
                isPendente={isPendente}
                isCancelada={isCancelada}
                descricaoUpload={descricaoUpload}
                fileInputRef={fileInputRef}
                onDescricaoUploadChange={setDescricaoUpload}
                onFileSelect={handleFileSelect}
                onRemoverAnexo={removerAnexo}
              />
            </TabsContent>

            <TabsContent value="testemunhas">
              <TestemunhasTab
                testemunhas={testemunhas}
                loadingTest={loadingTest}
                podeTestemunha={podeTestemunha}
                isCancelada={isCancelada}
                mostrarFormTestemunha={mostrarFormTestemunha}
                novaTestemunha={novaTestemunha}
                onToggleForm={() => setMostrarFormTestemunha((prev) => !prev)}
                onNovaTestemunhaChange={handleNovaTestemunhaChange}
                onSalvarTestemunha={handleAddTestemunha}
                onRemoverTestemunha={removerTestemunha}
              />
            </TabsContent>

            <TabsContent value="auditoria">
              <AuditoriaTab logs={logs} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={mostrarCancelar} onOpenChange={setMostrarCancelar}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Cancelar ocorrência?</DialogTitle>
            <DialogDescription className="text-xs">
              A ocorrência será mantida no histórico com status "Cancelada".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setMostrarCancelar(false)}>
              Voltar
            </Button>
            <Button variant="destructive" size="sm" onClick={handleCancelar}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RhShell>
  )
}
