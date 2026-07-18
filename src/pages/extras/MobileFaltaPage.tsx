import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, X, ChevronLeft, ChevronRight, Check, House } from 'lucide-react'
import { toast } from 'sonner'
import { useExtras } from '@/hooks/useExtras'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useDepartamentos } from '@/hooks/useDepartamentos'
import { useAuth } from '@/hooks/useAuth'
import { mascaraMoeda, mascaraMoedaInput, parseMoeda, nomeDepartamento, formatarData } from '@/lib/utils'
import type { Extra, TurnoExtra, MotivoExtra, ComunicacaoTipo } from '@/types/extras'

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
const MEIOS_COMUNICACAO: ComunicacaoTipo[] = ['WhatsApp', 'Email', 'Não se aplica']

const PASSOS = [
  { num: 1, titulo: 'Ocorrência', descricao: 'Data, turno, departamento e motivo' },
  { num: 2, titulo: 'Pessoas', descricao: 'Quem faltou e quem substituiu' },
  { num: 3, titulo: 'Valor', descricao: 'Valor a pagar e tipo de extra' },
  { num: 4, titulo: 'Comunicação', descricao: 'Cliente foi comunicado?' },
  { num: 5, titulo: 'Revisar', descricao: 'Confira e salve o registro' },
]

interface OpcaoProps {
  label: string
  selecionado: boolean
  onClick: () => void
}

function BotaoOpcao({ label, selecionado, onClick }: OpcaoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[2.75rem] sm:min-h-[3.25rem] w-full rounded-xl border px-3 py-2 text-sm sm:text-base font-medium leading-tight transition-colors ${
        selecionado
          ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )
}

function ErroCampo({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null
  return <p className="text-sm text-red-600 mt-1.5 font-medium">{mensagem}</p>
}

interface BuscaColaboradorProps {
  label: string
  valor: string
  opcoes: { id: string; nome_completo: string; matricula?: string | null; departamento?: string | null }[]
  opcoesDestaque?: { id: string; nome_completo: string; matricula?: string | null; departamento?: string | null }[]
  placeholder: string
  naoAplica?: boolean
  onChange: (valor: string) => void
  erro?: string
  desabilitado?: boolean
}

function BuscaColaborador({
  label,
  valor,
  opcoes,
  opcoesDestaque,
  placeholder,
  naoAplica = false,
  onChange,
  erro,
  desabilitado = false,
}: BuscaColaboradorProps) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')

  const selecionado = useMemo(() => opcoes.find(c => c.id === valor), [opcoes, valor])

  const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

  const filtradas = useMemo(() => {
    const t = normalizar(termo)
    if (!t) return opcoes
    return opcoes.filter(c => {
      const nome = normalizar(c.nome_completo)
      const mat = (c.matricula || '').toLowerCase()
      return nome.includes(t) || mat.includes(t)
    })
  }, [opcoes, termo])

  const temDestaque = (opcoesDestaque || []).length > 0

  const destacadas = useMemo(() => {
    if (termo.trim()) return []
    return opcoesDestaque || []
  }, [opcoesDestaque, termo])

  const outras = useMemo(() => {
    if (termo.trim()) return filtradas
    // Se não há destaque configurado, mostra todas as opções ao abrir (ex: substituto)
    if (!temDestaque) return opcoes
    return []
  }, [opcoes, filtradas, termo, temDestaque])

  useEffect(() => {
    if (!aberto) setTermo('')
  }, [aberto])

  const exibirTexto = () => {
    if (naoAplica && valor === '__nao_aplica__') return 'Não se aplica'
    return selecionado?.nome_completo || ''
  }

  const renderItem = (c: { id: string; nome_completo: string; matricula?: string | null; departamento?: string | null }) => (
    <button
      key={c.id}
      type="button"
      onMouseDown={() => {
        onChange(c.id)
        setAberto(false)
      }}
      className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 last:border-0 ${
        valor === c.id ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
      }`}
    >
      <span className="block">{c.nome_completo}</span>
      {(c.matricula || c.departamento) && (
        <span className="block text-xs text-slate-500">
          {[c.matricula, c.departamento].filter(Boolean).join(' — ')}
        </span>
      )}
    </button>
  )

  return (
    <div>
      <label className="block text-base font-semibold text-slate-800 mb-2">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={aberto ? termo : exibirTexto()}
          onChange={e => {
            setTermo(e.target.value)
            if (!aberto) setAberto(true)
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 200)}
          placeholder={aberto ? 'Digite para buscar em todos...' : placeholder}
          disabled={desabilitado}
          className={`w-full h-12 sm:h-14 px-3 sm:px-4 rounded-xl border text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white ${
            erro ? 'border-red-400 bg-red-50' : 'border-slate-300'
          }`}
        />
        {aberto && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-auto">
            {naoAplica && (
              <button
                type="button"
                onMouseDown={() => {
                  onChange('__nao_aplica__')
                  setAberto(false)
                }}
                className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 last:border-0 ${
                  valor === '__nao_aplica__' ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                }`}
              >
                Não se aplica
              </button>
            )}

            {destacadas.length > 0 && (
              <>
                <div className="px-4 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 uppercase tracking-wide">Deste departamento</div>
                {destacadas.map(renderItem)}
              </>
            )}

            {outras.length > 0 && (
              <>
                {termo.trim() && filtradas.length > 0 && (
                  <div className="px-4 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 uppercase tracking-wide">Resultados da busca</div>
                )}
                {outras.map(renderItem)}
              </>
            )}

            {!termo.trim() && temDestaque && destacadas.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-500">
                Nenhum colaborador deste departamento.<br />
                <span className="text-xs">Digite o nome para buscar em todos.</span>
              </div>
            )}

            {termo.trim() && filtradas.length === 0 && (
              <div className="px-4 py-3 text-sm text-slate-500">Nenhum colaborador encontrado.</div>
            )}
          </div>
        )}
      </div>
      <ErroCampo mensagem={erro} />
    </div>
  )
}

export function MobileFaltaPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { categorias, listarCategorias, criar, verificarDuplicado, loading: loadingExtras } = useExtras()
  const { colaboradores, listar: listarColaboradores, loading: loadingColaboradores } = useColaboradores()
  const { departamentos, listar: listarDepartamentos, loading: loadingDepartamentos } = useDepartamentos()

  const [passo, setPasso] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})

  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])
  const [turno, setTurno] = useState<TurnoExtra>('Dia')
  const [departamentoId, setDepartamentoId] = useState('')
  const [motivo, setMotivo] = useState<MotivoExtra>('Falta sem justificativa')
  const [ausenteId, setAusenteId] = useState('')
  const [ausenteNaoAplica, setAusenteNaoAplica] = useState(false)
  const [substitutoId, setSubstitutoId] = useState('')
  const [categoriaValorId, setCategoriaValorId] = useState<string>('acordado')
  const [valorInput, setValorInput] = useState('')
  const [extraFaturado, setExtraFaturado] = useState(false)
  const [meioComunicacao, setMeioComunicacao] = useState<ComunicacaoTipo>('Não se aplica')
  const [comunicacaoData, setComunicacaoData] = useState('')
  const [comunicacaoHora, setComunicacaoHora] = useState('')
  const [comunicacaoDetalhes, setComunicacaoDetalhes] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const carregando = loadingExtras || loadingColaboradores || loadingDepartamentos

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

  const normalizarBusca = useCallback((s: string) => {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  }, [])

  const colaboradoresDoDept = useMemo(() => {
    if (!departamentoId) return colaboradoresAtivos
    const dept = departamentosAtivos.find(d => d.id === departamentoId)
    if (!dept) return colaboradoresAtivos
    const deptNome = normalizarBusca(dept.nome_curto || '')
    return colaboradoresAtivos.filter(c => {
      if (c.departamento_id === departamentoId) return true
      const colabDept = c.departamento ? normalizarBusca(c.departamento) : ''
      return colabDept && (colabDept.includes(deptNome) || deptNome.includes(colabDept))
    })
  }, [colaboradoresAtivos, departamentosAtivos, departamentoId, normalizarBusca])

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
    setDepartamentoId('')
    setMotivo('Falta sem justificativa')
    setAusenteId('')
    setAusenteNaoAplica(false)
    setSubstitutoId('')
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

  const validarPasso = (p = passo) => {
    const novosErros: Record<string, string> = {}
    if (p === 1) {
      if (!data) novosErros.data = 'Informe a data'
      if (!departamentoId) novosErros.departamento = 'Selecione o departamento'
      if (!motivo) novosErros.motivo = 'Selecione o motivo'
    }
    if (p === 2) {
      if (!ausenteNaoAplica && !ausenteId) novosErros.ausente = 'Selecione quem faltou ou marque "Não se aplica"'
      if (!substitutoId) novosErros.substituto = 'Selecione o substituto'
    }
    if (p === 3) {
      if (!valorInput || parseMoeda(valorInput) <= 0) novosErros.valor = 'Informe o valor a pagar'
    }
    return novosErros
  }

  const avancar = () => {
    const novosErros = validarPasso()
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) {
      toast.error('Preencha os campos obrigatórios')
      return
    }
    setPasso(p => Math.min(p + 1, PASSOS.length))
  }

  const irParaPasso = (p: number) => {
    if (p < 1 || p > PASSOS.length || p === passo) return
    // Só permite voltar para passos já visitados
    if (p > passo) {
      const novosErros = validarPasso()
      setErros(novosErros)
      if (Object.keys(novosErros).length > 0) {
        toast.error('Preencha os campos obrigatórios')
        return
      }
    }
    setPasso(p)
    setErros({})
  }

  const voltar = () => {
    setPasso(p => Math.max(p - 1, 1))
  }

  const handleSubmit = async () => {
    const novosErros = validarPasso()
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) {
      toast.error('Preencha os campos obrigatórios')
      return
    }

    const dept = getDepartamento(departamentoId)
    const ausente = ausenteNaoAplica ? undefined : getColaborador(ausenteId)
    const substituto = getColaborador(substitutoId)
    const catValor = getCategoriaValor(categoriaValorId)

    const payload: Omit<Extra, 'id' | 'created_at' | 'updated_at'> = {
      data_ocorrencia: data,
      turno,
      categoria: 'Operacional',
      posto: dept?.nome_curto || dept?.nome || '',
      departamento_id: dept?.id || null,
      departamento_nome: dept ? nomeDepartamento(dept) : null,
      // Quando ausenteNaoAplica=true, o registro representa um reforço extra/faturado:
      // há um substituto trabalhando no posto, mas não está cobrindo falta de ninguém.
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

    const duplicado = await verificarDuplicado(
      payload.data_ocorrencia,
      payload.departamento_id,
      payload.colaborador_ausente_id,
      payload.colaborador_ausente_nome
    )

    if (duplicado) {
      setSalvando(false)
      toast.error(
        `Já existe um extra lançado para ${payload.colaborador_ausente_nome || 'este colaborador'} no departamento ${payload.departamento_nome || ''} em ${formatarData(payload.data_ocorrencia)}. Verifique os lançamentos.`,
        { duration: 6000 }
      )
      return
    }

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
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Registro salvo!</h2>
            <p className="text-base text-slate-500 mt-2">A falta foi registrada com sucesso.</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={limpar}
              className="w-full h-12 sm:h-14 rounded-xl bg-slate-800 text-white font-semibold text-base sm:text-lg"
            >
              Novo registro
            </button>
            <button
              onClick={() => navigate('/extras/lancamentos')}
              className="w-full h-12 sm:h-14 rounded-xl bg-white border border-slate-300 text-slate-700 font-medium text-base sm:text-lg"
            >
              Ver lançamentos
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full h-14 rounded-xl bg-slate-100 text-slate-700 font-medium text-base sm:text-lg flex items-center justify-center"
            >
              <House className="w-5 h-5 mr-2" />
              Voltar ao início
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
          <div className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-slate-800 mb-2">Data da ocorrência</label>
              <input
                type="date"
                value={data}
                onChange={e => {
                  setData(e.target.value)
                  if (erros.data) setErros(prev => ({ ...prev, data: '' }))
                }}
                className={`w-full h-12 sm:h-14 px-3 sm:px-4 rounded-xl border text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-slate-800 ${erros.data ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                required
              />
              <ErroCampo mensagem={erros.data} />
            </div>

            <div>
              <label className="block text-base font-semibold text-slate-800 mb-2">Turno</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TURNOS.map(t => (
                  <BotaoOpcao
                    key={t}
                    label={t}
                    selecionado={turno === t}
                    onClick={() => setTurno(t)}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold text-slate-800 mb-2">Departamento</label>
              <select
                value={departamentoId}
                onChange={e => {
                  setDepartamentoId(e.target.value)
                  setAusenteId('')
                  setSubstitutoId('')
                  if (erros.departamento) setErros(prev => ({ ...prev, departamento: '' }))
                }}
                className={`w-full h-12 sm:h-14 px-3 sm:px-4 rounded-xl border text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white ${erros.departamento ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                required
              >
                <option value="">Selecione o posto...</option>
                {departamentosAtivos.map(d => (
                  <option key={d.id} value={d.id}>{d.nome_curto || d.nome}</option>
                ))}
              </select>
              <ErroCampo mensagem={erros.departamento} />
            </div>

            <div>
              <label className="block text-base font-semibold text-slate-800 mb-2">Motivo</label>
              <select
                value={motivo}
                onChange={e => {
                  setMotivo(e.target.value as MotivoExtra)
                  if (erros.motivo) setErros(prev => ({ ...prev, motivo: '' }))
                }}
                className={`w-full h-12 sm:h-14 px-3 sm:px-4 rounded-xl border text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white ${erros.motivo ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
              >
                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ErroCampo mensagem={erros.motivo} />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <BuscaColaborador
                label="Colaborador ausente"
                valor={ausenteNaoAplica ? '__nao_aplica__' : ausenteId}
                opcoes={colaboradoresAtivos}
                opcoesDestaque={colaboradoresDoDept}
                placeholder="Selecione o colaborador ausente..."
                naoAplica
                onChange={val => {
                  if (val === '__nao_aplica__') {
                    setAusenteNaoAplica(true)
                    setAusenteId('')
                  } else {
                    setAusenteNaoAplica(false)
                    setAusenteId(val)
                  }
                  if (erros.ausente) setErros(prev => ({ ...prev, ausente: '' }))
                }}
                erro={erros.ausente}
                desabilitado={carregando}
              />
              {departamentoId && colaboradoresDoDept.length === 0 && !carregando && (
                <p className="text-sm text-amber-600 mt-2">Nenhum colaborador ativo neste departamento.</p>
              )}
            </div>

            <BuscaColaborador
              label="Substituto"
              valor={substitutoId}
              opcoes={colaboradoresAtivos}
              placeholder="Selecione o substituto..."
              onChange={val => {
                setSubstitutoId(val)
                if (erros.substituto) setErros(prev => ({ ...prev, substituto: '' }))
              }}
              erro={erros.substituto}
              desabilitado={carregando}
            />
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-slate-800 mb-2">Categoria de valor</label>
              <select
                value={categoriaValorId}
                onChange={e => handleCategoriaValorChange(e.target.value)}
                className="w-full h-12 sm:h-14 px-3 sm:px-4 rounded-xl border border-slate-300 text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
              >
                <option value="acordado">Valor acordado</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold text-slate-800 mb-2">Valor a pagar (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={valorInput}
                onChange={e => {
                  setValorInput(mascaraMoedaInput(e.target.value))
                  if (erros.valor) setErros(prev => ({ ...prev, valor: '' }))
                }}
                placeholder="R$ 0,00"
                className={`w-full h-12 sm:h-14 px-3 sm:px-4 rounded-xl border text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-slate-800 ${erros.valor ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                required
              />
              <ErroCampo mensagem={erros.valor} />
            </div>

            <div>
              <label className="block text-base font-semibold text-slate-800 mb-2">Tipo</label>
              <div className="grid grid-cols-2 gap-3">
                <BotaoOpcao
                  label="Extra normal"
                  selecionado={!extraFaturado}
                  onClick={() => setExtraFaturado(false)}
                />
                <BotaoOpcao
                  label="Extra faturado"
                  selecionado={extraFaturado}
                  onClick={() => setExtraFaturado(true)}
                />
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-base font-semibold text-slate-800 mb-2">Meio de comunicação</label>
              <div className="grid grid-cols-3 gap-2">
                {MEIOS_COMUNICACAO.map(c => (
                  <BotaoOpcao
                    key={c}
                    label={c}
                    selecionado={meioComunicacao === c}
                    onClick={() => setMeioComunicacao(c)}
                  />
                ))}
              </div>
            </div>

            {meioComunicacao !== 'Não se aplica' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-base font-semibold text-slate-800 mb-2">Data</label>
                  <input
                    type="date"
                    value={comunicacaoData}
                    onChange={e => setComunicacaoData(e.target.value)}
                    className="w-full h-12 sm:h-14 px-3 rounded-xl border border-slate-300 text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-slate-800 mb-2">Hora</label>
                  <input
                    type="time"
                    value={comunicacaoHora}
                    onChange={e => setComunicacaoHora(e.target.value)}
                    className="w-full h-12 sm:h-14 px-3 rounded-xl border border-slate-300 text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
              </div>
            )}

            {meioComunicacao !== 'Não se aplica' && (
              <div>
                <label className="block text-base font-semibold text-slate-800 mb-2">Detalhes</label>
                <input
                  type="text"
                  value={comunicacaoDetalhes}
                  onChange={e => setComunicacaoDetalhes(e.target.value)}
                  placeholder="Ex: WhatsApp às 7h15"
                  className="w-full h-12 sm:h-14 px-3 sm:px-4 rounded-xl border border-slate-300 text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
            )}

            <div>
              <label className="block text-base font-semibold text-slate-800 mb-2">Observações</label>
              <textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Informações adicionais"
                rows={3}
                className="w-full p-3 sm:p-4 rounded-xl border border-slate-300 text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-5 space-y-3 text-base">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm text-slate-500 block">Data</span>
                  <span className="font-medium text-slate-800">{data}</span>
                </div>
                <div>
                  <span className="text-sm text-slate-500 block">Turno</span>
                  <span className="font-medium text-slate-800">{turno}</span>
                </div>
              </div>
              <div>
                <span className="text-sm text-slate-500 block">Departamento</span>
                <span className="font-medium text-slate-800 break-words">{getDepartamento(departamentoId)?.nome_curto || '—'}</span>
              </div>
              <div>
                <span className="text-sm text-slate-500 block">Motivo</span>
                <span className="font-medium text-slate-800 break-words">{motivo}</span>
              </div>
              <hr className="border-slate-200" />
              <div>
                <span className="text-sm text-slate-500 block">Ausente</span>
                <span className="font-medium text-slate-800 break-words">
                  {ausenteNaoAplica ? 'Não se aplica (reforço extra/faturado)' : (getColaborador(ausenteId)?.nome_completo || '—')}
                </span>
              </div>
              <div>
                <span className="text-sm text-slate-500 block">Substituto</span>
                <span className="font-medium text-slate-800 break-words">{getColaborador(substitutoId)?.nome_completo || '—'}</span>
              </div>
              <hr className="border-slate-200" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm text-slate-500 block">Valor</span>
                  <span className="font-medium text-slate-800">{mascaraMoeda(parseMoeda(valorInput))}</span>
                </div>
                <div>
                  <span className="text-sm text-slate-500 block">Faturado</span>
                  <span className="font-medium text-slate-800">{extraFaturado ? 'Sim' : 'Não'}</span>
                </div>
              </div>
              <hr className="border-slate-200" />
              <div>
                <span className="text-sm text-slate-500 block">Comunicação</span>
                <span className="font-medium text-slate-800 break-words">{meioComunicacao}</span>
              </div>
              {comunicacaoDetalhes && (
                <div>
                  <span className="text-sm text-slate-500 block">Detalhes</span>
                  <span className="font-medium text-slate-800 break-words">{comunicacaoDetalhes}</span>
                </div>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Nova falta</h1>
          <p className="text-sm text-slate-500">Passo {passo} de {PASSOS.length}</p>
        </div>
        <button
          onClick={() => navigate('/extras/lancamentos')}
          className="p-3 rounded-xl hover:bg-slate-100"
          aria-label="Voltar"
        >
          <X className="w-6 h-6 text-slate-600" />
        </button>
      </div>

      <div className="flex-1 p-4 max-w-md mx-auto w-full">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            {PASSOS.map(p => (
              <button
                key={p.num}
                type="button"
                onClick={() => irParaPasso(p.num)}
                disabled={p.num > passo + 1}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  p.num === passo
                    ? 'bg-slate-800 text-white'
                    : p.num < passo
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-200 text-slate-500 disabled:opacity-50'
                }`}
              >
                {p.num < passo ? <Check className="w-5 h-5" /> : p.num}
              </button>
            ))}
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-800">{PASSOS[passo - 1].titulo}</h2>
            <p className="text-sm text-slate-500">{PASSOS[passo - 1].descricao}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm relative">
          {carregando && (
            <div className="absolute inset-0 bg-white rounded-2xl flex flex-col items-center justify-center z-10">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
              <p className="mt-3 text-sm text-slate-600 font-medium">Carregando...</p>
            </div>
          )}
          {renderPasso()}
        </div>
      </div>

      <div className="bg-white border-t border-slate-200 p-4 sticky bottom-0">
        <div className="max-w-md mx-auto flex gap-3">
          {passo > 1 && (
            <button
              type="button"
              onClick={voltar}
              className="h-14 sm:h-16 px-5 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-base sm:text-lg flex items-center"
            >
              <ChevronLeft className="w-6 h-6 mr-1" />
              Voltar
            </button>
          )}
          {passo < PASSOS.length ? (
            <button
              type="button"
              onClick={avancar}
              className="flex-1 h-14 sm:h-16 rounded-xl bg-slate-800 text-white font-bold text-lg sm:text-xl flex items-center justify-center shadow-sm active:bg-slate-900"
            >
              Próximo
              <ChevronRight className="w-6 h-6 ml-1" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={salvando}
              className="flex-1 h-16 rounded-xl bg-green-600 text-white font-bold text-xl flex items-center justify-center disabled:opacity-60 shadow-sm active:bg-green-700"
            >
              <Save className="w-6 h-6 mr-2" />
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
