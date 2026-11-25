import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, PencilLine, Trash2 } from 'lucide-react'
import { ModuleButton } from '@/components/layout/ModuleShell'
import { Input } from '@/components/ui/input'
import { formatarCentavos } from '@/lib/vt/bilhetes'
import { linhasDProibidas, TEXTO_LINHA_D_PROIBIDA } from '@/lib/vt/revisaoHumana'
import { calcularAlternativaSentido, type AlternativaComMotor } from '@/lib/vt/motor/idaVolta'
import { opcoesSecaoDetro } from '@/lib/vt/motor/tarifas'
import type { FatosCartaoMotor } from '@/lib/vt/motor/tipos'
import {
  classificarCodigoLinha,
  construirAlternativaManual,
  descreverConducao,
  inverterConducoes,
  novoIdConducao,
  OPCOES_MODAL_MANUAL,
  type ConducaoManual,
  type TipoConducaoManual,
} from '@/lib/vt/rotaManual'

export interface RotaManualResultado {
  ida: AlternativaComMotor | null
  volta: AlternativaComMotor | null
  motivo: string
}

interface VtRotaManualProps {
  usuarioId: string
  /** Cidade da casa e do posto (a volta troca os dois). */
  municipioCasa: string
  municipioPosto: string
  cartao: FatosCartaoMotor
  dataServico: string
  horaIda: string
  horaVolta: string
  disabled?: boolean
  /** Recebe o cálculo da rota informada, ou null quando o painel está fechado. */
  onChange: (resultado: RotaManualResultado | null) => void
}

type Sentido = 'ida' | 'volta'

interface EditorSentidoProps {
  sentido: Sentido
  titulo: string
  conducoes: ConducaoManual[]
  somenteLeitura?: boolean
  calculo: AlternativaComMotor | null
  proibidas: string[]
  disabled?: boolean
  onChange: (lista: ConducaoManual[]) => void
}

function EditorSentido({ sentido, titulo, conducoes, somenteLeitura, calculo, proibidas, disabled, onChange }: EditorSentidoProps) {
  const [codigo, setCodigo] = useState('')
  const rotuloSentido = sentido === 'ida' ? 'ida' : 'volta'

  const adicionarLinha = () => {
    const texto = codigo.trim().toUpperCase()
    if (!texto) return
    onChange([...conducoes, { id: novoIdConducao(), tipo: 'linha', codigo: texto }])
    setCodigo('')
  }
  const adicionarModal = (tipo: TipoConducaoManual) => onChange([...conducoes, { id: novoIdConducao(), tipo }])
  const remover = (id: string) => onChange(conducoes.filter((c) => c.id !== id))
  const mover = (indice: number, delta: -1 | 1) => {
    const destino = indice + delta
    if (destino < 0 || destino >= conducoes.length) return
    const copia = [...conducoes]
    ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
    onChange(copia)
  }
  const definirSecao = (id: string, secao: ConducaoManual['secao']) =>
    onChange(conducoes.map((c) => (c.id === id ? { ...c, secao } : c)))

  const valor = calculo?.resultado.valorCentavos ?? null

  return (
    <section className="space-y-2.5 rounded-xl border border-border p-3" aria-label={`Rota informada — ${rotuloSentido}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[14px] font-semibold">{titulo}</h4>
        {calculo && (
          <span className="text-[13px] tabular-nums" data-testid={`manual-valor-${sentido}`}>
            {valor === null ? 'Valor indeterminado' : `${formatarCentavos(valor)} por sentido`}
          </span>
        )}
      </div>

      {conducoes.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nenhuma condução ainda. Adicione na ordem em que a pessoa pega.</p>
      ) : (
        <ol className="space-y-2">
          {conducoes.map((c, indice) => {
            const info = descreverConducao(c)
            const opcoesSecao = c.tipo === 'linha' && classificarCodigoLinha(c.codigo).tipo === 'detro'
              ? opcoesSecaoDetro(c.codigo)
              : []
            return (
              <li key={c.id} className="rounded-lg border border-border bg-card px-3 py-2" data-testid={`manual-conducao-${sentido}-${indice + 1}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] tabular-nums text-muted-foreground">{indice + 1}.</span>
                  <span className="text-[14px] font-semibold">{info.titulo}</span>
                  <span className={`text-[12px] ${info.reconhecida ? 'text-emerald-700' : 'font-semibold text-red-700'}`}>
                    {info.classificacao}
                  </span>
                  {!somenteLeitura && (
                    <span className="ml-auto flex items-center gap-1">
                      <ModuleButton size="sm" variant="ghost" disabled={disabled || indice === 0} aria-label={`Subir condução ${indice + 1} (${rotuloSentido})`} onClick={() => mover(indice, -1)}>
                        <ArrowUp className="size-3.5" />
                      </ModuleButton>
                      <ModuleButton size="sm" variant="ghost" disabled={disabled || indice === conducoes.length - 1} aria-label={`Descer condução ${indice + 1} (${rotuloSentido})`} onClick={() => mover(indice, 1)}>
                        <ArrowDown className="size-3.5" />
                      </ModuleButton>
                      <ModuleButton size="sm" variant="ghost" disabled={disabled} aria-label={`Remover condução ${indice + 1} (${rotuloSentido})`} onClick={() => remover(c.id)}>
                        <Trash2 className="size-3.5" />
                      </ModuleButton>
                    </span>
                  )}
                </div>
                {opcoesSecao.length > 0 && (
                  <label className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="font-semibold">Trecho pago — linha {info.titulo}</span>
                    <select
                      aria-label={`Trecho pago — condução ${indice + 1} (${rotuloSentido})`}
                      className="h-8 rounded-md border border-border bg-background px-2 text-[13px]"
                      disabled={disabled || somenteLeitura}
                      value={c.secao?.secao ?? ''}
                      onChange={(e) => {
                        const op = opcoesSecao.find((o) => String(o.secao) === e.target.value)
                        definirSecao(c.id, op ? { secao: op.secao, rotulo: op.rotulo } : null)
                      }}
                    >
                      <option value="">Escolher o trecho…</option>
                      {opcoesSecao.map((o) => (
                        <option key={o.secao} value={o.secao}>{o.rotulo} — {formatarCentavos(o.valorCentavos)}</option>
                      ))}
                    </select>
                  </label>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {proibidas.length > 0 && (
        <p className="text-[12px] font-semibold text-red-700" data-testid={`manual-linha-d-${sentido}`}>
          {TEXTO_LINHA_D_PROIBIDA} ({proibidas.join(', ')})
        </p>
      )}

      {!somenteLeitura && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[12px] text-muted-foreground">
            Código da linha
            <Input
              aria-label={`Código da linha (${rotuloSentido})`}
              className="mt-1 h-8 w-32 uppercase"
              value={codigo}
              placeholder="Ex.: 489M"
              disabled={disabled}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  adicionarLinha()
                }
              }}
            />
          </label>
          <ModuleButton size="sm" variant="outline" disabled={disabled || !codigo.trim()} aria-label={`Adicionar linha (${rotuloSentido})`} onClick={adicionarLinha}>
            Adicionar linha
          </ModuleButton>
          <label className="text-[12px] text-muted-foreground">
            Ou outro meio
            <select
              aria-label={`Adicionar outro meio (${rotuloSentido})`}
              className="mt-1 block h-8 rounded-md border border-border bg-background px-2 text-[13px]"
              disabled={disabled}
              value=""
              onChange={(e) => {
                if (e.target.value) adicionarModal(e.target.value as TipoConducaoManual)
              }}
            >
              <option value="">Escolher…</option>
              {OPCOES_MODAL_MANUAL.map((o) => <option key={o.tipo} value={o.tipo}>{o.rotulo}</option>)}
            </select>
          </label>
        </div>
      )}
    </section>
  )
}

/**
 * "Informar a rota que a pessoa usa" (25/11/2026): a gestora já sabe o ônibus; digita as linhas
 * (ou escolhe barca/metrô/etc.) e o MESMO motor das alternativas do Google calcula o valor.
 * Funciona sem consultar o Google. O motivo é obrigatório e vai para a evidência.
 */
export function VtRotaManual(props: VtRotaManualProps) {
  const { usuarioId, municipioCasa, municipioPosto, cartao, dataServico, horaIda, horaVolta } = props
  const [aberto, setAberto] = useState(false)
  const [idaLista, setIdaLista] = useState<ConducaoManual[]>([])
  const [voltaLista, setVoltaLista] = useState<ConducaoManual[]>([])
  const [voltaIgual, setVoltaIgual] = useState(true)
  const [motivo, setMotivo] = useState('')
  const [consultadoEm] = useState(() => new Date().toISOString())

  const voltaInvertida = useMemo(() => inverterConducoes(idaLista), [idaLista])
  const voltaEfetiva = voltaIgual ? voltaInvertida : voltaLista

  const idaCalc = useMemo(() => {
    const alt = construirAlternativaManual({
      conducoes: idaLista, sentido: 'ida', municipioOrigem: municipioCasa, municipioDestino: municipioPosto,
      dataServico, horaReferencia: horaIda, consultadoEm, motivo, autorId: usuarioId,
    })
    return alt ? calcularAlternativaSentido(alt, cartao, dataServico) : null
  }, [idaLista, municipioCasa, municipioPosto, dataServico, horaIda, consultadoEm, motivo, usuarioId, cartao])

  const voltaCalc = useMemo(() => {
    const alt = construirAlternativaManual({
      conducoes: voltaEfetiva, sentido: 'volta', municipioOrigem: municipioPosto, municipioDestino: municipioCasa,
      dataServico, horaReferencia: horaVolta, consultadoEm, motivo, autorId: usuarioId,
    })
    return alt ? calcularAlternativaSentido(alt, cartao, dataServico) : null
  }, [voltaEfetiva, municipioCasa, municipioPosto, dataServico, horaVolta, consultadoEm, motivo, usuarioId, cartao])

  const onChangeRef = useRef(props.onChange)
  useEffect(() => {
    onChangeRef.current = props.onChange
  })
  useEffect(() => {
    onChangeRef.current(aberto ? { ida: idaCalc, volta: voltaCalc, motivo } : null)
  }, [aberto, idaCalc, voltaCalc, motivo])

  const proibidasDe = (c: AlternativaComMotor | null) =>
    c ? linhasDProibidas(municipioCasa, municipioPosto, c.alternativa.itinerario.pernas) : []

  const avisos = [
    ...(idaCalc ? [...idaCalc.alternativa.avisos, ...idaCalc.avisosMotor].map((a) => `Ida: ${a}`) : []),
    ...(voltaCalc ? [...voltaCalc.alternativa.avisos, ...voltaCalc.avisosMotor].map((a) => `Volta: ${a}`) : []),
  ]
  // O aviso de horário presumido é igual nos dois sentidos: mostra uma vez.
  const avisosUnicos = [...new Set(avisos.map((a) => a.replace(/^(Ida|Volta): /, '')))]
  const motivoVazio = motivo.trim() === ''

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ModuleButton
          size="sm"
          variant={aberto ? 'outline' : 'primary'}
          disabled={props.disabled}
          aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)}
        >
          <PencilLine className="size-4" />
          {aberto ? 'Voltar às alternativas do Google' : 'Informar a rota que a pessoa usa'}
        </ModuleButton>
        {!aberto && (
          <span className="text-[12px] text-muted-foreground">Já sabe qual ônibus? Informe as linhas e veja o valor, sem consultar o Google.</span>
        )}
      </div>

      {aberto && (
        <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3" data-testid="vt-rota-manual">
          <p className="text-[13px] text-violet-900">
            Adicione as conduções <strong>na ordem em que a pessoa pega</strong>. A volta vem como a ida ao contrário; dá para editar. Linha que não existir na tabela fica sem valor (nunca é inventado).
          </p>

          <EditorSentido
            sentido="ida"
            titulo="Ida (casa → posto)"
            conducoes={idaLista}
            calculo={idaCalc}
            proibidas={proibidasDe(idaCalc)}
            disabled={props.disabled}
            onChange={setIdaLista}
          />

          {voltaIgual ? (
            <div className="space-y-2">
              <EditorSentido
                sentido="volta"
                titulo="Volta (posto → casa) — igual à ida, ao contrário"
                conducoes={voltaEfetiva}
                somenteLeitura
                calculo={voltaCalc}
                proibidas={proibidasDe(voltaCalc)}
                disabled={props.disabled}
                onChange={() => undefined}
              />
              <ModuleButton
                size="sm"
                variant="ghost"
                disabled={props.disabled}
                onClick={() => {
                  setVoltaLista(voltaInvertida)
                  setVoltaIgual(false)
                }}
              >
                Volta diferente? Editar a volta
              </ModuleButton>
            </div>
          ) : (
            <div className="space-y-2">
              <EditorSentido
                sentido="volta"
                titulo="Volta (posto → casa)"
                conducoes={voltaLista}
                calculo={voltaCalc}
                proibidas={proibidasDe(voltaCalc)}
                disabled={props.disabled}
                onChange={setVoltaLista}
              />
              <ModuleButton size="sm" variant="ghost" disabled={props.disabled} onClick={() => setVoltaIgual(true)}>
                Usar a volta igual à ida (ao contrário)
              </ModuleButton>
            </div>
          )}

          {avisosUnicos.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              <p className="font-semibold">Dados a revisar</p>
              <ul className="mt-1 list-disc pl-5">
                {avisosUnicos.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </div>
          )}

          <label className="block text-[13px] font-semibold">
            Motivo (obrigatório)
            <Input
              aria-label="Motivo da rota informada"
              className="mt-1 font-normal"
              value={motivo}
              placeholder="Ex.: confirmado com a colaboradora"
              aria-invalid={motivoVazio}
              disabled={props.disabled}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">
              Fica gravado junto com a rota, com o seu nome e a data.
            </span>
          </label>
        </div>
      )}
    </div>
  )
}
