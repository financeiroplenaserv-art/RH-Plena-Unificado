import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Database, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react'
import { ordenarPorNome, proximoSentidoNome, type SentidoNome } from '@/lib/vt/ordenarPorNome'
import { VtArquivoRiocardDialog } from '@/pages/vt/VtArquivoRiocardDialog'
import { ModuleButton, ModuleCard } from '@/components/layout/ModuleShell'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { useVtLoteCarga } from '@/hooks/useVtLoteCarga'
import { carregarDominioLote } from '@/lib/vt/carregarDominioLote'
import { jsonCanonico, sha256Hex } from '@/lib/vt/loteConteudo'
import { RepositorioLoteCargaSupabase } from '@/lib/vt/repositorioLoteSupabase'
import { selecionarProntosLote } from '@/lib/vt/selecionarProntosLote'
import { baixarExcelLoteConfirmado } from '@/lib/vt/excelLote'
import { formatarCentavos } from '@/lib/vt/bilhetes'
import type { DiaPlanejadoLoteVT } from '@/lib/vt/construirLote'
import type { VtColaborador, VtDepartamento } from '@/hooks/useVt'
import { supabase } from '@/lib/supabase'
import { competenciaAnterior } from '@/lib/vt/fechamento'
import { ajustesDoFechamentoAnterior, ajustesDosExtrasMensais, cargasDoLoteConfirmado, type FechamentoParaAjuste } from '@/lib/vt/pontesLote'
import { useVtExtrasMensais } from '@/hooks/useVtExtrasMensais'
import { centavosParaCampo, validarExtraMensal } from '@/lib/vt/extraMensal'
import type { VtExtraMensal } from '@/types/vt'
import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import { formatarDataHora } from '@/lib/utils'
import type { CoberturaMesRelatorio } from '@/lib/vt/gestaoEscalasFlit'
import { avisoCargaParcial, bannerEstadoLote } from '@/lib/vt/estadoLote'
import type { EscalaRelatorioVt } from '@/lib/vt/calendarioEscala'
import { gravarEscalaDiasCompetencia } from '@/lib/vt/escalaDiasRepositorio'
import { VtEscalaColaboradorDialog } from '@/pages/vt/VtEscalaColaboradorDialog'

interface VtLoteCargaRealProps {
  /** Competência do relatório importado neste aparelho; null = ninguém importou aqui (vale o último lote do banco). */
  competencia: string | null
  /** Cobertura do mês no relatório importado (aviso de carga parcial). */
  cobertura?: CoberturaMesRelatorio | null
  /**
   * Contador que o pai incrementa a cada importação/recálculo do relatório: o rascunho é então
   * salvo NO BANCO automaticamente (antes só existia na tela de quem importou).
   */
  importacaoSeq?: number
  dias: DiaPlanejadoLoteVT[]
  /**
   * Marcas do relatório importado nesta tela (optantes casados). Gravadas em vt_escala_dias
   * (migration 178) junto com o salvamento automático do rascunho, para o pop-up da escala
   * abrir em qualquer computador.
   */
  escala?: EscalaRelatorioVt | null
  colaboradores: VtColaborador[]
  nomeArquivo: string | null
  usuarioId: string
  departamentos: VtDepartamento[]
  /**
   * Optantes que NÃO podem entrar na carga ainda, com o motivo (ex.: dias sem posto
   * identificado no relatório — sem isso esses dias sumiriam da conta e a pessoa
   * receberia a menos em silêncio).
   */
  bloqueios?: ReadonlyMap<string, string>
  /** `vt.gerenciar`: só quem gerencia lança/remove o extra do mês. */
  podeGerenciar?: boolean
}

function valor(centavos: number | null) {
  return centavos == null ? '—' : formatarCentavos(centavos)
}

export function VtLoteCargaReal({ competencia: competenciaImportada, cobertura = null, importacaoSeq = 0, dias, escala = null, colaboradores, nomeArquivo, usuarioId, departamentos, bloqueios, podeGerenciar = false }: VtLoteCargaRealProps) {
  const repositorio = useMemo(() => new RepositorioLoteCargaSupabase(), [])
  // Sem relatório importado neste aparelho, mostra o último lote que existe no banco.
  const [competenciaDoBanco, setCompetenciaDoBanco] = useState<string | null>(null)
  const competencia = competenciaImportada ?? competenciaDoBanco ?? ''
  const [competenciaCarregada, setCompetenciaCarregada] = useState<string | null>(null)
  const [autoPendente, setAutoPendente] = useState(false)
  const autoTentadaRef = useRef<string | null>(null)
  const construindoRef = useRef(false)
  const { lote, loading, erro, carregar, construir, confirmar } = useVtLoteCarga(repositorio, usuarioId)
  const [construindo, setConstruindo] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [arquivoRiocardAberto, setArquivoRiocardAberto] = useState(false)
  const [erroExportacao, setErroExportacao] = useState<string | null>(null)
  const [pendentesIds, setPendentesIds] = useState<string[]>([])
  const [gravandoFechamento, setGravandoFechamento] = useState(false)
  const [situacaoFechamento, setSituacaoFechamento] = useState<{ ok: boolean; texto: string } | null>(null)
  const extrasMes = useVtExtrasMensais(competencia || '0000-00', usuarioId)
  const [extraPessoa, setExtraPessoa] = useState('')
  const [extraValor, setExtraValor] = useState('')
  const [extraMotivo, setExtraMotivo] = useState('')
  const [extraMensagem, setExtraMensagem] = useState<{ ok: boolean; texto: string } | null>(null)
  const nomes = useMemo(() => new Map(colaboradores.map((c) => [c.id, c.nome_completo])), [colaboradores])
  const [escalaAberta, setEscalaAberta] = useState<string | null>(null)
  const [avisoEscala, setAvisoEscala] = useState<string | null>(null)
  const nomePostoCurto = useMemo(() => {
    const porId = new Map(departamentos.map((d) => [d.id, d.nome_curto?.trim() || d.nome?.trim() || d.id]))
    return (id: string) => porId.get(id) ?? id
  }, [departamentos])
  const [sentidoNome, setSentidoNome] = useState<SentidoNome>('asc')
  const totaisOrdenados = useMemo(
    () => ordenarPorNome(lote?.totaisPorColaborador ?? [], (t) => nomes.get(t.colaboradorId) ?? t.colaboradorId, sentidoNome),
    [lote, nomes, sentidoNome],
  )
  const optantesIds = useMemo(
    () => colaboradores.filter((c) => c.vt_optante && !bloqueios?.has(c.id)).map((c) => c.id),
    [colaboradores, bloqueios],
  )

  useEffect(() => {
    if (competenciaImportada) return
    let ativo = true
    repositorio
      .competenciaMaisRecente()
      .then((c) => { if (ativo) setCompetenciaDoBanco(c) })
      .catch(() => { /* só informativo: sem isso a aba segue pedindo a importação */ })
    return () => { ativo = false }
  }, [competenciaImportada, repositorio])

  useEffect(() => {
    if (!competencia) return
    let ativo = true
    void carregar(competencia).then(() => { if (ativo) setCompetenciaCarregada(competencia) })
    return () => { ativo = false }
  }, [carregar, competencia])

  // Fechamento do mês anterior → ajuste desta carga (faltou: desconta; trabalhou fora: credita).
  // Erro de leitura aborta: nunca calcular com ajuste 0 fingindo que não há fechamento.
  const lerAjustesAnteriores = async () => {
    const ids = optantesIds
    const fechamentos: FechamentoParaAjuste[] = []
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await supabase
        .from('vt_fechamentos')
        .select('id, colaborador_id, competencia, desconto_centavos, credito_centavos')
        .eq('competencia', competenciaAnterior(competencia))
        .in('colaborador_id', ids.slice(i, i + 100))
      if (error) throw new Error(`Não foi possível ler o fechamento do mês anterior: ${error.message}`)
      fechamentos.push(...((data ?? []) as FechamentoParaAjuste[]))
    }
    return ajustesDoFechamentoAnterior(fechamentos, new Date().toISOString())
  }

  // Lote confirmado → vt_cargas 'gravada' (formato que a aba Fechamento lê). Idempotente.
  const gravarParaFechamento = async (confirmado: LoteCargaVT) => {
    setGravandoFechamento(true)
    setSituacaoFechamento(null)
    try {
      const nomePosto = (id: string) => {
        const dep = departamentos.find((d) => d.id === id)
        return dep?.nome_curto?.trim() || dep?.nome?.trim() || id
      }
      const linhas = cargasDoLoteConfirmado(
        confirmado,
        nomePosto,
        usuarioId,
        confirmado.confirmacao?.confirmadaEm ?? new Date().toISOString(),
      )
      let gravadas = 0
      for (let i = 0; i < linhas.length; i += 200) {
        const { data, error } = await supabase
          .from('vt_cargas')
          .upsert(linhas.slice(i, i + 200), { onConflict: 'colaborador_id,competencia' })
          .select('id')
        if (error) throw error
        gravadas += data?.length ?? 0
      }
      if (gravadas !== linhas.length) {
        throw new Error(`Só ${gravadas} de ${linhas.length} cargas foram gravadas; confira permissões.`)
      }
      setSituacaoFechamento({ ok: true, texto: `${gravadas} carga(s) gravada(s) — já aparecem na aba Fechamento.` })
    } catch (erro) {
      setSituacaoFechamento({
        ok: false,
        texto: `O lote está confirmado, mas a gravação para o Fechamento falhou: ${erro instanceof Error ? erro.message : 'erro desconhecido'}. Clique em "Gravar para o Fechamento" de novo.`,
      })
    } finally {
      setGravandoFechamento(false)
    }
  }

  const construirLote = async (extrasDoMes: readonly VtExtraMensal[] = extrasMes.extras) => {
    // Trava síncrona: o salvamento automático e o clique em "Construir" podem disparar no mesmo
    // instante (antes de o estado `construindo` chegar à tela) e criariam DOIS rascunhos da mesma
    // competência — o recarregamento mostraria o errado (achado em 28/11/2026).
    if (construindoRef.current) return
    construindoRef.current = true
    setConstruindo(true)
    try {
      // Erro de leitura dos extras aborta: nunca calcular sem o extra fingindo que ele não existe.
      if (extrasMes.erroLeitura) throw new Error(extrasMes.erroLeitura)
      const ajustesFechamento = await lerAjustesAnteriores()
      const dominio = await carregarDominioLote()
      const selecao = selecionarProntosLote({
        dias,
        colaboradorIds: optantesIds,
        ...dominio,
      })
      setPendentesIds(selecao.pendentesIds)
      // Extra do mês só entra para quem está no lote: pendente/bloqueado não recebe SÓ o extra.
      const prontos = new Set(selecao.colaboradorIds)
      const ajustesAnteriores = [
        ...ajustesFechamento,
        ...ajustesDosExtrasMensais(extrasDoMes.filter((e) => prontos.has(e.colaborador_id)), new Date().toISOString()),
      ]
      const conteudoHash = await sha256Hex(jsonCanonico({
        competencia,
        dias: selecao.dias,
        colaboradorIds: selecao.colaboradorIds,
      }))
      await construir({
        id: lote?.id ?? crypto.randomUUID(),
        competencia,
        versaoCalculo: '4.0.0-vertical',
        versaoRegras: { fluxo: 'vertical-1' },
        fonte: {
          tipo: 'gestao_escalas_flit',
          nomeArquivo,
          conteudoHash,
          importadoEm: new Date().toISOString(),
        },
        dias: selecao.dias,
        colaboradorIds: selecao.colaboradorIds,
        ...dominio,
        ajustesAnteriores,
      })
    } catch (erro) {
      setSituacaoFechamento({ ok: false, texto: erro instanceof Error ? erro.message : 'Erro ao construir o rascunho.' })
    } finally {
      construindoRef.current = false
      setConstruindo(false)
    }
  }

  // Marcas do relatório → vt_escala_dias (migration 178). Erro vira aviso visível; nunca bloqueia o rascunho.
  const gravarEscala = async () => {
    if (!escala || escala.competencia !== competenciaImportada) return
    try {
      await gravarEscalaDiasCompetencia({
        competencia: escala.competencia,
        nomeArquivo: escala.nomeArquivo,
        usuarioId,
        porColaborador: escala.porColaborador,
      })
      setAvisoEscala(null)
    } catch (erro) {
      setAvisoEscala(
        `O rascunho segue normal, mas a escala detalhada não foi salva no sistema (o pop-up da escala só funciona neste computador): ${erro instanceof Error ? erro.message : 'erro desconhecido'}`,
      )
    }
  }

  const lancamentoTravado = lote?.status === 'confirmado'

  // Salvamento automático do rascunho NO BANCO (28/11/2026): importar o relatório não pode deixar o
  // cálculo só na tela de quem importou. Dispara (a) a cada importação/recálculo (importacaoSeq) e
  // (b) uma vez por competência quando há relatório na tela e nada salvo no banco (ex.: restaurado
  // do aparelho). Nunca mexe em lote confirmado.
  useEffect(() => {
    if (importacaoSeq > 0) setAutoPendente(true)
  }, [importacaoSeq])

  useEffect(() => {
    if (!competenciaImportada || dias.length === 0 || competenciaCarregada !== competenciaImportada) return
    if (!lote && autoTentadaRef.current !== competenciaImportada) {
      autoTentadaRef.current = competenciaImportada
      setAutoPendente(true)
    }
  }, [competenciaImportada, competenciaCarregada, dias.length, lote])

  useEffect(() => {
    if (!autoPendente || !podeGerenciar) return
    if (!competenciaImportada || competenciaCarregada !== competenciaImportada) return
    if (loading || construindo || !extrasMes.carregado || extrasMes.erroLeitura) return
    setAutoPendente(false)
    // A escala detalhada é salva sempre (inclusive com lote confirmado: só serve para conferência).
    void gravarEscala()
    if (lote?.status === 'confirmado') return
    autoTentadaRef.current = competenciaImportada
    void construirLote()
    // construirLote é recriado a cada render; as condições acima já garantem o estado fresco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPendente, podeGerenciar, competenciaImportada, competenciaCarregada, loading, construindo, extrasMes.carregado, extrasMes.erroLeitura, lote])

  const banner = bannerEstadoLote({
    competencia,
    lote,
    carregado: competenciaCarregada === competencia,
    temRelatorioNaTela: !!competenciaImportada && dias.length > 0,
    formatarQuando: formatarDataHora,
  })
  const avisoParcial = avisoCargaParcial(competenciaImportada ? cobertura : null)

  const aplicarExtra = async (acao: () => Promise<VtExtraMensal[]>, textoOk: string) => {
    setExtraMensagem(null)
    try {
      const atualizados = await acao()
      // Rascunho existente: recalcula na hora para o extra entrar no total e no hash.
      if (lote?.status === 'rascunho') await construirLote(atualizados)
      setExtraMensagem({
        ok: true,
        texto: lote?.status === 'rascunho' ? `${textoOk} Rascunho recalculado.` : `${textoOk} Entra ao construir o rascunho.`,
      })
    } catch (erro) {
      setExtraMensagem({ ok: false, texto: erro instanceof Error ? erro.message : 'Erro ao gravar o extra.' })
    }
  }

  const salvarExtra = async () => {
    if (!extraPessoa) {
      setExtraMensagem({ ok: false, texto: 'Escolha a pessoa.' })
      return
    }
    const validado = validarExtraMensal(extraValor, extraMotivo)
    if (validado.ok === false) {
      setExtraMensagem({ ok: false, texto: validado.erro })
      return
    }
    await aplicarExtra(() => extrasMes.salvar(extraPessoa, validado.extra.valorCentavos, validado.extra.motivo), 'Extra gravado.')
    setExtraPessoa('')
    setExtraValor('')
    setExtraMotivo('')
  }

  const removerExtra = async (id: string) => {
    await aplicarExtra(() => extrasMes.remover(id), 'Extra removido.')
  }

  const editarExtra = (e: VtExtraMensal) => {
    setExtraPessoa(e.colaborador_id)
    setExtraValor(centavosParaCampo(e.valor_centavos))
    setExtraMotivo(e.motivo)
    setExtraMensagem(null)
  }

  const confirmarLote = async () => {
    const confirmado = await confirmar()
    if (confirmado) {
      await gravarParaFechamento(confirmado)
      await carregar(competencia)
    }
  }

  const exportarLote = async () => {
    if (!lote) return
    setExportando(true)
    setErroExportacao(null)
    try {
      await baixarExcelLoteConfirmado(repositorio, lote.id, nomes)
    } catch (erro) {
      setErroExportacao(erro instanceof Error ? erro.message : 'Erro ao exportar o lote.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <ModuleCard
      title={
        <>
          <Database className="size-4" />
          Carga do mês pelas rotas confirmadas
        </>
      }
      description={`Competência ${competencia || '—'}. O valor de cada dia vem da rota confirmada da pessoa para o posto daquele dia.`}
      className="border-emerald-200"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
          1) Construir o rascunho · 2) Confirmar o lote · 3) Baixar o Excel. Só entra quem tem rota confirmada para todos os postos do mês; quem falta aparece abaixo e deve ser resolvido na aba Rotas a confirmar. O desconto ou crédito do fechamento do mês anterior entra como ajuste.
        </div>

        {banner && (
          <div
            role="status"
            data-testid="estado-lote"
            className={`rounded-lg border px-4 py-3 text-[13px] ${
              banner.tom === 'verde'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : banner.tom === 'ambar'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <p className="font-semibold">{banner.titulo}</p>
            <p className="mt-1">{banner.detalhe}</p>
          </div>
        )}
        {!competencia && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800" data-testid="estado-lote">
            <p className="font-semibold">Nenhuma carga salva no banco</p>
            <p className="mt-1">Importe o relatório "Gestão de escalas" do mês acima: o rascunho é salvo no banco automaticamente.</p>
          </div>
        )}
        {avisoParcial && lote?.status !== 'confirmado' && (
          <div role="alert" data-testid="aviso-parcial" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            {avisoParcial}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {lote?.status !== 'confirmado' && (
            <ModuleButton size="sm" disabled={loading || construindo || !competenciaImportada || dias.length === 0} onClick={() => void construirLote()}>
              <RefreshCw className="size-4" />
              {construindo ? 'Construindo...' : lote ? 'Recalcular rascunho' : 'Construir rascunho'}
            </ModuleButton>
          )}
          {lote?.status === 'rascunho' && (
            <ModuleButton
              size="sm"
              disabled={loading || lote.valorCentavos == null}
              onClick={() => {
                if (avisoParcial && !window.confirm('O relatório não traz o mês inteiro. Confirmar fecha esta competência com a carga PARCIAL. Confirmar mesmo assim?')) return
                void confirmarLote()
              }}
            >
              Confirmar lote
            </ModuleButton>
          )}
          {lote?.status === 'confirmado' && (
            <ModuleButton size="sm" variant="outline" disabled={gravandoFechamento} onClick={() => void gravarParaFechamento(lote)}>
              {gravandoFechamento ? 'Gravando...' : 'Gravar para o Fechamento'}
            </ModuleButton>
          )}
          {lote?.status === 'confirmado' && (
            <ModuleButton size="sm" variant="outline" disabled={exportando} onClick={() => void exportarLote()}>
              <FileSpreadsheet className="size-4" />
              {exportando ? 'Gerando...' : 'Baixar Excel do lote'}
            </ModuleButton>
          )}
          <ModuleButton size="sm" variant="outline" disabled={lote?.status !== 'confirmado' || !podeGerenciar} onClick={() => setArquivoRiocardAberto(true)}>
            <FileText className="size-4" />
            Arquivo Riocard
          </ModuleButton>
          {loading && <span className="text-[13px] text-muted-foreground">Processando...</span>}
        </div>

        {erro && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {erro}
          </div>
        )}
        {avisoEscala && (
          <div role="alert" data-testid="aviso-escala" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            {avisoEscala}
          </div>
        )}
        {situacaoFechamento && (
          <div
            role={situacaoFechamento.ok ? 'status' : 'alert'}
            className={`rounded-lg border px-4 py-3 text-[13px] ${situacaoFechamento.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}
          >
            {situacaoFechamento.texto}
          </div>
        )}
        {erroExportacao && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {erroExportacao}
          </div>
        )}

        {bloqueios && bloqueios.size > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <p className="font-semibold">Fora da carga por problema no relatório (resolva e importe de novo)</p>
            <ul className="mt-1 list-disc pl-5">
              {[...bloqueios].map(([id, motivo]) => <li key={id}>{nomes.get(id) ?? id}: {motivo}</li>)}
            </ul>
          </div>
        )}

        {pendentesIds.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <p className="font-semibold">Fora da carga: falta rota confirmada para algum posto do mês (resolva na aba Rotas a confirmar e recalcule)</p>
            <ul className="mt-1 list-disc pl-5">
              {pendentesIds.map((id) => <li key={id}>{nomes.get(id) ?? id}</li>)}
            </ul>
          </div>
        )}

        <div className="space-y-3 rounded-lg border border-border px-4 py-3" data-testid="extras-mes">
          <div>
            <p className="text-[13px] font-semibold">Extra no mês (R$)</p>
            <p className="text-[12px] text-muted-foreground">
              Valor TOTAL do mês (não por dia), com motivo, só para {competencia}. No mês seguinte começa vazio. Não é descontado nem creditado pelo Fechamento.
            </p>
          </div>
          {extrasMes.ausente && (
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              Falta aplicar a migration 176 (extras do mês). O resto da Carga funciona normalmente.
            </div>
          )}
          {extrasMes.erroLeitura && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{extrasMes.erroLeitura}</div>
          )}
          {!extrasMes.ausente && extrasMes.extras.length > 0 && (
            <ul className="space-y-1 text-[13px]">
              {extrasMes.extras.map((e) => {
                const noLote = !lote || lote.totaisPorColaborador.some((t) => t.colaboradorId === e.colaborador_id)
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{nomes.get(e.colaborador_id) ?? e.colaborador_id}</span>
                    <span className="tabular-nums">{formatarCentavos(e.valor_centavos)}</span>
                    <span className="text-muted-foreground">— {e.motivo}</span>
                    {!noLote && <span className="text-amber-700">(fora deste lote: não entra até resolver a pendência da pessoa)</span>}
                    {podeGerenciar && !lancamentoTravado && (
                      <>
                        <button type="button" className="text-primary underline" onClick={() => editarExtra(e)}>Editar</button>
                        <button type="button" className="text-red-700 underline" disabled={extrasMes.salvando} onClick={() => void removerExtra(e.id)}>Remover</button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {podeGerenciar && !extrasMes.ausente && !lancamentoTravado && (
            <div className="grid gap-2 md:grid-cols-[2fr_1fr_3fr_auto]">
              <select
                aria-label="Pessoa do extra"
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                value={extraPessoa}
                onChange={(ev) => setExtraPessoa(ev.target.value)}
              >
                <option value="">Pessoa...</option>
                {colaboradores.filter((c) => c.vt_optante).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR')).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome_completo}</option>
                ))}
              </select>
              <input
                aria-label="Extra no mês (R$)"
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                placeholder="Valor (ex.: 15,00)"
                inputMode="decimal"
                value={extraValor}
                onChange={(ev) => setExtraValor(ev.target.value)}
              />
              <input
                aria-label="Motivo do extra"
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                placeholder="Motivo (obrigatório)"
                value={extraMotivo}
                onChange={(ev) => setExtraMotivo(ev.target.value)}
              />
              <ModuleButton size="sm" disabled={extrasMes.salvando} onClick={() => void salvarExtra()}>
                {extrasMes.salvando ? 'Gravando...' : 'Gravar extra'}
              </ModuleButton>
            </div>
          )}
          {lancamentoTravado && (
            <p className="text-[12px] text-muted-foreground">Lote confirmado: o extra não pode mais ser alterado nesta competência.</p>
          )}
          {extraMensagem && (
            <p role={extraMensagem.ok ? 'status' : 'alert'} className={`text-[13px] ${extraMensagem.ok ? 'text-emerald-800' : 'text-red-800'}`}>{extraMensagem.texto}</p>
          )}
        </div>

        {lote && (
          <>
            <div className={`rounded-lg border px-4 py-3 text-[13px] ${lote.status === 'confirmado' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge variant={lote.status === 'confirmado' ? 'success' : 'info'}>{lote.status}</StatusBadge>
                <span className="font-semibold">{lote.id}</span>
              </div>
              <p className="mt-1">
                versão {lote.versaoConteudo} · {lote.linhas.length} dia(s) · total {valor(lote.valorCentavos)}
              </p>
              <p className="mt-1 break-all text-[11px] opacity-80" title={lote.conteudoHash}>
                SHA-256: {lote.conteudoHash}
              </p>
              {lote.confirmacao && <p className="mt-1 text-[12px]">Confirmado em {lote.confirmacao.confirmadaEm}</p>}
            </div>

            {lote.pendencias.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                <p className="font-semibold">Pendências do lote</p>
                <ul className="mt-1 list-disc pl-5">
                  {lote.pendencias.map((pendencia) => (
                    <li key={pendencia.id}>
                      {pendencia.colaboradorId ? `${nomes.get(pendencia.colaboradorId) ?? pendencia.colaboradorId}: ` : ''}{pendencia.mensagem}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th
                      className="px-4 py-2.5"
                      aria-sort={sentidoNome === 'asc' ? 'ascending' : sentidoNome === 'desc' ? 'descending' : 'none'}
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase tracking-wide"
                        onClick={() => setSentidoNome(proximoSentidoNome(sentidoNome))}
                        title="Ordenar por nome (A→Z, Z→A, ordem original)"
                      >
                        Colaborador
                        {sentidoNome === 'asc' ? <ArrowUp className="size-3" /> : sentidoNome === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-50" />}
                      </button>
                    </th>
                    <th className="px-4 py-2.5">Situação</th>
                    <th className="px-4 py-2.5 text-right">Necessidade</th>
                    <th className="px-4 py-2.5 text-right">Ajuste</th>
                    <th className="px-4 py-2.5 text-right">Extra no mês</th>
                    <th className="px-4 py-2.5 text-right">Valor final</th>
                  </tr>
                </thead>
                <tbody>
                  {totaisOrdenados.map((total) => (
                    <tr key={total.colaboradorId} className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2.5 font-medium">
                        <button
                          type="button"
                          className="text-left text-primary underline-offset-2 hover:underline focus-visible:underline"
                          onClick={() => setEscalaAberta(total.colaboradorId)}
                          aria-label={`Ver a escala de ${nomes.get(total.colaboradorId) ?? total.colaboradorId}`}
                          title="Ver a escala do mês"
                        >
                          {nomes.get(total.colaboradorId) ?? total.colaboradorId}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge variant={total.status === 'completo' ? 'success' : 'warning'}>{total.status}</StatusBadge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatarCentavos(total.necessidadeCentavos)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatarCentavos(total.ajusteCentavos - (total.extraMensalCentavos ?? 0))}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" title={total.extraMensalMotivo}>
                        {total.extraMensalCentavos ? formatarCentavos(total.extraMensalCentavos) : '—'}
                        {total.extraMensalCentavos && total.necessidadeCentavos === 0 && (
                          <span className="block text-[11px] text-amber-700">só extra, sem dias de trabalho</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{valor(total.valorCentavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {lote && escalaAberta && (() => {
        const total = lote.totaisPorColaborador.find((t) => t.colaboradorId === escalaAberta)
        if (!total) return null
        return (
          <VtEscalaColaboradorDialog
            open
            onOpenChange={(aberto) => { if (!aberto) setEscalaAberta(null) }}
            colaboradorId={escalaAberta}
            nome={nomes.get(escalaAberta) ?? escalaAberta}
            competencia={lote.competencia}
            linhas={lote.linhas.filter((l) => l.colaboradorId === escalaAberta)}
            total={total}
            nomePosto={nomePostoCurto}
            marcasEmMemoria={escala?.competencia === lote.competencia ? escala.porColaborador.get(escalaAberta) ?? null : null}
          />
        )
      })()}
      {lote?.status === 'confirmado' && podeGerenciar && (
        <VtArquivoRiocardDialog open={arquivoRiocardAberto} onOpenChange={setArquivoRiocardAberto} lote={lote} nomes={nomes} />
      )}
    </ModuleCard>
  )
}
