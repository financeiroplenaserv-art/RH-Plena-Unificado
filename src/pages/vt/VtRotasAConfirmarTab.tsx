import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, GitBranch, Loader2 } from 'lucide-react'
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
import { carregarApoioRotasAConfirmar, type ApoioRotasAConfirmar } from '@/lib/vt/apoioRotasAConfirmar'
import { criarTrajetoParaRevisao, MigracaoTrajetoSemBilhetePendente } from '@/lib/vt/criarTrajetoRevisao'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { hojeBrasil } from '@/lib/utils'
import { textoDestinoPosto, textoOrigemCasa } from '@/lib/vt/enderecos'
import { fatosCartaoDoCadastro } from '@/lib/vt/motor/adaptadorItinerario'
import {
  filtrarRotasAConfirmar,
  indiceRevisavel,
  montarRotasAConfirmar,
  proximaRotaRevisavel,
  revisaoConfirmada,
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
  endereco_mudou: 'warning',
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
  const [decisoes, setDecisoes] = useState<Map<string, DecisaoRotaResumo> | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [busca, setBusca] = useState('')
  const [postoId, setPostoId] = useState(TODOS_OS_POSTOS)
  const [soCarga, setSoCarga] = useState(false)
  const [apoio, setApoio] = useState<ApoioRotasAConfirmar | null>(null)
  const [revisando, setRevisando] = useState<ItemRotaAConfirmar | null>(null)
  const [indiceAoAbrir, setIndiceAoAbrir] = useState(0)
  const [abrindo, setAbrindo] = useState<string | null>(null)

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

  // Apoio (21/11/2026): o que a escala do mês exige (coberturas/treinamentos por vir e
  // postos das cargas) e o endereço guardado nas rotas já confirmadas. Falha aqui não
  // derruba a fila: ela segue só com o posto principal e avisa.
  const chaveConfirmadas = useMemo(
    () =>
      decisoes
        ? trajetos.filter((t) => revisaoConfirmada(decisoes.get(t.id))).map((t) => t.id).sort().join(',')
        : null,
    [trajetos, decisoes],
  )
  useEffect(() => {
    if (chaveConfirmadas === null) return
    let ativo = true
    carregarApoioRotasAConfirmar({
      hoje: hojeBrasil(),
      nomePosto: (id) => nomeCurtoDepartamentoFuzzy(departamentos, id, '') || '—',
      trajetoIdsConfirmados: chaveConfirmadas ? chaveConfirmadas.split(',') : [],
    })
      .then((dados) => {
        if (ativo) setApoio(dados)
      })
      .catch((erro) => {
        console.error('Erro ao carregar a escala do mês para a fila de rotas', erro)
        toast.warning('Não foi possível carregar as exigências do mês; a fila mostra só o posto principal')
        if (ativo) setApoio({ exigencias: [], origemConfirmada: new Map() })
      })
    return () => {
      ativo = false
    }
  }, [chaveConfirmadas, departamentos, recarga])

  const itens = useMemo(
    () =>
      decisoes && apoio
        ? montarRotasAConfirmar({
            colaboradores,
            departamentos,
            trajetos,
            decisoes,
            exigencias: apoio.exigencias,
            origemConfirmada: apoio.origemConfirmada,
          })
        : [],
    [colaboradores, departamentos, trajetos, decisoes, apoio],
  )
  const filtrados = useMemo(
    () => filtrarRotasAConfirmar(itens, { busca, postoId, soCarga }),
    [itens, busca, postoId, soCarga],
  )
  const postos = useMemo(() => {
    const porId = new Map<string, string>()
    for (const i of itens) porId.set(i.departamentoId, i.nomePosto)
    return [...porId.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [itens])
  const contagem = useMemo(() => {
    const c: Record<MotivoRotaAConfirmar, number> = { sugerida: 0, endereco_mudou: 0, antiga: 0, sem_rota: 0 }
    for (const i of itens) c[i.motivo] += 1
    return c
  }, [itens])
  const precisamDaCarga = useMemo(() => itens.filter((i) => i.precisaCarga).length, [itens])

  const carregando = loading || decisoes === null || apoio === null

  const atualizar = useCallback(() => {
    void recarregarTrajetos()
    setRecarga((n) => n + 1)
  }, [recarregarTrajetos])

  // Toda rota da fila é revisável: a que ainda não tem trajeto ganha o trajeto
  // 'sugerido' (sem bilhete legado) e a decisão aberta antes de o painel abrir.
  const abrir = async (item: ItemRotaAConfirmar) => {
    if (abrindo) return
    setIndiceAoAbrir(Math.max(0, indiceRevisavel(filtrados, item.chave)))
    let pronto = item
    if (!item.trajetoId || !decisoes?.has(item.trajetoId)) {
      setAbrindo(item.chave)
      try {
        const colab = colaboradores.find((c) => c.id === item.colaboradorId)
        const dep = departamentos.find((d) => d.id === item.departamentoId)
        const criado = await criarTrajetoParaRevisao({
          colaboradorId: item.colaboradorId,
          departamentoId: item.departamentoId,
          cidadeCasa: colab?.cidade ?? null,
          enderecoCasa: colab?.endereco ?? null,
          cidadePosto: dep?.cidade ?? null,
          hoje: hojeBrasil(),
        })
        pronto = { ...item, trajetoId: criado.trajetoId }
        atualizar()
        if (criado.trajetoCriado) toast.success('Trajeto criado — escolha a rota e confirme o preço')
      } catch (erro) {
        if (erro instanceof MigracaoTrajetoSemBilhetePendente) {
          toast.warning('Ainda não dá para criar o trajeto por aqui: falta aplicar a migration 175 no banco. Cadastre em Trajetos.')
        } else {
          console.error('Erro ao criar o trajeto para revisão', erro)
          toast.error('Não foi possível criar o trajeto para revisar a rota')
        }
        setAbrindo(null)
        return
      }
      setAbrindo(null)
    }
    setRevisando(pronto)
  }

  const proximaDaFila = () => {
    if (!revisando) return
    const proxima = proximaRotaRevisavel(filtrados, revisando.chave, indiceAoAbrir)
    if (!proxima) {
      toast.success('Fim da fila: não há mais rotas para revisar.')
      setRevisando(null)
      return
    }
    void abrir(proxima)
  }

  // O painel só recarrega a decisão quando o trajeto muda (ver VtRevisaoRota), então
  // o objeto de contexto pode ser recriado a cada render.
  const contexto = (() => {
    if (!revisando?.trajetoId) return null
    const colab = colaboradores.find((c) => c.id === revisando.colaboradorId)
    const dep = departamentos.find((d) => d.id === revisando.departamentoId)
    if (!colab) return null
    return {
      trajetoLegadoId: revisando.trajetoId,
      colaboradorId: colab.id,
      departamentoId: revisando.departamentoId,
      usuarioId,
      origem: textoOrigemCasa(colab.endereco, colab.cidade, colab.cep ?? null),
      destino: dep ? textoDestinoPosto(dep) : revisando.nomePosto,
      departamentosApoio: departamentos,
      municipioOrigem: colab.cidade ?? 'desconhecida',
      municipioDestino: dep?.cidade ?? 'desconhecida',
      precisao: revisando.precisaoOrigem === 'exato' ? ('exata' as const) : ('bairro' as const),
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
          Fila dos optantes que ainda precisam ter a <strong>rota real</strong> revisada e confirmada, no posto
          principal e nos postos que a escala do mês exige (coberturas, treinamentos e escala).
          Abra <strong>Revisar</strong>, escolha a ida e a volta e confirme o trajeto e o preço. Quem já tem
          rota sugerida aparece logo depois do que a carga do mês precisa: só falta confirmar. Quem não tem rota
          cadastrada ganha o trajeto ao abrir. Nada é confirmado sozinho.
        </p>
      </ModuleCard>

      <ModuleCard
        title="Rotas a confirmar"
        description={
          carregando
            ? 'Carregando...'
            : `${itens.length} ${itens.length === 1 ? 'rota a confirmar' : 'rotas a confirmar'} — ${contagem.sugerida} sugeridas, ${contagem.endereco_mudou} com endereço novo, ${contagem.antiga} antigas, ${contagem.sem_rota} sem rota. A carga do mês precisa de ${precisamDaCarga}.`
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_16rem_auto] sm:items-end">
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
          <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={soCarga}
              onChange={(e) => setSoCarga(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Só o que a carga do mês precisa
          </label>
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
                      {item.motivos.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                          {item.motivos.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      )}
                      {item.motivo === 'endereco_mudou' && (
                        <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                          <p>
                            <span className="font-medium text-foreground">Antes:</span> {item.enderecoAntes}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Agora:</span> {item.enderecoAgora}
                          </p>
                          <p>A rota antiga continua valendo até você revisar.</p>
                        </div>
                      )}
                      {item.avisos.map((aviso) => (
                        <p key={aviso} className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                          <AlertTriangle className="size-3 shrink-0" />
                          {aviso}
                        </p>
                      ))}
                    </td>
                    <td className="px-3 py-2.5 text-right align-top">
                      <ModuleButton
                        size="sm"
                        variant="outline"
                        disabled={!podeGerenciar || abrindo !== null}
                        title={podeGerenciar ? undefined : 'Só quem gerencia o VT pode revisar rotas'}
                        onClick={() => void abrir(item)}
                      >
                        {abrindo === item.chave ? <Loader2 className="size-4 animate-spin" /> : <GitBranch className="size-4" />}
                        {item.trajetoId ? 'Revisar' : 'Criar e revisar'}
                      </ModuleButton>
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
