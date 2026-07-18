import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Filters } from '@/components/corh/Filters'
import { DataTable } from '@/components/corh/DataTable'
import { Button } from '@/components/corh/Button'
import { useEscalasDiario, calcularCompetencia, type Competencia } from '@/hooks/useEscalasDiario'
import XLSX from '@e965/xlsx'
import { useEscalasLocais } from '@/hooks/useEscalasLocais'
import { useColaboradores } from '@/hooks/useColaboradores'
import { nomeCurtoLocal, removerAcentos } from '@/lib/utils'
import { toast } from 'sonner'
import type { LocalTrabalhoDiario } from '@/types/database'
import {
  CheckSquare,
  AlertCircle,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDown,
  CalendarRange,
} from 'lucide-react'
import { FONTES_INFO } from './escalas.constants'

type FiltroEscalas = {
  modoPeriodo: 'competencia' | 'livre'
  ano: number
  mes: number
  dataInicio: string
  dataFim: string
  colaboradorId: string
  localId: string
  status: 'todos' | 'identificados' | 'pendentes'
}

const filtroInicial: FiltroEscalas = {
  modoPeriodo: 'competencia',
  ano: new Date().getFullYear(),
  mes: new Date().getMonth() + 1,
  dataInicio: '',
  dataFim: '',
  colaboradorId: '',
  localId: '',
  status: 'todos',
}

export function AbaEscalasDiario() {
  const navigate = useNavigate()
  const { dias, loading, listar, listarTodos, confirmarManual, aplicarEmLote, buscarHistoricoColaborador } = useEscalasDiario()
  const { locais, listar: listarLocais } = useEscalasLocais()
  const { colaboradores, listarResumido: listarColaboradores } = useColaboradores()

  const [input, setInput] = useState<FiltroEscalas>(filtroInicial)
  const [aplicado, setAplicado] = useState<FiltroEscalas>(filtroInicial)

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [localLote, setLocalLote] = useState('')
  const [observacaoLote, setObservacaoLote] = useState('')
  const [diaEditando, setDiaEditando] = useState<LocalTrabalhoDiario | null>(null)
  const [observacaoManual, setObservacaoManual] = useState('')
  const [historicoColaborador, setHistoricoColaborador] = useState<LocalTrabalhoDiario[]>([])

  const [ordenacao, setOrdenacao] = useState<{ coluna: 'data' | 'colaborador'; direcao: 'asc' | 'desc' }>({
    coluna: 'data',
    direcao: 'asc',
  })

  useEffect(() => {
    listarLocais()
    listarColaboradores()
  }, [listarLocais, listarColaboradores])

  const competencia: Competencia = useMemo(() => calcularCompetencia(aplicado.ano, aplicado.mes), [aplicado.ano, aplicado.mes])

  const obterCompetenciaAplicada = useCallback((): Competencia | null => {
    if (aplicado.modoPeriodo === 'competencia') {
      return calcularCompetencia(aplicado.ano, aplicado.mes)
    }
    if (aplicado.dataInicio && aplicado.dataFim) {
      return {
        ano: aplicado.ano,
        mes: aplicado.mes,
        inicio: aplicado.dataInicio,
        fim: aplicado.dataFim,
        label: `${aplicado.dataInicio} a ${aplicado.dataFim}`,
      }
    }
    return null
  }, [aplicado])

  const ordenarDias = useCallback(
    (dados: LocalTrabalhoDiario[]) => {
      const sorted = [...dados]
      sorted.sort((a, b) => {
        if (ordenacao.coluna === 'data') {
          return ordenacao.direcao === 'asc' ? a.data.localeCompare(b.data) : b.data.localeCompare(a.data)
        }
        const nomeA = a.colaborador?.nome_completo || ''
        const nomeB = b.colaborador?.nome_completo || ''
        return ordenacao.direcao === 'asc' ? nomeA.localeCompare(nomeB) : nomeB.localeCompare(nomeA)
      })
      return sorted
    },
    [ordenacao]
  )

  const obterFiltrosAplicados = useCallback(() => ({
    colaboradorId: aplicado.colaboradorId,
    localTrabalhoId: aplicado.localId,
    status: aplicado.status,
  }), [aplicado])

  const buscarDados = useCallback(async (): Promise<LocalTrabalhoDiario[]> => {
    const periodo = obterCompetenciaAplicada()
    if (!periodo) return []
    const dados = await listar(periodo, obterFiltrosAplicados())
    return ordenarDias(dados)
  }, [obterCompetenciaAplicada, obterFiltrosAplicados, listar, ordenarDias])

  const buscarDadosFiltrados = useCallback(async (): Promise<LocalTrabalhoDiario[]> => {
    const periodo = obterCompetenciaAplicada()
    if (!periodo) return []
    const dados = await listarTodos(periodo, obterFiltrosAplicados())
    return ordenarDias(dados)
  }, [obterCompetenciaAplicada, obterFiltrosAplicados, listarTodos, ordenarDias])

  const executarBusca = useCallback(async () => {
    setSelecionados(new Set())
    await buscarDados()
  }, [buscarDados])

  useEffect(() => {
    executarBusca()
  }, [executarBusca])

  useEffect(() => {
    if (diaEditando?.colaborador_id) {
      buscarHistoricoColaborador(diaEditando.colaborador_id, 10).then(setHistoricoColaborador)
    } else {
      setHistoricoColaborador([])
    }
  }, [diaEditando, buscarHistoricoColaborador])

  const diasOrdenados = useMemo(() => ordenarDias(dias), [dias, ordenarDias])

  const toggleOrdenacao = (coluna: 'data' | 'colaborador') => {
    setOrdenacao((atual) => ({
      coluna,
      direcao: atual.coluna === coluna && atual.direcao === 'asc' ? 'desc' : 'asc',
    }))
  }

  const toggleSelecao = (id: string) => {
    const novo = new Set(selecionados)
    if (novo.has(id)) novo.delete(id)
    else novo.add(id)
    setSelecionados(novo)
  }

  const toggleTodos = () => {
    if (selecionados.size === dias.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(dias.map((d) => d.id)))
    }
  }

  const recarregar = executarBusca

  const handleConfirmarLote = async () => {
    if (!localLote || selecionados.size === 0) return
    const sucesso = await aplicarEmLote(Array.from(selecionados), localLote, observacaoLote)
    if (sucesso) {
      setSelecionados(new Set())
      setLocalLote('')
      setObservacaoLote('')
      recarregar()
    }
  }

  const handleConfirmarManual = async () => {
    if (!diaEditando || !localLote) return
    const sucesso = await confirmarManual(diaEditando.id, localLote, observacaoManual)
    if (sucesso) {
      setDiaEditando(null)
      setLocalLote('')
      setObservacaoManual('')
      recarregar()
    }
  }

  const abrirModal = (dia: LocalTrabalhoDiario) => {
    setDiaEditando(dia)
    setLocalLote(dia.local_trabalho_id || '')
    setObservacaoManual(dia.observacao || '')
  }

  const fecharModal = () => {
    setDiaEditando(null)
    setLocalLote('')
    setObservacaoManual('')
    setHistoricoColaborador([])
  }

  const aplicarFiltros = () => setAplicado(input)

  const limparFiltros = () => {
    setInput(filtroInicial)
    setAplicado(filtroInicial)
  }

  const pendentes = useMemo(() => dias.filter((d) => !d.local_trabalho_id).length, [dias])

  const locaisRecentes = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; nome_curto: string | null; count: number }>()
    for (const h of historicoColaborador) {
      if (!h.local_trabalho) continue
      const id = h.local_trabalho.id
      if (!map.has(id)) {
        map.set(id, { id, nome: h.local_trabalho.nome, nome_curto: h.local_trabalho.nome_curto, count: 0 })
      }
      map.get(id)!.count++
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [historicoColaborador])

  const exportarExcel = async () => {
    try {
      const dados = await buscarDadosFiltrados()
      if (dados.length === 0) {
        toast.info('Nenhum registro para exportar. Aplique um filtro primeiro.')
        return
      }

      const linhas = dados.map((d) => ({
        Dia: new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR'),
        Colaborador: `${d.colaborador?.nome_completo || ''} (${d.colaborador?.matricula || '-'})`,
        'Local de Trabalho': nomeCurtoLocal(d.local_trabalho) || 'Não identificado',
        Fonte: FONTES_INFO[d.fonte].label,
        Observacao: d.observacao || '',
      }))

      const worksheet = XLSX.utils.json_to_sheet(linhas)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Escalas')
      XLSX.writeFile(workbook, `escalas_${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success(`${linhas.length} registro(s) exportado(s) para Excel.`)
    } catch (err) {
      console.error('Erro ao exportar Excel:', err)
      toast.error('Erro ao exportar Excel')
    }
  }

  const exportarPDF = async () => {
    try {
      const dados = await buscarDadosFiltrados()
      if (dados.length === 0) {
        toast.info('Nenhum registro para exportar. Aplique um filtro primeiro.')
        return
      }

      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const doc = new jsPDF()

      const mesesNomes = [
        'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
      ]

      const chaveMesCompetencia = (data: string): string => {
        const [ano, mes, dia] = data.split('-').map(Number)
        if (dia >= 20) {
          const proximoMes = mes === 12 ? 1 : mes + 1
          const proximoAno = mes === 12 ? ano + 1 : ano
          return `${proximoAno}-${String(proximoMes).padStart(2, '0')}`
        }
        return `${ano}-${String(mes).padStart(2, '0')}`
      }

      const grupos = new Map<string, LocalTrabalhoDiario[]>()
      for (const dia of dados) {
        const chave = chaveMesCompetencia(dia.data)
        if (!grupos.has(chave)) grupos.set(chave, [])
        grupos.get(chave)!.push(dia)
      }

      const meses = Array.from(grupos.keys()).sort()

      meses.forEach((chave, index) => {
        if (index > 0) doc.addPage()
        const [ano, mes] = chave.split('-').map(Number)
        doc.setFontSize(16)
        doc.text(removerAcentos(`Escalas / Local de Trabalho - ${mesesNomes[mes - 1]}/${ano}`), 14, 20)

        const data = grupos.get(chave)!.map((d) => [
          removerAcentos(new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR')),
          removerAcentos(`${d.colaborador?.nome_completo || ''} (${d.colaborador?.matricula || '-'})`),
          removerAcentos(nomeCurtoLocal(d.local_trabalho) || 'Nao identificado'),
          removerAcentos(FONTES_INFO[d.fonte].label),
        ])

        autoTable(doc, {
          head: [['Dia', 'Colaborador', 'Local de Trabalho', 'Fonte']],
          body: data,
          startY: 30,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [59, 130, 246] },
        })
      })

      doc.save(`escalas_${new Date().toISOString().slice(0, 10)}.pdf`)
      toast.success(`${dados.length} registro(s) exportado(s) para PDF.`)
    } catch (err) {
      console.error('Erro ao exportar PDF:', err)
      toast.error('Erro ao exportar PDF')
    }
  }

  return (
    <div className="space-y-5">
      <Filters onApply={aplicarFiltros} onClear={limparFiltros} loading={loading} className="space-y-4">
        <div className="flex items-center gap-4 md:col-span-2 lg:col-span-4">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="radio"
              checked={input.modoPeriodo === 'competencia'}
              onChange={() => setInput((v) => ({ ...v, modoPeriodo: 'competencia' }))}
            />
            Competência (20 a 19)
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="radio"
              checked={input.modoPeriodo === 'livre'}
              onChange={() => setInput((v) => ({ ...v, modoPeriodo: 'livre' }))}
            />
            Período livre
          </label>
        </div>

        {input.modoPeriodo === 'competencia' ? (
          <>
            <div>
              <Label>Ano</Label>
              <Input type="number" value={input.ano} onChange={(e) => setInput((v) => ({ ...v, ano: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Mês</Label>
              <Select value={String(input.mes)} onValueChange={(v) => setInput((s) => ({ ...s, mes: Number(v) }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>{m.toString().padStart(2, '0')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex items-end">
              <p className="w-full rounded-lg bg-muted/50 p-2.5 text-[13px] text-muted-foreground">
                Competência: <strong className="text-foreground">{competencia.label}</strong> ({competencia.inicio} a {competencia.fim})
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <Label>Data início</Label>
              <Input type="date" value={input.dataInicio} onChange={(e) => setInput((v) => ({ ...v, dataInicio: e.target.value }))} />
            </div>
            <div>
              <Label>Data fim</Label>
              <Input type="date" value={input.dataFim} onChange={(e) => setInput((v) => ({ ...v, dataFim: e.target.value }))} />
            </div>
          </>
        )}

        <div>
          <Label>Colaborador</Label>
          <Select value={input.colaboradorId || 'todos'} onValueChange={(v) => setInput((s) => ({ ...s, colaboradorId: v === 'todos' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {colaboradores.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome_completo} ({c.matricula})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Local</Label>
          <Select value={input.localId || 'todos'} onValueChange={(v) => setInput((s) => ({ ...s, localId: v === 'todos' ? '' : v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {locais.map((l) => (
                <SelectItem key={l.id} value={l.id}>{nomeCurtoLocal(l)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={input.status} onValueChange={(v) => setInput((s) => ({ ...s, status: v as FiltroEscalas['status'] }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="identificados">Identificados</SelectItem>
              <SelectItem value="pendentes">Não identificados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-4">
          <Button variant="outline" size="sm" onClick={exportarExcel}>
            <FileSpreadsheet className="size-4" /> Exportar Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportarPDF}>
            <FileDown className="size-4" /> Exportar PDF
          </Button>
        </div>
      </Filters>

      {pendentes > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-700">
          <AlertCircle className="size-4" />
          <span>{pendentes} dia(s) aguardando confirmação manual.</span>
        </div>
      )}

      {selecionados.size > 0 && (
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-wrap items-end gap-4 pt-5">
            <div>
              <Label>Aplicar local em {selecionados.size} dia(s)</Label>
              <Select value={localLote} onValueChange={setLocalLote}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione o local" />
                </SelectTrigger>
                <SelectContent>
                  {locais.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{nomeCurtoLocal(l)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px] flex-1">
              <Label>Observação</Label>
              <Input value={observacaoLote} onChange={(e) => setObservacaoLote(e.target.value)} placeholder="Ex: Confirmado via geolocalização no Flit" />
            </div>
            <Button onClick={handleConfirmarLote} disabled={!localLote}>
              <CheckSquare className="size-4" /> Confirmar em lote
            </Button>
          </CardContent>
        </Card>
      )}

      <DataTable title="Local de trabalho por dia" count={dias.length}>
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : dias.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
              <CalendarRange className="size-6" strokeWidth={1.8} />
            </div>
            <p className="text-[13px] text-muted-foreground">Nenhum registro para os filtros selecionados.</p>
            <Button onClick={() => navigate('/escalas/importar')}>
              Importar escala
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selecionados.size === dias.length && dias.length > 0} onCheckedChange={toggleTodos} />
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleOrdenacao('data')}>
                  <div className="flex items-center gap-1">
                    Dia
                    {ordenacao.coluna === 'data' ? (
                      ordenacao.direcao === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleOrdenacao('colaborador')}>
                  <div className="flex items-center gap-1">
                    Colaborador
                    {ordenacao.coluna === 'colaborador' ? (
                      ordenacao.direcao === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                    ) : (
                      <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    )}
                  </div>
                </TableHead>
                <TableHead>Local de Trabalho</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diasOrdenados.map((dia) => (
                <TableRow key={dia.id}>
                  <TableCell>
                    <Checkbox checked={selecionados.has(dia.id)} onCheckedChange={() => toggleSelecao(dia.id)} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {new Date(dia.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="font-medium">
                    {dia.colaborador?.nome_completo} <span className="text-muted-foreground/70">({dia.colaborador?.matricula})</span>
                  </TableCell>
                  <TableCell>
                    {dia.local_trabalho ? (
                      <span className="inline-flex items-center rounded-lg border border-border bg-muted/50 px-2 py-1 text-xs text-foreground">
                        {nomeCurtoLocal(dia.local_trabalho)}
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground">Não identificado</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => abrirModal(dia)}>
                      {dia.local_trabalho_id ? 'Alterar' : 'Confirmar'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>

      <Dialog open={!!diaEditando} onOpenChange={(open) => !open && fecharModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{diaEditando?.local_trabalho_id ? 'Alterar local' : 'Confirmar local'}</DialogTitle>
          </DialogHeader>
          {diaEditando && (
            <div className="space-y-4 py-2">
              <p className="text-[13px] font-medium">
                {diaEditando.colaborador?.nome_completo} <span className="text-muted-foreground">({diaEditando.colaborador?.matricula})</span> — {new Date(diaEditando.data + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>

              {locaisRecentes.length > 0 && (
                <div className="space-y-2">
                  <Label>Locais usados recentemente por este colaborador</Label>
                  <div className="flex flex-wrap gap-2">
                    {locaisRecentes.map((local) => (
                      <Button
                        key={local.id}
                        type="button"
                        size="sm"
                        variant={localLote === local.id ? 'primary' : 'outline'}
                        onClick={() => setLocalLote(local.id)}
                      >
                        {nomeCurtoLocal(local)} ({local.count}x)
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Local de Trabalho</Label>
                <Select value={localLote} onValueChange={setLocalLote}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {locais.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{nomeCurtoLocal(l)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Input
                  value={observacaoManual}
                  onChange={(e) => setObservacaoManual(e.target.value)}
                  placeholder="Ex: Confirmado via geolocalização no Flit"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={fecharModal}>Cancelar</Button>
            <Button onClick={handleConfirmarManual} disabled={!localLote}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
