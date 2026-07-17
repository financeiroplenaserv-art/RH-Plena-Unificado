import { useEffect, useMemo, useState } from 'react'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'

import {
  Users,
  CalendarDays,
  Package,
  AlertTriangle,
  Warehouse,
  FileSpreadsheet,
  FileJson,
  Search,
  Filter,
  X,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCEUEntregas } from '@/hooks/useCEUEntregas'
import { useCEUItens } from '@/hooks/useCEUItens'
import { DepartamentoAutocomplete } from '@/components/DepartamentoAutocomplete'
import { supabase } from '@/lib/supabase'
import { CeuShell } from './CeuShell'
import { PageHeader } from '@/components/PageHeader'
import { Input } from '@/components/ui/input'
import type { Colaborador } from '@/types/database'
import * as XLSX from '@e965/xlsx'
import { diasAte, downloadFile, formatarData } from './relatorios/relatorios.utils'
import { AbaColaborador } from './relatorios/AbaColaborador'
import { AbaData } from './relatorios/AbaData'
import { AbaItens } from './relatorios/AbaItens'
import { AbaVencimento } from './relatorios/AbaVencimento'
import { AbaEstoque } from './relatorios/AbaEstoque'

const ABAS = [
  { id: 'colaborador', label: 'Por colaborador', icon: Users },
  { id: 'data', label: 'Por data', icon: CalendarDays },
  { id: 'itens', label: 'Itens com colaboradores', icon: Package },
  { id: 'vencimento', label: 'Alertas de vencimento', icon: AlertTriangle },
  { id: 'estoque', label: 'Controle de estoque', icon: Warehouse },
] as const

type AbaId = (typeof ABAS)[number]['id']

export function CeuRelatoriosPage() {
  const { itens, loading: loadingItens, listar: listarItens } = useCEUItens()
  const { entregas, loading: loadingEntregas, listar: listarEntregas } = useCEUEntregas()

  const [abaAtiva, setAbaAtiva] = useState<AbaId>('colaborador')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroColaborador, setFiltroColaborador] = useState('todos')
  const [filtroItem, setFiltroItem] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroDepartamento, setFiltroDepartamento] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'em_aberto' | 'devolvido'>('todos')

  const [inputDataInicio, setInputDataInicio] = useState('')
  const [inputDataFim, setInputDataFim] = useState('')
  const [inputColaborador, setInputColaborador] = useState('todos')
  const [inputItem, setInputItem] = useState('todos')
  const [inputTipo, setInputTipo] = useState('todos')
  const [inputDepartamento, setInputDepartamento] = useState('')
  const [inputStatus, setInputStatus] = useState<'todos' | 'em_aberto' | 'devolvido'>('todos')

  const [colabIdsDepartamento, setColabIdsDepartamento] = useState<Set<string>>(new Set())

  useEffect(() => {
    listarItens()
    listarEntregas()
  }, [listarItens, listarEntregas])

  useEffect(() => {
    async function resolverColaboradores() {
      if (!filtroDepartamento || filtroDepartamento === 'todos') {
        setColabIdsDepartamento(new Set())
        return
      }
      const nomeCurto = filtroDepartamento.trim()
      const { data: deptData } = await supabase
        .from('departamentos')
        .select('id, nome, nome_curto')
        .or(`nome_curto.ilike.%${nomeCurto}%,nome.ilike.%${nomeCurto}%`)

      let queryColab = supabase.from('colaboradores').select('id')
      if (deptData && deptData.length > 0) {
        const ids = new Set<string>()
        const filtrosDepto: string[] = []
        deptData.forEach((dept) => {
          ids.add(dept.id)
          if (dept.nome) filtrosDepto.push(`departamento.ilike.%${dept.nome}%`)
          if (dept.nome_curto && dept.nome_curto !== dept.nome) {
            filtrosDepto.push(`departamento.ilike.%${dept.nome_curto}%`)
          }
        })
        filtrosDepto.unshift(`departamento_id.in.(${Array.from(ids).join(',')})`)
        queryColab = queryColab.or(filtrosDepto.join(','))
      } else {
        queryColab = queryColab.ilike('departamento', `%${nomeCurto}%`)
      }
      const { data } = await queryColab
      const ids = new Set((data || []).map((c) => c.id))
      setColabIdsDepartamento(ids)
    }
    resolverColaboradores()
  }, [filtroDepartamento])

  const dadosItens = itens
  const dadosEntregas = entregas

  const colaboradoresUnicos = useMemo(() => {
    const map = new Map<string, Colaborador>()
    dadosEntregas.forEach((e) => {
      if (e.colaborador && !map.has(e.colaborador_id)) {
        map.set(e.colaborador_id, e.colaborador)
      }
    })
    return Array.from(map.values()).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
  }, [dadosEntregas])

  const tiposUnicos = useMemo(() => {
    const tipos = new Set<string>()
    dadosItens.forEach((i) => tipos.add(i.tipo))
    dadosEntregas.forEach((e) => {
      if (e.item?.tipo) tipos.add(e.item.tipo)
      const snapshot = e.snapshot_item as { tipo?: string } | undefined
      if (snapshot?.tipo) tipos.add(snapshot.tipo)
    })
    return Array.from(tipos).sort()
  }, [dadosItens, dadosEntregas])

  const entregasFiltradas = useMemo(() => {
    return dadosEntregas.filter((e) => {
      if (filtroColaborador && filtroColaborador !== 'todos' && e.colaborador_id !== filtroColaborador) return false

      const tipo = e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo
      if (filtroTipo && filtroTipo !== 'todos' && tipo !== filtroTipo) return false

      if (filtroItem && filtroItem !== 'todos') {
        const itemId = e.item_id
        const itemNome = e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || ''
        if (itemId !== filtroItem && !itemNome.toLowerCase().includes(filtroItem.toLowerCase())) return false
      }

      if (filtroDepartamento && filtroDepartamento !== 'todos') {
        if (!colabIdsDepartamento.has(e.colaborador_id)) return false
      }

      if (filtroStatus === 'em_aberto' && e.data_devolucao) return false
      if (filtroStatus === 'devolvido' && !e.data_devolucao) return false

      if (filtroDataInicio && e.data_entrega < filtroDataInicio) return false
      if (filtroDataFim && e.data_entrega > filtroDataFim) return false

      return true
    })
  }, [dadosEntregas, filtroColaborador, filtroTipo, filtroItem, filtroDepartamento, filtroStatus, filtroDataInicio, filtroDataFim, colabIdsDepartamento])

  const aplicarFiltros = () => {
    setFiltroDataInicio(inputDataInicio)
    setFiltroDataFim(inputDataFim)
    setFiltroColaborador(inputColaborador)
    setFiltroItem(inputItem)
    setFiltroTipo(inputTipo)
    setFiltroDepartamento(inputDepartamento.trim() || 'todos')
    setFiltroStatus(inputStatus)
  }

  const limparFiltros = () => {
    setInputDataInicio('')
    setInputDataFim('')
    setInputColaborador('todos')
    setInputItem('todos')
    setInputTipo('todos')
    setInputDepartamento('todos')
    setInputStatus('todos')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroColaborador('todos')
    setFiltroItem('todos')
    setFiltroTipo('todos')
    setFiltroDepartamento('todos')
    setFiltroStatus('todos')
  }

  const exportarExcel = () => {
    const dados = dadosExportacao()
    if (dados.length === 0) return
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório CEU')
    XLSX.writeFile(wb, `relatorio_ceu_${abaAtiva}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const exportarTSV = () => {
    const dados = dadosExportacao()
    if (dados.length === 0) return
    const headers = Object.keys(dados[0])
    const rows = dados.map((row) =>
      headers.map((h) => String(row[h as keyof typeof row] ?? '')).join('\t')
    )
    const tsv = [headers.join('\t'), ...rows].join('\n')
    downloadFile(tsv, `relatorio_ceu_${abaAtiva}_${new Date().toISOString().split('T')[0]}.tsv`, 'text/tab-separated-values')
  }

  function dadosExportacao() {
    switch (abaAtiva) {
      case 'colaborador':
        return entregasFiltradas.map((e) => ({
          Colaborador: e.colaborador?.nome_completo || e.colaborador_id,
          Matrícula: e.colaborador?.matricula || '—',
          Departamento: e.colaborador?.departamento || '—',
          Item: e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—',
          Tipo: e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || '—',
          CA: e.item?.ca || (e.snapshot_item as { ca?: string })?.ca || '—',
          Quantidade: e.quantidade,
          'Data entrega': formatarData(e.data_entrega),
          'Data devolução': formatarData(e.data_devolucao),
          Status: e.data_devolucao ? 'Devolvido' : 'Em aberto',
          Observação: e.observacao || '—',
        }))
      case 'data':
        return entregasFiltradas.map((e) => ({
          'Data entrega': formatarData(e.data_entrega),
          Colaborador: e.colaborador?.nome_completo || e.colaborador_id,
          Matrícula: e.colaborador?.matricula || '—',
          Item: e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—',
          Tipo: e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || '—',
          Quantidade: e.quantidade,
          'Data devolução': formatarData(e.data_devolucao),
          Status: e.data_devolucao ? 'Devolvido' : 'Em aberto',
        }))
      case 'itens':
        return entregasFiltradas
          .filter((e) => !e.data_devolucao)
          .map((e) => ({
            Item: e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—',
            Tipo: e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || '—',
            CA: e.item?.ca || (e.snapshot_item as { ca?: string })?.ca || '—',
            Colaborador: e.colaborador?.nome_completo || e.colaborador_id,
            Matrícula: e.colaborador?.matricula || '—',
            Departamento: e.colaborador?.departamento || '—',
            Quantidade: e.quantidade,
            'Data entrega': formatarData(e.data_entrega),
          }))
      case 'vencimento':
        return dadosItens
          .filter((item) => item.ca && item.validade)
          .map((item) => ({
            Item: item.nome,
            Tipo: item.tipo,
            CA: item.ca,
            Validade: formatarData(item.validade),
            'Dias restantes': diasAte(item.validade!),
            Situação: diasAte(item.validade!) < 0 ? 'Vencido' : diasAte(item.validade!) <= 30 ? 'Próximo do vencimento' : 'OK',
          }))
      case 'estoque':
        return dadosItens
          .filter(
            (item) =>
              typeof item.estoque === 'number' &&
              typeof item.estoque_minimo === 'number' &&
              item.estoque_minimo > 0 &&
              item.estoque <= item.estoque_minimo
          )
          .map((item) => ({
            Item: item.nome,
            Tipo: item.tipo,
            'Estoque atual': item.estoque,
            'Estoque mínimo': item.estoque_minimo,
            'Diferença': (item.estoque || 0) - (item.estoque_minimo || 0),
          }))
      default:
        return []
    }
  }

  const renderConteudoAba = () => {
    if (abaAtiva === 'colaborador') {
      return (
        <AbaColaborador
          colaboradoresUnicos={colaboradoresUnicos}
          entregasFiltradas={entregasFiltradas}
          exportarExcel={exportarExcel}
        />
      )
    }

    if (abaAtiva === 'data') {
      return <AbaData entregasFiltradas={entregasFiltradas} />
    }

    if (abaAtiva === 'itens') {
      return <AbaItens dadosItens={dadosItens} entregasFiltradas={entregasFiltradas} />
    }

    if (abaAtiva === 'vencimento') {
      return <AbaVencimento dadosItens={dadosItens} dadosEntregas={dadosEntregas} />
    }

    if (abaAtiva === 'estoque') {
      return <AbaEstoque dadosItens={dadosItens} />
    }

    return null
  }

  return (
    <CeuShell>
      <div className="space-y-6">
        <PageHeader backTo="/ceu/movimentacoes" title="Relatórios CEU" description="Análise de entregas, itens e alertas" />

        <ModuleCard title="Filtros" icon={<Search className="w-4 h-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data inicial</Label>
              <Input
                id="data_inicio"
                type="date"
                value={inputDataInicio}
                onChange={(e) => setInputDataInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_fim">Data final</Label>
              <Input
                id="data_fim"
                type="date"
                value={inputDataFim}
                onChange={(e) => setInputDataFim(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={inputColaborador} onValueChange={setInputColaborador}>
                <SelectTrigger className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {colaboradoresUnicos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Item</Label>
              <Select value={inputItem} onValueChange={setInputItem}>
                <SelectTrigger className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {dadosItens.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={inputTipo} onValueChange={setInputTipo}>
                <SelectTrigger className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {tiposUnicos.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <DepartamentoAutocomplete
                value={inputDepartamento}
                onChange={setInputDepartamento}
                mode="nome_curto"
                placeholder="Buscar departamento..."
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={inputStatus} onValueChange={(v) => setInputStatus(v as 'todos' | 'em_aberto' | 'devolvido')}>
                <SelectTrigger className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="em_aberto">Em aberto</SelectItem>
                  <SelectItem value="devolvido">Devolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <ModuleButton size="sm" onClick={aplicarFiltros}>
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              Filtrar
            </ModuleButton>
            <ModuleButton variant="outline" size="sm" onClick={limparFiltros}>
              <X className="w-3.5 h-3.5 mr-1.5" />
              Limpar
            </ModuleButton>
            <ModuleButton variant="outline" size="sm" onClick={exportarExcel}>
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              Exportar Excel
            </ModuleButton>
            <ModuleButton variant="outline" size="sm" onClick={exportarTSV}>
              <FileJson className="w-3.5 h-3.5 mr-1.5" />
              Exportar TSV
            </ModuleButton>
          </div>
        </ModuleCard>

        <div className="border-b border-slate-200">
          <div className="flex flex-wrap gap-1">
            {ABAS.map((aba) => {
              const Icon = aba.icon
              const ativa = aba.id === abaAtiva
              return (
                <button
                  key={aba.id}
                  onClick={() => setAbaAtiva(aba.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    ativa
                      ? 'border-[#3B82F6] text-[#1E40AF]'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {aba.label}
                </button>
              )
            })}
          </div>
        </div>

        <ModuleCard title={ABAS.find((a) => a.id === abaAtiva)?.label || ''}>
          {(loadingItens || loadingEntregas) ? (
            <div className="text-center py-12 text-slate-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3B82F6] mx-auto mb-2" />
              Carregando dados...
            </div>
          ) : (
            renderConteudoAba()
          )}
        </ModuleCard>
      </div>
    </CeuShell>
  )
}
