import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Search, Calendar, Copy, AlertTriangle, Pencil, X, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAdicionaisContratuais } from '@/hooks/useAdicionaisContratuais'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useDepartamentos } from '@/hooks/useDepartamentos'
import { useAuth } from '@/hooks/useAuth'
import { AdicionaisPageWrapper, AdicionaisCard, AdicionaisButton } from './AdicionaisPageWrapper'
import { nomeDepartamento } from '@/lib/utils'
import { podeEditarVinculoAdicional } from '@/lib/permissoes'
import type { VinculoAdicional, AdicionalTipo } from '@/types/adicionais'

export function AdicionaisVinculosPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeEditar = perfil ? podeEditarVinculoAdicional(perfil) : false

  const {
    contratos,
    vinculos,
    loading,
    listarContratos,
    listarVinculos,
    criarVinculo,
    atualizarVinculo,
    corrigirVinculosExistentes,
    removerVinculo,
  } = useAdicionaisContratuais()
  const { colaboradores, listar: listarColaboradores } = useColaboradores()
  const { departamentos, listar: listarDepartamentos } = useDepartamentos()

  const [colaboradorId, setColaboradorId] = useState('')
  const [contratoId, setContratoId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [busca, setBusca] = useState('')
  const [departamentoFiltro, setDepartamentoFiltro] = useState<string>('todos')
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null)
  const [modalCopiar, setModalCopiar] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const [editandoVinculo, setEditandoVinculo] = useState<VinculoAdicional | null>(null)
  const [editContratoId, setEditContratoId] = useState('')
  const [editDataInicio, setEditDataInicio] = useState('')
  const [editDataFim, setEditDataFim] = useState('')
  const [editAdicionais, setEditAdicionais] = useState<string[]>([])

  useEffect(() => {
    listarContratos()
    listarVinculos()
    listarColaboradores()
    listarDepartamentos()
  }, [listarContratos, listarVinculos, listarColaboradores, listarDepartamentos])

  // Corrige automaticamente vínculos criados sem nome/matricula/contrato_nome/adicionais
  useEffect(() => {
    if (contratos.length > 0 && colaboradores.length > 0 && vinculos.length > 0) {
      const precisaCorrecao = vinculos.some(
        v => !v.colaborador_nome || !v.colaborador_matricula || !v.contrato_nome || !v.adicionais?.length
      )
      if (precisaCorrecao) {
        corrigirVinculosExistentes(contratos, colaboradores)
      }
    }
  }, [contratos, colaboradores, vinculos, corrigirVinculosExistentes])

  const mapContrato = useMemo(() => {
    const m = new Map<string, string>()
    ;(contratos || []).forEach(c => m.set(c.id, c.nome))
    return m
  }, [contratos])

  const mapColaborador = useMemo(() => {
    const m = new Map<string, { nome: string; matricula: string }>()
    ;(colaboradores || []).forEach(c => m.set(c.id, { nome: c.nome_completo, matricula: c.matricula }))
    return m
  }, [colaboradores])

  const montarVinculoCompleto = useCallback((dados: { contrato_id: string; colaborador_id: string; data_inicio: string; data_fim: string }) => {
    const contrato = contratos.find(c => c.id === dados.contrato_id)
    const colaborador = colaboradores.find(c => c.id === dados.colaborador_id)
    const adicionais = contrato
      ? Object.entries(contrato.adicionais)
          .filter(([, ativo]) => ativo)
          .map(([key]) => key as 'insalubridade' | 'noturno' | 'periculosidade' | 'feriado' | 'intrajornada')
      : []
    return {
      ...dados,
      contrato_nome: contrato?.nome,
      colaborador_nome: colaborador?.nome_completo,
      colaborador_matricula: colaborador?.matricula,
      adicionais,
    }
  }, [contratos, colaboradores])

  const vinculosFiltrados = useMemo(() => {
    if (!Array.isArray(vinculos)) return []
    let lista = vinculos
    if (departamentoFiltro !== 'todos') {
      lista = lista.filter(v => {
        const contrato = contratos.find(c => c.id === v.contrato_id)
        return contrato?.departamento_id === departamentoFiltro
      })
    }
    const termo = busca.trim().toLowerCase()
    if (!termo) return lista
    return lista.filter(v => {
      const col = mapColaborador.get(v.colaborador_id)
      return (
        col?.nome.toLowerCase().includes(termo) ||
        col?.matricula.toLowerCase().includes(termo) ||
        mapContrato.get(v.contrato_id)?.toLowerCase().includes(termo)
      )
    })
  }, [vinculos, busca, mapColaborador, mapContrato, departamentoFiltro, contratos])

  const handleSalvar = async () => {
    if (!colaboradorId || !contratoId || !dataInicio || !dataFim) return
    const dados = montarVinculoCompleto({
      contrato_id: contratoId,
      colaborador_id: colaboradorId,
      data_inicio: dataInicio,
      data_fim: dataFim,
    })
    await criarVinculo(dados)
    setColaboradorId('')
    setContratoId('')
    setDataInicio('')
    setDataFim('')
  }

  const handleCorrigirVinculos = async () => {
    await corrigirVinculosExistentes(contratos, colaboradores)
  }

  const handleExcluir = async (id: string) => {
    await removerVinculo(id)
    setConfirmarExclusao(null)
  }

  const handleAbrirEdicao = (v: VinculoAdicional) => {
    setEditandoVinculo(v)
    setEditContratoId(v.contrato_id)
    setEditDataInicio(v.data_inicio)
    setEditDataFim(v.data_fim)
    setEditAdicionais(v.adicionais || [])
  }

  const handleFecharEdicao = () => {
    setEditandoVinculo(null)
    setEditContratoId('')
    setEditDataInicio('')
    setEditDataFim('')
    setEditAdicionais([])
  }

  const handleSalvarEdicao = async () => {
    if (!editandoVinculo || !editContratoId || !editDataInicio || !editDataFim) return
    const contrato = contratos.find(c => c.id === editContratoId)
    const adicionaisAtivos: AdicionalTipo[] = editAdicionais.filter(a =>
      ['insalubridade', 'noturno', 'periculosidade', 'feriado', 'intrajornada'].includes(a)
    ) as AdicionalTipo[]

    await atualizarVinculo(editandoVinculo.id, {
      contrato_id: editContratoId,
      contrato_nome: contrato?.nome,
      adicionais: adicionaisAtivos,
      data_inicio: editDataInicio,
      data_fim: editDataFim,
    })
    handleFecharEdicao()
  }

  const toggleAdicionalEdicao = (adicional: AdicionalTipo) => {
    setEditAdicionais(prev =>
      prev.includes(adicional)
        ? prev.filter(a => a !== adicional)
        : [...prev, adicional]
    )
  }

  function deslocarMes(dataStr: string, meses: number) {
    const [ano, mes, dia] = dataStr.split('-').map(Number)
    const data = new Date(ano, mes - 1 + meses, 1)
    const ultimoDia = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate()
    data.setDate(Math.min(dia, ultimoDia))
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
  }

  function boundsDoMes(ano: number, mes: number) {
    const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(new Date(ano, mes, 0).getDate()).padStart(2, '0')}`
    return { inicio, fim }
  }

  const handleCopiarPeriodoAnterior = async () => {
    const hoje = new Date()
    const ano = hoje.getFullYear()
    const mes = hoje.getMonth() + 1
    const { inicio: inicioMesAtual, fim: fimMesAtual } = boundsDoMes(ano, mes)

    const vinculosAtuais = vinculos.filter(
      v => v.data_inicio <= fimMesAtual && v.data_fim >= inicioMesAtual
    )

    if (vinculosAtuais.length === 0) {
      setModalCopiar(false)
      return
    }

    setCopiando(true)
    try {
      for (const v of vinculosAtuais) {
        const novaInicio = deslocarMes(v.data_inicio, 1)
        const novaFim = deslocarMes(v.data_fim, 1)
        const jaExiste = vinculos.some(
          existente =>
            existente.colaborador_id === v.colaborador_id &&
            existente.contrato_id === v.contrato_id &&
            existente.data_inicio === novaInicio &&
            existente.data_fim === novaFim
        )
        if (!jaExiste) {
          const dados = montarVinculoCompleto({
            contrato_id: v.contrato_id,
            colaborador_id: v.colaborador_id,
            data_inicio: novaInicio,
            data_fim: novaFim,
          })
          await criarVinculo(dados)
        }
      }
      await listarVinculos()
    } finally {
      setCopiando(false)
      setModalCopiar(false)
    }
  }

  const colaboradoresOptions = useMemo(() => {
    if (!Array.isArray(colaboradores)) return []
    return colaboradores
      .slice()
      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
  }, [colaboradores])

  return (
    <AdicionaisPageWrapper>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#1F2937' }}>Vínculos de colaboradores</h2>
          <p className="text-sm" style={{ color: '#94A3B8' }}>Relacione colaboradores aos contratos e períodos de atuação</p>
        </div>
        {podeEditar && (
          <div className="flex gap-2">
            <AdicionaisButton variant="outline" onClick={handleCorrigirVinculos}>
              Corrigir vínculos
            </AdicionaisButton>
            <AdicionaisButton variant="outline" onClick={() => setModalCopiar(true)}>
              <Copy className="w-4 h-4 mr-2" />
              Copiar do período anterior
            </AdicionaisButton>
          </div>
        )}
      </div>

      {podeEditar && (
      <AdicionaisCard title="Novo vínculo">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Colaborador</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {colaboradoresOptions.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_completo} ({c.matricula})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Contrato</Label>
            <Select value={contratoId} onValueChange={setContratoId}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {contratos.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Início</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Fim</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="rounded-lg" />
          </div>
        </div>
        <AdicionaisButton
          onClick={handleSalvar}
          disabled={!colaboradorId || !contratoId || !dataInicio || !dataFim || loading || colaboradores.length === 0 || contratos.length === 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar vínculo
        </AdicionaisButton>
      </AdicionaisCard>
      )}

      <AdicionaisCard title="Vínculos cadastrados">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label style={{ color: '#1F2937' }}>Departamento</Label>
            <Select value={departamentoFiltro} onValueChange={setDepartamentoFiltro}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {departamentos.map(d => (
                  <SelectItem key={d.id} value={d.id}>{nomeDepartamento(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Label style={{ color: '#1F2937' }}>Buscar</Label>
            <Search className="absolute left-3 top-[calc(50%+10px)] -translate-y-1/2 w-4 h-4" style={{ color: '#94A3B8' }} />
            <Input
              placeholder="Buscar por colaborador, matrícula ou contrato..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-10 rounded-lg"
            />
          </div>
        </div>

        {vinculosFiltrados.length === 0 ? (
          <p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum vínculo cadastrado.</p>
        ) : (
          <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#F1F5F9' }}>
            <Table>
              <TableHeader style={{ backgroundColor: '#F8FAFC' }}>
                <TableRow>
                  <TableHead style={{ color: '#1F2937' }}>Colaborador</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Contrato</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Período</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vinculosFiltrados.map(v => {
                  const col = mapColaborador.get(v.colaborador_id)
                  return (
                    <TableRow key={v.id} className="hover:bg-slate-50">
                      <TableCell style={{ color: '#1F2937' }}>
                        <div className="font-medium">{col?.nome || '—'}</div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>{col?.matricula}</div>
                      </TableCell>
                      <TableCell style={{ color: '#64748B' }}>{mapContrato.get(v.contrato_id) || '—'}</TableCell>
                      <TableCell style={{ color: '#64748B' }}>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {v.data_inicio} até {v.data_fim}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            className="p-1.5 rounded-md hover:bg-slate-100"
                            style={{ color: '#1F2937' }}
                            onClick={() => handleAbrirEdicao(v)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 rounded-md hover:bg-red-50 text-red-600"
                            onClick={() => setConfirmarExclusao(v.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </AdicionaisCard>

      <Dialog open={!!editandoVinculo} onOpenChange={() => handleFecharEdicao()}>
        <DialogContent className="sm:max-w-md rounded-xl bg-white text-slate-900 border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base" style={{ color: '#1F2937' }}>Editar vínculo</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: '#94A3B8' }}>
              {editandoVinculo && (
                <>
                  Colaborador: <strong>{mapColaborador.get(editandoVinculo.colaborador_id)?.nome || editandoVinculo.colaborador_nome || '—'}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Contrato</Label>
              <Select value={editContratoId} onValueChange={setEditContratoId}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {contratos.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Adicionais deste vínculo</Label>
              <div className="flex flex-wrap gap-3">
                {(['insalubridade', 'noturno', 'periculosidade', 'feriado', 'intrajornada'] as AdicionalTipo[]).map(a => (
                  <label key={a} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#1F2937' }}>
                    <input
                      type="checkbox"
                      checked={editAdicionais.includes(a)}
                      onChange={() => toggleAdicionalEdicao(a)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    {a === 'insalubridade' && 'Insalubridade'}
                    {a === 'noturno' && 'Noturno'}
                    {a === 'periculosidade' && 'Periculosidade'}
                    {a === 'feriado' && 'Feriado'}
                    {a === 'intrajornada' && 'Intradiurna'}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label style={{ color: '#1F2937' }}>Início</Label>
                <Input type="date" value={editDataInicio} onChange={e => setEditDataInicio(e.target.value)} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label style={{ color: '#1F2937' }}>Fim</Label>
                <Input type="date" value={editDataFim} onChange={e => setEditDataFim(e.target.value)} className="rounded-lg" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <AdicionaisButton variant="outline" size="sm" onClick={handleFecharEdicao}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </AdicionaisButton>
            {podeEditar && (
              <AdicionaisButton size="sm" onClick={handleSalvarEdicao} disabled={!editContratoId || !editDataInicio || !editDataFim}>
                <Check className="w-4 h-4 mr-2" />
                Salvar
              </AdicionaisButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmarExclusao} onOpenChange={() => setConfirmarExclusao(null)}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base" style={{ color: '#1F2937' }}>Excluir vínculo?</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: '#94A3B8' }}>
              O histórico de calendário deste vínculo também será removido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <AdicionaisButton variant="outline" size="sm" onClick={() => setConfirmarExclusao(null)}>
              Cancelar
            </AdicionaisButton>
            <AdicionaisButton variant="danger" size="sm" onClick={() => confirmarExclusao && handleExcluir(confirmarExclusao)}>
              Excluir
            </AdicionaisButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalCopiar} onOpenChange={() => setModalCopiar(false)}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base" style={{ color: '#1F2937' }}>Copiar do período anterior</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: '#94A3B8' }}>
              Serão criados novos vínculos no mês seguinte aos vínculos ativos do mês atual. Vínculos já existentes no destino serão ignorados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 text-sm p-3 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>A cópia desloca as datas em um mês, ajustando o último dia quando necessário.</p>
          </div>
          <DialogFooter className="gap-2">
            <AdicionaisButton variant="outline" size="sm" onClick={() => setModalCopiar(false)} disabled={copiando}>
              Cancelar
            </AdicionaisButton>
            <AdicionaisButton size="sm" onClick={handleCopiarPeriodoAnterior} disabled={copiando || vinculos.length === 0}>
              {copiando ? 'Copiando...' : 'Confirmar cópia'}
            </AdicionaisButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdicionaisPageWrapper>
  )
}
