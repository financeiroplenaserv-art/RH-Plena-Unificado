import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Crop, Eye, Printer, RotateCcw, UserPlus, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CeuShell } from './CeuShell'
import { PageHeader } from '@/components/corh/PageHeader'
import { EmptyState } from '@/components/corh/EmptyState'
import { ModuleButton, ModuleCard } from '@/components/layout/ModuleShell'
import { AutocompleteColaborador } from '@/components/AutocompleteColaborador'
import { FotoFocoDialog } from '@/components/ceu/FotoFocoDialog'
import { useAuth } from '@/hooks/useAuth'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { supabase } from '@/lib/supabase'
import { podeEmitirCrachaCEU } from '@/lib/permissoes'
import { idsColaboradoresDoDepartamento, type DepartamentoFuzzy } from '@/lib/departamentos'
import { logoDaEmpresa, type ConfigCracha } from '@/lib/ceu/crachas'
import { carregarConfigCracha, carregarFotoDataUrl } from '@/lib/ceu/crachasDados'
import { imprimirDocumentoHtml } from '@/lib/ceu/crachasImpressao'
import {
  dividirEmPaginas,
  montarDocumentoFerista,
  montarDocumentoQuadro,
  normalizarFoco,
  textoHorarioEscala,
  type ColaboradorQuadro,
} from '@/lib/ceu/quadro'
import type { FocoFotoQuadro } from '@/types/database'

interface ColabQuadro {
  id: string
  matricula: string
  nome_completo: string
  cargo: string | null
  cargo_cracha: string | null
  departamento: string | null
  departamento_id: string | null
  empresa_id: string | null
  foto_path: string | null
  horario_quadro: string | null
  foto_foco: FocoFotoQuadro | null
  ferista_faltista: boolean
}

interface ItemQuadro {
  colaborador: ColabQuadro
  /** true quando foi adicionado manualmente (fora do posto — ex.: ferista) */
  avulso: boolean
  /** horário/escala editável (pré-preenchido com horario_quadro ?? '') */
  horario: string
  /** horário efetivo já gravado no banco */
  horarioSalvo: string
  /** função editável do cartaz (pré-preenchida com cargo_cracha ?? cargo; grava em cargo_cracha) */
  funcao: string
  /** função efetiva já gravada no banco */
  funcaoSalva: string
  turno: string | null // turno mais recente da escala Flit (fonte do horário padrão — migration 120)
  regime: string | null // regime_trabalho do contrato do vínculo mais recente
  fotoDataUrl: string | null
  carregandoFoto: boolean
}

const COLUNAS_BASE =
  'id, matricula, nome_completo, cargo, departamento, departamento_id, empresa_id, foto_path, cargo_cracha'
const COLUNAS_QUADRO = `${COLUNAS_BASE}, horario_quadro, foto_foco, ferista_faltista`

// sugestões do campo de horário (digitável livremente; datalist só agiliza)
const HORARIOS_COMUNS = [
  '07h às 19h · 12×36',
  '19h às 07h · 12×36',
  '08h às 20h · 12×36',
  '10h às 22h · 12×36',
  '07h às 15h20 · 6×1',
  '08h às 17h · 6×1',
  '10h às 18h20 · 6×1',
]

/** Colaboradores ATIVOS com as colunas do quadro; sem a migration 119, cai para as antigas. */
async function carregarColaboradoresQuadro(): Promise<{ lista: ColabQuadro[]; migrationPendente: boolean }> {
  const buscar = (colunas: string) => supabase.from('colaboradores').select(colunas).eq('status', 'Ativo')
  let { data, error } = await buscar(COLUNAS_QUADRO)
  let migrationPendente = false
  if (error) {
    migrationPendente = true
    ;({ data, error } = await buscar(COLUNAS_BASE))
    if (error) throw new Error(error.message)
  }
  const lista = ((data || []) as unknown as Record<string, unknown>[]).map((c) => ({
    horario_quadro: null,
    ferista_faltista: false,
    ...c,
    foto_foco: normalizarFoco(c.foto_foco),
  })) as unknown as ColabQuadro[]
  return { lista, migrationPendente }
}

/** Logo do cabeçalho: logo da empresa na cracha_config; fallback = logo padrão do app. */
async function logoDataUrlCabecalho(config: ConfigCracha, empresaId: string | null): Promise<string> {
  const daEmpresa = logoDaEmpresa(config, empresaId)
  if (daEmpresa) return daEmpresa
  const resp = await fetch('/logo_plena_cab.jpg')
  const blob = await resp.blob()
  return await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(leitor.result as string)
    leitor.onerror = () => reject(new Error('Falha ao ler o logo padrão'))
    leitor.readAsDataURL(blob)
  })
}

export function CeuQuadroPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const nivel = user?.nivel_acesso
  const podeEmitir = nivel ? podeEmitirCrachaCEU(nivel) : false

  const [departamentos, setDepartamentos] = useState<DepartamentoFuzzy[]>([])
  const [config, setConfig] = useState<ConfigCracha | null>(null)
  const [migrationPendente, setMigrationPendente] = useState(false)
  // multi-posto: condomínios com vários blocos são departamentos separados no
  // cadastro (ex.: Chácara do Itaguaí = Residencial Rosas + Residencial Dalias)
  const [postosIds, setPostosIds] = useFiltroPersistente<string[]>('ceu.quadro.postos', [])
  const [clienteNome, setClienteNome] = useFiltroPersistente<string>('ceu.quadro.cliente', '')
  const [itens, setItens] = useState<ItemQuadro[]>([])
  const [carregando, setCarregando] = useState(false)
  const [chaveBusca, setChaveBusca] = useState(0)
  const [gerando, setGerando] = useState(false)
  const [htmlPrevia, setHtmlPrevia] = useState<string | null>(null)
  const [focoAlvo, setFocoAlvo] = useState<string | null>(null)
  const [horarioRapido, setHorarioRapido] = useState('')

  const postos = useMemo(
    () => postosIds.map((id) => departamentos.find((d) => d.id === id)).filter((d): d is DepartamentoFuzzy => !!d),
    [departamentos, postosIds],
  )
  const cliente = clienteNome.trim() || postos[0]?.nome_curto || postos[0]?.nome || ''
  const empresaCabecalho = postos.find((d) => d.empresa_id)?.empresa_id ?? null

  // ---------------- carga inicial ----------------
  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        // sem filtro de nome_curto: a resolução fuzzy precisa das linhas irmãs (AGENTS.md §11)
        const { data: deps, error } = await supabase
          .from('departamentos')
          .select('id, nome, nome_curto, empresa_id, status')
          .order('nome')
        if (error) throw error
        if (ativo) setDepartamentos((deps || []) as DepartamentoFuzzy[])
      } catch (err) {
        console.error(err)
        toast.error('Erro ao carregar os postos/departamentos')
      }
      try {
        const cfg = await carregarConfigCracha()
        if (ativo) setConfig(cfg)
      } catch (err) {
        console.error(err)
      }
    }
    void carregar()
    return () => {
      ativo = false
    }
  }, [])

  // ---------------- montagem do quadro ----------------
  const carregarFotos = useCallback((colabs: ColabQuadro[]) => {
    colabs.forEach((c) => {
      if (!c.foto_path) return
      void carregarFotoDataUrl(c.foto_path).then((dataUrl) => {
        setItens((prev) =>
          prev.map((i) => (i.colaborador.id === c.id ? { ...i, fotoDataUrl: dataUrl, carregandoFoto: false } : i)),
        )
      })
    })
  }, [])

  const montarItens = useCallback(async (colabs: ColabQuadro[], avulso: boolean) => {
    // regime do contrato do vínculo MAIS RECENTE de cada colaborador (os
    // vínculos são por período 20→19, então "ativo" por data_fim >= hoje
    // esvaziaria o padrão na virada do período)
    const regimes = new Map<string, string>()
    if (colabs.length > 0) {
      try {
        const ids = colabs.map((c) => c.id)
        const { data: vinculos, error } = await supabase
          .from('vinculos_adicionais')
          .select('colaborador_id, contrato_id, data_fim')
          .in('colaborador_id', ids)
        if (error) throw error
        const contratoIds = [...new Set((vinculos || []).map((v) => v.contrato_id))]
        if (contratoIds.length > 0) {
          const { data: contratos, error: e2 } = await supabase
            .from('contratos_adicionais')
            .select('id, regime_trabalho')
            .in('id', contratoIds)
          if (e2) throw e2
          const regimePorContrato = new Map((contratos || []).map((c) => [c.id, c.regime_trabalho as string]))
          // vínculo com data_fim mais distante vence (o mais recente/ativo)
          const ordenados = [...(vinculos || [])].sort((a, b) => b.data_fim.localeCompare(a.data_fim))
          for (const v of ordenados) {
            const regime = regimePorContrato.get(v.contrato_id)
            if (regime && !regimes.has(v.colaborador_id)) regimes.set(v.colaborador_id, regime)
          }
        }
      } catch (err) {
        console.error('regimes dos vínculos indisponíveis', err)
      }
    }
    // turno mais recente da escala Flit de cada colaborador (traz o horário,
    // ex.: "19 às 7h CBO") — gravado na importação desde a migration 120
    const turnos = new Map<string, string>()
    if (colabs.length > 0) {
      try {
        const ids = colabs.map((c) => c.id)
        // janela de 120 dias basta para o horário atual; corte grosso em UTC
        const corte = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10)
        const { data: dias, error } = await supabase
          .from('locais_trabalho_diario')
          .select('colaborador_id, turno, data')
          .in('colaborador_id', ids)
          .not('turno', 'is', null)
          .gte('data', corte)
          .order('data', { ascending: false })
          .limit(1000)
        if (error) throw error
        for (const d of dias || []) {
          if (d.turno && !turnos.has(d.colaborador_id)) turnos.set(d.colaborador_id, d.turno)
        }
      } catch (err) {
        console.error('turnos do diário indisponíveis', err)
      }
    }
    const novos: ItemQuadro[] = colabs.map((c) => ({
      colaborador: c,
      avulso,
      horario: c.horario_quadro ?? '',
      horarioSalvo: c.horario_quadro ?? '',
      funcao: (c.cargo_cracha ?? c.cargo ?? '').trim(),
      funcaoSalva: (c.cargo_cracha ?? c.cargo ?? '').trim(),
      turno: turnos.get(c.id) ?? null,
      regime: regimes.get(c.id) ?? null,
      fotoDataUrl: null,
      carregandoFoto: !!c.foto_path,
    }))
    setItens((prev) => {
      const jaTem = new Set(prev.map((i) => i.colaborador.id))
      return [...prev, ...novos.filter((n) => !jaTem.has(n.colaborador.id))]
    })
    carregarFotos(colabs)
  }, [carregarFotos])

  const carregarPostos = useCallback(
    async (idsPostos: string[]) => {
      const deps = idsPostos
        .map((id) => departamentos.find((d) => d.id === id))
        .filter((d): d is DepartamentoFuzzy => !!d)
      if (deps.length === 0) {
        setItens([])
        return
      }
      setCarregando(true)
      try {
        const { lista, migrationPendente: pendente } = await carregarColaboradoresQuadro()
        setMigrationPendente(pendente)
        // união dos postos selecionados (condomínio com vários blocos = vários departamentos)
        const ids = new Set<string>()
        for (const dep of deps) {
          for (const id of idsColaboradoresDoDepartamento(departamentos, lista, dep.nome_curto || dep.nome)) {
            ids.add(id)
          }
        }
        const membros = lista
          .filter((c) => ids.has(c.id))
          .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, 'pt-BR'))
        // troca de posto: substitui os membros, mas preserva os avulsos (adicionados à mão)
        setItens((prev) => prev.filter((i) => i.avulso))
        await montarItens(membros, false)
        if (membros.length === 0) toast.warning('Nenhum colaborador ativo encontrado no(s) posto(s)')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar os colaboradores do posto')
      } finally {
        setCarregando(false)
      }
    },
    [departamentos, montarItens],
  )

  // recarrega quando os postos persistidos são restaurados ou trocados
  const chavePostos = postosIds.join(',')
  useEffect(() => {
    if (!chavePostos || departamentos.length === 0) return
    void carregarPostos(chavePostos.split(','))
  }, [chavePostos, departamentos, carregarPostos])

  // Entrada pela lista de Colaboradores (botão "Quadro de colaboradores"):
  // pré-seleciona o posto filtrado e/ou adiciona os marcados como avulsos.
  const estadoRouterAplicado = useRef(false)
  useEffect(() => {
    if (estadoRouterAplicado.current || departamentos.length === 0) return
    const st = location.state as { colaboradorIds?: string[]; postoId?: string } | null
    if (!st || (!st.postoId && !(st.colaboradorIds && st.colaboradorIds.length > 0))) return
    estadoRouterAplicado.current = true
    void (async () => {
      try {
        if (st.postoId) {
          const dep = departamentos.find((d) => d.id === st.postoId)
          if (dep) {
            if (!postosIds.includes(dep.id)) setPostosIds([dep.id])
            if (!clienteNome.trim()) setClienteNome(dep.nome_curto || dep.nome)
            await carregarPostos([dep.id])
          }
        }
        if (st.colaboradorIds && st.colaboradorIds.length > 0) {
          const { lista, migrationPendente: pendente } = await carregarColaboradoresQuadro()
          if (pendente) setMigrationPendente(true)
          const achados = st.colaboradorIds
            .map((id) => lista.find((c) => c.id === id))
            .filter((c): c is ColabQuadro => !!c)
          if (achados.length < st.colaboradorIds.length) {
            toast.warning(`${st.colaboradorIds.length - achados.length} colaborador(es) selecionado(s) não estão ativos e foram ignorados`)
          }
          if (achados.length > 0) await montarItens(achados, true)
        }
      } finally {
        // limpa o state para não reaplicar ao navegar de volta
        navigate('.', { replace: true, state: null })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aplica o state uma única vez
  }, [departamentos])

  const adicionarPosto = (id: string) => {
    if (!id || postosIds.includes(id)) return
    setPostosIds([...postosIds, id])
    // nome do cliente: pré-preenche com o primeiro posto, editável (o nome de
    // exibição do condomínio nem sempre é o nome do cadastro)
    if (!clienteNome.trim()) {
      const dep = departamentos.find((d) => d.id === id)
      if (dep) setClienteNome(dep.nome_curto || dep.nome)
    }
  }

  const removerPosto = (id: string) => setPostosIds(postosIds.filter((p) => p !== id))

  /** Adiciona pessoa de fora do posto (ex.: ferista/faltista alocado no contrato). */
  const adicionarAvulso = async (escolhido: { id: string; nome_completo: string } | null) => {
    if (!escolhido?.id) return
    setChaveBusca((k) => k + 1)
    if (itens.some((i) => i.colaborador.id === escolhido.id)) {
      toast.warning(`${escolhido.nome_completo} já está no quadro`)
      return
    }
    try {
      const { lista, migrationPendente: pendente } = await carregarColaboradoresQuadro()
      if (pendente) setMigrationPendente(true)
      const achado = lista.find((c) => c.id === escolhido.id)
      if (!achado) {
        toast.warning('Colaborador não está ativo')
        return
      }
      await montarItens([achado], true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar colaborador')
    }
  }

  const removerItem = (id: string) => setItens((prev) => prev.filter((i) => i.colaborador.id !== id))

  const editarHorario = (id: string, horario: string) =>
    setItens((prev) => prev.map((i) => (i.colaborador.id === id ? { ...i, horario } : i)))

  const editarFuncao = (id: string, funcao: string) =>
    setItens((prev) => prev.map((i) => (i.colaborador.id === id ? { ...i, funcao } : i)))

  /** Toggle ferista/faltista: grava na hora (define em qual documento a pessoa sai). */
  const alternarFerista = async (id: string) => {
    const item = itens.find((i) => i.colaborador.id === id)
    if (!item) return
    const novo = !item.colaborador.ferista_faltista
    try {
      const { data, error } = await supabase
        .from('colaboradores')
        .update({ ferista_faltista: novo })
        .eq('id', id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Sem permissão de gravação')
      setItens((prev) =>
        prev.map((i) =>
          i.colaborador.id === id ? { ...i, colaborador: { ...i.colaborador, ferista_faltista: novo } } : i,
        ),
      )
      if (novo) toast.info(`${item.colaborador.nome_completo} sai na folha separada de ferista/faltista`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao marcar ferista/faltista')
    }
  }

  // ---------------- gravação e impressão ----------------
  const paraQuadro = useCallback(
    (i: ItemQuadro): ColaboradorQuadro => ({
      id: i.colaborador.id,
      nome: i.colaborador.nome_completo,
      funcao: i.funcao.trim() || 'Sem função',
      fotoDataUrl: i.fotoDataUrl,
      foco: i.colaborador.foto_foco,
      horario: i.horario.trim() || null,
      regime: i.regime,
      turno: i.turno,
      ferista: i.colaborador.ferista_faltista,
    }),
    [],
  )

  /** Grava horario_quadro e cargo_cracha do que foi editado (nunca toca nome_completo nem cargo). */
  const salvarTextosEditados = async () => {
    const pendentes = itens.filter(
      (i) => i.horario.trim() !== i.horarioSalvo || i.funcao.trim() !== i.funcaoSalva,
    )
    if (pendentes.length === 0) return
    const resultados = await Promise.allSettled(
      pendentes.map(async (i) => {
        const horario = i.horario.trim() || null
        // igual ao cadastro → null (usa o cargo); a mesma coluna vale para o crachá
        const cargoCracha = i.funcao.trim() === (i.colaborador.cargo ?? '').trim() ? null : i.funcao.trim() || null
        const { data, error } = await supabase
          .from('colaboradores')
          .update({ horario_quadro: horario, cargo_cracha: cargoCracha })
          .eq('id', i.colaborador.id)
          .select('id')
        if (error) throw error
        if (!data || data.length === 0) throw new Error('sem permissão')
        return { id: i.colaborador.id }
      }),
    )
    const okIds = new Set<string>()
    let falhas = 0
    resultados.forEach((r, idx) => {
      if (r.status === 'fulfilled') okIds.add(pendentes[idx].colaborador.id)
      else falhas++
    })
    if (okIds.size > 0) {
      setItens((prev) =>
        prev.map((i) =>
          okIds.has(i.colaborador.id)
            ? {
                ...i,
                horarioSalvo: i.horario.trim(),
                funcaoSalva: i.funcao.trim(),
                colaborador: {
                  ...i.colaborador,
                  horario_quadro: i.horario.trim() || null,
                  cargo_cracha:
                    i.funcao.trim() === (i.colaborador.cargo ?? '').trim() ? null : i.funcao.trim() || null,
                },
              }
            : i,
        ),
      )
    }
    if (falhas > 0) {
      toast.error(`Não consegui guardar horário/função de ${falhas} colaborador(es) — sai editado no cartaz mesmo assim`)
    }
  }

  const gerar = async (qual: 'quadro' | 'ferista', acao: 'imprimir' | 'previa') => {
    const normais = itens.filter((i) => !i.colaborador.ferista_faltista)
    const feristas = itens.filter((i) => i.colaborador.ferista_faltista)
    const base = qual === 'quadro' ? normais : feristas
    if (base.length === 0) {
      toast.warning(qual === 'quadro' ? 'Selecione um posto com colaboradores' : 'Nenhum ferista/faltista marcado no quadro')
      return
    }
    if (!cliente) {
      toast.warning('Preencha o nome do cliente no cartaz')
      return
    }
    setGerando(true)
    try {
      if (acao === 'imprimir') await salvarTextosEditados()
      const logo = await logoDataUrlCabecalho(config ?? { logos: {}, fundos: {} }, empresaCabecalho)
      const html =
        qual === 'quadro'
          ? montarDocumentoQuadro({ cliente, logoDataUrl: logo, paginas: dividirEmPaginas(base.map(paraQuadro)) })
          : montarDocumentoFerista(cliente, logo, base.map(paraQuadro))
      if (acao === 'previa') {
        setHtmlPrevia(html)
      } else {
        const semFoto = base.filter((i) => !i.fotoDataUrl).length
        if (semFoto > 0) toast.warning(`${semFoto} cartão(ões) sem foto — sairão com a moldura vazia`)
        await imprimirDocumentoHtml(html)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar o quadro')
    } finally {
      setGerando(false)
    }
  }

  const normaisCount = itens.filter((i) => !i.colaborador.ferista_faltista).length
  const feristasCount = itens.length - normaisCount
  const itemFoco = itens.find((i) => i.colaborador.id === focoAlvo) ?? null

  if (!podeEmitir) return null

  return (
    <CeuShell>
      <PageHeader
        backTo="/ceu/movimentacoes"
        title="Quadro de Colaboradores"
        description="Escolha o posto, confira fotos e horários e imprima o cartaz A4 por função — o ferista sai em folha separada"
      />

      {migrationPendente && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            O banco ainda não recebeu a atualização do quadro (migration 119): horário, enquadramento da foto e a
            marcação de ferista não ficam salvos até ela ser aplicada.
          </span>
        </div>
      )}

      <ModuleCard
        title="Posto(s) / contrato"
        description="O quadro lista os colaboradores ativos vinculados ao(s) posto(s) no cadastro. Condomínio com vários blocos? Adicione todos os postos do contrato."
      >
        <div className="flex max-w-xl flex-col gap-3">
          <Select value="" onValueChange={adicionarPosto}>
            <SelectTrigger>
              <SelectValue placeholder="Adicionar posto..." />
            </SelectTrigger>
            <SelectContent>
              {departamentos
                .filter((d) => d.status !== 'Inativo' && !postosIds.includes(d.id))
                .map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome_curto || d.nome}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {postos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {postos.map((d) => (
                <span
                  key={d.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[12px] font-medium"
                >
                  {d.nome_curto || d.nome}
                  <button
                    type="button"
                    onClick={() => removerPosto(d.id)}
                    aria-label={`Remover posto ${d.nome_curto || d.nome}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {(postos.length > 0 || itens.length > 0) && (
            <>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Nome do cliente no cartaz</Label>
                <Input
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  placeholder={postos[0] ? postos[0].nome_curto || postos[0].nome : 'Ex.: Condomínio Chácara do Itaguaí'}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="mb-1 block text-[11px] text-muted-foreground">
                    Adicionar pessoa de fora do posto (ferista/faltista, cobertura)
                  </Label>
                  <AutocompleteColaborador
                    key={chaveBusca}
                    somenteAtivos
                    placeholder="Buscar por nome ou matrícula..."
                    onChange={(c) => void adicionarAvulso(c ? { id: c.id, nome_completo: c.nome_completo } : null)}
                  />
                </div>
                <UserPlus className="mb-2 size-4 shrink-0 text-muted-foreground" />
              </div>
            </>
          )}
        </div>
        {carregando && <p className="mt-2 text-[12px] text-muted-foreground">Carregando colaboradores do(s) posto(s)...</p>}
      </ModuleCard>

      {(postosIds.length > 0 || itens.length > 0) && !carregando && (
        <ModuleCard
          title={`Quadro — ${cliente} (${normaisCount})${feristasCount > 0 ? ` + ${feristasCount} ferista(s)` : ''}`}
        >
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
              <Printer className="mt-0.5 size-3.5 shrink-0" />
              Imprima em &quot;Tamanho real&quot; / 100% com &quot;Gráficos de segundo plano&quot; ativados. O ferista sai em
              folha separada para trocar só ela quando ele mudar.
            </p>
            <div className="ml-auto flex flex-wrap gap-2">
              <ModuleButton variant="outline" onClick={() => void gerar('quadro', 'previa')} disabled={gerando || normaisCount === 0}>
                <Eye className="size-4" />
                Pré-visualizar
              </ModuleButton>
              <ModuleButton onClick={() => void gerar('quadro', 'imprimir')} disabled={gerando || normaisCount === 0}>
                <Printer className="size-4" />
                Imprimir quadro
              </ModuleButton>
              {feristasCount > 0 && (
                <ModuleButton variant="outline" onClick={() => void gerar('ferista', 'imprimir')} disabled={gerando}>
                  <Printer className="size-4" />
                  Imprimir ferista ({feristasCount})
                </ModuleButton>
              )}
            </div>
            <div className="flex w-full flex-wrap items-end gap-2 border-t border-border pt-3">
              <div className="w-64">
                <Label className="mb-1 block text-[11px] text-muted-foreground">Horário rápido</Label>
                <Input
                  list="horarios-comuns"
                  value={horarioRapido}
                  onChange={(e) => setHorarioRapido(e.target.value)}
                  placeholder="Ex.: 07h às 19h · 12×36"
                  className="h-8 text-[12px]"
                />
                <datalist id="horarios-comuns">
                  {HORARIOS_COMUNS.map((h) => (
                    <option key={h} value={h} />
                  ))}
                </datalist>
              </div>
              <ModuleButton
                variant="outline"
                size="sm"
                disabled={!horarioRapido.trim()}
                onClick={() => {
                  const v = horarioRapido.trim()
                  const vazios = itens.filter((i) => !i.horario.trim()).length
                  setItens((prev) => prev.map((i) => (i.horario.trim() ? i : { ...i, horario: v })))
                  toast.success(`Horário aplicado a ${vazios} cartão(ões) que estavam vazios — ajuste as exceções nos cartões`)
                }}
              >
                Aplicar a quem está sem horário
              </ModuleButton>
              <p className="text-[11px] text-muted-foreground">
                O horário digitado fica salvo no cadastro ao imprimir — na próxima vez já vem preenchido.
              </p>
            </div>
          </div>

          {itens.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              description="Nenhum colaborador neste posto. Use a busca acima para adicionar pessoas manualmente."
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {itens.map((item) => {
                const c = item.colaborador
                const horarioMudou = item.horario.trim() !== item.horarioSalvo
                return (
                  <div
                    key={c.id}
                    className={`flex flex-col overflow-hidden rounded-lg border bg-card ${c.ferista_faltista ? 'border-amber-300' : 'border-border'}`}
                  >
                    <button
                      type="button"
                      title="Enquadrar foto"
                      className="group relative aspect-[3/4] w-full overflow-hidden bg-muted"
                      onClick={() => c.foto_path && setFocoAlvo(c.id)}
                    >
                      {item.fotoDataUrl ? (
                        <>
                          {c.foto_foco && c.foto_foco.zoom < 1 && (
                            <img
                              src={item.fotoDataUrl}
                              alt=""
                              className="absolute inset-0 size-full scale-110 object-cover blur-md brightness-[0.92]"
                            />
                          )}
                          <img
                            src={item.fotoDataUrl}
                            alt={`Foto de ${c.nome_completo}`}
                            className="absolute inset-0 size-full object-cover"
                            style={{
                              objectPosition: `${c.foto_foco?.px ?? 50}% ${c.foto_foco?.py ?? 20}%`,
                              ...(c.foto_foco && c.foto_foco.zoom !== 1
                                ? { transform: `scale(${c.foto_foco.zoom})`, transformOrigin: `${c.foto_foco.px}% ${c.foto_foco.py}%` }
                                : {}),
                            }}
                          />
                        </>
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          {item.carregandoFoto ? '...' : <Users className="size-8" />}
                        </div>
                      )}
                      {c.foto_path && (
                        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/45 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <Crop className="size-3" /> Enquadrar
                        </span>
                      )}
                    </button>

                    <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                      <p className="text-[12px] font-bold leading-tight">{c.nome_completo}</p>
                      {item.avulso && <p className="text-[10px] text-muted-foreground">adicionado manualmente</p>}

                      <div>
                        <Label className="text-[10px] text-muted-foreground">Função no cartaz</Label>
                        <Input
                          value={item.funcao}
                          onChange={(e) => editarFuncao(c.id, e.target.value)}
                          placeholder={(c.cargo ?? '').trim() || 'Sem função'}
                          className="h-8 text-[12px]"
                        />
                        {item.funcao.trim() !== (c.cargo ?? '').trim() && (
                          <button
                            type="button"
                            className="mt-0.5 flex items-center gap-1 text-[11px] text-primary hover:underline"
                            onClick={() => editarFuncao(c.id, c.cargo ?? '')}
                          >
                            <RotateCcw className="size-3" /> Voltar à função do cadastro
                          </button>
                        )}
                      </div>

                      <div>
                        <Label className="text-[10px] text-muted-foreground">Horário / escala no cartaz</Label>
                        <Input
                          list="horarios-comuns"
                          value={item.horario}
                          onChange={(e) => editarHorario(c.id, e.target.value)}
                          placeholder={textoHorarioEscala({ horario: null, turno: item.turno, regime: item.regime })}
                          className="h-8 text-[12px]"
                        />
                        {horarioMudou && (
                          <button
                            type="button"
                            className="mt-0.5 flex items-center gap-1 text-[11px] text-primary hover:underline"
                            onClick={() => editarHorario(c.id, item.horarioSalvo)}
                          >
                            <RotateCcw className="size-3" /> Desfazer
                          </button>
                        )}
                        {!horarioMudou && item.horarioSalvo && (
                          <button
                            type="button"
                            className="mt-0.5 flex items-center gap-1 text-[11px] text-primary hover:underline"
                            onClick={() => editarHorario(c.id, '')}
                          >
                            <RotateCcw className="size-3" /> Voltar ao padrão ({textoHorarioEscala({ horario: null, turno: item.turno, regime: item.regime })})
                          </button>
                        )}
                      </div>

                      {!item.fotoDataUrl && !item.carregandoFoto && (
                        <p className="flex items-center gap-1 text-[11px] text-amber-700">
                          <AlertTriangle className="size-3" /> Sem foto
                        </p>
                      )}

                      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium">
                          <input
                            type="checkbox"
                            checked={c.ferista_faltista}
                            onChange={() => void alternarFerista(c.id)}
                            className="accent-primary"
                          />
                          Ferista/faltista
                        </label>
                        <ModuleButton variant="ghost" size="sm" onClick={() => removerItem(c.id)} aria-label={`Remover ${c.nome_completo} do quadro`}>
                          <X className="size-3.5" />
                        </ModuleButton>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ModuleCard>
      )}

      {itemFoco && (
        <FotoFocoDialog
          aberto={focoAlvo !== null}
          onFechar={() => setFocoAlvo(null)}
          colaboradorId={itemFoco.colaborador.id}
          nome={itemFoco.colaborador.nome_completo}
          fotoPath={itemFoco.colaborador.foto_path}
          focoAtual={itemFoco.colaborador.foto_foco}
          onSalvo={(foco) =>
            setItens((prev) =>
              prev.map((i) => (i.colaborador.id === itemFoco.colaborador.id ? { ...i, colaborador: { ...i.colaborador, foto_foco: foco } } : i)),
            )
          }
        />
      )}

      <Dialog open={htmlPrevia !== null} onOpenChange={(aberto) => !aberto && setHtmlPrevia(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização do quadro</DialogTitle>
            <DialogDescription>
              Imprima em &quot;Tamanho real&quot; / 100%. A pré-visualização mostra as folhas A4 como sairão no papel.
            </DialogDescription>
          </DialogHeader>
          {htmlPrevia !== null && (
            <iframe title="Pré-visualização do quadro" srcDoc={htmlPrevia} className="h-[70vh] w-full rounded border border-border" />
          )}
          <div className="flex justify-end gap-2">
            <ModuleButton variant="outline" onClick={() => setHtmlPrevia(null)}>
              Fechar
            </ModuleButton>
            <ModuleButton
              onClick={() => {
                setHtmlPrevia(null)
                void gerar('quadro', 'imprimir')
              }}
            >
              <Printer className="size-4" />
              Imprimir
            </ModuleButton>
          </div>
        </DialogContent>
      </Dialog>
    </CeuShell>
  )
}
