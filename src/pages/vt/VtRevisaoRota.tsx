import { useEffect, useMemo, useState } from 'react'
import { GitBranch, MapPinned } from 'lucide-react'
import { toast } from 'sonner'
import { ModuleButton, ModuleCard } from '@/components/layout/ModuleShell'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { Input } from '@/components/ui/input'
import { adaptarRotasGoogle, removerPernaAlternativa, type AlternativaRotaGoogleVT, type RespostaGoogleRoutes } from '@/lib/vt/googleRoutes'
import { sugerirRotasGoogle } from '@/services/vtRotaApi'
import { formatarCentavos } from '@/lib/vt/bilhetes'
import { formatarDataHora, hojeBrasil } from '@/lib/utils'
import { partidaProximaSegundaBRT } from '@/lib/vt/partidaRota'
import { RepositorioItinerarioSupabase } from '@/lib/vt/repositorioItinerarioSupabase'
import { pernaMotorDeItinerario } from '@/lib/vt/motor/adaptadorItinerario'
import { precificarPerna } from '@/lib/vt/motor/precificarPerna'
import {
  calcularAlternativaSentido,
  calcularDiaIdaVolta,
  combinarIdaVolta,
  menorCustoSentido,
  MOTOR_COTACAO_ID,
  ordenarPorCusto,
  type AlternativaComMotor,
} from '@/lib/vt/motor/idaVolta'
import type { FatosCartaoMotor, PassoExplicacao, PendenciaMotor, StatusMotor } from '@/lib/vt/motor/tipos'
import type { ItinerarioVT } from '@/lib/vt/contratosTarifarios'
import type { VtItinerario } from '@/types/vt'

export interface ContextoRevisaoRotaReal {
  trajetoLegadoId: string
  colaboradorId: string
  departamentoId: string
  usuarioId: string
  /** Endereço de casa (origem da IDA; destino da VOLTA). */
  origem: string
  /** Endereço do posto (destino da IDA; origem da VOLTA). */
  destino: string
  municipioOrigem: string
  municipioDestino: string
  precisao: ItinerarioVT['precisao']
  /** Fatos reais do cartão (colaboradores.vt_bu_situacao / vt_bu_consultado_em). */
  cartao: FatosCartaoMotor
  onSalvo?: () => void
}

interface VtRevisaoRotaProps {
  contextoReal: ContextoRevisaoRotaReal
}

type Sentido = 'ida' | 'volta'

function resumoPernas(pernas: ItinerarioVT['pernas']): string {
  return pernas.map((perna) => perna.linha ?? 'linha ausente').join(' → ')
}

const ROTULO_STATUS: Record<StatusMotor, string> = {
  confirmado: 'Confirmado',
  pendente: 'Pendente',
  indeterminado: 'Indeterminado',
}

function varianteStatus(status: StatusMotor): 'success' | 'warning' | 'danger' {
  return status === 'confirmado' ? 'success' : status === 'pendente' ? 'warning' : 'danger'
}

function ListaPendencias({ pendencias, titulo }: { pendencias: readonly PendenciaMotor[]; titulo: string }) {
  if (pendencias.length === 0) return null
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
      <p className="font-semibold">{titulo}</p>
      <ul className="mt-1 list-disc pl-5">
        {pendencias.map((p) => (
          <li key={`${p.codigo}:${p.mensagem}`}>
            {p.mensagem} <span className="text-[11px] text-amber-700">({p.regra})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Explicacao({ passos }: { passos: readonly PassoExplicacao[] }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-[13px]">
      <p className="font-semibold">Como o valor foi calculado</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        {passos.map((passo, indice) => (
          <li key={`${indice}:${passo.texto}`}>
            {passo.texto} <span className="text-[11px] text-muted-foreground">({passo.regra})</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

interface SecaoSentidoProps {
  sentido: Sentido
  titulo: string
  descricao: string
  hora: string
  onHora: (valor: string) => void
  carregando: boolean
  bloqueado: boolean
  erro: string | null
  consultado: boolean
  alternativas: AlternativaComMotor[]
  selecionadaId: string | null
  onSelecionar: (id: string) => void
  onConsultar: () => void
  onRemoverConducao: (alternativaId: string, sequencia: number) => void
  dataServico: string
  salvando: boolean
}

function SecaoSentido(props: SecaoSentidoProps) {
  const { sentido, alternativas, selecionadaId } = props
  const menor = menorCustoSentido(alternativas)
  const selecionada = alternativas.find((x) => x.alternativa.id === selecionadaId) ?? null
  const rotuloHora = sentido === 'ida' ? 'Saída de casa' : 'Saída do posto'

  return (
    <section className="space-y-3 rounded-xl border border-border p-4" aria-label={props.titulo}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold">{props.titulo}</h3>
          <p className="text-[12px] text-muted-foreground">{props.descricao}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[12px] text-muted-foreground">
            {rotuloHora}
            <Input
              aria-label={`${rotuloHora} (${sentido})`}
              className="mt-1 h-8 w-24 tabular-nums"
              value={props.hora}
              onChange={(e) => props.onHora(e.target.value)}
              placeholder="HH:MM"
            />
          </label>
          <ModuleButton size="sm" variant="outline" disabled={props.carregando || props.bloqueado} onClick={props.onConsultar}>
            {props.carregando ? 'Consultando...' : sentido === 'ida' ? 'Consultar ida no Google' : 'Consultar volta no Google'}
          </ModuleButton>
        </div>
      </div>

      {props.erro && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {props.erro}
        </div>
      )}

      {!props.consultado && !props.erro && (
        <p className="text-[13px] text-muted-foreground">
          {sentido === 'ida' ? 'Consulte o Google para receber alternativas de ida.' : 'Consulte o Google para receber alternativas de volta. A volta nunca é presumida igual à ida.'}
        </p>
      )}
      {props.consultado && alternativas.length === 0 && (
        <p className="text-[13px] text-muted-foreground">O Google não devolveu alternativas de transporte público.</p>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        {alternativas.map(({ alternativa, resultado }) => (
          <button
            key={alternativa.id}
            type="button"
            aria-label={`${sentido === 'ida' ? 'Ida' : 'Volta'} — alternativa ${alternativa.numero}`}
            aria-pressed={selecionadaId === alternativa.id}
            className={`rounded-xl border p-4 text-left transition-colors ${selecionadaId === alternativa.id ? 'border-primary bg-accent/60' : 'border-border bg-card hover:border-primary/40'}`}
            onClick={() => props.onSelecionar(alternativa.id)}
          >
            <span className="flex items-start gap-3">
              <MapPinned className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="block text-[13px] font-semibold">Alternativa {alternativa.numero}</span>
                  {resultado.valorCentavos !== null && resultado.valorCentavos === menor && (
                    <StatusBadge variant="success" dot={false}>Mais em conta</StatusBadge>
                  )}
                  <StatusBadge variant={varianteStatus(resultado.status)} dot={false}>{ROTULO_STATUS[resultado.status]}</StatusBadge>
                </span>
                <span className="mt-1 block text-[13px] text-muted-foreground">{resumoPernas(alternativa.itinerario.pernas)}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {alternativa.itinerario.pernas.length} condução(ões)
                  {alternativa.duracaoSegundos != null ? ` · ${Math.round(alternativa.duracaoSegundos / 60)} min` : ''}
                </span>
                <span className="mt-2 block text-[13px] font-semibold tabular-nums">
                  {resultado.valorCentavos === null ? 'Valor indeterminado' : `${formatarCentavos(resultado.valorCentavos)} por sentido`}
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>

      {selecionada && (
        <div className="space-y-3">
          {selecionada.alternativa.itinerario.pernas.length > 1 && (
            <p className="text-[12px] text-muted-foreground">
              Se uma condução não for necessária, use <strong>Tirar condução</strong>. O valor será recalculado e a retirada ficará registrada na evidência.
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
                {selecionada.alternativa.itinerario.pernas.map((perna, indice) => {
                  const tarifa = precificarPerna(pernaMotorDeItinerario(perna).perna, indice, props.dataServico).valorCentavos
                  return (
                    <tr key={perna.sequencia} className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2.5 font-medium">{perna.linha ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{perna.operadora ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{perna.escopo}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {perna.embarque.local}
                        <div className="text-[11px] tabular-nums">{formatarDataHora(perna.embarque.dataHoraPrevista)}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {tarifa == null ? 'Indeterminada' : formatarCentavos(tarifa)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ModuleButton
                          size="sm"
                          variant="ghost"
                          disabled={props.salvando || selecionada.alternativa.itinerario.pernas.length === 1}
                          title="Tirar esta condução da proposta"
                          onClick={() => props.onRemoverConducao(selecionada.alternativa.id, perna.sequencia)}
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

          {(selecionada.alternativa.avisos.length > 0 || selecionada.avisosMotor.length > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              <p className="font-semibold">Dados a revisar</p>
              <ul className="mt-1 list-disc pl-5">
                {[...selecionada.alternativa.avisos, ...selecionada.avisosMotor].map((aviso) => <li key={aviso}>{aviso}</li>)}
              </ul>
            </div>
          )}

          <ListaPendencias
            pendencias={selecionada.resultado.pendencias}
            titulo={sentido === 'ida' ? 'Pendências da ida' : 'Pendências da volta'}
          />
          <Explicacao passos={selecionada.resultado.explicacao} />
        </div>
      )}
    </section>
  )
}

/** Adapta a resposta do Google de UM sentido e calcula cada alternativa pelo motor. */
function alternativasDoSentido(
  sentido: Sentido,
  resposta: RespostaGoogleRoutes | null,
  consultadoEm: string,
  contexto: ContextoRevisaoRotaReal,
  removidas: Record<string, number[]>,
  dataServico: string,
): AlternativaComMotor[] {
  const brutas = adaptarRotasGoogle(resposta ?? {}, {
    consultadoEm,
    precisao: contexto.precisao,
    sentido,
    municipioOrigem: sentido === 'ida' ? contexto.municipioOrigem : contexto.municipioDestino,
    municipioDestino: sentido === 'ida' ? contexto.municipioDestino : contexto.municipioOrigem,
  })
  return ordenarPorCusto(brutas.map((original) => {
    const alternativa = (removidas[`${sentido}:${original.id}`] ?? [])
      .reduce<AlternativaRotaGoogleVT>((atual, sequencia) => removerPernaAlternativa(atual, sequencia), original)
    return calcularAlternativaSentido(alternativa, contexto.cartao, dataServico)
  }))
}

export function VtRevisaoRota({ contextoReal }: VtRevisaoRotaProps) {
  const [horaIda, setHoraIda] = useState('06:00')
  const [horaVolta, setHoraVolta] = useState('18:00')
  const [respostas, setRespostas] = useState<Record<Sentido, RespostaGoogleRoutes | null>>({ ida: null, volta: null })
  const [consultadoEm, setConsultadoEm] = useState<Record<Sentido, string>>({ ida: '', volta: '' })
  const [carregando, setCarregando] = useState<Record<Sentido, boolean>>({ ida: false, volta: false })
  const [erros, setErros] = useState<Record<Sentido, string | null>>({ ida: null, volta: null })
  const [selecionadas, setSelecionadas] = useState<Record<Sentido, string | null>>({ ida: null, volta: null })
  const [pernasRemovidas, setPernasRemovidas] = useState<Record<string, number[]>>({})
  const [decisaoRealId, setDecisaoRealId] = useState<string | null>(null)
  const [decisaoRealStatus, setDecisaoRealStatus] = useState<'sugerida' | 'confirmada' | 'indeterminada' | null>(null)
  const [carregandoDecisao, setCarregandoDecisao] = useState(false)
  const [confirmandoDecisao, setConfirmandoDecisao] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [evidenciaSalva, setEvidenciaSalva] = useState<VtItinerario | null>(null)
  const [erroPersistencia, setErroPersistencia] = useState<string | null>(null)
  const repositorio = useMemo(() => new RepositorioItinerarioSupabase(), [])
  const dataServico = hojeBrasil()

  useEffect(() => {
    let ativo = true
    setCarregandoDecisao(true)
    setErroPersistencia(null)
    setEvidenciaSalva(null)
    setSalvo(false)
    repositorio.buscarDecisaoPorTrajeto(contextoReal.trajetoLegadoId)
      .then(async (decisao) => {
        if (!ativo) return
        setDecisaoRealId(decisao?.id ?? null)
        setDecisaoRealStatus(decisao?.status ?? null)
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

  const alternativasIda = useMemo(
    () => alternativasDoSentido('ida', respostas.ida, consultadoEm.ida, contextoReal, pernasRemovidas, dataServico),
    [respostas.ida, consultadoEm.ida, contextoReal, pernasRemovidas, dataServico],
  )
  const alternativasVolta = useMemo(
    () => alternativasDoSentido('volta', respostas.volta, consultadoEm.volta, contextoReal, pernasRemovidas, dataServico),
    [respostas.volta, consultadoEm.volta, contextoReal, pernasRemovidas, dataServico],
  )

  const ida = alternativasIda.find((x) => x.alternativa.id === selecionadas.ida) ?? null
  const volta = alternativasVolta.find((x) => x.alternativa.id === selecionadas.volta) ?? null
  const dia = useMemo(
    () => (ida && volta ? calcularDiaIdaVolta(ida.alternativa, volta.alternativa, contextoReal.cartao, dataServico) : null),
    [ida, volta, contextoReal.cartao, dataServico],
  )

  const motivoBloqueio = (() => {
    if (!ida || !volta) return 'Escolha uma alternativa de ida e uma de volta.'
    if (!dia) return 'Escolha uma alternativa de ida e uma de volta.'
    if (dia.status === 'indeterminado') return 'Valor do dia indeterminado: resolva as pendências antes de salvar.'
    if (dia.status === 'pendente') return 'Valor do dia pendente: confira as pendências abaixo antes de salvar.'
    if (dia.valorCentavos === null || dia.valorCentavos <= 0) return 'O valor do dia precisa ser positivo.'
    if (!decisaoRealId) return 'Nenhuma decisão foi encontrada para este trajeto.'
    return null
  })()

  const limparSalvo = () => {
    setSalvo(false)
    setErroPersistencia(null)
  }

  const consultar = async (sentido: Sentido) => {
    setErros((atual) => ({ ...atual, [sentido]: null }))
    let partida: string
    try {
      partida = partidaProximaSegundaBRT(sentido === 'ida' ? horaIda : horaVolta)
    } catch (erro) {
      setErros((atual) => ({ ...atual, [sentido]: erro instanceof Error ? erro.message : 'Horário inválido.' }))
      return
    }
    setCarregando((atual) => ({ ...atual, [sentido]: true }))
    setSelecionadas((atual) => ({ ...atual, [sentido]: null }))
    setPernasRemovidas((atuais) => Object.fromEntries(Object.entries(atuais).filter(([chave]) => !chave.startsWith(`${sentido}:`))))
    limparSalvo()
    const dataConsulta = new Date().toISOString()
    try {
      const resposta = await sugerirRotasGoogle({
        origin: sentido === 'ida' ? contextoReal.origem : contextoReal.destino,
        destination: sentido === 'ida' ? contextoReal.destino : contextoReal.origem,
        departureTime: partida,
      })
      setConsultadoEm((atual) => ({ ...atual, [sentido]: dataConsulta }))
      setRespostas((atual) => ({ ...atual, [sentido]: resposta }))
    } catch (erro) {
      setErros((atual) => ({ ...atual, [sentido]: erro instanceof Error ? erro.message : 'Não foi possível consultar o Google Routes.' }))
    } finally {
      setCarregando((atual) => ({ ...atual, [sentido]: false }))
    }
  }

  const selecionar = (sentido: Sentido, id: string) => {
    setSelecionadas((atual) => ({ ...atual, [sentido]: id }))
    limparSalvo()
  }

  const removerConducao = (sentido: Sentido, alternativaId: string, sequencia: number) => {
    const chave = `${sentido}:${alternativaId}`
    setPernasRemovidas((atuais) => ({ ...atuais, [chave]: [...(atuais[chave] ?? []), sequencia] }))
    limparSalvo()
  }

  const salvar = async () => {
    if (!decisaoRealId || !ida || !volta || !dia || motivoBloqueio) return
    setSalvando(true)
    setErroPersistencia(null)
    try {
      const combinada = combinarIdaVolta(ida.alternativa, volta.alternativa, dia, contextoReal.cartao, dataServico)
      const resultado = await repositorio.salvarEscolhaComRevisao({
        decisaoId: decisaoRealId,
        colaboradorId: contextoReal.colaboradorId,
        departamentoId: contextoReal.departamentoId,
        usuarioId: contextoReal.usuarioId,
        alternativa: combinada,
        cotacaoId: MOTOR_COTACAO_ID,
        // O repositório só aceita valor "confirmável"; o motor só chega aqui com status 'confirmado'.
        cotacaoStatus: dia.status === 'confirmado' ? 'confirmavel' : 'parcial',
        custoDiarioCentavos: dia.valorCentavos,
      }, contextoReal.trajetoLegadoId, dataServico)
      setDecisaoRealId(resultado.decisaoId)
      setDecisaoRealStatus((atual) => atual === 'confirmada' ? atual : 'sugerida')
      setEvidenciaSalva(resultado.evidencia)
      setSalvo(true)
      toast.success(resultado.repetido ? 'Este itinerário já estava salvo.' : 'Itinerário de ida e volta salvo com sucesso.')
      contextoReal.onSalvo?.()
    } catch (erro) {
      setErroPersistencia(erro instanceof Error ? erro.message : 'Erro ao salvar o itinerário.')
    } finally {
      setSalvando(false)
    }
  }

  const confirmarDecisao = async () => {
    if (!decisaoRealId) return
    setConfirmandoDecisao(true)
    setErroPersistencia(null)
    try {
      const decisao = await repositorio.confirmarDecisaoAberta(
        decisaoRealId,
        contextoReal.usuarioId,
        new Date().toISOString(),
      )
      setDecisaoRealStatus(decisao.status)
      toast.success('Trajeto e preço confirmados nesta revisão.')
    } catch (erro) {
      setErroPersistencia(erro instanceof Error ? erro.message : 'Erro ao confirmar o trajeto e o preço.')
    } finally {
      setConfirmandoDecisao(false)
    }
  }

  const situacaoCartao = contextoReal.cartao.situacaoBu
    ? `${contextoReal.cartao.situacaoBu}${contextoReal.cartao.consultadoEm ? ` (consulta de ${contextoReal.cartao.consultadoEm})` : ''}`
    : 'não consultado na Riocard'
  const pernasSalvas = evidenciaSalva?.itinerario.pernas ?? []
  const salvasIda = pernasSalvas.filter((p) => p.sentido !== 'volta')
  const salvasVolta = pernasSalvas.filter((p) => p.sentido === 'volta')
  const calculoSalvo = evidenciaSalva?.itinerario.calculoMotor ?? null

  return (
    <ModuleCard
      title={
        <>
          <GitBranch className="size-4" />
          Revisão assistida de itinerário
        </>
      }
      description="Escolha a rota de IDA e a de VOLTA que a pessoa realmente usa. O valor sai do motor pela regra tarifária."
      className="border-violet-200"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] text-violet-900">
          Compare o valor de cada alternativa e selecione a que a pessoa realmente usa, na ida e na volta. A mais em conta fica marcada, mas a escolha continua sendo sua.
          <span className="mt-1 block">Situação do Bilhete Único: <strong>{situacaoCartao}</strong>.</span>
        </div>

        {evidenciaSalva && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge variant="success" dot={false}>Itinerário salvo neste trajeto</StatusBadge>
              <span className="text-muted-foreground">({evidenciaSalva.alternativa_id})</span>
            </div>
            <p className="mt-2">
              Ida: <span className="font-semibold">{resumoPernas(salvasIda) || '—'}</span>
              {' · '}
              Volta: <span className="font-semibold">{salvasVolta.length ? resumoPernas(salvasVolta) : 'não registrada nesta evidência'}</span>
            </p>
            {calculoSalvo && calculoSalvo.valorDiaCentavos !== null && (
              <p className="mt-1">Valor do dia pelo motor: <strong>{formatarCentavos(calculoSalvo.valorDiaCentavos)}</strong></p>
            )}
            <p className="mt-1">
              A evidência está vinculada à decisão aberta. Consulta: {formatarDataHora(evidenciaSalva.consultado_em)}.
            </p>
            <p className="mt-1 text-[11px]">SHA-256: {evidenciaSalva.evidencia_hash}</p>
          </div>
        )}

        <SecaoSentido
          sentido="ida"
          titulo="Ida (casa → posto)"
          descricao={`${contextoReal.origem} → ${contextoReal.destino}`}
          hora={horaIda}
          onHora={setHoraIda}
          carregando={carregando.ida}
          bloqueado={carregandoDecisao}
          erro={erros.ida}
          consultado={respostas.ida !== null}
          alternativas={alternativasIda}
          selecionadaId={selecionadas.ida}
          onSelecionar={(id) => selecionar('ida', id)}
          onConsultar={() => void consultar('ida')}
          onRemoverConducao={(id, seq) => removerConducao('ida', id, seq)}
          dataServico={dataServico}
          salvando={salvando}
        />

        <SecaoSentido
          sentido="volta"
          titulo="Volta (posto → casa)"
          descricao={`${contextoReal.destino} → ${contextoReal.origem}`}
          hora={horaVolta}
          onHora={setHoraVolta}
          carregando={carregando.volta}
          bloqueado={carregandoDecisao}
          erro={erros.volta}
          consultado={respostas.volta !== null}
          alternativas={alternativasVolta}
          selecionadaId={selecionadas.volta}
          onSelecionar={(id) => selecionar('volta', id)}
          onConsultar={() => void consultar('volta')}
          onRemoverConducao={(id, seq) => removerConducao('volta', id, seq)}
          dataServico={dataServico}
          salvando={salvando}
        />

        <section aria-label="Valor do dia" className="space-y-3">
          {dia && (
            <div className={`rounded-lg border px-4 py-3 text-[13px] ${dia.status === 'confirmado' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge variant={varianteStatus(dia.status)}>{ROTULO_STATUS[dia.status]}</StatusBadge>
                <span className="font-semibold">Valor do dia (ida + volta)</span>
              </div>
              <p className="mt-2 tabular-nums">
                Ida: <strong>{dia.ida.valorCentavos === null ? 'indeterminado' : formatarCentavos(dia.ida.valorCentavos)}</strong>
                {' + '}
                Volta: <strong>{dia.volta.valorCentavos === null ? 'indeterminado' : formatarCentavos(dia.volta.valorCentavos)}</strong>
                {' = '}
                Total do dia: <strong>{dia.valorCentavos === null ? 'indeterminado' : formatarCentavos(dia.valorCentavos)}</strong>
              </p>
            </div>
          )}
          {dia && <ListaPendencias pendencias={dia.pendencias} titulo="Por que o valor do dia ainda não está confirmado" />}

          {erroPersistencia && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
              {erroPersistencia}
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <ModuleButton
              type="button"
              size="sm"
              disabled={salvando || salvo || carregandoDecisao || motivoBloqueio !== null}
              title="Gravar a evidência da ida e da volta escolhidas e o valor do dia"
              onClick={() => void salvar()}
            >
              {salvando ? 'Salvando...' : salvo ? 'Itinerário salvo' : 'Salvar itinerário escolhido'}
            </ModuleButton>
            {salvo && decisaoRealStatus !== 'confirmada' && (
              <ModuleButton
                type="button"
                size="sm"
                className="ml-2"
                disabled={confirmandoDecisao}
                onClick={() => void confirmarDecisao()}
              >
                {confirmandoDecisao ? 'Confirmando...' : 'Confirmar trajeto e preço'}
              </ModuleButton>
            )}
            {decisaoRealStatus === 'confirmada' && (
              <span className="ml-2 text-[12px] font-semibold text-emerald-700">Trajeto e preço confirmados</span>
            )}
            {!salvo && motivoBloqueio && (
              <p className="mt-2 text-[12px] font-medium text-amber-800" data-testid="motivo-bloqueio">{motivoBloqueio}</p>
            )}
            <p className="mt-2 text-[12px] text-muted-foreground">
              {carregandoDecisao
                ? 'Carregando a decisão do trajeto...'
                : 'A evidência fica vinculada à revisão aberta; uma decisão confirmada nunca é alterada.'}
            </p>
          </div>
        </section>
      </div>
    </ModuleCard>
  )
}
