import { useEffect, useState } from 'react'
import { Building2, Save, Trash2, Pencil, X } from 'lucide-react'
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
import { useDepartamentos } from '@/hooks/useDepartamentos'
import { DepartamentoAutocomplete } from '@/components/DepartamentoAutocomplete'
import { PageHeader } from '@/components/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { AdicionaisShell } from './AdicionaisShell'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import type { ContratoAdicional, AdicionaisConfig, RegimeTrabalho } from '@/types/adicionais'
import type { Departamento } from '@/types/database'
import { nomeDepartamento } from '@/lib/utils'
import { podeEditarContratoAdicional } from '@/lib/permissoes'

const REGIMES_TRABALHO: { value: RegimeTrabalho; label: string }[] = [
  { value: '12x36', label: '12 × 36 (dia sim, dia não)' },
  { value: '6x1', label: '6 × 1 (6 trabalhados, 1 folga)' },
  { value: '5x2', label: '5 × 2 (seg a sex)' },
  { value: 'personalizado', label: 'Personalizado (preencher dia a dia)' },
]

const ADICIONAIS_OPCOES: { key: keyof AdicionaisConfig; label: string }[] = [
  { key: 'insalubridade', label: 'Insalubridade' },
  { key: 'noturno', label: 'Noturno' },
  { key: 'periculosidade', label: 'Periculosidade' },
  { key: 'feriado', label: 'Feriado' },
  { key: 'intrajornada', label: 'Intradiurna (HE)' },
]

const DIAS_INTRAJORNADA = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
  { value: 7, label: 'Feriado' },
]

function novoContratoVazio(): Omit<ContratoAdicional, 'id' | 'created_at' | 'updated_at' | 'departamento_nome'> {
  return {
    nome: '',
    departamento_id: null,
    quantidade_colaboradores: 0,
    regime_trabalho: '12x36',
    adicionais: {
      insalubridade: false,
      noturno: false,
      periculosidade: false,
      feriado: false,
      intrajornada: false,
    },
    dias_intrajornada: [],
  }
}

export function AdicionaisContratosPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeEditar = perfil ? podeEditarContratoAdicional(perfil) : false

  const { contratos, vinculos, loading, listarContratos, listarVinculos, criarContrato, atualizarContrato, removerContrato } = useAdicionaisContratuais()
  const { departamentos, listar: listarDepartamentos } = useDepartamentos()
  const [form, setForm] = useState(novoContratoVazio())
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null)
  const [modalVinculados, setModalVinculados] = useState<string | null>(null)
  const [departamentoFiltro, setDepartamentoFiltro] = useState<string>('todos')

  useEffect(() => {
    listarContratos()
    listarVinculos()
    listarDepartamentos()
  }, [listarContratos, listarVinculos, listarDepartamentos])

  const mapDept = new Map<string, Departamento>()
  departamentos.forEach(d => mapDept.set(d.id, d))

  const vinculosPorContrato = new Map<string, number>()
  const colaboradoresPorContrato = new Map<string, { id: string; nome: string; matricula: string; periodo: string }[]>()
  vinculos.forEach(v => {
    vinculosPorContrato.set(v.contrato_id, (vinculosPorContrato.get(v.contrato_id) || 0) + 1)
    const lista = colaboradoresPorContrato.get(v.contrato_id) || []
    lista.push({
      id: v.colaborador_id,
      nome: v.colaborador_nome || '—',
      matricula: v.colaborador_matricula || '—',
      periodo: `${v.data_inicio} a ${v.data_fim}`,
    })
    colaboradoresPorContrato.set(v.contrato_id, lista)
  })

  const handleToggleAdicional = (key: keyof AdicionaisConfig) => {
    setForm(prev => {
      const novos = { ...prev.adicionais, [key]: !prev.adicionais[key] }
      return { ...prev, adicionais: novos }
    })
  }

  const handleToggleDia = (dia: number) => {
    setForm(prev => {
      const dias = prev.dias_intrajornada.includes(dia)
        ? prev.dias_intrajornada.filter(d => d !== dia)
        : [...prev.dias_intrajornada, dia].sort((a, b) => a - b)
      return { ...prev, dias_intrajornada: dias }
    })
  }

  const handleSalvar = async () => {
    if (!form.nome.trim()) return
    if (editandoId) {
      await atualizarContrato(editandoId, form)
      setEditandoId(null)
    } else {
      await criarContrato(form)
    }
    setForm(novoContratoVazio())
  }

  const handleEditar = (c: ContratoAdicional) => {
    setEditandoId(c.id)
    setForm({
      nome: c.nome,
      departamento_id: c.departamento_id,
      quantidade_colaboradores: c.quantidade_colaboradores,
      regime_trabalho: c.regime_trabalho,
      adicionais: { ...c.adicionais },
      dias_intrajornada: [...c.dias_intrajornada],
    })
  }

  const handleCancelar = () => {
    setEditandoId(null)
    setForm(novoContratoVazio())
  }

  const handleExcluir = async (id: string) => {
    await removerContrato(id)
    setConfirmarExclusao(null)
  }

  const adicionaisAtivos = (c: ContratoAdicional) =>
    ADICIONAIS_OPCOES.filter(a => c.adicionais[a.key]).map(a => a.label).join(', ') || '—'

  return (
    <AdicionaisShell>
      <PageHeader
        backTo="/"
        title="Adicionais Contratuais"
        description="Cadastre contratos com os adicionais contratuais por departamento"
      />

      {podeEditar && (
      <ModuleCard title={editandoId ? 'Editar contrato' : 'Novo contrato'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Nome do contrato</Label>
            <Input
              placeholder="Ex: Limpeza no Condomínio Solar"
              value={form.nome}
              onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Departamento</Label>
            <Select
              value={form.departamento_id || 'null'}
              onValueChange={v => setForm(prev => ({ ...prev, departamento_id: v === 'null' ? null : v }))}
            >
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Sem departamento</SelectItem>
                {departamentos.map(d => (
                  <SelectItem key={d.id} value={d.id}>{nomeDepartamento(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Quantidade de colaboradores</Label>
            <Input
              type="number"
              min={0}
              placeholder="Ex: 2"
              value={form.quantidade_colaboradores}
              onChange={e => setForm(prev => ({ ...prev, quantidade_colaboradores: Number(e.target.value) }))}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Regime de trabalho</Label>
            <Select
              value={form.regime_trabalho}
              onValueChange={v => setForm(prev => ({ ...prev, regime_trabalho: v as RegimeTrabalho }))}
            >
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {REGIMES_TRABALHO.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <Label style={{ color: '#1F2937' }}>Adicionais contratuais</Label>
          <div className="flex flex-wrap gap-4">
            {ADICIONAIS_OPCOES.map(a => (
              <label key={a.key} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#1F2937' }}>
                <input
                  type="checkbox"
                  checked={form.adicionais[a.key]}
                  onChange={() => handleToggleAdicional(a.key)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                {a.label}
              </label>
            ))}
          </div>
        </div>

        {form.adicionais.intrajornada && (
          <div className="space-y-3 mb-4">
            <Label style={{ color: '#1F2937' }}>Dias de intrajornada</Label>
            <div className="flex flex-wrap gap-3">
              {DIAS_INTRAJORNADA.map(d => (
                <label key={d.value} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#1F2937' }}>
                  <input
                    type="checkbox"
                    checked={form.dias_intrajornada.includes(d.value)}
                    onChange={() => handleToggleDia(d.value)}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <ModuleButton onClick={handleSalvar} disabled={!form.nome.trim() || loading}>
            <Save className="w-4 h-4 mr-2" />
            {editandoId ? 'Atualizar' : 'Salvar'}
          </ModuleButton>
          {editandoId && (
            <ModuleButton variant="outline" onClick={handleCancelar}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </ModuleButton>
          )}
        </div>
      </ModuleCard>
      )}

      <ModuleCard title="Contratos cadastrados">
        <div className="mb-4 w-full md:w-72">
          <Label style={{ color: '#1F2937' }}>Departamento</Label>
          <DepartamentoAutocomplete
            value={departamentoFiltro}
            onChange={setDepartamentoFiltro}
            mode="id"
            placeholder="Buscar departamento..."
          />
        </div>

        {contratos.filter(c => departamentoFiltro === 'todos' || c.departamento_id === departamentoFiltro).length === 0 ? (
          <p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum contrato cadastrado.</p>
        ) : (
          <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#F1F5F9' }}>
            <Table>
              <TableHeader style={{ backgroundColor: '#F8FAFC' }}>
                <TableRow>
                  <TableHead style={{ color: '#1F2937' }}>Departamento</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Contrato</TableHead>
                  <TableHead className="text-center" style={{ color: '#1F2937' }}># de colaboradores</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Adicionais</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Intrajornada</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos
                  .filter(c => departamentoFiltro === 'todos' || c.departamento_id === departamentoFiltro)
                  .map(c => {
                    const vinculados = vinculosPorContrato.get(c.id) || 0
                    const esperados = c.quantidade_colaboradores || 0
                    const incompleto = esperados > 0 && vinculados < esperados
                    return (
                    <TableRow key={c.id} className="hover:bg-slate-50">
                      <TableCell style={{ color: '#64748B' }}>
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {nomeDepartamento(mapDept.get(c.departamento_id || ''))}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium" style={{ color: '#1F2937' }}>{c.nome}</TableCell>
                      <TableCell className="text-center" style={{ color: '#1F2937' }}>
                        <button
                          type="button"
                          onClick={() => setModalVinculados(c.id)}
                          className={vinculados > 0 ? 'hover:underline' : undefined}
                          disabled={vinculados === 0}
                        >
                          <span className={incompleto ? 'text-amber-600 font-semibold' : undefined}>
                            {vinculados}{esperados > 0 ? `/${esperados}` : ''}
                          </span>
                        </button>
                        {incompleto && <span className="ml-2 text-xs text-amber-600">incompleto</span>}
                      </TableCell>
                      <TableCell style={{ color: '#64748B' }}>{adicionaisAtivos(c)}</TableCell>
                      <TableCell style={{ color: '#64748B' }}>
                        {c.adicionais.intrajornada
                          ? c.dias_intrajornada.map(d => DIAS_INTRAJORNADA.find(x => x.value === d)?.label).join(', ')
                          : '—'}
                      </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {podeEditar && (
                          <button
                            className="p-1.5 rounded-md hover:bg-slate-100"
                            style={{ color: '#1F2937' }}
                            onClick={() => handleEditar(c)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {podeEditar && (
                          <button
                            className="p-1.5 rounded-md hover:bg-red-50 text-red-600"
                            onClick={() => setConfirmarExclusao(c.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </div>
        )}
      </ModuleCard>

      <Dialog open={!!modalVinculados} onOpenChange={() => setModalVinculados(null)}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base" style={{ color: '#1F2937' }}>
              Colaboradores vinculados
            </DialogTitle>
            <DialogDescription className="text-xs" style={{ color: '#94A3B8' }}>
              {modalVinculados && contratos.find(c => c.id === modalVinculados)?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(modalVinculados ? colaboradoresPorContrato.get(modalVinculados) || [] : []).map(col => (
              <div key={col.id} className="flex items-center justify-between px-3 py-2 rounded-lg border" style={{ borderColor: '#E2E8F0' }}>
                <div>
                  <div className="font-medium text-sm" style={{ color: '#1F2937' }}>{col.nome}</div>
                  <div className="text-xs" style={{ color: '#94A3B8' }}>Período: {col.periodo}</div>
                </div>
                <div className="text-xs" style={{ color: '#64748B' }}>{col.matricula}</div>
              </div>
            ))}
            {(modalVinculados ? colaboradoresPorContrato.get(modalVinculados) || [] : []).length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: '#94A3B8' }}>Nenhum colaborador vinculado.</p>
            )}
          </div>
          <DialogFooter>
            <ModuleButton variant="outline" size="sm" onClick={() => setModalVinculados(null)}>
              Fechar
            </ModuleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmarExclusao} onOpenChange={() => setConfirmarExclusao(null)}>
        <DialogContent className="sm:max-w-sm bg-white text-slate-900 border border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900">Excluir contrato?</DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Esta ação remove o contrato e não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <ModuleButton variant="outline" size="sm" onClick={() => setConfirmarExclusao(null)}>
              Cancelar
            </ModuleButton>
            <ModuleButton variant="danger" size="sm" onClick={() => confirmarExclusao && handleExcluir(confirmarExclusao)}>
              Excluir
            </ModuleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdicionaisShell>
  )
}
