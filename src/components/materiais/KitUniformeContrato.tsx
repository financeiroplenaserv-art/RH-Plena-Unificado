import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Shirt, Trash2 } from 'lucide-react'
import { DataTable } from '@/components/corh/DataTable'
import { EmptyState } from '@/components/corh/EmptyState'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { Button } from '@/components/corh/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import { useMateriaisKitUniforme } from '@/hooks/useMateriaisKitUniforme'
import {
  FUNCOES_PECA,
  agruparItensEmPecas,
  chavePeca,
  nomeAmigavelPeca,
  opcoesDoGrupo,
  rotuloFuncoes,
  separarTamanhoDoNome,
  type FuncaoPeca,
} from '@/lib/materiais/pecasCeu'
import type { MatContratoCeuItem } from '@/types/materiais'

// Kit de uniforme/EPI do contrato (migration 129): as peças que o líder vê no
// link, por função. Cada linha aponta para UM item do CEU e a peça inteira
// (todos os tamanhos ativos) entra — o agrupamento é derivado do nome.
// Referência para o líder escolher, não limite de quantidade.

const ROTULO_ORIGEM: Record<MatContratoCeuItem['origem'], string> = {
  form: 'Google Forms',
  ceu: 'Histórico do CEU',
  form_ceu: 'Forms + CEU',
  manual: 'Manual',
}

interface FormPeca {
  id: string | null
  chave: string
  rotulo: string
  funcoes: FuncaoPeca[]
  ordem: string
  ativo: boolean
}

export function KitUniformeContrato({ contratoId, podeEditar }: { contratoId: string; podeEditar: boolean }) {
  const { linhas, itensCeu, loading, estruturaPendente, carregar, salvar, remover } = useMateriaisKitUniforme()
  const [form, setForm] = useState<FormPeca | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [retirar, setRetirar] = useState<MatContratoCeuItem | null>(null)

  useEffect(() => {
    if (contratoId) carregar(contratoId)
  }, [contratoId, carregar])

  const grupos = useMemo(() => agruparItensEmPecas(itensCeu), [itensCeu])
  const chaveDoItem = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of itensCeu) m.set(i.id, chavePeca(separarTamanhoDoNome(i.nome).base, i.tipo))
    return m
  }, [itensCeu])

  const linhasExibidas = useMemo(
    () =>
      linhas
        .map((l) => {
          const g = grupos.get(chaveDoItem.get(l.item_id) ?? '')
          const tamanhos = g ? opcoesDoGrupo(g).map((o) => o.tamanho).filter(Boolean) : []
          return { linha: l, chave: g?.chave ?? '', nome: l.rotulo?.trim() || (g ? nomeAmigavelPeca(g.base) : 'Item removido do CEU'), tipo: g?.tipo, tamanhos }
        })
        .sort((a, b) => (a.tipo === b.tipo ? (a.linha.ordem ?? 9999) - (b.linha.ordem ?? 9999) || a.nome.localeCompare(b.nome, 'pt-BR') : a.tipo === 'uniforme' ? -1 : 1)),
    [linhas, grupos, chaveDoItem]
  )
  const chavesUsadas = new Set(linhasExibidas.map((l) => l.chave))
  const pecasDisponiveis = [...grupos.values()]
    .filter((g) => g.itens.some((i) => i.ativo) && (!chavesUsadas.has(g.chave) || g.chave === form?.chave))
    .sort((a, b) => (a.tipo === b.tipo ? a.base.localeCompare(b.base, 'pt-BR') : a.tipo === 'uniforme' ? -1 : 1))

  const abrir = (l?: (typeof linhasExibidas)[number]) =>
    setForm(
      l
        ? {
            id: l.linha.id,
            chave: l.chave,
            rotulo: l.linha.rotulo ?? '',
            funcoes: l.linha.funcoes.filter((f): f is FuncaoPeca => FUNCOES_PECA.some((x) => x.id === f)),
            ordem: l.linha.ordem == null ? '' : String(l.linha.ordem),
            ativo: l.linha.ativo,
          }
        : { id: null, chave: '', rotulo: '', funcoes: [], ordem: '', ativo: true }
    )

  const handleSalvar = async () => {
    if (!form || !form.chave) return
    const g = grupos.get(form.chave)
    const representante = form.id ? linhas.find((l) => l.id === form.id)?.item_id : (g?.itens.find((i) => i.ativo) ?? g?.itens[0])?.id
    if (!representante) return
    const ordem = form.ordem.trim() === '' ? null : Number(form.ordem)
    setSalvando(true)
    const ok = await salvar(
      contratoId,
      {
        item_id: representante,
        rotulo: form.rotulo.trim() || null,
        funcoes: form.funcoes,
        ordem: Number.isInteger(ordem) ? ordem : null,
        ativo: form.ativo,
      },
      form.id
    )
    setSalvando(false)
    if (ok) {
      setForm(null)
      carregar(contratoId)
    }
  }

  if (estruturaPendente) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        As peças de uniforme/EPI por contrato dependem da atualização do banco (migration 129). Até lá, o link do líder mostra todas as peças do CEU.
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Peças que o líder vê no link, por função. Referência para escolher, não limite de quantidade.</p>
        {podeEditar && (
          <Button size="sm" onClick={() => abrir()}>
            <Plus className="size-4" /> Incluir peça
          </Button>
        )}
      </div>
      <DataTable title="Uniformes e EPIs do contrato" count={linhasExibidas.length}>
        {loading ? (
          <LoadingScreen className="h-40" />
        ) : linhasExibidas.length === 0 ? (
          <EmptyState
            icon={<Shirt className="size-6" />}
            title="Sem peças cadastradas"
            description="Enquanto não houver peças, o link do líder mostra todas as peças do CEU. Inclua as que este contrato usa."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Peça (como o líder vê)</TableHead>
                <TableHead>Para quem</TableHead>
                <TableHead>Tamanhos</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasExibidas.map((l) => (
                <TableRow key={l.linha.id} className={`hover:bg-accent/40 ${l.linha.ativo ? '' : 'opacity-60'}`}>
                  <TableCell>
                    <span className="font-medium">{l.nome}</span>
                    <span className="block text-xs text-muted-foreground">
                      {l.tipo === 'epi' ? 'EPI' : 'Uniforme'}
                      {!l.linha.ativo && ' · desativada'}
                    </span>
                  </TableCell>
                  <TableCell>{l.linha.funcoes.length ? rotuloFuncoes(l.linha.funcoes as FuncaoPeca[]) : 'Todas as funções'}</TableCell>
                  <TableCell className="tabular-nums">{l.tamanhos.length ? l.tamanhos.join(' · ') : 'Único'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ROTULO_ORIGEM[l.linha.origem] ?? l.linha.origem}</TableCell>
                  <TableCell>
                    {podeEditar && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => abrir(l)} aria-label={`Editar ${l.nome}`} title="Editar">
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setRetirar(l.linha)} aria-label={`Retirar ${l.nome}`} title="Retirar">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>

      <Dialog open={!!form} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Editar peça' : 'Incluir peça'}</DialogTitle>
            <DialogDescription>Todos os tamanhos ativos da peça entram. É referência para o líder, não limite de quantidade.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="peca-item">Peça *</Label>
                <select
                  id="peca-item"
                  className={CLASSE_SELECT}
                  value={form.chave}
                  disabled={!!form.id}
                  onChange={(e) => setForm({ ...form, chave: e.target.value })}
                >
                  <option value="">Escolha a peça…</option>
                  {pecasDisponiveis.map((g) => (
                    <option key={g.chave} value={g.chave}>
                      {g.tipo === 'epi' ? 'EPI' : 'Uniforme'} · {nomeAmigavelPeca(g.base)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="peca-rotulo">Nome para o líder (opcional)</Label>
                <Input
                  id="peca-rotulo"
                  value={form.rotulo}
                  maxLength={120}
                  placeholder="Ex.: Camisa polo azul clara — ASG"
                  onChange={(e) => setForm({ ...form, rotulo: e.target.value })}
                />
              </div>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Para quem (nenhuma marcada = todas as funções)</legend>
                <div className="grid grid-cols-2 gap-2">
                  {FUNCOES_PECA.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.funcoes.includes(f.id)}
                        onChange={(e) =>
                          setForm({ ...form, funcoes: e.target.checked ? [...form.funcoes, f.id] : form.funcoes.filter((x) => x !== f.id) })
                        }
                      />
                      {f.rotulo}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="peca-ordem">Ordem</Label>
                  <Input id="peca-ordem" inputMode="numeric" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value.replace(/\D/g, '') })} />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                  Aparece no link do líder
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} loading={salvando} disabled={!form?.chave}>
              Salvar peça
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!retirar}
        onOpenChange={(aberto) => !aberto && setRetirar(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Retirar peça do contrato?"
        description="A peça deixa de aparecer no link do líder deste contrato. Para esconder só por um tempo, edite e desmarque “Aparece no link do líder”."
        confirmLabel="Retirar"
        destructive
        onConfirm={async () => {
          if (retirar && (await remover(retirar.id))) carregar(contratoId)
          setRetirar(null)
        }}
      />
    </>
  )
}
