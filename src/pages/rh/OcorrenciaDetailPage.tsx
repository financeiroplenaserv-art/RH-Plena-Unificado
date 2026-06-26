import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BadgeStatus } from '@/components/BadgeStatus'
import { LoadingScreen } from '@/components/LoadingScreen'
import { gerarPDFOcorrencia } from '@/lib/pdf'
import { useAnexos } from '@/hooks/useAnexos'
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
} from '@/lib/permissoes'
import {
  ArrowLeft,
  Printer,
  AlertTriangle,
  Paperclip,
  Upload,
  Trash2,
  CheckCircle,
  XCircle,
  UserPlus,
  FileText,
  Eye,
  Clock,
  Video,
  Headphones,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Ocorrencia, Colaborador } from '@/types/database'

const TIPOS_COM_DOCUMENTO_OBRIGATORIO = [
  'Advertência Escrita',
  'Suspensão 1 (1ª ocorrência)',
  'Suspensão 2 (reincidência)',
  'Suspensão 3 (3ª ocorrência)',
  'Justa Causa',
  'Conduta Inadequada',
  'Insubordinação',
  'Infração de Segurança',
  'Assédio Moral',
  'Assédio Sexual',
  'Abandono de Emprego',
  'Discriminação',
  'Furto/Roubo',
  'Violação de Sigilo',
  'Dano ao Patrimônio',
  'Recusa de Tarefa',
]

export function OcorrenciaDetailPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeGerarPDF = perfil ? podeGerarPDFOcorrencia(perfil) : false
  const podeAprovar = perfil ? podeAprovarOcorrencia(perfil) : false
  const podeCancelar = perfil ? podeCancelarOcorrencia(perfil) : false
  const podeAnexar = perfil ? podeAnexarOcorrencia(perfil) : false
  const podeTestemunha = perfil ? podeAdicionarTestemunha(perfil) : false
  const podeAuditoria = perfil ? podeVerAuditoria(perfil) : false

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
      .select('*, colaborador:colaborador_id(*)')
      .eq('id', id)
      .single()

    if (ocorData) {
      const o = ocorData as Ocorrencia
      setOcorrencia(o)

      const { data: colabData } = await supabase
        .from('colaboradores')
        .select('*')
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
    // Carrega dados da ocorrência

    loadData()
  }, [loadData])

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

  const handleGerarPDF = async () => {
    if (colaborador && ocorrencia) {
      const emp = empresa
        ? { nome: empresa.nome || undefined, cnpj: empresa.cnpj || undefined }
        : undefined
      await gerarPDFOcorrencia(colaborador, ocorrencia, anexos, testemunhas, emp)
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')
  const fmtDateTime = (d: string) => new Date(d).toLocaleString('pt-BR')

  if (loading) {
    return <LoadingScreen mensagem="Carregando ocorrência..." />
  }

  if (!ocorrencia || !colaborador) {
    return <div className="text-center py-8 text-sm text-slate-400">Ocorrência não encontrada</div>
  }

  const isPendente = ocorrencia.status === 'Pendente'
  const isAtiva = ocorrencia.status === 'Ativa'
  const isCancelada = ocorrencia.status === 'Cancelada'

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/rh/ocorrencias')}
            className="gap-1 h-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">
                {ocorrencia.titulo || `Ocorrência #${ocorrencia.id?.substring(0, 8).toUpperCase()}`}
              </h2>
              <BadgeStatus status={ocorrencia.status} />
            </div>
            <p className="text-xs text-slate-500">
              #{ocorrencia.id?.substring(0, 8).toUpperCase()} | {ocorrencia.tipo_ocorrencia} |{' '}
              {fmtDate(ocorrencia.data_ocorrencia)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {podeGerarPDF && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGerarPDF}
              className="gap-1 text-xs h-8"
            >
              <Printer className="h-3.5 w-3.5" /> Gerar PDF
            </Button>
          )}
          {isPendente &&
            podeAprovar &&
            TIPOS_COM_DOCUMENTO_OBRIGATORIO.includes(ocorrencia.tipo_penalidade || '') && (
              <Button
                size="sm"
                onClick={handleAtivar}
                disabled={ativando || anexos.length === 0}
                className="gap-1 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                title={anexos.length === 0 ? 'Anexe documentos para ativar' : 'Ativar ocorrência'}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {ativando ? 'Ativando...' : 'Ativar'}
              </Button>
            )}
          {(isPendente || isAtiva) && podeCancelar && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMostrarCancelar(true)}
              className="gap-1 text-xs h-8 text-red-600 border-red-200 hover:bg-red-50"
            >
              <XCircle className="h-3.5 w-3.5" /> Cancelar
            </Button>
          )}
        </div>
      </div>

      {isPendente && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800">Documentos pendentes (controle interno)</p>
            <p className="text-xs text-orange-700 mt-1">
              Para ocorrências do tipo <strong>{ocorrencia.tipo_penalidade}</strong>, é obrigatório
              anexar documentos comprobatórios. O PDF para assinatura do colaborador não mostra o
              status "Pendente" — isso é controle interno do RH.
            </p>
            <p className="text-xs text-orange-600 mt-2">
              Anexos atuais: <strong>{anexos.length}</strong>
              {anexos.length === 0
                ? ' (anexe pelo menos 1 documento para ativar)'
                : ' (pronto para ativar)'}
            </p>
          </div>
        </div>
      )}

      {isAtiva && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">Ocorrência ativa</p>
            <p className="text-xs text-emerald-700 mt-1">
              Esta ocorrência está ativa com {anexos.length} documento(s) anexado(s).
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Colaborador
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Nome</span>
                <span className="text-slate-800">{colaborador.nome_completo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Matrícula</span>
                <span className="text-slate-800">{colaborador.matricula}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">CPF</span>
                <span className="text-slate-800">{colaborador.cpf || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Cargo</span>
                <span className="text-slate-800">{colaborador.cargo || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Departamento</span>
                <span className="text-slate-800">{colaborador.departamento || '—'}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Dados da Ocorrência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {empresa && (
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">Empresa</span>
                  <span className="text-slate-800">
                    {empresa.nome}
                    {empresa.cnpj ? ` (CNPJ: ${empresa.cnpj})` : ''}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Título</span>
                <span className="text-slate-800 font-medium">{ocorrencia.titulo || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Tipo</span>
                <span className="text-slate-800">{ocorrencia.tipo_ocorrencia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Data</span>
                <span className="text-slate-800">{fmtDate(ocorrencia.data_ocorrencia)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Status</span>
                <span className="text-slate-800">{ocorrencia.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-xs">Registro</span>
                <span className="text-slate-800">{fmtDateTime(ocorrencia.created_at || '')}</span>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 text-xs block mb-1">Descrição</span>
                <p className="text-slate-700 text-xs leading-relaxed">{ocorrencia.descricao}</p>
              </div>
              {ocorrencia.defesa_funcionario && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 text-xs block mb-1">Defesa do Funcionário</span>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {ocorrencia.defesa_funcionario}
                  </p>
                </div>
              )}
              {ocorrencia.medida_corretiva && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 text-xs block mb-1">Medida Corretiva</span>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {ocorrencia.medida_corretiva}
                  </p>
                </div>
              )}
              {ocorrencia.prazo_acompanhamento && (
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-500 text-xs">Prazo de Acompanhamento</span>
                  <span className="text-slate-800">{fmtDate(ocorrencia.prazo_acompanhamento)}</span>
                </div>
              )}
            </CardContent>
          </Card>
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
            <Card className="border-slate-100">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Documentos Comprobatórios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isCancelada && podeAnexar && (
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">Anexar Documento</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Anexe fotos, vídeos, áudios, PDFs, atestados, prints ou qualquer arquivo que
                      comprove a ocorrência.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Descrição do documento (opcional)"
                        value={descricaoUpload}
                        onChange={(e) => setDescricaoUpload(e.target.value)}
                        className="text-xs flex-1"
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.mp4,.mov,.avi,.wmv,.webm,.mkv,.mp3,.wav,.ogg,.aac,.m4a,.webm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-1 text-xs bg-amber-600 hover:bg-amber-700"
                      >
                        <Upload className="h-3.5 w-3.5" /> Selecionar Arquivo
                      </Button>
                    </div>
                  </div>
                )}

                {loadingAnexos ? (
                  <div className="text-center py-4 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </div>
                ) : anexos.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-400">
                    <Paperclip className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    Nenhum documento anexado.
                    {isPendente && (
                      <p className="text-xs text-orange-500 mt-1">
                        Anexe documentos para ativar esta ocorrência.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {anexos.map((a) => {
                      const isVideo = a.tipo_arquivo?.startsWith('video/')
                      const isAudio = a.tipo_arquivo?.startsWith('audio/')
                      return (
                        <div
                          key={a.id}
                          className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          {isVideo && a.url_publica && (
                            <video controls className="w-full max-h-48 rounded-lg mb-2 bg-slate-900">
                              <source src={a.url_publica} type={a.tipo_arquivo} />
                              Seu navegador não suporta vídeo.
                            </video>
                          )}
                          {isAudio && a.url_publica && (
                            <audio controls className="w-full mb-2">
                              <source src={a.url_publica} type={a.tipo_arquivo} />
                              Seu navegador não suporta áudio.
                            </audio>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              {isVideo ? (
                                <Video className="h-4 w-4 text-purple-500 flex-shrink-0" />
                              ) : isAudio ? (
                                <Headphones className="h-4 w-4 text-pink-500 flex-shrink-0" />
                              ) : (
                                <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">
                                  {a.nome_arquivo}
                                </p>
                                {a.descricao && <p className="text-xs text-slate-500">{a.descricao}</p>}
                                <p className="text-xs text-slate-400">
                                  {(a.tamanho_bytes / (isVideo || isAudio ? 1024 * 1024 : 1024)).toFixed(
                                    1
                                  )}{' '}
                                  {isVideo || isAudio ? 'MB' : 'KB'} | {fmtDate(a.created_at || '')}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1 ml-2 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="text-slate-400 hover:text-blue-600 h-7 w-7 p-0"
                              >
                                <a
                                  href={a.url_publica || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir arquivo"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              {!isCancelada && podeAnexar && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removerAnexo(a)}
                                  className="text-slate-400 hover:text-red-600 h-7 w-7 p-0"
                                  title="Remover"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="testemunhas">
            <Card className="border-slate-100">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Testemunhas da Ocorrência
                </CardTitle>
                {!isCancelada && podeTestemunha && (
                  <Button
                    size="sm"
                    onClick={() => setMostrarFormTestemunha(!mostrarFormTestemunha)}
                    className="gap-1 text-xs h-7 bg-amber-600 hover:bg-amber-700"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {mostrarFormTestemunha && (
                  <form onSubmit={handleAddTestemunha} className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Nome *</Label>
                        <Input
                          value={novaTestemunha.nome}
                          onChange={(e) =>
                            setNovaTestemunha((p) => ({ ...p, nome: e.target.value }))
                          }
                          required
                          className="text-xs h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">CPF</Label>
                        <Input
                          value={novaTestemunha.cpf}
                          onChange={(e) =>
                            setNovaTestemunha((p) => ({ ...p, cpf: e.target.value }))
                          }
                          className="text-xs h-8"
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cargo</Label>
                        <Input
                          value={novaTestemunha.cargo}
                          onChange={(e) =>
                            setNovaTestemunha((p) => ({ ...p, cargo: e.target.value }))
                          }
                          className="text-xs h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Departamento</Label>
                        <Input
                          value={novaTestemunha.departamento}
                          onChange={(e) =>
                            setNovaTestemunha((p) => ({ ...p, departamento: e.target.value }))
                          }
                          className="text-xs h-8"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMostrarFormTestemunha(false)}
                        className="text-xs h-7"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="text-xs h-7 bg-amber-600 hover:bg-amber-700"
                      >
                        Salvar Testemunha
                      </Button>
                    </div>
                  </form>
                )}

                {loadingTest ? (
                  <div className="text-center py-4 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </div>
                ) : testemunhas.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-400">
                    <UserPlus className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    Nenhuma testemunha cadastrada.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {testemunhas.map((t, i) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-700">{t.nome}</p>
                            <p className="text-xs text-slate-500">
                              {t.cargo}
                              {t.departamento ? ` | ${t.departamento}` : ''}
                              {t.cpf ? ` | CPF: ${t.cpf}` : ''}
                            </p>
                          </div>
                        </div>
                        {!isCancelada && podeTestemunha && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removerTestemunha(t.id)}
                            className="text-slate-400 hover:text-red-600 h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auditoria">
            <Card className="border-slate-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Histórico de Auditoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-400">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    Nenhum registro de auditoria.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {logs.map((l) => (
                      <div key={l.id} className="p-3 rounded-lg border border-slate-100 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              l.acao === 'INSERT'
                                ? 'bg-emerald-50 text-emerald-700'
                                : l.acao === 'UPDATE'
                                  ? 'bg-blue-50 text-blue-700'
                                  : l.acao === 'CANCEL'
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-slate-50 text-slate-600'
                            }`}
                          >
                            {l.acao}
                          </span>
                          <span className="text-xs text-slate-400">{fmtDateTime(l.created_at || '')}</span>
                        </div>
                        {l.dados_novos && (
                          <div className="text-xs text-slate-600 mt-1">
                            {l.acao === 'UPDATE' &&
                            l.tabela === 'ocorrencias' &&
                            l.dados_novos.status &&
                            l.dados_anteriores?.status ? (
                              <span>
                                Status alterado: <strong>{String(l.dados_anteriores.status)}</strong> →{' '}
                                <strong>{String(l.dados_novos.status)}</strong>
                              </span>
                            ) : null}
                            {l.acao === 'INSERT' && l.tabela === 'ocorrencias' ? (
                              <span>
                                Ocorrência criada:{' '}
                                <strong>{String(l.dados_novos.tipo_ocorrencia || '')}</strong>
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
    </div>
  )
}
