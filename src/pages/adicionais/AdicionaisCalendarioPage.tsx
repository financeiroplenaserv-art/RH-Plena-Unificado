import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Save, AlertTriangle, UserPlus, X, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn, nomeDepartamento } from '@/lib/utils'
import { PageHeader } from '@/components/PageHeader'
import { useAdicionaisContratuais } from '@/hooks/useAdicionaisContratuais'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useDepartamentos } from '@/hooks/useDepartamentos'
import { DepartamentoAutocomplete } from '@/components/DepartamentoAutocomplete'
import { AdicionaisPageWrapper, AdicionaisCard, AdicionaisButton } from './AdicionaisPageWrapper'
import type { VinculoAdicional, StatusDiaAdicional, DiaCalendarioAdicional, ContratoAdicional } from '@/types/adicionais'

const EMOJI_STATUS: Record<StatusDiaAdicional, string> = {
  trabalhou: '✅',
  falta: '❌',
  ferias: '🏖️',
  afastado: '🏥',
  folga: '🏠',
  folga_substituicao: '👥',
}

const STATUS_STYLE: Record<StatusDiaAdicional, { bg: string; border: string; text: string }> = {
  trabalhou: { bg: '#DCFCE7', border: '#22C55E', text: '#166534' },
  falta: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' },
  ferias: { bg: '#FFEDD5', border: '#F97316', text: '#9A3412' },
  afastado: { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3' },
  folga: { bg: '#F8FAFC', border: '#CBD5E1', text: '#64748B' },
  folga_substituicao: { bg: '#DCFCE7', border: '#22C55E', text: '#166534' },
}

const STATUS_OPCOES: { value: StatusDiaAdicional; label: string }[] = [
  { value: 'trabalhou', label: '✅ Trabalhou' },
  { value: 'falta', label: '❌ Falta' },
  { value: 'ferias', label: '🏖️ Férias' },
  { value: 'afastado', label: '🏥 Afastado' },
  { value: 'folga', label: '🏠 FO Folga sem substituição' },
  { value: 'folga_substituicao', label: '👥 FS Folga com substituição' },
]

function normalizarStatus(status: unknown): StatusDiaAdicional {
  if (
    status === 'trabalhou' ||
    status === 'falta' ||
    status === 'ferias' ||
    status === 'afastado' ||
    status === 'folga' ||
    status === 'folga_substituicao'
  ) {
    return status
  }
  return 'trabalhou'
}

/* ============================================================
   CORREÇÃO: Calcula o status do dia pelo padrão 12x36
   (12h trabalho / 36h folga → alternância dia-sim-dia-não)
   ============================================================ */
function calcularStatus12x36(dataInicio: string | undefined, dataAtual: string): 'trabalhou' | 'folga' {
  if (!dataInicio) return 'trabalhou'
  const inicio = new Date(dataInicio + 'T00:00:00')
  const atual  = new Date(dataAtual  + 'T00:00:00')
  const diffMs = atual.getTime() - inicio.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDias % 2 === 0 ? 'trabalhou' : 'folga'
}

function calcularStatus6x1(dataInicio: string | undefined, dataAtual: string): 'trabalhou' | 'folga' {
  if (!dataInicio) return 'trabalhou'
  const inicio = new Date(dataInicio + 'T00:00:00')
  const atual = new Date(dataAtual + 'T00:00:00')
  const diffMs = atual.getTime() - inicio.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDias % 7 < 6 ? 'trabalhou' : 'folga'
}

function calcularStatus5x2(dataAtual: string): 'trabalhou' | 'folga' {
  const dia = new Date(dataAtual + 'T00:00:00').getDay()
  return dia >= 1 && dia <= 5 ? 'trabalhou' : 'folga'
}

function calcularStatusPorRegime(regime: string | undefined, dataInicio: string | undefined, dataAtual: string): 'trabalhou' | 'folga' {
  switch (regime) {
    case '6x1':
      return calcularStatus6x1(dataInicio, dataAtual)
    case '5x2':
      return calcularStatus5x2(dataAtual)
    case 'personalizado':
      return 'trabalhou'
    case '12x36':
    default:
      return calcularStatus12x36(dataInicio, dataAtual)
  }
}

function formatarDataBR(dataStr: string) {
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}

export function AdicionaisCalendarioPage() {
  const {
    contratos,
    vinculos,
    calendario,
    loading,
    listarContratos,
    listarVinculos,
    listarCalendario,
    salvarDiaCalendario,
    salvarSubstituicao,
    excluirDiaCalendario,
    diaIntrajornada,
  } = useAdicionaisContratuais()
  const { colaboradores, listar: listarColaboradores } = useColaboradores()
  const { departamentos, listar: listarDepartamentos } = useDepartamentos()

  const hoje = new Date()
  const [periodoAno, setPeriodoAno] = useState(hoje.getFullYear())
  const [periodoMes, setPeriodoMes] = useState(hoje.getMonth() + 1)
  const [vinculoFiltro, setVinculoFiltro] = useState<string>('todos')
  const [departamentoFiltro, setDepartamentoFiltro] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [alteracoes, setAlteracoes] = useState<Record<string, DiaCalendarioAdicional>>({})
  const [modalSubstituto, setModalSubstituto] = useState<{ vinculo: VinculoAdicional; data: string } | null>(null)
  const [buscaSubstituto, setBuscaSubstituto] = useState('')
  const [substitutoSelecionado, setSubstitutoSelecionado] = useState<{ id: string; nome: string } | null>(null)
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set())
  const [statusFiltro, setStatusFiltro] = useState<StatusDiaAdicional[]>([])
  const [modalStatus, setModalStatus] = useState<{ vinculo: VinculoAdicional; data: string } | null>(null)

  const periodoInicio = useMemo(() => {
    const data = new Date(periodoAno, periodoMes - 1, 20)
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
  }, [periodoAno, periodoMes])

  const periodoFim = useMemo(() => {
    const data = new Date(periodoAno, periodoMes, 19)
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
  }, [periodoAno, periodoMes])

  const periodoLabel = useMemo(() => {
    return `${formatarDataBR(periodoInicio)} a ${formatarDataBR(periodoFim)}`
  }, [periodoInicio, periodoFim])

  useEffect(() => {
    listarContratos()
    listarVinculos()
    listarColaboradores()
    listarDepartamentos()
  }, [listarContratos, listarVinculos, listarColaboradores, listarDepartamentos])

  useEffect(() => {
    listarCalendario({ dataInicio: periodoInicio, dataFim: periodoFim })
    setAlteracoes({})
  }, [periodoInicio, periodoFim, listarCalendario])

  const mapContrato = useMemo(() => {
    const m = new Map<string, ContratoAdicional>()
    ;(contratos || []).forEach(c => m.set(c.id, c))
    return m
  }, [contratos])

  const mapColaborador = useMemo(() => {
    const m = new Map<string, { nome: string; matricula: string }>()
    ;(colaboradores || []).forEach(c => m.set(c.id, { nome: c.nome_completo, matricula: c.matricula }))
    return m
  }, [colaboradores])

  const diasDoPeriodo = useMemo(() => {
    const dias: string[] = []
    const atual = new Date(periodoInicio + 'T00:00:00')
    const fim = new Date(periodoFim + 'T00:00:00')
    while (atual <= fim) {
      dias.push(`${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, '0')}-${String(atual.getDate()).padStart(2, '0')}`)
      atual.setDate(atual.getDate() + 1)
    }
    return dias
  }, [periodoInicio, periodoFim])

  const vinculosAtivosNoPeriodo = useMemo(() => {
    if (!Array.isArray(vinculos)) return []
    return vinculos.filter(v => {
      const inicio = v.data_inicio || '1900-01-01'
      const fim = v.data_fim || '9999-12-31'
      return inicio <= periodoFim && fim >= periodoInicio
    })
  }, [vinculos, periodoInicio, periodoFim])

  const getDia = useCallback((vinculo: VinculoAdicional, data: string): DiaCalendarioAdicional & { __fallback?: boolean } => {
    const chave = `${vinculo.id}|${data}`
    if (alteracoes[chave]) return alteracoes[chave]
    const salvo = calendario.find(d => d.vinculo_id === vinculo.id && d.data === data)
    if (salvo) {
      const status = normalizarStatus(salvo.status)
      return { ...salvo, status, __fallback: status !== salvo.status ? true : undefined }
    }
    const contrato = mapContrato.get(vinculo.contrato_id)
    const statusPadrao = calcularStatusPorRegime(contrato?.regime_trabalho, vinculo.data_inicio, data)
    return {
      vinculo_id: vinculo.id,
      data,
      status: statusPadrao,
      intrajornada: false,
      __fallback: false,
    }
  }, [alteracoes, calendario, mapContrato])

  const vinculosFiltrados = useMemo(() => {
    let lista = vinculosAtivosNoPeriodo
    if (vinculoFiltro !== 'todos') {
      lista = lista.filter(v => v.contrato_id === vinculoFiltro)
    }
    if (departamentoFiltro !== 'todos') {
      lista = lista.filter(v => {
        const contrato = mapContrato.get(v.contrato_id)
        return contrato?.departamento_id === departamentoFiltro
      })
    }
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase()
      lista = lista.filter(v => {
        const col = mapColaborador.get(v.colaborador_id)
        const nome = col?.nome || v.colaborador_nome || ''
        const matricula = col?.matricula || v.colaborador_matricula || ''
        return nome.toLowerCase().includes(termo) || matricula.toLowerCase().includes(termo)
      })
    }
    if (statusFiltro.length > 0) {
      lista = lista.filter(v =>
        diasDoPeriodo.some(data => {
          const dia = getDia(v, data)
          return statusFiltro.includes(dia.status)
        })
      )
    }
    return lista
  }, [vinculosAtivosNoPeriodo, vinculoFiltro, departamentoFiltro, busca, mapColaborador, mapContrato, statusFiltro, diasDoPeriodo, getDia])

  /* ============================================================
     CORREÇÃO: getDia agora recebe o vinculo completo e aplica
     o padrão 12x36 quando não há registro salvo no calendário.
     __fallback: false faz o dia renderizar com emoji e cor.
     ============================================================ */

  const abrirSeletorStatus = (vinculo: VinculoAdicional, data: string) => {
    setModalStatus({ vinculo, data })
  }

  const selecionarStatus = (vinculo: VinculoAdicional, data: string, status: StatusDiaAdicional) => {
    const contrato = mapContrato.get(vinculo.contrato_id)
    const ehIntrajornada = diaIntrajornada(contrato, data)
    const atual = getDia(vinculo, data)
    const chave = `${vinculo.id}|${data}`

    setAlteracoes(prev => ({
      ...prev,
      [chave]: {
        ...atual,
        status,
        intrajornada: ehIntrajornada,
      },
    }))

    setModalStatus(null)
    toast.info(`Status alterado para ${STATUS_OPCOES.find(s => s.value === status)?.label ?? status}. Clique em Salvar para confirmar.`)

    if (status === 'folga_substituicao') {
      handleAbrirModalSubstituto(vinculo, data)
    }
  }

  const removerLancamento = async (vinculo: VinculoAdicional, data: string) => {
    await excluirDiaCalendario(vinculo.id, data)
    const chave = `${vinculo.id}|${data}`
    setAlteracoes(prev => {
      const atualizado = { ...prev }
      delete atualizado[chave]
      return atualizado
    })
    setModalStatus(null)
  }

  const salvarTodos = async () => {
    const valores = Object.values(alteracoes)
    for (const d of valores) {
      const salvo = calendario.find(c => c.vinculo_id === d.vinculo_id && c.data === d.data)
      await salvarDiaCalendario({
        ...salvo,
        ...d,
        substituto_colaborador_id: d.substituto_colaborador_id ?? salvo?.substituto_colaborador_id ?? null,
        substituto_colaborador_nome: d.substituto_colaborador_nome ?? salvo?.substituto_colaborador_nome ?? null,
      })
    }
    setAlteracoes({})
    await listarCalendario({ dataInicio: periodoInicio, dataFim: periodoFim })
  }

  const temAlteracoes = Object.keys(alteracoes).length > 0

  const getSubstituto = (vinculoId: string, data: string): DiaCalendarioAdicional | null => {
    const alteracao = Object.values(alteracoes).find(
      d => d.vinculo_id === vinculoId && d.data === data && d.substituto_colaborador_id
    )
    if (alteracao) return alteracao
    return calendario.find(d => d.vinculo_id === vinculoId && d.data === data && d.substituto_colaborador_id) || null
  }

  const getVinculoSubstituido = (colaboradorId: string, data: string): { nome: string; vinculoId: string } | null => {
    const alteracao = Object.values(alteracoes).find(
      d => d.data === data && d.substituto_colaborador_id === colaboradorId
    )
    if (alteracao) {
      const vinculo = vinculos.find(v => v.id === alteracao.vinculo_id)
      return {
        nome: vinculo?.colaborador_nome || mapColaborador.get(vinculo?.colaborador_id || '')?.nome || '—',
        vinculoId: alteracao.vinculo_id,
      }
    }
    const salvo = calendario.find(d => d.data === data && d.substituto_colaborador_id === colaboradorId)
    if (!salvo) return null
    const vinculo = vinculos.find(v => v.id === salvo.vinculo_id)
    return {
      nome: vinculo?.colaborador_nome || mapColaborador.get(vinculo?.colaborador_id || '')?.nome || '—',
      vinculoId: salvo.vinculo_id,
    }
  }

  const precisaSubstituto = (vinculo: VinculoAdicional, data: string) => {
    const dia = getDia(vinculo, data)
    const ausente = ['falta', 'ferias', 'afastado', 'folga_substituicao'].includes(dia.status)
    const chave = `${vinculo.id}|${data}`
    return ausente && !getSubstituto(vinculo.id, data) && !ignorados.has(chave)
  }

  const ignorarSubstituto = (vinculo: VinculoAdicional, data: string) => {
    setIgnorados(prev => new Set([...prev, `${vinculo.id}|${data}`]))
  }

  const colaboradoresDisponiveis = useMemo(() => {
    const termo = buscaSubstituto.trim().toLowerCase()
    if (!termo) return colaboradores.slice(0, 10)
    return colaboradores.filter(c =>
      c.nome_completo.toLowerCase().includes(termo) ||
      c.matricula.toLowerCase().includes(termo)
    )
  }, [buscaSubstituto, colaboradores])

  const handleConfirmarSubstituto = async () => {
    if (!modalSubstituto || !substitutoSelecionado) return
    const { vinculo, data } = modalSubstituto
    const statusAtual = getDia(vinculo, data).status
    const resultado = await salvarSubstituicao(
      vinculo.id,
      data,
      substitutoSelecionado.id,
      substitutoSelecionado.nome,
      statusAtual
    )
    if (resultado) {
      const chave = `${vinculo.id}|${data}`
      setAlteracoes(prev => ({
        ...prev,
        [chave]: {
          ...getDia(vinculo, data),
          substituto_colaborador_id: substitutoSelecionado.id,
          substituto_colaborador_nome: substitutoSelecionado.nome,
        },
      }))
      await listarCalendario({ dataInicio: periodoInicio, dataFim: periodoFim })
      setBuscaSubstituto('')
      setSubstitutoSelecionado(null)
      setModalSubstituto(null)
    }
  }

  const handleAbrirModalSubstituto = (vinculo: VinculoAdicional, data: string) => {
    setBuscaSubstituto('')
    setSubstitutoSelecionado(null)
    setModalSubstituto({ vinculo, data })
  }

  const alertasSubstituicao: { contrato: string; data: string; colaborador: string }[] = []
  vinculosFiltrados.forEach(v => {
    const contrato = mapContrato.get(v.contrato_id)
    diasDoPeriodo.forEach(data => {
      if (precisaSubstituto(v, data)) {
        alertasSubstituicao.push({
          contrato: contrato?.nome || '—',
          data: formatarDataBR(data),
          colaborador: mapColaborador.get(v.colaborador_id)?.nome || '—',
        })
      }
    })
  })

  return (
    <AdicionaisPageWrapper>
      <PageHeader backTo="/adicionais/contratos" title="Calendário de Escalas" description="Preencha dia a dia o status dos colaboradores vinculados" />

      <AdicionaisCard>
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex items-center gap-2">
            <AdicionaisButton variant="outline" size="sm" onClick={() => {
              if (periodoMes === 1) { setPeriodoMes(12); setPeriodoAno(a => a - 1) }
              else setPeriodoMes(m => m - 1)
            }}>
              <ChevronLeft className="w-4 h-4" />
              Período anterior
            </AdicionaisButton>
            <div className="text-base font-semibold min-w-[220px] text-center" style={{ color: '#1F2937' }}>
              {periodoLabel}
            </div>
            <AdicionaisButton variant="outline" size="sm" onClick={() => {
              if (periodoMes === 12) { setPeriodoMes(1); setPeriodoAno(a => a + 1) }
              else setPeriodoMes(m => m + 1)
            }}>
              Próximo período
              <ChevronRight className="w-4 h-4 ml-2" />
            </AdicionaisButton>
          </div>

          <div className="w-full lg:w-64">
            <Label style={{ color: '#1F2937' }}>Departamento</Label>
            <DepartamentoAutocomplete
              value={departamentoFiltro}
              onChange={setDepartamentoFiltro}
              mode="id"
              placeholder="Buscar departamento..."
            />
          </div>

          <div className="w-full lg:w-64">
            <Label style={{ color: '#1F2937' }}>Contrato</Label>
            <Select value={vinculoFiltro} onValueChange={setVinculoFiltro}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os contratos</SelectItem>
                {contratos.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1">
            <Label style={{ color: '#1F2937' }}>Buscar colaborador</Label>
            <Input
              placeholder="Nome ou matrícula..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="rounded-lg"
            />
          </div>

          <AdicionaisButton onClick={salvarTodos} disabled={!temAlteracoes || loading} className={temAlteracoes ? 'ring-2 ring-amber-400' : ''}>
            <Save className="w-4 h-4 mr-2" />
            Salvar {temAlteracoes ? `(${Object.keys(alteracoes).length})` : ''}
          </AdicionaisButton>
        </div>
      </AdicionaisCard>

      <AdicionaisCard title="Legenda (clique para filtrar)">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPCOES.map(s => {
            const estilo = STATUS_STYLE[s.value]
            const selecionado = statusFiltro.includes(s.value)
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  setStatusFiltro(prev =>
                    prev.includes(s.value)
                      ? prev.filter(x => x !== s.value)
                      : [...prev, s.value]
                  )
                }}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs border transition-all hover:opacity-90',
                  selecionado && 'ring-2 ring-offset-1 ring-slate-900'
                )}
                style={{
                  backgroundColor: selecionado ? estilo.text : estilo.bg,
                  borderColor: estilo.border,
                  color: selecionado ? '#FFFFFF' : estilo.text,
                }}
              >
                {s.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setStatusFiltro([])}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs border transition-all hover:opacity-90',
              statusFiltro.length === 0 && 'opacity-50 cursor-not-allowed'
            )}
            style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', color: '#64748B' }}
            disabled={statusFiltro.length === 0}
          >
            Limpar filtros
          </button>
        </div>
      </AdicionaisCard>

      {alertasSubstituicao.length > 0 && (
        <AdicionaisCard title="Substituições pendentes">
          <div className="space-y-2">
            {alertasSubstituicao.map((a, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                Contrato <strong>{a.contrato}</strong> precisa de substituto no dia <strong>{a.data}</strong> ({a.colaborador})
              </div>
            ))}
          </div>
        </AdicionaisCard>
      )}

      {vinculosFiltrados.length === 0 ? (
        <AdicionaisCard>
          <p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum vínculo ativo neste mês.</p>
        </AdicionaisCard>
      ) : (
        <div className="space-y-4">
          {vinculosFiltrados.map(v => {
            const col = mapColaborador.get(v.colaborador_id)
            const contrato = mapContrato.get(v.contrato_id)
            const nomeColaborador = col?.nome || v.colaborador_nome || '—'
            const nomeContrato = contrato?.nome || v.contrato_nome || '—'
            return (
              <AdicionaisCard key={v.id} title={`${nomeColaborador} • ${nomeContrato}`}>
                <div className="flex flex-wrap gap-2">
                  {diasDoPeriodo.map(data => {
                    const dia = getDia(v, data)
                    const substituto = getSubstituto(v.id, data)
                    const substituido = getVinculoSubstituido(v.colaborador_id, data)
                    const precisa = precisaSubstituto(v, data)
                    const ignorado = ignorados.has(`${v.id}|${data}`)
                    const isFallback = dia.__fallback === true
                    const temAlteracaoPendente = !!alteracoes[`${v.id}|${data}`]
                    const emoji = isFallback ? '' : EMOJI_STATUS[dia.status]
                    const estilo = STATUS_STYLE[dia.status]
                    const tooltip = substituto
                      ? `${formatarDataBR(data)} — Substituído por ${substituto.substituto_colaborador_nome || mapColaborador.get(substituto.substituto_colaborador_id || '')?.nome || '—'}`
                      : substituido
                        ? `${formatarDataBR(data)} — Substituindo ${substituido.nome}`
                        : isFallback
                          ? `${formatarDataBR(data)} — Não preenchido`
                          : precisa
                            ? 'Substituto recomendado'
                            : `${formatarDataBR(data)} — ${STATUS_OPCOES.find(s => s.value === dia.status)?.label ?? dia.status}${temAlteracaoPendente ? ' (alteração pendente)' : ''}`
                    const borderColor = temAlteracaoPendente ? '#F59E0B' : substituto || substituido ? '#22C55E' : precisa || ignorado ? '#F59E0B' : isFallback ? '#E2E8F0' : estilo.border
                    const bgColor = temAlteracaoPendente ? '#FFFBEB' : substituto || substituido ? '#DCFCE7' : isFallback ? '#FFFFFF' : estilo.bg
                    const textColor = isFallback ? '#CBD5E1' : estilo.text
                    // Indica direito a intrajornada (HE) quando trabalha em dia configurado (sab/dom/feriado)
                    const temIntrajornada = dia.status === 'trabalhou' && diaIntrajornada(contrato, data)
                    return (
                      <div key={data} className="relative">
                        <button
                          type="button"
                          onClick={() => abrirSeletorStatus(v, data)}
                          className={cn(
                            'w-10 h-10 rounded-lg border text-xs flex flex-col items-center justify-center transition-colors hover:opacity-90',
                            precisa && 'animate-pulse',
                            isFallback && 'border-dashed'
                          )}
                          style={{
                            backgroundColor: bgColor,
                            borderColor,
                          }}
                          title={tooltip}
                        >
                          <span className="text-[10px] leading-none mb-0.5" style={{ color: textColor }}>{new Date(data + 'T00:00:00').getDate()}</span>
                          <span className="text-base leading-none">{emoji}</span>
                        </button>
                        {/* Badge de substituto confirmado */}
                        {(substituto || substituido) && (
                          <span
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center"
                            title={substituto ? 'Substituto definido' : 'Substituindo outro colaborador'}
                          >
                            <UserPlus className="w-3 h-3" />
                          </span>
                        )}
                        {/* Badge de substituto pendente */}
                        {precisa && (
                          <button
                            type="button"
                            onClick={() => handleAbrirModalSubstituto(v, data)}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600"
                            title="Adicionar substituto"
                          >
                            <UserPlus className="w-3 h-3" />
                          </button>
                        )}
                        {/* Badge de intrajornada (HE) */}
                        {temIntrajornada && (
                          <span
                            className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 rounded-full bg-blue-600 text-white leading-tight"
                            title="Intrajornada (HE)"
                          >
                            HE
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </AdicionaisCard>
            )
          })}
        </div>
      )}

      <Dialog open={!!modalStatus} onOpenChange={() => setModalStatus(null)}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base" style={{ color: '#1F2937' }}>Alterar status do dia</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: '#94A3B8' }}>
              {modalStatus && (
                <>
                  Escolha o status para <strong>{mapColaborador.get(modalStatus.vinculo.colaborador_id)?.nome || modalStatus.vinculo.colaborador_nome}</strong> no dia <strong>{formatarDataBR(modalStatus.data)}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {modalStatus && STATUS_OPCOES.map(s => {
              const dia = getDia(modalStatus.vinculo, modalStatus.data)
              const selecionado = dia.status === s.value
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => selecionarStatus(modalStatus.vinculo, modalStatus.data, s.value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors hover:bg-slate-50',
                    selecionado && 'ring-2 ring-slate-900'
                  )}
                  style={{ borderColor: '#E2E8F0', color: '#1F2937' }}
                >
                  <span>{s.label.split(' ')[0]}</span>
                  <span>{s.label.split(' ').slice(1).join(' ')}</span>
                </button>
              )
            })}
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            {modalStatus && (
              <AdicionaisButton
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => removerLancamento(modalStatus.vinculo, modalStatus.data)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remover lançamento
              </AdicionaisButton>
            )}
            <AdicionaisButton variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setModalStatus(null)}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </AdicionaisButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!modalSubstituto} onOpenChange={() => setModalSubstituto(null)}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base" style={{ color: '#1F2937' }}>Adicionar substituto</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: '#94A3B8' }}>
              {modalSubstituto && (
                <>
                  Selecione um colaborador para trabalhar no dia <strong>{formatarDataBR(modalSubstituto.data)}</strong> no lugar de <strong>{mapColaborador.get(modalSubstituto.vinculo.colaborador_id)?.nome}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Buscar por nome ou matrícula..."
              value={buscaSubstituto}
              onChange={e => setBuscaSubstituto(e.target.value)}
              className="rounded-lg"
            />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {colaboradoresDisponiveis.map(c => {
                const dept = nomeDepartamento(departamentos.find(d => d.id === c.departamento_id))
                const selecionado = substitutoSelecionado?.id === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSubstitutoSelecionado({ id: c.id, nome: c.nome_completo })}
                    className="w-full text-left px-4 py-3 rounded-lg border hover:bg-slate-50 transition-colors"
                    style={{
                      borderColor: selecionado ? '#1F2937' : '#E2E8F0',
                      backgroundColor: selecionado ? '#F8FAFC' : '#FFFFFF',
                      color: '#1F2937',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{c.nome_completo}</span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>{c.matricula}</span>
                    </div>
                    <div className="text-xs" style={{ color: '#94A3B8' }}>Departamento: {dept}</div>
                  </button>
                )
              })}
              {colaboradoresDisponiveis.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: '#94A3B8' }}>Nenhum colaborador encontrado.</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            {modalSubstituto && (
              <AdicionaisButton
                variant="outline"
                size="sm"
                onClick={() => {
                  ignorarSubstituto(modalSubstituto.vinculo, modalSubstituto.data)
                  setModalSubstituto(null)
                }}
              >
                Ignorar
              </AdicionaisButton>
            )}
            <AdicionaisButton variant="outline" size="sm" onClick={() => setModalSubstituto(null)}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </AdicionaisButton>
            <AdicionaisButton size="sm" onClick={handleConfirmarSubstituto} disabled={!substitutoSelecionado}>
              Confirmar substituição
            </AdicionaisButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdicionaisPageWrapper>
  )
}
