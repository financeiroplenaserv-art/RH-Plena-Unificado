import { useEffect, useMemo, useState } from 'react'
import { Ticket, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { formatarCentavos, parseValorCentavos } from '@/lib/vt/bilhetes'
import type { NovoBilheteVT } from '@/hooks/useVt'
import type { TipoCartaoVT, VtBilhete } from '@/types/vt'

// Aba Bilhetes do VT (Fase 1, modelo de 21/10/2026 — plano §2d; "combinação"
// virou "bilhete", termo da operação): cada bilhete é um trajeto-tipo nomeado
// com valor diário fechado (ida+volta), COM VIGÊNCIA (padrão
// ceu_itens_precos) — reajuste = linha nova, nunca edita valor antigo.
// Migration 165 (27/10/2026): o bilhete também diz QUAL CARTÃO a pessoa
// precisa ter e SE depende de integração (a carga é feita naquele cartão; se
// o trajeto depende de integração e o cartão dela não tem, o valor carregado
// não basta na prática).

/** Opções do "Qual cartão" (migration 165). Vazio = ainda não classificado. */
const OPCOES_CARTAO: { valor: TipoCartaoVT; label: string }[] = [
  { valor: 'bun', label: 'BUN (Niterói)' },
  { valor: 'bui', label: 'BUI (intermunicipal)' },
  { valor: 'jae', label: 'JAE (RJ)' },
  { valor: 'comum', label: 'Comum (sem cartão de integração)' },
]

const SEM_CARTAO = '__sem_cartao__'

interface VtBilhetesTabProps {
  bilhetes: VtBilhete[]
  loading: boolean
  podeGerenciar: boolean
  novaVigenciaBilhete: (dados: NovoBilheteVT) => Promise<boolean>
  desativarBilhete: (id: string) => Promise<boolean>
  recarregarBilhetes: () => Promise<boolean>
}

export function VtBilhetesTab({
  bilhetes,
  loading,
  podeGerenciar,
  novaVigenciaBilhete,
  desativarBilhete,
  recarregarBilhetes,
}: VtBilhetesTabProps) {
  const [dialogAberto, setDialogAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [vigenteDesde, setVigenteDesde] = useState(hojeBrasil())
  const [cartao, setCartao] = useState<TipoCartaoVT | ''>('')
  const [usaIntegracao, setUsaIntegracao] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Nomes já cadastrados: o datalist sugere (nova vigência de bilhete
  // existente) e o texto livre permite criar bilhete novo.
  const nomesExistentes = useMemo(
    () => [...new Set(bilhetes.map((b) => b.nome))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [bilhetes]
  )

  // Nova vigência de bilhete EXISTENTE: pré-preenche cartão/integração da
  // vigência mais recente — sem isso, um reajuste "esqueceria" a classificação
  // e os avisos de cartão sumiriam da aba Trajetos.
  useEffect(() => {
    if (!dialogAberto) return
    const digitado = nome.trim()
    if (!digitado) return
    const maisRecente = bilhetes
      .filter((b) => b.nome === digitado)
      .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0]
    if (maisRecente) {
      setCartao(maisRecente.cartao_necessario ?? '')
      setUsaIntegracao(!!maisRecente.usa_integracao)
    }
  }, [nome, bilhetes, dialogAberto])

  // Tabela por valor/dia, do menor para o maior (ajuste da gestora, 22/10/2026);
  // empate de valor → nome A→Z. Ordena o array renderizado — a query do banco
  // segue por vigente_desde.
  const bilhetesOrdenados = useMemo(
    () =>
      [...bilhetes].sort(
        (a, b) =>
          a.valor_diario_centavos - b.valor_diario_centavos ||
          a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
      ),
    [bilhetes]
  )

  const abrirDialog = () => {
    setNome('')
    setValor('')
    setVigenteDesde(hojeBrasil())
    setCartao('')
    setUsaIntegracao(false)
    setDialogAberto(true)
  }

  const salvar = async () => {
    const centavos = parseValorCentavos(valor)
    if (!nome.trim() || centavos == null || !vigenteDesde) return
    setSalvando(true)
    const ok = await novaVigenciaBilhete({
      nome: nome.trim(),
      valor_diario_centavos: centavos,
      vigente_desde: vigenteDesde,
      cartao_necessario: cartao || null,
      usa_integracao: usaIntegracao,
    })
    setSalvando(false)
    if (ok) {
      await recarregarBilhetes()
      setDialogAberto(false)
    }
  }

  const desativar = async (b: VtBilhete) => {
    const ok = await desativarBilhete(b.id)
    if (ok) await recarregarBilhetes()
  }

  return (
    <ModuleCard
      title="Bilhetes de VT"
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
      {bilhetes.length === 0 ? (
        <EmptyState
          icon={<Ticket className="size-6" />}
          description={loading ? 'Carregando bilhetes...' : 'Nenhum bilhete cadastrado.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3 text-right">Valor/dia</th>
                <th className="px-4 py-3">Vigente desde</th>
                <th className="px-4 py-3">Ativo</th>
                {podeGerenciar && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {bilhetesOrdenados.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-medium text-foreground">{b.nome}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatarCentavos(b.valor_diario_centavos)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {formatarData(b.vigente_desde)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge variant={b.ativo ? 'success' : 'neutral'}>
                      {b.ativo ? 'Ativo' : 'Inativo'}
                    </StatusBadge>
                  </td>
                  {podeGerenciar && (
                    <td className="px-4 py-2.5 text-right">
                      {b.ativo && (
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                          title="Desativar bilhete"
                          onClick={() => desativar(b)}
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
            <DialogTitle>Nova vigência de bilhete</DialogTitle>
            <DialogDescription>
              Reajuste entra como linha nova — a vigência anterior fica no histórico. Escolha um
              nome existente ou escreva um novo para criar outro bilhete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="vt-bilhete-nome">Nome</Label>
              <Input
                id="vt-bilhete-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: BU NITERÓI"
                list="vt-bilhetes-nomes"
                autoComplete="off"
              />
              <datalist id="vt-bilhetes-nomes">
                {nomesExistentes.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vt-bilhete-valor">Valor/dia (R$, ida+volta)</Label>
                <Input
                  id="vt-bilhete-valor"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="Ex.: 11,20"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vt-bilhete-vigencia">Vigente desde</Label>
                <Input
                  id="vt-bilhete-vigencia"
                  type="date"
                  value={vigenteDesde}
                  onChange={(e) => setVigenteDesde(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vt-bilhete-cartao">Qual cartão (opcional)</Label>
              <Select
                value={cartao || SEM_CARTAO}
                onValueChange={(v) => setCartao(v === SEM_CARTAO ? '' : (v as TipoCartaoVT))}
              >
                <SelectTrigger id="vt-bilhete-cartao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_CARTAO}>Ainda não classificado</SelectItem>
                  {OPCOES_CARTAO.map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                É o cartão em que a carga é feita. A aba Trajetos avisa quando o cartão do
                cadastro da pessoa não é este.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="vt-bilhete-integracao"
                checked={usaIntegracao}
                onCheckedChange={(marcado) => setUsaIntegracao(marcado === true)}
              />
              <Label htmlFor="vt-bilhete-integracao" className="cursor-pointer text-muted-foreground">
                Tem integração (2+ conduções numa tarifa só)
              </Label>
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
