import { useEffect, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatarCentavos } from '@/lib/vt/bilhetes'
import {
  contaDaEscala,
  montarCalendarioEscala,
  ROTULO_TIPO_DIA,
  type DiasEscalaVt,
  type TipoDiaEscala,
} from '@/lib/vt/calendarioEscala'
import { lerEscalaDias, MENSAGEM_178_AUSENTE } from '@/lib/vt/escalaDiasRepositorio'
import type { LinhaLoteCargaVT, TotalColaboradorLoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import { formatarDataHora } from '@/lib/utils'

// Pop-up "Escala de <nome> — <competência>" da Carga do VT (pedido da gestora,
// 28/11/2026): calendário do mês com cores por situação e a conta que bate com
// o valor final da linha do lote. Dias pagos vêm do SNAPSHOT do lote; as marcas
// vêm do relatório em memória (quem importou) ou de vt_escala_dias (migration 178).

const ESTILO_TIPO: Record<TipoDiaEscala, string> = {
  trabalho_vt: 'border-escala-trabalho bg-escala-trabalho-bg text-escala-trabalho',
  treinamento: 'border-escala-treino bg-escala-treino-bg text-escala-treino',
  trabalho_sem_vt: 'border-dashed border-escala-trabalho bg-background text-escala-trabalho',
  folga: 'border-escala-folga/40 bg-escala-folga-bg text-escala-folga',
  ferias: 'border-escala-ferias bg-escala-ferias-bg text-escala-ferias',
  afastado: 'border-escala-afastado bg-escala-afastado-bg text-escala-afastado',
  atestado: 'border-escala-afastado bg-escala-afastado-bg text-escala-afastado',
  outro: 'border-border bg-muted/40 text-foreground',
  sem_registro: 'border-border bg-background text-muted-foreground',
  fora_relatorio: 'border-dashed border-border bg-background text-muted-foreground',
  sem_detalhe: 'border-border bg-background text-muted-foreground',
}

const SIGLA_TIPO: Partial<Record<TipoDiaEscala, string>> = {
  treinamento: 'Treino',
  trabalho_sem_vt: 'T sem VT',
  folga: 'Folga',
  ferias: 'Férias',
  afastado: 'Afast.',
  atestado: 'Atest.',
  fora_relatorio: '—',
}

const CABECALHO_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export interface VtEscalaColaboradorDialogProps {
  open: boolean
  onOpenChange: (aberto: boolean) => void
  colaboradorId: string
  nome: string
  competencia: string
  linhas: readonly LinhaLoteCargaVT[]
  total: TotalColaboradorLoteCargaVT
  nomePosto: (departamentoId: string) => string
  /** Marcas do relatório aberto na tela (mesma competência); ausente = busca no banco. */
  marcasEmMemoria?: DiasEscalaVt | null
}

type Carga =
  | { estado: 'carregando' }
  | { estado: 'pronto'; marcas: DiasEscalaVt | null; origem: string | null; aviso: string | null }

export function VtEscalaColaboradorDialog({
  open,
  onOpenChange,
  colaboradorId,
  nome,
  competencia,
  linhas,
  total,
  nomePosto,
  marcasEmMemoria,
}: VtEscalaColaboradorDialogProps) {
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' })

  useEffect(() => {
    if (!open) return
    if (marcasEmMemoria) {
      setCarga({ estado: 'pronto', marcas: marcasEmMemoria, origem: 'relatório aberto nesta tela', aviso: null })
      return
    }
    let ativo = true
    setCarga({ estado: 'carregando' })
    void lerEscalaDias(colaboradorId, competencia).then((r) => {
      if (!ativo) return
      if (r.situacao === 'ok') {
        const quando = r.importadoEm ? ` em ${formatarDataHora(r.importadoEm)}` : ''
        setCarga({ estado: 'pronto', marcas: r.dias, origem: `relatório ${r.nomeArquivo ?? 'importado'}${quando}`, aviso: null })
      } else {
        const aviso =
          r.situacao === 'ausente'
            ? `Escala detalhada indisponível — ${MENSAGEM_178_AUSENTE}`
            : r.situacao === 'erro'
              ? `Escala detalhada indisponível — erro ao ler: ${r.mensagem}`
              : 'Escala detalhada indisponível — reimporte o relatório "Gestão de escalas" do mês.'
        setCarga({ estado: 'pronto', marcas: null, origem: null, aviso })
      }
    })
    return () => { ativo = false }
  }, [open, colaboradorId, competencia, marcasEmMemoria])

  const marcas = carga.estado === 'pronto' ? carga.marcas : null
  const calendario = useMemo(
    () => montarCalendarioEscala({ competencia, linhasPagas: linhas, marcas, nomePosto }),
    [competencia, linhas, marcas, nomePosto],
  )
  const conta = useMemo(() => contaDaEscala(linhas, total, nomePosto), [linhas, total, nomePosto])
  const [ano, mes] = competencia.split('-')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-5" />
            Escala de {nome} — {mes}/{ano}
          </DialogTitle>
          <DialogDescription>
            Dias pagos e valores vêm do lote da carga; as marcas vêm do relatório "Gestão de escalas" do Flit
            {carga.estado === 'pronto' && carga.origem ? ` (${carga.origem})` : ''}.
          </DialogDescription>
        </DialogHeader>

        {carga.estado === 'carregando' && <p className="text-[13px] text-muted-foreground">Carregando a escala...</p>}
        {carga.estado === 'pronto' && carga.aviso && (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            {carga.aviso} O calendário mostra só os dias de trabalho do lote.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] table-fixed border-separate border-spacing-1 text-[12px]" aria-label={`Calendário de ${mes}/${ano}`}>
            <thead>
              <tr>
                {CABECALHO_SEMANA.map((d) => (
                  <th key={d} scope="col" className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendario.semanas.map((semana, i) => (
                <tr key={i}>
                  {semana.map((dia, j) =>
                    dia ? (
                      <td
                        key={dia.data}
                        data-tipo={dia.tipo}
                        title={dia.descricao}
                        aria-label={dia.descricao}
                        className={`h-16 rounded-md border p-1 align-top sm:h-20 ${ESTILO_TIPO[dia.tipo]}`}
                      >
                        <span className="block text-[12px] font-semibold tabular-nums">{dia.dia}</span>
                        {dia.posto ? (
                          <span className="mt-0.5 block truncate text-[10px] font-medium leading-tight sm:text-[11px]">{dia.posto}</span>
                        ) : SIGLA_TIPO[dia.tipo] ? (
                          <span className="mt-0.5 block truncate text-[10px] leading-tight sm:text-[11px]">{SIGLA_TIPO[dia.tipo]}</span>
                        ) : dia.tipo === 'outro' && dia.marca ? (
                          <span className="mt-0.5 block truncate text-[10px] leading-tight">{dia.marca}</span>
                        ) : null}
                        {dia.custoDiaCentavos != null && (
                          <span className="block text-[10px] tabular-nums opacity-80">{formatarCentavos(dia.custoDiaCentavos)}</span>
                        )}
                      </td>
                    ) : (
                      <td key={`vazio-${i}-${j}`} aria-hidden="true" />
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]" aria-label="Legenda">
          {calendario.tiposPresentes.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`inline-block size-3 rounded-sm border ${ESTILO_TIPO[t]}`} />
              {ROTULO_TIPO_DIA[t]}
            </li>
          ))}
        </ul>

        <div className="space-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[13px]" data-testid="conta-escala">
          <p className="tabular-nums">{conta.texto}</p>
          {conta.ajusteFechamentoCentavos !== 0 && (
            <p className="tabular-nums">
              {conta.ajusteFechamentoCentavos > 0 ? '+' : '−'} {formatarCentavos(Math.abs(conta.ajusteFechamentoCentavos))} ajuste do fechamento do mês anterior
            </p>
          )}
          {conta.extraMensalCentavos > 0 && (
            <p className="tabular-nums">+ {formatarCentavos(conta.extraMensalCentavos)} extra no mês{total.extraMensalMotivo ? ` (${total.extraMensalMotivo})` : ''}</p>
          )}
          {conta.excedenteTruncadoCentavos > 0 && (
            <p className="text-amber-800">O desconto passou da necessidade: {formatarCentavos(conta.excedenteTruncadoCentavos)} não foram descontados (piso zero).</p>
          )}
          <p className="font-semibold tabular-nums">
            Valor final: {conta.valorFinalCentavos == null ? 'indeterminado (pendência)' : formatarCentavos(conta.valorFinalCentavos)}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
