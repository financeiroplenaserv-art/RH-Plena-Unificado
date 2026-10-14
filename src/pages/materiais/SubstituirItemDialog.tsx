import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { Button } from '@/components/corh/Button'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import { useMateriaisSubstituicao, type DadosPreviaSubstituicao } from '@/hooks/useMateriaisSubstituicao'
import { normalizarTexto } from '@/lib/materiais/normalizar'
import {
  criariaCiclo,
  montarPreviaSubstituicao,
  validarSubstituicao,
  type ParamsSubstituicao,
} from '@/lib/materiais/substituicao'
import type { MatItem, MatItemVariacao } from '@/types/materiais'

interface Props {
  item: MatItem
  itens: MatItem[]
  variacoes: MatItemVariacao[]
  onFechar: () => void
  /** Chamado depois de uma substituição confirmada pelo banco. */
  onConcluido: () => void
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const periodo = (m: number) => (m <= 1 ? 'todo mês' : `a cada ${m} meses`)

/**
 * "Substituir em todos os kits" (migration 128): troca o item (ou uma
 * variação) por outro em todas as linhas de Kit Mensal, com prévia por
 * contrato. Pedidos já feitos nunca mudam.
 */
export function SubstituirItemDialog({ item, itens, variacoes, onFechar, onConcluido }: Props) {
  const { carregando, salvando, carregarPrevia, substituir } = useMateriaisSubstituicao()
  const [deVariacao, setDeVariacao] = useState('')
  const [paraItem, setParaItem] = useState('')
  const [paraVariacao, setParaVariacao] = useState('')
  const [busca, setBusca] = useState('')
  const [inativar, setInativar] = useState(true)
  const [levarHistorico, setLevarHistorico] = useState(true)
  const [dados, setDados] = useState<DadosPreviaSubstituicao | null>(null)
  const [confirmar, setConfirmar] = useState(false)

  const variacoesOrigem = variacoes.filter((v) => v.item_id === item.id)
  const nomeVariacao = useMemo(() => new Map(variacoes.map((v) => [v.id, v.rotulo])), [variacoes])
  const destino = itens.find((i) => i.id === paraItem) ?? null
  const variacoesDestino = variacoes.filter((v) => v.item_id === paraItem && v.ativo)

  // Destinos: itens ativos; o próprio item só entra quando tem variações (troca de variação).
  const opcoesDestino = useMemo(() => {
    const termo = normalizarTexto(busca)
    return itens
      .filter((i) => i.ativo && (i.id !== item.id || variacoesOrigem.length > 1))
      .filter((i) => !termo || normalizarTexto(i.nome).includes(termo) || i.id === paraItem)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
  }, [itens, item.id, variacoesOrigem.length, busca, paraItem])

  useEffect(() => {
    if (!paraItem) return
    let ativo = true
    carregarPrevia(item.id, paraItem).then((d) => ativo && setDados(d))
    return () => {
      ativo = false
    }
  }, [item.id, paraItem, carregarPrevia])

  const params = useMemo<ParamsSubstituicao>(
    () => ({ deItemId: item.id, deVariacaoId: deVariacao || null, paraItemId: paraItem, paraVariacaoId: paraVariacao || null }),
    [item.id, deVariacao, paraItem, paraVariacao]
  )
  const erro =
    validarSubstituicao(params, itens, variacoes) ??
    (levarHistorico && dados && criariaCiclo(params, dados.vinculos)
      ? 'O item de destino já foi substituído (direta ou indiretamente) por este item: levar o histórico criaria um ciclo.'
      : null)
  const previa = useMemo(
    () => (dados && params.paraItemId ? montarPreviaSubstituicao(params, dados.kit, dados.contratos) : null),
    [dados, params]
  )
  const unidadesDiferentes = !!destino && destino.unidade_pedido.trim().toLowerCase() !== item.unidade_pedido.trim().toLowerCase()
  const rotuloOrigem = `${item.nome}${deVariacao ? ` — ${nomeVariacao.get(deVariacao) ?? ''}` : ''}`
  const rotuloDestino = destino ? `${destino.nome}${paraVariacao ? ` — ${nomeVariacao.get(paraVariacao) ?? ''}` : ''}` : ''

  const executar = async () => {
    setConfirmar(false)
    const r = await substituir(params, inativar, levarHistorico)
    if (r) {
      onConcluido()
      onFechar()
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(aberto) => !aberto && !salvando && onFechar()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Substituir em todos os kits</DialogTitle>
            <DialogDescription>
              Troca o item no Kit Mensal de todos os contratos (inclusive inativos), mantendo quantidade e periodicidade.
              Pedidos já feitos não mudam.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Item de origem</Label>
              <p className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm font-medium">{item.nome}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subst-de-var">Variação de origem</Label>
              <select
                id="subst-de-var"
                className={CLASSE_SELECT}
                value={deVariacao}
                onChange={(e) => setDeVariacao(e.target.value)}
                disabled={variacoesOrigem.length === 0}
              >
                <option value="">{variacoesOrigem.length === 0 ? 'Item sem variações' : 'Todas as variações (o item inteiro)'}</option>
                {variacoesOrigem.map((v) => (
                  <option key={v.id} value={v.id}>
                    Só {v.rotulo}
                    {v.ativo ? '' : ' (inativa)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subst-para">Item de destino *</Label>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar pelo nome" aria-label="Filtrar itens de destino" />
              <select
                id="subst-para"
                className={CLASSE_SELECT}
                value={paraItem}
                onChange={(e) => {
                  setParaItem(e.target.value)
                  setParaVariacao('')
                  setDados(null)
                }}
              >
                <option value="">Escolha o item que substitui</option>
                {opcoesDestino.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome} ({i.unidade_pedido}){i.id === item.id ? ' — trocar variação' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subst-para-var">Variação de destino{variacoesDestino.length > 0 ? ' *' : ''}</Label>
              <select
                id="subst-para-var"
                className={CLASSE_SELECT}
                value={paraVariacao}
                onChange={(e) => setParaVariacao(e.target.value)}
                disabled={variacoesDestino.length === 0}
              >
                <option value="">{variacoesDestino.length === 0 ? 'Item sem variações' : 'Escolha a variação'}</option>
                {variacoesDestino.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={inativar} onChange={(e) => setInativar(e.target.checked)} />
              <span>
                Inativar {deVariacao ? 'a variação antiga' : 'o item antigo'} após substituir
                <span className="block text-xs text-muted-foreground">Some do link do líder e da escolha de novos kits; o histórico continua.</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={levarHistorico} onChange={(e) => setLevarHistorico(e.target.checked)} />
              <span>
                Levar o histórico de consumo para a média do novo item
                <span className="block text-xs text-muted-foreground">
                  O histórico original não é alterado: a média do novo item passa a somar o consumo do antigo.
                </span>
              </span>
            </label>
          </div>

          {unidadesDiferentes && destino && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Unidades diferentes: {item.unidade_pedido} → {destino.unidade_pedido}. As quantidades do kit (e o histórico na
              média) são levadas como estão — confira os kits depois.
            </p>
          )}
          {erro && paraItem && <p className="text-sm text-red-600">{erro}</p>}

          {paraItem && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                Prévia{previa ? ` — ${previa.contratos} ${previa.contratos === 1 ? 'contrato' : 'contratos'}` : ''}
                {previa && previa.linhasSomadas > 0 && (
                  <span className="ml-2 font-normal text-amber-700">
                    ({previa.linhasSomadas} com quantidades somadas)
                  </span>
                )}
              </h3>
              {carregando || !previa ? (
                <p className="text-sm text-muted-foreground">Carregando os kits…</p>
              ) : previa.linhas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum kit tem {rotuloOrigem}. Confirmar só grava as opções marcadas acima (vínculo do histórico e/ou inativação).
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table className="min-w-[720px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contrato</TableHead>
                        <TableHead className="text-right">{item.nome} (atual)</TableHead>
                        <TableHead className="text-right">Destino já no kit</TableHead>
                        <TableHead className="text-right">Nova quantidade</TableHead>
                        <TableHead>Periodicidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previa.linhas.map((l) => (
                        <TableRow key={l.contratoId} className={l.soma ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-accent/40'}>
                          <TableCell>
                            <span className="font-medium">{l.contratoNome}</span>
                            {!l.contratoAtivo && (
                              <StatusBadge variant="neutral" className="ml-2">
                                Inativo
                              </StatusBadge>
                            )}
                            {l.soma && (
                              <StatusBadge variant="warning" className="ml-2">
                                Soma
                              </StatusBadge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(l.quantidadeOrigem)}
                            {l.origem.length > 1 && (
                              <span className="block text-xs text-muted-foreground">
                                {l.origem.map((o) => `${fmt(Number(o.quantidade))} ${o.variacao_id ? (nomeVariacao.get(o.variacao_id) ?? '') : ''}`.trim()).join(' + ')}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {l.destinoExistente ? fmt(Number(l.destinoExistente.quantidade)) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{fmt(l.quantidadeNova)}</TableCell>
                          <TableCell>
                            {periodo(l.periodicidadeMeses)}
                            {l.periodicidadeDivergente && (
                              <span className="block text-xs text-amber-700">periodicidades diferentes: vale a da linha que fica</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={() => setConfirmar(true)} loading={salvando} disabled={!!erro || !previa || carregando}>
              <ArrowRightLeft className="size-4" /> Substituir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        icon={<ArrowRightLeft className="size-6 text-primary" />}
        iconClassName="bg-primary/10"
        title="Confirmar substituição"
        description={
          <>
            <strong>{rotuloOrigem}</strong> será trocado por <strong>{rotuloDestino}</strong> em{' '}
            {previa?.contratos ?? 0} {previa?.contratos === 1 ? 'contrato' : 'contratos'}
            {previa && previa.linhasSomadas > 0 ? ` (${previa.linhasSomadas} com soma de quantidades)` : ''}.
            {inativar ? ' A origem será inativada.' : ''}
            {levarHistorico ? ' O histórico entra na média do novo item.' : ' O histórico NÃO entra na média do novo item.'}
          </>
        }
        confirmLabel="Substituir"
        onConfirm={executar}
      />
    </>
  )
}
