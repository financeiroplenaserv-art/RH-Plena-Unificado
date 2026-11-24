import { avisoRegularizarCartao, politicaDoCartao } from '@/lib/vt/motor/cartao'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { GitBranch, MapPinned } from 'lucide-react'
import { toast } from 'sonner'
import { ModuleButton, ModuleCard } from '@/components/layout/ModuleShell'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { Input } from '@/components/ui/input'
import { adaptarRotasGoogle, definirSecaoPerna, removerPernaAlternativa, rotuloOperadoraExibicao, type AlternativaRotaGoogleVT, type RespostaGoogleRoutes } from '@/lib/vt/googleRoutes'
import { sugerirRotasGoogle } from '@/services/vtRotaApi'
import { buscarTurnosDoPosto } from '@/lib/vt/turnosDoPosto'
import { descreverAlternativo, descreverHorarioDoTurno, escolherHorarioDoTurno, type HorarioReferenciaTurno } from '@/lib/vt/horarioTurno'
import type { DepartamentoFuzzy } from '@/lib/departamentos'
import { formatarCentavos } from '@/lib/vt/bilhetes'
import { formatarDataHora, hojeBrasil } from '@/lib/utils'
import { chegadaComFolgaBRT, FOLGA_CHEGADA_MINUTOS, horaMinutoValida, mascararHoraMinuto, partidaProximaSegundaBRT } from '@/lib/vt/partidaRota'
import { encontrarAlternativaInversa } from '@/lib/vt/rotaInversa'
import { linhasDProibidas, motivosRevisaoHumana, TEXTO_LINHA_D_PROIBIDA } from '@/lib/vt/revisaoHumana'
import { agruparAlternativasIguais, menorValorComDestaque, textoSemelhantes, type GrupoAlternativas } from '@/lib/vt/agruparAlternativas'
import { RepositorioItinerarioSupabase } from '@/lib/vt/repositorioItinerarioSupabase'
import { pernaMotorDeItinerario } from '@/lib/vt/motor/adaptadorItinerario'
import { precificarPerna } from '@/lib/vt/motor/precificarPerna'
import { normalizarLinha, opcoesSecaoDetro } from '@/lib/vt/motor/tarifas'
import {
  calcularAlternativaSentido,
  calcularDiaIdaVolta,
  combinarIdaVolta,
  MOTOR_COTACAO_ID,
  ordenarPorCusto,
  type AlternativaComMotor,
} from '@/lib/vt/motor/idaVolta'
import type { FatosCartaoMotor, PassoExplicacao, PendenciaMotor, StatusMotor } from '@/lib/vt/motor/tipos'
import type { HorarioReferenciaVT, ItinerarioVT } from '@/lib/vt/contratosTarifarios'
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
  /** Departamentos (sem filtro) para achar o turno da pessoa NESTE posto; sem isso a revisão não busca o turno. */
  departamentosApoio?: DepartamentoFuzzy[]
  /** Fatos reais do cartão (colaboradores.vt_bu_situacao / vt_bu_consultado_em). */
  cartao: FatosCartaoMotor
  onSalvo?: () => void
  /** Fecha o diálogo que hospeda a revisão (botão Fechar do rodapé fixo). */
  onFechar?: () => void
  /** Fila "Rotas a confirmar": abre a próxima rota pendente (some quando não há próxima). */
  onProxima?: () => void
  /** Chamado ao confirmar trajeto e preço (a fila recarrega). */
  onConfirmado?: () => void
}

interface VtRevisaoRotaProps {
  contextoReal: ContextoRevisaoRotaReal
}

type Sentido = 'ida' | 'volta'

/** Trecho DETRO escolhido pelo RH, por condução (chave `${sentido}:${alternativaId}:${sequencia}`). */
type EscolhaSecao = { secao: number; rotulo: string }
type SecoesEscolhidas = Record<string, EscolhaSecao>

const ehPernaDetro = (perna: ItinerarioVT['pernas'][number]) =>
  perna.escopo === 'intermunicipal' && perna.sistemaTarifario === 'detro'

/** Aplica nas pernas as seções escolhidas; sem escolha explícita, a volta pré-marcada herda a da ida (mesma linha). */
function aplicarSecoes(
  alternativa: AlternativaRotaGoogleVT,
  sentido: Sentido,
  secoes: SecoesEscolhidas,
  herdadas: Record<string, EscolhaSecao>,
): AlternativaRotaGoogleVT {
  return alternativa.itinerario.pernas.reduce((atual, perna) => {
    if (!ehPernaDetro(perna)) return atual
    const opcoes = opcoesSecaoDetro(perna.linha)
    if (opcoes.length === 0) return atual
    const escolha = secoes[`${sentido}:${alternativa.id}:${perna.sequencia}`] ?? herdadas[normalizarLinha(perna.linha)]
    if (!escolha || !opcoes.some((o) => o.secao === escolha.secao)) return atual
    return definirSecaoPerna(atual, perna.sequencia, escolha)
  }, alternativa)
}

function minutosDe(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

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
            {p.mensagem}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Explicacao({ passos }: { passos: readonly PassoExplicacao[] }) {
  return (
    <details className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[13px]">
      <summary className="cursor-pointer select-none font-semibold">Como o valor foi calculado</summary>
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        {passos.map((passo, indice) => (
          <li key={`${indice}:${passo.texto}`}>
            {passo.texto}
          </li>
        ))}
      </ol>
    </details>
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
  /** Alternativas já sem repetições (a primeira de cada grupo + contador). */
  grupos: GrupoAlternativas<AlternativaComMotor>[]
  /** Volta igual à ida: mostra só uma linha, com o link para escolher outra. */
  recolhida?: { resumo: string; onEscolherOutra: () => void } | null
  selecionadaId: string | null
  onSelecionar: (id: string) => void
  onConsultar: () => void
  onRemoverConducao: (alternativaId: string, sequencia: number) => void
  onEscolherSecao: (alternativaId: string, sequencia: number, escolha: EscolhaSecao | null) => void
  dataServico: string
  salvando: boolean
  nota?: string | null
  /** Linhas D proibidas nesta alternativa (casa e posto fora do Rio — decisão de 24/11/2026). */
  linhasDProibidasDe: (alternativa: AlternativaComMotor) => string[]
  /** Rótulo do horário (ex.: "Chegar até"); padrão = Saída de casa / Saída do posto. */
  rotuloHora?: string
}

function SecaoSentido(props: SecaoSentidoProps) {
  const { sentido, alternativas, selecionadaId } = props
  // Alternativa com linha D proibida nunca vira "Mais em conta".
  const menor = menorValorComDestaque(props.grupos.map((g) => (props.linhasDProibidasDe(g.principal).length ? null : g.principal.resultado.valorCentavos)))
  const selecionada = alternativas.find((x) => x.alternativa.id === selecionadaId) ?? null
  const rotuloHora = props.rotuloHora ?? (sentido === 'ida' ? 'Saída de casa' : 'Saída do posto')
  const horaInvalida = props.hora.length >= 5 && !horaMinutoValida(props.hora)

  if (props.recolhida) {
    return (
      <section className="rounded-xl border border-border bg-muted/20 px-3 py-2.5" aria-label={props.titulo}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px]" data-testid="volta-recolhida">{props.recolhida.resumo}</p>
          <ModuleButton size="sm" variant="ghost" onClick={props.recolhida.onEscolherOutra}>
            Volta diferente? Escolher outra
          </ModuleButton>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-2.5 rounded-xl border border-border p-3" aria-label={props.titulo}>
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
              onChange={(e) => props.onHora(mascararHoraMinuto(e.target.value))}
              placeholder="HH:MM"
              inputMode="numeric"
              maxLength={5}
              aria-invalid={horaInvalida}
            />
            {horaInvalida && <span className="mt-0.5 block text-[11px] text-red-600">Horário inválido (00:00 a 23:59)</span>}
          </label>
          <ModuleButton size="sm" variant="ghost" className="text-[12px]" disabled={props.carregando || props.bloqueado} onClick={props.onConsultar}>
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
          {sentido === 'ida' ? 'Consulte o Google para receber alternativas de ida.' : 'Consulte o Google para receber alternativas de volta.'}
        </p>
      )}
      {props.nota && <p className="text-[12px] text-violet-800" role="status">{props.nota}</p>}
      {props.consultado && alternativas.length === 0 && (
        <p className="text-[13px] text-muted-foreground">O Google não devolveu alternativas de transporte público.</p>
      )}

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {props.grupos.map(({ principal, semelhantes }) => {
          const { alternativa, resultado } = principal
          const proibidas = props.linhasDProibidasDe(principal)
          return (
          <button
            key={alternativa.id}
            type="button"
            aria-label={`${sentido === 'ida' ? 'Ida' : 'Volta'} — alternativa ${alternativa.numero}`}
            aria-pressed={selecionadaId === alternativa.id}
            className={`rounded-lg border p-2.5 text-left transition-colors ${selecionadaId === alternativa.id ? 'border-primary bg-accent/60' : 'border-border bg-card hover:border-primary/40'}`}
            onClick={() => props.onSelecionar(alternativa.id)}
          >
            <span className="flex items-start gap-2">
              <MapPinned className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="block text-[13px] font-semibold">Alternativa {alternativa.numero}</span>
                  {proibidas.length === 0 && resultado.valorCentavos !== null && resultado.valorCentavos === menor && (
                    <StatusBadge variant="success" dot={false}>Mais em conta</StatusBadge>
                  )}
                  {resultado.status !== 'confirmado' && (
                    <StatusBadge variant={varianteStatus(resultado.status)} dot={false}>{ROTULO_STATUS[resultado.status]}</StatusBadge>
                  )}
                </span>
                {proibidas.length > 0 && (
                  <span className="mt-1 block text-[12px] font-semibold text-red-700" data-testid="linha-d-proibida">
                    {TEXTO_LINHA_D_PROIBIDA} ({proibidas.join(', ')})
                  </span>
                )}
                <span className="mt-1 block text-[13px] text-muted-foreground">{resumoPernas(alternativa.itinerario.pernas)}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {alternativa.itinerario.pernas.length} condução(ões)
                  {alternativa.duracaoSegundos != null ? ` · ${Math.round(alternativa.duracaoSegundos / 60)} min` : ''}
                  {textoSemelhantes(semelhantes) ? ` · ${textoSemelhantes(semelhantes)}` : ''}
                </span>
                <span className="mt-2 block text-[13px] font-semibold tabular-nums">
                  {resultado.valorCentavos === null ? 'Valor indeterminado' : `${formatarCentavos(resultado.valorCentavos)} por sentido`}
                </span>
              </span>
            </span>
          </button>
          )
        })}
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
                {selecionada.alternativa.itinerario.pernas.map((perna) => {
                  const tarifa = precificarPerna(pernaMotorDeItinerario(perna).perna, props.dataServico).valorCentavos
                  const opcoesSecao = ehPernaDetro(perna) ? opcoesSecaoDetro(perna.linha) : []
                  return (
                    <Fragment key={perna.sequencia}>
                    <tr className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2.5 font-medium">{perna.linha ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {(() => {
                          const op = rotuloOperadoraExibicao(perna)
                          return (
                            <span title={op.dicaGoogle ?? undefined}>
                              {op.texto}
                              {op.dicaGoogle && <span className="block text-[11px]">{op.dicaGoogle}</span>}
                            </span>
                          )
                        })()}
                      </td>
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
                    {opcoesSecao.length > 0 && (
                      <tr className="border-b border-border bg-amber-50/50 last:border-0" data-testid={`secao-linha-${perna.sequencia}`}>
                        <td colSpan={6} className="px-4 py-2.5 text-[13px]">
                          <label className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">Trecho pago — linha {perna.linha}</span>
                            <select
                              aria-label={`Trecho pago — condução ${perna.sequencia} (${sentido})`}
                              className="h-8 rounded-md border border-border bg-background px-2 text-[13px]"
                              disabled={props.salvando}
                              value={perna.secaoDetro ?? ''}
                              onChange={(e) => {
                                const op = opcoesSecao.find((o) => String(o.secao) === e.target.value)
                                props.onEscolherSecao(selecionada.alternativa.id, perna.sequencia, op ? { secao: op.secao, rotulo: op.rotulo } : null)
                              }}
                            >
                              <option value="">Escolher o trecho…</option>
                              {opcoesSecao.map((o) => (
                                <option key={o.secao} value={o.secao}>{o.rotulo} — {formatarCentavos(o.valorCentavos)}</option>
                              ))}
                            </select>
                          </label>
                          <p className="mt-1 text-[12px] text-muted-foreground">
                            A linha cobra por trecho. O Google indica embarque em: <strong>{perna.embarque.local}</strong> (desembarque: {perna.desembarque.local}). Escolha o trecho que a pessoa realmente percorre.
                          </p>
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
  secoes: SecoesEscolhidas,
  herdadas: Record<string, EscolhaSecao>,
): AlternativaComMotor[] {
  const brutas = adaptarRotasGoogle(resposta ?? {}, {
    consultadoEm,
    precisao: contexto.precisao,
    sentido,
    municipioOrigem: sentido === 'ida' ? contexto.municipioOrigem : contexto.municipioDestino,
    municipioDestino: sentido === 'ida' ? contexto.municipioDestino : contexto.municipioOrigem,
  })
  const ordenadas = ordenarPorCusto(brutas.map((original) => {
    const alternativa = (removidas[`${sentido}:${original.id}`] ?? [])
      .reduce<AlternativaRotaGoogleVT>((atual, sequencia) => removerPernaAlternativa(atual, sequencia), original)
    return calcularAlternativaSentido(aplicarSecoes(alternativa, sentido, secoes, herdadas), contexto.cartao, dataServico)
  }))
  // Alternativas com linha D proibida (24/11/2026) vão para o fim da lista, preservando a ordem de custo.
  const proibida = (x: AlternativaComMotor) => linhasDProibidas(contexto.municipioOrigem, contexto.municipioDestino, x.alternativa.itinerario.pernas).length > 0
  return [...ordenadas.filter((x) => !proibida(x)), ...ordenadas.filter(proibida)]
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
  const [secoes, setSecoes] = useState<SecoesEscolhidas>({})
  const [decisaoRealId, setDecisaoRealId] = useState<string | null>(null)
  const [decisaoRealStatus, setDecisaoRealStatus] = useState<'sugerida' | 'confirmada' | 'indeterminada' | null>(null)
  const [carregandoDecisao, setCarregandoDecisao] = useState(false)
  const [confirmandoDecisao, setConfirmandoDecisao] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [voltaPremarcada, setVoltaPremarcada] = useState(false)
  const [voltaAberta, setVoltaAberta] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [turno, setTurno] = useState<HorarioReferenciaTurno | null>(null)
  const [horarioEditado, setHorarioEditado] = useState(false)
  const horarioEditadoRef = useRef(false)
  const departamentosRef = useRef(contextoReal.departamentosApoio)
  departamentosRef.current = contextoReal.departamentosApoio
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
  }, [contextoReal.trajetoLegadoId, repositorio])

  // Turno da pessoa neste posto (últimos 60 dias): preenche os horários, sem sobrescrever edição manual.
  const { colaboradorId, departamentoId } = contextoReal
  useEffect(() => {
    const departamentos = departamentosRef.current
    setTurno(null)
    if (!departamentos) return
    let ativo = true
    buscarTurnosDoPosto(colaboradorId, departamentoId, departamentos, dataServico)
      .then((registros) => {
        if (!ativo) return
        const escolhido = escolherHorarioDoTurno(registros, dataServico)
        setTurno(escolhido)
        if (escolhido && !horarioEditadoRef.current) {
          setHoraIda(escolhido.entrada)
          setHoraVolta(escolhido.saida)
        }
      })
      .catch((erro) => console.error('Erro ao buscar o turno da pessoa', erro))
    return () => { ativo = false }
  }, [colaboradorId, departamentoId, dataServico])

  const alterarHora = (sentido: Sentido, valor: string) => {
    horarioEditadoRef.current = true
    setHorarioEditado(true)
    if (sentido === 'ida') setHoraIda(valor)
    else setHoraVolta(valor)
  }

  const alternativasIda = useMemo(
    () => alternativasDoSentido('ida', respostas.ida, consultadoEm.ida, contextoReal, pernasRemovidas, dataServico, secoes, {}),
    [respostas.ida, consultadoEm.ida, contextoReal, pernasRemovidas, dataServico, secoes],
  )
  // Volta pré-marcada (mesma rota da ida): herda o trecho escolhido na ida para a mesma linha.
  const herdadasDaIda = useMemo(() => {
    const escolhida = alternativasIda.find((x) => x.alternativa.id === selecionadas.ida)
    const mapa: Record<string, EscolhaSecao> = {}
    if (!voltaPremarcada || !escolhida) return mapa
    for (const perna of escolhida.alternativa.itinerario.pernas) {
      if (perna.secaoDetro !== undefined) mapa[normalizarLinha(perna.linha)] = { secao: perna.secaoDetro, rotulo: perna.secaoDetroRotulo ?? '' }
    }
    return mapa
  }, [alternativasIda, selecionadas.ida, voltaPremarcada])
  const alternativasVolta = useMemo(
    () => alternativasDoSentido('volta', respostas.volta, consultadoEm.volta, contextoReal, pernasRemovidas, dataServico, secoes, herdadasDaIda),
    [respostas.volta, consultadoEm.volta, contextoReal, pernasRemovidas, dataServico, secoes, herdadasDaIda],
  )

  const gruposIda = useMemo(() => agruparAlternativasIguais(alternativasIda), [alternativasIda])
  const gruposVolta = useMemo(() => agruparAlternativasIguais(alternativasVolta), [alternativasVolta])

  const ida = alternativasIda.find((x) => x.alternativa.id === selecionadas.ida) ?? null
  const volta = alternativasVolta.find((x) => x.alternativa.id === selecionadas.volta) ?? null
  const dia = useMemo(
    () => (ida && volta ? calcularDiaIdaVolta(ida.alternativa, volta.alternativa, contextoReal.cartao, dataServico) : null),
    [ida, volta, contextoReal.cartao, dataServico],
  )

  // Volta igual à ida por padrão: enquanto a pessoa não escolheu a volta na mão, ela acompanha a ida.
  const idaId = ida?.alternativa.id ?? null
  useEffect(() => {
    if (!ida) return
    if (selecionadas.volta && !voltaPremarcada) return
    const inversa = encontrarAlternativaInversa(ida.alternativa, gruposVolta.map((g) => g.principal))
    if (inversa) {
      if (selecionadas.volta !== inversa.alternativa.id || !voltaPremarcada) {
        setSelecionadas((atual) => ({ ...atual, volta: inversa.alternativa.id }))
        setVoltaPremarcada(true)
        setSalvo(false)
      }
    } else if (voltaPremarcada) {
      setSelecionadas((atual) => ({ ...atual, volta: null }))
      setVoltaPremarcada(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idaId, ida, gruposVolta])

  const motivoBloqueio = (() => {
    if (!ida || !volta) return 'Escolha uma alternativa de ida e uma de volta.'
    if (!dia) return 'Escolha uma alternativa de ida e uma de volta.'
    const dProibidas = linhasDProibidas(contextoReal.municipioOrigem, contextoReal.municipioDestino, ida.alternativa.itinerario.pernas, volta.alternativa.itinerario.pernas)
    if (dProibidas.length) return `Não é possível salvar: a rota usa a linha ${dProibidas.join(', ')} (vai para o Rio) e o trajeto fica fora do Rio. Tire a condução ou escolha outra alternativa.`
    const pedeSecao = dia.pendencias.find((p) => p.codigo === 'DETRO_SECAO_ESCOLHER')
    if (pedeSecao) return `Escolha o trecho (seção) pago da linha ${pedeSecao.linha ?? ''} na ida e na volta antes de salvar.`
    if (dia.status === 'indeterminado') return 'Valor do dia indeterminado: resolva as pendências antes de salvar.'
    if (dia.status === 'pendente') return 'Valor do dia pendente: confira as pendências abaixo antes de salvar.'
    if (dia.valorCentavos === null || dia.valorCentavos <= 0) return 'O valor do dia precisa ser positivo.'
    if (!decisaoRealId) return 'Nenhuma decisão foi encontrada para este trajeto.'
    return null
  })()

  const linhasDProibidasDe = (x: AlternativaComMotor) =>
    linhasDProibidas(contextoReal.municipioOrigem, contextoReal.municipioDestino, x.alternativa.itinerario.pernas)

  const limparSalvo = () => {
    setSalvo(false)
    setErroPersistencia(null)
  }

  const consultar = async (sentido: Sentido) => {
    setErros((atual) => ({ ...atual, [sentido]: null }))
    // Com turno: a ida CHEGA até a entrada e a volta SAI na saída (noturno: dia seguinte).
    // Sem turno: horários editáveis de saída (comportamento anterior).
    let partida: string
    try {
      const noturno = !!turno && horaMinutoValida(horaIda) && horaMinutoValida(horaVolta) && minutosDe(horaVolta) <= minutosDe(horaIda)
      partida = sentido === 'ida'
        ? (turno ? chegadaComFolgaBRT(horaIda) : partidaProximaSegundaBRT(horaIda))
        : partidaProximaSegundaBRT(horaVolta, noturno ? 1 : 0)
    } catch (erro) {
      setErros((atual) => ({ ...atual, [sentido]: erro instanceof Error ? erro.message : 'Horário inválido.' }))
      return
    }
    setCarregando((atual) => ({ ...atual, [sentido]: true }))
    setSelecionadas((atual) => ({ ...atual, [sentido]: null }))
    if (sentido === 'volta') { setVoltaPremarcada(false); setVoltaAberta(false) }
    setPernasRemovidas((atuais) => Object.fromEntries(Object.entries(atuais).filter(([chave]) => !chave.startsWith(`${sentido}:`))))
    setSecoes((atuais) => Object.fromEntries(Object.entries(atuais).filter(([chave]) => !chave.startsWith(`${sentido}:`))))
    limparSalvo()
    const dataConsulta = new Date().toISOString()
    try {
      const origin = sentido === 'ida' ? contextoReal.origem : contextoReal.destino
      const destination = sentido === 'ida' ? contextoReal.destino : contextoReal.origem
      // A function vt-rota (v2, 21/11/2026) aceita arrivalTime: com turno, a ida chega
      // até a entrada menos a folga; a volta (e o modo manual) parte na hora informada.
      const resposta: RespostaGoogleRoutes = sentido === 'ida' && turno
        ? await sugerirRotasGoogle({ origin, destination, arrivalTime: partida })
        : await sugerirRotasGoogle({ origin, destination, departureTime: partida })
      setConsultadoEm((atual) => ({ ...atual, [sentido]: dataConsulta }))
      setRespostas((atual) => ({ ...atual, [sentido]: resposta }))
    } catch (erro) {
      setErros((atual) => ({ ...atual, [sentido]: erro instanceof Error ? erro.message : 'Não foi possível consultar o Google Routes.' }))
    } finally {
      setCarregando((atual) => ({ ...atual, [sentido]: false }))
    }
  }

  const selecionar = (sentido: Sentido, id: string) => {
    // A volta acompanha a ida sozinha (efeito acima); escolher na volta é escolha manual.
    setSelecionadas((atual) => ({ ...atual, [sentido]: id }))
    if (sentido === 'volta') setVoltaPremarcada(false)
    limparSalvo()
  }

  const consultarIdaEVolta = () => Promise.all([consultar('ida'), consultar('volta')])

  // Consultar só a ida também busca a volta quando ela ainda não foi consultada:
  // sem alternativas de volta não há onde pré-marcar a mesma rota. Volta já
  // consultada não é refeita (preserva uma escolha manual da volta).
  const consultarIda = () => (respostas.volta || carregando.volta ? consultar('ida') : consultarIdaEVolta())

  const removerConducao = (sentido: Sentido, alternativaId: string, sequencia: number) => {
    const chave = `${sentido}:${alternativaId}`
    if (sentido === 'volta') setVoltaPremarcada(false)
    setPernasRemovidas((atuais) => ({ ...atuais, [chave]: [...(atuais[chave] ?? []), sequencia] }))
    // A remoção renumera as conduções: as escolhas de trecho desta alternativa são refeitas.
    setSecoes((atuais) => Object.fromEntries(Object.entries(atuais).filter(([k]) => !k.startsWith(`${chave}:`))))
    limparSalvo()
  }

  const escolherSecao = (sentido: Sentido, alternativaId: string, sequencia: number, escolha: EscolhaSecao | null) => {
    const chave = `${sentido}:${alternativaId}:${sequencia}`
    setSecoes((atuais) => {
      const resto = { ...atuais }
      delete resto[chave]
      return escolha ? { ...resto, [chave]: escolha } : resto
    })
    limparSalvo()
  }

  const horarioReferencia: HorarioReferenciaVT = turno
    ? {
        origem: horarioEditado ? 'manual' : 'turno_escala',
        modoIda: 'chegada',
        folgaMinutos: FOLGA_CHEGADA_MINUTOS,
        entrada: horaIda,
        saida: horaVolta,
        texto: horarioEditado ? `${horaIda} às ${horaVolta}` : turno.texto,
        noturno: minutosDe(horaVolta) <= minutosDe(horaIda),
      }
    : {
        origem: 'manual',
        modoIda: 'saida',
        entrada: horaIda,
        saida: horaVolta,
        texto: `saída de casa ${horaIda}, saída do posto ${horaVolta}`,
      }

  const salvar = async () => {
    if (!decisaoRealId || !ida || !volta || !dia || motivoBloqueio) return
    setSalvando(true)
    setErroPersistencia(null)
    try {
      const combinada = combinarIdaVolta(ida.alternativa, volta.alternativa, dia, contextoReal.cartao, dataServico, horarioReferencia, contextoReal.origem)
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
      contextoReal.onConfirmado?.()
    } catch (erro) {
      setErroPersistencia(erro instanceof Error ? erro.message : 'Erro ao confirmar o trajeto e o preço.')
    } finally {
      setConfirmandoDecisao(false)
    }
  }

  const voltaRecolhida = voltaPremarcada && !voltaAberta && volta
    ? {
        resumo: `Volta: mesma rota no sentido contrário (${volta.alternativa.itinerario.pernas.map((p) => p.linha ?? '?').join(' → ')}) — ${
          volta.resultado.valorCentavos === null ? 'valor a conferir' : formatarCentavos(volta.resultado.valorCentavos)
        }`,
        onEscolherOutra: () => setVoltaAberta(true),
      }
    : null
  const semRotaInversa = !!ida && respostas.volta !== null && !selecionadas.volta && alternativasVolta.length > 0
  const notaVolta = semRotaInversa
    ? 'Não achamos a mesma rota na volta — escolha a volta abaixo.'
    : voltaPremarcada
      ? 'Volta pré-marcada: mesma rota da ida, no sentido contrário. Confira antes de salvar.'
      : null

  const situacaoCartao = contextoReal.cartao.situacaoBu
    ? `${contextoReal.cartao.situacaoBu}${contextoReal.cartao.consultadoEm ? ` (consulta de ${contextoReal.cartao.consultadoEm})` : ''}`
    : 'não consultado na Riocard'
  // Política da empresa (19/11/2026): integração presumida, salvo exceção por pessoa.
  const politica = politicaDoCartao(contextoReal.cartao)
  const avisoCartao = avisoRegularizarCartao(contextoReal.cartao)
  // Rota com cara de não ser a real (auditoria 21/11/2026): só aviso — quem confirma é o RH.
  const motivosConferir = ida && volta
    ? motivosRevisaoHumana(ida.alternativa.itinerario.pernas, volta.alternativa.itinerario.pernas, contextoReal.municipioOrigem, contextoReal.municipioDestino)
    : []
  const textoPolitica = politica === 'tarifa_cheia'
    ? `Exceção da empresa: tarifa cheia — cada condução é paga pelo valor integral, sem integração${contextoReal.cartao.motivoTarifaCheia ? ` (motivo: ${contextoReal.cartao.motivoTarifaCheia})` : ''}.`
    : 'Cálculo com a integração do Bilhete Único (política da empresa), mesmo que o cartão não esteja ativo na Riocard.'
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
      description="Escolha a rota que a pessoa realmente usa. A volta vem igual à ida, e dá para escolher outra se for diferente."
      className="border-violet-200"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] text-violet-900">
          Compare o valor de cada alternativa e escolha a ida que a pessoa realmente usa. A volta é preenchida com a mesma rota no sentido contrário; se for outra, é só trocar. A mais em conta fica marcada, mas a escolha continua sendo sua.
          <span className="mt-1 block">Situação do Bilhete Único: <strong>{situacaoCartao}</strong>.</span>
          <span className="mt-1 block" data-testid="vt-politica-integracao">{textoPolitica}</span>
        </div>

        {turno && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900" data-testid="vt-horario-turno">
            Horário do turno na escala: <strong>{descreverHorarioDoTurno(turno)}</strong>. A ida chega até a entrada e a volta sai na saída{turno.noturno ? ' (turno noturno: a volta é no dia seguinte)' : ''}.
            {turno.alternativos.length > 0 && (
              <span className="mt-1 block text-[12px]">Também aparece na escala: {turno.alternativos.map(descreverAlternativo).join('; ')}.</span>
            )}
            <span className="mt-1 block text-[12px] text-sky-800">A ida considera uma folga de {FOLGA_CHEGADA_MINUTOS} minutos antes da entrada.</span>
          </div>
        )}

        {avisoCartao && (
          <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            <strong>Avisar o colaborador:</strong> {avisoCartao.mensagem}
          </div>
        )}

        {evidenciaSalva && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusBadge variant="success" dot={false}>Itinerário salvo neste trajeto</StatusBadge>
              <span>
                Ida: <strong>{resumoPernas(salvasIda) || '—'}</strong>
                {' · '}
                Volta: <strong>{salvasVolta.length ? resumoPernas(salvasVolta) : 'não registrada'}</strong>
              </span>
              {calculoSalvo && calculoSalvo.valorDiaCentavos !== null && (
                <span>Dia: <strong className="tabular-nums">{formatarCentavos(calculoSalvo.valorDiaCentavos)}</strong></span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-emerald-800" title={`SHA-256: ${evidenciaSalva.evidencia_hash}`}>
              Consulta de {formatarDataHora(evidenciaSalva.consultado_em)} · vinculado à decisão aberta · SHA-256 {evidenciaSalva.evidencia_hash.slice(0, 12)}…
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <ModuleButton
            size="sm"
            disabled={carregando.ida || carregando.volta || carregandoDecisao}
            onClick={() => void consultarIdaEVolta()}
          >
            {carregando.ida || carregando.volta ? 'Consultando...' : 'Consultar ida e volta'}
          </ModuleButton>
        </div>

        <SecaoSentido
          sentido="ida"
          titulo="Ida (casa → posto)"
          descricao={`${contextoReal.origem} → ${contextoReal.destino}`}
          hora={horaIda}
          onHora={(v) => alterarHora('ida', v)}
          rotuloHora={turno ? 'Chegar até' : undefined}
          carregando={carregando.ida}
          bloqueado={carregandoDecisao}
          erro={erros.ida}
          consultado={respostas.ida !== null}
          alternativas={alternativasIda}
          grupos={gruposIda}
          selecionadaId={selecionadas.ida}
          onSelecionar={(id) => selecionar('ida', id)}
          onConsultar={() => void consultarIda()}
          onRemoverConducao={(id, seq) => removerConducao('ida', id, seq)}
          onEscolherSecao={(id, seq, escolha) => escolherSecao('ida', id, seq, escolha)}
          dataServico={dataServico}
          salvando={salvando}
          linhasDProibidasDe={linhasDProibidasDe}
        />

        <SecaoSentido
          sentido="volta"
          titulo="Volta (posto → casa)"
          descricao={`${contextoReal.destino} → ${contextoReal.origem}`}
          hora={horaVolta}
          onHora={(v) => alterarHora('volta', v)}
          carregando={carregando.volta}
          bloqueado={carregandoDecisao}
          erro={erros.volta}
          consultado={respostas.volta !== null}
          alternativas={alternativasVolta}
          grupos={gruposVolta}
          recolhida={voltaRecolhida}
          selecionadaId={selecionadas.volta}
          onSelecionar={(id) => selecionar('volta', id)}
          onConsultar={() => void consultar('volta')}
          onRemoverConducao={(id, seq) => removerConducao('volta', id, seq)}
          onEscolherSecao={(id, seq, escolha) => escolherSecao('volta', id, seq, escolha)}
          dataServico={dataServico}
          salvando={salvando}
          nota={notaVolta}
          linhasDProibidasDe={linhasDProibidasDe}
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

        </section>

        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap items-center gap-2 border-t border-border bg-background px-5 py-3">
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
              disabled={confirmandoDecisao}
              onClick={() => void confirmarDecisao()}
            >
              {confirmandoDecisao ? 'Confirmando...' : 'Confirmar trajeto e preço'}
            </ModuleButton>
          )}
          {contextoReal.onProxima && (
            <ModuleButton type="button" size="sm" variant="outline" onClick={contextoReal.onProxima}>
              Próxima da fila
            </ModuleButton>
          )}
          {contextoReal.onFechar && (
            <ModuleButton type="button" size="sm" variant="outline" onClick={contextoReal.onFechar}>
              Fechar
            </ModuleButton>
          )}
          {decisaoRealStatus === 'confirmada' && (
            <span className="text-[12px] font-semibold text-emerald-700">Trajeto e preço confirmados</span>
          )}
          <div className="min-w-[200px] flex-1 text-[12px]">
            {!salvo && motivoBloqueio && (
              <p className="font-medium text-amber-800" data-testid="motivo-bloqueio">{motivoBloqueio}</p>
            )}
            {motivosConferir.length > 0 && (
              <p className="font-medium text-amber-800" data-testid="motivos-conferir">
                Confira com o colaborador se é mesmo esta rota: {motivosConferir.join('; ')}.
              </p>
            )}
            <p className="text-muted-foreground">
              {carregandoDecisao
                ? 'Carregando a decisão do trajeto...'
                : 'Pode trocar depois: ao salvar outra rota, o sistema cria uma nova revisão e guarda esta como histórico.'}
            </p>
          </div>
        </div>
      </div>
    </ModuleCard>
  )
}
