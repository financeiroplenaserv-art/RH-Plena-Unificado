import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingScreen } from '@/components/LoadingScreen'
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
import { useOcorrenciaDetalhe } from './useOcorrenciaDetalhe'
import {
  Paperclip,
  UserPlus,
  Clock,
} from 'lucide-react'
import type { OcorrenciaAnexo } from '@/types/database'
import { exigeDocumentoAssinado } from '@/lib/ocorrencias/tiposOcorrencia'
import { DetailHeader } from '@/components/ocorrencias/ocorrencia-detail/DetailHeader'
import { StatusBanner } from '@/components/ocorrencias/ocorrencia-detail/StatusBanner'
import { ColaboradorCard } from '@/components/ocorrencias/ocorrencia-detail/ColaboradorCard'
import { DadosOcorrenciaCard } from '@/components/ocorrencias/ocorrencia-detail/DadosOcorrenciaCard'
import { AnexosTab } from '@/components/ocorrencias/ocorrencia-detail/AnexosTab'
import { TestemunhasTab } from '@/components/ocorrencias/ocorrencia-detail/TestemunhasTab'
import { AuditoriaTab } from '@/components/ocorrencias/ocorrencia-detail/AuditoriaTab'
import { OcorrenciaDialogs } from '@/components/ocorrencias/ocorrencia-detail/OcorrenciaDialogs'

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

  const {
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
  } = useOcorrenciaDetalhe()

  const [mostrarCancelar, setMostrarCancelar] = useState(false)
  const [anexoParaRemover, setAnexoParaRemover] = useState<OcorrenciaAnexo | null>(null)
  const [testemunhaParaRemover, setTestemunhaParaRemover] = useState<string | null>(null)

  const confirmarRemoverAnexo = async () => {
    if (!anexoParaRemover) return
    await removerAnexo(anexoParaRemover)
    setAnexoParaRemover(null)
  }

  const confirmarRemoverTestemunha = async () => {
    if (!testemunhaParaRemover) return
    await removerTestemunha(testemunhaParaRemover)
    setTestemunhaParaRemover(null)
  }

  const confirmarCancelar = async () => {
    await handleCancelar()
    setMostrarCancelar(false)
  }

  if (loading) {
    return <LoadingScreen mensagem="Carregando ocorrência..." />
  }

  if (!ocorrencia) {
    return <div className="text-center py-8 text-sm text-slate-400">Ocorrência não encontrada</div>
  }

  const isPendente = ocorrencia.status === 'Pendente'
  const isCancelada = ocorrencia.status === 'Cancelada'

  const temDocAssinado = anexos.some((a) => a.tipo_documento === 'documento_assinado')
  const temDocComprobatorio = anexos.some((a) => a.tipo_documento === 'comprovante')
  const exigeAssinado = exigeDocumentoAssinado(ocorrencia.tipo_penalidade || '')

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
        temDocAssinado={temDocAssinado}
        temDocComprobatorio={temDocComprobatorio}
        onGerarPDF={handleGerarPDF}
        onAtivar={handleAtivar}
        onCancelar={() => setMostrarCancelar(true)}
      />

      <StatusBanner
        ocorrencia={ocorrencia}
        anexosCount={anexos.length}
        temDocAssinado={temDocAssinado}
        temDocComprobatorio={temDocComprobatorio}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <ColaboradorCard
            colaborador={colaborador}
            colaboradorNomeFallback={ocorrencia.colaborador_nome}
          />
          <DadosOcorrenciaCard
            ocorrencia={ocorrencia}
            empresa={empresa}
            podeEditarAssinatura={podeEditar && !isCancelada}
            salvandoAssinatura={salvandoAssinatura}
            onFormaAssinaturaChange={handleFormaAssinaturaChange}
          />
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
                exigeDocAssinado={exigeAssinado}
                descricaoUpload={descricaoUpload}
                tipoDocumentoUpload={tipoDocumentoUpload}
                fileInputRef={fileInputRef}
                onDescricaoUploadChange={setDescricaoUpload}
                onTipoDocumentoUploadChange={setTipoDocumentoUpload}
                onFileSelect={handleFileSelect}
                onRemoverAnexo={setAnexoParaRemover}
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
                onRemoverTestemunha={setTestemunhaParaRemover}
              />
            </TabsContent>

            <TabsContent value="auditoria">
              <AuditoriaTab logs={logs} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <OcorrenciaDialogs
        mostrarCancelar={mostrarCancelar}
        onMostrarCancelarChange={setMostrarCancelar}
        onConfirmarCancelar={confirmarCancelar}
        anexoParaRemover={anexoParaRemover}
        onAnexoParaRemoverChange={setAnexoParaRemover}
        onConfirmarRemoverAnexo={confirmarRemoverAnexo}
        testemunhaParaRemover={testemunhaParaRemover}
        onTestemunhaParaRemoverChange={setTestemunhaParaRemover}
        onConfirmarRemoverTestemunha={confirmarRemoverTestemunha}
      />
    </RhShell>
  )
}
