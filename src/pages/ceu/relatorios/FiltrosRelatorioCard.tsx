import { useMemo } from 'react'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import {
  Search,
  X,
  FileSpreadsheet,
  FileJson,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DepartamentoAutocomplete } from '@/components/DepartamentoAutocomplete'
import { FiltrosAtivosBadge } from '@/components/corh/FiltrosAtivosBadge'
import type { Colaborador, EntregaCEU, ItemCEU } from '@/types/database'
import type { EntregaComSnapshot } from './relatorios.utils'
import type { FiltrosRelatorio } from './useFiltrosRelatorio'

interface FiltrosRelatorioCardProps {
  filtros: FiltrosRelatorio
  colaboradoresUnicos: Colaborador[]
  dadosItens: ItemCEU[]
  /** Subconjunto de dadosItens com pelo menos uma entrega — usado no select de Item. */
  itensComMovimentacao: ItemCEU[]
  dadosEntregas: EntregaCEU[]
  onExportarExcel: () => void
  onExportarTSV: () => void
}

export function FiltrosRelatorioCard({
  filtros,
  colaboradoresUnicos,
  dadosItens,
  itensComMovimentacao,
  dadosEntregas,
  onExportarExcel,
  onExportarTSV,
}: FiltrosRelatorioCardProps) {
  const {
    inputDataInicio,
    inputDataFim,
    inputColaborador,
    inputItem,
    inputTipo,
    inputDepartamento,
    inputStatus,
    setInputDataInicio,
    setInputDataFim,
    setInputColaborador,
    setInputItem,
    setInputTipo,
    setInputDepartamento,
    setInputStatus,
    aplicarFiltros,
    limparFiltros,
    totalFiltrosAtivos,
    temRascunhoPendente,
  } = filtros

  const tiposUnicos = useMemo(() => {
    const tipos = new Set<string>()
    dadosItens.forEach((i) => tipos.add(i.tipo))
    dadosEntregas.forEach((e: EntregaComSnapshot) => {
      if (e.item?.tipo) tipos.add(e.item.tipo)
      const snapshot = e.snapshot_item
      if (snapshot?.tipo) tipos.add(snapshot.tipo)
    })
    return Array.from(tipos).sort()
  }, [dadosItens, dadosEntregas])

  return (
    <ModuleCard
      title={
        <>
          Filtros
          <FiltrosAtivosBadge total={totalFiltrosAtivos} onLimpar={limparFiltros} />
        </>
      }
      icon={<Search className="w-4 h-4" />}
    >
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
              {itensComMovimentacao.map((i) => (
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
          <Select
            value={inputStatus}
            onValueChange={(v) => {
              if (v === 'todos' || v === 'em_aberto' || v === 'devolvido') setInputStatus(v)
            }}
          >
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
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <ModuleButton size="sm" onClick={aplicarFiltros}>
          <Search className="w-3.5 h-3.5 mr-1.5" />
          Aplicar
        </ModuleButton>
        <ModuleButton size="sm" onClick={limparFiltros}>
          <X className="w-3.5 h-3.5 mr-1.5" />
          Limpar
        </ModuleButton>
        {temRascunhoPendente && (
          <span className="text-xs text-amber-600">Alterações não aplicadas</span>
        )}
        <ModuleButton variant="outline" size="sm" onClick={onExportarExcel}>
          <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
          Exportar Excel
        </ModuleButton>
        <ModuleButton variant="outline" size="sm" onClick={onExportarTSV}>
          <FileJson className="w-3.5 h-3.5 mr-1.5" />
          Exportar TSV
        </ModuleButton>
      </div>
    </ModuleCard>
  )
}
