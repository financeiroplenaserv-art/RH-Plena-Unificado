import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useExtras } from '@/hooks/useExtras'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useDepartamentos } from '@/hooks/useDepartamentos'
import { AutocompleteColaborador } from '@/components/AutocompleteColaborador'
import { ExtrasPageWrapper, ExtrasCard, ExtrasButton } from './ExtrasPageWrapper'
import { nomeDepartamento, mascaraMoeda, mascaraMoedaInput, parseMoeda, formatarData } from '@/lib/utils'
import type { Colaborador } from '@/types/database'
import type { Extra, TurnoExtra, CategoriaOcorrencia, MotivoExtra, ComunicacaoTipo, StatusExtra } from '@/types/extras'

const TURNOS: TurnoExtra[] = ['Dia', 'Manhã', 'Tarde', 'Noite', 'Noite anterior']
const CATEGORIAS: CategoriaOcorrencia[] = ['Limpeza', 'Portaria', 'Operacional', 'Zelador', 'Jardinagem', 'Medidas disciplinares', 'Outros']
const MOTIVOS: MotivoExtra[] = ['Atestado', 'Falta sem justificativa', 'Folga', 'Férias', 'Extra faturado', 'Reforço estratégico', 'Reforço faturado', 'Limpeza interna', 'Cobertura férias extra faturadas', 'Outros']
const COMUNICACOES: ComunicacaoTipo[] = ['WhatsApp', 'Email', 'Não se aplica']
const STATUS: StatusExtra[] = ['Pendente', 'Pago', 'Cancelado']

const extraVazio = (): Omit<Extra, 'id' | 'created_at' | 'updated_at'> => ({
  data_ocorrencia: new Date().toISOString().split('T')[0],
  turno: 'Dia',
  categoria: '' as CategoriaOcorrencia,
  posto: '',
  departamento_id: null,
  departamento_nome: null,
  colaborador_ausente_id: null,
  colaborador_ausente_nome: null,
  substituto_id: null,
  substituto_nome: null,
  motivo: '' as MotivoExtra,
  extra_faturado: false,
  valor: 0,
  categoria_valor_id: null,
  categoria_valor_nome: null,
  comunicacao_tipo: 'Não se aplica',
  comunicacao_data: null,
  comunicacao_hora: null,
  comunicacao_detalhes: null,
  observacoes: null,
  status: 'Pendente',
  usuario_id: null,
  empresa_id: null,
})

export function ExtrasFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { categorias, loading, listar, listarCategorias, buscarPorId, criar, atualizar, verificarDuplicado } = useExtras()
  const { listar: listarColaboradores } = useColaboradores()
  const { departamentos, listar: listarDepartamentos } = useDepartamentos()

  const departamentosUnicos = useMemo(() => {
    const vistos = new Set<string>()
    return departamentos
      .filter(d => d.status === 'Ativo' && d.nome_curto && d.nome_curto.trim() !== '')
      .sort((a, b) => a.nome_curto.localeCompare(b.nome_curto))
      .filter(d => {
        const chave = d.nome_curto.toLowerCase().trim()
        if (vistos.has(chave)) return false
        vistos.add(chave)
        return true
      })
  }, [departamentos])

  const [form, setForm] = useState<Omit<Extra, 'id' | 'created_at' | 'updated_at'>>(extraVazio())
  const [ausenteNaoAplica, setAusenteNaoAplica] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [valorInput, setValorInput] = useState(mascaraMoedaInput(String(form.valor)))

  useEffect(() => {
    listar()
    listarCategorias()
    listarColaboradores()
    listarDepartamentos()
  }, [listar, listarCategorias, listarColaboradores, listarDepartamentos])

  useEffect(() => {
    setValorInput(mascaraMoeda(form.valor))
  }, [form.valor])

  useEffect(() => {
    if (id) {
      const carregar = async () => {
        const extra = await buscarPorId(id)
        if (extra) {
          setForm({
            data_ocorrencia: extra.data_ocorrencia,
            turno: extra.turno,
            categoria: extra.categoria,
            posto: extra.posto,
            departamento_id: extra.departamento_id,
            departamento_nome: extra.departamento_nome,
            colaborador_ausente_id: extra.colaborador_ausente_id,
            colaborador_ausente_nome: extra.colaborador_ausente_nome,
            substituto_id: extra.substituto_id,
            substituto_nome: extra.substituto_nome,
            motivo: extra.motivo,
            extra_faturado: extra.extra_faturado,
            valor: extra.valor,
            categoria_valor_id: extra.categoria_valor_id,
            categoria_valor_nome: extra.categoria_valor_nome,
            comunicacao_tipo: extra.comunicacao_tipo,
            comunicacao_data: extra.comunicacao_data,
            comunicacao_hora: extra.comunicacao_hora,
            comunicacao_detalhes: extra.comunicacao_detalhes,
            observacoes: extra.observacoes,
            status: extra.status,
            usuario_id: extra.usuario_id,
            empresa_id: extra.empresa_id,
          })
          setAusenteNaoAplica(!extra.colaborador_ausente_id)
        }
      }
      carregar()
    }
  }, [id, buscarPorId])

  const setField = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleCategoriaValorChange = (categoriaId: string) => {
    const cat = categorias.find(c => c.id === categoriaId)
    setForm(prev => ({
      ...prev,
      categoria_valor_id: categoriaId,
      categoria_valor_nome: cat?.nome || null,
      valor: cat?.valor_padrao ?? prev.valor,
    }))
  }

  const handleAusenteChange = (colaborador: Colaborador | null) => {
    setForm(prev => ({
      ...prev,
      colaborador_ausente_id: colaborador?.id ? colaborador.id : null,
      colaborador_ausente_nome: colaborador?.nome_completo || null,
    }))
    setAusenteNaoAplica(!colaborador)
  }

  const handleSubstitutoChange = (colaborador: Colaborador | null) => {
    setForm(prev => ({
      ...prev,
      substituto_id: colaborador?.id || null,
      substituto_nome: colaborador?.nome_completo || null,
    }))
  }

  const handleToggleAusenteNaoAplica = (checked: boolean) => {
    setAusenteNaoAplica(checked)
    if (checked) {
      setForm(prev => ({
        ...prev,
        colaborador_ausente_id: null,
        colaborador_ausente_nome: null,
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.categoria) {
      toast.error('Selecione a categoria')
      return
    }
    if (!form.motivo) {
      toast.error('Selecione o motivo')
      return
    }
    setSalvando(true)
    const payload = { ...form }
    if (ausenteNaoAplica) {
      payload.colaborador_ausente_id = null
      payload.colaborador_ausente_nome = null
    }

    if (!id) {
      const duplicado = await verificarDuplicado(
        payload.data_ocorrencia,
        payload.departamento_id,
        payload.colaborador_ausente_id,
        payload.colaborador_ausente_nome
      )
      if (duplicado) {
        setSalvando(false)
        toast.error(
          `Já existe um extra lançado para ${payload.colaborador_ausente_nome || 'este colaborador'} no departamento ${payload.departamento_nome || ''} em ${formatarData(payload.data_ocorrencia)}. Verifique os lançamentos.`,
          { duration: 6000 }
        )
        return
      }
    }

    const sucesso = id
      ? await atualizar(id, payload)
      : await criar(payload)
    setSalvando(false)
    if (sucesso) navigate('/extras/lancamentos')
  }

  return (
    <ExtrasPageWrapper>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: '#1F2937' }}>{id ? 'Editar extra' : 'Novo extra'}</h2>
        <p className="text-sm" style={{ color: '#94A3B8' }}>Registre a ocorrência, substituição e valores</p>
      </div>

      <form onSubmit={handleSubmit}>
        <ExtrasCard>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Data da ocorrência</Label>
              <Input
                type="date"
                value={form.data_ocorrencia}
                onChange={e => setField('data_ocorrencia', e.target.value)}
                className="rounded-lg"
                required
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Turno</Label>
              <Select value={form.turno} onValueChange={v => setField('turno', v as TurnoExtra)}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TURNOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Categoria</Label>
              <Select value={form.categoria || 'null'} onValueChange={v => setField('categoria', v === 'null' ? '' as CategoriaOcorrencia : v as CategoriaOcorrencia)}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Selecione...</SelectItem>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Departamento</Label>
              <Select
                value={form.departamento_id || 'null'}
                onValueChange={v => {
                  const dept = departamentosUnicos.find(d => d.id === v)
                  setForm(prev => ({
                    ...prev,
                    departamento_id: v === 'null' ? null : v,
                    departamento_nome: dept ? nomeDepartamento(dept) : null,
                    posto: dept ? (dept.nome_curto || dept.nome) : '',
                    colaborador_ausente_id: null,
                    colaborador_ausente_nome: null,
                    substituto_id: null,
                    substituto_nome: null,
                  }))
                  setAusenteNaoAplica(false)
                }}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Selecione...</SelectItem>
                  {departamentosUnicos.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.nome_curto || d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label style={{ color: '#1F2937' }}>Colaborador ausente</Label>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#64748B' }}>
                  <input
                    type="checkbox"
                    checked={ausenteNaoAplica}
                    onChange={e => handleToggleAusenteNaoAplica(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Não se aplica
                </label>
              </div>
              {!ausenteNaoAplica ? (
                <AutocompleteColaborador
                  value={form.colaborador_ausente_id || undefined}
                  onChange={handleAusenteChange}
                  placeholder="Buscar colaborador ausente..."
                  departamentoId={form.departamento_id}
                  permitirNovo
                />
              ) : (
                <div className="p-3 rounded-lg border border-dashed text-sm" style={{ borderColor: '#E2E8F0', color: '#94A3B8' }}>
                  Não se aplica
                </div>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label style={{ color: '#1F2937' }}>Substituto</Label>
              <AutocompleteColaborador
                value={form.substituto_id || undefined}
                onChange={handleSubstitutoChange}
                placeholder="Buscar substituto..."
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Motivo</Label>
              <Select value={form.motivo || 'null'} onValueChange={v => setField('motivo', v === 'null' ? '' as MotivoExtra : v as MotivoExtra)}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Selecione...</SelectItem>
                  {MOTIVOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Categoria de valor</Label>
              <Select
                value={form.categoria_valor_id || 'acordado'}
                onValueChange={handleCategoriaValorChange}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acordado">Valor acordado</SelectItem>
                  {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Valor (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={valorInput}
                onChange={e => {
                  const formatado = mascaraMoedaInput(e.target.value)
                  setValorInput(formatado)
                  setField('valor', parseMoeda(formatado))
                }}
                onBlur={() => setValorInput(mascaraMoedaInput(valorInput))}
                placeholder="R$ 0,00"
                className="rounded-lg"
                required
              />
            </div>

            <div className="flex items-center gap-2 md:col-span-3">
              <input
                type="checkbox"
                id="extra_faturado"
                checked={form.extra_faturado}
                onChange={e => setField('extra_faturado', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <Label htmlFor="extra_faturado" style={{ color: '#1F2937' }}>Extra faturado</Label>
            </div>
          </div>
        </ExtrasCard>

        <ExtrasCard className="mt-4">
          <h3 className="text-base font-semibold mb-4" style={{ color: '#1F2937' }}>Comunicação com o cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Meio de comunicação</Label>
              <Select value={form.comunicacao_tipo || 'Não se aplica'} onValueChange={v => setField('comunicacao_tipo', v as ComunicacaoTipo)}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMUNICACOES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Data da comunicação</Label>
              <Input
                type="date"
                value={form.comunicacao_data || ''}
                onChange={e => setField('comunicacao_data', e.target.value || null)}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Hora da comunicação</Label>
              <Input
                type="time"
                value={form.comunicacao_hora || ''}
                onChange={e => setField('comunicacao_hora', e.target.value || null)}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2 md:col-span-3">
              <Label style={{ color: '#1F2937' }}>Detalhes</Label>
              <Input
                value={form.comunicacao_detalhes || ''}
                onChange={e => setField('comunicacao_detalhes', e.target.value || null)}
                placeholder="Ex: Whats 7:15, email 17/06, previamente agendado..."
                className="rounded-lg"
              />
            </div>
          </div>
        </ExtrasCard>

        <ExtrasCard className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Status</Label>
              <Select value={form.status} onValueChange={v => setField('status', v as StatusExtra)}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label style={{ color: '#1F2937' }}>Observações</Label>
              <Input
                value={form.observacoes || ''}
                onChange={e => setField('observacoes', e.target.value || null)}
                placeholder="Informações adicionais"
                className="rounded-lg"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <ExtrasButton type="submit" disabled={salvando || loading}>
              <Save className="w-4 h-4 mr-2" />
              {id ? 'Atualizar' : 'Salvar'}
            </ExtrasButton>
            <ExtrasButton type="button" variant="outline" onClick={() => navigate('/extras/lancamentos')}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </ExtrasButton>
          </div>
        </ExtrasCard>
      </form>
    </ExtrasPageWrapper>
  )
}
