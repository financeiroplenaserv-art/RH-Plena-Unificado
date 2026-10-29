import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, FileSpreadsheet, FileUp, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { DepartamentoAutocomplete } from '@/components/DepartamentoAutocomplete'
import { formatarData, formatarDataHora } from '@/lib/utils'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { destinoFerias, prontaParaGravar, rotuloCompetencia, situacaoGravacaoCarga, type FeriasBloco } from '@/lib/vt/carga'
import { ROTULO_GRUPO_FERISTA, sobreposicoesDeCobertura } from '@/lib/vt/feristas'
import { formatarCentavos } from '@/lib/vt/bilhetes'
import { useVtCarga, type ResultadoCargaColaborador } from '@/hooks/useVtCarga'
import { useVtCoberturas } from '@/hooks/useVtCoberturas'
import { InstrucoesCarga } from '@/pages/vt/InstrucoesArquivosVt'
import type { VtColaborador, VtDepartamento } from '@/hooks/useVt'
import type { TipoCoberturaVT, VtBilhete, VtCobertura, VtTrajeto } from '@/types/vt'

// Aba Carga do VT (decisão da gestora, 21/10/2026 — plano §6): a fonte oficial
// é o relatório "Gestão de escalas" do Flit (Excel com o mês seguinte). A carga
// é dirigida pelas férias do mês (blocos [FR] do relatório): cada uma precisa
// de destino (quem cobre / sem cobertura) antes de gravar — portão. O titular
// de férias não entra (o [FR] nunca é dia trabalhado).

function situacaoDa(r: ResultadoCargaColaborador) {
  if (r.semEscala) return [<StatusBadge key="se" variant="warning">Fora do relatório</StatusBadge>]
  const badges = []
  if (r.semDiaDeTrabalho) {
    badges.push(
      <StatusBadge key="st" variant="neutral">
        Mês sem dia de trabalho — R$ 0,00
      </StatusBadge>
    )
  }
  if (r.pendentes.length > 0) {
    badges.push(
      <StatusBadge key="pt" variant="warning">
        Falta confirmar trajeto: {r.pendentes.map((p) => p.rotulo).join(', ')}
      </StatusBadge>
    )
  }
  if (r.diasSemPostoIdentificado > 0) {
    badges.push(
      <span key="si" title={r.locaisNaoIdentificados.join('; ')}>
        <StatusBadge variant="warning">
          {r.diasSemPostoIdentificado} dias sem posto identificado
        </StatusBadge>
      </span>
    )
  }
  if (badges.length === 0) badges.push(<StatusBadge key="ok" variant="success">Pronto</StatusBadge>)
  return badges
}

/** Sufixo da linha de posto quando há dias de cobertura de férias. */
function sufixoCobertura(diasCobertura: number | undefined, dias: number): string {
  if (!diasCobertura) return ''
  return diasCobertura === dias ? ' (cobertura de férias)' : ` (${diasCobertura} em cobertura)`
}

/** Sufixo da linha de posto quando há dias de treinamento (migration 160). */
function sufixoTreinamento(diasTreinamento: number | undefined, dias: number): string {
  if (!diasTreinamento) return ''
  return diasTreinamento === dias ? ' (treinamento)' : ` (${diasTreinamento} em treinamento)`
}

/** Sufixo da linha de posto quando o trajeto tem valor extra manual (migration 166). */
function sufixoExtra(extraCentavos: number | undefined): string {
  if (!extraCentavos) return ''
  return ` (inclui ${formatarCentavos(extraCentavos)}/dia extra)`
}

/** 'AAAA-MM-DD' menos n dias, como string local (Date.UTC: sem bug de fuso). */
function diasAntes(data: string, n: number): string {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d - n)).toISOString().slice(0, 10)
}

interface VtCargaTabProps {
  colaboradores: VtColaborador[]
  departamentos: VtDepartamento[]
  trajetos: VtTrajeto[]
  bilhetes: VtBilhete[]
  dadosProntos: boolean
  usuarioId: string
  podeGerenciar: boolean
  /** Carteira ferias_feristas + cobertura em andamento (fonte do selo "Ferista"). */
  ehFerista: (colaboradorId: string) => boolean
  /** 0 carteira → 1 cobrindo → 2 últimos utilizados → 3 demais (ordena o seletor). */
  prioridadeFerista: (colaboradorId: string) => 0 | 1 | 2 | 3
  /** Adiciona o colaborador à carteira em 1 clique (função resolvida do cargo). */
  adicionarFeristaCarteira: (colaborador: { id: string; cargo: string | null }) => Promise<boolean>
  /** Recarrega a classificação de feristas (chamado após gravar/excluir cobertura). */
  recarregarFeristas: () => Promise<void>
}

export function VtCargaTab({
  colaboradores,
  departamentos,
  trajetos,
  bilhetes,
  dadosProntos,
  usuarioId,
  podeGerenciar,
  ehFerista,
  prioridadeFerista,
  adicionarFeristaCarteira,
  recarregarFeristas,
}: VtCargaTabProps) {
  const {
    resultados,
    ferias,
    competencia,
    nomeArquivo,
    coberturaGeral,
    nomesSemMatch,
    coberturaMes,
    gravacao,
    loading,
    importarRelatorio,
    restaurarRascunho,
    reprocessar,
    gravarCargas,
    exportarExcel,
  } = useVtCarga()
  const { coberturas, listar: listarCoberturas, registrar, registrarComTreinamento, remover } = useVtCoberturas()

  const inputArquivoRef = useRef<HTMLInputElement>(null)
  const [gravando, setGravando] = useState(false)

  // Dialog de cobertura (avulsa ou vinculada a férias do relatório)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [tipoRegistro, setTipoRegistro] = useState<TipoCoberturaVT>('ferias')
  const [feristaId, setFeristaId] = useState('')
  const [postoId, setPostoId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [observacao, setObservacao] = useState('')
  const [feriasVinculoId, setFeriasVinculoId] = useState<string | null>(null)
  // Treinamento do ferista antes de cobrir (migration 160 — só no dialog de férias)
  const [comTreinamento, setComTreinamento] = useState(false)
  const [treinInicio, setTreinInicio] = useState('')
  const [treinFim, setTreinFim] = useState('')
  const [salvandoCobertura, setSalvandoCobertura] = useState(false)
  const [excluindo, setExcluindo] = useState<VtCobertura | null>(null)
  const [semCoberturaDe, setSemCoberturaDe] = useState<FeriasBloco | null>(null)

  useEffect(() => {
    listarCoberturas()
  }, [listarCoberturas])

  // Ao voltar à aba sem nada carregado, restaura o rascunho do relatório
  // salvo no aparelho (27/10/2026 — sair da tela apagava o cálculo importado).
  const restaurouRef = useRef(false)
  useEffect(() => {
    if (restaurouRef.current || competencia || !dadosProntos) return
    restaurouRef.current = true
    void restaurarRascunho({ colaboradores, departamentos, trajetos, bilhetes })
  }, [competencia, dadosProntos, restaurarRascunho, colaboradores, departamentos, trajetos, bilhetes])

  /**
   * Seletor de ferista: QUALQUER ativo (a carga só paga optantes, mas o
   * destino das férias é planejamento da operação — o portão exige destino
   * inclusive para titular não optante; caso Francisco/Reginaldo, 23/10/2026).
   * Grupos: carteira → cobrindo → últimos utilizados → demais.
   */
  const gruposSeletor = useMemo(() => {
    const grupos: VtColaborador[][] = [[], [], [], []]
    for (const c of colaboradores) grupos[prioridadeFerista(c.id)].push(c)
    return grupos
  }, [colaboradores, prioridadeFerista])
  const feristaSelecionado = useMemo(
    () => colaboradores.find((c) => c.id === feristaId) ?? null,
    [colaboradores, feristaId]
  )
  const nomeDo = useCallback(
    (colaboradorId: string | null | undefined) =>
      colaboradores.find((c) => c.id === colaboradorId)?.nome_completo ?? '—',
    [colaboradores]
  )
  const postoDoTitular = useCallback(
    (f: FeriasBloco): string => {
      const colab = colaboradores.find((c) => c.id === f.colaborador_id)
      return f.departamento_id ?? colab?.departamento_id ?? ''
    },
    [colaboradores]
  )

  /**
   * Recalcula a partir das pessoas guardadas no hook (auditoria C2) — sem o
   * File: após restaurar o rascunho ou trocar de aba não há mais arquivo, e o
   * recalcular antigo virava no-op silencioso (o portão destravava e os
   * valores VELHOS da tabela eram gravados assim).
   */
  const recalcular = useCallback(async () => {
    if (dadosProntos) {
      await reprocessar({ colaboradores, departamentos, trajetos, bilhetes })
    }
  }, [reprocessar, dadosProntos, colaboradores, departamentos, trajetos, bilhetes])

  const aoEscolherArquivo = async (arquivo: File | null) => {
    if (!arquivo) return
    await importarRelatorio(arquivo, { colaboradores, departamentos, trajetos, bilhetes })
  }

  /** Destino de cada bloco de férias do relatório (portão da gravação). */
  const destinos = useMemo(
    () => ferias.map((f) => ({ ferias: f, destino: destinoFerias(f, coberturas) })),
    [ferias, coberturas]
  )
  const feriasPendentes = destinos.filter((d) => d.destino.tipo === 'pendente').length

  const coberturasAvulsas = useMemo(() => {
    if (!competencia) return []
    const inicio = `${competencia}-01`
    const fim = inicio.slice(0, 8) + '31' // comparação de strings: basta cobrir o mês
    return coberturas.filter(
      (c) => !c.ferias_colaborador_id && c.data_inicio <= fim && c.data_fim >= inicio
    )
  }, [coberturas, competencia])

  // Ferista cobrindo 2+ postos ao mesmo tempo (decisão da gestora, 27/10/2026;
  // caso Everaldo): os registros são mantidos — a carga usa a cobertura mais
  // recente —, mas o aviso fica visível na seção "Férias no mês". Só aviso.
  const sobreposicoes = useMemo(() => {
    if (!competencia) return []
    const inicio = `${competencia}-01`
    const fim = inicio.slice(0, 8) + '31'
    const doMes = coberturas.filter((c) => c.data_inicio <= fim && c.data_fim >= inicio)
    return sobreposicoesDeCobertura(doMes)
  }, [coberturas, competencia])

  /** Treinamentos vinculados a férias (migration 160), por titular — exibidos no Destino. */
  const treinamentosDoTitular = useCallback(
    (f: FeriasBloco) =>
      coberturas.filter(
        (c) =>
          (c.tipo ?? 'ferias') === 'treinamento' &&
          c.ferias_colaborador_id === f.colaborador_id &&
          c.data_inicio <= f.data_fim &&
          c.data_fim >= diasAntes(f.data_inicio, 31)
      ),
    [coberturas]
  )

  const totais = useMemo(
    () => ({
      optantes: resultados.length,
      prontos: resultados.filter(prontaParaGravar).length,
      soma: resultados.reduce((acc, r) => acc + r.valor_centavos, 0),
    }),
    [resultados]
  )

  /** Completude de TODOS do relatório (decisão da gestora, 23/10/2026) — visão de conferência, não bloqueia. */
  const resumoGeral = useMemo(() => {
    const naoOptantes = coberturaGeral.filter((p) => !p.optante)
    return {
      total: coberturaGeral.length,
      naoOptantes,
      escalados: naoOptantes.filter((p) => p.situacao === 'escalado'),
      soAusencias: naoOptantes.filter((p) => p.situacao === 'so_ausencias'),
      diasSemPosto: naoOptantes.filter((p) => p.situacao === 'dias_sem_posto'),
      semRegistro: naoOptantes.filter((p) => p.situacao === 'sem_registro'),
    }
  }, [coberturaGeral])
  const [mostrarTodosGeral, setMostrarTodosGeral] = useState(false)

  // Portão (decisão de 21/10/2026): férias sem destino ou qualquer pendência
  // de cálculo bloqueiam a gravação; calcular/mostrar segue liberado.
  const pendenciasPortao = useMemo(() => {
    const lista: string[] = []
    if (feriasPendentes > 0) lista.push(`${feriasPendentes} férias do mês sem destino — defina quem cobre ou marque sem cobertura`)
    const semTrajeto = resultados.filter((r) => r.pendentes.length > 0).length
    if (semTrajeto > 0) lista.push(`${semTrajeto} optante(s) com trajeto a confirmar`)
    const semPosto = resultados.filter((r) => r.diasSemPostoIdentificado > 0).length
    if (semPosto > 0) lista.push(`${semPosto} optante(s) com dias sem posto identificado`)
    const semEscala = resultados.filter((r) => r.semEscala).length
    if (semEscala > 0) lista.push(`${semEscala} optante(s) fora do relatório — confira se o relatório está completo`)
    return lista
  }, [feriasPendentes, resultados])
  const bloqueado = pendenciasPortao.length > 0

  /** Prontos com o MESMO filtro do gravarCargas (helper único `prontaParaGravar`). */
  const prontosParaGravar = useMemo(() => resultados.filter(prontaParaGravar), [resultados])
  // O banner só vale para a competência que a verificação leu — evita corrida
  // entre verificações de competências diferentes (auditoria M1/M2).
  const situacaoGravacao =
    resultados.length > 0 && gravacao && gravacao.competencia === competencia
      ? situacaoGravacaoCarga(
          gravacao.ids,
          prontosParaGravar.map((r) => r.colaborador_id)
        )
      : null

  // Aviso do navegador ao fechar/recarregar com carga calculada e não gravada.
  useEffect(() => {
    if (!situacaoGravacao || situacaoGravacao === 'gravada') return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [situacaoGravacao])

  const gravar = async () => {
    if (!competencia) return
    setGravando(true)
    const { gravadas, puladas } = await gravarCargas(competencia, resultados, usuarioId)
    setGravando(false)
    if (gravadas > 0) toast.success(`${gravadas} carga(s) gravada(s) para ${rotuloCompetencia(competencia)}`)
    if (puladas > 0) toast.info(`${puladas} optante(s) pulados por pendência`)
    const comExcedente = resultados.filter((r) => r.ajusteExcedenteCentavos > 0).length
    if (gravadas > 0 && comExcedente > 0) {
      toast.warning(`${comExcedente} colaborador(es) com desconto maior que a carga do mês — valor limitado a R$ 0,00 (conferir na coluna Total)`)
    }
    if (gravadas === 0 && puladas === 0) toast.info('Nada a gravar.')
  }

  const abrirDialogAvulso = () => {
    setTipoRegistro('ferias')
    setFeristaId('')
    setPostoId('')
    setDataInicio(competencia ? `${competencia}-01` : '')
    setDataFim('')
    setObservacao('')
    setFeriasVinculoId(null)
    setComTreinamento(false)
    setTreinInicio('')
    setTreinFim('')
    setDialogAberto(true)
  }

  const abrirDialogParaFerias = (f: FeriasBloco) => {
    setTipoRegistro('ferias')
    setFeristaId('')
    setPostoId(postoDoTitular(f))
    setDataInicio(f.data_inicio)
    setDataFim(f.data_fim)
    setObservacao('')
    setFeriasVinculoId(f.colaborador_id)
    // Padrão operacional: 2 dias de treinamento imediatamente antes da cobertura
    setComTreinamento(false)
    setTreinInicio(diasAntes(f.data_inicio, 2))
    setTreinFim(diasAntes(f.data_inicio, 1))
    setDialogAberto(true)
  }

  const salvarCobertura = async () => {
    if (!feristaId || !postoId || !dataInicio || !dataFim) return
    if (comTreinamento && (!treinInicio || !treinFim)) return
    setSalvandoCobertura(true)
    let ok: boolean
    if (feriasVinculoId) {
      ok = await registrarComTreinamento(
        {
          colaborador_id: feristaId,
          ferias_colaborador_id: feriasVinculoId,
          departamento_id: postoId,
          data_inicio: dataInicio,
          data_fim: dataFim,
          observacao: observacao.trim() || null,
        },
        comTreinamento
          ? {
              colaborador_id: feristaId,
              ferias_colaborador_id: feriasVinculoId,
              departamento_id: postoId,
              data_inicio: treinInicio,
              data_fim: treinFim,
              observacao: 'Treinamento no posto',
            }
          : null,
        usuarioId
      )
    } else {
      ok = await registrar(
        {
          tipo: tipoRegistro,
          colaborador_id: feristaId,
          ferias_colaborador_id: null,
          departamento_id: postoId,
          data_inicio: dataInicio,
          data_fim: dataFim,
          observacao: observacao.trim() || null,
        },
        usuarioId
      )
    }
    setSalvandoCobertura(false)
    if (ok) {
      setDialogAberto(false)
      await listarCoberturas()
      await recalcular()
      void recarregarFeristas() // cobertura mudou → selo "Ferista" acompanha
    }
  }

  const declararSemCobertura = async () => {
    if (!semCoberturaDe) return
    const posto = postoDoTitular(semCoberturaDe)
    if (!posto) {
      toast.error('Sem posto identificado para estas férias — use "Quem cobre?" e informe o posto')
      setSemCoberturaDe(null)
      return
    }
    const ok = await registrar(
      {
        colaborador_id: null,
        ferias_colaborador_id: semCoberturaDe.colaborador_id,
        departamento_id: posto,
        data_inicio: semCoberturaDe.data_inicio,
        data_fim: semCoberturaDe.data_fim,
        observacao: 'Sem cobertura',
      },
      usuarioId
    )
    setSemCoberturaDe(null)
    if (ok) {
      await listarCoberturas()
      await recalcular()
      void recarregarFeristas() // cobertura mudou → selo "Ferista" acompanha
    }
  }

  const confirmarExclusao = async () => {
    if (!excluindo) return
    const ok = await remover(excluindo.id)
    setExcluindo(null)
    if (ok) {
      await listarCoberturas()
      await recalcular()
      void recarregarFeristas() // cobertura mudou → selo "Ferista" acompanha
    }
  }

  const botaoImportar = (rotulo: string, outline = false) => (
    <>
      <input
        ref={inputArquivoRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          void aoEscolherArquivo(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      <ModuleButton
        variant={outline ? 'outline' : 'primary'}
        size="sm"
        onClick={() => inputArquivoRef.current?.click()}
        disabled={loading || !dadosProntos}
      >
        <FileUp className="size-4" />
        {loading ? 'Lendo relatório...' : rotulo}
      </ModuleButton>
    </>
  )

  if (!competencia) {
    return (
      <ModuleCard>
        <EmptyState
          icon={<FileUp className="size-6" />}
          title="Carga pela Gestão de escalas"
          description='Importe o relatório "Gestão de escalas" do Flit (Excel, gerado com o mês seguinte programado) para calcular a carga de VT.'
        />
        <div className="flex justify-center">{botaoImportar('Importar Gestão de escalas (Flit)')}</div>
        <div className="mt-4">
          <InstrucoesCarga />
        </div>
      </ModuleCard>
    )
  }

  return (
    <div className="space-y-4">
      <ModuleCard>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[13px] text-muted-foreground">
            Relatório: <strong className="text-foreground">{nomeArquivo}</strong>
            {' · '}Competência:{' '}
            <strong className="text-foreground tabular-nums">{rotuloCompetencia(competencia)}</strong>
          </div>
          <div className="ml-auto flex gap-2">
            {botaoImportar('Importar outro relatório', true)}
            {podeGerenciar && (
              <>
                <ModuleButton
                  size="sm"
                  variant="outline"
                  onClick={gravar}
                  disabled={loading || gravando || bloqueado || resultados.length === 0}
                  title={bloqueado ? 'Resolva as pendências do banner para gravar' : undefined}
                >
                  <Save className="size-4" />
                  {gravando ? 'Gravando...' : 'Gravar carga'}
                </ModuleButton>
                <ModuleButton
                  size="sm"
                  variant="outline"
                  onClick={() => exportarExcel(competencia, resultados)}
                  disabled={loading || resultados.length === 0}
                >
                  <FileSpreadsheet className="size-4" />
                  Baixar Excel
                </ModuleButton>
              </>
            )}
          </div>
        </div>
        {coberturaMes && !coberturaMes.completo && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <p className="font-semibold">O relatório não traz o mês inteiro.</p>
            <p className="mt-1">
              {coberturaMes.primeiro && coberturaMes.ultimo
                ? `Ele vai de ${formatarData(coberturaMes.primeiro)} a ${formatarData(coberturaMes.ultimo)}`
                : 'Ele não tem nenhum dia deste mês'}
              {' — '}
              {coberturaMes.diasFaltando.length === 1
                ? `falta o dia ${formatarData(coberturaMes.diasFaltando[0])}`
                : `faltam ${coberturaMes.diasFaltando.length} dias (${formatarData(coberturaMes.diasFaltando[0])} a ${formatarData(coberturaMes.diasFaltando[coberturaMes.diasFaltando.length - 1])})`}
              . Esses dias ficam sem VT nesta carga. Se der, gere o relatório de novo com o mês completo (dia 1 ao
              último dia). Você pode gravar mesmo assim.
            </p>
          </div>
        )}
        <div className="mt-3">
          <InstrucoesCarga />
        </div>
        {situacaoGravacao === 'nao_gravada' && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            <p className="font-semibold">
              A carga de {rotuloCompetencia(competencia)} AINDA NÃO está gravada no sistema.
            </p>
            <p className="mt-1">
              O cálculo abaixo existe só nesta tela — se você sair, ele se perde. Clique em{' '}
              <strong>Gravar carga</strong> (se o botão estiver desabilitado, resolva antes as pendências do banner
              amarelo) e confira o aviso verde de confirmação.
            </p>
          </div>
        )}
        {situacaoGravacao === 'parcial' && gravacao && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <p className="font-semibold">A carga gravada não bate com o cálculo atual.</p>
            <p className="mt-1">
              O cálculo atual é diferente do que está gravado ({gravacao.total} gravada(s)
              {gravacao.ultimaEm ? `, última em ${formatarDataHora(gravacao.ultimaEm)},` : ''} ×{' '}
              {prontosParaGravar.length} pronta(s) agora) — se a mudança é esperada, clique em{' '}
              <strong>Gravar carga</strong> de novo.
            </p>
          </div>
        )}
        {situacaoGravacao === 'gravada' && gravacao && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-800">
            <p className="font-semibold">
              Carga gravada no sistema
              {gravacao.ultimaEm ? ` em ${formatarDataHora(gravacao.ultimaEm)}` : ''} — {gravacao.total}{' '}
              colaborador(es).
            </p>
          </div>
        )}
        {bloqueado && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <p className="font-semibold">A gravação está bloqueada:</p>
            <ul className="mt-1 list-disc pl-5">
              {pendenciasPortao.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </ModuleCard>

      <ModuleCard
        title="Férias no mês"
        description='Blocos [FR] do relatório — cada um precisa de destino: quem cobre (ferista) ou a declaração "sem cobertura"'
      >
        {sobreposicoes.length > 0 && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            {sobreposicoes.map((s) => (
              <p key={s.colaborador_id}>
                <strong>{nomeDo(s.colaborador_id)}</strong> está cobrindo {s.quantas} postos ao mesmo
                tempo ({formatarData(s.inicio)} a {formatarData(s.fim)}) — confira se está certo.
              </p>
            ))}
          </div>
        )}
        {destinos.length === 0 ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">Nenhuma férias no mês do relatório.</p>
            {podeGerenciar && (
              <ModuleButton size="sm" variant="outline" onClick={abrirDialogAvulso}>
                <Plus className="size-4" />
                Registrar cobertura ou treinamento
              </ModuleButton>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5">Titular</th>
                    <th className="px-4 py-2.5">Período</th>
                    <th className="px-4 py-2.5">Posto</th>
                    <th className="px-4 py-2.5">Destino</th>
                    {podeGerenciar && <th className="px-4 py-2.5 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {destinos.map(({ ferias: f, destino }) => (
                    <tr key={`${f.colaborador_id}|${f.data_inicio}`} className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2 font-medium text-foreground">{nomeDo(f.colaborador_id)}</td>
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">
                        {formatarData(f.data_inicio)} a {formatarData(f.data_fim)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {nomeCurtoDepartamentoFuzzy(departamentos, postoDoTitular(f) || null)}
                      </td>
                      <td className="px-4 py-2">
                        {destino.tipo === 'coberta' && (
                          <StatusBadge variant="success">
                            Coberta por {nomeDo(destino.cobertura.colaborador_id)}
                          </StatusBadge>
                        )}
                        {destino.tipo === 'sem_cobertura' && (
                          <StatusBadge variant="neutral">Sem cobertura</StatusBadge>
                        )}
                        {destino.tipo === 'pendente' && (
                          <StatusBadge variant="warning">PENDENTE</StatusBadge>
                        )}
                        {treinamentosDoTitular(f).map((t) => (
                          <div key={t.id} className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            <StatusBadge variant="info" dot={false} className="bg-purple-50 text-purple-700">
                              Treinamento
                            </StatusBadge>
                            <span>
                              {nomeDo(t.colaborador_id)}, {formatarData(t.data_inicio)} a {formatarData(t.data_fim)}
                            </span>
                            {podeGerenciar && (
                              <button
                                type="button"
                                className="rounded-md p-0.5 text-red-600 hover:bg-red-50"
                                title="Excluir treinamento"
                                onClick={() => setExcluindo(t)}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </td>
                      {podeGerenciar && (
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">
                            {destino.tipo === 'pendente' ? (
                              <>
                                <ModuleButton size="sm" variant="outline" onClick={() => abrirDialogParaFerias(f)}>
                                  Quem cobre?
                                </ModuleButton>
                                <ModuleButton size="sm" variant="ghost" onClick={() => setSemCoberturaDe(f)}>
                                  Sem cobertura
                                </ModuleButton>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                                title="Desfazer o destino"
                                onClick={() => setExcluindo(destino.cobertura)}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {podeGerenciar && (
              <div className="mt-3 flex justify-end">
                <ModuleButton size="sm" variant="ghost" onClick={abrirDialogAvulso}>
                  <Plus className="size-4" />
                  Registrar cobertura ou treinamento (fora de férias)
                </ModuleButton>
              </div>
            )}
          </>
        )}
        {coberturasAvulsas.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Coberturas e treinamentos avulsos no mês
            </p>
            <div className="space-y-1">
              {coberturasAvulsas.map((c) => (
                <div key={c.id} className="flex items-center gap-3 text-[13px] text-muted-foreground">
                  {(c.tipo ?? 'ferias') === 'treinamento' && (
                    <StatusBadge variant="info" dot={false} className="bg-purple-50 text-purple-700">
                      Treinamento
                    </StatusBadge>
                  )}
                  <span className="font-medium text-foreground">{nomeDo(c.colaborador_id)}</span>
                  <span>{nomeCurtoDepartamentoFuzzy(departamentos, c.departamento_id)}</span>
                  <span className="tabular-nums">
                    {formatarData(c.data_inicio)} a {formatarData(c.data_fim)}
                  </span>
                  {c.observacao && <span>— {c.observacao}</span>}
                  {podeGerenciar && (
                    <button
                      type="button"
                      className="rounded-md p-1 text-red-600 hover:bg-red-50"
                      title="Excluir cobertura"
                      onClick={() => setExcluindo(c)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </ModuleCard>

      <ModuleCard
        title="Cobertura do relatório — todos os colaboradores"
        description="Optantes ou não: cada pessoa precisa estar escalada com posto identificado, de férias/afastada, ou cobrindo alguém"
      >
        <p className="text-[13px] text-muted-foreground">
          <strong className="text-foreground">{resultados.length}</strong> optantes (tabela da carga abaixo)
          {' · '}
          <strong className="text-foreground">{resumoGeral.naoOptantes.length}</strong> não optantes:{' '}
          {resumoGeral.escalados.length} escalados
          {' · '}{resumoGeral.soAusencias.length} só com férias/afastamento
          {' · '}{resumoGeral.diasSemPosto.length} com dias sem posto
          {' · '}{resumoGeral.semRegistro.length} sem registro
          {nomesSemMatch.length > 0 && (
            <>
              {' · '}<strong className="text-amber-700">{nomesSemMatch.length} sem match no cadastro</strong>
            </>
          )}
        </p>
        {(resumoGeral.diasSemPosto.length > 0 ||
          resumoGeral.semRegistro.length > 0 ||
          nomesSemMatch.length > 0) && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <p className="font-semibold">A conferir (não bloqueia a carga dos optantes):</p>
            <ul className="mt-1 list-disc pl-5">
              {resumoGeral.diasSemPosto.map((p) => (
                <li key={p.colaborador_id}>
                  {p.nome} — {p.diasTrabalhoSemPosto} dia(s) sem posto identificado (
                  {p.locaisNaoIdentificados.join('; ')})
                </li>
              ))}
              {resumoGeral.semRegistro.map((p) => (
                <li key={p.colaborador_id}>
                  {p.nome} — sem dia de trabalho, férias ou afastamento no relatório
                </li>
              ))}
              {nomesSemMatch.length > 0 && (
                <li>Sem match no cadastro (nunca casamos por palpite): {nomesSemMatch.join(', ')}</li>
              )}
            </ul>
          </div>
        )}
        <div className="mt-3">
          <ModuleButton size="sm" variant="ghost" onClick={() => setMostrarTodosGeral((v) => !v)}>
            {mostrarTodosGeral ? 'Esconder a lista completa' : 'Ver todos os não optantes'}
          </ModuleButton>
        </div>
        {mostrarTodosGeral && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Nome</th>
                  <th className="px-4 py-2.5 text-center">Dias trabalhados</th>
                  <th className="px-4 py-2.5 text-center">Férias/afastamento</th>
                  <th className="px-4 py-2.5">Situação</th>
                </tr>
              </thead>
              <tbody>
                {resumoGeral.naoOptantes.map((p) => (
                  <tr key={p.colaborador_id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2 font-medium text-foreground">{p.nome}</td>
                    <td className="px-4 py-2 text-center tabular-nums">{p.diasTrabalho}</td>
                    <td className="px-4 py-2 text-center tabular-nums">{p.diasAusencia}</td>
                    <td className="px-4 py-2">
                      {p.situacao === 'escalado' && <StatusBadge variant="success">Escalado</StatusBadge>}
                      {p.situacao === 'so_ausencias' && (
                        <StatusBadge variant="neutral">Só férias/afastamento</StatusBadge>
                      )}
                      {p.situacao === 'dias_sem_posto' && (
                        <span title={p.locaisNaoIdentificados.join('; ')}>
                          <StatusBadge variant="warning">
                            {p.diasTrabalhoSemPosto} dia(s) sem posto identificado
                          </StatusBadge>
                        </span>
                      )}
                      {p.situacao === 'sem_registro' && (
                        <StatusBadge variant="warning">Sem registro no relatório</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModuleCard>

      <ModuleCard
        title={`Carga de ${rotuloCompetencia(competencia)}`}
        description={
          resultados.length > 0
            ? `${totais.optantes} optantes · ${totais.prontos} prontos · total a creditar ${formatarCentavos(totais.soma)}`
            : undefined
        }
      >
        {resultados.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="size-6" />}
            description={
              loading
                ? 'Calculando a carga pelo relatório...'
                : 'Nenhum optante casou com o relatório. Marque os optantes na aba Colaboradores.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Postos do mês</th>
                  <th className="px-4 py-3 text-right">Total a creditar</th>
                  <th className="px-4 py-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r) => {
                  const feriasDele = ferias.filter((f) => f.colaborador_id === r.colaborador_id)
                  return (
                    <tr key={r.colaborador_id} className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2.5 font-medium text-foreground">{r.nome}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.detalhe.length === 0 && feriasDele.length === 0 ? (
                          '—'
                        ) : (
                          <div className="space-y-0.5">
                            {r.detalhe.map((d) => (
                              <div key={d.departamento_id} className="tabular-nums">
                                {d.posto} — {d.dias} dias × {formatarCentavos(d.custo_dia_centavos)} ={' '}
                                {formatarCentavos(d.subtotal_centavos)}
                                {sufixoCobertura(d.dias_cobertura, d.dias)}
                                {sufixoTreinamento(d.dias_treinamento, d.dias)}
                                {sufixoExtra(d.valor_extra_centavos)}
                              </div>
                            ))}
                            {feriasDele.map((f) => (
                              <div key={`${f.data_inicio}`} className="text-[12px] text-muted-foreground/80">
                                Férias {formatarData(f.data_inicio)}–{formatarData(f.data_fim)} — {r.diasEmFerias}{' '}
                                dias fora da carga
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {formatarCentavos(r.valor_centavos)}
                        {(r.ajusteDescontoCentavos > 0 || r.ajusteCreditoCentavos > 0) && (
                          <div className="text-[12px] font-normal text-muted-foreground">
                            inclui ajuste do fechamento do mês anterior:{' '}
                            {[
                              r.ajusteDescontoCentavos > 0 ? `−${formatarCentavos(r.ajusteDescontoCentavos)} desconto` : null,
                              r.ajusteCreditoCentavos > 0 ? `+${formatarCentavos(r.ajusteCreditoCentavos)} crédito` : null,
                            ]
                              .filter(Boolean)
                              .join(' / ')}
                          </div>
                        )}
                        {r.ajusteExcedenteCentavos > 0 && (
                          <div className="text-[12px] font-normal text-amber-700 dark:text-amber-400">
                            desconto passou da carga: {formatarCentavos(r.ajusteExcedenteCentavos)} não cabem neste mês
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">{situacaoDa(r)}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 text-[13px] font-semibold">
                  <td className="px-4 py-2.5">{totais.optantes} optantes</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{totais.prontos} prontos</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatarCentavos(totais.soma)}</td>
                  <td className="px-4 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </ModuleCard>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {feriasVinculoId
                ? 'Quem cobre as férias?'
                : tipoRegistro === 'treinamento'
                  ? 'Registrar treinamento'
                  : 'Registrar cobertura'}
            </DialogTitle>
            <DialogDescription>
              {feriasVinculoId
                ? 'O ferista trabalha no posto das férias no período — a carga usa esse posto, não o do relatório.'
                : tipoRegistro === 'treinamento'
                  ? 'Dias de treinamento com VT (ex.: treinamento de admissão). A carga conta esses dias no posto do treinamento.'
                  : 'Cobertura avulsa (ex.: transferência temporária). A carga usa o posto coberto no período.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!feriasVinculoId && (
              <div className="space-y-1.5">
                <Label>Tipo de registro</Label>
                <Select value={tipoRegistro} onValueChange={(v) => setTipoRegistro(v as TipoCoberturaVT)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ferias">Cobertura de férias (avulsa)</SelectItem>
                    <SelectItem value="treinamento">Treinamento (admissão ou posto novo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{tipoRegistro === 'treinamento' && !feriasVinculoId ? 'Quem treina' : 'Ferista'}</Label>
              <Select value={feristaId} onValueChange={setFeristaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o ferista" />
                </SelectTrigger>
                <SelectContent>
                  {gruposSeletor.map((grupo, p) =>
                    grupo.length === 0 ? null : (
                      <SelectGroup key={p}>
                        <SelectLabel>{ROTULO_GRUPO_FERISTA[p as 0 | 1 | 2 | 3]}</SelectLabel>
                        {grupo.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome_completo} — {nomeCurtoDepartamentoFuzzy(departamentos, c.departamento_id, c.departamento)}
                            {ehFerista(c.id) ? ' · Ferista' : ''}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )
                  )}
                </SelectContent>
              </Select>
              {feristaId && prioridadeFerista(feristaId) !== 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  <span>Ele não faz parte da equipe dedicada de feristas.</span>
                  {podeGerenciar && (
                    <ModuleButton
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const colab = colaboradores.find((c) => c.id === feristaId)
                        if (colab) await adicionarFeristaCarteira({ id: colab.id, cargo: colab.cargo ?? null })
                      }}
                    >
                      Adicionar à carteira
                    </ModuleButton>
                  )}
                </div>
              )}
              {feristaSelecionado && !feristaSelecionado.vt_optante && (
                <p className="text-[12px] text-muted-foreground">
                  Ele não é optante do VT — o registro vale para o planejamento da cobertura, mas não gera VT para ele.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{tipoRegistro === 'treinamento' && !feriasVinculoId ? 'Posto do treinamento' : 'Posto coberto'}</Label>
              <DepartamentoAutocomplete
                value={postoId}
                onChange={setPostoId}
                clearValue=""
                clearLabel="Selecione o posto"
                placeholder="Buscar posto..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>De</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Até</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
            {feriasVinculoId && (
              <div className="rounded-lg border border-border p-3">
                <label className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={comTreinamento}
                    onChange={(e) => setComTreinamento(e.target.checked)}
                  />
                  Precisa treinar no posto antes de cobrir
                </label>
                {comTreinamento && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[12px] text-muted-foreground">
                      Os dias de treinamento também recebem VT no posto coberto (padrão: 2 dias antes do início).
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Treinamento de</Label>
                        <Input type="date" value={treinInicio} onChange={(e) => setTreinInicio(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Até</Label>
                        <Input type="date" value={treinFim} onChange={(e) => setTreinFim(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Observação (opcional)</Label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder={
                  tipoRegistro === 'treinamento' && !feriasVinculoId
                    ? 'Ex.: treinamento de admissão'
                    : 'Ex.: cobre as férias do João'
                }
              />
            </div>
          </div>
          <DialogFooter>
            <ModuleButton variant="outline" onClick={() => setDialogAberto(false)} disabled={salvandoCobertura}>
              Cancelar
            </ModuleButton>
            <ModuleButton
              onClick={salvarCobertura}
              disabled={
                !feristaId ||
                !postoId ||
                !dataInicio ||
                !dataFim ||
                (comTreinamento && (!treinInicio || !treinFim)) ||
                salvandoCobertura
              }
            >
              {salvandoCobertura ? 'Salvando...' : 'Registrar'}
            </ModuleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!semCoberturaDe}
        onOpenChange={() => setSemCoberturaDe(null)}
        icon={<CalendarClock className="size-6 text-slate-600" />}
        iconClassName="bg-slate-100"
        title="Férias sem cobertura?"
        description={
          semCoberturaDe
            ? `Confirmar que as férias de ${nomeDo(semCoberturaDe.colaborador_id)} ficam sem cobertura? (ex.: o ferista é quem está de férias)`
            : ''
        }
        confirmLabel="Sim, sem cobertura"
        onConfirm={declararSemCobertura}
      />

      <ConfirmDialog
        open={!!excluindo}
        onOpenChange={() => setExcluindo(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title={(excluindo?.tipo ?? 'ferias') === 'treinamento' ? 'Excluir treinamento?' : 'Excluir cobertura?'}
        description={
          excluindo
            ? `${nomeDo(excluindo.colaborador_id ?? excluindo.ferias_colaborador_id)} — ${nomeCurtoDepartamentoFuzzy(departamentos, excluindo.departamento_id)} de ${formatarData(excluindo.data_inicio)} a ${formatarData(excluindo.data_fim)}. A carga volta a usar o relatório para esses dias.`
            : ''
        }
        confirmLabel="Sim, excluir"
        onConfirm={confirmarExclusao}
        destructive
      />
    </div>
  )
}
