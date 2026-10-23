import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Users } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Filters } from '@/components/corh/Filters'
import { EmptyState } from '@/components/corh/EmptyState'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { ModuleCard } from '@/components/layout/ModuleShell'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { ordenarPorNome, type DirecaoNome } from '@/lib/vt/ordenacao'
import type { VtColaborador, VtDepartamento } from '@/hooks/useVt'
import type { TipoCartaoVT } from '@/types/vt'

// Aba Colaboradores do VT (Fase 1): marca o optante e o tipo de bilhete.
// Cadastro manual — a API da Alterdata não expõe VT (plano §3).

const TIPOS_CARTAO: { valor: TipoCartaoVT; label: string }[] = [
  { valor: 'bun', label: 'Bilhete Único Niterói' },
  { valor: 'bui', label: 'Bilhete Único Intermunicipal' },
  { valor: 'comum', label: 'Comum' },
]

interface VtColaboradoresTabProps {
  colaboradores: VtColaborador[]
  departamentos: VtDepartamento[]
  loading: boolean
  podeGerenciar: boolean
  salvarVtColaborador: (
    id: string,
    dados: { vt_optante: boolean; vt_tipo_cartao: TipoCartaoVT | null }
  ) => Promise<boolean>
  /** Selo "Ferista": carteira ativa OU cobertura em andamento/agendada (decisão da gestora, 23/10/2026). */
  ehFerista: (colaboradorId: string) => boolean
}

export function VtColaboradoresTab({
  colaboradores,
  departamentos,
  loading,
  podeGerenciar,
  salvarVtColaborador,
  ehFerista,
}: VtColaboradoresTabProps) {
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [situacao, setSituacao] = useState<'todos' | 'optantes' | 'nao_optantes'>('todos')
  const [situacaoAplicada, setSituacaoAplicada] = useState<'todos' | 'optantes' | 'nao_optantes'>('todos')
  const [bilhete, setBilhete] = useState<'todos' | TipoCartaoVT | 'sem_tipo'>('todos')
  const [bilheteAplicado, setBilheteAplicado] = useState<'todos' | TipoCartaoVT | 'sem_tipo'>('todos')
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [direcaoNome, setDirecaoNome] = useState<DirecaoNome>('az')

  const filtrados = useMemo(() => {
    const termo = buscaAplicada.trim().toLowerCase()
    let base = termo
      ? colaboradores.filter((c) => c.nome_completo.toLowerCase().includes(termo))
      : colaboradores
    if (situacaoAplicada === 'optantes') base = base.filter((c) => c.vt_optante)
    if (situacaoAplicada === 'nao_optantes') base = base.filter((c) => !c.vt_optante)
    if (bilheteAplicado === 'sem_tipo') base = base.filter((c) => c.vt_optante && !c.vt_tipo_cartao)
    else if (bilheteAplicado !== 'todos') base = base.filter((c) => c.vt_tipo_cartao === bilheteAplicado)
    return ordenarPorNome(base, (c) => c.nome_completo, direcaoNome)
  }, [colaboradores, buscaAplicada, situacaoAplicada, bilheteAplicado, direcaoNome])

  const aplicarFiltros = () => {
    setBuscaAplicada(busca)
    setSituacaoAplicada(situacao)
    setBilheteAplicado(bilhete)
  }
  const limparFiltros = () => {
    setBusca('')
    setBuscaAplicada('')
    setSituacao('todos')
    setSituacaoAplicada('todos')
    setBilhete('todos')
    setBilheteAplicado('todos')
  }

  const optantes = useMemo(() => colaboradores.filter((c) => c.vt_optante).length, [colaboradores])

  const salvar = async (
    colaborador: VtColaborador,
    dados: { vt_optante: boolean; vt_tipo_cartao: TipoCartaoVT | null }
  ) => {
    setSalvandoId(colaborador.id)
    const ok = await salvarVtColaborador(colaborador.id, dados)
    setSalvandoId(null)
    if (ok) toast.success(`VT de ${colaborador.nome_completo} salvo`)
  }

  return (
    <div className="space-y-4">
      <Filters onApply={aplicarFiltros} onClear={limparFiltros} loading={loading}>
        <div className="space-y-1.5">
          <Label htmlFor="vt-busca">Nome</Label>
          <Input
            id="vt-busca"
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vt-situacao">Situação VT</Label>
          <Select value={situacao} onValueChange={(v) => setSituacao(v as typeof situacao)}>
            <SelectTrigger id="vt-situacao">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="optantes">Só optantes</SelectItem>
              <SelectItem value="nao_optantes">Só não optantes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vt-bilhete">Tipo de bilhete</Label>
          <Select value={bilhete} onValueChange={(v) => setBilhete(v as typeof bilhete)}>
            <SelectTrigger id="vt-bilhete">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {TIPOS_CARTAO.map((t) => (
                <SelectItem key={t.valor} value={t.valor}>
                  {t.label}
                </SelectItem>
              ))}
              <SelectItem value="sem_tipo">Optante sem tipo escolhido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Filters>

      <ModuleCard
        title="Optantes do vale-transporte"
        description={`${optantes} optantes de ${colaboradores.length} colaboradores ativos`}
      >
        {filtrados.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            description={loading ? 'Carregando colaboradores...' : 'Nenhum colaborador encontrado.'}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
                      title={direcaoNome === 'az' ? 'Ordenar Z→A' : 'Ordenar A→Z'}
                      onClick={() => setDirecaoNome((d) => (d === 'az' ? 'za' : 'az'))}
                    >
                      Nome
                      {direcaoNome === 'az' ? (
                        <ArrowUp className="size-3.5" />
                      ) : (
                        <ArrowDown className="size-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3">Posto</th>
                  <th className="px-4 py-3">Cidade</th>
                  <th className="px-4 py-3 text-center">Usa VT</th>
                  <th className="px-4 py-3">Tipo de bilhete</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <span className="inline-flex items-center gap-2">
                        {c.nome_completo}
                        {ehFerista(c.id) && (
                          <StatusBadge variant="info" dot={false}>
                            Ferista
                          </StatusBadge>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {nomeCurtoDepartamentoFuzzy(departamentos, c.departamento_id, c.departamento)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.cidade || '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Checkbox
                        checked={!!c.vt_optante}
                        disabled={!podeGerenciar || salvandoId === c.id}
                        onCheckedChange={(marcado) =>
                          salvar(c, {
                            vt_optante: marcado === true,
                            vt_tipo_cartao: c.vt_tipo_cartao ?? null,
                          })
                        }
                        aria-label={`Usa VT — ${c.nome_completo}`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Select
                        value={c.vt_tipo_cartao ?? ''}
                        disabled={!podeGerenciar || !c.vt_optante || salvandoId === c.id}
                        onValueChange={(v) =>
                          salvar(c, { vt_optante: true, vt_tipo_cartao: v as TipoCartaoVT })
                        }
                      >
                        <SelectTrigger className="h-8 w-56 text-[13px]">
                          <SelectValue placeholder="Escolha o bilhete" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_CARTAO.map((t) => (
                            <SelectItem key={t.valor} value={t.valor}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModuleCard>
    </div>
  )
}
