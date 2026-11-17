import { useMemo, useState } from 'react'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { ModuleButton, ModuleCard } from '@/components/layout/ModuleShell'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { useVtLoteCarga } from '@/hooks/useVtLoteCarga'
import { RepositorioLoteCargaEmMemoria } from '@/lib/vt/confirmarLote'
import { avaliarBannerLote, type SituacaoBannerLote } from '@/lib/vt/loteConteudo'
import { formatarCentavos } from '@/lib/vt/bilhetes'
import { entradaLoteShadow, NOMES_LOTE_SHADOW } from './vtLoteShadowFixture'

function nome(colaboradorId: string) {
  return NOMES_LOTE_SHADOW[colaboradorId] ?? colaboradorId
}

function valor(centavos: number | null) {
  return centavos == null ? '—' : formatarCentavos(centavos)
}

const APARENCIA_BANNER: Record<SituacaoBannerLote, { classe: string; texto: string }> = {
  nao_salvo: { classe: 'border-red-200 bg-red-50 text-red-800', texto: 'Lote ainda não salvo' },
  divergente: { classe: 'border-red-200 bg-red-50 text-red-800', texto: 'Conteúdo divergente do salvo' },
  parcial: { classe: 'border-amber-200 bg-amber-50 text-amber-800', texto: 'Rascunho parcial — pendências impedem confirmar' },
  rascunho: { classe: 'border-blue-200 bg-blue-50 text-blue-800', texto: 'Rascunho salvo somente em memória' },
  confirmado: { classe: 'border-emerald-200 bg-emerald-50 text-emerald-800', texto: 'Lote confirmado somente em memória' },
}

function FluxoShadow({ aoReiniciar }: { aoReiniciar: () => void }) {
  const repositorio = useMemo(() => new RepositorioLoteCargaEmMemoria(), [])
  const {
    lote,
    divergencias,
    aprovacoes,
    loading,
    erro,
    construir,
    confirmar,
    aprovar,
    substituir,
  } = useVtLoteCarga(repositorio, 'shadow-usuario', () => '2026-11-15T12:00:00.000Z')
  const [comPendencia, setComPendencia] = useState(false)

  const banner = lote ? avaliarBannerLote(lote, lote) : null
  const aparencia = banner ? APARENCIA_BANNER[banner.situacao] : null
  const substituicaoConcluida = lote?.status === 'confirmado' && !!lote.loteSubstituidoId
  const divergenciasQueExigem = divergencias.filter((item) => item.exigeAprovacao)
  const todasAprovadas = divergenciasQueExigem.every((divergencia) =>
    aprovacoes.some((aprovacao) => aprovacao.colaboradorId === divergencia.colaboradorId)
  )

  return (
    <ModuleCard
      title={
        <>
          <FlaskConical className="size-4" />
          Novo lote de carga — validação shadow
        </>
      }
      description="Visível apenas em desenvolvimento. Usa pessoas fictícias e repositório em memória; nada é enviado ao Supabase."
      className="border-violet-200"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] text-violet-900">
          Exercite construir, confirmar, recalcular, aprovar divergências e substituir. Recarregar a página apaga este cenário.
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!lote && (
            <>
              <ModuleButton
                size="sm"
                disabled={loading}
                onClick={() => void construir(entradaLoteShadow({ comPendencia }))}
              >
                Construir rascunho
              </ModuleButton>
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={comPendencia}
                  disabled={loading}
                  onChange={(event) => setComPendencia(event.target.checked)}
                />
                Simular preço ausente
              </label>
            </>
          )}
          {lote?.status === 'rascunho' && !lote.loteSubstituidoId && (
            <ModuleButton
              size="sm"
              disabled={loading || lote.valorCentavos == null}
              title={lote.valorCentavos == null ? 'Resolva as pendências antes de confirmar' : undefined}
              onClick={() => void confirmar()}
            >
              Confirmar lote
            </ModuleButton>
          )}
          {lote?.status === 'confirmado' && !lote.loteSubstituidoId && (
            <ModuleButton
              size="sm"
              disabled={loading}
              onClick={() => void construir(entradaLoteShadow({ substituicao: true }))}
            >
              Recalcular com novo preço
            </ModuleButton>
          )}
          {lote?.status === 'rascunho' && lote.loteSubstituidoId && (
            <ModuleButton
              size="sm"
              disabled={loading || !todasAprovadas}
              title={!todasAprovadas ? 'Aprove cada divergência antes de substituir' : undefined}
              onClick={() => void substituir()}
            >
              Substituir lote confirmado
            </ModuleButton>
          )}
          <ModuleButton size="sm" variant="outline" disabled={loading} onClick={aoReiniciar}>
            <RotateCcw className="size-4" />
            Reiniciar cenário
          </ModuleButton>
          {loading && <span className="text-[13px] text-muted-foreground">Processando...</span>}
        </div>

        {erro && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {erro}
          </div>
        )}

        {lote && aparencia && (
          <>
            <div aria-live="polite" className={`rounded-lg border px-4 py-3 text-[13px] ${aparencia.classe}`}>
              <p className="font-semibold">
                {substituicaoConcluida ? 'Substituto confirmado somente em memória' : aparencia.texto}
              </p>
              <p className="mt-1">
                {lote.id} · versão {lote.versaoConteudo} · {lote.linhas.length} dia(s) · total {valor(lote.valorCentavos)}
              </p>
              <p className="mt-1 break-all text-[11px] opacity-80" title={lote.conteudoHash}>
                SHA-256: {lote.conteudoHash}
              </p>
            </div>

            {lote.pendencias.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                <p className="font-semibold">Pendências do lote</p>
                <ul className="mt-1 list-disc pl-5">
                  {lote.pendencias.map((pendencia) => (
                    <li key={pendencia.id}>
                      {pendencia.colaboradorId ? `${nome(pendencia.colaboradorId)}: ` : ''}{pendencia.mensagem}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5">Colaborador fictício</th>
                    <th className="px-4 py-2.5">Situação</th>
                    <th className="px-4 py-2.5 text-right">Necessidade</th>
                    <th className="px-4 py-2.5 text-right">Ajuste</th>
                    <th className="px-4 py-2.5 text-right">Valor final</th>
                  </tr>
                </thead>
                <tbody>
                  {lote.totaisPorColaborador.map((total) => (
                    <tr key={total.colaboradorId} className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2.5 font-medium">{nome(total.colaboradorId)}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge variant={total.status === 'completo' ? 'success' : 'warning'}>
                          {total.status}
                        </StatusBadge>
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

        {lote?.status === 'rascunho' && lote.loteSubstituidoId && (
          <section aria-label="Divergências da substituição" className="space-y-3">
            <div>
              <h3 className="text-[14px] font-semibold">Divergências em relação a {lote.loteSubstituidoId}</h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Aprovar uma pessoa não aprova as demais. Qualquer nova edição invalida a aprovação correspondente.
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5">Pessoa</th>
                    <th className="px-4 py-2.5">Mudança</th>
                    <th className="px-4 py-2.5 text-right">Antes</th>
                    <th className="px-4 py-2.5 text-right">Depois</th>
                    <th className="px-4 py-2.5 text-right">Diferença</th>
                    <th className="px-4 py-2.5 text-right">Revisão</th>
                  </tr>
                </thead>
                <tbody>
                  {divergencias.map((divergencia) => {
                    const aprovada = aprovacoes.some((item) => item.colaboradorId === divergencia.colaboradorId)
                    return (
                      <tr key={divergencia.colaboradorId} className="border-b border-border last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-2.5 font-medium">{nome(divergencia.colaboradorId)}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge variant={divergencia.tipo === 'inalterado' ? 'neutral' : 'info'}>
                            {divergencia.tipo}
                          </StatusBadge>
                          <div className="mt-1 text-[11px] text-muted-foreground">{divergencia.camposAlterados.join(', ') || '—'}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{valor(divergencia.anterior?.valorCentavos ?? null)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{valor(divergencia.atual?.valorCentavos ?? null)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {divergencia.diferencaValorCentavos == null
                            ? '—'
                            : `${divergencia.diferencaValorCentavos > 0 ? '+' : ''}${formatarCentavos(divergencia.diferencaValorCentavos)}`}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {!divergencia.exigeAprovacao ? (
                            <span className="text-[12px] text-muted-foreground">Não exige</span>
                          ) : aprovada ? (
                            <StatusBadge variant="success">Aprovada</StatusBadge>
                          ) : (
                            <ModuleButton size="sm" variant="outline" disabled={loading} onClick={() => void aprovar(divergencia)}>
                              Aprovar {nome(divergencia.colaboradorId)}
                            </ModuleButton>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </ModuleCard>
  )
}

export function VtLoteCargaShadow() {
  const [execucao, setExecucao] = useState(0)
  return <FluxoShadow key={execucao} aoReiniciar={() => setExecucao((atual) => atual + 1)} />
}
