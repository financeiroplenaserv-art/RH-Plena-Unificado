import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, PackageCheck } from 'lucide-react'
import { CeuDialog } from './CeuDialog'
import { Button } from '@/components/corh/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { montarAtendimento, type PayloadAtendimento } from '@/lib/materiais/filas'
import { casParaAtualizar, dataValida, epiSemCa, type AtualizacaoCa, type ItemCa } from '@/lib/ceu/atenderPedido'
import type { CeuPedidoItem } from '@/types/materiais'

// Janela de confirmação do "Atender selecionadas" (migration 177): mostra o que
// vai ser lançado no CEU — pessoa, item, tamanho, quantidade (pode diminuir,
// com motivo) e o CA atual de cada item. EPI sem CA aparece destacado com campo
// para digitar: o CA vai para o cadastro do item ANTES de lançar (o recibo usa
// o CA do snapshot). Vazio não bloqueia — só avisa. Não emite recibo.

export interface LinhaAtender {
  linha: Pick<CeuPedidoItem, 'id' | 'qtd_conferida' | 'qtd_pedida' | 'status' | 'tipo' | 'tamanho' | 'nome_digitado'>
  pessoa: string
  item: ItemCa | undefined
}

export interface ConfirmacaoAtender {
  data: string
  payload: PayloadAtendimento[]
  cas: AtualizacaoCa[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  linhas: LinhaAtender[]
  dataSugerida: string
  ocupado: boolean
  onConfirmar: (c: ConfirmacaoAtender) => void
}

export function AtenderPedidoDialog({ open, onOpenChange, linhas, dataSugerida, ocupado, onConfirmar }: Props) {
  const [data, setData] = useState(dataSugerida)
  const [qtds, setQtds] = useState<Record<string, string>>({})
  const [motivos, setMotivos] = useState<Record<string, string>>({})
  const [cas, setCas] = useState<Record<string, string>>({})
  const [erros, setErros] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setData(dataSugerida)
    setQtds({})
    setMotivos({})
    setCas({})
    setErros([])
  }, [open, dataSugerida])

  const semCa = useMemo(() => casParaAtualizar(linhas.map((l) => l.item), cas).semCa, [linhas, cas])

  const confirmar = () => {
    const edicoes: Record<string, { qtd: number | null; motivo: string }> = {}
    for (const { linha } of linhas) {
      const q = (qtds[linha.id] ?? '').trim()
      edicoes[linha.id] = { qtd: q ? Number(q) : null, motivo: motivos[linha.id] ?? '' }
    }
    const { itens, erros: e } = montarAtendimento(
      linhas.map((l) => l.linha),
      edicoes
    )
    const todos = dataValida(data) ? e : ['Informe a data da entrega', ...e]
    setErros(todos)
    if (todos.length) return
    onConfirmar({ data, payload: itens, cas: casParaAtualizar(linhas.map((l) => l.item), cas).atualizacoes })
  }

  const base = (l: LinhaAtender['linha']) => Number(l.qtd_conferida ?? l.qtd_pedida)
  const casJaMostrados = new Set<string>()

  return (
    <CeuDialog
      open={open}
      onOpenChange={(v) => !ocupado && onOpenChange(v)}
      className="sm:max-w-4xl"
      title="Atender e lançar no CEU"
      description="Confira antes de confirmar: cada linha vira uma entrega no CEU (situação Troca). O recibo não é emitido aqui — segue pelo caminho de sempre."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ocupado}>
            Voltar
          </Button>
          <Button onClick={confirmar} loading={ocupado}>
            <PackageCheck className="size-4" /> Confirmar e lançar {linhas.length === 1 ? '1 entrega' : `${linhas.length} entregas`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="ceu-atender-data">Data da entrega</Label>
          <Input id="ceu-atender-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <p className="text-xs text-muted-foreground">Sugestão: dia 1º do mês do pedido. Pode ser usada a data de 1º do mês, mesmo que o recibo seja preparado antes.</p>
        </div>

        <div className="max-h-[50vh] overflow-auto rounded-xl border border-border">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead className="w-28 text-right">Entregar</TableHead>
                <TableHead className="w-52">CA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(({ linha, pessoa, item }) => {
                const b = base(linha)
                const q = (qtds[linha.id] ?? '').trim()
                const menor = q !== '' && Number(q) < b
                const destacar = epiSemCa(item)
                // Campo de CA uma vez por item (vale para todas as linhas dele).
                const mostrarCampo = destacar && item && !casJaMostrados.has(item.id)
                if (item) casJaMostrados.add(item.id)
                return (
                  <TableRow key={linha.id} className="align-top hover:bg-accent/40">
                    <TableCell>{pessoa}</TableCell>
                    <TableCell>{linha.tipo === 'cracha' ? 'Crachá (não vira entrega do CEU)' : item?.nome ?? 'Peça'}</TableCell>
                    <TableCell className="tabular-nums">{linha.tamanho ?? '—'}</TableCell>
                    <TableCell className="space-y-1.5 text-right">
                      <Input
                        aria-label={`Quantidade a entregar para ${pessoa}`}
                        inputMode="numeric"
                        className="tabular-nums text-right"
                        placeholder={String(b)}
                        value={qtds[linha.id] ?? ''}
                        onChange={(e) => setQtds((m) => ({ ...m, [linha.id]: e.target.value }))}
                      />
                      {menor && (
                        <Input
                          aria-label={`Motivo da entrega menor para ${pessoa}`}
                          placeholder="Por que entregou menos?"
                          value={motivos[linha.id] ?? ''}
                          onChange={(e) => setMotivos((m) => ({ ...m, [linha.id]: e.target.value }))}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {linha.tipo === 'cracha' ? (
                        '—'
                      ) : destacar ? (
                        mostrarCampo ? (
                          <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-950/40">
                            <p className="flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                              <AlertTriangle className="size-3.5" /> EPI sem CA no cadastro
                            </p>
                            <Input
                              aria-label={`CA de ${item!.nome}`}
                              placeholder="Digite o CA"
                              value={cas[item!.id] ?? ''}
                              onChange={(e) => setCas((m) => ({ ...m, [item!.id]: e.target.value }))}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-amber-800 dark:text-amber-300">CA: o mesmo digitado acima</span>
                        )
                      ) : (
                        <span className="tabular-nums">{item?.ca?.trim() ? item.ca : '—'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {semCa.length > 0 && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            Sem CA: {semCa.join(', ')}. Dá para lançar assim, mas o recibo sai sem CA (o recibo usa o CA do dia do lançamento).
          </p>
        )}
        {erros.length > 0 && (
          <ul role="alert" className="space-y-1 text-sm text-red-700 dark:text-red-400">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </CeuDialog>
  )
}
