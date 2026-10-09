import { useState } from 'react'
import { Check, Pencil, Plus, X } from 'lucide-react'
import { Button } from '@/components/corh/Button'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import type { useMateriaisCatalogo } from '@/hooks/useMateriaisCatalogo'
import { historicoPrecos, lerNumero, nomeDuplicado, validarNovoPreco } from '@/lib/materiais/cadastro'
import { precoVigente } from '@/lib/materiais/precos'
import { formatarData, formatarDataDeTimestamp, hojeBrasil, mascaraMoeda } from '@/lib/utils'
import type { Fornecedor } from '@/types/database'
import type { MatItem } from '@/types/materiais'

interface Props {
  item: MatItem | null
  onFechar: () => void
  podeEditar: boolean
  catalogo: ReturnType<typeof useMateriaisCatalogo>
  fornecedores: Fornecedor[]
}

/** Variações do item e preço vigente + histórico ("Novo preço a partir de…"). */
export function ItemMaterialDetalhe({ item, onFechar, podeEditar, catalogo, fornecedores }: Props) {
  const { variacoes, precos, carregar, salvarVariacao, alternarVariacao, registrarPreco } = catalogo
  const hoje = hojeBrasil()
  const [novaVariacao, setNovaVariacao] = useState('')
  const [editandoVar, setEditandoVar] = useState<{ id: string; rotulo: string } | null>(null)
  const [preco, setPreco] = useState({ variacao: '', valor: '', desde: hoje, fornecedor: '' })
  const [salvando, setSalvando] = useState(false)

  if (!item) return null

  const doItem = variacoes.filter((v) => v.item_id === item.id)
  const nomeVar = new Map(doItem.map((v) => [v.id, v.rotulo]))
  const nomeForn = new Map(fornecedores.map((f) => [f.id, f.nome]))
  const varDuplicada = (rotulo: string, id?: string) =>
    nomeDuplicado(rotulo, doItem.map((v) => ({ id: v.id, nome: v.rotulo })), id)

  // Histórico: preço do item (variação nula) e de cada variação
  const grupos: { chave: string; titulo: string; variacaoId: string | null }[] = [
    { chave: 'item', titulo: 'Preço do item (vale para todas as variações sem preço próprio)', variacaoId: null },
    ...doItem.map((v) => ({ chave: v.id, titulo: `Variação: ${v.rotulo}`, variacaoId: v.id })),
  ]

  const valorPreco = lerNumero(preco.valor)
  const erroPreco = preco.valor.trim() ? validarNovoPreco(valorPreco, preco.desde) : null

  const adicionarVariacao = async () => {
    const rotulo = novaVariacao.trim()
    if (!rotulo || varDuplicada(rotulo)) return
    if (await salvarVariacao(item.id, rotulo)) {
      setNovaVariacao('')
      carregar()
    }
  }

  const renomearVariacao = async () => {
    if (!editandoVar) return
    const rotulo = editandoVar.rotulo.trim()
    if (!rotulo || varDuplicada(rotulo, editandoVar.id)) return
    if (await salvarVariacao(item.id, rotulo, editandoVar.id)) {
      setEditandoVar(null)
      carregar()
    }
  }

  const salvarPreco = async () => {
    if (validarNovoPreco(valorPreco, preco.desde)) return
    setSalvando(true)
    const ok = await registrarPreco({
      item_id: item.id,
      variacao_id: preco.variacao || null,
      fornecedor_id: preco.fornecedor || item.fornecedor_id || null,
      preco: valorPreco as number,
      vigente_desde: preco.desde,
    })
    setSalvando(false)
    if (ok) {
      setPreco({ variacao: '', valor: '', desde: hoje, fornecedor: '' })
      carregar()
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.nome}</DialogTitle>
          <DialogDescription>
            Unidade de pedido: {item.unidade_pedido}. O preço nunca é sobrescrito — cada mudança entra no histórico com a data de início.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Variações</h3>
          {doItem.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {item.tem_variacao ? 'Nenhuma variação cadastrada ainda.' : 'Este item não usa variações.'}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {doItem.map((v) => (
                <li key={v.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  {editandoVar?.id === v.id ? (
                    <>
                      <Input
                        value={editandoVar.rotulo}
                        onChange={(e) => setEditandoVar({ id: v.id, rotulo: e.target.value })}
                        className="h-8"
                        aria-label="Novo nome da variação"
                      />
                      <Button variant="ghost" size="icon" onClick={renomearVariacao} aria-label="Salvar variação">
                        <Check className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditandoVar(null)} aria-label="Cancelar">
                        <X className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1">{v.rotulo}</span>
                      <StatusBadge variant={v.ativo ? 'success' : 'neutral'}>{v.ativo ? 'Ativa' : 'Inativa'}</StatusBadge>
                      {podeEditar && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => setEditandoVar({ id: v.id, rotulo: v.rotulo })} aria-label={`Renomear ${v.rotulo}`}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => (await alternarVariacao(v.id, !v.ativo)) && carregar()}
                          >
                            {v.ativo ? 'Inativar' : 'Reativar'}
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {podeEditar && (
            <div className="flex gap-2">
              <Input
                value={novaVariacao}
                onChange={(e) => setNovaVariacao(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adicionarVariacao()}
                placeholder="Nova variação (ex.: 350 mm, amarela)"
                aria-label="Nova variação"
              />
              <Button variant="outline" onClick={adicionarVariacao} disabled={!novaVariacao.trim() || varDuplicada(novaVariacao)}>
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Preços</h3>
          {grupos.map((g) => {
            const historico = historicoPrecos(precos, item.id, g.variacaoId)
            const vigente = precoVigente(precos, item.id, g.variacaoId, hoje)
            if (g.variacaoId && historico.length === 0) return null
            return (
              <div key={g.chave} className="rounded-lg border border-border">
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm">
                  <span className="font-medium">{g.titulo}</span>
                  <span className="tabular-nums">
                    Vigente: {vigente == null ? <span className="text-muted-foreground">sem preço</span> : <strong>{mascaraMoeda(vigente)}</strong>}
                  </span>
                </div>
                {historico.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>A partir de</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Registrado em</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historico.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="tabular-nums">
                              {formatarData(p.vigente_desde)}
                              {p.vigente_desde > hoje && <span className="ml-2 text-xs text-amber-600">futuro</span>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{mascaraMoeda(Number(p.preco))}</TableCell>
                            <TableCell>{p.fornecedor_id ? (nomeForn.get(p.fornecedor_id) ?? '—') : '—'}</TableCell>
                            <TableCell className="tabular-nums">{p.created_at ? formatarDataDeTimestamp(p.created_at) : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )
          })}

          {podeEditar && (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
              <p className="text-sm font-medium">Novo preço a partir de…</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {doItem.length > 0 && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="preco-variacao">Vale para</Label>
                    <select
                      id="preco-variacao"
                      className={CLASSE_SELECT}
                      value={preco.variacao}
                      onChange={(e) => setPreco({ ...preco, variacao: e.target.value })}
                    >
                      <option value="">O item (todas as variações sem preço próprio)</option>
                      {doItem.map((v) => (
                        <option key={v.id} value={v.id}>
                          Só a variação {nomeVar.get(v.id)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="preco-valor">Preço (R$) *</Label>
                  <Input
                    id="preco-valor"
                    inputMode="decimal"
                    value={preco.valor}
                    onChange={(e) => setPreco({ ...preco, valor: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="preco-desde">Vigente a partir de *</Label>
                  <Input id="preco-desde" type="date" value={preco.desde} onChange={(e) => setPreco({ ...preco, desde: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="preco-fornecedor">Fornecedor</Label>
                  <select
                    id="preco-fornecedor"
                    className={CLASSE_SELECT}
                    value={preco.fornecedor}
                    onChange={(e) => setPreco({ ...preco, fornecedor: e.target.value })}
                  >
                    <option value="">Fornecedor do item</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {erroPreco && <p className="text-xs text-red-600">{erroPreco}</p>}
              <div className="flex justify-end">
                <Button onClick={salvarPreco} loading={salvando} disabled={!preco.valor.trim() || !!erroPreco}>
                  Registrar preço
                </Button>
              </div>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
