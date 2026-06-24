import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useExtras } from '@/hooks/useExtras'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useDepartamentos } from '@/hooks/useDepartamentos'
import { useAuth } from '@/hooks/useAuth'
import { mascaraMoeda, mascaraMoedaInput, parseMoeda, nomeDepartamento } from '@/lib/utils'
import type { Extra, TurnoExtra, MotivoExtra, ComunicacaoTipo, CategoriaOcorrencia } from '@/types/extras'

const TURNOS: TurnoExtra[] = ['Dia', 'Manhã', 'Tarde', 'Noite', 'Noite anterior']
const MOTIVOS: MotivoExtra[] = [
  'Atestado',
  'Falta sem justificativa',
  'Folga',
  'Férias',
  'Extra faturado',
  'Reforço estratégico',
  'Reforço faturado',
  'Limpeza interna',
  'Cobertura férias extra faturadas',
  'Outros',
]
const CATEGORIAS: CategoriaOcorrencia[] = ['Limpeza', 'Portaria', 'Operacional', 'Zelador', 'Jardinagem', 'Medidas disciplinares', 'Outros']
const MEIOS_COMUNICACAO: ComunicacaoTipo[] = ['WhatsApp', 'Email', 'Não se aplica']

const PASSOS = [
  { num: 1, titulo: 'Ocorrência', descricao: 'Data, turno, departamento e motivo' },
  { num: 2, titulo: 'Pessoas', descricao: 'Quem faltou e quem substituiu' },
  { num: 3, titulo: 'Valor', descricao: 'Valor a pagar e tipo de extra' },
  { num: 4, titulo: 'Comunicação', descricao: 'Cliente foi comunicado?' },
  { num: 5, titulo: 'Revisar', descricao: 'Confira e salve o registro' },
]

export function MobileFaltaPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { categorias, listarCategorias, criar } = useExtras()
  const { colaboradores, listar: listarColaboradores } = useColaboradores()
  const { departamentos, listar: listarDepartamentos } = useDepartamentos()

  const [passo, setPasso] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])
  const [turno, setTurno] = useState<TurnoExtra>('Dia')
  const [categoria, setCategoria] = useState<CategoriaOcorrencia>('Operacional')
  const [departamentoId, setDepartamentoId] = useState('')
  const [ausenteId, setAusenteId] = useState('')
  const [ausenteNaoAplica, setAusenteNaoAplica] = useState(false)
  const [substitutoId, setSubstitutoId] = useState('')
  const [motivo, setMotivo] = useState<MotivoExtra>('Falta sem justificativa')
  const [categoriaValorId, setCategoriaValorId] = useState<string>('acordado')
  const [valorInput, setValorInput] = useState('')
  const [extraFaturado, setExtraFaturado] = useState(false)
  const [meioComunicacao, setMeioComunicacao] = useState<ComunicacaoTipo>('Não se aplica')
  const [comunicacaoData, setComunicacaoData] = useState('')
  const [comunicacaoHora, setComunicacaoHora] = useState('')
  const [comunicacaoDetalhes, setComunicacaoDetalhes] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    listarCategorias()
    listarColaboradores()
    listarDepartamentos()
  }, [listarCategorias, listarColaboradores, listarDepartamentos])

  const departamentosAtivos = useMemo(() => {
    const vistos = new Set<string>()
    return departamentos
      .filter(d => d.status === 'Ativo' && d.nome_curto && d.nome_curto.trim() !== '')
      .sort((a, b) => a.nome_curto.localeCompare(b.nome_curto))
      .filter(d => {
        const chave = d.nome_curto.toLowerCase().trim()
        if (vistos.has(chave)) return false
        vistos.add(chave)
        return true
      })
  }, [departamentos])

  const colaboradoresAtivos = useMemo(() => {
    return colaboradores
      .filter(c => c.status === 'Ativo')
      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
  }, [colaboradores])

  const colaboradoresDoDept = useMemo(() => {
    if (!departamentoId) return colaboradoresAtivos
    const dept = departamentosAtivos.find(d => d.id === departamentoId)
    if (!dept) return colaboradoresAtivos
    return colaboradoresAtivos.filter(c =>
      c.departamento_id === departamentoId ||
      (c.departamento && dept.nome_curto && c.departamento.toLowerCase().includes(dept.nome_curto.toLowerCase()))
    )
  }, [colaboradoresAtivos, departamentosAtivos, departamentoId])

  const getColaborador = (id: string) => colaboradoresAtivos.find(c => c.id === id)
  const getDepartamento = (id: string) => departamentosAtivos.find(d => d.id === id)
  const getCategoriaValor = (id: string) => categorias.find(c => c.id === id)

  const handleCategoriaValorChange = (id: string) => {
    setCategoriaValorId(id)
    const cat = getCategoriaValor(id)
    if (cat?.valor_padrao) {
      setValorInput(mascaraMoeda(cat.valor_padrao))
    }
  }

  const limpar = () => {
    setPasso(1)
    setData(new Date().toISOString().split('T')[0])
    setTurno('Dia')
    setCategoria('Operacional')
    setDepartamentoId('')
    setAusenteId('')
    setAusenteNaoAplica(false)
    setSubstitutoId('')
    setMotivo('Falta sem justificativa')
    setCategoriaValorId('acordado')
    setValorInput('')
    setExtraFaturado(false)
    setMeioComunicacao('Não se aplica')
    setComunicacaoData('')
    setComunicacaoHora('')
    setComunicacaoDetalhes('')
    setObservacoes('')
    setSucesso(false)
  }

  const validarPasso = () => {
    if (passo === 1) {
      if (!departamentoId) return 'Selecione o departamento'
      if (!data) return 'Informe a data'
    }
    if (passo === 2) {
      if (!ausenteNaoAplica && !ausenteId) return 'Selecione quem faltou ou marque "Não se aplica"'
      if (!substitutoId) return 'Selecione o substituto'
    }
    if (passo === 3) {
      if (!valorInput || parseMoeda(valorInput) <= 0) return 'Informe o valor a pagar'
    }
    return null
  }

  const avancar = () => {
    const erro = validarPasso()
    if (erro) {
      toast.error(erro)
      return
    }
    setPasso(p => Math.min(p + 1, 5))
  }

  const voltar = () => {
    setPasso(p => Math.max(p - 1, 1))
  }

  const handleSubmit = async () => {
    const erro = validarPasso()
    if (erro) {
      toast.error(erro)
      return
    }

    const dept = getDepartamento(departamentoId)
    const ausente = ausenteNaoAplica ? undefined : getColaborador(ausenteId)
    const substituto = getColaborador(substitutoId)
    const catValor = getCategoriaValor(categoriaValorId)

    const payload: Omit<Extra, 'id' | 'created_at' | 'updated_at'> = {
      data_ocorrencia: data,
      turno,
      categoria,
      posto: dept?.nome_curto || dept?.nome || '',
      departamento_id: dept?.id || null,
      departamento_nome: dept ? nomeDepartamento(dept) : null,
      colaborador_ausente_id: ausente?.id || null,
      colaborador_ausente_nome: ausente?.nome_completo || null,
      substituto_id: substituto?.id || null,
      substituto_nome: substituto?.nome_completo || null,
      motivo,
      extra_faturado: extraFaturado,
      valor: parseMoeda(valorInput),
      categoria_valor_id: catValor?.id || null,
      categoria_valor_nome: catValor?.nome || null,
      comunicacao_tipo: meioComunicacao,
      comunicacao_data: comunicacaoData || null,
      comunicacao_hora: comunicacaoHora || null,
      comunicacao_detalhes: comunicacaoDetalhes || null,
      observacoes: observacoes || null,
      status: 'Pendente',
      usuario_id: user?.id || null,
      empresa_id: null,
    }

    setSalvando(true)
    const sucesso = await criar(payload)
    setSalvando(false)

    if (sucesso) {
      setSucesso(true)
      toast.success('Registro salvo')
    }
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Registro salvo!</h2>
            <p className="text-sm text-slate-500 mt-1">A falta foi registrada com sucesso.</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={limpar}
              className="w-full h-12 rounded-xl bg-slate-800 text-white font-medium text-base"
            >
              Novo registro
            </button>
            <button
              onClick={() => navigate('/extras/lancamentos')}
              className="w-full h-12 rounded-xl bg-white border border-slate-300 text-slate-700 font-medium text-base"
            >
              Ver lançamentos
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderPasso = () => {
    switch (passo) {
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data da ocorrência</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Turno</label>
              <select
                value={turno}
                onChange={e => setTurno(e.target.value as TurnoExtra)}
                className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
              >
                {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value as CategoriaOcorrencia)}
                className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
              >
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
              <select
                value={departamentoId}
                onChange={e => {
                  setDepartamentoId(e.target.value)
                  setAusenteId('')
                  setSubstitutoId('')
                }}
                className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
                required
              >
                <option value="">Selecione...</option>
                {departamentosAtivos.map(d => (
                  <option key={d.id} value={d.id}>{d.nome_curto || d.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
              <select
                value={motivo}
                onChange={e => setMotivo(e.target.value as MotivoExtra)}
                className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
              >
                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Colaborador ausente</label>
              <select
                value={ausenteNaoAplica ? '' : ausenteId}
                onChange={e => {
                  const val = e.target.value
                  if (val === '__nao_aplica__') {
                    setAusenteNaoAplica(true)
                    setAusenteId('')
                  } else {
                    setAusenteNaoAplica(false)
                    setAusenteId(val)
                  }
                }}
                className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
              >
                <option value="__nao_aplica__">Não se aplica</option>
                {colaboradoresDoDept.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_completo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Substituto</label>
              <select
                value={substitutoId}
                onChange={e => setSubstitutoId(e.target.value)}
                className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
                required
              >
                <option value="">Selecione...</option>
                {colaboradoresAtivos.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_completo}</option>
                ))}
              </select>
            </div>
          </div>
        )
      case 3:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoria de valor</label>
              <select
                value={categoriaValorId}
                onChange={e => handleCategoriaValorChange(e.target.value)}
                className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
              >
                <option value="acordado">Valor acordado</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor a pagar (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={valorInput}
                onChange={e => setValorInput(mascaraMoedaInput(e.target.value))}
                placeholder="R$ 0,00"
                className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800"
                required
              />
            </div>
            <label className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={extraFaturado}
                onChange={e => setExtraFaturado(e.target.checked)}
                className="w-6 h-6 rounded border-slate-300"
              />
              <span className="text-base font-medium text-slate-700">Extra faturado</span>
            </label>
          </div>
        )
      case 4:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Meio de comunicação</label>
              <select
                value={meioComunicacao}
                onChange={e => setMeioComunicacao(e.target.value as ComunicacaoTipo)}
                className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
              >
                {MEIOS_COMUNICACAO.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                <input
                  type="date"
                  value={comunicacaoData}
                  onChange={e => setComunicacaoData(e.target.value)}
                  className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
                <input
                  type="time"
                  value={comunicacaoHora}
                  onChange={e => setComunicacaoHora(e.target.value)}
                  className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Detalhes</label>
              <input
                type="text"
                value={comunicacaoDetalhes}
                onChange={e => setComunicacaoDetalhes(e.target.value)}
                placeholder="Ex: WhatsApp às 7h15"
                className="w-full h-12 px-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
              <textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Informações adicionais"
                rows={3}
                className="w-full p-3 rounded-lg border border-slate-300 text-base focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>
          </div>
        )
      case 5:
        return (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <p><span className="font-medium text-slate-600">Data:</span> {data}</p>
              <p><span className="font-medium text-slate-600">Turno:</span> {turno}</p>
              <p><span className="font-medium text-slate-600">Categoria:</span> {categoria}</p>
              <p><span className="font-medium text-slate-600">Departamento:</span> {getDepartamento(departamentoId)?.nome_curto || '—'}</p>
              <p><span className="font-medium text-slate-600">Motivo:</span> {motivo}</p>
              <hr className="border-slate-200" />
              <p><span className="font-medium text-slate-600">Ausente:</span> {ausenteNaoAplica ? 'Não se aplica' : (getColaborador(ausenteId)?.nome_completo || '—')}</p>
              <p><span className="font-medium text-slate-600">Substituto:</span> {getColaborador(substitutoId)?.nome_completo || '—'}</p>
              <hr className="border-slate-200" />
              <p><span className="font-medium text-slate-600">Valor:</span> {mascaraMoeda(parseMoeda(valorInput))}</p>
              <p><span className="font-medium text-slate-600">Faturado:</span> {extraFaturado ? 'Sim' : 'Não'}</p>
              <hr className="border-slate-200" />
              <p><span className="font-medium text-slate-600">Comunicação:</span> {meioComunicacao}</p>
              {comunicacaoDetalhes && <p><span className="font-medium text-slate-600">Detalhes:</span> {comunicacaoDetalhes}</p>}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Nova falta</h1>
          <p className="text-xs text-slate-500">Passo {passo} de 5</p>
        </div>
        <button
          onClick={() => navigate('/extras/lancamentos')}
          className="p-2 rounded-lg hover:bg-slate-100"
          aria-label="Voltar"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="flex-1 p-4 max-w-md mx-auto w-full">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            {PASSOS.map(p => (
              <div
                key={p.num}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  p.num === passo
                    ? 'bg-slate-800 text-white'
                    : p.num < passo
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {p.num < passo ? <Check className="w-4 h-4" /> : p.num}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h2 className="text-base font-semibold text-slate-800">{PASSOS[passo - 1].titulo}</h2>
            <p className="text-xs text-slate-500">{PASSOS[passo - 1].descricao}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          {renderPasso()}
        </div>
      </div>

      <div className="bg-white border-t border-slate-200 p-4 sticky bottom-0">
        <div className="max-w-md mx-auto flex gap-3">
          {passo > 1 && (
            <button
              type="button"
              onClick={voltar}
              className="h-14 px-4 rounded-xl bg-white border border-slate-300 text-slate-700 font-medium text-base flex items-center"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Voltar
            </button>
          )}
          {passo < 5 ? (
            <button
              type="button"
              onClick={avancar}
              className="flex-1 h-14 rounded-xl bg-slate-800 text-white font-semibold text-lg flex items-center justify-center"
            >
              Próximo
              <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={salvando}
              className="flex-1 h-14 rounded-xl bg-green-600 text-white font-semibold text-lg flex items-center justify-center disabled:opacity-60"
            >
              <Save className="w-5 h-5 mr-2" />
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
