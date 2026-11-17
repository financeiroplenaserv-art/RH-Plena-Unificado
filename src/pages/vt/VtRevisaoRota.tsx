import { useEffect, useMemo, useState } from 'react'
import { GitBranch, MapPinned } from 'lucide-react'
import { toast } from 'sonner'
import { ModuleButton, ModuleCard } from '@/components/layout/ModuleShell'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { adaptarRotasGoogle, removerPernaAlternativa, type AlternativaRotaGoogleVT, type RespostaGoogleRoutes } from '@/lib/vt/googleRoutes'
import { sugerirRotasGoogle } from '@/services/vtRotaApi'
import { cotarCatraca, tarifaIntegralPerna } from '@/lib/vt/cotarCatraca'
import { REGRA_DETRO_2026, REGRA_RIOCARD_TARIFAS, REGRAS_OFICIAIS_VT } from '@/lib/vt/regrasOficiais'
import { formatarCentavos } from '@/lib/vt/bilhetes'
import { agoraBrasil, formatarDataHora, hojeBrasil } from '@/lib/utils'
import { RepositorioItinerarioSupabase } from '@/lib/vt/repositorioItinerarioSupabase'
import type { FatosCartaoVT, ItinerarioVT } from '@/lib/vt/contratosTarifarios'
import type { VtItinerario } from '@/types/vt'

const CARTAO_DESCONHECIDO: FatosCartaoVT = {
  personalizacao: 'desconhecida',
  vinculadoCpf: null,
  bui: 'nao_consultado',
  bun: 'nao_consultado',
  jae: 'nao_informado',
  situacaoConsultadaEm: null,
}

export interface CenarioRevisaoRotaShadow {
  id: string
  rotulo: string
  resposta: RespostaGoogleRoutes
  origem: string
  destino: string
  municipioOrigem: string
  municipioDestino: string
  cartao: FatosCartaoVT
}

export interface ContextoRevisaoRotaReal {
  trajetoLegadoId: string
  colaboradorId: string
  departamentoId: string
  usuarioId: string
  origem: string
  destino: string
  municipioOrigem: string
  municipioDestino: string
  precisao: ItinerarioVT['precisao']
  cartao: FatosCartaoVT
  onSalvo?: () => void
}

interface VtRevisaoRotaProps {
  contextoReal?: ContextoRevisaoRotaReal
  cenariosShadow?: readonly CenarioRevisaoRotaShadow[]
}

function resumoAlternativa(alternativa: AlternativaRotaGoogleVT): string {
  return alternativa.itinerario.pernas.map((perna) => perna.linha ?? 'linha ausente').join(' → ')
}

function partidaProximaSegunda06BRT(): string {
  const agora = agoraBrasil()
  const diasAteSegunda = (8 - agora.getDay()) % 7 || 7
  const segunda = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + diasAteSegunda, 6, 0, 0)
  return new Date(segunda.getTime() - 3 * 60 * 60 * 1000).toISOString()
}

export function VtRevisaoRota({ contextoReal, cenariosShadow = [] }: VtRevisaoRotaProps) {
  const [cenarioId, setCenarioId] = useState(cenariosShadow[0]?.id ?? '')
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [pernasRemovidas, setPernasRemovidas] = useState<Record<string, number[]>>({})
  const [respostaAoVivo, setRespostaAoVivo] = useState<RespostaGoogleRoutes | null>(null)
  const [consultadoEm, setConsultadoEm] = useState('2026-11-16T12:00:00Z')
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erroGoogle, setErroGoogle] = useState<string | null>(null)
  const [decisaoRealId, setDecisaoRealId] = useState<string | null>(null)
  const [carregandoDecisao, setCarregandoDecisao] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [evidenciaSalva, setEvidenciaSalva] = useState<VtItinerario | null>(null)
  const [erroPersistencia, setErroPersistencia] = useState<string | null>(null)
  const repositorio = useMemo(() => new RepositorioItinerarioSupabase(), [])
  const cenario = cenariosShadow.find((item) => item.id === cenarioId) ?? cenariosShadow[0] ?? null

  useEffect(() => {
    if (!contextoReal) return
    let ativo = true
    setCarregandoDecisao(true)
    setErroPersistencia(null)
    setEvidenciaSalva(null)
    setSalvo(false)
    repositorio.buscarDecisaoPorTrajeto(contextoReal.trajetoLegadoId)
      .then(async (decisao) => {
        if (!ativo) return
        setDecisaoRealId(decisao?.id ?? null)
        if (!decisao) {
          setErroPersistencia('Nenhuma decisão foi encontrada para este trajeto.')
          return
        }
        if (decisao.itinerario_id) {
          const evidencia = await repositorio.buscarItinerarioPorId(decisao.itinerario_id)
          if (!ativo) return
          setEvidenciaSalva(evidencia)
          setSalvo(!!evidencia)
        }
      })
      .catch((erro) => {
        if (!ativo) return
        setErroPersistencia(erro instanceof Error ? erro.message : 'Erro ao carregar a decisão do trajeto.')
      })
      .finally(() => {
        if (ativo) setCarregandoDecisao(false)
      })
    return () => { ativo = false }
  }, [contextoReal, repositorio])

  const alternativas = useMemo(() => adaptarRotasGoogle(
    respostaAoVivo ?? (contextoReal ? {} : cenario?.resposta ?? {}),
    {
      consultadoEm,
      precisao: contextoReal?.precisao ?? 'exata',
      sentido: 'ida',
      municipioOrigem: contextoReal?.municipioOrigem ?? cenario?.municipioOrigem ?? 'desconhecida',
      municipioDestino: contextoReal?.municipioDestino ?? cenario?.municipioDestino ?? 'desconhecida',
    },
  ), [cenario, consultadoEm, contextoReal, respostaAoVivo])

  const alterarCenario = (novo: string) => {
    setCenarioId(novo)
    setSelecionadaId(null)
    setPernasRemovidas({})
    setRespostaAoVivo(null)
    setErroGoogle(null)
  }

  const consultarGoogle = async () => {
    setCarregandoGoogle(true)
    setErroGoogle(null)
    setSelecionadaId(null)
    setPernasRemovidas({})
    setSalvo(false)
    setErroPersistencia(null)
    const dataConsulta = new Date().toISOString()
    try {
      const resposta = await sugerirRotasGoogle({
        origin: contextoReal?.origem ?? cenario?.origem ?? '',
        destination: contextoReal?.destino ?? cenario?.destino ?? '',
        departureTime: partidaProximaSegunda06BRT(),
      })
      setConsultadoEm(dataConsulta)
      setRespostaAoVivo(resposta)
    } catch (erro) {
      setErroGoogle(erro instanceof Error ? erro.message : 'Não foi possível consultar o Google Routes.')
    } finally {
      setCarregandoGoogle(false)
    }
  }

  const alternativasComCotacao = useMemo(() => alternativas
    .map((original) => {
      const alternativa = (pernasRemovidas[original.id] ?? [])
        .reduce((atual, sequencia) => removerPernaAlternativa(atual, sequencia), original)
      const cotacao = cotarCatraca(
        alternativa.itinerario,
        contextoReal?.cartao ?? cenario?.cartao ?? CARTAO_DESCONHECIDO,
        REGRAS_OFICIAIS_VT,
        contextoReal ? hojeBrasil() : '2026-11-23',
      )
      return {
        ...alternativa,
        cotacao,
        totalDia: cotacao.totalEstimadoCentavos == null ? null : cotacao.totalEstimadoCentavos * 2,
      }
    })
    .sort((a, b) =>
      (a.totalDia ?? Number.MAX_SAFE_INTEGER) - (b.totalDia ?? Number.MAX_SAFE_INTEGER) || a.numero - b.numero
    ), [alternativas, cenario, contextoReal, pernasRemovidas])
  const selecionada = alternativasComCotacao.find((alternativa) => alternativa.id === selecionadaId) ?? null
  const cotacao = selecionada?.cotacao ?? null
  const totalDia = selecionada?.totalDia ?? null
  const fontesSelecionada = selecionada ? REGRAS_OFICIAIS_VT.filter((regra) =>
    (regra.id === REGRA_DETRO_2026 && selecionada.itinerario.pernas.some((perna) => perna.escopo === 'intermunicipal')) ||
    (regra.id === REGRA_RIOCARD_TARIFAS && selecionada.itinerario.pernas.some((perna) => perna.escopo === 'municipal'))
  ) : []
  const menorCusto = Math.min(...alternativasComCotacao
    .filter((alternativa) => alternativa.totalDia != null)
    .map((alternativa) => alternativa.totalDia!))

  const selecionar = (id: string) => {
    setSelecionadaId(id)
    setSalvo(false)
    setErroPersistencia(null)
  }

  const removerConducao = (alternativaId: string, sequencia: number) => {
    setPernasRemovidas((atuais) => ({
      ...atuais,
      [alternativaId]: [...(atuais[alternativaId] ?? []), sequencia],
    }))
    setSalvo(false)
    setErroPersistencia(null)
  }

  const salvar = async () => {
    if (!contextoReal || !decisaoRealId || !selecionada) return
    setSalvando(true)
    setErroPersistencia(null)
    try {
      const resultado = await repositorio.salvarEscolhaComRevisao({
        decisaoId: decisaoRealId,
        colaboradorId: contextoReal.colaboradorId,
        departamentoId: contextoReal.departamentoId,
        usuarioId: contextoReal.usuarioId,
        alternativa: selecionada,
      }, contextoReal.trajetoLegadoId, hojeBrasil())
      setDecisaoRealId(resultado.decisaoId)
      setEvidenciaSalva(resultado.evidencia)
      setSalvo(true)
      toast.success(resultado.repetido ? 'Este itinerário já estava salvo.' : 'Itinerário salvo com sucesso.')
      contextoReal.onSalvo?.()
    } catch (erro) {
      setErroPersistencia(erro instanceof Error ? erro.message : 'Erro ao salvar o itinerário.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ModuleCard
      title={
        <>
          <GitBranch className="size-4" />
          {contextoReal ? 'Revisão assistida de itinerário' : 'Revisão assistida de itinerário — shadow'}
        </>
      }
      description={contextoReal
        ? 'Escolha a rota que a pessoa realmente usa. Salvar registra a evidência, não confirma o pacote patronal.'
        : respostaAoVivo
          ? 'Resposta ao vivo da vt-rota; nenhuma decisão é persistida.'
          : 'Somente desenvolvimento. Alternativas arquivadas da Routes API; nenhuma decisão é persistida.'}
      className="border-violet-200"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {!contextoReal && cenariosShadow.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-lg px-3 py-2 text-[13px] font-semibold ${cenario?.id === item.id ? 'bg-primary text-white' : 'bg-accent text-primary'}`}
              onClick={() => alterarCenario(item.id)}
            >
              {item.rotulo}
            </button>
          ))}
          <ModuleButton size="sm" variant="outline" disabled={carregandoGoogle || carregandoDecisao} onClick={() => void consultarGoogle()}>
            {carregandoGoogle ? 'Consultando...' : 'Consultar Google agora'}
          </ModuleButton>
        </div>

        {erroGoogle && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            {erroGoogle}
          </div>
        )}

        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] text-violet-900">
          Compare o custo por dia e selecione a alternativa que a pessoa realmente usa. A mais em conta fica marcada, mas a escolha continua sendo sua.
        </div>

        {contextoReal && evidenciaSalva && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant="success" dot={false}>Itinerário salvo neste trajeto</StatusBadge>
              <span className="font-semibold">
                {evidenciaSalva.itinerario.pernas.map((perna) => perna.linha ?? 'linha ausente').join(' → ')}
              </span>
              <span className="text-muted-foreground">({evidenciaSalva.alternativa_id})</span>
            </div>
            <p className="mt-2">
              A evidência está vinculada à decisão aberta. Consulta: {formatarDataHora(evidenciaSalva.consultado_em)}.
            </p>
            <p className="mt-1 text-[11px]">SHA-256: {evidenciaSalva.evidencia_hash}</p>
          </div>
        )}

        <div className="grid gap-2 md:grid-cols-2">
          {alternativasComCotacao.map((alternativa) => (
            <button
              key={alternativa.id}
              type="button"
              className={`rounded-xl border p-4 text-left transition-colors ${selecionadaId === alternativa.id ? 'border-primary bg-accent/60' : 'border-border bg-card hover:border-primary/40'}`}
              onClick={() => selecionar(alternativa.id)}
            >
              <span className="flex items-start gap-3">
                <MapPinned className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="block text-[13px] font-semibold">Alternativa {alternativa.numero}</span>
                    {alternativa.totalDia === menorCusto && (
                      <StatusBadge variant="success" dot={false}>Mais em conta</StatusBadge>
                    )}
                  </span>
                  <span className="mt-1 block text-[13px] text-muted-foreground">{resumoAlternativa(alternativa)}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {alternativa.itinerario.pernas.length} condução(ões)
                    {alternativa.duracaoSegundos != null ? ` · ${Math.round(alternativa.duracaoSegundos / 60)} min` : ''}
                  </span>
                  <span className="mt-2 block text-[13px] font-semibold tabular-nums">
                    {alternativa.totalDia == null ? 'Custo indeterminado' : `${formatarCentavos(alternativa.totalDia)}/dia`}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>

        {!selecionada && (
          <p className="text-[13px] text-muted-foreground">
            {contextoReal && !respostaAoVivo ? 'Consulte o Google para receber alternativas.' : 'Nenhuma alternativa selecionada.'}
          </p>
        )}

        {selecionada && cotacao && (
          <div className="space-y-4">
            {selecionada.itinerario.pernas.length > 1 && (
              <p className="text-[12px] text-muted-foreground">
                Se uma condução não for necessária, use <strong>Tirar condução</strong>. O custo será recalculado e a retirada ficará registrada na evidência.
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5">Linha</th>
                    <th className="px-4 py-2.5">Operadora</th>
                    <th className="px-4 py-2.5">Escopo</th>
                    <th className="px-4 py-2.5">Embarque</th>
                    <th className="px-4 py-2.5 text-right">Tarifa integral</th>
                    <th className="px-4 py-2.5 text-right">Revisão</th>
                  </tr>
                </thead>
                <tbody>
                  {selecionada.itinerario.pernas.map((perna) => {
                    const tarifa = tarifaIntegralPerna(perna)
                    return (
                      <tr key={perna.sequencia} className="border-b border-border last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-2.5 font-medium">{perna.linha ?? '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{perna.operadora ?? '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{perna.escopo}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {perna.embarque.local}
                          <div className="text-[11px]">{formatarDataHora(perna.embarque.dataHoraPrevista)}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {tarifa == null ? 'Desconhecida' : formatarCentavos(tarifa)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <ModuleButton
                            size="sm"
                            variant="ghost"
                            disabled={salvando || selecionada.itinerario.pernas.length === 1}
                            title="Tirar esta condução da proposta"
                            onClick={() => removerConducao(selecionada.id, perna.sequencia)}
                          >
                            Tirar condução {perna.sequencia}
                          </ModuleButton>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {fontesSelecionada.length > 0 && (
              <p className="text-[12px] text-muted-foreground">
                Fontes tarifárias: {fontesSelecionada.map((regra, indice) => (
                  <span key={regra.id}>
                    {indice > 0 ? ' · ' : ''}
                    <a className="font-medium text-primary hover:underline" href={regra.fonte.url} target="_blank" rel="noreferrer">
                      {regra.fonte.titulo}
                    </a>
                    {' '}(vigente desde {regra.vigenteDesde})
                  </span>
                ))}
              </p>
            )}

            {selecionada.avisos.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                <p className="font-semibold">Dados a revisar</p>
                <ul className="mt-1 list-disc pl-5">
                  {selecionada.avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}
                </ul>
              </div>
            )}

            <div className={`rounded-lg border px-4 py-3 text-[13px] ${cotacao.status === 'confirmavel' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge variant={cotacao.status === 'confirmavel' ? 'success' : 'warning'}>
                  {cotacao.status}
                </StatusBadge>
                <span className="font-semibold">
                  {cotacao.alternativaEscolhidaId === 'tarifa_integral' ? 'Tarifa integral' : cotacao.alternativaEscolhidaId}
                </span>
              </div>
              <p className="mt-2">
                Por sentido: <strong>{cotacao.totalEstimadoCentavos == null ? 'indeterminado' : formatarCentavos(cotacao.totalEstimadoCentavos)}</strong>
                {' · '}
                Ida e volta: <strong>{totalDia == null ? 'indeterminado' : formatarCentavos(totalDia)}</strong>
              </p>
              <p className="mt-1 text-[12px]">Estimativa da catraca, não confirmação do pacote patronal.</p>
            </div>

            {cotacao.pendencias.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                <p className="font-semibold">Por que ainda não é um valor confirmável</p>
                <ul className="mt-1 list-disc pl-5">
                  {cotacao.pendencias.map((pendencia) => (
                    <li key={`${pendencia.codigo}:${pendencia.pernaSequencia}`}>{pendencia.mensagem}</li>
                  ))}
                </ul>
              </div>
            )}

            {erroPersistencia && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                {erroPersistencia}
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <ModuleButton
                type="button"
                size="sm"
                disabled={!contextoReal || !decisaoRealId || salvando || salvo}
                title={contextoReal ? 'Gravar a evidência da alternativa escolhida' : 'Disponível somente em um trajeto real'}
                onClick={contextoReal ? () => void salvar() : undefined}
              >
                {salvando ? 'Salvando...' : salvo ? 'Itinerário salvo' : 'Salvar itinerário escolhido'}
              </ModuleButton>
              <p className="mt-2 text-[12px] text-muted-foreground">
                {contextoReal
                  ? carregandoDecisao ? 'Carregando a decisão do trajeto...' : 'A evidência fica vinculada à revisão aberta; uma decisão confirmada nunca é alterada.'
                  : 'A gravação está disponível somente ao revisar um trajeto real.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </ModuleCard>
  )
}
