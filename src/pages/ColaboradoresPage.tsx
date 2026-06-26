import { useState, useEffect } from 'react'
import { Search, RefreshCw, User, X, Pencil, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useColaboradores } from '@/hooks/useColaboradores'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatarCPF, formatarData, mascaraTelefone } from '@/lib/utils'
import { podeEditarColaboradorBasico } from '@/lib/permissoes'
import { BadgeStatus } from '@/components/BadgeStatus'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Paginacao } from '@/components/Paginacao'
import { supabase } from '@/lib/supabase'
import type { Colaborador, StatusColaborador, Departamento } from '@/types/database'

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
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [cargos, setCargos] = useState<{ nome: string }[]>([])
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([])
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<Colaborador | null>(null)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [formEdicao, setFormEdicao] = useState<Partial<Colaborador>>({})
  const [salvando, setSalvando] = useState(false)
  const [pagina, setPagina] = useState(0)

  useEffect(() => {
    listarPaginado({ status: 'Ativo' }, { pagina: 0, tamanho: 50 })
    async function carregarOpcoes() {
      const [{ data: deptData }, { data: cargosData }, { data: empresasData }] = await Promise.all([
        supabase.from('departamentos').select('*').order('nome_curto'),
        supabase.from('colaboradores').select('cargo').not('cargo', 'is', null),
        supabase.from('empresas').select('id, nome').order('nome'),
      ])

      setDepartamentos((deptData || []) as Departamento[])

      const cargosUnicos = Array.from(
        new Set((cargosData || []).map((c: { cargo: string }) => c.cargo).filter(Boolean))
      ).sort() as string[]
      setCargos(cargosUnicos.map((nome) => ({ nome })))

      setEmpresas((empresasData || []) as { id: string; nome: string }[])
    }
    carregarOpcoes()
  }, [listarPaginado])

  const aplicarFiltros = () => {
    setPagina(0)
    listarPaginado({
      busca,
      status: filtroStatus !== 'todos' ? filtroStatus : undefined,
      cargo: filtroCargo !== 'todos' ? filtroCargo : undefined,
      empresaId: filtroEmpresa !== 'todos' ? filtroEmpresa : undefined,
      departamentoNomeCurto: filtroDepartamento !== 'todos' ? filtroDepartamento : undefined,
    }, { pagina: 0, tamanho: 50 })
  }

  const colaboradoresFiltrados = colaboradores

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
      // Atualiza o colaborador selecionado localmente para refletir a mudança
      setColaboradorSelecionado((prev) => (prev ? { ...prev, ...formEdicao } : null))
      await listarPaginado({
        busca,
        status: filtroStatus !== 'todos' ? filtroStatus : undefined,
        cargo: filtroCargo !== 'todos' ? filtroCargo : undefined,
        empresaId: filtroEmpresa !== 'todos' ? filtroEmpresa : undefined,
        departamentoNomeCurto: filtroDepartamento !== 'todos' ? filtroDepartamento : undefined,
      }, { pagina, tamanho: 50 })
      setModoEdicao(false)
    }
    setSalvando(false)
  }

  return (
    <div className="min-h-full bg-[#F8FAFC] space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1F2937]">Colaboradores</h2>
          <p className="text-sm text-[#94A3B8]">Dados mestres importados do e-Contador</p>
        </div>
        <Button variant="outline" onClick={() => listarPaginado({
          busca,
          status: filtroStatus !== 'todos' ? filtroStatus : undefined,
          cargo: filtroCargo !== 'todos' ? filtroCargo : undefined,
          empresaId: filtroEmpresa !== 'todos' ? filtroEmpresa : undefined,
          departamentoNomeCurto: filtroDepartamento !== 'todos' ? filtroDepartamento : undefined,
        }, { pagina, tamanho: 50 })} disabled={loading} className="bg-white border-[#E2E8F0] text-[#1F2937] hover:bg-slate-50 rounded-[8px]">
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      <Card className="bg-white rounded-[12px] shadow-sm border-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] w-4 h-4" />
              <Input
                placeholder="Buscar por nome..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                className="pl-10 bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937] placeholder:text-[#94A3B8]"
              />
            </div>

            <Select value={filtroDepartamento} onValueChange={setFiltroDepartamento}>
              <SelectTrigger className="bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937]">
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os departamentos</SelectItem>
                {departamentos.map((d) => {
                  const label = d.nome_curto || d.nome
                  return (
                    <SelectItem key={d.id} value={label}>
                      {label}
                      {d.nome_curto ? <span className="ml-1 text-slate-400 text-xs">({d.nome})</span> : null}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            <Select value={filtroCargo} onValueChange={setFiltroCargo}>
              <SelectTrigger className="bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937]">
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
              <SelectTrigger className="bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937]">
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
          </div>

          <div className="flex justify-end pt-3 border-t border-[#E2E8F0]">
            <Button
              onClick={aplicarFiltros}
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
          <CardTitle className="text-base text-[#1F2937]">
            Lista de colaboradores ({paginacao?.total ?? colaboradoresFiltrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingScreen className="h-64" />
          ) : colaboradoresFiltrados.length === 0 ? (
            <div className="text-center py-12 text-[#94A3B8]">
              <User className="w-10 h-10 mx-auto mb-3 text-[#E2E8F0]" />
              <p>Nenhum colaborador encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {colaboradoresFiltrados.map((c) => (
                <div
                  key={c.id}
                  onClick={() => abrirDetalhes(c)}
                  className="flex items-start gap-3 p-3 bg-white rounded-[12px] shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#64748B] text-[14px] font-semibold">
                    {c.nome_completo ? (
                      <span>{iniciais(c.nome_completo)}</span>
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[#1F2937] leading-tight line-clamp-3 sm:line-clamp-2 break-words">{c.nome_completo}</p>
                    <p className="text-[12px] font-normal text-[#94A3B8] mt-0.5 line-clamp-2 sm:line-clamp-1 break-words">{c.cargo || c.departamento || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
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
                listarPaginado({
                  busca,
                  status: filtroStatus !== 'todos' ? filtroStatus : undefined,
                  cargo: filtroCargo !== 'todos' ? filtroCargo : undefined,
                  empresaId: filtroEmpresa !== 'todos' ? filtroEmpresa : undefined,
                  departamentoNomeCurto: filtroDepartamento !== 'todos' ? filtroDepartamento : undefined,
                }, { pagina: nova, tamanho: 50 })
              }}
              onPaginaProxima={() => {
                const nova = pagina + 1
                setPagina(nova)
                listarPaginado({
                  busca,
                  status: filtroStatus !== 'todos' ? filtroStatus : undefined,
                  cargo: filtroCargo !== 'todos' ? filtroCargo : undefined,
                  empresaId: filtroEmpresa !== 'todos' ? filtroEmpresa : undefined,
                  departamentoNomeCurto: filtroDepartamento !== 'todos' ? filtroDepartamento : undefined,
                }, { pagina: nova, tamanho: 50 })
              }}
              carregando={loading}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!colaboradorSelecionado} onOpenChange={(open) => !open && fecharDialog()}>
        <DialogContent className="max-w-2xl bg-[#F8FAFC] p-0 border-none">
          {colaboradorSelecionado && (
            <div className="p-5 space-y-4">
              <DialogHeader className="pb-2 border-b border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-semibold text-[#1F2937]">
                    {modoEdicao ? 'Editar colaborador' : 'Detalhes'}
                  </DialogTitle>
                  <div className="flex items-center gap-1">
                    {!modoEdicao && podeEditar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setModoEdicao(true)}
                        className="h-8 text-[#1F2937] hover:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4 mr-1.5" />
                        Editar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={fecharDialog}
                      className="h-7 w-7 text-[#94A3B8] hover:text-[#1F2937]"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#64748B] font-semibold text-sm">
                  {colaboradorSelecionado.nome_completo ? (
                    <span>{iniciais(colaboradorSelecionado.nome_completo)}</span>
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {modoEdicao ? (
                    <div>
                      <Label className="text-[10px] text-[#94A3B8]">Nome completo</Label>
                      <Input
                        value={formEdicao.nome_completo || ''}
                        onChange={(e) => setFormEdicao((prev) => ({ ...prev, nome_completo: e.target.value }))}
                        className="h-9 rounded-[8px] border-[#E2E8F0]"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-base font-semibold text-[#1F2937] leading-tight">
                        {colaboradorSelecionado.nome_completo}
                      </p>
                      <div className="flex items-center gap-2">
                        <BadgeStatus status={colaboradorSelecionado.status} />
                        <span className="text-xs text-[#94A3B8]">
                          {colaboradorSelecionado.matricula || '—'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {modoEdicao ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-[#94A3B8]">Cargo</Label>
                      <Input
                        value={formEdicao.cargo || ''}
                        onChange={(e) => setFormEdicao((prev) => ({ ...prev, cargo: e.target.value }))}
                        className="h-9 rounded-[8px] border-[#E2E8F0]"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-[#94A3B8]">Departamento</Label>
                      <Input
                        value={formEdicao.departamento || ''}
                        onChange={(e) => setFormEdicao((prev) => ({ ...prev, departamento: e.target.value }))}
                        className="h-9 rounded-[8px] border-[#E2E8F0]"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-[#94A3B8]">Telefone</Label>
                      <Input
                        value={mascaraTelefone(formEdicao.telefone || '')}
                        onChange={(e) => setFormEdicao((prev) => ({ ...prev, telefone: mascaraTelefone(e.target.value) }))}
                        className="h-9 rounded-[8px] border-[#E2E8F0]"
                        placeholder="(00) 0000-0000"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-[#94A3B8]">Celular</Label>
                      <Input
                        value={mascaraTelefone(formEdicao.celular || '')}
                        onChange={(e) => setFormEdicao((prev) => ({ ...prev, celular: mascaraTelefone(e.target.value) }))}
                        className="h-9 rounded-[8px] border-[#E2E8F0]"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px] text-[#94A3B8]">E-mail</Label>
                    <Input
                      type="email"
                      value={formEdicao.email || ''}
                      onChange={(e) => setFormEdicao((prev) => ({ ...prev, email: e.target.value }))}
                      className="h-9 rounded-[8px] border-[#E2E8F0]"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-[#94A3B8]">Status</Label>
                    <Select
                      value={formEdicao.status || 'Ativo'}
                      onValueChange={(v) => setFormEdicao((prev) => ({ ...prev, status: v as StatusColaborador }))}
                    >
                      <SelectTrigger className="h-9 rounded-[8px] border-[#E2E8F0] bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Inativo">Inativo</SelectItem>
                        <SelectItem value="Afastado">Afastado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setModoEdicao(false)}
                      disabled={salvando}
                      className="rounded-[8px] border-[#E2E8F0] text-[#1F2937]"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={salvarEdicao}
                      disabled={salvando || !formEdicao.nome_completo?.trim()}
                      className="rounded-[8px] bg-[#1F2937] hover:bg-slate-800 text-white"
                    >
                      {salvando ? (
                        <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-1.5" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Card className="bg-white rounded-[12px] shadow-sm border-none">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">Cargo</p>
                        <p className="text-sm font-medium text-[#1F2937] break-words">{colaboradorSelecionado.cargo || '—'}</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white rounded-[12px] shadow-sm border-none">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">Departamento</p>
                        <p className="text-sm font-medium text-[#1F2937] break-words">{colaboradorSelecionado.departamento || '—'}</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white rounded-[12px] shadow-sm border-none">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">Admissão</p>
                        <p className="text-sm font-medium text-[#1F2937]">
                          {colaboradorSelecionado.data_admissao ? formatarData(colaboradorSelecionado.data_admissao) : '—'}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white rounded-[12px] shadow-sm border-none">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">Telefone</p>
                        <p className="text-sm font-medium text-[#1F2937] break-words">{colaboradorSelecionado.telefone || colaboradorSelecionado.celular || '—'}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-white rounded-[12px] shadow-sm border-none">
                    <CardContent className="p-3">
                      <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">E-mail</p>
                      <p className="text-sm font-medium text-[#1F2937] break-all">{colaboradorSelecionado.email || '—'}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white rounded-[12px] shadow-sm border-none">
                    <CardContent className="p-3">
                      <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide">Endereço</p>
                      <p className="text-sm font-medium text-[#1F2937]">
                        {colaboradorSelecionado.endereco
                          ? `${colaboradorSelecionado.endereco}${colaboradorSelecionado.cidade ? `, ${colaboradorSelecionado.cidade}` : ''}${colaboradorSelecionado.estado ? ` - ${colaboradorSelecionado.estado}` : ''}${colaboradorSelecionado.cep ? `, ${colaboradorSelecionado.cep}` : ''}`
                          : '—'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white rounded-[12px] shadow-sm border-none">
                    <CardContent className="p-3">
                      <p className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wide mb-2">Documentos</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] text-[#94A3B8]">CPF</span>
                          <p className="text-sm font-medium text-[#1F2937]">
                            {colaboradorSelecionado.cpf ? formatarCPF(colaboradorSelecionado.cpf) : '—'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#94A3B8]">RG</span>
                          <p className="text-sm font-medium text-[#1F2937]">{colaboradorSelecionado.rg || '—'}</p>
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
