import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
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
import { parseDataLocal, formatarDataInput, formatarData } from '@/lib/utils'
import { resolverFuncao } from '@/lib/ferias/funcoesFerias'
import type { AvaliacaoTeto } from '@/lib/ferias/tetoSimultaneo'
import { useFerias } from '@/hooks/useFerias'
import type { Colaborador } from '@/types/database'
import type { FeriasSolicitacao } from '@/types/ferias'

interface ProgramarFeriasDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Solicitação pendente existente a programar (pendente → agendada). Sem ela, o dialog cria. */
  solicitacao?: FeriasSolicitacao | null
  /** Colaborador fixo no modo criar (ficha do colaborador) */
  colaboradorInicial?: Colaborador | null
  /** Restringe a busca de colaboradores a um contrato (aba Programação) */
  departamentoId?: string | null
  /** Chamado após salvar com sucesso, para a página recarregar */
  onSalvo?: () => void | Promise<void>
}

export function ProgramarFeriasDialog({
  open,
  onOpenChange,
  solicitacao = null,
  colaboradorInicial = null,
  departamentoId = null,
  onSalvo,
}: ProgramarFeriasDialogProps) {
  const { loading, adicionarPrevisao, programarFerias, avaliarTeto, listarFuncoes } = useFerias()

  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [abono, setAbono] = useState(false)
  const [adiantamento13, setAdiantamento13] = useState(false)
  const [parcelada, setParcelada] = useState(false)
  const [pedidoColaborador, setPedidoColaborador] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [avaliacao, setAvaliacao] = useState<AvaliacaoTeto | null>(null)

  const modoProgramar = solicitacao !== null

  useEffect(() => {
    if (open) {
      setColaborador(null)
      setDataInicio(solicitacao?.data_inicio ?? '')
      setDataFim(solicitacao?.data_fim ?? '')
      setAbono(false)
      setAdiantamento13(false)
      setParcelada(false)
      setPedidoColaborador(false)
      setObservacao(solicitacao?.observacao ?? '')
      setErro(null)
      setAvaliacao(null)
    }
  }, [open, solicitacao])

  // Alvo do teto (RN-01): na programação usa o contrato+função gravados na
  // solicitação; na criação resolve do cadastro do colaborador escolhido.
  const [funcaoResolvidaId, setFuncaoResolvidaId] = useState<string | null>(null)
  const colaboradorEfetivo = colaboradorInicial ?? colaborador

  useEffect(() => {
    if (!open || modoProgramar || !colaboradorEfetivo) {
      setFuncaoResolvidaId(null)
      return
    }
    let ativo = true
    listarFuncoes().then((funcoes) => {
      if (ativo) setFuncaoResolvidaId(resolverFuncao(colaboradorEfetivo.cargo, funcoes)?.id ?? null)
    })
    return () => {
      ativo = false
    }
  }, [open, modoProgramar, colaboradorEfetivo, listarFuncoes])

  const alvoTeto = useMemo(() => {
    if (modoProgramar) {
      return { departamentoId: solicitacao.departamento_id, funcaoId: solicitacao.funcao_id, ignorarId: solicitacao.id }
    }
    if (!colaboradorEfetivo) return null
    return {
      departamentoId: colaboradorEfetivo.departamento_id ?? null,
      funcaoId: funcaoResolvidaId,
      ignorarId: undefined,
    }
  }, [modoProgramar, solicitacao, colaboradorEfetivo, funcaoResolvidaId])

  // Validação do teto simultâneo (RN-01): aviso âmbar, NÃO bloqueia (decisão do RH)
  useEffect(() => {
    if (!open || !alvoTeto || !dataInicio || !dataFim || dataFim < dataInicio) {
      setAvaliacao(null)
      return
    }
    let ativo = true
    avaliarTeto({
      departamentoId: alvoTeto.departamentoId,
      funcaoId: alvoTeto.funcaoId,
      dataInicio,
      dataFim,
      ignorarId: alvoTeto.ignorarId,
    }).then((resultado) => {
      if (ativo) setAvaliacao(resultado)
    })
    return () => {
      ativo = false
    }
  }, [open, alvoTeto, dataInicio, dataFim, avaliarTeto])

  // Sugere 30 dias de gozo a partir do início (padrão CLT)
  const handleInicioChange = (valor: string) => {
    setDataInicio(valor)
    if (valor) {
      const fim = new Date(parseDataLocal(valor).getTime() + 29 * 24 * 60 * 60 * 1000)
      setDataFim(formatarDataInput(fim))
    } else {
      setDataFim('')
    }
  }

  const validar = (): boolean => {
    if (!modoProgramar && !colaboradorEfetivo) {
      setErro('Selecione o colaborador.')
      return false
    }
    if (!dataInicio || !dataFim) {
      setErro('Informe as datas de início e fim.')
      return false
    }
    if (dataFim < dataInicio) {
      setErro('A data fim não pode ser anterior à data início.')
      return false
    }
    setErro(null)
    return true
  }

  const concluir = async (ok: boolean) => {
    if (ok) {
      onOpenChange(false)
      await onSalvo?.()
    }
  }

  const handleProgramar = async () => {
    if (!validar()) return
    const entrada = {
      dataInicio,
      dataFim,
      diasAbono: abono ? 10 : 0,
      adiantamento13,
      parcelada,
    }
    if (modoProgramar) {
      await concluir(await programarFerias({ ...entrada, solicitacaoId: solicitacao.id }))
    } else {
      await concluir(
        await programarFerias({
          ...entrada,
          nova: {
            colaborador_id: colaboradorEfetivo!.id,
            data_inicio: dataInicio,
            data_fim: dataFim,
            descricao: observacao.trim() || null,
            pedido_colaborador: pedidoColaborador,
          },
        })
      )
    }
  }

  const handleSalvarPrevisao = async () => {
    if (!validar()) return
    await concluir(
      await adicionarPrevisao({
        colaborador_id: colaboradorEfetivo!.id,
        data_inicio: dataInicio,
        data_fim: dataFim,
        descricao: observacao.trim() || null,
        pedido_colaborador: pedidoColaborador,
      })
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{modoProgramar ? 'Programar férias' : 'Programar ou prever férias'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            {modoProgramar
              ? 'Confirme as datas e as condições do gozo. A solicitação passa a agendada/aprovada.'
              : 'Programe as férias já como agendadas ou salve como previsão de planejamento do RH (baixada automaticamente quando o período chegar via Flit).'}
          </p>

          {modoProgramar || colaboradorInicial ? (
            <div>
              <Label>Colaborador</Label>
              <p className="mt-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px] font-medium">
                {modoProgramar ? solicitacao.colaborador?.nome_completo ?? '-' : colaboradorInicial!.nome_completo}
              </p>
            </div>
          ) : (
            <AutocompleteColaborador label="Colaborador" onChange={setColaborador} somenteAtivos departamentoId={departamentoId} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => handleInicioChange(e.target.value)} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={abono} onChange={(e) => setAbono(e.target.checked)} />
              Abono (10 dias)
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={adiantamento13} onChange={(e) => setAdiantamento13(e.target.checked)} />
              Adiantamento 13º
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={parcelada} onChange={(e) => setParcelada(e.target.checked)} />
              Parcelada
            </label>
            {!modoProgramar && (
              <label className="flex items-center gap-2 text-[13px]" title="Marque quando o período foi pedido pelo próprio colaborador — o pedido tem prioridade na aprovação e o plano automático não altera">
                <input type="checkbox" checked={pedidoColaborador} onChange={(e) => setPedidoColaborador(e.target.checked)} />
                Pedido do próprio colaborador
              </label>
            )}
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

          {avaliacao?.excede && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-4" />
                Teto de ausência simultânea excedido (máx. {avaliacao.maxSimultaneos} no contrato+função)
              </p>
              <ul className="mt-1 list-inside list-disc">
                {avaliacao.conflitos.map((c) => (
                  <li key={c.id}>
                    {c.colaborador?.nome_completo ?? 'Colaborador'} ({formatarData(c.data_inicio)} a {formatarData(c.data_fim)})
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-amber-700">O aviso não bloqueia a programação — a decisão é do RH.</p>
            </div>
          )}

          {erro && <p className="text-[13px] text-red-600">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          {!modoProgramar && (
            <Button variant="outline" onClick={handleSalvarPrevisao} disabled={loading}>
              Salvar como previsão
            </Button>
          )}
          <Button variant="primary" onClick={handleProgramar} loading={loading}>
            Programar férias
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
