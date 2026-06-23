import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Save, CheckCircle2, FileText, User, Package, AlertTriangle, Search } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BadgeStatus } from '@/components/BadgeStatus'
import { useCEUEntregas } from '@/hooks/useCEUEntregas'
import { useCEUItens } from '@/hooks/useCEUItens'
import { useColaboradores } from '@/hooks/useColaboradores'
import { Input } from '@/components/ui/input'
import { CeuPage } from '@/components/ceu/CeuPage'
import { CeuCard } from '@/components/ceu/CeuCard'
import { CeuButton } from '@/components/ceu/CeuButton'
import { CeuInput } from '@/components/ceu/CeuInput'
import { CeuBadge } from '@/components/ceu/CeuBadge'
import { CeuReciboModal, type DadosEntrega } from '@/components/ceu/CeuReciboModal'
import { COLABORADORES_MOCK, ITENS_MOCK } from '@/components/ceu/mockData'
import type { Colaborador, ItemCEU, EntregaCEU } from '@/types/database'
import { toast } from 'sonner'

function badgeType(tipo: string) {
  switch (tipo) {
    case 'EPI':
    case 'Equipamento':
      return 'epi'
    case 'Uniforme':
      return 'uniforme'
    case 'Cracha':
    case 'Crachá':
      return 'cracha'
    default:
      return 'outros'
  }
}

export function CeuEntregaFormPage() {
  const navigate = useNavigate()
  const { criar, listar: listarEntregas } = useCEUEntregas()
  const { itens, loading: carregandoItens, listar: listarItens } = useCEUItens()
  const { colaboradores, listar: listarColaboradores } = useColaboradores()

  const [passo, setPasso] = useState(1)
  const [modoMock, setModoMock] = useState(false)
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [colabInput, setColabInput] = useState('')
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const inputColabRef = useRef<HTMLInputElement>(null)
  const [itensSelecionados, setItensSelecionados] = useState<Record<string, { item: ItemCEU; quantidade: number }>>({})
  const [dataEntrega, setDataEntrega] = useState(new Date().toISOString().split('T')[0])
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroSubgrupo, setFiltroSubgrupo] = useState('')
  const [modalRecibo, setModalRecibo] = useState(false)
  const [dadosRecibo, setDadosRecibo] = useState<DadosEntrega | null>(null)
  const [historicoEntregas, setHistoricoEntregas] = useState<EntregaCEU[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)

  useEffect(() => {
    listarItens()
    listarColaboradores({ status: 'Ativo' })
  }, [listarItens, listarColaboradores])

  useEffect(() => {
    if (!colaborador) {
      setHistoricoEntregas([])
      return
    }
    setCarregandoHistorico(true)
    listarEntregas({ colaboradorId: colaborador.id }).then((entregas) => {
      setHistoricoEntregas(entregas || [])
      setCarregandoHistorico(false)
    })
  }, [colaborador, listarEntregas])

  const colaboradoresSugeridos = useMemo(() => {
    const termo = colabInput.trim().toLowerCase()
    if (!termo) return colaboradores.slice(0, 10)
    return colaboradores
      .filter(
        (c) =>
          c.nome_completo.toLowerCase().includes(termo) ||
          c.matricula.toLowerCase().includes(termo)
      )
      .slice(0, 10)
  }, [colabInput, colaboradores])

  const handleColabInput = (value: string) => {
    setColabInput(value)
    if (colaborador) setColaborador(null)
    setDropdownAberto(true)
  }

  const selecionarColaborador = (colab: Colaborador) => {
    setColaborador(colab)
    setColabInput(`${colab.nome_completo} — ${colab.matricula}`)
    setDropdownAberto(false)
  }

  const itensDisponiveis = useMemo(() => (modoMock ? ITENS_MOCK : itens), [modoMock, itens])

  const selecionadosArray = useMemo(
    () => Object.values(itensSelecionados),
    [itensSelecionados]
  )

  const tiposUnicos = useMemo(() => {
    return [...new Set(itensDisponiveis.map((i) => i.tipo))].filter(Boolean).sort()
  }, [itensDisponiveis])

  const subgruposUnicos = useMemo(() => {
    return [
      ...new Set(
        itensDisponiveis
          .filter((i) => !filtroTipo || i.tipo === filtroTipo)
          .map((i) => i.subgrupo)
      ),
    ]
      .filter(Boolean)
      .sort()
  }, [itensDisponiveis, filtroTipo])

  const itensFiltrados = useMemo(() => {
    return itensDisponiveis.filter((i) => {
      if (filtroTipo && i.tipo !== filtroTipo) return false
      if (filtroSubgrupo && i.subgrupo !== filtroSubgrupo) return false
      return true
    })
  }, [itensDisponiveis, filtroTipo, filtroSubgrupo])

  const toggleItem = (item: ItemCEU) => {
    setItensSelecionados((prev) => {
      const next = { ...prev }
      if (next[item.id]) {
        delete next[item.id]
      } else {
        next[item.id] = { item, quantidade: 1 }
      }
      return next
    })
  }

  const setQuantidade = (itemId: string, quantidade: number) => {
    setItensSelecionados((prev) => {
      if (!prev[itemId]) return prev
      return {
        ...prev,
        [itemId]: { ...prev[itemId], quantidade: Math.max(1, quantidade) },
      }
    })
  }

  const avancar = () => {
    if (passo === 1 && !colaborador) {
      toast.error('Selecione um colaborador para continuar')
      return
    }
    if (passo === 2 && selecionadosArray.length === 0) {
      toast.error('Selecione pelo menos um item')
      return
    }
    setPasso((p) => Math.min(p + 1, 3))
  }

  const voltar = () => setPasso((p) => Math.max(p - 1, 1))

  const confirmar = async () => {
    if (!colaborador) return
    if (selecionadosArray.length === 0) return

    setSalvando(true)
    try {
      if (!modoMock) {
        for (const { item, quantidade } of selecionadosArray) {
          await criar({
            colaborador_id: colaborador.id,
            item_id: item.id,
            data_entrega: dataEntrega,
            quantidade,
            observacao: observacao || null,
            snapshot_item: {
              nome: item.nome,
              tipo: item.tipo,
              ca: item.ca || '',
              prazo_uso_dias: item.prazo_uso_dias || null,
            },
          })
        }
      }
      toast.success(modoMock ? 'Entrega simulada com sucesso (modo demonstração)' : 'Entregas registradas com sucesso')
      setConcluido(true)
      setPasso(4)
    } catch {
      toast.error('Erro ao registrar entrega')
    } finally {
      setSalvando(false)
    }
  }

  const abrirRecibo = () => {
    if (!colaborador) return
    const dados: DadosEntrega = {
      colaborador: {
        nome: colaborador.nome_completo || '—',
        matricula: colaborador.matricula || '—',
        cargo: colaborador.cargo || '—',
        departamento: colaborador.departamento || '—',
        cpf: colaborador.cpf || '00000000000',
        data_admissao: colaborador.data_admissao,
      },
      itens: selecionadosArray.map(({ item, quantidade }) => ({
        nome: item.nome || '—',
        grupo: item.tipo || 'Uniforme',
        subgrupo: item.subgrupo || '—',
        quantidade,
      })),
      dataEntrega,
    }
    setDadosRecibo(dados)
    setModalRecibo(true)
  }

  return (
    <CeuPage>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <CeuButton variant="ghost" onClick={() => navigate('/ceu/movimentacoes')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </CeuButton>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nova entrega</h2>
            <p className="text-sm text-slate-500">Wizard de entrega de itens CEU</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {[1, 2, 3].map((p) => (
              <div
                key={p}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                  p === passo
                    ? 'bg-[#3B82F6] text-white'
                    : p < passo
                      ? 'bg-[#1E40AF] text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {p < passo ? <CheckCircle2 className="w-4 h-4" /> : p}
              </div>
            ))}
          </div>
          <CeuButton variant="outline" size="sm" onClick={() => setModoMock((m) => !m)}>
            {modoMock ? 'Usar dados reais' : 'Usar dados de demonstração'}
          </CeuButton>
        </div>

        {passo === 1 && (
          <CeuCard title="Passo 1: Selecionar colaborador" icon={<User className="w-4 h-4" />} gradient="blue">
            <div className="space-y-4">
              {modoMock ? (
                <div className="space-y-2">
                  <Label>Colaborador de demonstração</Label>
                  <Select
                    value={colaborador?.id || '__placeholder__'}
                    onValueChange={(id) => {
                      if (id === '__placeholder__') return
                      const c = COLABORADORES_MOCK.find((c) => c.id === id) || null
                      setColaborador(c)
                    }}
                  >
                    <SelectTrigger className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
                      <SelectValue placeholder="Selecione um colaborador..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__placeholder__" disabled>Selecione um colaborador...</SelectItem>
                      {COLABORADORES_MOCK.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome_completo} — {c.matricula}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Colaborador</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      ref={inputColabRef}
                      value={colabInput}
                      onChange={(e) => handleColabInput(e.target.value)}
                      onFocus={() => setDropdownAberto(true)}
                      onBlur={() => setTimeout(() => setDropdownAberto(false), 200)}
                      placeholder="Buscar por nome ou matrícula..."
                      className="pl-10"
                      autoComplete="off"
                    />
                    {dropdownAberto && colaboradoresSugeridos.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                        {colaboradoresSugeridos.map((colab) => (
                          <button
                            key={colab.id}
                            type="button"
                            onMouseDown={() => selecionarColaborador(colab)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0"
                          >
                            <p className="font-medium text-slate-900">{colab.nome_completo}</p>
                            <p className="text-xs text-slate-500">{colab.matricula} — {colab.departamento || '—'}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {colaborador && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <p className="text-xs text-slate-500">Nome</p>
                      <p className="text-sm font-medium text-slate-900">{colaborador.nome_completo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Matrícula</p>
                      <p className="text-sm font-medium text-slate-900">{colaborador.matricula}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Departamento</p>
                      <p className="text-sm font-medium text-slate-900">{colaborador.departamento || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Status</p>
                      <div className="mt-1">
                        <BadgeStatus status={colaborador.status} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Cargo</p>
                      <p className="text-sm font-medium text-slate-900">{colaborador.cargo || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">E-mail</p>
                      <p className="text-sm font-medium text-slate-900">{colaborador.email || '—'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Histórico de entregas</p>
                    {carregandoHistorico ? (
                      <div className="text-center py-4 text-slate-500">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#3B82F6] mx-auto mb-2" />
                        Carregando histórico...
                      </div>
                    ) : historicoEntregas.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhuma entrega anterior registrada.</p>
                    ) : (
                      <div className="border rounded-lg overflow-hidden border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-slate-700">Item</th>
                              <th className="text-left px-3 py-2 font-medium text-slate-700">Tipo</th>
                              <th className="text-center px-3 py-2 font-medium text-slate-700">Qtd</th>
                              <th className="text-left px-3 py-2 font-medium text-slate-700">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historicoEntregas.map((e) => (
                              <tr key={e.id} className="border-t border-slate-100">
                                <td className="px-3 py-2">{e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—'}</td>
                                <td className="px-3 py-2">{e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || '—'}</td>
                                <td className="px-3 py-2 text-center">{e.quantidade}</td>
                                <td className="px-3 py-2">{new Date(e.data_entrega).toLocaleDateString('pt-BR')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex justify-end pt-2">
                <CeuButton onClick={avancar}>
                  Próximo <ArrowRight className="w-4 h-4 ml-2" />
                </CeuButton>
              </div>
            </div>
          </CeuCard>
        )}

        {passo === 2 && (
          <CeuCard title="Passo 2: Selecionar itens" icon={<Package className="w-4 h-4" />} gradient="blue">
            <div className="space-y-4">
              {carregandoItens && !modoMock ? (
                <div className="text-center py-8 text-slate-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3B82F6] mx-auto mb-2" />
                  Carregando itens...
                </div>
              ) : itensDisponiveis.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  Nenhum item disponível.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Filtros hierárquicos */}
                  <div className="flex flex-col md:flex-row gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <Label className="text-xs text-slate-500 mb-1 block">Tipo (Grupo)</Label>
                      <Select
                        value={filtroTipo}
                        onValueChange={(v) => {
                          setFiltroTipo(v)
                          setFiltroSubgrupo('')
                        }}
                      >
                        <SelectTrigger className="bg-white border-slate-300">
                          <SelectValue placeholder="Todos os tipos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todos os tipos</SelectItem>
                          {tiposUnicos.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-slate-500 mb-1 block">Subgrupo</Label>
                      <Select
                        value={filtroSubgrupo}
                        onValueChange={setFiltroSubgrupo}
                      >
                        <SelectTrigger className="bg-white border-slate-300">
                          <SelectValue placeholder="Todos os subgrupos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todos os subgrupos</SelectItem>
                          {subgruposUnicos.map((s) => (
                            <SelectItem key={s || ''} value={s || ''}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {(filtroTipo || filtroSubgrupo) && (
                      <div className="flex items-end">
                        <CeuButton
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFiltroTipo('')
                            setFiltroSubgrupo('')
                          }}
                        >
                          Limpar filtros
                        </CeuButton>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 px-1">
                    Exibindo {itensFiltrados.length} de {itensDisponiveis.length} item(s)
                    {selecionadosArray.length > 0 && (
                      <span className="ml-2 text-[#3B82F6]">
                        ({selecionadosArray.length} selecionado{selecionadosArray.length > 1 ? 's' : ''})
                      </span>
                    )}
                  </p>

                  {itensFiltrados.map((item) => {
                    const selecionado = itensSelecionados[item.id]
                    const estoqueZerado = typeof item.estoque === 'number' && item.estoque === 0
                    const estoqueBaixo =
                      typeof item.estoque === 'number' &&
                      typeof item.estoque_minimo === 'number' &&
                      item.estoque_minimo > 0 &&
                      item.estoque > 0 &&
                      item.estoque <= item.estoque_minimo

                    const estoqueClass = estoqueZerado
                      ? 'text-red-600'
                      : estoqueBaixo
                        ? 'text-orange-600'
                        : 'text-slate-700'

                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                          selecionado
                            ? 'border-[#3B82F6] bg-blue-50/50'
                            : 'border-slate-200 hover:border-[#3B82F6]/50 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!selecionado}
                          onChange={() => toggleItem(item)}
                          className="mt-1 w-4 h-4 accent-[#3B82F6]"
                        />
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-2">
                            <p className="text-sm font-medium text-slate-900">{item.nome}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <CeuBadge type={badgeType(item.tipo)}>{item.tipo}</CeuBadge>
                              {item.subgrupo && (
                                <span className="text-xs text-slate-500">{item.subgrupo}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              {item.ca && <span>CA: {item.ca}</span>}
                              {item.prazo_uso_dias ? (
                                <span>Validade: {item.prazo_uso_dias} dias</span>
                              ) : item.validade ? (
                                <span>Validade: {new Date(item.validade).toLocaleDateString('pt-BR')}</span>
                              ) : null}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Estoque</p>
                            <p className={`text-sm font-semibold ${estoqueClass}`}>
                              {item.estoque ?? 0}
                              {(estoqueZerado || estoqueBaixo) && (
                                <AlertTriangle className="w-3.5 h-3.5 inline ml-1" />
                              )}
                            </p>
                            {estoqueZerado && (
                              <p className="text-xs text-red-600 font-medium">Sem estoque</p>
                            )}
                            {item.estoque_minimo ? (
                              <p className="text-xs text-slate-400">mín: {item.estoque_minimo}</p>
                            ) : null}
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Quantidade</p>
                            <CeuInput
                              type="number"
                              min={1}
                              disabled={!selecionado}
                              value={selecionado?.quantidade || 1}
                              onChange={(e) => setQuantidade(item.id, parseInt(e.target.value) || 1)}
                              className="w-24"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <CeuButton variant="outline" onClick={voltar}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </CeuButton>
                <CeuButton onClick={avancar}>
                  Próximo <ArrowRight className="w-4 h-4 ml-2" />
                </CeuButton>
              </div>
            </div>
          </CeuCard>
        )}

        {passo === 3 && (
          <CeuCard title="Passo 3: Confirmar entrega" icon={<FileText className="w-4 h-4" />} gradient="blue">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Colaborador</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <p className="text-xs text-slate-500">Nome</p>
                    <p className="text-sm font-medium text-slate-900">{colaborador?.nome_completo || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Matrícula</p>
                    <p className="text-sm font-medium text-slate-900">{colaborador?.matricula || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Departamento</p>
                    <p className="text-sm font-medium text-slate-900">{colaborador?.departamento || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Cargo</p>
                    <p className="text-sm font-medium text-slate-900">{colaborador?.cargo || '—'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Itens selecionados</h3>
                <div className="border rounded-lg overflow-hidden border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-slate-700">Item</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-700">Tipo</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-700">CA</th>
                        <th className="text-right px-4 py-2 font-medium text-slate-700">Qtd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selecionadosArray.map(({ item, quantidade }) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-2 font-medium text-slate-900">{item.nome}</td>
                          <td className="px-4 py-2">
                            <CeuBadge type={badgeType(item.tipo)}>{item.tipo}</CeuBadge>
                          </td>
                          <td className="px-4 py-2 text-slate-500">{item.ca || '—'}</td>
                          <td className="px-4 py-2 text-right font-semibold">{quantidade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_entrega">Data da entrega *</Label>
                  <CeuInput
                    id="data_entrega"
                    type="date"
                    value={dataEntrega}
                    onChange={(e) => setDataEntrega(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacao">Observação</Label>
                  <CeuInput
                    id="observacao"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Ex: Tamanho M, substituição..."
                  />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <CeuButton variant="outline" onClick={voltar}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </CeuButton>
                <CeuButton onClick={confirmar} disabled={salvando || !dataEntrega}>
                  <Save className="w-4 h-4 mr-2" />
                  {salvando ? 'Salvando...' : 'Confirmar entrega'}
                </CeuButton>
              </div>
            </div>
          </CeuCard>
        )}

        <CeuReciboModal isOpen={modalRecibo} onClose={() => setModalRecibo(false)} dadosEntrega={dadosRecibo} />

        {passo === 4 && concluido && (
          <CeuCard title="Entrega registrada" icon={<CheckCircle2 className="w-4 h-4" />} gradient="green">
            <div className="text-center space-y-4 py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Entrega registrada com sucesso</h3>
                <p className="text-sm text-slate-500">
                  {selecionadosArray.reduce((sum, { quantidade }) => sum + quantidade, 0)} unidade(s) entregue(s) para{' '}
                  {colaborador?.nome_completo}
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <CeuButton variant="outline" onClick={() => navigate('/ceu/movimentacoes')}>
                  Ver entregas
                </CeuButton>
                <CeuButton onClick={abrirRecibo}>
                  <FileText className="w-4 h-4 mr-2" />
                  Visualizar recibo
                </CeuButton>
              </div>
            </div>
          </CeuCard>
        )}
      </div>
    </CeuPage>
  )
}
