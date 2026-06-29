import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
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
import { ExtrasPageWrapper, ExtrasCard } from './ExtrasPageWrapper'
import { PageHeader } from '@/components/PageHeader'

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
    <ExtrasPageWrapper>
      <PageHeader title="Relatório Semanal" description="Consolidação de extras para pagamento e emissão de recibos" />

      <ExtrasCard title="Filtros">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Data início</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Data fim</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Colaborador, departamento, motivo..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="rounded-lg pl-9"
              />
            </div>
          </div>
        </div>
      </ExtrasCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ExtrasCard title="Total geral">
          <div className="text-2xl font-bold" style={{ color: '#1F2937' }}>{formatarMoeda(totalGeral)}</div>
        </ExtrasCard>
        <ExtrasCard title="Extra faturado">
          <div className="text-2xl font-bold" style={{ color: '#22C55E' }}>{formatarMoeda(totalFaturado)}</div>
        </ExtrasCard>
        <ExtrasCard title="Não faturado">
          <div className="text-2xl font-bold" style={{ color: '#64748B' }}>{formatarMoeda(totalNaoFaturado)}</div>
        </ExtrasCard>
      </div>

      <ExtrasCard title={`Resultados (${extrasFiltrados.length})`}>
        <div className="overflow-x-auto">
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : extrasFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum registro encontrado</TableCell>
                </TableRow>
              ) : (
                extrasFiltrados.map(extra => (
                  <TableRow key={extra.id}>
                    <TableCell>{formatarDataBR(extra.data_ocorrencia)}</TableCell>
                    <TableCell>{extra.departamento_nome || '—'}</TableCell>
                    <TableCell>{extra.colaborador_ausente_nome || '—'}</TableCell>
                    <TableCell>{extra.substituto_nome || '—'}</TableCell>
                    <TableCell>{extra.motivo}</TableCell>
                    <TableCell>{formatarMoeda(extra.valor)}</TableCell>
                    <TableCell>
                      {extra.extra_faturado ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Sim</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Não</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        extra.status === 'Pago' ? 'bg-green-100 text-green-800' :
                        extra.status === 'Cancelado' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {extra.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ExtrasCard>
    </ExtrasPageWrapper>
  )
}
