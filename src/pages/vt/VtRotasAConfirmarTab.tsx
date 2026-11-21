import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, GitBranch } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { ModuleButton, ModuleCard } from '@/components/layout/ModuleShell'
import { RepositorioItinerarioSupabase } from '@/lib/vt/repositorioItinerarioSupabase'
import { textoDestinoPosto, textoOrigemCasa } from '@/lib/vt/enderecos'
import { fatosCartaoDoCadastro } from '@/lib/vt/motor/adaptadorItinerario'
import {
  filtrarRotasAConfirmar,
  indiceRevisavel,
  montarRotasAConfirmar,
  proximaRotaRevisavel,
  TODOS_OS_POSTOS,
  type DecisaoRotaResumo,
  type ItemRotaAConfirmar,
  type MotivoRotaAConfirmar,
} from '@/lib/vt/rotasAConfirmar'
import { VtRevisaoRota } from '@/pages/vt/VtRevisaoRota'
import type { VtColaborador, VtDepartamento, VtTrajetoComDetalhes } from '@/hooks/useVt'

// Aba "Rotas a confirmar" (21/11/2026): fila dos optantes cujo trajeto ainda não
// tem a rota revisada e confirmada. Fica numa aba própria (e não como filtro da
// aba Trajetos) porque tem contador, ordem e botão "Próxima" próprios, e a aba
// Trajetos já é densa. Nada é confirmado aqui: a ação "Revisar" abre o mesmo
// painel VtRevisaoRota e a confirmação é sempre humana.

interface VtRotasAConfirmarTabProps {
  colaboradores: VtColaborador[]
  departamentos: VtDepartamento[]
  trajetos: VtTrajetoComDetalhes[]
  loading: boolean
  usuarioId: string
  podeGerenciar: boolean
  recarregarTrajetos: () => Promise<boolean>
}

const VARIANTE_MOTIVO: Record<MotivoRotaAConfirmar, 'info' | 'warning' | 'neutral'> = {
  sugerida: 'info',
  antiga: 'warning',
  sem_rota: 'neutral',
}

export function VtRotasAConfirmarTab({
  colaboradores,
  departamentos,
  trajetos,
  loading,
  usuarioId,
  podeGerenciar,
  recarregarTrajetos,
}: VtRotasAConfirmarTabProps) {
  const navigate = useNavigate()
  const [decisoes, setDecisoes] = useState<Map<string, DecisaoRotaResumo> | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [busca, setBusca] = useState('')
  const [postoId, setPostoId] = useState(TODOS_OS_POSTOS)
  const [revisando, setRevisando] = useState<ItemRotaAConfirmar | null>(null)
  const [indiceAoAbrir, setIndiceAoAbrir] = useState(0)

  const chaveTrajetos = useMemo(() => trajetos.map((t) => t.id).sort().join(','), [trajetos])
  useEffect(() => {
    let ativo = true
    const ids = chaveTrajetos ? chaveTrajetos.split(',') : []
    new RepositorioItinerarioSupabase()
      .buscarResumoDecisoesPorTrajetos(ids)
      .then((mapa) => {
        if (ativo) setDecisoes(mapa)
      })
      .catch((erro) => {
        console.error('Erro ao carregar as decisões dos trajetos', erro)
        toast.error('Não foi possível carregar a situação das rotas')
        if (ativo) setDecisoes(new Map())
      })
    return () => {
      ativo = false
    }
  }, [chaveTrajetos, recarga])

  const itens = useMemo(
    () =>
      decisoes
        ? montarRotasAConfirmar({ colaboradores, departamentos, trajetos, decisoes })
        : [],
    [colaboradores, departamentos, trajetos, decisoes],
  )
  const filtrados = useMemo(() => filtrarRotasAConfirmar(itens, { busca, postoId }), [itens, busca, postoId])
  const postos = useMemo(() => {
    const porId = new Map<string, string>()
    for (const i of itens) porId.set(i.departamentoId, i.nomePosto)
    return [...porId.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [itens])
  const contagem = useMemo(() => {
    const c: Record<MotivoRotaAConfirmar, number> = { sugerida: 0, antiga: 0, sem_rota: 0 }
    for (const i of itens) c[i.motivo] += 1
    return c
  }, [itens])

  const carregando = loading || decisoes === null

  const abrir = (item: ItemRotaAConfirmar) => {
    setIndiceAoAbrir(Math.max(0, indiceRevisavel(filtrados, item.chave)))
    setRevisando(item)
  }

  const proximaDaFila = () => {
    if (!revisando) return
    const proxima = proximaRotaRevisavel(filtrados, revisando.chave, indiceAoAbrir)
    if (!proxima) {
      toast.success('Fim da fila: não há mais rotas para revisar.')
      setRevisando(null)
      return
    }
    setIndiceAoAbrir(Math.max(0, indiceRevisavel(filtrados, proxima.chave)))
    setRevisando(proxima)
  }
  const atualizar = useCallback(() => {
    void recarregarTrajetos()
    setRecarga((n) => n + 1)
  }, [recarregarTrajetos])

  // O painel só recarrega a decisão quando o trajeto muda (ver VtRevisaoRota), então
  // o objeto de contexto pode ser recriado a cada render.
  const contexto = (() => {
    if (!revisando?.trajetoId) return null
    const trajeto = trajetos.find((t) => t.id === revisando.trajetoId)
    const colab = colaboradores.find((c) => c.id === revisando.colaboradorId)
    const dep = departamentos.find((d) => d.id === revisando.departamentoId)
    if (!trajeto || !colab) return null
    return {
      trajetoLegadoId: trajeto.id,
      colaboradorId: colab.id,
      departamentoId: revisando.departamentoId,
      usuarioId,
      origem: textoOrigemCasa(colab.endereco, colab.cidade, colab.cep ?? null),
      destino: dep ? textoDestinoPosto(dep) : revisando.nomePosto,
      departamentosApoio: departamentos,
      municipioOrigem: colab.cidade ?? 'desconhecida',
      municipioDestino: dep?.cidade ?? 'desconhecida',
      precisao: trajeto.precisao_origem === 'exato' ? ('exata' as const) : ('bairro' as const),
      cartao: fatosCartaoDoCadastro(colab.vt_bu_situacao ?? null, colab.vt_bu_consultado_em ?? null, {
        tarifaCheia: colab.vt_tarifa_cheia === true,
        motivo: colab.vt_tarifa_cheia_motivo ?? null,
      }),
      onSalvo: atualizar,
      onConfirmado: atualizar,
      onFechar: () => setRevisando(null),
      onProxima: proximaDaFila,
    }
  })()

  return (
    <div className="space-y-4">
      <ModuleCard>
        <p className="text-[13px] text-muted-foreground">
          Fila dos optantes que ainda precisam ter a <strong>rota real</strong> revisada e confirmada.
          Abra <strong>Revisar</strong>, escolha a ida e a volta e confirme o trajeto e o preço. Quem já tem
          rota sugerida aparece primeiro: só falta confirmar. Nada é confirmado sozinho.
        </p>
      </ModuleCard>

      <ModuleCard
        title="Rotas a confirmar"
        description={
          carregando
            ? 'Carregando...'
            : `${itens.length} ${itens.length === 1 ? 'rota a confirmar' : 'rotas a confirmar'} — ${contagem.sugerida} sugeridas, ${contagem.antiga} antigas, ${contagem.sem_rota} sem rota`
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_16rem]">
          <div className="space-y-1.5">
            <Label htmlFor="vt-rotas-busca">Nome</Label>
            <Input
              id="vt-rotas-busca"
              placeholder="Buscar por nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vt-rotas-posto">Posto</Label>
            <Select value={postoId} onValueChange={setPostoId}>
              <SelectTrigger id="vt-rotas-posto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_OS_POSTOS}>Todos os postos</SelectItem>
                {postos.map(([id, nome]) => (
                  <SelectItem key={id} value={id}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-6" />}
            description={
              carregando
                ? 'Carregando rotas...'
                : itens.length === 0
                  ? 'Nenhuma rota a confirmar. Todas as rotas dos optantes estão revisadas.'
                  : 'Nenhuma rota encontrada com esses filtros.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-3">Colaborador</th>
                  <th className="px-3 py-3">Posto</th>
                  <th className="px-3 py-3">Situação</th>
                  <th className="px-3 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item) => (
                  <tr key={item.chave} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-3 py-2.5 align-top font-medium text-foreground">{item.nome}</td>
                    <td className="px-3 py-2.5 align-top text-muted-foreground">{item.nomePosto}</td>
                    <td className="px-3 py-2.5 align-top">
                      <StatusBadge variant={VARIANTE_MOTIVO[item.motivo]} dot={false}>
                        {item.rotulo}
                      </StatusBadge>
                      {item.avisos.map((aviso) => (
                        <p key={aviso} className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                          <AlertTriangle className="size-3 shrink-0" />
                          {aviso}
                        </p>
                      ))}
                    </td>
                    <td className="px-3 py-2.5 text-right align-top">
                      {item.trajetoId ? (
                        <ModuleButton
                          size="sm"
                          variant="outline"
                          disabled={!podeGerenciar}
                          title={podeGerenciar ? undefined : 'Só quem gerencia o VT pode revisar rotas'}
                          onClick={() => abrir(item)}
                        >
                          <GitBranch className="size-4" />
                          Revisar
                        </ModuleButton>
                      ) : (
                        <ModuleButton
                          size="sm"
                          variant="ghost"
                          title="Cadastre o trajeto na aba Trajetos para poder revisar a rota"
                          onClick={() => navigate('/vt/trajetos')}
                        >
                          Cadastrar em Trajetos
                        </ModuleButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModuleCard>

      {revisando && contexto && (
        <Dialog open onOpenChange={(aberto) => { if (!aberto) setRevisando(null) }}>
          <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Revisar rota — {revisando.nome}</DialogTitle>
              <DialogDescription>
                Casa → {revisando.nomePosto}. {revisando.rotulo}.
              </DialogDescription>
            </DialogHeader>
            <VtRevisaoRota key={revisando.chave} contextoReal={contexto} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
