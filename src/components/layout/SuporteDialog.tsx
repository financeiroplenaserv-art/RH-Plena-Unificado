import { useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Loader2, LifeBuoy, Paperclip, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/corh/Button'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Perfil } from '@/types/database'

const REQUEST_TIMEOUT_MS = 30000
const MAX_MENSAGEM = 2000
const MAX_ANEXOS = 3
const MAX_TAMANHO_ANEXO_BYTES = 5 * 1024 * 1024 // 5 MB por arquivo
const TIPOS_ANEXO_ACEITOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']

interface AnexoSuporte {
  nome: string
  tipo: string
  /** Conteúdo em base64, sem o prefixo "data:...;base64," */
  conteudo: string
}

function lerArquivoComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const resultado = String(reader.result || '')
      resolve(resultado.includes(',') ? resultado.split(',')[1] : resultado)
    }
    reader.onerror = () => reject(new Error(`Falha ao ler o arquivo ${arquivo.name}`))
    reader.readAsDataURL(arquivo)
  })
}

interface SuporteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: Perfil
}

/**
 * Canal de ajuda/suporte: o usuário descreve o problema e a mensagem é
 * enviada por e-mail à equipe (via Edge Function — o endereço de destino
 * nunca aparece no frontend).
 */
export function SuporteDialog({ open, onOpenChange, user }: SuporteDialogProps) {
  const location = useLocation()
  const [mensagem, setMensagem] = useState('')
  const [anexos, setAnexos] = useState<AnexoSuporte[]>([])
  const [enviando, setEnviando] = useState(false)
  const inputArquivoRef = useRef<HTMLInputElement>(null)

  const handleFechar = (aberto: boolean) => {
    if (!aberto) {
      setMensagem('')
      setAnexos([])
    }
    onOpenChange(aberto)
  }

  const handleSelecionarArquivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files || [])
    e.target.value = '' // permite selecionar o mesmo arquivo novamente
    if (arquivos.length === 0) return

    const novos: AnexoSuporte[] = []
    for (const arquivo of arquivos) {
      if (anexos.length + novos.length >= MAX_ANEXOS) {
        toast.error(`Máximo de ${MAX_ANEXOS} anexos por mensagem.`)
        break
      }
      if (!TIPOS_ANEXO_ACEITOS.includes(arquivo.type)) {
        toast.error(`Tipo não suportado: ${arquivo.name}. Envie imagem (PNG, JPG, WebP, GIF) ou PDF.`)
        continue
      }
      if (arquivo.size > MAX_TAMANHO_ANEXO_BYTES) {
        toast.error(`Arquivo muito grande: ${arquivo.name} (máx. 5 MB).`)
        continue
      }
      try {
        const conteudo = await lerArquivoComoBase64(arquivo)
        novos.push({ nome: arquivo.name, tipo: arquivo.type, conteudo })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Falha ao ler o arquivo')
      }
    }
    if (novos.length > 0) setAnexos((atual) => [...atual, ...novos])
  }

  const handleEnviar = async () => {
    const texto = mensagem.trim()
    if (!texto) return

    setEnviando(true)
    try {
      const { data: sessionData, error: erroSessao } = await supabase.auth.getSession()
      if (erroSessao || !sessionData.session) throw new Error('Usuário não autenticado')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      let response: Response
      try {
        response = await fetch(`${supabaseUrl}/functions/v1/suporte`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mensagem: texto,
            pagina: location.pathname,
            anexos,
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeoutId)
      }

      if (!response.ok) {
        const corpo = await response.json().catch(() => null)
        throw new Error(corpo?.error || 'Falha ao enviar mensagem')
      }

      toast.success('Mensagem enviada. Obrigado pelo retorno!')
      handleFechar(false)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao enviar mensagem'
      toast.error(`Não foi possível enviar: ${msg}`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleFechar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <LifeBuoy className="w-6 h-6 text-primary shrink-0" />
            <div>
              <DialogTitle>Ajuda e suporte</DialogTitle>
              <DialogDescription>
                Descreva o problema encontrado. Sua mensagem será enviada à equipe de suporte.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value.slice(0, MAX_MENSAGEM))}
            placeholder="Ex.: ao exportar o relatório de extras, a tela ficou em branco..."
            rows={6}
            disabled={enviando}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Enviando como <strong>{user.nome || user.email}</strong>
            </span>
            <span>
              {mensagem.length}/{MAX_MENSAGEM}
            </span>
          </div>

          <input
            ref={inputArquivoRef}
            type="file"
            multiple
            accept={TIPOS_ANEXO_ACEITOS.join(',')}
            className="hidden"
            onChange={handleSelecionarArquivos}
          />

          {anexos.length > 0 && (
            <ul className="space-y-1">
              {anexos.map((anexo, indice) => (
                <li
                  key={`${anexo.nome}-${indice}`}
                  className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs"
                >
                  <span className="truncate">{anexo.nome}</span>
                  <button
                    type="button"
                    onClick={() => setAnexos((atual) => atual.filter((_, i) => i !== indice))}
                    disabled={enviando}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    title="Remover anexo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => inputArquivoRef.current?.click()}
            disabled={enviando || anexos.length >= MAX_ANEXOS}
          >
            <Paperclip className="w-4 h-4 mr-2" />
            {anexos.length > 0 ? `Anexar mais (${anexos.length}/${MAX_ANEXOS})` : 'Anexar print ou arquivo'}
          </Button>

          <Button
            className="w-full"
            onClick={handleEnviar}
            disabled={enviando || mensagem.trim().length === 0}
          >
            {enviando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar mensagem'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
