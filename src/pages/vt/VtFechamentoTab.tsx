import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, CalendarCheck, CheckCircle2, FileText } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { formatarData, formatarDataDeTimestamp } from '@/lib/utils'
import { rotuloCompetencia } from '@/lib/vt/carga'
import { formatarCentavos } from '@/lib/vt/bilhetes'
import { coberturaDoConjunto } from '@/lib/vt/escolherEspelho'
import {
  periodosDePontoDoMes,
  useVtFechamento,
  type EspelhosDoPeriodo,
  type PreviaFechamento,
} from '@/hooks/useVtFechamento'
import { InstrucoesFechamento } from '@/pages/vt/InstrucoesArquivosVt'
import type { PontoEspelhoArquivo } from '@/lib/adicionais/pontoEspelhoArquivos'

// Aba Fechamento do VT (Fase 2b — decisão da gestora, 23/10/2026): o "olhar
// para trás". Confere a carga do mês civil contra o ponto real (espelhos
// arquivados dos dois períodos de ponto 20→19, cada um em quantos pedaços
// vierem): faltou, desconta; trabalhou fora da carga (troca de plantão),
// credita no posto de referência. Gravação em vt_fechamentos (migrations
// 161/162); a carga do mês seguinte lê crédito − desconto como ajuste. Nunca
// desconta dia sem evidência no espelho ("não conferido" fica visível) e nunca
// credita sem posto de referência ("trabalhou fora da carga — sem posto").

interface VtFechamentoTabProps {
  usuarioId: string
  podeGerenciar: boolean
}

function rotuloEspelho(a: PontoEspelhoArquivo): string {
  const periodo =
    a.periodo_inicio && a.periodo_fim
      ? `${formatarData(a.periodo_inicio)} a ${formatarData(a.periodo_fim)}`
      : 'período não identificado'
  const ate = a.ponto_ate ? ` · ponto até ${formatarData(a.ponto_ate)}` : ''
  return `${periodo}${ate}`
}

function SeletorEspelhos({
  rotulo,
  periodo,
  dados,
  selecionados,
  onAlternar,
}: {
  rotulo: string
  periodo: [string, string]
  dados: EspelhosDoPeriodo | null
  selecionados: Set<string>
  onAlternar: (id: string) => void
}) {
  const arquivos = dados?.arquivos ?? []
  const escolhidos = arquivos.filter((a) => selecionados.has(a.id))
  const cobertura = coberturaDoConjunto(escolhidos, periodo[0], periodo[1])
  return (
    <div className="space-y-1.5">
      <Label>{rotulo}</Label>
      <p className="text-[12px] text-muted-foreground">
        Período de ponto: {formatarData(periodo[0])} a {formatarData(periodo[1])}
      </p>
      {arquivos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-[12px] text-muted-foreground">
          Nenhum espelho deste período foi enviado ainda. Envie em Adicionais → Importar Ponto.
        </p>
      ) : (
        <div className="space-y-1 rounded-lg border border-border px-3 py-2">
          {arquivos.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-start gap-2 py-0.5 text-[12px]">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={selecionados.has(a.id)}
                onChange={() => onAlternar(a.id)}
              />
              <span>
                <span className="font-medium text-foreground">{rotuloEspelho(a)}</span>
                <span className="block text-muted-foreground">
                  {a.nome_arquivo} · enviado em {formatarDataDeTimestamp(a.created_at)}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
      <p
        className={
          cobertura.completo ? 'text-[12px] text-emerald-700' : 'text-[12px] font-medium text-amber-700'
        }
      >
        {cobertura.completo
          ? `Cobre ${formatarData(periodo[0])} a ${formatarData(periodo[1])} — completo`
          : escolhidos.length === 0
            ? 'Nenhum arquivo marcado — o período inteiro fica sem conferência'
            : `Faltam dias: ${cobertura.faltando
                .map((f) => (f.de === f.ate ? formatarData(f.de) : `${formatarData(f.de)} a ${formatarData(f.ate)}`))
                .join(', ')}`}
      </p>
    </div>
  )
}

function ListaDias({ titulo, cor, linhas }: { titulo: string; cor: string; linhas: string[] }) {
  return (
    <div>
      <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${cor}`}>{titulo}</p>
      {linhas.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">nenhum</p>
      ) : (
        linhas.map((l) => (
          <p key={l} className="text-[12px] text-muted-foreground tabular-nums">
            {l}
          </p>
        ))
      )}
    </div>
  )
}

function LinhaPrevia({ p }: { p: PreviaFechamento }) {
  const [aberto, setAberto] = useState(false)
  const r = p.resultado
  const temDias =
    r && (r.diasDescontados > 0 || r.diasNaoConferidos > 0 || r.diasCreditados > 0 || r.diasForaSemPosto.length > 0)
  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-accent/40">
        <td className="px-4 py-2.5 font-medium text-foreground">
          {p.nome}
          {p.jaFechadoEm && (
            <span className="ml-2">
              <StatusBadge variant="success" dot={false}>
                fechado em {formatarDataDeTimestamp(p.jaFechadoEm)}
              </StatusBadge>
            </span>
          )}
          {r && r.diasForaSemPosto.length > 0 && (
            <span className="ml-2">
              <StatusBadge variant="warning" dot={false}>
                trabalhou fora da carga — sem posto, conferir
              </StatusBadge>
            </span>
          )}
        </td>
        {r ? (
          <>
            <td className="px-4 py-2.5 text-center tabular-nums">{r.diasPlanejados}</td>
            <td className="px-4 py-2.5 text-center tabular-nums">{r.diasTrabalhados}</td>
            <td className="px-4 py-2.5 text-center tabular-nums">
              {r.diasDescontados > 0 ? (
                <span className="font-semibold text-red-700">{r.diasDescontados}</span>
              ) : (
                0
              )}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">
              {r.descontoCentavos > 0 ? (
                <span className="font-semibold text-red-700">− {formatarCentavos(r.descontoCentavos)}</span>
              ) : (
                '—'
              )}
            </td>
            <td className="px-4 py-2.5 text-center tabular-nums">
              {r.diasCreditados > 0 ? (
                <span className="font-semibold text-emerald-700">{r.diasCreditados}</span>
              ) : (
                0
              )}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">
              {r.creditoCentavos > 0 ? (
                <span className="font-semibold text-emerald-700">+ {formatarCentavos(r.creditoCentavos)}</span>
              ) : (
                '—'
              )}
            </td>
            <td className="px-4 py-2.5 text-center tabular-nums">
              {r.diasNaoConferidos > 0 ? (
                <span className="font-semibold text-amber-700">{r.diasNaoConferidos}</span>
              ) : (
                0
              )}
            </td>
          </>
        ) : (
          <td colSpan={7} className="px-4 py-2.5 text-muted-foreground">
            {p.semEspelho
              ? 'Não aparece em nenhum dos espelhos — confira o CPF no cadastro'
              : 'Carga antiga, sem datas por posto — só cargas geradas após 23/10/2026 podem ser fechadas'}
          </td>
        )}
        <td className="px-4 py-2.5 text-right">
          {temDias && (
            <ModuleButton size="sm" variant="ghost" onClick={() => setAberto((v) => !v)}>
              {aberto ? 'Esconder dias' : 'Ver dias'}
            </ModuleButton>
          )}
        </td>
      </tr>
      {aberto && r && (
        <tr className="border-b border-border last:border-0 bg-muted/20">
          <td colSpan={9} className="px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <ListaDias
                titulo="Dias descontados"
                cor="text-red-700"
                linhas={r.diasDetalhe
                  .filter((d) => d.resultado === 'descontado')
                  .map((d) => `${formatarData(d.data)} · ${d.posto} · ${formatarCentavos(d.custo_dia_centavos)} — ${d.evidencia}`)}
              />
              <ListaDias
                titulo="Dias creditados (trabalhou fora da carga)"
                cor="text-emerald-700"
                linhas={r.diasDetalhe
                  .filter((d) => d.resultado === 'creditado')
                  .map((d) => `${formatarData(d.data)} · ${d.posto} · ${formatarCentavos(d.custo_dia_centavos)}`)}
              />
              <ListaDias
                titulo="Dias não conferidos (sem evidência no ponto — não descontados)"
                cor="text-amber-700"
                linhas={r.diasDetalhe
                  .filter((d) => d.resultado === 'nao_conferido')
                  .map((d) => `${formatarData(d.data)} · ${d.posto} — ${d.evidencia}`)}
              />
              <ListaDias
                titulo="Trabalhou fora da carga — sem posto, conferir (não creditado)"
                cor="text-amber-700"
                linhas={r.diasForaSemPosto.map((d) => formatarData(d))}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function VtFechamentoTab({ usuarioId, podeGerenciar }: VtFechamentoTabProps) {
  const {
    competencias,
    previas,
    loading,
    processando,
    listarCompetencias,
    carregarCargas,
    espelhosDoMes,
    processar,
    gravar,
  } = useVtFechamento()

  const [competencia, setCompetencia] = useState('')
  const [competenciasCarregadas, setCompetenciasCarregadas] = useState(false)
  const [espelhosA, setEspelhosA] = useState<EspelhosDoPeriodo | null>(null)
  const [espelhosB, setEspelhosB] = useState<EspelhosDoPeriodo | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [gravando, setGravando] = useState(false)

  useEffect(() => {
    void listarCompetencias().then(() => setCompetenciasCarregadas(true))
  }, [listarCompetencias])

  const aoTrocarCompetencia = useCallback(
    async (comp: string) => {
      setCompetencia(comp)
      setEspelhosA(null)
      setEspelhosB(null)
      setSelecionados(new Set())
      if (!comp) return
      await carregarCargas(comp)
      const dados = await espelhosDoMes(comp)
      if (!dados) return
      setEspelhosA(dados.a)
      setEspelhosB(dados.b)
      // Sugestão: o conjunto de arquivos que cobre cada período.
      setSelecionados(new Set([...dados.a.sugeridos, ...dados.b.sugeridos].map((a) => a.id)))
    },
    [carregarCargas, espelhosDoMes]
  )

  const alternar = useCallback((id: string) => {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }, [])

  const periodos = useMemo(
    () => (competencia ? periodosDePontoDoMes(competencia) : null),
    [competencia]
  )

  const arquivosEscolhidos = useMemo(() => {
    const todos = [...(espelhosA?.arquivos ?? []), ...(espelhosB?.arquivos ?? [])]
    return [...new Map(todos.filter((a) => selecionados.has(a.id)).map((a) => [a.id, a])).values()]
  }, [espelhosA, espelhosB, selecionados])

  const periodoBIncompleto = useMemo(() => {
    if (!periodos) return false
    const escolhidosB = (espelhosB?.arquivos ?? []).filter((a) => selecionados.has(a.id))
    return !coberturaDoConjunto(escolhidosB, periodos.b[0], periodos.b[1]).completo
  }, [periodos, espelhosB, selecionados])

  const totais = useMemo(
    () => ({
      planejados: previas.reduce((acc, p) => acc + (p.resultado?.diasPlanejados ?? 0), 0),
      trabalhados: previas.reduce((acc, p) => acc + (p.resultado?.diasTrabalhados ?? 0), 0),
      descontados: previas.reduce((acc, p) => acc + (p.resultado?.diasDescontados ?? 0), 0),
      naoConferidos: previas.reduce((acc, p) => acc + (p.resultado?.diasNaoConferidos ?? 0), 0),
      desconto: previas.reduce((acc, p) => acc + (p.resultado?.descontoCentavos ?? 0), 0),
      creditados: previas.reduce((acc, p) => acc + (p.resultado?.diasCreditados ?? 0), 0),
      credito: previas.reduce((acc, p) => acc + (p.resultado?.creditoCentavos ?? 0), 0),
    }),
    [previas]
  )

  const foraSemPosto = useMemo(
    () => previas.filter((p) => (p.resultado?.diasForaSemPosto.length ?? 0) > 0),
    [previas]
  )

  const processarFechamento = async () => {
    if (!competencia || arquivosEscolhidos.length === 0) return
    await processar(competencia, arquivosEscolhidos)
  }

  const gravarFechamento = async () => {
    setGravando(true)
    const ok = await gravar(competencia, usuarioId)
    setGravando(false)
    if (ok) await carregarCargas(competencia)
  }

  return (
    <div className="space-y-4">
      <ModuleCard
        title="Fechamento do mês"
        description="Depois do ponto fechado: confere cada dia da carga no espelho real — faltou, desconta; trabalhou fora da carga (troca de plantão), credita. Os dois entram na carga seguinte."
      >
        <div className="mb-4">
          <InstrucoesFechamento />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Mês da carga a fechar</Label>
            {competenciasCarregadas && competencias.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-[12px] text-muted-foreground">
                Nenhuma carga gravada ainda — grave a carga na aba Carga primeiro.
              </p>
            ) : (
              <Select value={competencia} onValueChange={(v) => void aoTrocarCompetencia(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o mês" />
                </SelectTrigger>
                <SelectContent>
                  {competencias.map((c) => (
                    <SelectItem key={c} value={c}>
                      {rotuloCompetencia(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {periodos && (
            <>
              <SeletorEspelhos
                rotulo="Espelhos do 1º período (dias 1 a 19)"
                periodo={periodos.a}
                dados={espelhosA}
                selecionados={selecionados}
                onAlternar={alternar}
              />
              <SeletorEspelhos
                rotulo="Espelhos do 2º período (dias 20 ao fim)"
                periodo={periodos.b}
                dados={espelhosB}
                selecionados={selecionados}
                onAlternar={alternar}
              />
            </>
          )}
        </div>
        {competencia && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ModuleButton
              size="sm"
              onClick={processarFechamento}
              disabled={arquivosEscolhidos.length === 0 || loading || processando}
            >
              <ArrowDownToLine className="size-4" />
              {processando ? 'Lendo os espelhos...' : 'Conferir no ponto'}
            </ModuleButton>
            {periodoBIncompleto && (
              <p className="text-[12px] text-amber-700">
                O 2º período não está completo: os dias sem espelho ficam como "não conferidos" (nunca descontados
                nem creditados).
              </p>
            )}
          </div>
        )}
        {!competencia && competencias.length > 0 && (
          <EmptyState
            icon={<CalendarCheck className="size-6" />}
            description="Escolha o mês da carga a fechar. Os espelhos que cobrem cada período já vêm marcados — confira antes de processar."
          />
        )}
      </ModuleCard>

      {previas.length > 0 && (
        <ModuleCard
          title={`Conferência de ${rotuloCompetencia(competencia)}`}
          description={`${totais.planejados} dias na carga · ${totais.trabalhados} trabalhados · ${totais.descontados} a descontar (− ${formatarCentavos(totais.desconto)}) · ${totais.creditados} a creditar (+ ${formatarCentavos(totais.credito)}) · ${totais.naoConferidos} não conferidos`}
        >
          {foraSemPosto.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              <p className="font-semibold">
                Trabalhou fora da carga — sem posto, conferir ({foraSemPosto.length})
              </p>
              <p className="mt-1">
                Estas pessoas trabalharam no ponto mas não tinham nenhum dia na carga do mês, então não há posto para
                calcular o crédito. Nada foi creditado: confira e, se for o caso, ajuste à mão.
              </p>
              <ul className="mt-1 list-disc pl-5">
                {foraSemPosto.map((p) => (
                  <li key={p.colaborador_id}>
                    {p.nome}: {p.resultado!.diasForaSemPosto.map((d) => formatarData(d)).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3 text-center">Dias na carga</th>
                  <th className="px-4 py-3 text-center">Trabalhados</th>
                  <th className="px-4 py-3 text-center">A descontar</th>
                  <th className="px-4 py-3 text-right">Desconto</th>
                  <th className="px-4 py-3 text-center">A creditar</th>
                  <th className="px-4 py-3 text-right">Crédito</th>
                  <th className="px-4 py-3 text-center">Não conferidos</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {previas.map((p) => (
                  <LinhaPrevia key={p.colaborador_id} p={p} />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 text-[13px] font-semibold">
                  <td className="px-4 py-2.5">{previas.length} colaboradores</td>
                  <td className="px-4 py-2.5 text-center tabular-nums">{totais.planejados}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums">{totais.trabalhados}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums">{totais.descontados}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">− {formatarCentavos(totais.desconto)}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums">{totais.creditados}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">+ {formatarCentavos(totais.credito)}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums">{totais.naoConferidos}</td>
                  <td className="px-4 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
          {podeGerenciar && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ModuleButton onClick={gravarFechamento} disabled={gravando || loading}>
                <CheckCircle2 className="size-4" />
                {gravando ? 'Gravando...' : 'Gravar fechamento'}
              </ModuleButton>
              <p className="text-[12px] text-muted-foreground">
                Desconto e crédito entram como ajuste na carga do mês seguinte. Refazer o fechamento do mesmo mês
                substitui o anterior, nunca duplica.
              </p>
            </div>
          )}
        </ModuleCard>
      )}

      {competencia && previas.length === 0 && !loading && (
        <ModuleCard>
          <EmptyState
            icon={<FileText className="size-6" />}
            description="Confira os espelhos marcados e clique em Conferir no ponto."
          />
        </ModuleCard>
      )}
    </div>
  )
}
