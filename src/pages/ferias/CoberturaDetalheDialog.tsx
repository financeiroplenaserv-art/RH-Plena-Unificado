import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/corh/Button'
import { formatarData } from '@/lib/utils'
import type { FeriasAlocacaoComSolicitacao, FeriasSolicitacao } from '@/types/ferias'

export interface CamposTreinamento {
  precisa_treinamento: boolean | null
  treinamento_detalhe: string | null
}

export interface CamposComunicacao {
  informativo_cliente_em: string | null
  contato_titular_por: string | null
  contato_titular_em: string | null
  contato_ferista_por: string | null
  contato_ferista_em: string | null
  encarregado_lider: string | null
}

interface CoberturaDetalheDialogProps {
  aberto: boolean
  onFechar: () => void
  solicitacao: FeriasSolicitacao | null
  /** Alocação confirmada da solicitação (null = vaga sem cobertura: só comunicação) */
  alocacao: FeriasAlocacaoComSolicitacao | null
  nomeContrato: string
  salvando: boolean
  onSalvar: (treinamento: CamposTreinamento | null, comunicacao: CamposComunicacao) => Promise<boolean>
}

/**
 * Detalhe da cobertura (migration 125, decisão da gestão 13/10/2026):
 * treinamento do ferista (por alocação) + checklist de comunicação
 * (por solicitação — sobrevive à troca de ferista e existe sem cobertura).
 */
export function CoberturaDetalheDialog({ aberto, onFechar, solicitacao, alocacao, nomeContrato, salvando, onSalvar }: CoberturaDetalheDialogProps) {
  const [precisaTreinamento, setPrecisaTreinamento] = useState(false)
  const [treinamentoDetalhe, setTreinamentoDetalhe] = useState('')
  const [informativoEm, setInformativoEm] = useState('')
  const [contatoTitularPor, setContatoTitularPor] = useState('')
  const [contatoTitularEm, setContatoTitularEm] = useState('')
  const [contatoFeristaPor, setContatoFeristaPor] = useState('')
  const [contatoFeristaEm, setContatoFeristaEm] = useState('')
  const [encarregadoLider, setEncarregadoLider] = useState('')

  useEffect(() => {
    if (!aberto || !solicitacao) return
    setPrecisaTreinamento(alocacao?.precisa_treinamento ?? false)
    setTreinamentoDetalhe(alocacao?.treinamento_detalhe ?? '')
    setInformativoEm(solicitacao.informativo_cliente_em ?? '')
    setContatoTitularPor(solicitacao.contato_titular_por ?? '')
    setContatoTitularEm(solicitacao.contato_titular_em ?? '')
    setContatoFeristaPor(solicitacao.contato_ferista_por ?? '')
    setContatoFeristaEm(solicitacao.contato_ferista_em ?? '')
    setEncarregadoLider(solicitacao.encarregado_lider ?? '')
  }, [aberto, solicitacao, alocacao])

  if (!solicitacao) return null

  const salvar = async () => {
    const treinamento: CamposTreinamento | null = alocacao
      ? {
          precisa_treinamento: precisaTreinamento,
          treinamento_detalhe: precisaTreinamento ? treinamentoDetalhe.trim() || null : null,
        }
      : null
    const comunicacao: CamposComunicacao = {
      informativo_cliente_em: informativoEm || null,
      contato_titular_por: contatoTitularPor.trim() || null,
      contato_titular_em: contatoTitularEm || null,
      contato_ferista_por: contatoFeristaPor.trim() || null,
      contato_ferista_em: contatoFeristaEm || null,
      encarregado_lider: encarregadoLider.trim() || null,
    }
    const ok = await onSalvar(treinamento, comunicacao)
    if (ok) onFechar()
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Cobertura — {solicitacao.colaborador?.nome_completo ?? 'Colaborador'}
          </DialogTitle>
          <p className="text-[12px] tabular-nums text-muted-foreground">
            {nomeContrato} · {formatarData(solicitacao.data_inicio)} a {formatarData(solicitacao.data_fim)}
            {alocacao ? '' : ' · ainda sem ferista'}
          </p>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {alocacao && (
            <section className="space-y-3">
              <h3 className="text-[13px] font-semibold text-foreground">Treinamento do ferista</h3>
              <label className="flex items-center gap-2 text-[13px] text-foreground">
                <input type="checkbox" checked={precisaTreinamento} onChange={(e) => setPrecisaTreinamento(e.target.checked)} />
                Precisa treinar no posto (padrão: 2 dias, compensados depois)
              </label>
              {precisaTreinamento && (
                <div>
                  <Label>Dias/horário de treinamento</Label>
                  <Input
                    value={treinamentoDetalhe}
                    onChange={(e) => setTreinamentoDetalhe(e.target.value)}
                    placeholder="Ex.: Treina 22 e 23/09 das 07h às 16h"
                  />
                </div>
              )}
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-[13px] font-semibold text-foreground">Comunicação</h3>
            <div>
              <Label>Informativo do RH ao cliente em</Label>
              <Input type="date" value={informativoEm} onChange={(e) => setInformativoEm(e.target.value)} className="w-44" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Contato com quem sai de férias — por</Label>
                <Input value={contatoTitularPor} onChange={(e) => setContatoTitularPor(e.target.value)} placeholder="Quem falou" />
              </div>
              <div>
                <Label>em</Label>
                <Input type="date" value={contatoTitularEm} onChange={(e) => setContatoTitularEm(e.target.value)} />
              </div>
              <div>
                <Label>Contato com o ferista — por</Label>
                <Input value={contatoFeristaPor} onChange={(e) => setContatoFeristaPor(e.target.value)} placeholder="Quem falou" />
              </div>
              <div>
                <Label>em</Label>
                <Input type="date" value={contatoFeristaEm} onChange={(e) => setContatoFeristaEm(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Encarregado/líder do posto</Label>
              <Input value={encarregadoLider} onChange={(e) => setEncarregadoLider(e.target.value)} placeholder="Referência operacional da cobertura" />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={salvar} loading={salvando}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
