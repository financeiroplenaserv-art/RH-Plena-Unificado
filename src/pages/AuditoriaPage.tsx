import { useEffect, useMemo, useState, Fragment } from 'react'
import { Search, History, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ModuleShell, ModuleCard } from '@/components/layout/ModuleShell'
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
import { useAuditoria } from '@/hooks/useAuditoria'
import { formatarData } from '@/lib/utils'
import { PageHeader } from '@/components/corh/PageHeader'

const TABELAS = [
  { value: 'todas', label: 'Todas as tabelas' },
  { value: 'colaboradores', label: 'Colaboradores' },
  { value: 'empresas', label: 'Empresas' },
  { value: 'departamentos', label: 'Departamentos' },
  { value: 'ocorrencias', label: 'Ocorrências' },
  { value: 'extras', label: 'Extras' },
  { value: 'recibos_extras', label: 'Recibos de extras' },
  { value: 'categorias_extras', label: 'Categorias de extras' },
  { value: 'contratos_adicionais', label: 'Contratos adicionais' },
  { value: 'vinculos_adicionais', label: 'Vínculos adicionais' },
  { value: 'calendario_adicionais', label: 'Calendário adicionais' },
  { value: 'itens_ceu', label: 'Itens CEU' },
  { value: 'entregas_ceu', label: 'Entregas CEU' },
]

const ACOES: Record<string, string> = {
  INSERT: 'Criação',
  UPDATE: 'Atualização',
  DELETE: 'Exclusão',
  CANCEL: 'Cancelamento',
}

function BadgeAcao({ acao }: { acao: string }) {
  const cores: Record<string, string> = {
    INSERT: 'bg-emerald-100 text-emerald-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
    CANCEL: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cores[acao] || 'bg-slate-100 text-slate-700'}`}>
      {ACOES[acao] || acao}
    </span>
  )
}

function DiffJSON({ dados }: { dados: Record<string, unknown> | null }) {
  if (!dados || Object.keys(dados).length === 0) return <span className="text-slate-400">—</span>
  return (
    <pre className="text-xs bg-slate-50 p-2 rounded border border-slate-200 overflow-auto max-h-48">
      {JSON.stringify(dados, null, 2)}
    </pre>
  )
}

export function AuditoriaPage() {
  const { logs, loading, loadLogs } = useAuditoria()
  const [tabela, setTabela] = useState('todas')
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    loadLogs(tabela !== 'todas' ? { tabela } : {})
  }, [tabela, loadLogs])

  const logsFiltrados = useMemo(() => {
    if (!busca.trim()) return logs
    const termo = busca.toLowerCase()
    return logs.filter((l) => {
      const campos = [
        l.tabela,
        l.operacao,
        l.registro_id,
        l.usuario_id,
        JSON.stringify(l.dados_anteriores),
        JSON.stringify(l.dados_novos),
      ]
      return campos.some((c) => String(c).toLowerCase().includes(termo))
    })
  }, [logs, busca])

  return (
    <ModuleShell>
      <PageHeader
        backTo="/"
        title="Auditoria"
        description="Histórico de ações realizadas no sistema"
      />

      <ModuleCard title="Filtros" icon={<History className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar em qualquer campo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <div>
              <Label htmlFor="tabela" className="sr-only">Tabela</Label>
              <Select value={tabela} onValueChange={setTabela}>
                <SelectTrigger id="tabela">
                  <SelectValue placeholder="Tabela" />
                </SelectTrigger>
                <SelectContent>
                  {TABELAS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
      </ModuleCard>

      <ModuleCard contentClassName="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Carregando auditoria...
                    </TableCell>
                  </TableRow>
                ) : logsFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Nenhum registro de auditoria encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  logsFiltrados.map((log) => (
                    <Fragment key={log.id}>
                      <TableRow className="cursor-pointer hover:bg-slate-50" onClick={() => setExpandido(expandido === log.id ? null : log.id)}>
                        <TableCell className="whitespace-nowrap text-sm text-slate-700">
                          {log.created_at ? formatarData(log.created_at) : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">{log.tabela}</TableCell>
                        <TableCell><BadgeAcao acao={log.operacao} /></TableCell>
                        <TableCell className="text-sm text-slate-600 font-mono truncate max-w-[150px]">{log.registro_id}</TableCell>
                        <TableCell className="text-sm text-slate-600 font-mono truncate max-w-[150px]">{log.usuario_id || '—'}</TableCell>
                        <TableCell>
                          {expandido === log.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </TableCell>
                      </TableRow>
                      {expandido === log.id && (
                        <TableRow className="bg-slate-50">
                          <TableCell colSpan={6} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Dados anteriores</p>
                                <DiffJSON dados={log.dados_anteriores} />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Dados novos</p>
                                <DiffJSON dados={log.dados_novos} />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
      </ModuleCard>
    </ModuleShell>
  )
}
