import { useMemo, useState } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { formatarData, hojeBrasil } from '@/lib/utils'
import { formatarCentavos } from '@/lib/vt/combinacoes'
import type { NovaCombinacaoVT } from '@/hooks/useVt'
import type { VtCombinacao } from '@/types/vt'

// Aba Combinações do VT (Fase 1, modelo de 21/10/2026 — plano §2d): cada
// combinação é um trajeto-tipo nomeado com valor diário fechado (ida+volta),
// COM VIGÊNCIA (padrão ceu_itens_precos) — reajuste = linha nova, nunca edita
// valor antigo.

/** "5,60" / "5.60" (R$) → centavos. Com vírgula, o ponto é milhar ("1.234,56"). */
function parseValorCentavos(texto: string): number | null {
  const limpo = texto.trim()
  if (!limpo) return null
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normalizado)
  if (!isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

interface VtCombinacoesTabProps {
  combinacoes: VtCombinacao[]
  loading: boolean
  podeGerenciar: boolean
  novaVigenciaCombinacao: (dados: NovaCombinacaoVT) => Promise<boolean>
  desativarCombinacao: (id: string) => Promise<boolean>
  recarregarCombinacoes: () => Promise<boolean>
}

export function VtCombinacoesTab({
  combinacoes,
  loading,
  podeGerenciar,
  novaVigenciaCombinacao,
  desativarCombinacao,
  recarregarCombinacoes,
}: VtCombinacoesTabProps) {
  const [dialogAberto, setDialogAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [vigenteDesde, setVigenteDesde] = useState(hojeBrasil())
  const [salvando, setSalvando] = useState(false)

  // Nomes já cadastrados: o datalist sugere (nova vigência de combinação
  // existente) e o texto livre permite criar combinação nova.
  const nomesExistentes = useMemo(
    () => [...new Set(combinacoes.map((c) => c.nome))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [combinacoes]
  )

  const abrirDialog = () => {
    setNome('')
    setValor('')
    setVigenteDesde(hojeBrasil())
    setDialogAberto(true)
  }

  const salvar = async () => {
    const centavos = parseValorCentavos(valor)
    if (!nome.trim() || centavos == null || !vigenteDesde) return
    setSalvando(true)
    const ok = await novaVigenciaCombinacao({
      nome: nome.trim(),
      valor_diario_centavos: centavos,
      vigente_desde: vigenteDesde,
    })
    setSalvando(false)
    if (ok) {
      await recarregarCombinacoes()
      setDialogAberto(false)
    }
  }

  const desativar = async (c: VtCombinacao) => {
    const ok = await desativarCombinacao(c.id)
    if (ok) await recarregarCombinacoes()
  }

  return (
    <ModuleCard
      title="Combinações de VT"
      description="Valor diário fechado (ida+volta) de cada trajeto-tipo — reajuste = nova vigência; o histórico nunca é editado"
    >
      {podeGerenciar && (
        <div className="mb-4 flex justify-end">
          <ModuleButton size="sm" onClick={abrirDialog}>
            <Plus className="size-4" />
            Nova vigência
          </ModuleButton>
        </div>
      )}
      {combinacoes.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-6" />}
          description={loading ? 'Carregando combinações...' : 'Nenhuma combinação cadastrada.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3 text-right">Valor/dia</th>
                <th className="px-4 py-3">Vigente desde</th>
                <th className="px-4 py-3">Ativa</th>
                {podeGerenciar && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {combinacoes.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-medium text-foreground">{c.nome}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatarCentavos(c.valor_diario_centavos)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {formatarData(c.vigente_desde)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge variant={c.ativo ? 'success' : 'neutral'}>
                      {c.ativo ? 'Ativa' : 'Inativa'}
                    </StatusBadge>
                  </td>
                  {podeGerenciar && (
                    <td className="px-4 py-2.5 text-right">
                      {c.ativo && (
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                          title="Desativar combinação"
                          onClick={() => desativar(c)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova vigência de combinação</DialogTitle>
            <DialogDescription>
              Reajuste entra como linha nova — a vigência anterior fica no histórico. Escolha um
              nome existente ou escreva um novo para criar outra combinação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="vt-comb-nome">Nome</Label>
              <Input
                id="vt-comb-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Niterói 1 ônibus (ida+volta)"
                list="vt-combinacoes-nomes"
                autoComplete="off"
              />
              <datalist id="vt-combinacoes-nomes">
                {nomesExistentes.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vt-comb-valor">Valor/dia (R$, ida+volta)</Label>
                <Input
                  id="vt-comb-valor"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="Ex.: 11,20"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vt-comb-vigencia">Vigente desde</Label>
                <Input
                  id="vt-comb-vigencia"
                  type="date"
                  value={vigenteDesde}
                  onChange={(e) => setVigenteDesde(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <ModuleButton variant="outline" onClick={() => setDialogAberto(false)} disabled={salvando}>
              Cancelar
            </ModuleButton>
            <ModuleButton onClick={salvar} disabled={!nome.trim() || !valor.trim() || !vigenteDesde || salvando}>
              {salvando ? 'Salvando...' : 'Cadastrar'}
            </ModuleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleCard>
  )
}
