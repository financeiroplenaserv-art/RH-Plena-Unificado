import { useEffect, useState } from 'react'
import {
  Download, Upload, Loader2, Users, Building2, Search, FileSpreadsheet,
  FileText, History, RefreshCw, ChevronLeft, ChevronRight, Trash2, Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEContador } from '@/hooks/useEContador'
import { formatarCPF } from '@/lib/utils'
import { toast } from 'sonner'
import * as XLSX from '@e965/xlsx'
import type { EContadorEmpresa, EContadorFuncionario } from '@/types/econtador'
import type { HistoricoImportacao } from '@/types/econtador'

const ITENS_POR_PAGINA = 50

type ModoImportacao = 'todos' | 'ativos' | 'demissao15dias'

function diferencaDias(dataISO: string | null | undefined): number | null {
  if (!dataISO) return null
  const [ano, mes, dia] = dataISO.split('T')[0].split('-').map(Number)
  if (!ano || !mes || !dia) return null
  const data = new Date(ano, mes - 1, dia)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const diff = hoje.getTime() - data.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function filtrarPorModo(funcionarios: EContadorFuncionario[], modo: ModoImportacao): EContadorFuncionario[] {
  if (modo === 'todos') return funcionarios
  if (modo === 'ativos') return funcionarios.filter(f => f.status === 'Ativo')
  return funcionarios.filter((f) => {
    const dias = diferencaDias(f.demissao)
    return dias !== null && dias >= 0 && dias <= 15
  })
}

function filtrarPorBusca(funcionarios: EContadorFuncionario[], termo: string): EContadorFuncionario[] {
  if (!termo) return funcionarios
  return funcionarios.filter(f =>
    f.nome.toLowerCase().includes(termo) ||
    f.codigo.toLowerCase().includes(termo) ||
    f.cpf.includes(termo) ||
    (f.departamento || '').toLowerCase().includes(termo)
  )
}

function getStatusBadge(status: string) {
  const s = status?.toLowerCase() || ''
  if (s === 'ativo') return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Ativo</Badge>
  if (s === 'inativo' || s.includes('demi')) return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Inativo</Badge>
  if (s === 'afastado' || s.includes('afast')) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Afastado</Badge>
  return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{status}</Badge>
}

function exportarCSV(funcionarios: EContadorFuncionario[]) {
  const headers = ['Matrícula', 'Nome', 'CPF', 'Departamento', 'Status', 'Cargo', 'Admissão']
  const rows = funcionarios.map(f => [
    f.codigo,
    f.nome,
    f.cpf,
    f.departamento || '',
    f.status,
    f.nomefuncao || '',
    f.admissao || ''
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  downloadBlob(csv, 'funcionarios_econtador.csv', 'text/csv;charset=utf-8;')
}

function exportarExcel(funcionarios: EContadorFuncionario[]) {
  const rows = funcionarios.map(f => ({
    Matrícula: f.codigo,
    Nome: f.nome,
    CPF: f.cpf,
    Departamento: f.departamento || '',
    Status: f.status,
    Cargo: f.nomefuncao || '',
    Admissão: f.admissao || '',
    Cidade: f.cidade || '',
    Email: f.email || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Funcionarios')
  XLSX.writeFile(wb, 'funcionarios_econtador.xlsx')
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ImportarEContadorPage() {
  const {
    empresas,
    funcionarios,
    loading,
    progresso,
    historico,
    token: carregarToken,
    salvarToken,
    listarEmpresas,
    listarFuncionarios,
    importarFuncionarios,
    listarHistorico,
    reimportar,
  } = useEContador()

  const [token, setToken] = useState('')
  const [carregandoToken, setCarregandoToken] = useState(true)
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EContadorEmpresa | null>(null)
  const [resultadoImportacao, setResultadoImportacao] = useState<{ importados: number; atualizados: number; erros: number } | null>(null)

  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [reimportandoId, setReimportandoId] = useState<string | null>(null)
  const [confirmarLimparHistorico, setConfirmarLimparHistorico] = useState(false)
  const [modoImportacao, setModoImportacao] = useState<ModoImportacao>('todos')

  useEffect(() => {
    carregarToken().then((t) => {
      setToken(t)
      setCarregandoToken(false)
    })
    listarHistorico()
  }, [carregarToken, listarHistorico])

  const handleSalvarToken = async () => {
    if (!token.trim()) return
    await salvarToken(token.trim())
    await listarEmpresas()
  }

  const handleCarregarFuncionarios = async (empresa: EContadorEmpresa) => {
    setEmpresaSelecionada(empresa)
    setPagina(1)
    setResultadoImportacao(null)
    // Se o modo for ativos, já filtra pela API; para demissão filtramos localmente
    const status = modoImportacao === 'ativos' ? 'Ativo' : undefined
    await listarFuncionarios(empresa.id, status)
  }

  const handleImportar = async () => {
    if (!empresaSelecionada || funcionariosPorModo.length === 0) return
    const resultado = await importarFuncionarios(funcionariosPorModo, empresaSelecionada.codigo, empresaSelecionada.nome)
    setResultadoImportacao(resultado)
  }

  const handleReimportar = async (item: HistoricoImportacao) => {
    setReimportandoId(item.id || null)
    const resultado = await reimportar(item)
    if (resultado) {
      setResultadoImportacao(resultado)
      const empresa = empresas.find(e => e.id === item.empresa_id || e.codigo === item.empresa_id)
      if (empresa) setEmpresaSelecionada(empresa)
    }
    setReimportandoId(null)
  }

  const funcionariosPorModo = filtrarPorModo(funcionarios, modoImportacao)
  const termoBusca = busca.trim().toLowerCase()
  const funcionariosFiltrados = termoBusca
    ? filtrarPorBusca(funcionariosPorModo, termoBusca)
    : funcionariosPorModo

  const totalPaginas = Math.max(1, Math.ceil(funcionariosFiltrados.length / ITENS_POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const funcionariosPaginados = funcionariosFiltrados.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA
  )

  const totalFuncionarios = funcionariosPorModo.length
  const totalNovos = resultadoImportacao?.importados ?? 0
  const totalAtualizados = resultadoImportacao?.atualizados ?? 0

  const limparHistoricoLocal = () => {
    setConfirmarLimparHistorico(false)
    toast.info('Histórico visual limpo. Para remover do banco, utilize o Supabase.')
  }

  return (
    <div className="min-h-full p-4 md:p-6" style={{ backgroundColor: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: '#1F2937' }}>Importar do e-Contador</h2>
            <p className="text-sm" style={{ color: '#94A3B8' }}>Importe colaboradores diretamente da API Alterdata</p>
          </div>
        </div>

        {/* Resumo */}
        {totalFuncionarios > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="rounded-xl shadow-sm border-0" style={{ backgroundColor: '#FFFFFF' }}>
              <CardContent className="p-5">
                <p className="text-sm mb-1" style={{ color: '#94A3B8' }}>
                  {modoImportacao === 'todos' && 'Total de funcionários'}
                  {modoImportacao === 'ativos' && 'Funcionários ativos'}
                  {modoImportacao === 'demissao15dias' && 'Demitidos até 15 dias'}
                </p>
                <p className="text-3xl font-bold" style={{ color: '#1F2937' }}>{totalFuncionarios}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm border-0" style={{ backgroundColor: '#FFFFFF' }}>
              <CardContent className="p-5">
                <p className="text-sm mb-1" style={{ color: '#94A3B8' }}>Novos na última importação</p>
                <p className="text-3xl font-bold text-emerald-600">{totalNovos}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl shadow-sm border-0" style={{ backgroundColor: '#FFFFFF' }}>
              <CardContent className="p-5">
                <p className="text-sm mb-1" style={{ color: '#94A3B8' }}>Atualizados na última importação</p>
                <p className="text-3xl font-bold text-blue-600">{totalAtualizados}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Token */}
        <Card className="rounded-xl shadow-sm border-0" style={{ backgroundColor: '#FFFFFF' }}>
          <CardHeader>
            <CardTitle className="text-base font-semibold" style={{ color: '#1F2937' }}>1. Token de acesso</CardTitle>
            <CardDescription style={{ color: '#94A3B8' }}>Informe o token JWT do e-Contador Alterdata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token" style={{ color: '#1F2937' }}>Token JWT</Label>
              <Input
                id="token"
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <Button
              onClick={handleSalvarToken}
              disabled={!token.trim() || loading || carregandoToken}
              className="rounded-lg h-11 px-6"
              style={{ backgroundColor: '#1F2937' }}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Salvar token e listar empresas
            </Button>
          </CardContent>
        </Card>

        {/* Empresas */}
        {empresas.length > 0 && (
          <Card className="rounded-xl shadow-sm border-0" style={{ backgroundColor: '#FFFFFF' }}>
            <CardHeader>
              <CardTitle className="text-base font-semibold" style={{ color: '#1F2937' }}>2. Selecionar empresa</CardTitle>
              <CardDescription style={{ color: '#94A3B8' }}>Escolha a empresa para carregar os funcionários</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {empresas.map((empresa) => (
                  <Button
                    key={empresa.id}
                    variant={empresaSelecionada?.id === empresa.id ? 'default' : 'outline'}
                    onClick={() => handleCarregarFuncionarios(empresa)}
                    disabled={loading}
                    className="rounded-lg h-10"
                    style={empresaSelecionada?.id === empresa.id ? { backgroundColor: '#1F2937' } : { borderColor: '#1F2937', color: '#1F2937' }}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    {empresa.nome}
                    <Badge variant="secondary" className="ml-2">{empresa.codigo}</Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progresso */}
        {loading && progresso.total > 0 && (
          <Card className="rounded-xl shadow-sm border-0" style={{ backgroundColor: '#FFFFFF' }}>
            <CardContent className="py-6">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#1F2937' }} />
                <span className="text-sm font-medium" style={{ color: '#1F2937' }}>Carregando funcionários...</span>
              </div>
              <div className="w-full rounded-full h-2" style={{ backgroundColor: '#E2E8F0' }}>
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((progresso.atual / progresso.total) * 100, 100)}%`, backgroundColor: '#1F2937' }}
                />
              </div>
              <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
                {progresso.atual} de {progresso.total} registros
              </p>
            </CardContent>
          </Card>
        )}

        {/* Lista de funcionários */}
        {funcionarios.length > 0 && (
          <Card className="rounded-xl shadow-sm border-0" style={{ backgroundColor: '#FFFFFF' }}>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: '#1F2937' }}>
                <Users className="w-4 h-4" />
                {funcionariosFiltrados.length} funcionário{funcionariosFiltrados.length !== 1 ? 's' : ''} encontrado{funcionariosFiltrados.length !== 1 ? 's' : ''}
                {modoImportacao === 'ativos' && ' (ativos)'}
                {modoImportacao === 'demissao15dias' && ' (demitidos até 15 dias)'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtros e exportações */}
              <div className="flex flex-col lg:flex-row gap-3">
                <Select
                  value={modoImportacao}
                  onValueChange={(v) => {
                    setModoImportacao(v as ModoImportacao)
                    setPagina(1)
                    if (empresaSelecionada) {
                      const status = v === 'ativos' ? 'Ativo' : undefined
                      listarFuncionarios(empresaSelecionada.id, status)
                    }
                  }}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full lg:w-[280px] rounded-lg" style={{ borderColor: '#E2E8F0' }}>
                    <Filter className="w-4 h-4 mr-2" style={{ color: '#94A3B8' }} />
                    <SelectValue placeholder="Importar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Importar todos</SelectItem>
                    <SelectItem value="ativos">Importar somente ativos</SelectItem>
                    <SelectItem value="demissao15dias">Importar demitidos nos últimos 15 dias</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94A3B8' }} />
                  <Input
                    placeholder="Buscar por nome, matrícula, CPF ou departamento..."
                    value={busca}
                    onChange={(e) => { setBusca(e.target.value); setPagina(1) }}
                    className="pl-10 rounded-lg"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => exportarExcel(funcionariosFiltrados)}
                  className="rounded-lg h-10"
                  style={{ borderColor: '#1F2937', color: '#1F2937' }}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportarCSV(funcionariosFiltrados)}
                  className="rounded-lg h-10"
                  style={{ borderColor: '#1F2937', color: '#1F2937' }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  CSV
                </Button>
              </div>

              {/* Tabela paginada */}
              <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
                <Table>
                  <TableHeader style={{ backgroundColor: '#F8FAFC' }}>
                    <TableRow>
                      <TableHead style={{ color: '#1F2937' }}>Matrícula</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>Nome</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>CPF</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>Departamento</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>Cargo</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funcionariosPaginados.map((f) => (
                      <TableRow key={f.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium" style={{ color: '#1F2937' }}>{f.codigo}</TableCell>
                        <TableCell style={{ color: '#1F2937' }}>{f.nome}</TableCell>
                        <TableCell style={{ color: '#64748B' }}>{formatarCPF(f.cpf)}</TableCell>
                        <TableCell style={{ color: '#64748B' }}>{f.departamento || '—'}</TableCell>
                        <TableCell style={{ color: '#64748B' }}>{f.nomefuncao || '—'}</TableCell>
                        <TableCell>{getStatusBadge(f.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: '#94A3B8' }}>
                    Página {paginaAtual} de {totalPaginas} • {funcionariosFiltrados.length} registros
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagina(p => Math.max(1, p - 1))}
                      disabled={paginaAtual === 1}
                      className="rounded-lg"
                      style={{ borderColor: '#1F2937', color: '#1F2937' }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaAtual === totalPaginas}
                      className="rounded-lg"
                      style={{ borderColor: '#1F2937', color: '#1F2937' }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Importar */}
              <Button
                onClick={handleImportar}
                disabled={loading}
                className="w-full sm:w-auto rounded-lg h-11 px-6"
                style={{ backgroundColor: '#1F2937' }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Importar para dados mestres
              </Button>

              {resultadoImportacao && (
                <div className="flex flex-wrap gap-3 text-sm">
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 px-3 py-1">
                    {resultadoImportacao.importados} novos
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 px-3 py-1">
                    {resultadoImportacao.atualizados} atualizados
                  </Badge>
                  {resultadoImportacao.erros > 0 && (
                    <Badge variant="destructive" className="px-3 py-1">{resultadoImportacao.erros} erros</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Histórico de importações */}
        <Card className="rounded-xl shadow-sm border-0" style={{ backgroundColor: '#FFFFFF' }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: '#1F2937' }}>
                <History className="w-4 h-4" />
                Histórico de importações
              </CardTitle>
              <CardDescription style={{ color: '#94A3B8' }}>Últimas 10 importações realizadas</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmarLimparHistorico(true)}
              className="rounded-lg"
              style={{ borderColor: '#1F2937', color: '#1F2937' }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: '#94A3B8' }}>
                Nenhuma importação registrada ainda.
              </p>
            ) : (
              <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
                <Table>
                  <TableHeader style={{ backgroundColor: '#F8FAFC' }}>
                    <TableRow>
                      <TableHead style={{ color: '#1F2937' }}>Data</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>Empresa</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>Quantidade</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>Novos</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>Atualizados</TableHead>
                      <TableHead style={{ color: '#1F2937' }}>Erros</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((h) => (
                      <TableRow key={h.id} className="hover:bg-slate-50">
                        <TableCell style={{ color: '#1F2937' }}>
                          {h.created_at ? new Date(h.created_at).toLocaleString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell style={{ color: '#1F2937' }}>{h.empresa_nome || '—'}</TableCell>
                        <TableCell style={{ color: '#64748B' }}>{h.quantidade}</TableCell>
                        <TableCell className="text-emerald-600">{h.importados}</TableCell>
                        <TableCell className="text-blue-600">{h.atualizados}</TableCell>
                        <TableCell className={h.erros > 0 ? 'text-red-600' : ''} style={{ color: h.erros > 0 ? undefined : '#64748B' }}>
                          {h.erros}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReimportar(h)}
                            disabled={loading || reimportandoId === h.id}
                            className="rounded-lg"
                            style={{ borderColor: '#1F2937', color: '#1F2937' }}
                          >
                            {reimportandoId === h.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            Reimportar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmarLimparHistorico} onOpenChange={setConfirmarLimparHistorico}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base" style={{ color: '#1F2937' }}>Limpar histórico?</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: '#94A3B8' }}>
              Esta ação apenas oculta o histórico da tela. Os registros permanecem no banco de dados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmarLimparHistorico(false)} className="rounded-lg" style={{ borderColor: '#1F2937', color: '#1F2937' }}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={limparHistoricoLocal} className="rounded-lg">
              Limpar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
