import { useMemo, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ModuleButton } from '@/components/layout/ModuleShell'
import { supabase } from '@/lib/supabase'
import { extrairPaginasPosicionais } from '@/lib/pdfPosicional'
import { agoraBrasil, formatarData, hojeBrasil } from '@/lib/utils'
import { formatarCentavos } from '@/lib/vt/bilhetes'
import { extrairRiocard, type RelatorioRiocard } from '@/lib/vt/importacaoRiocard'
import {
  montarPedidoRiocard,
  vinculosRiocardDoRelatorio,
  type ColaboradorParaRiocard,
  type TotalPedidoRiocard,
} from '@/lib/vt/pedidoRiocard'
import {
  abasConferenciaPedidoRiocard,
  baixarTextoPuro,
  conferirIntegridadePedido,
  relatorioRiocardAntigo,
} from '@/lib/vt/conferenciaPedidoRiocard'
import { baixarExcelConferencia } from '@/lib/vt/excelImportacoes'
import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'

interface Props {
  open: boolean
  onOpenChange: (aberto: boolean) => void
  /** Lote CONFIRMADO: os valores finais por pessoa vêm do snapshot dele. */
  lote: LoteCargaVT
  nomes: ReadonlyMap<string, string>
}

type ColaboradorLido = ColaboradorParaRiocard & { nome_completo: string }

const mascaraCnpj = (c: string) => (c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c)

/** CPF é sensível: lido só em memória para o casamento, nunca exibido nem gravado. */
async function lerColaboradores(ids: string[]): Promise<ColaboradorLido[]> {
  const lista: ColaboradorLido[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('id, cpf, status, nome_completo')
      .in('id', ids.slice(i, i + 100))
    if (error) throw new Error(`Não foi possível ler os colaboradores do lote: ${error.message}`)
    lista.push(...((data ?? []) as ColaboradorLido[]))
  }
  return lista
}

export function VtArquivoRiocardDialog({ open, onOpenChange, lote, nomes }: Props) {
  const [relatorios, setRelatorios] = useState<RelatorioRiocard[]>([])
  const [colaboradores, setColaboradores] = useState<ColaboradorLido[] | null>(null)
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [conferiFora, setConferiFora] = useState(false)
  const [agora, setAgora] = useState<Date>(() => agoraBrasil())

  const totais: TotalPedidoRiocard[] = useMemo(
    () =>
      lote.totaisPorColaborador.map((t) => ({
        colaboradorId: t.colaboradorId,
        nome: colaboradores?.find((c) => c.id === t.colaboradorId)?.nome_completo ?? nomes.get(t.colaboradorId) ?? t.colaboradorId,
        valorCentavos: t.valorCentavos,
      })),
    [lote, colaboradores, nomes],
  )

  const resultado = useMemo(() => {
    if (!colaboradores || relatorios.length === 0) return null
    const { vinculos, motivosPorColaborador } = vinculosRiocardDoRelatorio(relatorios, colaboradores)
    return montarPedidoRiocard({
      totais,
      vinculos,
      cnpjsPermitidos: relatorios.map((r) => r.cnpj),
      agora,
      motivosSemVinculo: motivosPorColaborador,
    })
  }, [colaboradores, relatorios, totais, agora])

  const conferencia = useMemo(() => (resultado ? conferirIntegridadePedido(totais, resultado) : null), [resultado, totais])
  const foraComValor = conferencia?.foraComValor ?? 0
  const hoje = hojeBrasil()
  const podeBaixar = !!resultado && !!conferencia?.ok && resultado.arquivos.length > 0 && (foraComValor === 0 || conferiFora)

  async function lerArquivos(files: FileList | null) {
    if (!files?.length) return
    setLendo(true)
    setErro(null)
    try {
      const novos = [...relatorios]
      for (const f of Array.from(files)) {
        const rel = extrairRiocard(await extrairPaginasPosicionais(f))
        if (rel.linhas.length === 0 || !/^\d{14}$/.test(rel.cnpj.replace(/\D/g, ''))) {
          throw new Error(`"${f.name}": não reconheci como relatório "Cadastro de Funcionários da Empresa" da Riocard (CNPJ ou funcionários não encontrados).`)
        }
        const cnpj = rel.cnpj.replace(/\D/g, '')
        const i = novos.findIndex((r) => r.cnpj.replace(/\D/g, '') === cnpj)
        if (i >= 0) novos[i] = rel
        else novos.push(rel)
      }
      if (!colaboradores) setColaboradores(await lerColaboradores(lote.totaisPorColaborador.map((t) => t.colaboradorId)))
      setRelatorios(novos)
      setConferiFora(false)
      setAgora(agoraBrasil())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler o PDF.')
    } finally {
      setLendo(false)
    }
  }

  function baixar() {
    if (!resultado || !podeBaixar) return
    for (const a of resultado.arquivos) baixarTextoPuro(a.nomeArquivo, a.conteudo)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Arquivo de pedido para a Riocard</DialogTitle>
          <DialogDescription>
            Anexe o relatório "Cadastro de Funcionários da Empresa" da Riocard de cada conta (Plena EA e Plena Tech). A matrícula do arquivo é a cadastrada na Riocard, casada pelo CPF; o valor é o final do lote confirmado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-riocard-pedido">PDFs da Riocard (um por conta)</Label>
            <Input
              id="pdf-riocard-pedido"
              type="file"
              accept="application/pdf"
              multiple
              disabled={lendo}
              onChange={(e) => {
                void lerArquivos(e.target.files)
                e.target.value = ''
              }}
            />
            {lendo && <p className="text-[12px] text-muted-foreground">Lendo os arquivos…</p>}
          </div>

          {erro && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{erro}</div>
          )}

          {relatorios.map((r) => (
            <div key={r.cnpj} className="text-[12px] text-muted-foreground" data-testid="relatorio-lido">
              Lido: <strong className="text-foreground">{r.empresa || 'empresa não identificada'}</strong> (CNPJ {mascaraCnpj(r.cnpj.replace(/\D/g, ''))}) — emitido em {r.emitidoEm ? formatarData(r.emitidoEm) : 'data não identificada'}
              {relatorioRiocardAntigo(r, hoje) && (
                <span className="mt-1 block text-amber-700" role="status">
                  Atenção: este relatório tem mais de 7 dias; matrículas e situações podem estar desatualizadas.
                </span>
              )}
            </div>
          ))}

          {resultado && conferencia && (
            <div className="space-y-3">
              {!conferencia.ok && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
                  A conferência não fecha: lote {formatarCentavos(conferencia.totalLoteCentavos)} × arquivos {formatarCentavos(conferencia.totalArquivosCentavos)} + fora com valor {formatarCentavos(conferencia.totalForaComValorCentavos)}. O download está bloqueado.
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-[12px] tabular-nums">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-semibold">Empresa</th>
                      <th className="px-3 py-2 font-semibold">CNPJ</th>
                      <th className="px-3 py-2 text-right font-semibold">Pessoas</th>
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.arquivos.map((a) => (
                      <tr key={a.cnpj} className="border-t border-border" data-testid="linha-arquivo">
                        <td className="px-3 py-1.5">{relatorios.find((r) => r.cnpj.replace(/\D/g, '') === a.cnpj)?.empresa || '—'}</td>
                        <td className="px-3 py-1.5">{mascaraCnpj(a.cnpj)}</td>
                        <td className="px-3 py-1.5 text-right">{a.itens.length}</td>
                        <td className="px-3 py-1.5 text-right">{formatarCentavos(a.totalCentavos)}</td>
                      </tr>
                    ))}
                    {resultado.arquivos.length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-2 text-muted-foreground">Nenhuma pessoa elegível para o arquivo.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-border px-3 py-2" data-testid="fora-do-arquivo">
                <p className="text-[13px] font-semibold">Ficam fora do arquivo ({resultado.fora.length})</p>
                {resultado.fora.length > 0 ? (
                  <ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-[12px]">
                    {resultado.fora.map((f) => (
                      <li key={f.colaboradorId}><span className="font-medium">{f.nome}</span> — {f.motivo}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[12px] text-muted-foreground">Ninguém fica fora.</p>
                )}
              </div>

              {foraComValor > 0 && (
                <label className="flex items-start gap-2 text-[13px]">
                  <input type="checkbox" className="mt-0.5" checked={conferiFora} onChange={(e) => setConferiFora(e.target.checked)} />
                  <span>Conferi a lista de quem fica fora ({foraComValor} com valor a receber, {formatarCentavos(conferencia.totalForaComValorCentavos)}).</span>
                </label>
              )}
              <p className="text-[11px] text-muted-foreground">
                Formato oficial 01.00, linhas CRLF, ASCII. Confirmar com a Riocard no primeiro envio.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <ModuleButton
            variant="outline"
            disabled={!resultado || !conferencia?.ok}
            onClick={() => resultado && baixarExcelConferencia(abasConferenciaPedidoRiocard(totais, resultado), `conferencia-pedido-riocard-${lote.competencia}.xlsx`)}
          >
            <FileText className="size-4" />
            Baixar conferência (Excel)
          </ModuleButton>
          <ModuleButton disabled={!podeBaixar} onClick={baixar}>
            <Download className="size-4" />
            Baixar arquivo(s)
          </ModuleButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
