import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useEscalasDiario, calcularCompetencia, type Competencia } from '@/hooks/useEscalasDiario'
import XLSX from '@e965/xlsx'
import { useEscalasLocais } from '@/hooks/useEscalasLocais'
import { useColaboradores } from '@/hooks/useColaboradores'
import { nomeCurtoLocal, removerAcentos } from '@/lib/utils'
import { toast } from 'sonner'
import type { LocalTrabalhoDiario } from '@/types/database'
import {
  MapPin,
  CheckSquare,
  AlertCircle,
  Search,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDown,
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
  const { dias, loading, listar, confirmarManual, aplicarEmLote, buscarHistoricoColaborador } = useEscalasDiario()
  const { locais, listar: listarLocais } = useEscalasLocais()
  const { colaboradores, listar: listarColaboradores } = useColaboradores()

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

  const buscarDadosFiltrados = useCallback(async (): Promise<LocalTrabalhoDiario[]> => {
    const periodo = obterCompetenciaAplicada()
    if (!periodo) return []
    const filtros = { colaboradorId: aplicado.colaboradorId, localTrabalhoId: aplicado.localId, status: aplicado.status }
    const dados = await listar(periodo, filtros)
    return ordenarDias(dados)
  }, [aplicado, listar, obterCompetenciaAplicada, ordenarDias])

  const executarBusca = useCallback(async () => {
    setSelecionados(new Set())
    if (aplicado.modoPeriodo === 'competencia') {
      return await listar(competencia, { colaboradorId: aplicado.colaboradorId, localTrabalhoId: aplicado.localId, status: aplicado.status })
    } else if (aplicado.dataInicio && aplicado.dataFim) {
      return await listar(
        {
          ano: aplicado.ano,
          mes: aplicado.mes,
          inicio: aplicado.dataInicio,
          fim: aplicado.dataFim,
          label: `${aplicado.dataInicio} a ${aplicado.dataFim}`,
        },
        { colaboradorId: aplicado.colaboradorId, localTrabalhoId: aplicado.localId, status: aplicado.status }
      )
    }
    return []
  }, [aplicado, competencia, listar])

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
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={input.modoPeriodo === 'competencia'}
                onChange={() => setInput((v) => ({ ...v, modoPeriodo: 'competencia' }))}
              />
              Competência (20 a 19)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={input.modoPeriodo === 'livre'}
                onChange={() => setInput((v) => ({ ...v, modoPeriodo: 'livre' }))}
              />
              Período livre
            </label>
          </div>

          {input.modoPeriodo === 'competencia' ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label>Ano</Label>
                <Input type="number" value={input.ano} onChange={(e) => setInput((v) => ({ ...v, ano: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Mês</Label>
                <select
                  value={input.mes}
                  onChange={(e) => setInput((v) => ({ ...v, mes: Number(e.target.value) }))}
                  className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3 flex items-end">
                <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded-md w-full">
                  Competência: <strong>{competencia.label}</strong> ({competencia.inicio} a {competencia.fim})
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Data início</Label>
                <Input type="date" value={input.dataInicio} onChange={(e) => setInput((v) => ({ ...v, dataInicio: e.target.value }))} />
              </div>
              <div>
                <Label>Data fim</Label>
                <Input type="date" value={input.dataFim} onChange={(e) => setInput((v) => ({ ...v, dataFim: e.target.value }))} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Colaborador</Label>
              <select
                value={input.colaboradorId}
                onChange={(e) => setInput((v) => ({ ...v, colaboradorId: e.target.value }))}
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Todos</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome_completo} ({c.matricula})</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Local</Label>
              <select
                value={input.localId}
                onChange={(e) => setInput((v) => ({ ...v, localId: e.target.value }))}
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Todos</option>
                {locais.map((l) => (
                  <option key={l.id} value={l.id}>{nomeCurtoLocal(l)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select
                value={input.status}
                onChange={(e) => setInput((v) => ({ ...v, status: e.target.value as FiltroEscalas['status'] }))}
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="todos">Todos</option>
                <option value="identificados">Identificados</option>
                <option value="pendentes">Não identificados</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={aplicarFiltros} className="flex items-center gap-2">
              <Search className="h-4 w-4" /> Filtrar
            </Button>
            <Button variant="outline" onClick={exportarExcel} className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
            </Button>
            <Button variant="outline" onClick={exportarPDF} className="flex items-center gap-2">
              <FileDown className="h-4 w-4" /> Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {pendentes > 0 && (
        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded-md">
          <AlertCircle className="h-5 w-5" />
          <span>{pendentes} dia(s) aguardando confirmação manual.</span>
        </div>
      )}

      {selecionados.size > 0 && (
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-end gap-4">
            <div>
              <Label>Aplicar local em {selecionados.size} dia(s)</Label>
              <select
                value={localLote}
                onChange={(e) => setLocalLote(e.target.value)}
                className="w-64 h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Selecione o local</option>
                {locais.map((l) => (
                  <option key={l.id} value={l.id}>{nomeCurtoLocal(l)}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Observação</Label>
              <Input value={observacaoLote} onChange={(e) => setObservacaoLote(e.target.value)} placeholder="Ex: Confirmado via geolocalização no Flit" />
            </div>
            <Button onClick={handleConfirmarLote} disabled={!localLote} className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" /> Confirmar em lote
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Local de trabalho por dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500">Carregando...</p>
          ) : dias.length === 0 ? (
            <p className="text-slate-500">Nenhum registro encontrado para os filtros selecionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-3 text-left">
                      <Checkbox checked={selecionados.size === dias.length && dias.length > 0} onCheckedChange={toggleTodos} />
                    </th>
                    <th className="py-2 px-3 text-left cursor-pointer select-none" onClick={() => toggleOrdenacao('data')}>
                      <div className="flex items-center gap-1">
                        Dia
                        {ordenacao.coluna === 'data' ? (
                          ordenacao.direcao === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                    <th className="py-2 px-3 text-left cursor-pointer select-none" onClick={() => toggleOrdenacao('colaborador')}>
                      <div className="flex items-center gap-1">
                        Colaborador
                        {ordenacao.coluna === 'colaborador' ? (
                          ordenacao.direcao === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                    <th className="py-2 px-3 text-left">Local de Trabalho</th>
                    <th className="py-2 px-3 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {diasOrdenados.map((dia) => (
                    <tr key={dia.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <Checkbox checked={selecionados.has(dia.id)} onCheckedChange={() => toggleSelecao(dia.id)} />
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">{new Date(dia.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="py-2 px-3">
                        {dia.colaborador?.nome_completo} <span className="text-slate-400">({dia.colaborador?.matricula})</span>
                      </td>
                      <td className="py-2 px-3">
                        {dia.local_trabalho ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs border bg-slate-100 text-slate-800 border-slate-200">
                            {nomeCurtoLocal(dia.local_trabalho)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Não identificado</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <Button size="sm" variant="outline" onClick={() => abrirModal(dia)}>
                          {dia.local_trabalho_id ? 'Alterar' : 'Confirmar'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {diaEditando && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg bg-white">
            <CardHeader>
              <CardTitle className="text-base">{diaEditando.local_trabalho_id ? 'Alterar local' : 'Confirmar local'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-700 font-medium">
                {diaEditando.colaborador?.nome_completo} <span className="text-slate-400">({diaEditando.colaborador?.matricula})</span> — {new Date(diaEditando.data + 'T12:00:00').toLocaleDateString('pt-BR')}
              </p>

              {locaisRecentes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-slate-700">Locais usados recentemente por este colaborador</Label>
                  <div className="flex flex-wrap gap-2">
                    {locaisRecentes.map((local) => (
                      <Button
                        key={local.id}
                        type="button"
                        size="sm"
                        variant={localLote === local.id ? 'default' : 'outline'}
                        onClick={() => setLocalLote(local.id)}
                        className="text-xs"
                      >
                        {nomeCurtoLocal(local)} ({local.count}x)
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-slate-700">Local de Trabalho</Label>
                <select
                  value={localLote}
                  onChange={(e) => setLocalLote(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800"
                >
                  <option value="">Selecione</option>
                  {locais.map((l) => (
                    <option key={l.id} value={l.id}>{nomeCurtoLocal(l)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-slate-700">Observação</Label>
                <Input
                  value={observacaoManual}
                  onChange={(e) => setObservacaoManual(e.target.value)}
                  placeholder="Ex: Confirmado via geolocalização no Flit"
                  className="bg-white text-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
                <Button onClick={handleConfirmarManual} disabled={!localLote}>Salvar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
