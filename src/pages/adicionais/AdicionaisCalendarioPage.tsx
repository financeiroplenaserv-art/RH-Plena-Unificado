import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Save, AlertTriangle, UserPlus, X, Trash2, ArrowDownAZ, ArrowUpAZ } from 'lucide-react'
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
import { PageHeader } from '@/components/corh/PageHeader'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { useAdicionaisContratuais } from '@/hooks/useAdicionaisContratuais'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useDepartamentos } from '@/hooks/useDepartamentos'
import { DepartamentoAutocomplete } from '@/components/DepartamentoAutocomplete'
import { AdicionaisShell } from './AdicionaisShell'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { adicionalTitular30, contarDiasFeriadoEscalado, contarDiasTransferidos } from '@/lib/adicionais/calculoAdicionais'
import { listarFeriados, type Feriado } from '@/lib/adicionais/feriados'
import type { VinculoAdicional, StatusDiaAdicional, DiaCalendarioAdicional, ContratoAdicional, AdicionalTipo } from '@/types/adicionais'

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
  const { colaboradores, listarResumido: listarColaboradores } = useColaboradores()
  const { departamentos, listar: listarDepartamentos } = useDepartamentos()

  const hoje = new Date()
  const [periodoAno, setPeriodoAno] = useFiltroPersistente('adicionais.calendario.ano', () => hoje.getFullYear())
  const [periodoMes, setPeriodoMes] = useFiltroPersistente('adicionais.calendario.mes', () => hoje.getMonth() + 1)
  const [vinculoFiltro, setVinculoFiltro] = useFiltroPersistente<string>('adicionais.calendario.vinculo', 'todos')
  const [departamentoFiltro, setDepartamentoFiltro] = useFiltroPersistente<string>('adicionais.calendario.departamento', 'todos')
  const [adicionalFiltro, setAdicionalFiltro] = useFiltroPersistente<string>('adicionais.calendario.adicional', 'todos')
  const [busca, setBusca] = useFiltroPersistente('adicionais.calendario.busca', '')
  // Ordenação dos cartões de vínculo (setinha A→Z / Z→A)
  const [ordenacaoCards, setOrdenacaoCards] = useFiltroPersistente<{ campo: 'colaborador' | 'departamento' | 'adicional'; direcao: 'asc' | 'desc' }>('adicionais.calendario.ordenacao', { campo: 'colaborador', direcao: 'asc' })
  const [feriados, setFeriados] = useState<Feriado[]>([])
  const [alteracoes, setAlteracoes] = useState<Record<string, DiaCalendarioAdicional>>({})
  const [modalSubstituto, setModalSubstituto] = useState<{ vinculo: VinculoAdicional; data: string } | null>(null)
  const [buscaSubstituto, setBuscaSubstituto] = useState('')
  const [substitutoSelecionado, setSubstitutoSelecionado] = useState<{ id: string; nome: string } | null>(null)
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set())
  const [statusFiltro, setStatusFiltro] = useFiltroPersistente<(StatusDiaAdicional | 'precisa_substituto')[]>('adicionais.calendario.status', [])
  const [modalStatus, setModalStatus] = useState<{ vinculo: VinculoAdicional; data: string } | null>(null)
  const [confirmarRemocao, setConfirmarRemocao] = useState<{ vinculo: VinculoAdicional; data: string } | null>(null)
  // Substituição em lote: cobre todos os dias pendentes do vínculo no período (ex.: férias)
  const [modalLote, setModalLote] = useState<{ vinculo: VinculoAdicional } | null>(null)
  const [diasLote, setDiasLote] = useState<Set<string>>(new Set())
  const [buscaSubstitutoLote, setBuscaSubstitutoLote] = useState('')
  const [substitutoLoteSelecionado, setSubstitutoLoteSelecionado] = useState<{ id: string; nome: string } | null>(null)
  const [salvandoLote, setSalvandoLote] = useState(false)

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
    listarFeriados().then(setFeriados).catch((err) => console.error('Erro ao carregar feriados:', err))
  }, [listarContratos, listarVinculos, listarColaboradores, listarDepartamentos])

  const datasFeriados = useMemo(() => new Set(feriados.map(f => f.data)), [feriados])

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

  const mapDepartamento = useMemo(() => {
    const m = new Map<string, string>()
    ;(departamentos || []).forEach(d => m.set(d.id, nomeDepartamento(d)))
    return m
  }, [departamentos])

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

  const getSubstituto = useCallback((vinculoId: string, data: string): DiaCalendarioAdicional | null => {
    const alteracao = Object.values(alteracoes).find(
      d => d.vinculo_id === vinculoId && d.data === data && d.substituto_colaborador_id
    )
    if (alteracao) return alteracao
    return calendario.find(d => d.vinculo_id === vinculoId && d.data === data && d.substituto_colaborador_id) || null
  }, [alteracoes, calendario])

  const precisaSubstituto = useCallback((vinculo: VinculoAdicional, data: string) => {
    const dia = getDia(vinculo, data)
    const ausente = ['falta', 'ferias', 'afastado', 'folga_substituicao'].includes(dia.status)
    const chave = `${vinculo.id}|${data}`
    return ausente && !getSubstituto(vinculo.id, data) && !ignorados.has(chave)
  }, [getDia, getSubstituto, ignorados])

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
    if (adicionalFiltro !== 'todos') {
      // Filtra pelos adicionais do próprio vínculo (pode ser subconjunto do
      // contrato); vínculo antigo sem lista cai no flag do contrato.
      lista = lista.filter(v => {
        if (v.adicionais && v.adicionais.length > 0) {
          return v.adicionais.includes(adicionalFiltro as AdicionalTipo)
        }
        const contrato = mapContrato.get(v.contrato_id)
        return contrato?.adicionais?.[adicionalFiltro as keyof typeof contrato.adicionais] === true
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
        statusFiltro.some(f =>
          f === 'precisa_substituto'
            ? diasDoPeriodo.some(data => precisaSubstituto(v, data))
            : diasDoPeriodo.some(data => getDia(v, data).status === f)
        )
      )
    }
    // Ordenação dos cartões (colaborador, departamento ou adicional; A→Z / Z→A)
    const dir = ordenacaoCards.direcao === 'asc' ? 1 : -1
    const nomeColab = (v: VinculoAdicional) => mapColaborador.get(v.colaborador_id)?.nome || v.colaborador_nome || ''
    const chaveOrdenacao = (v: VinculoAdicional): string => {
      if (ordenacaoCards.campo === 'departamento') {
        const contrato = mapContrato.get(v.contrato_id)
        return (contrato?.departamento_id && mapDepartamento.get(contrato.departamento_id)) || ''
      }
      if (ordenacaoCards.campo === 'adicional') {
        // Adicionais do próprio vínculo; vínculo antigo sem lista cai nos flags do contrato
        if (v.adicionais && v.adicionais.length > 0) return [...v.adicionais].sort().join(',')
        const contrato = mapContrato.get(v.contrato_id)
        return contrato?.adicionais
          ? Object.keys(contrato.adicionais).filter(k => contrato.adicionais[k as keyof typeof contrato.adicionais]).sort().join(',')
          : ''
      }
      return nomeColab(v)
    }
    return [...lista].sort((a, b) =>
      chaveOrdenacao(a).localeCompare(chaveOrdenacao(b), 'pt-BR', { sensitivity: 'base' }) * dir
      || nomeColab(a).localeCompare(nomeColab(b), 'pt-BR', { sensitivity: 'base' })
    )
  }, [vinculosAtivosNoPeriodo, vinculoFiltro, departamentoFiltro, adicionalFiltro, busca, mapColaborador, mapContrato, mapDepartamento, statusFiltro, diasDoPeriodo, getDia, precisaSubstituto, ordenacaoCards])

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

  const removerLancamento = async () => {
    if (!confirmarRemocao) return
    const { vinculo, data } = confirmarRemocao
    await excluirDiaCalendario(vinculo.id, data)
    const chave = `${vinculo.id}|${data}`
    setAlteracoes(prev => {
      const atualizado = { ...prev }
      delete atualizado[chave]
      return atualizado
    })
    setConfirmarRemocao(null)
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

  /** Dias do período que ainda precisam de substituto neste vínculo. */
  const diasPendentesVinculo = (vinculo: VinculoAdicional) =>
    diasDoPeriodo.filter(data => precisaSubstituto(vinculo, data))

  const handleAbrirLote = (vinculo: VinculoAdicional) => {
    setDiasLote(new Set(diasPendentesVinculo(vinculo)))
    setBuscaSubstitutoLote('')
    setSubstitutoLoteSelecionado(null)
    setModalLote({ vinculo })
  }

  const toggleDiaLote = (data: string) => {
    setDiasLote(prev => {
      const novo = new Set(prev)
      if (novo.has(data)) novo.delete(data)
      else novo.add(data)
      return novo
    })
  }

  /** Sugestões de substituto no modal em lote (nome ou matrícula). */
  const colaboradoresDisponiveisLote = useMemo(() => {
    const termo = buscaSubstitutoLote.trim().toLowerCase()
    if (!termo) return colaboradores.slice(0, 10)
    return colaboradores.filter(c =>
      c.nome_completo.toLowerCase().includes(termo) ||
      c.matricula.toLowerCase().includes(termo)
    ).slice(0, 10)
  }, [buscaSubstitutoLote, colaboradores])

  const handleConfirmarLote = async () => {
    if (!modalLote || !substitutoLoteSelecionado || diasLote.size === 0) return
    setSalvandoLote(true)
    let ok = 0
    for (const data of [...diasLote].sort()) {
      const resultado = await salvarSubstituicao(
        modalLote.vinculo.id,
        data,
        substitutoLoteSelecionado.id,
        substitutoLoteSelecionado.nome,
        getDia(modalLote.vinculo, data).status,
        true // um toast por dia viraria spam — o resumo vem ao final
      )
      if (resultado) ok++
    }
    setSalvandoLote(false)
    if (ok > 0) {
      toast.success(`${substitutoLoteSelecionado.nome} definido como substituto em ${ok} dia(s)`)
    }
    if (ok < diasLote.size) {
      toast.warning(`${diasLote.size - ok} dia(s) não puderam ser gravados — verifique e tente novamente`)
    }
    await listarCalendario({ dataInicio: periodoInicio, dataFim: periodoFim })
    setModalLote(null)
    setSubstitutoLoteSelecionado(null)
    setBuscaSubstitutoLote('')
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

  /**
   * Resumo de direito aos adicionais do TITULAR do posto no período
   * (regra da gestão, 01/08/2026): insalubridade/periculosidade =
   * 30 − faltas − dias transferidos ao substituto (no 12×36, cada dia de
   * escala coberto transfere também a folga pareada); noturno = dias
   * trabalhados; intrajornada = trabalhados em dias configurados;
   * feriado = feriados com escala prevista. Com o filtro de adicional
   * ativo, mostra só o adicional escolhido.
   */
  const resumoDireito = (v: VinculoAdicional): { key: string; label: string; dias: number }[] => {
    const contrato = mapContrato.get(v.contrato_id)
    if (!contrato) return []
    let faltas = 0
    let trabalhados = 0
    let diasIntrajornada = 0
    const blocoFerias: { data: string; comSubstituto: boolean }[] = []
    diasDoPeriodo.forEach(data => {
      const dia = getDia(v, data)
      if (dia.status === 'trabalhou') {
        trabalhados++
        if (diaIntrajornada(contrato, data)) diasIntrajornada++
      } else if (dia.status === 'falta') {
        faltas++
      }
      if (dia.status === 'ferias' || dia.status === 'afastado') {
        blocoFerias.push({ data, comSubstituto: !!getSubstituto(v.id, data) })
      }
    })
    const transferidos = contarDiasTransferidos(contrato.regime_trabalho, v.data_inicio, blocoFerias)
    const resumo: { key: string; label: string; dias: number }[] = []
    if (contrato.adicionais?.insalubridade) resumo.push({ key: 'insalubridade', label: 'Insalubridade', dias: adicionalTitular30(faltas, transferidos) })
    if (contrato.adicionais?.periculosidade) resumo.push({ key: 'periculosidade', label: 'Periculosidade', dias: adicionalTitular30(faltas, transferidos) })
    if (contrato.adicionais?.noturno) resumo.push({ key: 'noturno', label: 'Noturno', dias: trabalhados })
    if (contrato.adicionais?.intrajornada) resumo.push({ key: 'intrajornada', label: 'Intrajornada', dias: diasIntrajornada })
    if (contrato.adicionais?.feriado) resumo.push({ key: 'feriado', label: 'Feriado', dias: contarDiasFeriadoEscalado(contrato.regime_trabalho, v.data_inicio, diasDoPeriodo, datasFeriados) })
    return adicionalFiltro === 'todos' ? resumo : resumo.filter(r => r.key === adicionalFiltro)
  }

  return (
    <AdicionaisShell>
      <PageHeader backTo="/adicionais/contratos" title="Calendário de Escalas" description="Preencha dia a dia o status dos colaboradores vinculados" />

      <ModuleCard>
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex items-center gap-2">
            <ModuleButton variant="outline" size="sm" onClick={() => {
              if (periodoMes === 1) { setPeriodoMes(12); setPeriodoAno(a => a - 1) }
              else setPeriodoMes(m => m - 1)
            }}>
              <ChevronLeft className="w-4 h-4" />
              Período anterior
            </ModuleButton>
            <div className="text-base font-semibold min-w-[220px] text-center" style={{ color: '#1F2937' }}>
              {periodoLabel}
            </div>
            <ModuleButton variant="outline" size="sm" onClick={() => {
              if (periodoMes === 12) { setPeriodoMes(1); setPeriodoAno(a => a + 1) }
              else setPeriodoMes(m => m + 1)
            }}>
              Próximo período
              <ChevronRight className="w-4 h-4 ml-2" />
            </ModuleButton>
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

          <div className="w-full lg:w-48">
            <Label style={{ color: '#1F2937' }}>Adicional</Label>
            <Select value={adicionalFiltro} onValueChange={setAdicionalFiltro}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="noturno">Noturno</SelectItem>
                <SelectItem value="periculosidade">Periculosidade</SelectItem>
                <SelectItem value="insalubridade">Insalubridade</SelectItem>
                <SelectItem value="intrajornada">Intrajornada</SelectItem>
                <SelectItem value="feriado">Feriado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full lg:w-56">
            <Label style={{ color: '#1F2937' }}>Ordenar por</Label>
            <div className="flex gap-1.5">
              <Select
                value={ordenacaoCards.campo}
                onValueChange={(campo) => setOrdenacaoCards(o => ({ ...o, campo: campo as typeof o.campo }))}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="departamento">Departamento</SelectItem>
                  <SelectItem value="adicional">Adicional</SelectItem>
                </SelectContent>
              </Select>
              <ModuleButton
                variant="outline"
                size="icon"
                onClick={() => setOrdenacaoCards(o => ({ ...o, direcao: o.direcao === 'asc' ? 'desc' : 'asc' }))}
                title={ordenacaoCards.direcao === 'asc' ? 'Ordem A → Z (clique para inverter)' : 'Ordem Z → A (clique para inverter)'}
              >
                {ordenacaoCards.direcao === 'asc' ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />}
              </ModuleButton>
            </div>
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

          <ModuleButton onClick={salvarTodos} disabled={!temAlteracoes || loading} className={temAlteracoes ? 'ring-2 ring-amber-400' : ''}>
            <Save className="w-4 h-4 mr-2" />
            Salvar {temAlteracoes ? `(${Object.keys(alteracoes).length})` : ''}
          </ModuleButton>
        </div>
      </ModuleCard>

      <ModuleCard title="Legenda (clique para filtrar)">
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
          {/* Filtro especial: vínculos com dias pendentes de substituto */}
          {(() => {
            const selecionado = statusFiltro.includes('precisa_substituto')
            return (
              <button
                type="button"
                onClick={() => {
                  setStatusFiltro(prev =>
                    prev.includes('precisa_substituto')
                      ? prev.filter(x => x !== 'precisa_substituto')
                      : [...prev, 'precisa_substituto']
                  )
                }}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs border transition-all hover:opacity-90',
                  selecionado && 'ring-2 ring-offset-1 ring-slate-900'
                )}
                style={{
                  backgroundColor: selecionado ? '#92400E' : '#FEF3C7',
                  borderColor: '#F59E0B',
                  color: selecionado ? '#FFFFFF' : '#92400E',
                }}
              >
                ⚠️ Precisa de substituto
              </button>
            )
          })()}
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
      </ModuleCard>

      {alertasSubstituicao.length > 0 && (
        <ModuleCard title="Substituições pendentes">
          <div className="space-y-2">
            {alertasSubstituicao.map((a, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                Contrato <strong>{a.contrato}</strong> precisa de substituto no dia <strong>{a.data}</strong> ({a.colaborador})
              </div>
            ))}
          </div>
        </ModuleCard>
      )}

      {vinculosFiltrados.length === 0 ? (
        <ModuleCard>
          <p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum vínculo ativo neste mês.</p>
        </ModuleCard>
      ) : (
        <div className="space-y-4">
          {vinculosFiltrados.map(v => {
            const col = mapColaborador.get(v.colaborador_id)
            const contrato = mapContrato.get(v.contrato_id)
            const nomeColaborador = col?.nome || v.colaborador_nome || '—'
            const nomeContrato = contrato?.nome || v.contrato_nome || '—'
            const pendentes = diasPendentesVinculo(v)
            return (
              <ModuleCard key={v.id} title={
                <span className="flex flex-wrap items-center justify-between gap-2 w-full">
                  <span>{nomeColaborador} • {nomeContrato}</span>
                  {pendentes.length > 0 && (
                    <ModuleButton variant="outline" size="sm" onClick={() => handleAbrirLote(v)}>
                      <UserPlus className="w-4 h-4 mr-1.5" />
                      Definir substituto ({pendentes.length} {pendentes.length === 1 ? 'dia' : 'dias'})
                    </ModuleButton>
                  )}
                </span>
              }>
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

                {/* Resumo de direito aos adicionais do titular do posto (regra 01/08/2026) */}
                {(() => {
                  const resumo = resumoDireito(v)
                  if (resumo.length === 0) return null
                  return (
                    <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2" style={{ borderColor: '#F1F5F9' }}>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>Direito no período:</span>
                      {resumo.map(r => (
                        <span
                          key={r.key}
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}
                          title={`${r.label}: ${r.dias} dia(s) de direito neste período`}
                        >
                          {r.label}: <strong>{r.dias} {r.dias === 1 ? 'dia' : 'dias'}</strong>
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </ModuleCard>
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
              <ModuleButton
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setConfirmarRemocao({ vinculo: modalStatus.vinculo, data: modalStatus.data })}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remover lançamento
              </ModuleButton>
            )}
            <ModuleButton variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setModalStatus(null)}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </ModuleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmarRemocao}
        onOpenChange={() => setConfirmarRemocao(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Remover lançamento?"
        description={
          confirmarRemocao
            ? `O lançamento de ${formatarDataBR(confirmarRemocao.data)} será removido permanentemente.`
            : ''
        }
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={removerLancamento}
        destructive
      />

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
              <ModuleButton
                variant="outline"
                size="sm"
                onClick={() => {
                  ignorarSubstituto(modalSubstituto.vinculo, modalSubstituto.data)
                  setModalSubstituto(null)
                }}
              >
                Ignorar
              </ModuleButton>
            )}
            <ModuleButton variant="outline" size="sm" onClick={() => setModalSubstituto(null)}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </ModuleButton>
            <ModuleButton size="sm" onClick={handleConfirmarSubstituto} disabled={!substitutoSelecionado}>
              Confirmar substituição
            </ModuleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Substituição em lote: cobre os dias pendentes do vínculo no período (ex.: férias) */}
      <Dialog open={!!modalLote} onOpenChange={() => setModalLote(null)}>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base" style={{ color: '#1F2937' }}>Definir substituto para o período</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: '#94A3B8' }}>
              {modalLote && (
                <>
                  Escolha os dias e o substituto de <strong>{mapColaborador.get(modalLote.vinculo.colaborador_id)?.nome || modalLote.vinculo.colaborador_nome}</strong>.
                  Ideal para cobrir férias de uma vez, sem lançar dia a dia.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {modalLote && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label style={{ color: '#1F2937' }}>Dias que precisam de substituto ({diasLote.size} selecionado(s))</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {diasPendentesVinculo(modalLote.vinculo).map(data => {
                    const marcado = diasLote.has(data)
                    const statusDia = getDia(modalLote.vinculo, data).status
                    return (
                      <button
                        key={data}
                        type="button"
                        onClick={() => toggleDiaLote(data)}
                        className={cn(
                          'px-2.5 py-1.5 rounded-lg border text-xs transition-colors',
                          marcado ? 'ring-2 ring-slate-900' : 'opacity-50'
                        )}
                        style={{
                          borderColor: STATUS_STYLE[statusDia].border,
                          backgroundColor: marcado ? STATUS_STYLE[statusDia].bg : '#FFFFFF',
                          color: STATUS_STYLE[statusDia].text,
                        }}
                        title={STATUS_OPCOES.find(s => s.value === statusDia)?.label}
                      >
                        {formatarDataBR(data)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label style={{ color: '#1F2937' }}>Substituto</Label>
                <Input
                  placeholder="Buscar por nome ou matrícula..."
                  value={buscaSubstitutoLote}
                  onChange={e => setBuscaSubstitutoLote(e.target.value)}
                  className="rounded-lg"
                />
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {colaboradoresDisponiveisLote.map(c => {
                    const selecionado = substitutoLoteSelecionado?.id === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSubstitutoLoteSelecionado({ id: c.id, nome: c.nome_completo })}
                        className="w-full text-left px-4 py-2.5 rounded-lg border hover:bg-slate-50 transition-colors"
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
                      </button>
                    )
                  })}
                  {colaboradoresDisponiveisLote.length === 0 && (
                    <p className="text-sm text-center py-4" style={{ color: '#94A3B8' }}>Nenhum colaborador encontrado.</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <ModuleButton variant="outline" size="sm" onClick={() => setModalLote(null)} disabled={salvandoLote}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </ModuleButton>
            <ModuleButton size="sm" onClick={handleConfirmarLote} disabled={!substitutoLoteSelecionado || diasLote.size === 0 || salvandoLote}>
              <UserPlus className="w-4 h-4 mr-2" />
              {salvandoLote ? 'Gravando...' : `Confirmar (${diasLote.size} ${diasLote.size === 1 ? 'dia' : 'dias'})`}
            </ModuleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdicionaisShell>
  )
}
