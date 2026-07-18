import { useEffect, useMemo, useState } from 'react'
import { Search, BarChart3 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useExtras } from '@/hooks/useExtras'

import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { ModuleCard } from '@/components/layout/ModuleShell'
import { ExtrasShell } from './ExtrasShell'

function formatarDataBR(data: string | null) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getInicioSemana(data: Date): Date {
  const d = new Date(data)
  const dia = d.getDay()
  const diff = d.getDate() - dia
  return new Date(d.setDate(diff))
}

function formatarDataInput(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

export function ExtrasRelatorioPage() {
  const hoje = new Date()
  const inicioSemana = getInicioSemana(hoje)
  const fimSemana = new Date(inicioSemana)
  fimSemana.setDate(fimSemana.getDate() + 6)

  const [dataInicio, setDataInicio] = useState(formatarDataInput(inicioSemana))
  const [dataFim, setDataFim] = useState(formatarDataInput(fimSemana))
  const [busca, setBusca] = useState('')

  const { extras, loading, listar } = useExtras()

  useEffect(() => {
    listar({ dataInicio, dataFim })
  }, [dataInicio, dataFim, listar])

  const extrasFiltrados = useMemo(() => {
    let lista = extras
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      lista = lista.filter(e =>
        (e.colaborador_ausente_nome || '').toLowerCase().includes(termo) ||
        (e.substituto_nome || '').toLowerCase().includes(termo) ||
        (e.departamento_nome || '').toLowerCase().includes(termo) ||
        e.motivo.toLowerCase().includes(termo)
      )
    }
    return lista.sort((a, b) => a.data_ocorrencia.localeCompare(b.data_ocorrencia))
  }, [extras, busca])

  const totalGeral = useMemo(() => extrasFiltrados.reduce((acc, e) => acc + (e.valor || 0), 0), [extrasFiltrados])
  const totalFaturado = useMemo(() => extrasFiltrados.filter(e => e.extra_faturado).reduce((acc, e) => acc + (e.valor || 0), 0), [extrasFiltrados])
  const totalNaoFaturado = useMemo(() => extrasFiltrados.filter(e => !e.extra_faturado).reduce((acc, e) => acc + (e.valor || 0), 0), [extrasFiltrados])

  return (
    <ExtrasShell>
      <PageHeader backTo="/extras/lancamentos" title="Relatório Semanal" description="Consolidação de extras para pagamento e emissão de recibos" />

      <Filters onApply={() => {}} onClear={() => setBusca('')} loading={loading}>
        <div className="space-y-2">
          <Label>Data início</Label>
          <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Data fim</Label>
          <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Colaborador, departamento, motivo..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </Filters>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ModuleCard title="Total geral">
          <div className="text-2xl font-bold tabular-nums">{formatarMoeda(totalGeral)}</div>
        </ModuleCard>
        <ModuleCard title="Extra faturado">
          <div className="text-2xl font-bold tabular-nums text-emerald-600">{formatarMoeda(totalFaturado)}</div>
        </ModuleCard>
        <ModuleCard title="Não faturado">
          <div className="text-2xl font-bold tabular-nums text-muted-foreground">{formatarMoeda(totalNaoFaturado)}</div>
        </ModuleCard>
      </div>

      <DataTable title="Resultados" count={extrasFiltrados.length}>
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : extrasFiltrados.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
              <BarChart3 className="size-6" strokeWidth={1.8} />
            </div>
            <p className="text-[13px] text-muted-foreground">Nenhum registro encontrado.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Ausente</TableHead>
                <TableHead>Substituto</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Faturado</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extrasFiltrados.map(extra => (
                <TableRow key={extra.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{formatarDataBR(extra.data_ocorrencia)}</TableCell>
                  <TableCell>{extra.departamento_nome || '—'}</TableCell>
                  <TableCell>{extra.colaborador_ausente_nome || '—'}</TableCell>
                  <TableCell>{extra.substituto_nome || '—'}</TableCell>
                  <TableCell>{extra.motivo}</TableCell>
                  <TableCell className="tabular-nums">{formatarMoeda(extra.valor)}</TableCell>
                  <TableCell>
                    <StatusBadge variant={extra.extra_faturado ? 'success' : 'neutral'} dot={false}>
                      {extra.extra_faturado ? 'Sim' : 'Não'}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={
                        extra.status === 'Pago' ? 'success' :
                        extra.status === 'Cancelado' ? 'danger' : 'warning'
                      }
                    >
                      {extra.status}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </ExtrasShell>
  )
}
