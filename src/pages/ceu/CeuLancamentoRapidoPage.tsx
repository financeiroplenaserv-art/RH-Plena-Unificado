import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Save, Search, User, Package, Hash, Trash2, Copy } from 'lucide-react'
import { Input } from '@/components/ui/input'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CeuShell } from './CeuShell'
import { PageHeader } from '@/components/corh/PageHeader'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useCEUItens } from '@/hooks/useCEUItens'
import { useCEUEntregas } from '@/hooks/useCEUEntregas'
import { cn } from '@/lib/utils'
import { listarTamanhos, resumoTamanhos, tamanhoParaItem, tamanhoDoNomeItem } from '@/lib/ceu/tamanhos'
import { toast } from 'sonner'
import type { CeuTamanhos, Colaborador, ItemCEU } from '@/types/database'

const TIPOS = ['EPI', 'Uniforme', 'Crachá'] as const
type TipoItem = (typeof TIPOS)[number]

const STATUS_OPCOES = ['Troca', 'Novo', 'Substituição', 'Devolução'] as const
type StatusLancamento = (typeof STATUS_OPCOES)[number]

interface LinhaLancamento {
  id: string
  data: string
  colaboradorId: string
  colaboradorInput: string
  /** Medidas do colaborador (tabela ceu_tamanhos) — referência para a coluna Tam. */
  tamanhos: CeuTamanhos | null
  tipo: TipoItem | ''
  codigo: string
  produto: string
  itemId: string
  quantidade: number
  status: StatusLancamento | ''
}

function gerarId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Data de hoje no fuso LOCAL (não usar new Date().toISOString() aqui: ele
 * devolve a data em UTC e, a partir das 21h no horário de Brasília, já
 * aponta para o dia seguinte).
 */
function hojeLocalISO(): string {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}

/** Linha com qualquer conteúdo digitado (ignora os defaults de data/qtd/status). */
function linhaTemConteudo(linha: LinhaLancamento) {
  return !!(linha.colaboradorInput || linha.colaboradorId || linha.codigo || linha.produto)
}

/**
 * Cria uma linha nova. Com `base`, herda apenas a DATA da linha anterior
 * (fill-down); com `copiarColaborador`, herda também o colaborador — fluxo
 * "mesma pessoa, vários itens". Tipo, código, produto e quantidade nunca
 * são copiados (decisão da usuária: repetir só data e nome); status volta
 * ao padrão "Troca" (a maioria das entregas é troca; "Novo" é manual,
 * para admissão — decisão da gestão, 04/08/2026).
 */
function criarLinhaVazia(base?: LinhaLancamento, copiarColaborador = false): LinhaLancamento {
  return {
    id: gerarId(),
    data: base?.data || hojeLocalISO(),
    colaboradorId: copiarColaborador && base ? base.colaboradorId : '',
    colaboradorInput: copiarColaborador && base ? base.colaboradorInput : '',
    tamanhos: copiarColaborador && base ? base.tamanhos : null,
    tipo: '',
    codigo: '',
    produto: '',
    itemId: '',
    quantidade: 1,
    status: 'Troca',
  }
}

function normalizarCodigo(codigo: string) {
  return codigo.trim().toLowerCase()
}

/** Rascunho automático: sair da tela não perde as linhas preenchidas. */
const CHAVE_RASCUNHO = 'ceu-lancamento-rapido-rascunho'

function carregarRascunho(): LinhaLancamento[] {
  try {
    const salvo = localStorage.getItem(CHAVE_RASCUNHO)
    if (salvo) {
      const parsed = JSON.parse(salvo)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Rascunhos antigos (antes do ceu_tamanhos) não têm o campo `tamanhos`.
        // Linhas sem nenhum conteúdo digitado são apenas as linhas vazias
        // padrão que o rascunho persistiu — nelas a data é sempre a de HOJE;
        // caso contrário a tela abriria com a data do dia em que a página foi
        // visitada pela última vez (o rascunho grava até as linhas vazias).
        // Linhas com conteúdo mantêm a data escolhida (pode ser 1º do mês —
        // ver src/pages/ceu/AGENTS.md).
        return parsed.map((l) => {
          const linha = { tamanhos: null, ...l } as LinhaLancamento
          return linhaTemConteudo(linha) ? linha : { ...linha, data: hojeLocalISO() }
        })
      }
    }
  } catch {
    // Rascunho corrompido — ignora e começa limpo
  }
  return Array.from({ length: 5 }, () => criarLinhaVazia())
}

export function CeuLancamentoRapidoPage() {
  const navigate = useNavigate()
  const { colaboradores, listarResumido: listarColaboradores } = useColaboradores()
  const { itens, listar: listarItens } = useCEUItens()
  const { criar } = useCEUEntregas()
  // Itens inativos (cadastro sem movimentação) não entram em novos lançamentos
  const itensAtivos = useMemo(() => itens.filter((i) => i.situacao !== 'I'), [itens])
  const [linhas, setLinhas] = useState<LinhaLancamento[]>(carregarRascunho)
  const [salvando, setSalvando] = useState(false)
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null)
  const [destaqueColab, setDestaqueColab] = useState(0)
  const [dropdownProdutoAberto, setDropdownProdutoAberto] = useState<string | null>(null)
  const [destaqueProduto, setDestaqueProduto] = useState(0)
  const [mapaTamanhos, setMapaTamanhos] = useState<Map<string, CeuTamanhos>>(new Map())
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    listarColaboradores({ status: 'Ativo' })
    listarItens()
    listarTamanhos()
      .then(setMapaTamanhos)
      .catch((err) => console.error('Erro ao carregar tamanhos do CEU:', err))
  }, [listarColaboradores, listarItens])

  // Persiste o rascunho a cada alteração das linhas
  useEffect(() => {
    localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(linhas))
  }, [linhas])

  const mapaItensPorCodigo = useMemo(() => {
    const map = new Map<string, ItemCEU>()
    itensAtivos.forEach((item) => {
      if (item.codigo) map.set(normalizarCodigo(item.codigo), item)
      if (item.ca) map.set(normalizarCodigo(item.ca), item)
      map.set(normalizarCodigo(item.id), item)
    })
    return map
  }, [itensAtivos])

  const mapaItensPorId = useMemo(() => {
    const map = new Map<string, ItemCEU>()
    itensAtivos.forEach((item) => map.set(item.id, item))
    return map
  }, [itensAtivos])

  const mapaItensPorTipoENome = useMemo(() => {
    const map = new Map<string, ItemCEU[]>()
    itensAtivos.forEach((item) => {
      const chave = `${item.tipo?.toLowerCase() || ''}-${item.nome.toLowerCase()}`
      if (!map.has(chave)) map.set(chave, [])
      map.get(chave)!.push(item)
    })
    return map
  }, [itensAtivos])

  function colaboradoresSugeridos(input: string) {
    const termo = input.trim().toLowerCase()
    if (!termo) return []
    return colaboradores
      .filter(
        (c) =>
          c.nome_completo.toLowerCase().includes(termo) ||
          c.matricula.toLowerCase().includes(termo)
      )
      .slice(0, 8)
  }

  /** Sugestões de produto pelo nome, respeitando o Tipo escolhido na linha. */
  function itensSugeridos(linha: LinhaLancamento) {
    const termo = linha.produto.trim().toLowerCase()
    if (!termo) return []
    return itensAtivos
      .filter(
        (i) =>
          (!linha.tipo || i.tipo === linha.tipo) &&
          i.nome.toLowerCase().includes(termo)
      )
      .slice(0, 8)
  }

  function atualizarLinha(id: string, patch: Partial<LinhaLancamento>) {
    setLinhas((prev) => prev.map((linha) => (linha.id === id ? { ...linha, ...patch } : linha)))
  }

  function handleColaboradorInput(id: string, value: string) {
    atualizarLinha(id, {
      colaboradorInput: value,
      colaboradorId: '',
      tamanhos: null,
    })
    setDestaqueColab(0)
    setDropdownAberto(id)
  }

  function selecionarColaborador(id: string, colaborador: Colaborador) {
    atualizarLinha(id, {
      colaboradorId: colaborador.id,
      colaboradorInput: `${colaborador.nome_completo} — ${colaborador.matricula}`,
      tamanhos: mapaTamanhos.get(colaborador.id) ?? null,
    })
    setDropdownAberto(null)
  }

  function selecionarItem(id: string, item: ItemCEU) {
    atualizarLinha(id, {
      produto: item.nome,
      codigo: item.codigo || item.ca || item.id,
      itemId: item.id,
      tipo: (item.tipo as TipoItem) || '',
    })
    setDropdownProdutoAberto(null)
    inputRefs.current[`qtd-${id}`]?.focus()
  }

  /** Teclado no campo Colaborador: setas navegam, Enter escolhe e vai para o Código. */
  function handleKeyDownColaborador(e: React.KeyboardEvent, linha: LinhaLancamento, sugestoes: Colaborador[]) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDestaqueColab((d) => Math.min(d + 1, sugestoes.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDestaqueColab((d) => Math.max(d - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const alvo = sugestoes[destaqueColab] || sugestoes[0]
      if (alvo && dropdownAberto === linha.id) {
        selecionarColaborador(linha.id, alvo)
        inputRefs.current[`cod-${linha.id}`]?.focus()
      }
    }
  }

  /** Teclado no campo Produto: setas navegam, Enter escolhe e vai para a Qtd. */
  function handleKeyDownProduto(e: React.KeyboardEvent, linha: LinhaLancamento, sugestoes: ItemCEU[]) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDestaqueProduto((d) => Math.min(d + 1, sugestoes.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDestaqueProduto((d) => Math.max(d - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const alvo = sugestoes[destaqueProduto] || sugestoes[0]
      if (alvo && dropdownProdutoAberto === linha.id) {
        selecionarItem(linha.id, alvo)
      }
    }
  }

  /** Enter no Código (item resolvido) vai direto para a Quantidade. */
  function handleKeyDownCodigo(e: React.KeyboardEvent, linha: LinhaLancamento) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (linha.itemId) inputRefs.current[`qtd-${linha.id}`]?.focus()
    }
  }

  /** Enter na Quantidade cria a próxima linha herdando data, colaborador e status. */
  function handleKeyDownQuantidade(e: React.KeyboardEvent, linha: LinhaLancamento) {
    if (e.key === 'Enter') {
      e.preventDefault()
      adicionarLinhaAPartir(linha)
    }
  }

  /** Insere uma nova linha logo abaixo, herdando data, colaborador e status (item 1). */
  function adicionarLinhaAPartir(linha: LinhaLancamento) {
    const nova = criarLinhaVazia(linha, true)
    setLinhas((prev) => {
      const idx = prev.findIndex((l) => l.id === linha.id)
      const copia = [...prev]
      copia.splice(idx + 1, 0, nova)
      return copia
    })
    setTimeout(() => inputRefs.current[`cod-${nova.id}`]?.focus(), 0)
  }

  /** Repete apenas data e colaborador numa nova linha logo abaixo (nunca tipo/código/produto). */
  function duplicarLinha(id: string) {
    setLinhas((prev) => {
      const idx = prev.findIndex((l) => l.id === id)
      if (idx === -1) return prev
      const copia = [...prev]
      copia.splice(idx + 1, 0, criarLinhaVazia(prev[idx], true))
      return copia
    })
  }

  function handleCodigo(id: string, value: string) {
    const item = mapaItensPorCodigo.get(normalizarCodigo(value))
    atualizarLinha(id, {
      codigo: value,
      produto: item ? item.nome : '',
      itemId: item ? item.id : '',
      tipo: item ? (item.tipo as TipoItem) || '' : '',
    })
  }

  function handleTipoChange(id: string, tipo: TipoItem) {
    const linha = linhas.find((l) => l.id === id)
    if (!linha) return

    let produtoAtualizado = linha.produto
    let codigoAtualizado = linha.codigo
    let itemIdAtualizado = linha.itemId

    if (linha.produto && !linha.itemId) {
      const chave = `${tipo.toLowerCase()}-${linha.produto.toLowerCase()}`
      const itensEncontrados = mapaItensPorTipoENome.get(chave)
      if (itensEncontrados && itensEncontrados.length > 0) {
        const item = itensEncontrados[0]
        produtoAtualizado = item.nome
        codigoAtualizado = item.codigo || item.ca || item.id
        itemIdAtualizado = item.id
      }
    }

    atualizarLinha(id, {
      tipo,
      produto: produtoAtualizado,
      codigo: codigoAtualizado,
      itemId: itemIdAtualizado,
    })
  }

  function handleProdutoChange(id: string, produto: string) {
    atualizarLinha(id, {
      produto,
      itemId: '',
      codigo: '',
    })
    setDestaqueProduto(0)
    setDropdownProdutoAberto(id)
  }

  /** Novas linhas em lote herdam data e status da última linha (fill-down). */
  function adicionarLinhas(quantidade: number) {
    setLinhas((prev) => {
      const ultima = prev[prev.length - 1]
      return [...prev, ...Array.from({ length: quantidade }, () => criarLinhaVazia(ultima, false))]
    })
  }

  function removerLinha(id: string) {
    setLinhas((prev) => prev.filter((linha) => linha.id !== id))
  }

  function linhaValida(linha: LinhaLancamento) {
    return (
      linha.data &&
      linha.colaboradorId &&
      linha.tipo &&
      linha.itemId &&
      linha.quantidade > 0 &&
      linha.status
    )
  }

  async function handleSalvar() {
    const linhasParaSalvar = linhas.filter(linhaValida)
    if (linhasParaSalvar.length === 0) {
      toast.error('Preencha pelo menos uma linha corretamente')
      return
    }

    setSalvando(true)
    let sucesso = 0

    for (const linha of linhasParaSalvar) {
      try {
        const item = mapaItensPorId.get(linha.itemId)
        const result = await criar({
          colaborador_id: linha.colaboradorId,
          item_id: linha.itemId,
          data_entrega: linha.data,
          quantidade: linha.quantidade,
          // situacao alimenta o recibo (antes só ia para observacao e o
          // recibo saía sempre "Novo"); observacao mantida por compatibilidade.
          situacao: linha.status || 'Troca',
          observacao: linha.status,
          snapshot_item: item
            ? {
                nome: item.nome,
                codigo: item.codigo || '',
                tipo: item.tipo,
                ca: item.ca || '',
                valor: item.valor || null,
                prazo_uso_dias: item.prazo_uso_dias || null,
              }
            : undefined,
        })
        if (result) sucesso++
      } catch (err) {
        console.error('Erro ao registrar entrega:', linha, err)
      }
    }

    setSalvando(false)
    toast.success(`${sucesso} entrega(s) registrada(s) com sucesso`)

    if (sucesso > 0) {
      // Linhas com conteúdo que NÃO foram salvas permanecem na tela para
      // correção — antes a grade inteira era apagada e elas se perdiam.
      const pendentes = linhas.filter((l) => !linhaValida(l) && linhaTemConteudo(l))
      if (pendentes.length > 0) {
        toast.warning(`${pendentes.length} linha(s) ficaram de fora (campos incompletos) — elas permanecem na tela`, { duration: 6000 })
        setLinhas(pendentes)
      } else {
        localStorage.removeItem(CHAVE_RASCUNHO)
        setLinhas(Array.from({ length: 5 }, () => criarLinhaVazia()))
        navigate('/ceu/movimentacoes', { state: { entregaCriada: true } })
      }
    }
  }

  return (
    <CeuShell>
      <div className="space-y-6">
        <PageHeader backTo="/ceu/movimentacoes" title="Lançamento Rápido" description="Lance entregas de EPI, Uniforme e Crachá em massa">
          <ModuleButton variant="outline" size="sm" onClick={() => adicionarLinhas(5)}>
            <Plus className="w-4 h-4 mr-1.5" />
            +5 Linhas
          </ModuleButton>
          <ModuleButton variant="outline" size="sm" onClick={() => adicionarLinhas(10)}>
            <Plus className="w-4 h-4 mr-1.5" />
            +10 Linhas
          </ModuleButton>
          <ModuleButton
            size="sm"
            onClick={handleSalvar}
            disabled={salvando || linhas.filter(linhaValida).length === 0}
          >
            <Save className="w-4 h-4 mr-1.5" />
            {salvando ? 'Salvando...' : 'Salvar'}
          </ModuleButton>
        </PageHeader>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border border-green-500 bg-green-50" />
            <span>Preenchido corretamente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border border-slate-300 bg-white" />
            <span>Campo vazio</span>
          </div>
        </div>

        <ModuleCard title="Planilha de lançamento" description="Preencha as linhas abaixo. Os campos Data, Colaborador, Tipo, Código, Produto, Qtd e Status são obrigatórios.">
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-sm border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                  <th className="px-3 py-2 w-36">Data</th>
                  <th className="px-3 py-2 min-w-[260px]">Colaborador</th>
                  <th className="px-3 py-2 w-32">Tipo</th>
                  <th className="px-3 py-2 w-28">Código</th>
                  <th className="px-3 py-2 min-w-[220px]">Produto</th>
                  <th className="px-3 py-2 w-16" title="Tamanho de referência do cadastro CEU (apenas visual)">Tam.</th>
                  <th className="px-3 py-2 w-20">Qtd</th>
                  <th className="px-3 py-2 w-36">Status</th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, index) => {
                  const sugestoes = colaboradoresSugeridos(linha.colaboradorInput)
                  const sugestoesItens = itensSugeridos(linha)
                  // Linha "repetição": herdou data+nome da linha de cima e ainda
                  // não tem item — fica azul até receber EPI/Uniforme/Crachá.
                  const ehRepeticao =
                    index > 0 &&
                    !!linha.colaboradorId &&
                    linhas[index - 1].colaboradorId === linha.colaboradorId &&
                    !linha.itemId
                  const resumoTam = resumoTamanhos(linha.tamanhos)
                  const itemDaLinha = linha.itemId ? mapaItensPorId.get(linha.itemId) : undefined
                  const tamSugerido = itemDaLinha ? tamanhoParaItem(itemDaLinha.nome, linha.tamanhos) : null
                  // Alerta (não bloqueia): o item escolhido tem tamanho diferente do cadastro
                  const tamDoItem = itemDaLinha ? tamanhoDoNomeItem(itemDaLinha.nome) : null
                  const tamDivergente =
                    !!tamSugerido && !!tamDoItem &&
                    tamSugerido.toUpperCase() !== tamDoItem.toUpperCase()

                  return (
                    <tr
                      key={linha.id}
                      className={cn(
                        'border-b border-slate-100 transition-colors',
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      )}
                    >
                      <td className="px-2 py-1.5 align-top">
                        <Input
                          type="date"
                          value={linha.data}
                          onChange={(e) => atualizarLinha(linha.id, { data: e.target.value })}
                          className={cn(
                            'h-9 text-xs px-2',
                            ehRepeticao && 'text-[#0F6CBD] font-medium',
                            linha.data ? 'border-green-500 focus-visible:ring-green-200' : 'border-slate-300'
                          )}
                        />
                      </td>

                      <td className="px-2 py-1.5 align-top relative max-w-[260px]">
                        <div className="relative">
                          <User className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                          <Input
                            ref={(el) => { inputRefs.current[`colab-${linha.id}`] = el }}
                            value={linha.colaboradorInput}
                            onChange={(e) => handleColaboradorInput(linha.id, e.target.value)}
                            onKeyDown={(e) => handleKeyDownColaborador(e, linha, sugestoes)}
                            onFocus={() => { setDestaqueColab(0); setDropdownAberto(linha.id) }}
                            onBlur={() => setTimeout(() => setDropdownAberto(null), 200)}
                            placeholder="Nome ou matrícula..."
                            className={cn(
                              'h-9 text-xs pl-7 pr-2',
                              ehRepeticao && 'text-[#0F6CBD] font-medium',
                              linha.colaboradorId
                                ? 'border-green-500 focus-visible:ring-green-200'
                                : 'border-slate-300'
                            )}
                          />
                          {dropdownAberto === linha.id && sugestoes.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                              {sugestoes.map((colab, idx) => (
                                <button
                                  key={colab.id}
                                  type="button"
                                  tabIndex={-1}
                                  onMouseDown={() => selecionarColaborador(linha.id, colab)}
                                  onMouseEnter={() => setDestaqueColab(idx)}
                                  className={cn(
                                    'w-full text-left px-3 py-2 text-xs border-b border-slate-50 last:border-0',
                                    idx === destaqueColab ? 'bg-blue-50' : 'hover:bg-slate-50'
                                  )}
                                >
                                  <p className="font-medium text-slate-900">{colab.nome_completo}</p>
                                  <p className="text-slate-500">{colab.matricula} — {colab.departamento || '—'}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {resumoTam && (
                          <p className="text-[10px] text-slate-500 mt-0.5 pl-1">📏 {resumoTam}</p>
                        )}
                      </td>

                      <td className="px-2 py-1.5 align-top">
                        <Select value={linha.tipo} onValueChange={(v) => handleTipoChange(linha.id, v as TipoItem)}>
                          <SelectTrigger
                            className={cn(
                              'h-9 text-xs px-2',
                              linha.tipo ? 'border-green-500 focus:ring-green-200' : 'border-slate-300'
                            )}
                          >
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="px-2 py-1.5 align-top">
                        <div className="relative">
                          <Hash className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                          <Input
                            ref={(el) => { inputRefs.current[`cod-${linha.id}`] = el }}
                            value={linha.codigo}
                            onChange={(e) => handleCodigo(linha.id, e.target.value)}
                            onKeyDown={(e) => handleKeyDownCodigo(e, linha)}
                            placeholder="CA/código"
                            className={cn(
                              'h-9 text-xs pl-7 pr-2',
                              linha.itemId
                                ? 'border-green-500 focus-visible:ring-green-200'
                                : linha.codigo.trim()
                                  ? 'border-red-500 focus-visible:ring-red-200'
                                  : 'border-slate-300'
                            )}
                          />
                        </div>
                        {linha.codigo.trim() && !linha.itemId && (
                          <p className="text-[10px] text-red-600 mt-0.5 pl-1">Código não encontrado no cadastro</p>
                        )}
                      </td>

                      <td className="px-2 py-1.5 align-top relative max-w-[220px]">
                        <div className="relative">
                          <Package className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                          <Input
                            value={linha.produto}
                            onChange={(e) => handleProdutoChange(linha.id, e.target.value)}
                            onKeyDown={(e) => handleKeyDownProduto(e, linha, sugestoesItens)}
                            onFocus={() => { setDestaqueProduto(0); if (linha.produto.trim() && !linha.itemId) setDropdownProdutoAberto(linha.id) }}
                            onBlur={() => setTimeout(() => setDropdownProdutoAberto(null), 200)}
                            placeholder="Produto"
                            className={cn(
                              'h-9 text-xs pl-7 pr-2',
                              linha.produto.trim() && linha.itemId
                                ? 'border-green-500 focus-visible:ring-green-200'
                                : 'border-slate-300'
                            )}
                          />
                          {dropdownProdutoAberto === linha.id && sugestoesItens.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                              {sugestoesItens.map((item, idx) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  tabIndex={-1}
                                  onMouseDown={() => selecionarItem(linha.id, item)}
                                  onMouseEnter={() => setDestaqueProduto(idx)}
                                  className={cn(
                                    'w-full text-left px-3 py-2 text-xs border-b border-slate-50 last:border-0',
                                    idx === destaqueProduto ? 'bg-blue-50' : 'hover:bg-slate-50'
                                  )}
                                >
                                  <p className="font-medium text-slate-900">{item.nome}</p>
                                  <p className="text-slate-500">{[item.tipo, item.ca ? `CA ${item.ca}` : null, item.codigo].filter(Boolean).join(' — ')}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-2 py-1.5 align-top">
                        {tamSugerido ? (
                          <span
                            className={cn(
                              'inline-block px-2 py-1 rounded text-xs',
                              tamDivergente
                                ? 'bg-red-50 text-red-600 font-bold'
                                : 'bg-blue-50 text-[#0F6CBD] font-semibold'
                            )}
                            title={
                              tamDivergente
                                ? `Atenção: o cadastro indica ${tamSugerido}, mas o item escolhido é ${tamDoItem}. Verifique antes de salvar (não bloqueia o lançamento).`
                                : 'Tamanho de referência do cadastro CEU — apenas orientação, não é gravado'
                            }
                          >
                            {tamSugerido}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-2 py-1.5 align-top">
                        <Input
                          ref={(el) => { inputRefs.current[`qtd-${linha.id}`] = el }}
                          type="number"
                          min={1}
                          value={linha.quantidade}
                          onChange={(e) =>
                            atualizarLinha(linha.id, { quantidade: Math.max(1, parseInt(e.target.value) || 0) })
                          }
                          onKeyDown={(e) => handleKeyDownQuantidade(e, linha)}
                          className={cn(
                            'h-9 text-xs px-2',
                            linha.quantidade > 0 ? 'border-green-500 focus-visible:ring-green-200' : 'border-slate-300'
                          )}
                        />
                      </td>

                      <td className="px-2 py-1.5 align-top">
                        <Select value={linha.status} onValueChange={(v) => atualizarLinha(linha.id, { status: v as StatusLancamento })}>
                          <SelectTrigger
                            className={cn(
                              'h-9 text-xs px-2',
                              linha.status ? 'border-green-500 focus:ring-green-200' : 'border-slate-300'
                            )}
                          >
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPCOES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <div className="flex items-center gap-0.5">
                          <ModuleButton
                            variant="ghost"
                            size="icon"
                            onClick={() => duplicarLinha(linha.id)}
                            className="h-8 w-8 text-slate-400 hover:text-[#0F6CBD]"
                            title="Repetir data e colaborador numa nova linha"
                          >
                            <Copy className="w-4 h-4" />
                          </ModuleButton>
                          <ModuleButton
                            variant="ghost"
                            size="icon"
                            onClick={() => removerLinha(linha.id)}
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                            title="Remover linha"
                          >
                            <Trash2 className="w-4 h-4" />
                          </ModuleButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {linhas.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Search className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              Nenhuma linha para lançar.
            </div>
          )}
        </ModuleCard>

        <div className="flex flex-wrap gap-2">
          <ModuleButton variant="outline" onClick={() => adicionarLinhas(5)}>
            <Plus className="w-4 h-4 mr-1.5" />
            +5 Linhas
          </ModuleButton>
          <ModuleButton variant="outline" onClick={() => adicionarLinhas(10)}>
            <Plus className="w-4 h-4 mr-1.5" />
            +10 Linhas
          </ModuleButton>
          <ModuleButton
            onClick={handleSalvar}
            disabled={salvando || linhas.filter(linhaValida).length === 0}
          >
            <Save className="w-4 h-4 mr-1.5" />
            {salvando ? 'Salvando...' : 'Salvar'}
          </ModuleButton>
        </div>
      </div>
    </CeuShell>
  )
}

