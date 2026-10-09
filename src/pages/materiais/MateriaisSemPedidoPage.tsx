import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ClipboardPaste, LockOpen } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { DataTable } from '@/components/corh/DataTable'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { Selo } from '@/components/materiais/filas'
import { rotuloCompetencia } from '@/components/materiais/rotulosFilas'
import { MateriaisShell } from './MateriaisShell'
import { useAuth } from '@/hooks/useAuth'
import { useMateriaisContratos } from '@/hooks/useMateriaisContratos'
import { useMateriaisSemPedido, type ContratoSemPedido } from '@/hooks/useMateriaisPedidos'
import { podePreencherPeloKitMateriais, podeReabrirPedidoMateriais } from '@/lib/permissoes'
import { hojeBrasil } from '@/lib/utils'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { janelaPedido } from '@/lib/materiais/datas'

// "Contratos que ainda não pediram" (docs/PLANO_MATERIAIS_FASE1.md §6). Nada é
// gerado automaticamente: o aviso começa no dia configurado (materiais_config,
// padrão 10) e fica vermelho depois do prazo. "Preencher pelo kit" só depois
// de cobrar o líder; "Reabrir link" libera o envio fora da janela.

export function MateriaisSemPedidoPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const nivel = user?.nivel_acesso
  const podePreencher = nivel ? podePreencherPeloKitMateriais(nivel) : false
  const podeReabrir = nivel ? podeReabrirPedidoMateriais(nivel) : false

  const { lista, config, loading, estruturaPendente, carregar, preencherPeloKit, reabrir } = useMateriaisSemPedido()
  const contratosHook = useMateriaisContratos()
  const { carregar: carregarContratos } = contratosHook
  const hoje = hojeBrasil()
  const janela = janelaPedido({ hoje, diaLimite: config.dia_limite, diaAviso: config.dia_aviso })
  const competencia = janela.competencia

  const [preencher, setPreencher] = useState<ContratoSemPedido | null>(null)
  const [reabertura, setReabertura] = useState<{ contrato: ContratoSemPedido; ate: string; motivo: string } | null>(null)

  useEffect(() => {
    carregar(competencia)
    carregarContratos()
  }, [carregar, carregarContratos, competencia])

  const contratoPorId = useMemo(() => new Map(contratosHook.contratos.map((c) => [c.id, c])), [contratosHook.contratos])
  const prazoDdMm = `${janela.prazo.slice(8, 10)}/${janela.prazo.slice(5, 7)}`
  const tom =
    janela.nivelAviso === 'vermelho'
      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
      : janela.nivelAviso === 'ambar'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
        : 'border-border bg-card text-muted-foreground'

  const confirmarPreencher = async () => {
    if (!preencher) return
    const id = await preencherPeloKit(preencher.contrato_id, competencia)
    setPreencher(null)
    if (id) navigate(`/materiais/pedidos/${id}`)
  }

  const confirmarReabrir = async () => {
    if (!reabertura) return
    const ok = await reabrir(reabertura.contrato.contrato_id, competencia, reabertura.ate, reabertura.motivo)
    if (ok) {
      setReabertura(null)
      carregar(competencia)
    }
  }

  return (
    <MateriaisShell>
      <PageHeader
        showBackButton={false}
        title="Contratos que ainda não pediram"
        description={`Pedido de ${rotuloCompetencia(competencia)}. Nada é gerado automaticamente: cobre o líder primeiro.`}
      />

      {estruturaPendente ? (
        <EstruturaPendente />
      ) : (
        <div className="space-y-4">
          <div className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${tom}`}>
            {janela.nivelAviso === 'normal' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
            <p>
              {janela.nivelAviso === 'vermelho'
                ? `O prazo terminou em ${prazoDdMm}. Para o líder ainda enviar, use "Reabrir link"; se não houver retorno, "Preencher pelo kit".`
                : janela.nivelAviso === 'ambar'
                  ? `Faltam ${janela.diasParaPrazo} dia(s) para o prazo (${prazoDdMm}). Ligue para os líderes da lista.`
                  : `Prazo até ${prazoDdMm}. O aviso começa no dia ${config.dia_aviso}.`}
            </p>
          </div>

          <DataTable title="Sem pedido no mês" count={lista.length} minWidth={880}>
            {loading ? (
              <LoadingScreen className="h-48" />
            ) : lista.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="size-6" />} title="Todos pediram" description="Nenhum contrato pendente neste mês." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Rota</TableHead>
                    <TableHead>Último responsável</TableHead>
                    <TableHead>Link</TableHead>
                    {(podePreencher || podeReabrir) && <TableHead className="w-72" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((c) => {
                    const contrato = contratoPorId.get(c.contrato_id)
                    return (
                      <TableRow key={c.contrato_id} className={`hover:bg-accent/40 ${janela.nivelAviso === 'vermelho' ? 'bg-red-50/50 dark:bg-red-950/10' : janela.nivelAviso === 'ambar' ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}`}>
                        <TableCell>
                          <p className="font-medium">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {nomeCurtoDepartamentoFuzzy(contratosHook.departamentos, c.departamento_id)}
                            {contrato && !contrato.recebe_limpeza ? ' · sem limpeza' : ''}
                          </p>
                          {c.pedido_id && <Selo tom="azul">já pediu uniforme/EPI — faltam os produtos</Selo>}
                        </TableCell>
                        <TableCell className="tabular-nums">{c.rota ?? '—'}</TableCell>
                        <TableCell className="text-sm">{c.ultimo_responsavel ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {!c.tem_link ? <Selo tom="cinza">sem link</Selo> : c.link_aberto_no_mes ? <Selo>abriu, não enviou</Selo> : <Selo tom="cinza">não abriu</Selo>}
                          </div>
                        </TableCell>
                        {(podePreencher || podeReabrir) && (
                          <TableCell>
                            <div className="flex flex-wrap justify-end gap-1">
                              {podeReabrir && (
                                <Button variant="outline" size="sm" onClick={() => setReabertura({ contrato: c, ate: hoje, motivo: '' })}>
                                  <LockOpen className="size-4" /> Reabrir link
                                </Button>
                              )}
                              {podePreencher && (
                                <Button size="sm" onClick={() => setPreencher(c)}>
                                  <ClipboardPaste className="size-4" /> Preencher pelo kit
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </DataTable>
        </div>
      )}

      <ConfirmDialog
        open={!!preencher}
        onOpenChange={(a) => !a && setPreencher(null)}
        icon={<ClipboardPaste className="size-6 text-primary" />}
        iconClassName="bg-sky-50"
        title="Preencher pelo kit?"
        description={
          preencher
            ? `${preencher.nome}: o pedido de ${rotuloCompetencia(competencia)} será criado com o Kit Mensal e marcado "preenchido pelo escritório".${
                preencher.pedido_id ? ' Os uniformes/EPI/crachás que o líder já enviou continuam no mesmo pedido.' : ''
              } Use só depois de cobrar o líder.`
            : ''
        }
        confirmLabel="Preencher"
        onConfirm={confirmarPreencher}
      />

      <ConfirmDialog
        open={!!reabertura}
        onOpenChange={(a) => !a && setReabertura(null)}
        icon={<LockOpen className="size-6 text-primary" />}
        iconClassName="bg-sky-50"
        title="Reabrir o link do líder"
        description={reabertura ? `${reabertura.contrato.nome}: o link aceita envio até a data escolhida.` : ''}
        confirmLabel="Reabrir"
        confirmDisabled={!reabertura?.motivo.trim() || !reabertura?.ate || reabertura.ate < hoje}
        onConfirm={confirmarReabrir}
      >
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="reabrir-ate">Aberto até</Label>
            <Input
              id="reabrir-ate"
              type="date"
              min={hoje}
              value={reabertura?.ate ?? ''}
              onChange={(e) => setReabertura((r) => (r ? { ...r, ate: e.target.value } : r))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reabrir-motivo">Motivo</Label>
            <Textarea
              id="reabrir-motivo"
              rows={2}
              value={reabertura?.motivo ?? ''}
              onChange={(e) => setReabertura((r) => (r ? { ...r, motivo: e.target.value } : r))}
            />
          </div>
        </div>
      </ConfirmDialog>
    </MateriaisShell>
  )
}
