import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ArrowDown, ArrowUp, BadgeDollarSign, Users } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { ModuleButton, ModuleCard } from '@/components/layout/ModuleShell'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { ordenarPorNome, type DirecaoNome } from '@/lib/vt/ordenacao'
import type { VtColaborador, VtDepartamento } from '@/hooks/useVt'
import type { TipoCartaoVT, VtTrajeto } from '@/types/vt'
import { BuRiocardBadge } from './BuRiocardBadge'
import { ConsultaRiocardAcoes } from './ConsultaRiocardAcoes'

// Aba Colaboradores do VT: marca o optante ("Usa VT") e MOSTRA a situação do
// Bilhete Único na Riocard (somente leitura). A API da Alterdata não expõe VT
// (plano §3).
//
// `colaboradores.vt_tipo_cartao` (bun/bui/jae/comum) está APOSENTADO na UI
// (decisão da gestora em 19/11/2026): não entra no cálculo e induzia erro
// (ex.: marcar BUI para quem tem BU suspenso). A fonte é a Riocard
// (vt_bu_situacao / vt_bu_consultado_em). A coluna segue no banco, intocada;
// o valor atual é só repassado ao salvar para não ser sobrescrito.

type FiltroBu = 'todos' | 'nao_consultado' | string

const SITUACOES_BU = [
  'Ativado',
  'Suspenso Setrans',
  'Não possui BU',
  'Desativado',
  'Ativação Solicitada',
]

interface VtColaboradoresTabProps {
  colaboradores: VtColaborador[]
  departamentos: VtDepartamento[]
  /** Trajetos gravados — desmarcar "Usa VT" de quem tem trajeto pede confirmação. */
  trajetos: VtTrajeto[]
  loading: boolean
  podeGerenciar: boolean
  salvarVtColaborador: (
    id: string,
    dados: { vt_optante: boolean; vt_tipo_cartao: TipoCartaoVT | null }
  ) => Promise<boolean>
  /** Selo "Ferista": carteira ativa OU cobertura em andamento/agendada (decisão da gestora, 23/10/2026). */
  ehFerista: (colaboradorId: string) => boolean
  /**
   * Exceção da empresa "pagar tarifa cheia" (migration 174, 19/11/2026). Sem a
   * função, a coluna fica só leitura.
   */
  /** Mostra "Consultar na Riocard" + "Copiar CPF" (só com `colaborador.ver_cpf_completo`). */
  podeVerCpf?: boolean
  salvarExcecaoTarifaCheia?: (id: string, dados: { tarifaCheia: boolean; motivo: string | null }) => Promise<boolean>
}

export function VtColaboradoresTab({
  colaboradores,
  departamentos,
  trajetos,
  loading,
  podeGerenciar,
  salvarVtColaborador,
  ehFerista,
  salvarExcecaoTarifaCheia,
  podeVerCpf = false,
}: VtColaboradoresTabProps) {
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [situacao, setSituacao] = useState<'todos' | 'optantes' | 'nao_optantes'>('todos')
  const [situacaoAplicada, setSituacaoAplicada] = useState<'todos' | 'optantes' | 'nao_optantes'>('todos')
  const [situacaoBu, setSituacaoBu] = useState<FiltroBu>('todos')
  const [situacaoBuAplicada, setSituacaoBuAplicada] = useState<FiltroBu>('todos')
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [direcaoNome, setDirecaoNome] = useState<DirecaoNome>('az')
  // Desmarcar "Usa VT" de quem TEM trajetos gravados pede confirmação — os
  // trajetos deixam de valer na carga (mas NÃO são excluídos automaticamente).
  const [desmarcando, setDesmarcando] = useState<{ colaborador: VtColaborador; totalTrajetos: number } | null>(null)
  // Exceção "pagar tarifa cheia": marcar pede motivo; desmarcar pede confirmação.
  const [marcandoExcecao, setMarcandoExcecao] = useState<VtColaborador | null>(null)
  const [motivoExcecao, setMotivoExcecao] = useState('')
  const [removendoExcecao, setRemovendoExcecao] = useState<VtColaborador | null>(null)
  const podeEditarExcecao = podeGerenciar && !!salvarExcecaoTarifaCheia

  const filtrados = useMemo(() => {
    const termo = buscaAplicada.trim().toLowerCase()
    let base = termo
      ? colaboradores.filter((c) => c.nome_completo.toLowerCase().includes(termo))
      : colaboradores
    if (situacaoAplicada === 'optantes') base = base.filter((c) => c.vt_optante)
    if (situacaoAplicada === 'nao_optantes') base = base.filter((c) => !c.vt_optante)
    if (situacaoBuAplicada === 'nao_consultado') base = base.filter((c) => !c.vt_bu_situacao)
    else if (situacaoBuAplicada !== 'todos') base = base.filter((c) => c.vt_bu_situacao === situacaoBuAplicada)
    return ordenarPorNome(base, (c) => c.nome_completo, direcaoNome)
  }, [colaboradores, buscaAplicada, situacaoAplicada, situacaoBuAplicada, direcaoNome])

  const aplicarFiltros = () => {
    setBuscaAplicada(busca)
    setSituacaoAplicada(situacao)
    setSituacaoBuAplicada(situacaoBu)
  }
  const limparFiltros = () => {
    setBusca('')
    setBuscaAplicada('')
    setSituacao('todos')
    setSituacaoAplicada('todos')
    setSituacaoBu('todos')
    setSituacaoBuAplicada('todos')
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

  const aoMarcarOptante = (c: VtColaborador, marcado: boolean) => {
    if (!marcado) {
      const totalTrajetos = trajetos.filter((t) => t.colaborador_id === c.id).length
      if (totalTrajetos > 0) {
        setDesmarcando({ colaborador: c, totalTrajetos })
        return
      }
    }
    void salvar(c, { vt_optante: marcado, vt_tipo_cartao: c.vt_tipo_cartao ?? null })
  }

  const gravarExcecao = async (c: VtColaborador, tarifaCheia: boolean, motivo: string | null) => {
    if (!salvarExcecaoTarifaCheia) return
    setSalvandoId(c.id)
    await salvarExcecaoTarifaCheia(c.id, { tarifaCheia, motivo })
    setSalvandoId(null)
  }

  const confirmarMarcarExcecao = () => {
    if (!marcandoExcecao || !motivoExcecao.trim()) return
    void gravarExcecao(marcandoExcecao, true, motivoExcecao.trim())
    setMarcandoExcecao(null)
    setMotivoExcecao('')
  }

  const confirmarRemoverExcecao = () => {
    if (!removendoExcecao) return
    void gravarExcecao(removendoExcecao, false, null)
    setRemovendoExcecao(null)
  }

  const confirmarDesmarcar = () => {
    if (!desmarcando) return
    void salvar(desmarcando.colaborador, { vt_optante: false, vt_tipo_cartao: desmarcando.colaborador.vt_tipo_cartao ?? null })
    setDesmarcando(null)
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
          <Label htmlFor="vt-bu">BU na Riocard</Label>
          <Select value={situacaoBu} onValueChange={setSituacaoBu}>
            <SelectTrigger id="vt-bu">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {SITUACOES_BU.map((situacao) => (
                <SelectItem key={situacao} value={situacao}>
                  {situacao}
                </SelectItem>
              ))}
              <SelectItem value="nao_consultado">Não consultado</SelectItem>
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
                  <th className="px-4 py-3">BU na Riocard</th>
                  <th className="px-4 py-3">Integração</th>
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
                        {c.vt_tarifa_cheia && (
                          <span title={`Motivo: ${c.vt_tarifa_cheia_motivo ?? '—'}`}>
                            <StatusBadge variant="warning" dot={false}>
                              Tarifa cheia (exceção)
                            </StatusBadge>
                          </span>
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
                        onCheckedChange={(marcado) => aoMarcarOptante(c, marcado === true)}
                        aria-label={`Usa VT — ${c.nome_completo}`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <BuRiocardBadge
                        situacao={c.vt_bu_situacao}
                        ativado={c.vt_bu_ativado}
                        consultadoEm={c.vt_bu_consultado_em}
                        mostrarConsulta
                      />
                      {podeVerCpf && <ConsultaRiocardAcoes cpf={c.cpf} nome={c.nome_completo} />}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.vt_tarifa_cheia ? (
                        podeEditarExcecao ? (
                          <ModuleButton
                            size="sm"
                            variant="ghost"
                            disabled={salvandoId === c.id}
                            title={`Motivo: ${c.vt_tarifa_cheia_motivo ?? '—'}`}
                            onClick={() => setRemovendoExcecao(c)}
                          >
                            Remover exceção
                          </ModuleButton>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">Tarifa cheia</span>
                        )
                      ) : podeEditarExcecao ? (
                        <ModuleButton
                          size="sm"
                          variant="ghost"
                          disabled={salvandoId === c.id}
                          onClick={() => {
                            setMotivoExcecao('')
                            setMarcandoExcecao(c)
                          }}
                        >
                          Exceção: pagar tarifa cheia
                        </ModuleButton>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">Presumida</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModuleCard>

      <ConfirmDialog
        open={!!desmarcando}
        onOpenChange={() => setDesmarcando(null)}
        icon={<AlertTriangle className="size-6 text-amber-600" />}
        iconClassName="bg-amber-50"
        title="Desmarcar o vale-transporte?"
        description={
          desmarcando
            ? `Ele tem ${desmarcando.totalTrajetos} trajeto(s) cadastrado(s), que deixam de valer na carga. Quer desmarcar mesmo assim?`
            : ''
        }
        confirmLabel="Sim, desmarcar"
        onConfirm={confirmarDesmarcar}
      />

      <ConfirmDialog
        open={!!marcandoExcecao}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setMarcandoExcecao(null)
            setMotivoExcecao('')
          }
        }}
        icon={<BadgeDollarSign className="size-6 text-amber-600" />}
        iconClassName="bg-amber-50"
        title="Pagar tarifa cheia para esta pessoa?"
        description={
          marcandoExcecao
            ? `Pela política da empresa, o VT é calculado com a integração do Bilhete Único. Com a exceção, ${marcandoExcecao.nome_completo} passa a receber a tarifa cheia de cada condução, sem integração. Vale para os próximos cálculos; o que já foi gravado não muda.`
            : ''
        }
        confirmLabel="Registrar exceção"
        confirmDisabled={!motivoExcecao.trim()}
        onConfirm={confirmarMarcarExcecao}
      >
        <div className="space-y-1.5">
          <Label htmlFor="vt-motivo-tarifa-cheia">Motivo (obrigatório)</Label>
          <Textarea
            id="vt-motivo-tarifa-cheia"
            value={motivoExcecao}
            onChange={(e) => setMotivoExcecao(e.target.value)}
            placeholder="Por que a empresa decidiu pagar a tarifa cheia?"
            rows={3}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!removendoExcecao}
        onOpenChange={() => setRemovendoExcecao(null)}
        icon={<AlertTriangle className="size-6 text-amber-600" />}
        iconClassName="bg-amber-50"
        title="Remover a exceção de tarifa cheia?"
        description={
          removendoExcecao
            ? `${removendoExcecao.nome_completo} volta à política padrão: o VT passa a ser calculado com a integração do Bilhete Único. O que já foi gravado não muda.`
            : ''
        }
        confirmLabel="Sim, remover"
        onConfirm={confirmarRemoverExcecao}
      />
    </div>
  )
}
