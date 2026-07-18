import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Save, Search, User, Package, Hash, Trash2 } from 'lucide-react'
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
import { toast } from 'sonner'
import type { Colaborador, ItemCEU } from '@/types/database'

const TIPOS = ['EPI', 'Uniforme', 'Crachá'] as const
type TipoItem = (typeof TIPOS)[number]

const STATUS_OPCOES = ['Novo', 'Substituição', 'Devolução'] as const
type StatusLancamento = (typeof STATUS_OPCOES)[number]

interface LinhaLancamento {
  id: string
  data: string
  colaboradorId: string
  colaboradorInput: string
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

function criarLinhaVazia(): LinhaLancamento {
  return {
    id: gerarId(),
    data: new Date().toISOString().split('T')[0],
    colaboradorId: '',
    colaboradorInput: '',
    tipo: '',
    codigo: '',
    produto: '',
    itemId: '',
    quantidade: 1,
    status: 'Novo',
  }
}

function normalizarCodigo(codigo: string) {
  return codigo.trim().toLowerCase()
}

export function CeuLancamentoRapidoPage() {
  const navigate = useNavigate()
  const { colaboradores, listar: listarColaboradores } = useColaboradores()
  const { itens, listar: listarItens } = useCEUItens()
  const { criar } = useCEUEntregas()
  const [linhas, setLinhas] = useState<LinhaLancamento[]>(() => Array.from({ length: 5 }, criarLinhaVazia))
  const [salvando, setSalvando] = useState(false)
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    listarColaboradores({ status: 'Ativo' })
    listarItens()
  }, [listarColaboradores, listarItens])

  const mapaItensPorCodigo = useMemo(() => {
    const map = new Map<string, ItemCEU>()
    itens.forEach((item) => {
      if (item.codigo) map.set(normalizarCodigo(item.codigo), item)
      if (item.ca) map.set(normalizarCodigo(item.ca), item)
      map.set(normalizarCodigo(item.id), item)
    })
    return map
  }, [itens])

  const mapaItensPorId = useMemo(() => {
    const map = new Map<string, ItemCEU>()
    itens.forEach((item) => map.set(item.id, item))
    return map
  }, [itens])

  const mapaItensPorTipoENome = useMemo(() => {
    const map = new Map<string, ItemCEU[]>()
    itens.forEach((item) => {
      const chave = `${item.tipo?.toLowerCase() || ''}-${item.nome.toLowerCase()}`
      if (!map.has(chave)) map.set(chave, [])
      map.get(chave)!.push(item)
    })
    return map
  }, [itens])

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

  function atualizarLinha(id: string, patch: Partial<LinhaLancamento>) {
    setLinhas((prev) => prev.map((linha) => (linha.id === id ? { ...linha, ...patch } : linha)))
  }

  function handleColaboradorInput(id: string, value: string) {
    atualizarLinha(id, {
      colaboradorInput: value,
      colaboradorId: '',
    })
    setDropdownAberto(id)
  }

  function selecionarColaborador(id: string, colaborador: Colaborador) {
    atualizarLinha(id, {
      colaboradorId: colaborador.id,
      colaboradorInput: `${colaborador.nome_completo} — ${colaborador.matricula}`,
    })
    setDropdownAberto(null)
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
  }

  function adicionarLinhas(quantidade: number) {
    setLinhas((prev) => [...prev, ...Array.from({ length: quantidade }, criarLinhaVazia)])
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
      setLinhas(Array.from({ length: 5 }, criarLinhaVazia))
      navigate('/ceu/movimentacoes')
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
                  <th className="px-3 py-2 w-20">Qtd</th>
                  <th className="px-3 py-2 w-36">Status</th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, index) => {
                  const sugestoes = colaboradoresSugeridos(linha.colaboradorInput)

                  return (
                    <tr
                      key={linha.id}
                      className={cn(
                        'border-b border-slate-100 transition-colors',
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      )}
                    >
                      <td className="px-2 py-1.5">
                        <Input
                          type="date"
                          value={linha.data}
                          onChange={(e) => atualizarLinha(linha.id, { data: e.target.value })}
                          className={cn(
                            'h-9 text-xs px-2',
                            linha.data ? 'border-green-500 focus-visible:ring-green-200' : 'border-slate-300'
                          )}
                        />
                      </td>

                      <td className="px-2 py-1.5 relative max-w-[260px]">
                        <div className="relative">
                          <User className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                          <Input
                            ref={(el) => { inputRefs.current[`colab-${linha.id}`] = el }}
                            value={linha.colaboradorInput}
                            onChange={(e) => handleColaboradorInput(linha.id, e.target.value)}
                            onFocus={() => setDropdownAberto(linha.id)}
                            onBlur={() => setTimeout(() => setDropdownAberto(null), 200)}
                            placeholder="Nome ou matrícula..."
                            className={cn(
                              'h-9 text-xs pl-7 pr-2',
                              linha.colaboradorId
                                ? 'border-green-500 focus-visible:ring-green-200'
                                : 'border-slate-300'
                            )}
                          />
                          {dropdownAberto === linha.id && sugestoes.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                              {sugestoes.map((colab) => (
                                <button
                                  key={colab.id}
                                  type="button"
                                  onMouseDown={() => selecionarColaborador(linha.id, colab)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0"
                                >
                                  <p className="font-medium text-slate-900">{colab.nome_completo}</p>
                                  <p className="text-slate-500">{colab.matricula} — {colab.departamento || '—'}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-2 py-1.5">
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

                      <td className="px-2 py-1.5">
                        <div className="relative">
                          <Hash className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                          <Input
                            value={linha.codigo}
                            onChange={(e) => handleCodigo(linha.id, e.target.value)}
                            placeholder="CA/código"
                            className={cn(
                              'h-9 text-xs pl-7 pr-2',
                              linha.itemId ? 'border-green-500 focus-visible:ring-green-200' : 'border-slate-300'
                            )}
                          />
                        </div>
                      </td>

                      <td className="px-2 py-1.5 max-w-[220px]">
                        <div className="relative">
                          <Package className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                          <Input
                            value={linha.produto}
                            onChange={(e) => handleProdutoChange(linha.id, e.target.value)}
                            placeholder="Produto"
                            className={cn(
                              'h-9 text-xs pl-7 pr-2',
                              linha.produto.trim() && linha.itemId
                                ? 'border-green-500 focus-visible:ring-green-200'
                                : 'border-slate-300'
                            )}
                          />
                        </div>
                      </td>

                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={1}
                          value={linha.quantidade}
                          onChange={(e) =>
                            atualizarLinha(linha.id, { quantidade: Math.max(1, parseInt(e.target.value) || 0) })
                          }
                          className={cn(
                            'h-9 text-xs px-2',
                            linha.quantidade > 0 ? 'border-green-500 focus-visible:ring-green-200' : 'border-slate-300'
                          )}
                        />
                      </td>

                      <td className="px-2 py-1.5">
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
                      <td className="px-2 py-1.5">
                        <ModuleButton
                          variant="ghost"
                          size="icon"
                          onClick={() => removerLinha(linha.id)}
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          title="Remover linha"
                        >
                          <Trash2 className="w-4 h-4" />
                        </ModuleButton>
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

