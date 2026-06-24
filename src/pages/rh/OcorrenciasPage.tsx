import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { toast } from 'sonner'
import { Search, Plus, Trash2, Eye, Calendar, SlidersHorizontal } from 'lucide-react'
import { BadgeStatus } from '@/components/BadgeStatus'
import { LoadingScreen } from '@/components/LoadingScreen'
import { AutocompleteColaborador } from '@/components/AutocompleteColaborador'
import type { Ocorrencia, StatusOcorrencia } from '@/types/database'
import { formatarData } from '@/lib/utils'

const MACRO_GRUPOS = [
  '1. Jornada e Ponto',
  '2. Conduta e Disciplina',
  '3. Saúde e Segurança (SST)',
  '4. Afastamentos e Licenças',
  '5. Desempenho e Produtividade',
  '6. Relacionamento Interpessoal',
  '7. Patrimonial',
  '8. Administrativas',
  '9. Registro do RH',
]

const GRAVIDADES = ['Leve', 'Média', 'Grave', 'Gravíssima']

export function OcorrenciasPage() {
  const navigate = useNavigate()
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroEmpresa, setFiltroEmpresa] = useState('todos')
  const [filtroMacroGrupo, setFiltroMacroGrupo] = useState('todos')
  const [filtroGravidade, setFiltroGravidade] = useState('todos')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroColaboradorId, setFiltroColaboradorId] = useState<string | undefined>(undefined)
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([])
  const [ocorrenciaParaExcluir, setOcorrenciaParaExcluir] = useState<string | null>(null)

  const loadEmpresas = useCallback(async () => {
    const { data } = await supabase.from('empresas').select('id, nome').order('nome')
    const doBanco = (data || []) as { id: string; nome: string }[]
    const vistos = new Set<string>()
    const unicos = doBanco.filter((e) => {
      if (vistos.has(e.nome)) return false
      vistos.add(e.nome)
      return true
    })
    setEmpresas(unicos)
  }, [])

  const loadOcorrencias = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('ocorrencias')
      .select('*, colaborador:colaborador_id(matricula, nome_completo, cargo, empresa_id)')
      .order('data_ocorrencia', { ascending: false })

    const tipo = filtroTipo !== 'todos' ? filtroTipo.trim() : ''
    const status = filtroStatus !== 'todos' ? filtroStatus.trim() : ''
    const empresa = filtroEmpresa !== 'todos' ? filtroEmpresa.trim() : ''
    const macroGrupo = filtroMacroGrupo !== 'todos' ? filtroMacroGrupo.trim() : ''
    const gravidade = filtroGravidade !== 'todos' ? filtroGravidade.trim() : ''

    if (tipo) query = query.eq('tipo_ocorrencia', tipo)
    if (status) query = query.eq('status', status as StatusOcorrencia)
    if (empresa) query = query.eq('empresa_id', empresa)
    if (macroGrupo) query = query.eq('macro_grupo', macroGrupo)
    if (gravidade) query = query.eq('gravidade', gravidade)
    if (filtroColaboradorId) query = query.eq('colaborador_id', filtroColaboradorId)
    if (filtroDataInicio) query = query.gte('data_ocorrencia', filtroDataInicio)
    if (filtroDataFim) query = query.lte('data_ocorrencia', filtroDataFim)

    const { data } = await query
    let filtered = (data as Ocorrencia[]) || []
    if (busca) {
      const termo = busca.toLowerCase()
      filtered = filtered.filter(
        (o: Ocorrencia) =>
          o.colaborador?.nome_completo?.toLowerCase().includes(termo) ||
          o.tipo_ocorrencia?.toLowerCase().includes(termo) ||
          o.titulo?.toLowerCase().includes(termo)
      )
    }
    setOcorrencias(filtered)
    setLoading(false)
  }, [busca, filtroColaboradorId, filtroDataFim, filtroDataInicio, filtroEmpresa, filtroGravidade, filtroMacroGrupo, filtroStatus, filtroTipo])

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('ocorrencias').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir: ' + error.message)
    else {
      toast.success('Ocorrência removida')
      loadOcorrencias()
    }
    setOcorrenciaParaExcluir(null)
  }

  useEffect(() => {
    loadEmpresas()
  }, [loadEmpresas])

  useEffect(() => {
    loadOcorrencias()
  }, [loadOcorrencias])

  const tiposUnicos = [...new Set(ocorrencias.map((o) => o.tipo_ocorrencia))].sort()
  const pendentesCount = ocorrencias.filter((o) => o.status === 'Pendente').length

  return (
    <div className="min-h-full bg-[#F8FAFC] space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1F2937]">RH Ocorrências</h2>
          <p className="text-sm text-[#94A3B8]">
            {ocorrencias.length} registros
            {pendentesCount > 0 && (
              <span className="text-[#1F2937] font-medium ml-2">({pendentesCount} pendentes)</span>
            )}
          </p>
        </div>
        <Button
          onClick={() => navigate('/rh/ocorrencias/novo')}
          className="gap-2 bg-[#1F2937] hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" /> Nova Ocorrência
        </Button>
      </div>

      <Card className="bg-white rounded-[12px] shadow-sm border-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-[#1F2937]">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
              <Input
                placeholder="Buscar por tipo ou título..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadOcorrencias()}
                className="pl-9 bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937] placeholder:text-[#94A3B8]"
              />
            </div>

            <AutocompleteColaborador
              value={filtroColaboradorId}
              onChange={(c) => setFiltroColaboradorId(c?.id)}
              placeholder="Filtrar por colaborador..."
            />

            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937]">
                <SelectValue placeholder="Tipo de ocorrência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {tiposUnicos.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Ativa">Ativa</SelectItem>
                <SelectItem value="Resolvida">Resolvida</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
              <SelectTrigger className="bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937]">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroMacroGrupo} onValueChange={setFiltroMacroGrupo}>
              <SelectTrigger className="bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937]">
                <SelectValue placeholder="Macro grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os grupos</SelectItem>
                {MACRO_GRUPOS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroGravidade} onValueChange={setFiltroGravidade}>
              <SelectTrigger className="bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937]">
                <SelectValue placeholder="Gravidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as gravidades</SelectItem>
                {GRAVIDADES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
            <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
              <Calendar className="h-4 w-4" />
              <span>Período:</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <Input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="w-auto bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937]"
              />
              <span className="text-[#94A3B8]">até</span>
              <Input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="w-auto bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937]"
              />
            </div>
            <Button
              onClick={loadOcorrencias}
              disabled={loading}
              className="bg-[#1F2937] hover:bg-slate-800 text-white rounded-[8px]"
            >
              Aplicar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white rounded-[12px] shadow-sm border-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#1F2937]">Lista de ocorrências</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingScreen className="h-64" />
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[#94A3B8]">Data</TableHead>
                    <TableHead className="text-[#94A3B8]">Colaborador</TableHead>
                    <TableHead className="hidden lg:table-cell text-[#94A3B8]">Grupo</TableHead>
                    <TableHead className="text-[#94A3B8]">Tipo</TableHead>
                    <TableHead className="hidden md:table-cell text-[#94A3B8]">Título</TableHead>
                    <TableHead className="text-[#94A3B8]">Status</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ocorrencias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-[#94A3B8]">
                        Nenhuma ocorrência encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ocorrencias.map((o) => (
                      <TableRow
                        key={o.id}
                        className={o.status === 'Pendente' ? 'bg-slate-50/50' : ''}
                      >
                        <TableCell className="whitespace-nowrap text-xs text-[#94A3B8]">
                          {formatarData(o.data_ocorrencia)}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-[#1F2937]">
                            {o.colaborador?.nome_completo || 'N/A'}
                          </p>
                          <p className="text-xs text-[#94A3B8]">{o.colaborador?.matricula}</p>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-[#94A3B8]">
                          {o.macro_grupo || '—'}
                        </TableCell>
                        <TableCell className="text-[#1F2937]">{o.tipo_ocorrencia}</TableCell>
                        <TableCell className="hidden md:table-cell max-w-xs truncate text-[#1F2937]">
                          {o.titulo || <span className="text-[#94A3B8] italic">Sem título</span>}
                        </TableCell>
                        <TableCell>
                          <BadgeStatus status={o.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => navigate(`/rh/ocorrencias/${o.id}`)}
                              className="border-[#1F2937] text-[#1F2937] hover:bg-[#1F2937] hover:text-white h-8 w-8"
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {o.status !== 'Cancelada' && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setOcorrenciaParaExcluir(o.id)}
                                className="border-[#1F2937] text-[#1F2937] hover:bg-[#1F2937] hover:text-white h-8 w-8"
                                title="Cancelar ocorrência"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!ocorrenciaParaExcluir} onOpenChange={(open) => !open && setOcorrenciaParaExcluir(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1F2937]">Remover ocorrência?</DialogTitle>
            <DialogDescription className="text-xs text-[#94A3B8]">
              Esta ação excluirá permanentemente o registro. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="border-[#1F2937] text-[#1F2937] hover:bg-[#1F2937] hover:text-white" onClick={() => setOcorrenciaParaExcluir(null)}>
              Cancelar
            </Button>
            <Button size="sm" className="bg-[#1F2937] hover:bg-slate-800 text-white" onClick={() => ocorrenciaParaExcluir && handleDelete(ocorrenciaParaExcluir)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
