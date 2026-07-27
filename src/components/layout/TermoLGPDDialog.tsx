import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import type { TermoLGPD } from '@/types/database'

const COLUNAS_TERMO_LGPD = 'id, versao, titulo, conteudo, finalidades, ativo, created_at'

interface TermoLGPDDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Exibe o termo de consentimento LGPD ativo (mesma fonte da tela de
 * consentimento do primeiro login), para consulta a qualquer momento.
 */
export function TermoLGPDDialog({ open, onOpenChange }: TermoLGPDDialogProps) {
  const [termo, setTermo] = useState<TermoLGPD | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    async function carregarTermo() {
      setLoading(true)
      setErro(null)
      const { data, error } = await supabase
        .from('termos_lgpd')
        .select(COLUNAS_TERMO_LGPD)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        setErro('Não foi possível carregar o termo de privacidade.')
      } else {
        setTermo(data as TermoLGPD)
      }
      setLoading(false)
    }
    carregarTermo()
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <DialogTitle>{termo?.titulo || 'Termo de privacidade'}</DialogTitle>
              {termo && <DialogDescription>Versão {termo.versao}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {erro && <p className="text-sm text-red-600 py-4">{erro}</p>}

          {!loading && !erro && termo && (
            <>
              <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                {termo.conteudo}
              </div>

              {termo.finalidades && termo.finalidades.length > 0 && (
                <div className="mt-6 p-4 bg-slate-100 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Finalidades do tratamento:</h4>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                    {termo.finalidades.map((finalidade) => (
                      <li key={finalidade}>{finalidade}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
