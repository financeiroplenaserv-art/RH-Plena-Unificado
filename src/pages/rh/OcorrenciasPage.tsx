import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
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
import { Search, Plus, Trash2, Eye, Calendar, HelpCircle, SquarePen, X, FileWarning } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { AutocompleteColaborador } from '@/components/AutocompleteColaborador'
import { Paginacao } from '@/components/Paginacao'
import { Checkbox } from '@/components/ui/checkbox'
import { RhShell } from './RhShell'
import { useOcorrencias } from '@/hooks/useOcorrencias'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatarData } from '@/lib/utils'
import {
  podeCriarOcorrencia,
  podeVerDetalhesOcorrencia,
  podeCancelarOcorrencia,
  podeEditarOcorrencia,
} from '@/lib/permissoes'

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

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'Resolvida': return 'success'
    case 'Pendente': return 'warning'
    case 'Ativa': return 'info'
    case 'Cancelada': return 'neutral'
    default: return 'neutral'
  }
}

export function OcorrenciasPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeCriar = perfil ? podeCriarOcorrencia(perfil) : false
  const podeVerDetalhes = perfil ? podeVerDetalhesOcorrencia(perfil) : false
  const podeCancelar = perfil ? podeCancelarOcorrencia(perfil) : false
  const podeEditar = perfil ? podeEditarOcorrencia(perfil) : false

  const { ocorrencias, loading, paginacao, listarPaginado, excluir } = useOcorrencias()
  const [pagina, setPagina] = useState(0)
  const [modoBusca, setModoBusca] = useState<'cadastrados' | 'historicos'>('cadastrados')
  const [busca, setBusca] = useState('')
  const [filtroTipos, setFiltroTipos] = useState<string[]>([])
  const [inputTipo, setInputTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroEmpresa, setFiltroEmpresa] = useState('todos')
  const [filtroMacroGrupo, setFiltroMacroGrupo] = useState('todos')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroColaboradorId, setFiltroColaboradorId] = useState<string | undefined>(undefined)
  const [incluirNaoIdentificados, setIncluirNaoIdentificados] = useState(false)
  const [filtroStatusColaborador, setFiltroStatusColaborador] = useState<'todos' | 'ativo' | 'inativo'>('ativo')
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

  const buildFiltros = useCallback(() => ({
    tipo: filtroTipos.length > 0 ? filtroTipos : undefined,
    status: filtroStatus !== 'todos' ? filtroStatus.trim() : undefined,
    empresa_id: filtroEmpresa !== 'todos' ? filtroEmpresa.trim() : undefined,
    macro_grupo: filtroMacroGrupo !== 'todos' ? filtroMacroGrupo.trim() : undefined,
    colaborador_id: modoBusca === 'cadastrados' ? filtroColaboradorId : undefined,
    data_inicio: filtroDataInicio || undefined,
    data_fim: filtroDataFim || undefined,
    busca: modoBusca === 'historicos' ? busca.trim() || undefined : undefined,
    incluir_nao_identificados: incluirNaoIdentificados,
    status_colaborador: filtroStatusColaborador,
  }), [busca, modoBusca, filtroTipos, filtroStatus, filtroEmpresa, filtroMacroGrupo, filtroColaboradorId, filtroDataInicio, filtroDataFim, incluirNaoIdentificados, filtroStatusColaborador])

  const loadOcorrencias = useCallback(async (paginaAtual = pagina) => {
    await listarPaginado(buildFiltros(), { pagina: paginaAtual, tamanho: 50 })
  }, [buildFiltros, listarPaginado, pagina])

  const handleDelete = async (id: string) => {
    const sucesso = await excluir(id)
    if (sucesso) {
      await loadOcorrencias()
    }
    setOcorrenciaParaExcluir(null)
  }

  const limparFiltros = useCallback(() => {
    setBusca('')
    setFiltroTipos([])
    setInputTipo('')
    setFiltroStatus('todos')
    setFiltroEmpresa('todos')
    setFiltroMacroGrupo('todos')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroColaboradorId(undefined)
    setIncluirNaoIdentificados(false)
    setFiltroStatusColaborador('ativo')
    setPagina(0)
  }, [])

  useEffect(() => {
    loadEmpresas()
  }, [loadEmpresas])

  useEffect(() => {
    setPagina(0)
    loadOcorrencias(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipos, filtroStatus, filtroEmpresa, filtroMacroGrupo, filtroColaboradorId, filtroDataInicio, filtroDataFim, incluirNaoIdentificados, filtroStatusColaborador, modoBusca])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPagina(0)
      loadOcorrencias(0)
    }, 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  // Dispara busca após limpar filtros
  useEffect(() => {
    loadOcorrencias(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limparFiltros])

  const todosTiposUnicos = [...new Set(ocorrencias.map((o) => o.tipo_ocorrencia))].sort()
  const pendentesCount = ocorrencias.filter((o) => o.status === 'Pendente').length

  const adicionarTipo = (tipo: string) => {
    const t = tipo.trim()
    if (!t) return
    if (!filtroTipos.includes(t)) {
      setFiltroTipos((prev) => [...prev, t])
    }
    setInputTipo('')
  }

  const removerTipo = (tipo: string) => {
    setFiltroTipos((prev) => prev.filter((t) => t !== tipo))
  }

  const handleKeyDownTipo = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      adicionarTipo(inputTipo)
    }
  }

  return (
    <RhShell>
      <PageHeader
        backTo="/"
        title="Ocorrências"
        description={`${paginacao?.total ?? ocorrencias.length} registros${pendentesCount > 0 ? ` (${pendentesCount} pendentes)` : ''}`}
      >
        {podeCriar && (
          <Button onClick={() => navigate('/rh/ocorrencias/novo')}>
            <Plus className="size-4" /> Nova Ocorrência
          </Button>
        )}
      </PageHeader>

      <Filters
        onApply={() => {
          setPagina(0)
          loadOcorrencias(0)
        }}
        onClear={limparFiltros}
        loading={loading}
      >
        <div className="md:col-span-2 lg:col-span-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex rounded-lg border border-input p-0.5" role="group" aria-label="Modo de busca">
              {(['cadastrados', 'historicos'] as const).map((modo) => (
                <button
                  key={modo}
                  type="button"
                  onClick={() => setModoBusca(modo)}
                  className={cn(
                    'rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                    modoBusca === modo
                      ? 'bg-accent text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {modo === 'cadastrados' ? 'Cadastrados' : 'Históricos'}
                </button>
              ))}
            </div>
            <div className="flex-1">
              {modoBusca === 'cadastrados' ? (
                <AutocompleteColaborador
                  value={filtroColaboradorId}
                  onChange={(c) => setFiltroColaboradorId(c?.id)}
                  placeholder="Buscar por colaborador cadastrado..."
                />
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome original ou descrição (históricos)..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadOcorrencias()}
                    className="pl-9"
                  />
                </div>
              )}
            </div>
            <span
              title="Use &quot;Cadastrados&quot; para filtrar por colaboradores do CORH. Use &quot;Históricos&quot; para buscar ocorrências de colaboradores não cadastrados, por nome original e descrição."
              className="self-center text-muted-foreground"
            >
              <HelpCircle className="size-4" />
            </span>
          </div>
        </div>

        <Select value={filtroStatusColaborador} onValueChange={(v) => setFiltroStatusColaborador(v as 'todos' | 'ativo' | 'inativo')}>
          <SelectTrigger>
            <SelectValue placeholder="Colaborador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Colaboradores ativos</SelectItem>
            <SelectItem value="inativo">Colaboradores inativos</SelectItem>
            <SelectItem value="todos">Todos os colaboradores</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
          <SelectTrigger>
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

        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger>
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

        <Select value={filtroMacroGrupo} onValueChange={setFiltroMacroGrupo}>
          <SelectTrigger>
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

        <div className="space-y-2 md:col-span-2 lg:col-span-2">
          <div className="relative">
            <Input
              list="tipos-ocorrencia"
              placeholder="Digite e pressione Enter para filtrar tipo"
              value={inputTipo}
              onChange={(e) => setInputTipo(e.target.value)}
              onKeyDown={handleKeyDownTipo}
              onBlur={() => {
                if (inputTipo.trim() && todosTiposUnicos.includes(inputTipo.trim())) {
                  adicionarTipo(inputTipo)
                }
              }}
            />
            <datalist id="tipos-ocorrencia">
              {todosTiposUnicos.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          {filtroTipos.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {filtroTipos.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-accent px-2 py-1 text-xs text-primary"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removerTipo(t)}
                    className="hover:text-foreground"
                    title="Remover"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Calendar className="size-4" />
          <span>Período:</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={filtroDataInicio}
            onChange={(e) => setFiltroDataInicio(e.target.value)}
          />
          <span className="text-muted-foreground">até</span>
          <Input
            type="date"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="incluir-nao-identificados"
            checked={incluirNaoIdentificados}
            onCheckedChange={(checked) => setIncluirNaoIdentificados(Boolean(checked))}
          />
          <label
            htmlFor="incluir-nao-identificados"
            className="cursor-pointer select-none text-[13px]"
          >
            Incluir colaboradores não identificados
          </label>
        </div>
      </Filters>

      <DataTable title="Lista de ocorrências" count={paginacao?.total ?? ocorrencias.length}>
        {loading ? (
          <LoadingScreen className="h-64" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="hidden lg:table-cell">Grupo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ocorrencias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
                          <FileWarning className="size-6" strokeWidth={1.8} />
                        </div>
                        <p className="text-[13px] text-muted-foreground">Nenhuma ocorrência encontrada.</p>
                        {podeCriar && (
                          <Button onClick={() => navigate('/rh/ocorrencias/novo')}>
                            <Plus className="size-4" /> Nova Ocorrência
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  ocorrencias.map((o) => (
                    <TableRow
                      key={o.id}
                      className={cn('group', o.status === 'Pendente' && 'bg-muted/40')}
                    >
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {formatarData(o.data_ocorrencia)}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium break-words">
                          {o.colaborador?.nome_completo || o.colaborador_nome || 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {o.colaborador?.matricula || (o.colaborador_nome ? 'Colaborador inativo/não cadastrado' : '')}
                        </p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground break-words">
                        {o.macro_grupo || '—'}
                      </TableCell>
                      <TableCell className="break-words">{o.tipo_ocorrencia}</TableCell>
                      <TableCell className="hidden md:table-cell max-w-[12rem] lg:max-w-xs break-words">
                        {o.titulo || <span className="italic text-muted-foreground">Sem título</span>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={statusVariant(o.status)}>{o.status}</StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-60 transition group-hover:opacity-100">
                          {podeVerDetalhes && (
                            <button
                              type="button"
                              onClick={() => navigate(`/rh/ocorrencias/${o.id}`)}
                              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white hover:text-primary hover:shadow-sm"
                              title="Ver detalhes"
                            >
                              <Eye className="size-4" />
                            </button>
                          )}
                          {podeEditar && o.status !== 'Cancelada' && (
                            <button
                              type="button"
                              onClick={() => navigate(`/rh/ocorrencias/${o.id}/editar`)}
                              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white hover:text-primary hover:shadow-sm"
                              title="Editar ocorrência"
                            >
                              <SquarePen className="size-4" />
                            </button>
                          )}
                          {o.status !== 'Cancelada' && podeCancelar && (
                            <button
                              type="button"
                              onClick={() => setOcorrenciaParaExcluir(o.id)}
                              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"
                              title="Cancelar ocorrência"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {paginacao && paginacao.totalPaginas > 1 && (
              <Paginacao
                pagina={pagina}
                totalPaginas={paginacao.totalPaginas}
                totalRegistros={paginacao.total}
                tamanho={paginacao.tamanho}
                onPaginaAnterior={() => {
                  const nova = pagina - 1
                  setPagina(nova)
                  loadOcorrencias(nova)
                }}
                onPaginaProxima={() => {
                  const nova = pagina + 1
                  setPagina(nova)
                  loadOcorrencias(nova)
                }}
                carregando={loading}
              />
            )}
          </>
        )}
      </DataTable>

      <ConfirmDialog
        open={!!ocorrenciaParaExcluir}
        onOpenChange={() => setOcorrenciaParaExcluir(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Remover ocorrência?"
        description="Esta ação excluirá permanentemente o registro. Deseja continuar?"
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => ocorrenciaParaExcluir && handleDelete(ocorrenciaParaExcluir)}
        destructive
      />
    </RhShell>
  )
}
