import { useEffect, useMemo, useState } from 'react'
import { Database, FileSpreadsheet, RefreshCw } from 'lucide-react'
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
import { ajustesDoFechamentoAnterior, cargasDoLoteConfirmado, type FechamentoParaAjuste } from '@/lib/vt/pontesLote'
import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'

interface VtLoteCargaRealProps {
  competencia: string
  dias: DiaPlanejadoLoteVT[]
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
}

function valor(centavos: number | null) {
  return centavos == null ? '—' : formatarCentavos(centavos)
}

export function VtLoteCargaReal({ competencia, dias, colaboradores, nomeArquivo, usuarioId, departamentos, bloqueios }: VtLoteCargaRealProps) {
  const repositorio = useMemo(() => new RepositorioLoteCargaSupabase(), [])
  const { lote, loading, erro, carregar, construir, confirmar } = useVtLoteCarga(repositorio, usuarioId)
  const [construindo, setConstruindo] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [erroExportacao, setErroExportacao] = useState<string | null>(null)
  const [pendentesIds, setPendentesIds] = useState<string[]>([])
  const [gravandoFechamento, setGravandoFechamento] = useState(false)
  const [situacaoFechamento, setSituacaoFechamento] = useState<{ ok: boolean; texto: string } | null>(null)
  const nomes = useMemo(() => new Map(colaboradores.map((c) => [c.id, c.nome_completo])), [colaboradores])
  const optantesIds = useMemo(
    () => colaboradores.filter((c) => c.vt_optante && !bloqueios?.has(c.id)).map((c) => c.id),
    [colaboradores, bloqueios],
  )

  useEffect(() => {
    void carregar(competencia)
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

  const construirLote = async () => {
    setConstruindo(true)
    try {
      const ajustesAnteriores = await lerAjustesAnteriores()
      const dominio = await carregarDominioLote()
      const selecao = selecionarProntosLote({
        dias,
        colaboradorIds: optantesIds,
        ...dominio,
      })
      setPendentesIds(selecao.pendentesIds)
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
      setConstruindo(false)
    }
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
      description={`Competência ${competencia}. O valor de cada dia vem da rota confirmada da pessoa para o posto daquele dia.`}
      className="border-emerald-200"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
          1) Construir o rascunho · 2) Confirmar o lote · 3) Baixar o Excel. Só entra quem tem rota confirmada para todos os postos do mês; quem falta aparece abaixo e deve ser resolvido na aba Rotas a confirmar. O desconto ou crédito do fechamento do mês anterior entra como ajuste.
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lote?.status !== 'confirmado' && (
            <ModuleButton size="sm" disabled={loading || construindo} onClick={() => void construirLote()}>
              <RefreshCw className="size-4" />
              {construindo ? 'Construindo...' : lote ? 'Recalcular rascunho' : 'Construir rascunho'}
            </ModuleButton>
          )}
          {lote?.status === 'rascunho' && (
            <ModuleButton size="sm" disabled={loading || lote.valorCentavos == null} onClick={() => void confirmarLote()}>
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
          {loading && <span className="text-[13px] text-muted-foreground">Processando...</span>}
        </div>

        {erro && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {erro}
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
                    <th className="px-4 py-2.5">Colaborador</th>
                    <th className="px-4 py-2.5">Situação</th>
                    <th className="px-4 py-2.5 text-right">Necessidade</th>
                    <th className="px-4 py-2.5 text-right">Ajuste</th>
                    <th className="px-4 py-2.5 text-right">Valor final</th>
                  </tr>
                </thead>
                <tbody>
                  {lote.totaisPorColaborador.map((total) => (
                    <tr key={total.colaboradorId} className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2.5 font-medium">{nomes.get(total.colaboradorId) ?? total.colaboradorId}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge variant={total.status === 'completo' ? 'success' : 'warning'}>{total.status}</StatusBadge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatarCentavos(total.necessidadeCentavos)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatarCentavos(total.ajusteCentavos)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{valor(total.valorCentavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </ModuleCard>
  )
}
