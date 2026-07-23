import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/corh/Button'
import { AutocompleteColaborador } from '@/components/AutocompleteColaborador'
import type { Colaborador, DestinatarioNotificacaoFerias } from '@/types/database'
import type { NovaNotificacao } from '@/hooks/useFerias'

interface NotificacaoFeriasDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Colaborador pré-selecionado (quando aberto a partir da linha da Visão geral) */
  colaboradorInicial?: Pick<Colaborador, 'id' | 'nome_completo'> | null
  /** Período de férias vinculado (previsão/agendado mais próximo), quando houver */
  periodoId?: string | null
  onSalvar: (notificacao: NovaNotificacao) => Promise<boolean>
  loading?: boolean
}

function hojeISO(): string {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}

export function NotificacaoFeriasDialog({
  open,
  onOpenChange,
  colaboradorInicial = null,
  periodoId = null,
  onSalvar,
  loading = false,
}: NotificacaoFeriasDialogProps) {
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [destinatario, setDestinatario] = useState<DestinatarioNotificacaoFerias>('colaborador')
  const [dataNotificacao, setDataNotificacao] = useState(hojeISO())
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setColaborador(null)
      setDestinatario('colaborador')
      setDataNotificacao(hojeISO())
      setObservacao('')
      setErro(null)
    }
  }, [open])

  const colaboradorId = colaboradorInicial?.id ?? colaborador?.id ?? null

  const handleSalvar = async () => {
    if (!colaboradorId) {
      setErro('Selecione o colaborador.')
      return
    }
    if (!dataNotificacao) {
      setErro('Informe a data da notificação.')
      return
    }
    setErro(null)
    const ok = await onSalvar({
      colaborador_id: colaboradorId,
      ferias_periodo_id: periodoId,
      destinatario,
      data_notificacao: dataNotificacao,
      observacao: observacao.trim() || null,
    })
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar notificação de férias</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {colaboradorInicial ? (
            <div>
              <Label>Colaborador</Label>
              <p className="mt-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px] font-medium">
                {colaboradorInicial.nome_completo}
              </p>
            </div>
          ) : (
            <AutocompleteColaborador
              label="Colaborador"
              onChange={setColaborador}
              somenteAtivos
            />
          )}

          <div>
            <Label>Enviada para</Label>
            <div className="mt-1 flex flex-wrap gap-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="radio"
                  name="destinatario"
                  checked={destinatario === 'colaborador'}
                  onChange={() => setDestinatario('colaborador')}
                />
                O colaborador
              </label>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="radio"
                  name="destinatario"
                  checked={destinatario === 'responsavel_contrato'}
                  onChange={() => setDestinatario('responsavel_contrato')}
                />
                O responsável pelo contrato
              </label>
            </div>
          </div>

          <div>
            <Label>Data da notificação</Label>
            <Input type="date" value={dataNotificacao} onChange={(e) => setDataNotificacao(e.target.value)} />
          </div>

          <div>
            <Label>Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: aviso de 30 dias enviado por e-mail"
              rows={2}
            />
          </div>

          {erro && <p className="text-[13px] text-red-600">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSalvar} loading={loading}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
