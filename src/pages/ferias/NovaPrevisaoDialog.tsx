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
import type { Colaborador } from '@/types/database'
import type { NovaPrevisao } from '@/hooks/useFerias'

interface NovaPrevisaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSalvar: (previsao: NovaPrevisao) => Promise<boolean>
  loading?: boolean
}

function paraISO(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

export function NovaPrevisaoDialog({ open, onOpenChange, onSalvar, loading = false }: NovaPrevisaoDialogProps) {
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setColaborador(null)
      setDataInicio('')
      setDataFim('')
      setObservacao('')
      setErro(null)
    }
  }, [open])

  // Sugere 30 dias de gozo a partir do início (padrão CLT)
  const handleInicioChange = (valor: string) => {
    setDataInicio(valor)
    if (valor) {
      const inicio = new Date(valor + 'T12:00:00')
      const fim = new Date(inicio.getTime() + 29 * 24 * 60 * 60 * 1000)
      setDataFim(paraISO(fim))
    } else {
      setDataFim('')
    }
  }

  const handleSalvar = async () => {
    if (!colaborador) {
      setErro('Selecione o colaborador.')
      return
    }
    if (!dataInicio || !dataFim) {
      setErro('Informe as datas de início e fim da previsão.')
      return
    }
    if (dataFim < dataInicio) {
      setErro('A data fim não pode ser anterior à data início.')
      return
    }
    setErro(null)
    const ok = await onSalvar({
      colaborador_id: colaborador.id,
      data_inicio: dataInicio,
      data_fim: dataFim,
      descricao: observacao.trim() || null,
    })
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova previsão de férias</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            Previsão de planejamento do RH. Quando o período for confirmado no Alterdata e chegar
            via Flit, esta previsão é baixada automaticamente.
          </p>

          <AutocompleteColaborador
            label="Colaborador"
            onChange={setColaborador}
            somenteAtivos
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início previsto</Label>
              <Input type="date" value={dataInicio} onChange={(e) => handleInicioChange(e.target.value)} />
            </div>
            <div>
              <Label>Fim previsto</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: previsão informada ao contrato em reunião"
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
            Salvar previsão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
