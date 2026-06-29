import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEscalasDiario, calcularCompetencia, type Competencia } from '@/hooks/useEscalasDiario'
import XLSX from '@e965/xlsx'
import { useEscalasLocais } from '@/hooks/useEscalasLocais'
import { useEscalasMapeamento } from '@/hooks/useEscalasMapeamento'
import { useColaboradores } from '@/hooks/useColaboradores'
import { nomeCurtoLocal, removerAcentos } from '@/lib/utils'
import { toast } from 'sonner'
import type { LocalTrabalhoDiario, MapeamentoFlitLocalTrabalho } from '@/types/database'
import { MapPin, CheckSquare, AlertCircle, Search, Plus, Trash2, Upload, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, FileDown } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'

const FONTES_INFO: Record<LocalTrabalhoDiario['fonte'], { label: string; cor: string }> = {
  dispositivo: { label: 'Dispositivo fixo', cor: 'bg-green-100 text-green-800 border-green-200' },
  perimetro: { label: 'Perímetro', cor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  turno_departamento: { label: 'Turno + Departamento', cor: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  manual: { label: 'Confirmado manualmente', cor: 'bg-blue-100 text-blue-800 border-blue-200' },
  nao_identificado: { label: 'Não identificado', cor: 'bg-red-100 text-red-800 border-red-200' },
}

const TIPOS_MATCH: { value: MapeamentoFlitLocalTrabalho['tipo_match']; label: string }[] = [
  { value: 'dispositivo', label: 'Dispositivo (Flit Multi)' },
  { value: 'perimetro', label: 'Perímetro' },
  { value: 'turno_departamento', label: 'Turno contém Departamento' },
]

// ============================================================
// ABA 1: VISUALIZAÇÃO DIÁRIA
// ============================================================

function AbaEscalasDiario() {
  const { dias, loading, listar, confirmarManual, aplicarEmLote, buscarHistoricoColaborador } = useEscalasDiario()
  const { locais, listar: listarLocais } = useEscalasLocais()
  const { colaboradores, listar: listarColaboradores } = useColaboradores()

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

  const executarBusca = useCallback(() => {
    if (aplicado.modoPeriodo === 'competencia') {
      listar(competencia, { colaboradorId: aplicado.colaboradorId, localTrabalhoId: aplicado.localId, status: aplicado.status })
    } else if (aplicado.dataInicio && aplicado.dataFim) {
      listar({ ano: aplicado.ano, mes: aplicado.mes, inicio: aplicado.dataInicio, fim: aplicado.dataFim, label: `${aplicado.dataInicio} a ${aplicado.dataFim}` }, { colaboradorId: aplicado.colaboradorId, localTrabalhoId: aplicado.localId, status: aplicado.status })
    }
    setSelecionados(new Set())
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

  const diasOrdenados = useMemo(() => {
    const sorted = [...dias]
    sorted.sort((a, b) => {
      if (ordenacao.coluna === 'data') {
        return ordenacao.direcao === 'asc'
          ? a.data.localeCompare(b.data)
          : b.data.localeCompare(a.data)
      }
      const nomeA = a.colaborador?.nome_completo || ''
      const nomeB = b.colaborador?.nome_completo || ''
      return ordenacao.direcao === 'asc'
        ? nomeA.localeCompare(nomeB)
        : nomeB.localeCompare(nomeA)
    })
    return sorted
  }, [dias, ordenacao])

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

  const recarregar = executarBusca

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

  const exportarExcel = () => {
    const dados = diasOrdenados.map((d) => ({
      Dia: new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR'),
      Colaborador: `${d.colaborador?.nome_completo || ''} (${d.colaborador?.matricula || '-'})`,
      'Local de Trabalho': nomeCurtoLocal(d.local_trabalho) || 'Não identificado',
      Fonte: FONTES_INFO[d.fonte].label,
      Observacao: d.observacao || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(dados)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Escalas')
    XLSX.writeFile(workbook, `escalas_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const exportarPDF = async () => {
    try {
      if (diasOrdenados.length === 0) {
        toast.info('Nenhum registro para exportar. Aplique um filtro primeiro.')
        return
      }

      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const doc = new jsPDF()

      // Agrupa os dias por mês de competência (20 a 19).
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
      for (const dia of diasOrdenados) {
        const chave = chaveMesCompetencia(dia.data)
        if (!grupos.has(chave)) grupos.set(chave, [])
        grupos.get(chave)!.push(dia)
      }

      const meses = Array.from(grupos.keys()).sort()

      meses.forEach((chave, index) => {
        if (index > 0) doc.addPage()
        const [ano, mes] = chave.split('-').map(Number)
        doc.setFontSize(16)
        doc.text(
          removerAcentos(`Escalas / Local de Trabalho - ${mesesNomes[mes - 1]}/${ano}`),
          14,
          20
        )

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
                <select value={input.mes} onChange={(e) => setInput((v) => ({ ...v, mes: Number(e.target.value) }))} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
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
              <select value={input.colaboradorId} onChange={(e) => setInput((v) => ({ ...v, colaboradorId: e.target.value }))} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Todos</option>
                {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome_completo} ({c.matricula})</option>)}
              </select>
            </div>
            <div>
              <Label>Local</Label>
              <select value={input.localId} onChange={(e) => setInput((v) => ({ ...v, localId: e.target.value }))} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Todos</option>
                {locais.map((l) => <option key={l.id} value={l.id}>{nomeCurtoLocal(l)}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select value={input.status} onChange={(e) => setInput((v) => ({ ...v, status: e.target.value as FiltroEscalas['status'] }))} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
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
              <select value={localLote} onChange={(e) => setLocalLote(e.target.value)} className="w-64 h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Selecione o local</option>
                {locais.map((l) => <option key={l.id} value={l.id}>{nomeCurtoLocal(l)}</option>)}
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
          <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Local de trabalho por dia</CardTitle>
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
                    <th className="py-2 px-3 text-left"><Checkbox checked={selecionados.size === dias.length && dias.length > 0} onCheckedChange={toggleTodos} /></th>
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
                      <td className="py-2 px-3"><Checkbox checked={selecionados.has(dia.id)} onCheckedChange={() => toggleSelecao(dia.id)} /></td>
                      <td className="py-2 px-3 whitespace-nowrap">{new Date(dia.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="py-2 px-3">{dia.colaborador?.nome_completo} <span className="text-slate-400">({dia.colaborador?.matricula})</span></td>
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
            <CardHeader><CardTitle className="text-base">{diaEditando.local_trabalho_id ? 'Alterar local' : 'Confirmar local'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-700 font-medium">{diaEditando.colaborador?.nome_completo} <span className="text-slate-400">({diaEditando.colaborador?.matricula})</span> — {new Date(diaEditando.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>

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
                <select value={localLote} onChange={(e) => setLocalLote(e.target.value)} className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800">
                  <option value="">Selecione</option>
                  {locais.map((l) => <option key={l.id} value={l.id}>{nomeCurtoLocal(l)}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-slate-700">Observação</Label>
                <Input value={observacaoManual} onChange={(e) => setObservacaoManual(e.target.value)} placeholder="Ex: Confirmado via geolocalização no Flit" className="bg-white text-slate-800" />
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
// ============================================================
// ABA 2: LOCAIS
// ============================================================

function AbaEscalasLocais() {
  const { locais, loading, listar, criar, atualizar, remover, importarDeDepartamentos } = useEscalasLocais()
  const [novoNome, setNovoNome] = useState('')
  const [novoNomeCurto, setNovoNomeCurto] = useState('')
  const [editando, setEditando] = useState<{ id: string; nome: string; nome_curto: string | null } | null>(null)
  const [busca, setBusca] = useState('')
  const [importando, setImportando] = useState(false)

  useEffect(() => { listar() }, [listar])

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome.trim()) return
    await criar({ nome: novoNome.trim(), nome_curto: novoNomeCurto.trim() || novoNome.trim(), status: 'Ativo', observacao: null })
    setNovoNome('')
    setNovoNomeCurto('')
  }

  const handleImportar = async () => {
    setImportando(true)
    await importarDeDepartamentos()
    setImportando(false)
  }

  const locaisFiltrados = useMemo(() => {
    if (!busca.trim()) return locais
    const termo = busca.toLowerCase()
    return locais.filter((l) => l.nome.toLowerCase().includes(termo) || (l.nome_curto || '').toLowerCase().includes(termo))
  }, [locais, busca])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Novo Local de Trabalho</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCriar} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label>Nome</Label>
              <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: CBO" />
            </div>
            <div>
              <Label>Nome curto</Label>
              <Input value={novoNomeCurto} onChange={(e) => setNovoNomeCurto(e.target.value)} placeholder="Ex: CBO" />
            </div>
            <Button type="submit" disabled={!novoNome.trim()} className="flex items-center gap-2"><Plus className="h-4 w-4" /> Adicionar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Locais cadastrados</CardTitle>
          <Button variant="outline" onClick={handleImportar} disabled={importando || loading} className="flex items-center gap-2">
            {importando ? 'Importando...' : 'Importar de Departamentos'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar local..." className="pl-9" />
          </div>
          {loading ? (
            <p className="text-slate-500">Carregando...</p>
          ) : locaisFiltrados.length === 0 ? (
            <p className="text-slate-500">Nenhum local encontrado.</p>
          ) : (
            <div className="divide-y">
              {locaisFiltrados.map((local) => (
                <div key={local.id} className="py-3 flex items-center justify-between gap-4">
                  {editando?.id === local.id ? (
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
                      <Input value={editando.nome_curto || ''} onChange={(e) => setEditando({ ...editando, nome_curto: e.target.value })} />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{local.nome}</p>
                      <p className="text-sm text-slate-500">{local.nome_curto}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {editando?.id === local.id ? (
                      <>
                        <Button size="sm" onClick={() => { atualizar(local.id, { nome: editando.nome, nome_curto: editando.nome_curto }); setEditando(null) }}>Salvar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditando({ id: local.id, nome: local.nome, nome_curto: local.nome_curto })}>Editar</Button>
                        <Button size="sm" variant="destructive" onClick={() => remover(local.id)}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// ABA 3: MAPEAMENTO
// ============================================================

function AbaEscalasMapeamento() {
  const { mapeamentos, loading, listar, criar, remover } = useEscalasMapeamento()
  const { locais, listar: listarLocais } = useEscalasLocais()

  const [localId, setLocalId] = useState('')
  const [tipo, setTipo] = useState<MapeamentoFlitLocalTrabalho['tipo_match']>('dispositivo')
  const [valor, setValor] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  useEffect(() => { listar(); listarLocais() }, [listar, listarLocais])

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!localId || !valor.trim()) return
    await criar({ local_trabalho_id: localId, tipo_match: tipo, valor_flit: valor.trim(), prioridade: 100, ativo: true })
    setValor('')
  }

  const mapeamentosFiltrados = useMemo(() => {
    return mapeamentos.filter((m) => {
      const matchTipo = filtroTipo === 'todos' || m.tipo_match === filtroTipo
      const termo = busca.toLowerCase()
      const matchBusca = !termo ||
        m.valor_flit.toLowerCase().includes(termo) ||
        (m.local_trabalho?.nome || '').toLowerCase().includes(termo)
      return matchTipo && matchBusca
    })
  }, [mapeamentos, busca, filtroTipo])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Novo mapeamento</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCriar} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label>Local de Trabalho</Label>
              <select value={localId} onChange={(e) => setLocalId(e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Selecione</option>
                {locais.map((l) => <option key={l.id} value={l.id}>{nomeCurtoLocal(l)}</option>)}
              </select>
            </div>
            <div>
              <Label>Tipo</Label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as MapeamentoFlitLocalTrabalho['tipo_match'])} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                {TIPOS_MATCH.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Valor no Flit</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: MATIZES" />
            </div>
            <Button type="submit" disabled={!localId || !valor.trim()} className="flex items-center gap-2"><Plus className="h-4 w-4" /> Adicionar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapeamentos cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por local ou valor no Flit..." className="pl-9" />
            </div>
            <div>
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="todos">Todos os tipos</option>
                {TIPOS_MATCH.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <p className="text-slate-500">Carregando...</p>
          ) : mapeamentosFiltrados.length === 0 ? (
            <p className="text-slate-500">Nenhum mapeamento encontrado.</p>
          ) : (
            <div className="divide-y">
              {mapeamentosFiltrados.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{m.local_trabalho?.nome || 'Local não carregado'}</p>
                    <p className="text-sm text-slate-500">{TIPOS_MATCH.find((t) => t.value === m.tipo_match)?.label} → "{m.valor_flit}"</p>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => remover(m.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// ABA 4: IMPORTAR
// ============================================================

function AbaEscalasImportar() {
  const { importando, importarExcelFlit } = useEscalasDiario()
  const { mapeamentos, listar: listarMapeamentos } = useEscalasMapeamento()
  const { colaboradores, listar: listarColaboradores } = useColaboradores()

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [modoImportacao, setModoImportacao] = useState<'todos' | 'dia_anterior' | 'competencia'>('todos')
  const [ano, setAno] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [resumo, setResumo] = useState<{ sucesso: number; identificados: number; pendentes: number; preservados: number; naoEncontrados: string[] } | null>(null)

  useEffect(() => { listarMapeamentos(); listarColaboradores() }, [listarMapeamentos, listarColaboradores])

  const competencia = calcularCompetencia(ano, mes)

  const handleImportar = async () => {
    if (!arquivo) return
    let filtroCompetencia: Competencia | null = null
    if (modoImportacao === 'competencia') {
      filtroCompetencia = competencia
    } else if (modoImportacao === 'dia_anterior') {
      const ontem = new Date()
      ontem.setDate(ontem.getDate() - 1)
      const dataOntem = `${ontem.getFullYear()}-${String(ontem.getMonth() + 1).padStart(2, '0')}-${String(ontem.getDate()).padStart(2, '0')}`
      filtroCompetencia = { ano: ontem.getFullYear(), mes: ontem.getMonth() + 1, inicio: dataOntem, fim: dataOntem, label: `Dia ${dataOntem}` }
    }
    const resultado = await importarExcelFlit(arquivo, colaboradores, mapeamentos, filtroCompetencia)
    setResumo(resultado)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Importar Excel do Flit</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Arquivo Excel do Flit</Label>
            <input id="arquivo" type="file" accept=".xlsx,.xls" onChange={(e) => setArquivo(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={modoImportacao === 'todos'} onChange={() => setModoImportacao('todos')} />
              Importar todos os dias do Excel
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={modoImportacao === 'dia_anterior'} onChange={() => setModoImportacao('dia_anterior')} />
              Apenas o dia anterior
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={modoImportacao === 'competencia'} onChange={() => setModoImportacao('competencia')} />
              Filtrar por competência
            </label>
          </div>

          {modoImportacao === 'competencia' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ano</Label>
                <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
              </div>
              <div>
                <Label>Mês base</Label>
                <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>)}
                </select>
              </div>
            </div>
          )}

          {modoImportacao === 'competencia' && (
            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md">
              Competência: <strong>{competencia.label}</strong> ({competencia.inicio} a {competencia.fim})
            </p>
          )}

          <Button onClick={handleImportar} disabled={!arquivo || importando} className="flex items-center gap-2"><Upload className="h-4 w-4" /> {importando ? 'Importando...' : 'Importar para o CORH'}</Button>
        </CardContent>
      </Card>

      {resumo && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resumo da importação</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p><strong>{resumo.sucesso}</strong> dia(s) importado(s)</p>
            <p><strong>{resumo.identificados}</strong> identificado(s) automaticamente</p>
            <p><strong>{resumo.pendentes}</strong> dia(s) não identificado(s)</p>
            {resumo.preservados > 0 && (
              <p className="text-blue-600"><strong>{resumo.preservados}</strong> confirmação(ões) manual(is) preservada(s)</p>
            )}
            {resumo.naoEncontrados.length > 0 && (
              <div className="mt-4">
                <p className="text-amber-600 font-medium">Colaboradores não encontrados no CORH:</p>
                <ul className="list-disc list-inside text-sm text-slate-600">{resumo.naoEncontrados.map((nome) => <li key={nome}>{nome}</li>)}</ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================
// PÁGINA PRINCIPAL COM TABS
// ============================================================

export function EscalasPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader title="Escalas" />

      <Tabs defaultValue="escalas" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="escalas">Escalas</TabsTrigger>
          <TabsTrigger value="locais">Locais</TabsTrigger>
          <TabsTrigger value="mapeamento">Mapeamento</TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
        </TabsList>
        <TabsContent value="escalas" className="mt-6"><AbaEscalasDiario /></TabsContent>
        <TabsContent value="locais" className="mt-6"><AbaEscalasLocais /></TabsContent>
        <TabsContent value="mapeamento" className="mt-6"><AbaEscalasMapeamento /></TabsContent>
        <TabsContent value="importar" className="mt-6"><AbaEscalasImportar /></TabsContent>
      </Tabs>
    </div>
  )
}
