import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import type { OcorrenciaAnexo } from '@/types/database'

interface OcorrenciaDialogsProps {
  mostrarCancelar: boolean
  onMostrarCancelarChange: (aberto: boolean) => void
  onConfirmarCancelar: () => void
  anexoParaRemover: OcorrenciaAnexo | null
  onAnexoParaRemoverChange: (anexo: OcorrenciaAnexo | null) => void
  onConfirmarRemoverAnexo: () => void
  testemunhaParaRemover: string | null
  onTestemunhaParaRemoverChange: (id: string | null) => void
  onConfirmarRemoverTestemunha: () => void
}

export function OcorrenciaDialogs({
  mostrarCancelar,
  onMostrarCancelarChange,
  onConfirmarCancelar,
  anexoParaRemover,
  onAnexoParaRemoverChange,
  onConfirmarRemoverAnexo,
  testemunhaParaRemover,
  onTestemunhaParaRemoverChange,
  onConfirmarRemoverTestemunha,
}: OcorrenciaDialogsProps) {
  return (
    <>
      <Dialog open={mostrarCancelar} onOpenChange={onMostrarCancelarChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Cancelar ocorrência?</DialogTitle>
            <DialogDescription className="text-xs">
              A ocorrência será mantida no histórico com status "Cancelada".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => onMostrarCancelarChange(false)}>
              Voltar
            </Button>
            <Button variant="destructive" size="sm" onClick={onConfirmarCancelar}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!anexoParaRemover}
        onOpenChange={() => onAnexoParaRemoverChange(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Remover anexo?"
        description={`O arquivo "${anexoParaRemover?.nome_arquivo || ''}" será removido permanentemente. Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={onConfirmarRemoverAnexo}
        destructive
      />

      <ConfirmDialog
        open={!!testemunhaParaRemover}
        onOpenChange={() => onTestemunhaParaRemoverChange(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Remover testemunha?"
        description="A testemunha será removida permanentemente desta ocorrência."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={onConfirmarRemoverTestemunha}
        destructive
      />
    </>
  )
}
