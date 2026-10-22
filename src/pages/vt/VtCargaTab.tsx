import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, FileSpreadsheet, FileUp, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { DepartamentoAutocomplete } from '@/components/DepartamentoAutocomplete'
import { formatarData } from '@/lib/utils'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { destinoFerias, rotuloCompetencia, type FeriasBloco } from '@/lib/vt/carga'
import { formatarCentavos } from '@/lib/vt/bilhetes'
import { useVtCarga, type ResultadoCargaColaborador } from '@/hooks/useVtCarga'
import { useVtCoberturas } from '@/hooks/useVtCoberturas'
import type { VtColaborador, VtDepartamento } from '@/hooks/useVt'
import type { VtBilhete, VtCobertura, VtTrajeto } from '@/types/vt'

// Aba Carga do VT (decisão da gestora, 21/10/2026 — plano §6): a fonte oficial
// é o relatório "Gestão de escalas" do Flit (Excel com o mês seguinte). A carga
// é dirigida pelas férias do mês (blocos [FR] do relatório): cada uma precisa
// de destino (quem cobre / sem cobertura) antes de gravar — portão. O titular
// de férias não entra (o [FR] nunca é dia trabalhado).

function situacaoDa(r: ResultadoCargaColaborador) {
  if (r.semEscala) return [<StatusBadge key="se" variant="neutral">Sem escala no relatório</StatusBadge>]
  const badges = []
  if (r.pendentes.length > 0) {
    badges.push(
      <StatusBadge key="pt" variant="warning">
        Falta confirmar trajeto: {r.pendentes.map((p) => p.rotulo).join(', ')}
      </StatusBadge>
    )
  }
  if (r.diasSemPostoIdentificado > 0) {
    badges.push(
      <span key="si" title={r.locaisNaoIdentificados.join('; ')}>
        <StatusBadge variant="warning">
          {r.diasSemPostoIdentificado} dias sem posto identificado
        </StatusBadge>
      </span>
    )
  }
  if (badges.length === 0) badges.push(<StatusBadge key="ok" variant="success">Pronto</StatusBadge>)
  return badges
}

/** Sufixo da linha de posto quando há dias de cobertura de férias. */
function sufixoCobertura(diasCobertura: number | undefined, dias: number): string {
  if (!diasCobertura) return ''
  return diasCobertura === dias ? ' (cobertura de férias)' : ` (${diasCobertura} em cobertura)`
}

interface VtCargaTabProps {
  colaboradores: VtColaborador[]
  departamentos: VtDepartamento[]
  trajetos: VtTrajeto[]
  bilhetes: VtBilhete[]
  dadosProntos: boolean
  usuarioId: string
  podeGerenciar: boolean
}

export function VtCargaTab({
  colaboradores,
  departamentos,
  trajetos,
  bilhetes,
  dadosProntos,
  usuarioId,
  podeGerenciar,
}: VtCargaTabProps) {
  const {
    resultados,
    ferias,
    competencia,
    nomeArquivo,
    foraDoVt,
    loading,
    importarRelatorio,
    gravarCargas,
    exportarExcel,
  } = useVtCarga()
  const { coberturas, listar: listarCoberturas, registrar, remover } = useVtCoberturas()

  const inputArquivoRef = useRef<HTMLInputElement>(null)
  const arquivoAtualRef = useRef<File | null>(null)
  const [gravando, setGravando] = useState(false)

  // Dialog de cobertura (avulsa ou vinculada a férias do relatório)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [feristaId, setFeristaId] = useState('')
  const [postoId, setPostoId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [observacao, setObservacao] = useState('')
  const [feriasVinculoId, setFeriasVinculoId] = useState<string | null>(null)
  const [salvandoCobertura, setSalvandoCobertura] = useState(false)
  const [excluindo, setExcluindo] = useState<VtCobertura | null>(null)
  const [semCoberturaDe, setSemCoberturaDe] = useState<FeriasBloco | null>(null)

  useEffect(() => {
    listarCoberturas()
  }, [listarCoberturas])

  const optantes = useMemo(() => colaboradores.filter((c) => c.vt_optante), [colaboradores])
  const nomeDo = useCallback(
    (colaboradorId: string | null | undefined) =>
      colaboradores.find((c) => c.id === colaboradorId)?.nome_completo ?? '—',
    [colaboradores]
  )
  const postoDoTitular = useCallback(
    (f: FeriasBloco): string => {
      const colab = colaboradores.find((c) => c.id === f.colaborador_id)
      return f.departamento_id ?? colab?.departamento_id ?? ''
    },
    [colaboradores]
  )

  const recalcular = useCallback(async () => {
    if (arquivoAtualRef.current && dadosProntos) {
      await importarRelatorio(arquivoAtualRef.current, { colaboradores, departamentos, trajetos, bilhetes })
    }
  }, [importarRelatorio, dadosProntos, colaboradores, departamentos, trajetos, bilhetes])

  const aoEscolherArquivo = async (arquivo: File | null) => {
    if (!arquivo) return
    arquivoAtualRef.current = arquivo
    await importarRelatorio(arquivo, { colaboradores, departamentos, trajetos, bilhetes })
  }

  /** Destino de cada bloco de férias do relatório (portão da gravação). */
  const destinos = useMemo(
    () => ferias.map((f) => ({ ferias: f, destino: destinoFerias(f, coberturas) })),
    [ferias, coberturas]
  )
  const feriasPendentes = destinos.filter((d) => d.destino.tipo === 'pendente').length

  const coberturasAvulsas = useMemo(() => {
    if (!competencia) return []
    const inicio = `${competencia}-01`
    const fim = inicio.slice(0, 8) + '31' // comparação de strings: basta cobrir o mês
    return coberturas.filter(
      (c) => !c.ferias_colaborador_id && c.data_inicio <= fim && c.data_fim >= inicio
    )
  }, [coberturas, competencia])

  const totais = useMemo(
    () => ({
      optantes: resultados.length,
      prontos: resultados.filter((r) => r.pendentes.length === 0 && r.diasSemPostoIdentificado === 0 && !r.semEscala).length,
      soma: resultados.reduce((acc, r) => acc + r.valor_centavos, 0),
    }),
    [resultados]
  )

  // Portão (decisão de 21/10/2026): férias sem destino ou qualquer pendência
  // de cálculo bloqueiam a gravação; calcular/mostrar segue liberado.
  const pendenciasPortao = useMemo(() => {
    const lista: string[] = []
    if (feriasPendentes > 0) lista.push(`${feriasPendentes} férias do mês sem destino — defina quem cobre ou marque sem cobertura`)
    const semTrajeto = resultados.filter((r) => r.pendentes.length > 0).length
    if (semTrajeto > 0) lista.push(`${semTrajeto} optante(s) com trajeto a confirmar`)
    const semPosto = resultados.filter((r) => r.diasSemPostoIdentificado > 0).length
    if (semPosto > 0) lista.push(`${semPosto} optante(s) com dias sem posto identificado`)
    const semEscala = resultados.filter((r) => r.semEscala).length
    if (semEscala > 0) lista.push(`${semEscala} optante(s) sem escala no relatório`)
    return lista
  }, [feriasPendentes, resultados])
  const bloqueado = pendenciasPortao.length > 0

  const gravar = async () => {
    if (!competencia) return
    setGravando(true)
    const { gravadas, puladas } = await gravarCargas(competencia, resultados, usuarioId)
    setGravando(false)
    if (gravadas > 0) toast.success(`${gravadas} carga(s) gravada(s) para ${rotuloCompetencia(competencia)}`)
    if (puladas > 0) toast.info(`${puladas} optante(s) pulados por pendência`)
    if (gravadas === 0 && puladas === 0) toast.info('Nada a gravar.')
  }

  const abrirDialogAvulso = () => {
    setFeristaId('')
    setPostoId('')
    setDataInicio(competencia ? `${competencia}-01` : '')
    setDataFim('')
    setObservacao('')
    setFeriasVinculoId(null)
    setDialogAberto(true)
  }

  const abrirDialogParaFerias = (f: FeriasBloco) => {
    setFeristaId('')
    setPostoId(postoDoTitular(f))
    setDataInicio(f.data_inicio)
    setDataFim(f.data_fim)
    setObservacao('')
    setFeriasVinculoId(f.colaborador_id)
    setDialogAberto(true)
  }

  const salvarCobertura = async () => {
    if (!feristaId || !postoId || !dataInicio || !dataFim) return
    setSalvandoCobertura(true)
    const ok = await registrar(
      {
        colaborador_id: feristaId,
        ferias_colaborador_id: feriasVinculoId,
        departamento_id: postoId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        observacao: observacao.trim() || null,
      },
      usuarioId
    )
    setSalvandoCobertura(false)
    if (ok) {
      setDialogAberto(false)
      await listarCoberturas()
      await recalcular()
    }
  }

  const declararSemCobertura = async () => {
    if (!semCoberturaDe) return
    const posto = postoDoTitular(semCoberturaDe)
    if (!posto) {
      toast.error('Sem posto identificado para estas férias — use "Quem cobre?" e informe o posto')
      setSemCoberturaDe(null)
      return
    }
    const ok = await registrar(
      {
        colaborador_id: null,
        ferias_colaborador_id: semCoberturaDe.colaborador_id,
        departamento_id: posto,
        data_inicio: semCoberturaDe.data_inicio,
        data_fim: semCoberturaDe.data_fim,
        observacao: 'Sem cobertura',
      },
      usuarioId
    )
    setSemCoberturaDe(null)
    if (ok) {
      await listarCoberturas()
      await recalcular()
    }
  }

  const confirmarExclusao = async () => {
    if (!excluindo) return
    const ok = await remover(excluindo.id)
    setExcluindo(null)
    if (ok) {
      await listarCoberturas()
      await recalcular()
    }
  }

  const botaoImportar = (rotulo: string, outline = false) => (
    <>
      <input
        ref={inputArquivoRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          void aoEscolherArquivo(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <ModuleButton
        variant={outline ? 'outline' : 'primary'}
        size="sm"
        onClick={() => inputArquivoRef.current?.click()}
        disabled={loading}
      >
        <FileUp className="size-4" />
        {loading ? 'Lendo relatório...' : rotulo}
      </ModuleButton>
    </>
  )

  if (!competencia) {
    return (
      <ModuleCard>
        <EmptyState
          icon={<FileUp className="size-6" />}
          title="Carga pela Gestão de escalas"
          description='Importe o relatório "Gestão de escalas" do Flit (Excel, gerado com o mês seguinte programado) para calcular a carga de VT.'
        />
        <div className="flex justify-center">{botaoImportar('Importar Gestão de escalas (Flit)')}</div>
      </ModuleCard>
    )
  }

  return (
    <div className="space-y-4">
      <ModuleCard>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[13px] text-muted-foreground">
            Relatório: <strong className="text-foreground">{nomeArquivo}</strong>
            {' · '}Competência:{' '}
            <strong className="text-foreground tabular-nums">{rotuloCompetencia(competencia)}</strong>
          </div>
          <div className="ml-auto flex gap-2">
            {botaoImportar('Importar outro relatório', true)}
            {podeGerenciar && (
              <>
                <ModuleButton
                  size="sm"
                  variant="outline"
                  onClick={gravar}
                  disabled={loading || gravando || bloqueado || resultados.length === 0}
                  title={bloqueado ? 'Resolva as pendências do banner para gravar' : undefined}
                >
                  <Save className="size-4" />
                  {gravando ? 'Gravando...' : 'Gravar carga'}
                </ModuleButton>
                <ModuleButton
                  size="sm"
                  variant="outline"
                  onClick={() => exportarExcel(competencia, resultados)}
                  disabled={loading || resultados.length === 0}
                >
                  <FileSpreadsheet className="size-4" />
                  Baixar Excel
                </ModuleButton>
              </>
            )}
          </div>
        </div>
        {bloqueado && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <p className="font-semibold">A gravação está bloqueada:</p>
            <ul className="mt-1 list-disc pl-5">
              {pendenciasPortao.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {foraDoVt > 0 && (
          <p className="mt-3 text-[12px] text-muted-foreground">
            {foraDoVt} pessoa(s) do relatório fora do VT (sem match no cadastro ou não optantes) — ignoradas.
          </p>
        )}
      </ModuleCard>

      <ModuleCard
        title="Férias no mês"
        description='Blocos [FR] do relatório — cada um precisa de destino: quem cobre (ferista) ou a declaração "sem cobertura"'
      >
        {destinos.length === 0 ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">Nenhuma férias no mês do relatório.</p>
            {podeGerenciar && (
              <ModuleButton size="sm" variant="outline" onClick={abrirDialogAvulso}>
                <Plus className="size-4" />
                Registrar cobertura
              </ModuleButton>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5">Titular</th>
                    <th className="px-4 py-2.5">Período</th>
                    <th className="px-4 py-2.5">Posto</th>
                    <th className="px-4 py-2.5">Destino</th>
                    {podeGerenciar && <th className="px-4 py-2.5 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {destinos.map(({ ferias: f, destino }) => (
                    <tr key={`${f.colaborador_id}|${f.data_inicio}`} className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2 font-medium text-foreground">{nomeDo(f.colaborador_id)}</td>
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">
                        {formatarData(f.data_inicio)} a {formatarData(f.data_fim)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {nomeCurtoDepartamentoFuzzy(departamentos, postoDoTitular(f) || null)}
                      </td>
                      <td className="px-4 py-2">
                        {destino.tipo === 'coberta' && (
                          <StatusBadge variant="success">
                            Coberta por {nomeDo(destino.cobertura.colaborador_id)}
                          </StatusBadge>
                        )}
                        {destino.tipo === 'sem_cobertura' && (
                          <StatusBadge variant="neutral">Sem cobertura</StatusBadge>
                        )}
                        {destino.tipo === 'pendente' && (
                          <StatusBadge variant="warning">PENDENTE</StatusBadge>
                        )}
                      </td>
                      {podeGerenciar && (
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">
                            {destino.tipo === 'pendente' ? (
                              <>
                                <ModuleButton size="sm" variant="outline" onClick={() => abrirDialogParaFerias(f)}>
                                  Quem cobre?
                                </ModuleButton>
                                <ModuleButton size="sm" variant="ghost" onClick={() => setSemCoberturaDe(f)}>
                                  Sem cobertura
                                </ModuleButton>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                                title="Desfazer o destino"
                                onClick={() => setExcluindo(destino.cobertura)}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {podeGerenciar && (
              <div className="mt-3 flex justify-end">
                <ModuleButton size="sm" variant="ghost" onClick={abrirDialogAvulso}>
                  <Plus className="size-4" />
                  Registrar cobertura avulsa (fora de férias)
                </ModuleButton>
              </div>
            )}
          </>
        )}
        {coberturasAvulsas.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Coberturas avulsas no mês
            </p>
            <div className="space-y-1">
              {coberturasAvulsas.map((c) => (
                <div key={c.id} className="flex items-center gap-3 text-[13px] text-muted-foreground">
                  <span className="font-medium text-foreground">{nomeDo(c.colaborador_id)}</span>
                  <span>{nomeCurtoDepartamentoFuzzy(departamentos, c.departamento_id)}</span>
                  <span className="tabular-nums">
                    {formatarData(c.data_inicio)} a {formatarData(c.data_fim)}
                  </span>
                  {c.observacao && <span>— {c.observacao}</span>}
                  {podeGerenciar && (
                    <button
                      type="button"
                      className="rounded-md p-1 text-red-600 hover:bg-red-50"
                      title="Excluir cobertura"
                      onClick={() => setExcluindo(c)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </ModuleCard>

      <ModuleCard
        title={`Carga de ${rotuloCompetencia(competencia)}`}
        description={
          resultados.length > 0
            ? `${totais.optantes} optantes · ${totais.prontos} prontos · total a creditar ${formatarCentavos(totais.soma)}`
            : undefined
        }
      >
        {resultados.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="size-6" />}
            description={
              loading
                ? 'Calculando a carga pelo relatório...'
                : 'Nenhum optante casou com o relatório. Marque os optantes na aba Colaboradores.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Postos do mês</th>
                  <th className="px-4 py-3 text-right">Total a creditar</th>
                  <th className="px-4 py-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r) => {
                  const feriasDele = ferias.filter((f) => f.colaborador_id === r.colaborador_id)
                  return (
                    <tr key={r.colaborador_id} className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2.5 font-medium text-foreground">{r.nome}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.detalhe.length === 0 && feriasDele.length === 0 ? (
                          '—'
                        ) : (
                          <div className="space-y-0.5">
                            {r.detalhe.map((d) => (
                              <div key={d.departamento_id} className="tabular-nums">
                                {d.posto} — {d.dias} dias × {formatarCentavos(d.custo_dia_centavos)} ={' '}
                                {formatarCentavos(d.subtotal_centavos)}
                                {sufixoCobertura(d.dias_cobertura, d.dias)}
                              </div>
                            ))}
                            {feriasDele.map((f) => (
                              <div key={`${f.data_inicio}`} className="text-[12px] text-muted-foreground/80">
                                Férias {formatarData(f.data_inicio)}–{formatarData(f.data_fim)} — {r.diasEmFerias}{' '}
                                dias fora da carga
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {formatarCentavos(r.valor_centavos)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">{situacaoDa(r)}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 text-[13px] font-semibold">
                  <td className="px-4 py-2.5">{totais.optantes} optantes</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{totais.prontos} prontos</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatarCentavos(totais.soma)}</td>
                  <td className="px-4 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </ModuleCard>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {feriasVinculoId ? 'Quem cobre as férias?' : 'Registrar cobertura'}
            </DialogTitle>
            <DialogDescription>
              {feriasVinculoId
                ? 'O ferista trabalha no posto das férias no período — a carga usa esse posto, não o do relatório.'
                : 'Cobertura avulsa (ex.: transferência temporária). A carga usa o posto coberto no período.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Ferista (optante)</Label>
              <Select value={feristaId} onValueChange={setFeristaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o ferista" />
                </SelectTrigger>
                <SelectContent>
                  {optantes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_completo} — {nomeCurtoDepartamentoFuzzy(departamentos, c.departamento_id, c.departamento)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Posto coberto</Label>
              <DepartamentoAutocomplete
                value={postoId}
                onChange={setPostoId}
                clearValue=""
                clearLabel="Selecione o posto"
                placeholder="Buscar posto..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>De</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Até</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observação (opcional)</Label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: cobre as férias do João"
              />
            </div>
          </div>
          <DialogFooter>
            <ModuleButton variant="outline" onClick={() => setDialogAberto(false)} disabled={salvandoCobertura}>
              Cancelar
            </ModuleButton>
            <ModuleButton
              onClick={salvarCobertura}
              disabled={!feristaId || !postoId || !dataInicio || !dataFim || salvandoCobertura}
            >
              {salvandoCobertura ? 'Salvando...' : 'Registrar'}
            </ModuleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!semCoberturaDe}
        onOpenChange={() => setSemCoberturaDe(null)}
        icon={<CalendarClock className="size-6 text-slate-600" />}
        iconClassName="bg-slate-100"
        title="Férias sem cobertura?"
        description={
          semCoberturaDe
            ? `Confirmar que as férias de ${nomeDo(semCoberturaDe.colaborador_id)} ficam sem cobertura? (ex.: o ferista é quem está de férias)`
            : ''
        }
        confirmLabel="Sim, sem cobertura"
        onConfirm={declararSemCobertura}
      />

      <ConfirmDialog
        open={!!excluindo}
        onOpenChange={() => setExcluindo(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Excluir cobertura?"
        description={
          excluindo
            ? `${nomeDo(excluindo.colaborador_id ?? excluindo.ferias_colaborador_id)} — ${nomeCurtoDepartamentoFuzzy(departamentos, excluindo.departamento_id)} de ${formatarData(excluindo.data_inicio)} a ${formatarData(excluindo.data_fim)}. A carga volta a usar o relatório para esses dias.`
            : ''
        }
        confirmLabel="Sim, excluir"
        onConfirm={confirmarExclusao}
        destructive
      />
    </div>
  )
}
