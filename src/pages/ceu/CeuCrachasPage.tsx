import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, Camera, Eye, IdCard, Printer, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { AutocompleteColaborador } from '@/components/AutocompleteColaborador'
import { CrachaPreview, EstilosCrachaPreview } from '@/components/ceu/CrachaPreview'
import { CrachaAparenciaCard } from '@/components/ceu/CrachaAparenciaCard'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { podeEmitirCrachaCEU, verificarPermissao } from '@/lib/permissoes'
import {
  CONFIG_CRACHA_PADRAO,
  cargoInicialCracha,
  contarFolhas,
  crachaSemCargo,
  fundoDaEmpresa,
  logoDaEmpresa,
  montarDocumentoCrachas,
  nomeInicialCracha,
  payloadSalvarTextosCracha,
  type ConfigCracha,
  type DadosCracha,
  type ModoCracha,
} from '@/lib/ceu/crachas'
import {
  carregarConfigCracha,
  carregarFotoDataUrl,
  enviarFotoColaborador,
  salvarDadosCracha,
} from '@/lib/ceu/crachasDados'
import { reduzirImagem } from '@/lib/ceu/crachasImagem'
import { imprimirDocumentoHtml } from '@/lib/ceu/crachasImpressao'

interface ColaboradorCracha {
  id: string
  matricula: string
  nome_completo: string
  cargo: string | null
  departamento: string | null
  departamento_id: string | null
  empresa_id: string | null
  nome_cracha: string | null
  cargo_cracha: string | null
  foto_path: string | null
}

interface ItemFila {
  colaborador: ColaboradorCracha
  /** nome editável (pré-preenchido com nome_cracha ?? nome_completo) */
  nome: string
  /** nome efetivo já gravado no banco (para saber se precisa salvar) */
  nomeSalvo: string
  /** função editável (pré-preenchida com cargo_cracha ?? cargo) */
  cargo: string
  /** função efetiva já gravada no banco */
  cargoSalvo: string
  fotoDataUrl: string | null
  carregandoFoto: boolean
}

const COLUNAS_BASE = 'id, matricula, nome_completo, cargo, departamento, departamento_id, empresa_id'
const COLUNAS_CRACHA = `${COLUNAS_BASE}, nome_cracha, cargo_cracha, foto_path`
const LOTE_IDS = 200

/**
 * Carrega colaboradores ATIVOS por id com os dados de crachá. Se a migration 117
 * ainda não foi aplicada, cai para as colunas antigas (e avisa).
 */
async function carregarColaboradoresPorIds(
  ids: string[]
): Promise<{ lista: ColaboradorCracha[]; migrationPendente: boolean }> {
  const buscar = async (colunas: string) => {
    const todos: Record<string, unknown>[] = []
    for (let i = 0; i < ids.length; i += LOTE_IDS) {
      const { data, error } = await supabase
        .from('colaboradores')
        .select(colunas)
        .eq('status', 'Ativo')
        .in('id', ids.slice(i, i + LOTE_IDS))
      if (error) return { error }
      todos.push(...((data || []) as unknown as Record<string, unknown>[]))
    }
    return { todos }
  }

  let r = await buscar(COLUNAS_CRACHA)
  let migrationPendente = false
  if ('error' in r && r.error) {
    migrationPendente = true
    r = await buscar(COLUNAS_BASE)
    if ('error' in r && r.error) throw new Error(r.error.message)
  }
  const lista = (r as { todos: Record<string, unknown>[] }).todos.map((c) => ({
    nome_cracha: null,
    cargo_cracha: null,
    foto_path: null,
    ...c,
  })) as unknown as ColaboradorCracha[]
  return { lista, migrationPendente }
}

export function CeuCrachasPage() {
  const { user } = useAuth()
  const location = useLocation()
  const nivel = user?.nivel_acesso
  const podeEmitir = nivel ? podeEmitirCrachaCEU(nivel) : false
  // dp3 só emite; quem pode gravar em `configuracoes` (editores) também configura o logo
  const podeConfigurarLogo = !!nivel && nivel !== 'dp3'
  // Quem não tem o resto do CEU vê só a aba Crachás
  const soCrachas = !!nivel && !verificarPermissao(nivel, 'rota', 'ceu')

  const [carregando, setCarregando] = useState(true)
  const [migrationPendente, setMigrationPendente] = useState(false)
  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([])
  const [config, setConfig] = useState<ConfigCracha>(CONFIG_CRACHA_PADRAO)
  // muda a key do autocomplete para limpá-lo depois de cada colaborador adicionado
  const [chaveBusca, setChaveBusca] = useState(0)

  const [fila, setFila] = useState<ItemFila[]>([])
  const [modoTeste, setModoTeste] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [htmlPrevia, setHtmlPrevia] = useState<string | null>(null)
  const [avisoVazio, setAvisoVazio] = useState(false)

  const inputFotoRef = useRef<HTMLInputElement>(null)
  const fotoAlvo = useRef<string | null>(null)
  const idsIniciaisAplicados = useRef(false)

  const modo: ModoCracha = modoTeste ? 'teste' : 'normal'

  // ---------------- carga inicial ----------------
  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const { data: emp } = await supabase.from('empresas').select('id, nome').order('nome')
        if (ativo) setEmpresas((emp || []) as { id: string; nome: string }[])
      } catch (err) {
        console.error(err)
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

  // ---------------- fila ----------------
  const adicionarAFila = useCallback((colabs: ColaboradorCracha[]) => {
    setAvisoVazio(false)
    setFila((prev) => {
      const jaTem = new Set(prev.map((i) => i.colaborador.id))
      const novos: ItemFila[] = colabs
        .filter((c) => !jaTem.has(c.id))
        .map((c) => {
          const inicial = nomeInicialCracha(c)
          const cargoInicial = cargoInicialCracha(c)
          return {
            colaborador: c,
            nome: inicial,
            nomeSalvo: inicial,
            cargo: cargoInicial,
            cargoSalvo: cargoInicial,
            fotoDataUrl: null,
            carregandoFoto: !!c.foto_path,
          }
        })
      return [...prev, ...novos]
    })
    colabs.forEach((c) => {
      if (!c.foto_path) return
      void carregarFotoDataUrl(c.foto_path).then((dataUrl) => {
        setFila((prev) =>
          prev.map((i) => (i.colaborador.id === c.id ? { ...i, fotoDataUrl: dataUrl, carregandoFoto: false } : i))
        )
      })
    })
  }, [])

  // Seleção vinda da lista de Colaboradores (router state) — aplicada uma vez
  useEffect(() => {
    if (idsIniciaisAplicados.current) return
    idsIniciaisAplicados.current = true
    const ids = (location.state as { colaboradorIds?: string[] } | null)?.colaboradorIds
    if (!ids || ids.length === 0) {
      setCarregando(false)
      return
    }
    void carregarColaboradoresPorIds(ids)
      .then(({ lista, migrationPendente: pendente }) => {
        setMigrationPendente(pendente)
        if (lista.length < ids.length) {
          toast.warning(`${ids.length - lista.length} colaborador(es) selecionado(s) não estão ativos e foram ignorados`)
        }
        const ordem = new Map(ids.map((id, i) => [id, i]))
        lista.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0))
        if (lista.length > 0) adicionarAFila(lista)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar colaboradores'))
      .finally(() => setCarregando(false))
  }, [location.state, adicionarAFila])

  const idsNaFila = useMemo(() => new Set(fila.map((i) => i.colaborador.id)), [fila])

  /** Colaborador escolhido no autocomplete: busca os dados de crachá e coloca na fila. */
  const aoEscolherColaborador = async (escolhido: { id: string; nome_completo: string } | null) => {
    if (!escolhido || !escolhido.id) return
    setChaveBusca((k) => k + 1)
    if (idsNaFila.has(escolhido.id)) {
      toast.warning(`${escolhido.nome_completo} já está na fila`)
      return
    }
    try {
      const { lista, migrationPendente: pendente } = await carregarColaboradoresPorIds([escolhido.id])
      if (pendente) setMigrationPendente(true)
      if (lista.length === 0) {
        toast.warning('Colaborador não está ativo')
        return
      }
      adicionarAFila(lista)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar colaborador')
    }
  }

  const removerDaFila = (id: string) => setFila((prev) => prev.filter((i) => i.colaborador.id !== id))

  const editarNome = (id: string, nome: string) =>
    setFila((prev) => prev.map((i) => (i.colaborador.id === id ? { ...i, nome } : i)))

  const editarCargo = (id: string, cargo: string) =>
    setFila((prev) => prev.map((i) => (i.colaborador.id === id ? { ...i, cargo } : i)))

  // ---------------- foto ----------------
  const escolherFoto = (id: string) => {
    fotoAlvo.current = id
    inputFotoRef.current?.click()
  }

  const aoEscolherFoto = async (arquivo: File | undefined) => {
    const id = fotoAlvo.current
    if (!arquivo || !id) return
    try {
      const dataUrl = await reduzirImagem(arquivo, false)
      const path = await enviarFotoColaborador(id, dataUrl)
      setFila((prev) =>
        prev.map((i) =>
          i.colaborador.id === id
            ? { ...i, fotoDataUrl: dataUrl, carregandoFoto: false, colaborador: { ...i.colaborador, foto_path: path } }
            : i
        )
      )
      toast.success('Foto salva no cadastro do colaborador')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar a foto')
    }
  }

  // ---------------- geração ----------------
  const nomeEfetivo = (i: ItemFila) => i.nome.trim() || i.colaborador.nome_completo
  const cargoEfetivo = (i: ItemFila) => i.cargo.trim() || (i.colaborador.cargo ?? '').trim()

  const dadosDoItem = (i: ItemFila): DadosCracha => ({
    nome: nomeEfetivo(i),
    cargo: cargoEfetivo(i),
    fotoDataUrl: i.fotoDataUrl,
    logoDataUrl: logoDaEmpresa(config, i.colaborador.empresa_id),
    fundo: fundoDaEmpresa(config, i.colaborador.empresa_id),
  })

  const dadosDaFila = (): DadosCracha[] => fila.map(dadosDoItem)

  /** Grava em nome_cracha/cargo_cracha o que foi editado (nunca toca nome_completo nem cargo). */
  const salvarTextosEditados = async () => {
    const pendentes = fila.filter((i) => nomeEfetivo(i) !== i.nomeSalvo || cargoEfetivo(i) !== i.cargoSalvo)
    if (pendentes.length === 0) return
    const resultados = await Promise.allSettled(
      pendentes.map((i) =>
        salvarDadosCracha(
          payloadSalvarTextosCracha(i.colaborador.id, {
            ...(nomeEfetivo(i) !== i.nomeSalvo
              ? { nome: { editado: i.nome, cadastro: i.colaborador.nome_completo } }
              : {}),
            ...(cargoEfetivo(i) !== i.cargoSalvo
              ? { cargo: { editado: i.cargo, cadastro: i.colaborador.cargo ?? '' } }
              : {}),
          })
        )
      )
    )
    const okIds = new Set<string>()
    let falhas = 0
    resultados.forEach((r, idx) => {
      if (r.status === 'fulfilled') okIds.add(pendentes[idx].colaborador.id)
      else falhas++
    })
    if (okIds.size > 0) {
      setFila((prev) =>
        prev.map((i) =>
          okIds.has(i.colaborador.id) ? { ...i, nomeSalvo: nomeEfetivo(i), cargoSalvo: cargoEfetivo(i) } : i
        )
      )
    }
    if (falhas > 0) {
      toast.error(`Não consegui guardar nome/função de ${falhas} crachá(s) no cadastro — o crachá sai com o texto editado mesmo assim`)
    }
  }

  const gerar = async (acao: 'imprimir' | 'previa') => {
    if (fila.length === 0) {
      setAvisoVazio(true)
      toast.warning('Selecione ao menos um colaborador para emitir crachás')
      return
    }
    setGerando(true)
    try {
      if (acao === 'imprimir' && !modoTeste) await salvarTextosEditados()
      const html = montarDocumentoCrachas(dadosDaFila(), modo)
      if (acao === 'previa') setHtmlPrevia(html)
      else {
        // Decisão da gestão: crachá sem foto só gera aviso, não bloqueia a impressão
        const semFoto = modoTeste ? 0 : fila.filter((i) => !i.fotoDataUrl).length
        if (semFoto > 0) {
          toast.warning(`${semFoto} crachá(s) sem foto — sairão com a moldura 3x4 vazia`)
        }
        await imprimirDocumentoHtml(html)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar os crachás')
    } finally {
      setGerando(false)
    }
  }

  const folhas = contarFolhas(fila.length)

  if (!podeEmitir) return null

  return (
    <CeuShell apenasCrachas={soCrachas}>
      <EstilosCrachaPreview modo={modo} />
      <PageHeader
        backTo={soCrachas ? '/' : '/ceu/movimentacoes'}
        showBackButton={!soCrachas}
        title="Crachás"
        description="Busque os colaboradores ativos, confira nome, função e foto e imprima 9 crachás por folha A4"
      />

      {migrationPendente && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            O banco ainda não recebeu a atualização dos crachás (migration 117): fotos e nome do crachá não
            ficam guardados no cadastro até ela ser aplicada.
          </span>
        </div>
      )}

      <ModuleCard title="Adicionar colaborador" description="Digite o nome ou a matrícula e escolha na lista (só colaboradores ativos).">
        <div className="max-w-xl">
          <AutocompleteColaborador
            key={chaveBusca}
            somenteAtivos
            placeholder="Buscar colaborador por nome ou matrícula..."
            onChange={(c) => void aoEscolherColaborador(c)}
          />
        </div>
        {carregando && <p className="mt-2 text-[12px] text-muted-foreground">Carregando seleção...</p>}
      </ModuleCard>

      <ModuleCard
        title={`Fila de crachás (${fila.length})`}
        description={fila.length > 0 ? `${fila.length} crachá(s) em ${folhas} folha(s) A4` : undefined}
      >
        <input
          ref={inputFotoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void aoEscolherFoto(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
            <Checkbox checked={modoTeste} onCheckedChange={(v) => setModoTeste(v === true)} />
            Modo teste sem cor
          </label>
          <p className="text-[12px] text-muted-foreground">
            Teste: folha sem cor e sem foto, com régua de 40 mm, para conferir as medidas gastando pouca tinta.
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <ModuleButton variant="outline" onClick={() => void gerar('previa')} disabled={gerando}>
              <Eye className="size-4" />
              Pré-visualizar
            </ModuleButton>
            <ModuleButton onClick={() => void gerar('imprimir')} disabled={gerando}>
              <Printer className="size-4" />
              {modoTeste ? 'Imprimir teste' : 'Emitir crachás'}
            </ModuleButton>
          </div>
        </div>

        <p className="mb-4 flex items-start gap-2 text-[12px] text-muted-foreground">
          <Printer className="mt-0.5 size-3.5 shrink-0" />
          Na janela de impressão escolha <strong>&quot;Tamanho real&quot; / escala 100%</strong> (sem ajustar à página) e
          ative &quot;Gráficos de segundo plano&quot; para o degradê sair. Cada folha leva 9 crachás com marcas de corte.
        </p>

        {fila.length === 0 ? (
          <EmptyState
            icon={<IdCard className="size-6" />}
            title={avisoVazio ? 'Selecione ao menos um colaborador' : undefined}
            description="Busque um colaborador acima para montar a fila de crachás."
          />
        ) : (
          <div className="flex flex-wrap gap-5">
            {fila.map((item) => {
              const c = item.colaborador
              const dados = dadosDoItem(item)
              const nomeMudou = item.nome.trim() !== c.nome_completo.trim()
              const cargoMudou = item.cargo.trim() !== (c.cargo ?? '').trim()
              return (
                <div key={c.id} className="flex w-[180px] flex-col items-center gap-2">
                  <CrachaPreview dados={dados} modo={modo} zoom={0.8} />
                  <div className="w-full space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Nome no crachá</Label>
                    <Input value={item.nome} onChange={(e) => editarNome(c.id, e.target.value)} className="h-8 text-[12px]" />
                    {nomeMudou && (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                        onClick={() => editarNome(c.id, c.nome_completo)}
                      >
                        <RotateCcw className="size-3" /> Voltar ao nome do cadastro
                      </button>
                    )}
                    <Label className="pt-1 text-[10px] text-muted-foreground">Função no crachá</Label>
                    <Input value={item.cargo} onChange={(e) => editarCargo(c.id, e.target.value)} className="h-8 text-[12px]" />
                    {cargoMudou && (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                        onClick={() => editarCargo(c.id, c.cargo ?? '')}
                      >
                        <RotateCcw className="size-3" /> Voltar à função do cadastro
                      </button>
                    )}
                    {crachaSemCargo({ cargo: dados.cargo }) && (
                      <p className="flex items-center gap-1 text-[11px] text-amber-700">
                        <AlertTriangle className="size-3" /> Sem função — preencha ou o crachá sai sem
                      </p>
                    )}
                    {!item.fotoDataUrl && !item.carregandoFoto && (
                      <p className="flex items-center gap-1 text-[11px] text-amber-700">
                        <AlertTriangle className="size-3" /> Sem foto — anexe antes de imprimir
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <ModuleButton variant="outline" size="sm" onClick={() => escolherFoto(c.id)}>
                      <Camera className="size-3.5" />
                      {item.fotoDataUrl ? 'Trocar foto' : 'Enviar foto'}
                    </ModuleButton>
                    <ModuleButton variant="ghost" size="sm" onClick={() => removerDaFila(c.id)} aria-label={`Remover ${c.nome_completo} da fila`}>
                      <X className="size-3.5" />
                    </ModuleButton>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ModuleCard>

      {podeConfigurarLogo && <CrachaAparenciaCard empresas={empresas} config={config} onChange={setConfig} modo={modo} />}

      <Dialog open={htmlPrevia !== null} onOpenChange={(aberto) => !aberto && setHtmlPrevia(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização das folhas{modoTeste ? ' (modo teste)' : ''}</DialogTitle>
            <DialogDescription>
              Imprima em &quot;Tamanho real&quot; / 100%. A pré-visualização mostra as folhas A4 como sairão no papel.
            </DialogDescription>
          </DialogHeader>
          {htmlPrevia !== null && (
            <iframe title="Pré-visualização dos crachás" srcDoc={htmlPrevia} className="h-[70vh] w-full rounded border border-border" />
          )}
          <div className="flex justify-end gap-2">
            <ModuleButton variant="outline" onClick={() => setHtmlPrevia(null)}>
              Fechar
            </ModuleButton>
            <ModuleButton
              onClick={() => {
                setHtmlPrevia(null)
                void gerar('imprimir')
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
