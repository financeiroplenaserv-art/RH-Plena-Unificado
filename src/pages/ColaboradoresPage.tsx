import { useState, useEffect } from 'react'
import { Search, RefreshCw, User, X, Pencil, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useAuth } from '@/hooks/useAuth'
import { DepartamentoAutocomplete } from '@/components/DepartamentoAutocomplete'
import { formatarCPF, formatarData, mascaraTelefone } from '@/lib/utils'
import { podeEditarColaboradorBasico } from '@/lib/permissoes'
import { BadgeStatus } from '@/components/BadgeStatus'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Paginacao } from '@/components/Paginacao'
import { supabase } from '@/lib/supabase'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { DataTable } from '@/components/corh/DataTable'
import type { Colaborador, StatusColaborador } from '@/types/database'

export function ColaboradoresPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeEditar = perfil ? podeEditarColaboradorBasico(perfil) : false

  const { colaboradores, loading, paginacao, listarPaginado, atualizar } = useColaboradores()
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusColaborador | 'todos'>('Ativo')
  const [filtroDepartamento, setFiltroDepartamento] = useState('todos')
  const [filtroCargo, setFiltroCargo] = useState('todos')
  const [filtroEmpresa, setFiltroEmpresa] = useState('todos')
  const [cargos, setCargos] = useState<{ nome: string }[]>([])
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([])
  const [departamentos, setDepartamentos] = useState<{ id: string; nome: string; nome_curto: string | null }[]>([])
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<Colaborador | null>(null)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [formEdicao, setFormEdicao] = useState<Partial<Colaborador>>({})
  const [salvando, setSalvando] = useState(false)
  const [pagina, setPagina] = useState(0)

  useEffect(() => {
    listarPaginado({ status: 'Ativo' }, { pagina: 0, tamanho: 50 })
    async function carregarOpcoes() {
      const [{ data: cargosData }, { data: empresasData }, { data: departamentosData }] = await Promise.all([
        supabase.from('colaboradores').select('cargo').not('cargo', 'is', null),
        supabase.from('empresas').select('id, nome').order('nome'),
        supabase.from('departamentos').select('id, nome, nome_curto').order('nome_curto'),
      ])

      const cargosUnicos = Array.from(
        new Set((cargosData || []).map((c: { cargo: string }) => c.cargo).filter(Boolean))
      ).sort() as string[]
      setCargos(cargosUnicos.map((nome) => ({ nome })))

      setEmpresas((empresasData || []) as { id: string; nome: string }[])
      setDepartamentos((departamentosData || []) as { id: string; nome: string; nome_curto: string | null }[])
    }
    carregarOpcoes()
  }, [listarPaginado])

  const buildFiltros = () => ({
    busca,
    status: filtroStatus !== 'todos' ? filtroStatus : undefined,
    cargo: filtroCargo !== 'todos' ? filtroCargo : undefined,
    empresaId: filtroEmpresa !== 'todos' ? filtroEmpresa : undefined,
    departamentoId: filtroDepartamento !== 'todos' ? filtroDepartamento : undefined,
  })

  const aplicarFiltros = () => {
    setPagina(0)
    listarPaginado(buildFiltros(), { pagina: 0, tamanho: 50 })
  }

  const limparFiltros = () => {
    setBusca('')
    setFiltroStatus('Ativo')
    setFiltroDepartamento('todos')
    setFiltroCargo('todos')
    setFiltroEmpresa('todos')
    setPagina(0)
    listarPaginado({ status: 'Ativo' }, { pagina: 0, tamanho: 50 })
  }

  const iniciais = (nome: string) => {
    const limpo = nome?.trim()
    if (!limpo) return '—'
    const partes = limpo.split(' ').filter(Boolean)
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  }

  const abrirDetalhes = (c: Colaborador) => {
    setColaboradorSelecionado(c)
    setFormEdicao({
      nome_completo: c.nome_completo,
      email: c.email || '',
      telefone: c.telefone || '',
      celular: c.celular || '',
      cargo: c.cargo || '',
      departamento: c.departamento || '',
      status: c.status,
    })
    setModoEdicao(false)
  }

  const fecharDialog = () => {
    setColaboradorSelecionado(null)
    setModoEdicao(false)
  }

  const salvarEdicao = async () => {
    if (!colaboradorSelecionado) return
    setSalvando(true)
    const sucesso = await atualizar(colaboradorSelecionado.id, formEdicao)
    if (sucesso) {
      setColaboradorSelecionado((prev) => (prev ? { ...prev, ...formEdicao } : null))
      await listarPaginado(buildFiltros(), { pagina, tamanho: 50 })
      setModoEdicao(false)
    }
    setSalvando(false)
  }

  return (
    <div className="min-h-full space-y-5">
      <PageHeader backTo="/" title="Colaboradores" description="Dados mestres importados do e-Contador">
        <Button
          variant="outline"
          onClick={() => listarPaginado(buildFiltros(), { pagina, tamanho: 50 })}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </PageHeader>

      <Filters onApply={aplicarFiltros} onClear={limparFiltros} loading={loading}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
            className="pl-9"
          />
        </div>

        <DepartamentoAutocomplete
          value={filtroDepartamento}
          onChange={setFiltroDepartamento}
          mode="id"
          placeholder="Departamento"
          formatLabel={(d) => `${d.nome_curto || d.nome}${d.nome_curto && d.nome ? ` (${d.nome})` : ''}`}
        />

        <Select value={filtroCargo} onValueChange={setFiltroCargo}>
          <SelectTrigger>
            <SelectValue placeholder="Função" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as funções</SelectItem>
            {cargos.map((c) => (
              <SelectItem key={c.nome} value={c.nome}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as StatusColaborador | 'todos')}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="Ativo">Ativo</SelectItem>
            <SelectItem value="Inativo">Inativo</SelectItem>
            <SelectItem value="Afastado">Afastado</SelectItem>
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
      </Filters>

      <DataTable title="Lista de colaboradores" count={paginacao?.total ?? colaboradores.length}>
        {loading ? (
          <LoadingScreen className="h-64" />
        ) : colaboradores.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <User className="mx-auto mb-3 size-10 text-border" />
            <p className="text-[13px]">Nenhum colaborador encontrado.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colaboradores.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => abrirDetalhes(c)}>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {c.foto_url ? (
                          <img src={c.foto_url} alt="" className="size-full rounded-full object-cover" />
                        ) : c.nome_completo ? (
                          <span>{iniciais(c.nome_completo)}</span>
                        ) : (
                          <User className="size-4" />
                        )}
                      </div>
                      <span className="line-clamp-2 break-words sm:line-clamp-1">{c.nome_completo}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.cargo || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {nomeCurtoDepartamentoFuzzy(departamentos, c.departamento_id, c.departamento, c.empresa_id)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{c.telefone || c.celular || '—'}</TableCell>
                  <TableCell>
                    <BadgeStatus status={c.status} />
                  </TableCell>
                  <TableCell>
                    {podeEditar && (
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          abrirDetalhes(c)
                          setModoEdicao(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {paginacao && paginacao.totalPaginas > 1 && (
          <Paginacao
            pagina={pagina}
            totalPaginas={paginacao.totalPaginas}
            totalRegistros={paginacao.total}
            tamanho={paginacao.tamanho}
            onPaginaAnterior={() => {
              const nova = pagina - 1
              setPagina(nova)
              listarPaginado(buildFiltros(), { pagina: nova, tamanho: 50 })
            }}
            onPaginaProxima={() => {
              const nova = pagina + 1
              setPagina(nova)
              listarPaginado(buildFiltros(), { pagina: nova, tamanho: 50 })
            }}
            carregando={loading}
          />
        )}
      </DataTable>

      <Dialog open={!!colaboradorSelecionado} onOpenChange={(open) => !open && fecharDialog()}>
        <DialogContent className="max-w-2xl">
          {colaboradorSelecionado && (
            <div className="space-y-4">
              <DialogHeader className="pb-2 border-b border-border">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-semibold">
                    {modoEdicao ? 'Editar colaborador' : 'Detalhes'}
                  </DialogTitle>
                  <div className="flex items-center gap-1">
                    {!modoEdicao && podeEditar && (
                      <Button variant="ghost" size="sm" onClick={() => setModoEdicao(true)}>
                        <Pencil className="mr-1.5 size-4" />
                        Editar
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={fecharDialog}>
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">
                  {colaboradorSelecionado.nome_completo ? (
                    <span>{iniciais(colaboradorSelecionado.nome_completo)}</span>
                  ) : (
                    <User className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {modoEdicao ? (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Nome completo</Label>
                      <Input
                        value={formEdicao.nome_completo || ''}
                        onChange={(e) => setFormEdicao((prev) => ({ ...prev, nome_completo: e.target.value }))}
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-base font-semibold leading-tight">{colaboradorSelecionado.nome_completo}</p>
                      <div className="flex items-center gap-2">
                        <BadgeStatus status={colaboradorSelecionado.status} />
                        <span className="text-xs text-muted-foreground">{colaboradorSelecionado.matricula || '—'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {modoEdicao ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Cargo</Label>
                      <Input
                        value={formEdicao.cargo || ''}
                        onChange={(e) => setFormEdicao((prev) => ({ ...prev, cargo: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Departamento</Label>
                      <Input
                        value={formEdicao.departamento || ''}
                        onChange={(e) => setFormEdicao((prev) => ({ ...prev, departamento: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Telefone</Label>
                      <Input
                        value={mascaraTelefone(formEdicao.telefone || '')}
                        onChange={(e) => setFormEdicao((prev) => ({ ...prev, telefone: mascaraTelefone(e.target.value) }))}
                        placeholder="(00) 0000-0000"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Celular</Label>
                      <Input
                        value={mascaraTelefone(formEdicao.celular || '')}
                        onChange={(e) => setFormEdicao((prev) => ({ ...prev, celular: mascaraTelefone(e.target.value) }))}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px] text-muted-foreground">E-mail</Label>
                    <Input
                      type="email"
                      value={formEdicao.email || ''}
                      onChange={(e) => setFormEdicao((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-muted-foreground">Status</Label>
                    <Select
                      value={formEdicao.status || 'Ativo'}
                      onValueChange={(v) => setFormEdicao((prev) => ({ ...prev, status: v as StatusColaborador }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Inativo">Inativo</SelectItem>
                        <SelectItem value="Afastado">Afastado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-border pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setModoEdicao(false)} disabled={salvando}>
                      Cancelar
                    </Button>
                    <Button type="button" size="sm" onClick={salvarEdicao} disabled={salvando || !formEdicao.nome_completo?.trim()}>
                      {salvando ? <RefreshCw className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cargo</p>
                        <p className="text-sm font-medium break-words">{colaboradorSelecionado.cargo || '—'}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Departamento</p>
                        <p className="text-sm font-medium break-words">{colaboradorSelecionado.departamento || '—'}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Admissão</p>
                        <p className="text-sm font-medium">
                          {colaboradorSelecionado.data_admissao ? formatarData(colaboradorSelecionado.data_admissao) : '—'}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Telefone</p>
                        <p className="text-sm font-medium break-words">{colaboradorSelecionado.telefone || colaboradorSelecionado.celular || '—'}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardContent className="p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">E-mail</p>
                      <p className="text-sm font-medium break-all">{colaboradorSelecionado.email || '—'}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Endereço</p>
                      <p className="text-sm font-medium">
                        {colaboradorSelecionado.endereco
                          ? `${colaboradorSelecionado.endereco}${colaboradorSelecionado.cidade ? `, ${colaboradorSelecionado.cidade}` : ''}${colaboradorSelecionado.estado ? ` - ${colaboradorSelecionado.estado}` : ''}${colaboradorSelecionado.cep ? `, ${colaboradorSelecionado.cep}` : ''}`
                          : '—'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Documentos</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] text-muted-foreground">CPF</span>
                          <p className="text-sm font-medium">
                            {colaboradorSelecionado.cpf ? formatarCPF(colaboradorSelecionado.cpf) : '—'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">RG</span>
                          <p className="text-sm font-medium">{colaboradorSelecionado.rg || '—'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
