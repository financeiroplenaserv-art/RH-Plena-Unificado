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
import type { VtColaborador } from '@/hooks/useVt'

interface VtLoteCargaRealProps {
  competencia: string
  dias: DiaPlanejadoLoteVT[]
  colaboradores: VtColaborador[]
  nomeArquivo: string | null
  usuarioId: string
}

function valor(centavos: number | null) {
  return centavos == null ? '—' : formatarCentavos(centavos)
}

export function VtLoteCargaReal({ competencia, dias, colaboradores, nomeArquivo, usuarioId }: VtLoteCargaRealProps) {
  const repositorio = useMemo(() => new RepositorioLoteCargaSupabase(), [])
  const { lote, loading, erro, carregar, construir, confirmar } = useVtLoteCarga(repositorio, usuarioId)
  const [construindo, setConstruindo] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [erroExportacao, setErroExportacao] = useState<string | null>(null)
  const [pendentesIds, setPendentesIds] = useState<string[]>([])
  const nomes = useMemo(() => new Map(colaboradores.map((c) => [c.id, c.nome_completo])), [colaboradores])
  const optantesIds = useMemo(() => colaboradores.filter((c) => c.vt_optante).map((c) => c.id), [colaboradores])

  useEffect(() => {
    void carregar(competencia)
  }, [carregar, competencia])

  const construirLote = async () => {
    setConstruindo(true)
    try {
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
        ajustesAnteriores: [],
      })
    } finally {
      setConstruindo(false)
    }
  }

  const confirmarLote = async () => {
    const confirmado = await confirmar()
    if (confirmado) await carregar(competencia)
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
          Novo fluxo de carga — lote confirmado
        </>
      }
      description={`Competência ${competencia}. Este fluxo usa decisões e preços da migration 169 e grava o snapshot na migration 170.`}
      className="border-emerald-200"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
          Só pessoas com todos os dias e preços resolvidos entram no lote confirmado. As pendências ficam fora do snapshot e continuam visíveis para revisão.
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
        {erroExportacao && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {erroExportacao}
          </div>
        )}

        {pendentesIds.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <p className="font-semibold">Fora do lote por pendência de decisão ou preço</p>
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
