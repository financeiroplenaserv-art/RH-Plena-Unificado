import { useEffect, useState } from 'react'
import { CeuDialog } from './CeuDialog'
import { Button } from '@/components/corh/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CLASSE_SELECT } from '@/components/materiais/estilos'

// "Trocar contrato" de uma linha da fila CEU → Pedidos (migration 177): move a
// linha para o pedido do mesmo mês do contrato certo (criando o pedido se não
// existir). Motivo obrigatório. NÃO muda o cadastro do colaborador — se o posto
// do CORH estiver errado, corrigir o cadastro.

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  descricaoLinha: string
  contratoAtual: string
  contratos: { id: string; nome: string }[]
  ocupado: boolean
  onConfirmar: (contratoId: string, motivo: string) => void
}

export function TrocarContratoDialog({ open, onOpenChange, descricaoLinha, contratoAtual, contratos, ocupado, onConfirmar }: Props) {
  const [contrato, setContrato] = useState('')
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (!open) return
    setContrato('')
    setMotivo('')
  }, [open])

  const pronto = !!contrato && motivo.trim() !== ''

  return (
    <CeuDialog
      open={open}
      onOpenChange={(v) => !ocupado && onOpenChange(v)}
      className="sm:max-w-md"
      title="Trocar contrato da linha"
      description={`${descricaoLinha} — hoje em ${contratoAtual}. A linha vai para o pedido do mesmo mês do contrato escolhido. O cadastro do colaborador não muda.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ocupado}>
            Voltar
          </Button>
          <Button onClick={() => onConfirmar(contrato, motivo.trim())} disabled={!pronto} loading={ocupado}>
            Mover linha
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ceu-trocar-contrato">Contrato certo</Label>
          <select id="ceu-trocar-contrato" className={CLASSE_SELECT} value={contrato} onChange={(e) => setContrato(e.target.value)}>
            <option value="">Escolha…</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ceu-trocar-motivo">Motivo</Label>
          <Input id="ceu-trocar-motivo" placeholder="Por que a linha é de outro contrato?" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
      </div>
    </CeuDialog>
  )
}
