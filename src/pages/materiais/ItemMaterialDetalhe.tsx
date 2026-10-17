import { useState } from 'react'
import { ArrowRightLeft, Check, Pencil, Plus, X } from 'lucide-react'
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
import type { MatItem, MatItemVariacao } from '@/types/materiais'
import { nomeExibicaoItem } from '@/lib/materiais/buscaItens'

interface Props {
  item: MatItem | null
  onFechar: () => void
  podeEditar: boolean
  catalogo: ReturnType<typeof useMateriaisCatalogo>
  fornecedores: Fornecedor[]
  /** "Substituir em todos os kits" — só para quem edita o kit (materiais.editar_kit). */
  onSubstituir?: () => void
}

/** Variações do item e preço vigente + histórico ("Novo preço a partir de…"). */
export function ItemMaterialDetalhe({ item, onFechar, podeEditar, catalogo, fornecedores, onSubstituir }: Props) {
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

        {onSubstituir && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Item descontinuado ou trocado por outro?</span>
            <Button variant="outline" size="sm" onClick={onSubstituir}>
              <ArrowRightLeft className="size-4" /> Substituir em todos os kits
            </Button>
          </div>
        )}

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

        <VisaoLiderSecao item={item} podeEditar={podeEditar} catalogo={catalogo} variacoes={doItem} />

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

/**
 * O que o líder vê no link do pedido (migration 136): nome para o líder,
 * contratos exclusivos e "Esconder do líder (é marca)" em cada variação.
 * As telas internas continuam mostrando o nome do cadastro e a marca.
 */
function VisaoLiderSecao({
  item,
  podeEditar,
  catalogo,
  variacoes,
}: {
  item: MatItem
  podeEditar: boolean
  catalogo: ReturnType<typeof useMateriaisCatalogo>
  variacoes: MatItemVariacao[]
}) {
  const { contratos, carregar, salvarVisaoLider, alternarOcultaLider } = catalogo
  const [nomeLider, setNomeLider] = useState(item.nome_lider ?? '')
  const [exclusivos, setExclusivos] = useState<string[]>(item.contratos_exclusivos ?? [])
  const [ocultos, setOcultos] = useState<string[]>(item.contratos_ocultos ?? [])
  const [salvando, setSalvando] = useState(false)
  const nomeContrato = new Map(contratos.map((c) => [c.id, c.nome]))
  const opcoes = contratos.filter((c) => c.ativo || exclusivos.includes(c.id))
  const opcoesOcultos = contratos.filter((c) => c.ativo || ocultos.includes(c.id))
  const original = {
    nome: item.nome_lider ?? '',
    exclusivos: [...(item.contratos_exclusivos ?? [])].sort().join(','),
    ocultos: [...(item.contratos_ocultos ?? [])].sort().join(','),
  }
  const mudou = nomeLider.trim() !== original.nome.trim() ||
    [...exclusivos].sort().join(',') !== original.exclusivos ||
    [...ocultos].sort().join(',') !== original.ocultos

  const salvar = async () => {
    setSalvando(true)
    const ok = await salvarVisaoLider(item.id, { nome_lider: nomeLider, contratos_exclusivos: exclusivos, contratos_ocultos: ocultos })
    setSalvando(false)
    if (ok) carregar()
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Link do líder</h3>
      {podeEditar ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="item-nome-lider">Nome para o líder (opcional)</Label>
            <Input
              id="item-nome-lider"
              value={nomeLider}
              onChange={(e) => setNomeLider(e.target.value)}
              placeholder={nomeExibicaoItem(item.nome)}
            />
            <p className="text-xs text-muted-foreground">
              Se vazio, usa o nome do cadastro sem a unidade. Itens com o mesmo nome para o líder aparecem como um só na busca do link.
            </p>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Exclusivo dos contratos</legend>
            <p className="text-xs text-muted-foreground">Nenhum marcado = todos os contratos podem pedir.</p>
            <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">
              {opcoes.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={exclusivos.includes(c.id)}
                    onChange={(e) =>
                      setExclusivos((xs) => (e.target.checked ? [...xs, c.id] : xs.filter((x) => x !== c.id)))
                    }
                  />
                  {c.nome}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Escondido destes contratos</legend>
            <p className="text-xs text-muted-foreground">
              O item some do link do líder nos contratos marcados. Se o item estiver no Kit Mensal do contrato, continua aparecendo.
            </p>
            <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">
              {opcoesOcultos.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ocultos.includes(c.id)}
                    onChange={(e) =>
                      setOcultos((xs) => (e.target.checked ? [...xs, c.id] : xs.filter((x) => x !== c.id)))
                    }
                  />
                  {c.nome}
                </label>
              ))}
            </div>
          </fieldset>
          <Button variant="outline" size="sm" onClick={salvar} loading={salvando} disabled={!mudou}>
            Salvar link do líder
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nome para o líder: {item.nome_lider || nomeExibicaoItem(item.nome)}.{' '}
          {(item.contratos_exclusivos ?? []).length > 0
            ? `Exclusivo de ${(item.contratos_exclusivos ?? []).map((id) => nomeContrato.get(id) ?? 'contrato removido').join(', ')}.`
            : 'Todos os contratos podem pedir.'}
        </p>
      )}
      {variacoes.length > 0 && (
        <ul className="space-y-1">
          {variacoes.map((v) => (
            <li key={v.id} className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!v.oculta_lider}
                  disabled={!podeEditar}
                  onChange={async (e) => (await alternarOcultaLider(v.id, e.target.checked)) && carregar()}
                />
                {v.rotulo}: esconder do líder (é marca)
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
