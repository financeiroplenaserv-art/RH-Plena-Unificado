import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Paperclip,
  Upload,
  Trash2,
  Eye,
  FileText,
  Video,
  Headphones,
  Loader2,
} from 'lucide-react'
import type { OcorrenciaAnexo } from '@/types/database'

interface AnexosTabProps {
  anexos: OcorrenciaAnexo[]
  urlsAssinadas: Record<string, string>
  loadingAnexos: boolean
  podeAnexar: boolean
  isPendente: boolean
  isCancelada: boolean
  descricaoUpload: string
  fileInputRef: React.RefObject<HTMLInputElement>
  onDescricaoUploadChange: (value: string) => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoverAnexo: (anexo: OcorrenciaAnexo) => void
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

export function AnexosTab({
  anexos,
  urlsAssinadas,
  loadingAnexos,
  podeAnexar,
  isPendente,
  isCancelada,
  descricaoUpload,
  fileInputRef,
  onDescricaoUploadChange,
  onFileSelect,
  onRemoverAnexo,
}: AnexosTabProps) {
  return (
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
                onChange={(e) => onDescricaoUploadChange(e.target.value)}
                className="text-xs flex-1"
              />
              <input
                ref={fileInputRef}
                type="file"
                onChange={onFileSelect}
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
                  {isVideo && urlsAssinadas[a.id] && (
                    <video controls className="w-full max-h-48 rounded-lg mb-2 bg-slate-900">
                      <source src={urlsAssinadas[a.id]} type={a.tipo_arquivo} />
                      Seu navegador não suporta vídeo.
                    </video>
                  )}
                  {isAudio && urlsAssinadas[a.id] && (
                    <audio controls className="w-full mb-2">
                      <source src={urlsAssinadas[a.id]} type={a.tipo_arquivo} />
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
                          href={urlsAssinadas[a.id] || '#'}
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
                          onClick={() => onRemoverAnexo(a)}
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
  )
}
