import { useState, useEffect } from 'react'
import { Search, RefreshCw, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { cn, formatarCPF, formatarData } from '@/lib/utils'
import { BadgeStatus } from '@/components/BadgeStatus'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import type { Colaborador, StatusColaborador } from '@/types/database'

export function ColaboradoresPage() {
  const { colaboradores, loading, listar } = useColaboradores()
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusColaborador | ''>('Ativo')
  const [filtroDepartamento, setFiltroDepartamento] = useState('')
  const [filtroCargo, setFiltroCargo] = useState('')
  const [departamentos, setDepartamentos] = useState<{ nome: string }[]>([])
  const [cargos, setCargos] = useState<{ nome: string }[]>([])
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<Colaborador | null>(null)

  useEffect(() => {
    listar({ status: 'Ativo' })
    async function carregarOpcoes() {
      const [{ data: deptData }, { data: cargosData }] = await Promise.all([
        supabase.from('colaboradores').select('departamento').not('departamento', 'is', null),
        supabase.from('colaboradores').select('cargo').not('cargo', 'is', null),
      ])

      const deptUnicos = Array.from(
        new Set((deptData || []).map((d: { departamento: string }) => d.departamento).filter(Boolean))
      ).sort() as string[]
      setDepartamentos(deptUnicos.map((nome) => ({ nome })))

      const cargosUnicos = Array.from(
        new Set((cargosData || []).map((c: { cargo: string }) => c.cargo).filter(Boolean))
      ).sort() as string[]
      setCargos(cargosUnicos.map((nome) => ({ nome })))
    }
    carregarOpcoes()
  }, [listar])

  const aplicarFiltros = () => {
    listar({
      busca,
      status: (filtroStatus.trim() as StatusColaborador) || undefined,
      departamento: filtroDepartamento.trim() || undefined,
      cargo: filtroCargo.trim() || undefined,
    })
  }

  const iniciais = (nome: string) => {
    const limpo = nome?.trim()
    if (!limpo) return '—'
    const partes = limpo.split(' ').filter(Boolean)
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  }

  return (
    <div className="min-h-full bg-[#F8FAFC] space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1F2937]">Colaboradores</h2>
          <p className="text-sm text-[#94A3B8]">Dados mestres importados do e-Contador</p>
        </div>
        <Button variant="outline" onClick={() => listar()} disabled={loading} className="bg-white border-[#E2E8F0] text-[#1F2937] hover:bg-slate-50 rounded-[8px]">
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
                <SelectItem value="">Todos os departamentos</SelectItem>
                {departamentos.map((d) => (
                  <SelectItem key={d.nome} value={d.nome}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroCargo} onValueChange={setFiltroCargo}>
              <SelectTrigger className="bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937]">
                <SelectValue placeholder="Função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as funções</SelectItem>
                {cargos.map((c) => (
                  <SelectItem key={c.nome} value={c.nome}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as StatusColaborador | '')}>
              <SelectTrigger className="bg-white border-[#E2E8F0] rounded-[8px] text-[#1F2937]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
                <SelectItem value="Afastado">Afastado</SelectItem>
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
            Lista de colaboradores ({colaboradores.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingScreen className="h-64" />
          ) : colaboradores.length === 0 ? (
            <div className="text-center py-12 text-[#94A3B8]">
              <User className="w-10 h-10 mx-auto mb-3 text-[#E2E8F0]" />
              <p>Nenhum colaborador encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {colaboradores.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setColaboradorSelecionado(c)}
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
                    <p className="text-[14px] font-medium text-[#1F2937] leading-tight line-clamp-2">{c.nome_completo}</p>
                    <p className="text-[12px] font-normal text-[#94A3B8] mt-0.5 line-clamp-1">{c.cargo || c.departamento || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!colaboradorSelecionado} onOpenChange={(open) => !open && setColaboradorSelecionado(null)}>
        <DialogContent className="max-w-2xl bg-[#F8FAFC] p-0 border-none">
          {colaboradorSelecionado && (
            <div className="p-5 space-y-4">
              <DialogHeader className="pb-2 border-b border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-semibold text-[#1F2937]">
                    Detalhes
                  </DialogTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setColaboradorSelecionado(null)}
                    className="h-7 w-7 text-[#94A3B8] hover:text-[#1F2937]"
                  >
                    <X className="h-4 w-4" />
                  </Button>
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
                  <p className="text-base font-semibold text-[#1F2937] leading-tight">
                    {colaboradorSelecionado.nome_completo}
                  </p>
                  <div className="flex items-center gap-2">
                    <BadgeStatus status={colaboradorSelecionado.status} />
                    <span className="text-xs text-[#94A3B8]">
                      {colaboradorSelecionado.matricula || '—'}
                    </span>
                  </div>
                </div>
              </div>

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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
