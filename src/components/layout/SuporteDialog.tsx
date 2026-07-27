import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Loader2, LifeBuoy } from 'lucide-react'
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
  const [enviando, setEnviando] = useState(false)

  const handleFechar = (aberto: boolean) => {
    if (!aberto) setMensagem('')
    onOpenChange(aberto)
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
