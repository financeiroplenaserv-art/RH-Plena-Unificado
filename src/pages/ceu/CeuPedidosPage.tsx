import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ClipboardList, IdCard, PackageCheck, ShoppingCart, UserCheck } from 'lucide-react'
import { CeuShell } from './CeuShell'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { FiltrosAtivosBadge } from '@/components/corh/FiltrosAtivosBadge'
import { DataTable } from '@/components/corh/DataTable'
import { EmptyState } from '@/components/corh/EmptyState'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { Button } from '@/components/corh/Button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingScreen } from '@/components/LoadingScreen'
import { EstruturaPendente } from '@/components/materiais/EstruturaPendente'
import { CLASSE_SELECT } from '@/components/materiais/estilos'
import { Selo } from '@/components/materiais/filas'
import { ROTULO_STATUS_LINHA_CEU, rotuloCompetencia } from '@/components/materiais/rotulosFilas'
import { SeletorColaborador } from '@/components/materiais/SeletorColaborador'
import { useAuth } from '@/hooks/useAuth'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { useCeuPedidos } from '@/hooks/useCeuPedidos'
import { podeAtenderPedidoCEU, podeConferirPedidoCEU, podeEmitirCrachaCEU } from '@/lib/permissoes'
import { formatarData, formatarDataHora, hojeBrasil } from '@/lib/utils'
import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import {
  analisarTamanho,
  entregaRecente,
  etapaLinhaCeu,
  faltaComprar,
  idsEquipeDoContrato,
  montarAtendimento,
  origemDaLinha,
  qtdParaAtender,
  sugerirColaboradores,
  type EtapaCeu,
} from '@/lib/materiais/filas'
import { toast } from 'sonner'
import type { CeuPedidoItem } from '@/types/materiais'

// Aba CEU → Pedidos (docs/PLANO_MATERIAIS_FASE1.md §4.3 e §5.1). O líder
// digita nomes no link público; aqui a inspetoria identifica cada nome no
// cadastro (sugestão por similaridade dentro da equipe do contrato, ou outro
// colaborador — ferista), confere tamanho/quantidade e a Beth atende. O saldo
// do CEU é só referência e nunca bloqueia. Entregas NÃO são lançadas aqui.

interface FiltroCeuPedidos {
  etapa: 'abertas' | EtapaCeu
  contrato: string
}
const FILTRO_PADRAO: FiltroCeuPedidos = { etapa: 'abertas', contrato: 'todos' }

const ROTULO_TIPO: Record<CeuPedidoItem['tipo'], string> = { uniforme: 'Uniforme', epi: 'EPI', cracha: 'Crachá' }

interface Escolha {
  id: string
  nome: string
}
interface EdicaoConferencia {
  qtd: string
  motivo: string
  cancelar: boolean
}
interface EdicaoAtendimento {
  sel: boolean
  qtd: string
  motivo: string
}

export function CeuPedidosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const nivel = user?.nivel_acesso
  const podeConferir = nivel ? podeConferirPedidoCEU(nivel) : false
  const podeAtender = nivel ? podeAtenderPedidoCEU(nivel) : false
  const podeCrachas = nivel ? podeEmitirCrachaCEU(nivel) : false
  const podeIdentificar = podeConferir || podeAtender

  const dados = useCeuPedidos()
  const [filtro, setFiltro] = useFiltroPersistente<FiltroCeuPedidos>('ceu.pedidos.filtro', FILTRO_PADRAO)
  const [rascunho, setRascunho] = useState<FiltroCeuPedidos>(filtro)
  const [escolhas, setEscolhas] = useState<Record<string, Escolha | null>>({})
  const [conferencia, setConferencia] = useState<Record<string, EdicaoConferencia>>({})
  const [atendimento, setAtendimento] = useState<Record<string, EdicaoAtendimento>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const hoje = hojeBrasil()

  const { carregar } = dados
  const modoCarga = filtro.etapa === 'concluida' ? 'concluidas' : 'abertas'
  useEffect(() => {
    carregar(modoCarga)
  }, [carregar, modoCarga])

  const recarregar = async () => {
    setEscolhas({})
    setConferencia({})
    setAtendimento({})
    await carregar(modoCarga)
  }

  const pedidoPorId = useMemo(() => new Map(dados.pedidos.map((p) => [p.id, p])), [dados.pedidos])
  const contratoPorId = useMemo(() => new Map(dados.contratos.map((c) => [c.id, c])), [dados.contratos])
  const itemPorId = useMemo(() => new Map(dados.itens.map((i) => [i.id, i])), [dados.itens])
  const colabPorId = useMemo(() => new Map(dados.colaboradores.map((c) => [c.id, c])), [dados.colaboradores])
  const ativos = useMemo(() => dados.colaboradores.filter((c) => c.status !== 'Inativo'), [dados.colaboradores])

  /** Equipe por contrato (nome_curto do departamento, com linhas irmãs). */
  const equipes = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const c of dados.contratos) m.set(c.id, idsEquipeDoContrato(dados.departamentos, ativos, c.departamento_id))
    return m
  }, [dados.contratos, dados.departamentos, ativos])

  const linhasVisiveis = useMemo(
    () =>
      dados.linhas.filter((l) => {
        const p = pedidoPorId.get(l.pedido_id)
        if (filtro.contrato !== 'todos' && p?.contrato_id !== filtro.contrato) return false
        if (filtro.etapa === 'abertas' || filtro.etapa === 'concluida') return true
        return etapaLinhaCeu(l.status) === filtro.etapa
      }),
    [dados.linhas, pedidoPorId, filtro]
  )

  const grupos = useMemo(() => {
    const m = new Map<string, CeuPedidoItem[]>()
    for (const l of linhasVisiveis) m.set(l.pedido_id, [...(m.get(l.pedido_id) ?? []), l])
    return [...m.entries()]
      .map(([pedidoId, linhas]) => ({ pedido: pedidoPorId.get(pedidoId), linhas }))
      .sort((a, b) =>
        (contratoPorId.get(a.pedido?.contrato_id ?? '')?.nome ?? '').localeCompare(contratoPorId.get(b.pedido?.contrato_id ?? '')?.nome ?? '', 'pt-BR')
      )
  }, [linhasVisiveis, pedidoPorId, contratoPorId])

  // Sugestão inicial: o mais parecido da equipe (o inspetor confirma ou troca).
  const sugestoes = useMemo(() => {
    const m = new Map<string, ReturnType<typeof sugerirColaboradores>>()
    for (const l of dados.linhas) {
      if (l.status !== 'a_identificar') continue
      const p = pedidoPorId.get(l.pedido_id)
      const equipe = p ? equipes.get(p.contrato_id) : undefined
      const candidatos = equipe ? ativos.filter((c) => equipe.has(c.id)) : []
      m.set(l.id, sugerirColaboradores(l.nome_digitado, candidatos))
    }
    return m
  }, [dados.linhas, pedidoPorId, equipes, ativos])

  const escolhaDe = (l: CeuPedidoItem): Escolha | null => {
    if (l.id in escolhas) return escolhas[l.id]
    const s = sugestoes.get(l.id)?.[0]
    return s ? { id: s.id, nome: s.nome } : null
  }

  const colaboradorDaLinha = (l: CeuPedidoItem): Escolha | null => {
    if (l.colaborador_id) return { id: l.colaborador_id, nome: colabPorId.get(l.colaborador_id)?.nome_completo ?? 'Colaborador' }
    return escolhaDe(l)
  }

  const analise = (l: CeuPedidoItem) => {
    const colab = colaboradorDaLinha(l)
    const item = l.item_id ? itemPorId.get(l.item_id) : undefined
    const tam = l.tipo === 'cracha' ? null : analisarTamanho(item?.nome ?? null, l.tamanho, colab ? dados.tamanhos.get(colab.id) : null)
    const ultima = colab && l.item_id ? (dados.ultimasEntregas.get(`${colab.id}|${l.item_id}`) ?? l.ultima_entrega_em) : l.ultima_entrega_em
    return {
      colab,
      item,
      tamanhoCadastro: tam?.tamanhoCadastro ?? l.tamanho_cadastro,
      diverge: tam ? tam.diverge : l.alerta_tamanho,
      ultima,
      recente: entregaRecente(ultima, item?.prazo_uso_dias, hoje),
    }
  }

  const saldos = useMemo(() => new Map(dados.itens.map((i) => [i.id, i.estoque])), [dados.itens])
  const falta = useMemo(() => faltaComprar(linhasVisiveis, saldos), [linhasVisiveis, saldos])

  // ---------- ações ----------

  const identificar = async (linhas: CeuPedidoItem[]) => {
    const payload = linhas
      .filter((l) => l.status === 'a_identificar')
      .map((l) => {
        const e = escolhaDe(l)
        if (!e) return null
        const p = pedidoPorId.get(l.pedido_id)
        const a = analise({ ...l, colaborador_id: e.id })
        return {
          id: l.id,
          colaborador_id: e.id,
          tamanho_cadastro: a.tamanhoCadastro ?? null,
          alerta_tamanho: a.diverge,
          fora_da_equipe: p ? !(equipes.get(p.contrato_id)?.has(e.id) ?? false) : false,
        }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
    setOcupado('identificar')
    const ok = await dados.identificar(payload)
    setOcupado(null)
    if (ok) await recarregar()
  }

  const conferir = async (pedidoId: string, linhas: CeuPedidoItem[]) => {
    const alvo = linhas.filter((l) => l.status === 'pendente' || (l.status === 'a_identificar' && conferencia[l.id]?.cancelar))
    const payload = []
    for (const l of alvo) {
      const e = conferencia[l.id]
      const qtd = e?.qtd.trim() ? Number(e.qtd) : null
      if (e?.cancelar) {
        if (!e.motivo.trim()) return toast.error(`Informe o motivo para cancelar "${l.nome_digitado}"`)
        payload.push({ id: l.id, qtd_conferida: null, motivo_ajuste: e.motivo.trim(), cancelar: true })
        continue
      }
      if (qtd != null && (!Number.isInteger(qtd) || qtd < 0)) return toast.error(`Quantidade inválida em "${l.nome_digitado}"`)
      if (qtd != null && qtd !== l.qtd_pedida && !e?.motivo.trim()) return toast.error(`Informe o motivo do ajuste em "${l.nome_digitado}"`)
      payload.push({ id: l.id, qtd_conferida: qtd, motivo_ajuste: e?.motivo.trim() || null, cancelar: false })
    }
    setOcupado(`conferir-${pedidoId}`)
    const ok = await dados.conferir(pedidoId, payload)
    setOcupado(null)
    if (ok) await recarregar()
  }

  const atender = async (linhas: CeuPedidoItem[]) => {
    const selecionadas = linhas.filter((l) => atendimento[l.id]?.sel)
    const edicoes: Record<string, { qtd: number | null; motivo: string }> = {}
    for (const l of selecionadas) {
      const e = atendimento[l.id]
      edicoes[l.id] = { qtd: e?.qtd.trim() ? Number(e.qtd) : null, motivo: e?.motivo ?? '' }
    }
    const { itens, erros } = montarAtendimento(selecionadas, edicoes)
    if (erros.length) return toast.error(erros.join(' · '))
    setOcupado('atender')
    const ok = await dados.atender(itens, new Map(selecionadas.map((l) => [l.id, qtdParaAtender(l)])))
    setOcupado(null)
    if (ok) await recarregar()
  }

  const abrirCrachas = (linhas: CeuPedidoItem[]) => {
    const ids = [...new Set(linhas.filter((l) => l.tipo === 'cracha' && l.colaborador_id).map((l) => l.colaborador_id as string))]
    if (ids.length === 0) return toast.error('Identifique os colaboradores dos crachás primeiro')
    navigate('/ceu/crachas', { state: { colaboradorIds: ids } })
  }

  const limpar = () => {
    setRascunho(FILTRO_PADRAO)
    setFiltro(FILTRO_PADRAO)
  }
  const filtrosAtivos = (filtro.etapa !== FILTRO_PADRAO.etapa ? 1 : 0) + (filtro.contrato !== FILTRO_PADRAO.contrato ? 1 : 0)

  return (
    <CeuShell>
      <PageHeader
        showBackButton={false}
        title="Pedidos de uniforme, EPI e crachá"
        description="Pedidos dos líderes. A inspetoria identifica o colaborador e confere; o CEU atende. O saldo é só referência."
      >
        <Link to="/ceu/lancamento-rapido" className="text-sm font-medium text-primary underline">
          Lançar entrega
        </Link>
      </PageHeader>

      {dados.estruturaPendente ? (
        <EstruturaPendente />
      ) : (
        <div className="space-y-4">
          <FiltrosAtivosBadge total={filtrosAtivos} onLimpar={limpar} />
          <Filters onApply={() => setFiltro(rascunho)} onClear={limpar} loading={dados.loading}>
            <div className="space-y-1.5">
              <Label htmlFor="ceu-ped-etapa">Etapa</Label>
              <select
                id="ceu-ped-etapa"
                className={CLASSE_SELECT}
                value={rascunho.etapa}
                onChange={(e) => setRascunho((r) => ({ ...r, etapa: e.target.value as FiltroCeuPedidos['etapa'] }))}
              >
                <option value="abertas">Todas em aberto</option>
                <option value="identificar">Identificar colaborador</option>
                <option value="conferir">Conferir (inspetoria)</option>
                <option value="atender">Atender (CEU)</option>
                <option value="concluida">Atendidas e canceladas</option>
              </select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="ceu-ped-contrato">Contrato</Label>
              <select
                id="ceu-ped-contrato"
                className={CLASSE_SELECT}
                value={rascunho.contrato}
                onChange={(e) => setRascunho((r) => ({ ...r, contrato: e.target.value }))}
              >
                <option value="todos">Todos</option>
                {dados.contratos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </Filters>

          {filtro.etapa !== 'concluida' && falta.length > 0 && (
            <DataTable title={<span className="flex items-center gap-2"><ShoppingCart className="size-4" /> O que falta comprar</span>} count={falta.filter((f) => f.falta > 0).length} minWidth={560}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peça</TableHead>
                    <TableHead className="text-right">A atender</TableHead>
                    <TableHead className="text-right">Saldo do CEU (referência)</TableHead>
                    <TableHead className="text-right">Falta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {falta.map((f) => (
                    <TableRow key={f.item_id} className="hover:bg-accent/40">
                      <TableCell>{itemPorId.get(f.item_id)?.nome ?? 'Peça'}</TableCell>
                      <TableCell className="text-right tabular-nums">{f.aAtender}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{f.saldo ?? '—'}</TableCell>
                      <TableCell className={`text-right tabular-nums ${f.falta > 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {f.falta}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTable>
          )}

          {dados.loading ? (
            <LoadingScreen className="h-48" />
          ) : grupos.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card shadow-sm">
              <EmptyState icon={<ClipboardList className="size-6" />} title="Nenhuma linha" description="Não há pedidos de uniforme, EPI ou crachá com esses filtros." />
            </div>
          ) : (
            grupos.map(({ pedido, linhas }) => {
              const contrato = pedido ? contratoPorId.get(pedido.contrato_id) : undefined
              const aIdentificar = linhas.filter((l) => l.status === 'a_identificar')
              const aConferir = linhas.filter((l) => l.status === 'pendente')
              const aAtender = linhas.filter((l) => l.status === 'conferido' || l.status === 'ajustado')
              const temCracha = linhas.some((l) => l.tipo === 'cracha' && l.colaborador_id)
              const pid = pedido?.id ?? linhas[0].pedido_id
              return (
                <DataTable
                  key={pid}
                  minWidth={1100}
                  count={linhas.length}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{contrato?.nome ?? 'Contrato'}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {contrato ? nomeCurtoDepartamentoFuzzy(dados.departamentos, contrato.departamento_id) : ''}
                        {pedido ? ` · ${rotuloCompetencia(pedido.competencia)}` : ''}
                      </span>
                      {pedido?.tipo === 'extra' && <Selo tom="azul">extra</Selo>}
                      {pedido?.origem === 'operacional' && <Selo tom="cinza">pedido interno</Selo>}
                    </span>
                  }
                >
                  <div className="flex flex-wrap justify-end gap-2 border-b border-border px-4 py-2">
                    {podeIdentificar && aIdentificar.length > 0 && (
                      <Button size="sm" variant="outline" loading={ocupado === 'identificar'} onClick={() => identificar(aIdentificar)}>
                        <UserCheck className="size-4" /> Confirmar identificação
                      </Button>
                    )}
                    {podeConferir && (aConferir.length > 0 || linhas.some((l) => conferencia[l.id]?.cancelar)) && (
                      <Button size="sm" loading={ocupado === `conferir-${pid}`} onClick={() => conferir(pid, linhas)}>
                        <Check className="size-4" /> Conferir linhas
                      </Button>
                    )}
                    {podeCrachas && temCracha && (
                      <Button size="sm" variant="outline" onClick={() => abrirCrachas(linhas)}>
                        <IdCard className="size-4" /> Abrir na aba Crachás
                      </Button>
                    )}
                    {podeAtender && aAtender.length > 0 && (
                      <Button size="sm" loading={ocupado === 'atender'} disabled={!aAtender.some((l) => atendimento[l.id]?.sel)} onClick={() => atender(aAtender)}>
                        <PackageCheck className="size-4" /> Atender selecionadas
                      </Button>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido pelo líder</TableHead>
                        <TableHead className="w-64">Colaborador</TableHead>
                        <TableHead>Peça</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Última entrega</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">Saldo CEU</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="w-56">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.map((l) => {
                        const a = analise(l)
                        const origem = origemDaLinha(l, dados.envios)
                        const sug = sugestoes.get(l.id) ?? []
                        const escolha = escolhaDe(l)
                        const st = ROTULO_STATUS_LINHA_CEU[l.status]
                        const conf = conferencia[l.id]
                        const at = atendimento[l.id]
                        return (
                          <TableRow key={l.id} className="align-top hover:bg-accent/40">
                            <TableCell className="max-w-[14rem]">
                              <p className="font-medium">{l.nome_digitado}</p>
                              {origem && (
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {origem.origem === 'original' ? 'Original' : 'Complemento'} · {formatarDataHora(origem.enviadoEm)} · {origem.seuNome}
                                </p>
                              )}
                              {l.possivel_repeticao && (
                                <Selo tom="vermelho" title={l.tipo === 'cracha' ? 'Crachá da mesma pessoa já pedido no mês' : 'Mesmo nome, peça e tamanho em outro envio'}>
                                  possível repetição
                                </Selo>
                              )}
                            </TableCell>
                            <TableCell>
                              {l.status === 'a_identificar' && podeIdentificar ? (
                                <div className="space-y-1.5">
                                  <select
                                    aria-label={`Colaborador para ${l.nome_digitado}`}
                                    className={CLASSE_SELECT}
                                    value={escolha?.id ?? ''}
                                    onChange={(e) => {
                                      const s = sug.find((x) => x.id === e.target.value) ?? (escolha?.id === e.target.value ? escolha : null)
                                      setEscolhas((m) => ({ ...m, [l.id]: s ? { id: s.id, nome: s.nome } : null }))
                                    }}
                                  >
                                    <option value="">Escolha…</option>
                                    {escolha && !sug.some((s) => s.id === escolha.id) && <option value={escolha.id}>{escolha.nome}</option>}
                                    {sug.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.nome} ({Math.round(s.score * 100)}%)
                                      </option>
                                    ))}
                                  </select>
                                  <SeletorColaborador
                                    id={`ceu-ped-outro-${l.id}`}
                                    rotulo={`Escolher outro colaborador para ${l.nome_digitado}`}
                                    placeholder="Outro (ex.: ferista)…"
                                    candidatos={ativos}
                                    onEscolher={(c) => setEscolhas((m) => ({ ...m, [l.id]: c }))}
                                  />
                                  {sug.length === 0 && !escolha && <p className="text-xs text-muted-foreground">Sem parecido na equipe — busque acima.</p>}
                                </div>
                              ) : a.colab ? (
                                <div>
                                  <p>{a.colab.nome}</p>
                                  {l.fora_da_equipe && <Selo tom="azul">fora da equipe</Selo>}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[14rem]">
                              <p className="text-xs text-muted-foreground">{ROTULO_TIPO[l.tipo]}</p>
                              {l.tipo === 'cracha' ? (
                                <>
                                  <p>{l.cracha_nome ? `Nome no crachá: ${l.cracha_nome}` : 'Crachá'}</p>
                                  {l.cracha_motivo && <p className="text-xs text-muted-foreground">{l.cracha_motivo}</p>}
                                  {l.cracha_cordao && <p className="text-xs">+ cordão novo</p>}
                                </>
                              ) : (
                                <p>{a.item?.nome ?? 'Peça'}</p>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {l.tipo === 'cracha' ? (
                                '—'
                              ) : (
                                <>
                                  <p className={a.diverge ? 'font-semibold text-red-700 dark:text-red-400' : ''}>Pedido: {l.tamanho ?? '—'}</p>
                                  <p className={`text-xs ${a.diverge ? 'font-semibold text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>
                                    Cadastro: {a.tamanhoCadastro ?? (a.colab ? 'sem medida' : '—')}
                                  </p>
                                </>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {a.ultima ? (
                                <span className={a.recente ? 'font-semibold text-amber-700 dark:text-amber-400' : ''} title={a.recente ? 'Dentro do prazo de uso da peça' : undefined}>
                                  {formatarData(a.ultima)}
                                  {a.recente && <span className="block text-[11px]">entregue há pouco</span>}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {l.qtd_pedida}
                              {l.qtd_conferida != null && l.qtd_conferida !== l.qtd_pedida && (
                                <span className="block text-xs text-muted-foreground">conferido: {l.qtd_conferida}</span>
                              )}
                              {l.qtd_atendida != null && <span className="block text-xs text-muted-foreground">entregue: {l.qtd_atendida}</span>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{a.item ? (a.item.estoque ?? '—') : '—'}</TableCell>
                            <TableCell>
                              <StatusBadge variant={st.variante}>{st.texto}</StatusBadge>
                              {l.motivo_ajuste && <p className="mt-1 text-xs text-muted-foreground">{l.motivo_ajuste}</p>}
                              {l.motivo_atendimento && <p className="mt-1 text-xs text-muted-foreground">{l.motivo_atendimento}</p>}
                            </TableCell>
                            <TableCell className="space-y-1.5">
                              {podeConferir && (l.status === 'pendente' || l.status === 'a_identificar') && (
                                <>
                                  {l.status === 'pendente' && !conf?.cancelar && (
                                    <Input
                                      aria-label={`Quantidade conferida de ${l.nome_digitado}`}
                                      inputMode="numeric"
                                      className="tabular-nums"
                                      placeholder={`Manter ${l.qtd_pedida}`}
                                      value={conf?.qtd ?? ''}
                                      onChange={(e) => setConferencia((m) => ({ ...m, [l.id]: { qtd: e.target.value, motivo: m[l.id]?.motivo ?? '', cancelar: false } }))}
                                    />
                                  )}
                                  <label className="flex items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={conf?.cancelar ?? false}
                                      onChange={(e) => setConferencia((m) => ({ ...m, [l.id]: { qtd: '', motivo: m[l.id]?.motivo ?? '', cancelar: e.target.checked } }))}
                                    />
                                    Cancelar linha
                                  </label>
                                  {(conf?.cancelar || (conf?.qtd ?? '').trim() !== '') && (
                                    <Input
                                      aria-label={`Motivo para ${l.nome_digitado}`}
                                      placeholder={conf?.cancelar ? 'Motivo do cancelamento' : 'Motivo do ajuste'}
                                      value={conf?.motivo ?? ''}
                                      onChange={(e) => setConferencia((m) => ({ ...m, [l.id]: { qtd: m[l.id]?.qtd ?? '', cancelar: m[l.id]?.cancelar ?? false, motivo: e.target.value } }))}
                                    />
                                  )}
                                </>
                              )}
                              {podeAtender && (l.status === 'conferido' || l.status === 'ajustado') && (
                                <>
                                  <label className="flex items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      aria-label={`Atender ${l.nome_digitado}`}
                                      checked={at?.sel ?? false}
                                      onChange={(e) => setAtendimento((m) => ({ ...m, [l.id]: { qtd: m[l.id]?.qtd ?? '', motivo: m[l.id]?.motivo ?? '', sel: e.target.checked } }))}
                                    />
                                    Atender ({qtdParaAtender(l)})
                                  </label>
                                  {at?.sel && (
                                    <>
                                      <Input
                                        aria-label={`Quantidade entregue para ${l.nome_digitado}`}
                                        inputMode="numeric"
                                        className="tabular-nums"
                                        placeholder={`Entregue: ${qtdParaAtender(l)}`}
                                        value={at.qtd}
                                        onChange={(e) => setAtendimento((m) => ({ ...m, [l.id]: { ...m[l.id], qtd: e.target.value } }))}
                                      />
                                      {at.qtd.trim() !== '' && Number(at.qtd) < qtdParaAtender(l) && (
                                        <Input
                                          aria-label={`Motivo da entrega menor para ${l.nome_digitado}`}
                                          placeholder="Por que entregou menos?"
                                          value={at.motivo}
                                          onChange={(e) => setAtendimento((m) => ({ ...m, [l.id]: { ...m[l.id], motivo: e.target.value } }))}
                                        />
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </DataTable>
              )
            })
          )}
        </div>
      )}
    </CeuShell>
  )
}
