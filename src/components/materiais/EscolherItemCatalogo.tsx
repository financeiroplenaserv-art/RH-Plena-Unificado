import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buscarItens, type ItemBuscavel } from '@/lib/materiais/buscaItens'
import type { MatItem, MatItemVariacao } from '@/types/materiais'

// Escolha de item do catálogo (com a variação certa) nas telas INTERNAS do
// pedido: "Adicionar item" e "Ligar ao catálogo". Mesma busca tolerante a erro
// do link do líder (`buscarItens`): cada variação é um resultado próprio.

export interface ItemEscolhido {
  itemId: string
  variacaoId: string | null
  nome: string
}

type ItemComVariacoes = ItemBuscavel & { original: MatItem }

export function EscolherItemCatalogo({
  itens,
  variacoes,
  kitItemIds,
  escolhido,
  onEscolher,
  idBusca,
  aviso,
}: {
  itens: MatItem[]
  variacoes: MatItemVariacao[]
  /** Itens do Kit Mensal do contrato (pequena preferência na busca). */
  kitItemIds?: Set<string>
  escolhido: ItemEscolhido | null
  onEscolher: (e: ItemEscolhido | null) => void
  idBusca: string
  /** Aviso (sem bloquear) sobre o item escolhido: exclusivo/escondido do contrato. */
  aviso?: string | null
}) {
  const [termo, setTermo] = useState('')
  const buscaveis = useMemo<ItemComVariacoes[]>(
    () =>
      itens
        .filter((i) => i.ativo)
        .map((i) => ({
          id: i.id,
          nome: i.nome,
          nome_lider: null,
          noKit: kitItemIds?.has(i.id) ?? false,
          variacoes: variacoes.filter((v) => v.item_id === i.id && v.ativo).map((v) => ({ id: v.id, rotulo: v.rotulo })),
          original: i,
        })),
    [itens, variacoes, kitItemIds]
  )
  const resultados = useMemo(() => buscarItens(termo, buscaveis, 8), [termo, buscaveis])

  if (escolhido) {
    return (
      <div className="space-y-1.5">
        <Label>Item</Label>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{escolhido.nome}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-primary underline"
            onClick={() => {
              onEscolher(null)
              setTermo('')
            }}
          >
            <X className="size-3" /> Trocar
          </button>
        </div>
        {aviso && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{aviso}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={idBusca}>Buscar item do catálogo</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={idBusca} className="pl-9" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Digite o nome (ex.: vassoura noviça)" />
      </div>
      {termo.trim().length >= 3 && resultados.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum item encontrado. Tente outra palavra.</p>
      )}
      {resultados.length > 0 && (
        <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {resultados.map((r) => (
            <li key={`${r.item.id}|${r.variacao?.id ?? ''}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent/40"
                onClick={() => onEscolher({ itemId: r.item.id, variacaoId: r.variacao?.id ?? null, nome: r.nome })}
              >
                {r.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
