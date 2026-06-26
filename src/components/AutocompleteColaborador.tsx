import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import type { Colaborador } from '@/types/database'
import { BadgeStatus } from './BadgeStatus'

interface AutocompleteColaboradorProps {
  value?: string
  onChange: (colaborador: Colaborador | null) => void
  placeholder?: string
  label?: string
  somenteAtivos?: boolean
  departamentoId?: string | null
  permitirNovo?: boolean
}

export function AutocompleteColaborador({
  value,
  onChange,
  placeholder = 'Digite nome ou matrícula...',
  label,
  somenteAtivos = true,
  departamentoId,
  permitirNovo = false,
}: AutocompleteColaboradorProps) {
  const buscaRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<Colaborador | null>(null)
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [carregando, setCarregando] = useState(false)

  const carregarSelecionado = useCallback(async (id: string) => {
    const { data } = await supabase.from('colaboradores').select('*').eq('id', id).single()
    if (data) {
      const c = data as Colaborador
      setSelecionado(c)
      setBusca(c.nome_completo)
      onChange(c)
    }
  }, [onChange])

  useEffect(() => {
    if (value && value !== selecionado?.id) {
      carregarSelecionado(value)
    }
  }, [value, selecionado?.id, carregarSelecionado])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMostrarSugestoes(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const buscarIdsDoGrupo = useCallback(async (id: string): Promise<{ ids: string[]; nomeCurto: string | null; nome: string | null }> => {
    const { data: dept } = await supabase
      .from('departamentos')
      .select('nome_curto, nome')
      .eq('id', id)
      .single()

    const nomeCurto = dept?.nome_curto || null
    const nome = dept?.nome || null
    const ids = new Set<string>([id])

    if (nomeCurto) {
      const { data: depts } = await supabase
        .from('departamentos')
        .select('id')
        .eq('nome_curto', nomeCurto)
        .eq('status', 'Ativo')
      depts?.forEach((d) => ids.add(d.id))
    }

    return { ids: Array.from(ids), nomeCurto, nome }
  }, [])

  const buscarSugestoes = useCallback(async (termo: string) => {
    if (!termo || termo.length < 2) {
      setColaboradores([])
      setMostrarSugestoes(false)
      return
    }
    setCarregando(true)
    let query = supabase
      .from('colaboradores')
      .select('*')
      .or(`nome_completo.ilike.%${termo}%,matricula.ilike.%${termo}%`)
    if (somenteAtivos) {
      query = query.eq('status', 'Ativo')
    }
    const { data } = await query.limit(50)
    let resultados = (data as Colaborador[]) || []
    if (departamentoId) {
      const grupo = await buscarIdsDoGrupo(departamentoId)
      resultados = resultados.sort((a, b) => {
        const aDoDept = grupo.ids.includes(a.departamento_id || '') ? -1 : 1
        const bDoDept = grupo.ids.includes(b.departamento_id || '') ? -1 : 1
        if (aDoDept !== bDoDept) return aDoDept - bDoDept
        return a.nome_completo.localeCompare(b.nome_completo)
      })
    }
    setColaboradores(resultados.slice(0, 10))
    setMostrarSugestoes(resultados.length > 0)
    setCarregando(false)
  }, [somenteAtivos, departamentoId, buscarIdsDoGrupo])

  const buscarPorDepartamento = useCallback(async () => {
    if (!departamentoId) return
    setCarregando(true)

    const grupo = await buscarIdsDoGrupo(departamentoId)
    const filtros: string[] = [`departamento_id.in.(${grupo.ids.join(',')})`]
    if (grupo.nomeCurto) filtros.push(`departamento.ilike.%${grupo.nomeCurto}%`)
    if (grupo.nome && grupo.nome !== grupo.nomeCurto) filtros.push(`departamento.ilike.%${grupo.nome}%`)

    let query = supabase.from('colaboradores').select('*').or(filtros.join(','))
    if (somenteAtivos) {
      query = query.eq('status', 'Ativo')
    }
    const { data } = await query.order('nome_completo').limit(20)
    const resultados = (data as Colaborador[]) || []
    setColaboradores(resultados.slice(0, 10))
    setMostrarSugestoes(resultados.length > 0)
    setCarregando(false)
  }, [departamentoId, somenteAtivos, buscarIdsDoGrupo])

  const handleBuscaChange = (val: string) => {
    setBusca(val)
    if (selecionado) {
      setSelecionado(null)
      onChange(null)
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => buscarSugestoes(val), 300)
  }

  const handleSelecionar = (colab: Colaborador) => {
    setSelecionado(colab)
    setBusca(colab.nome_completo)
    setMostrarSugestoes(false)
    onChange(colab)
  }

  const handleSelecionarNovo = (nome: string) => {
    const colab: Colaborador = {
      id: '',
      matricula: '',
      nome_completo: nome.trim(),
      cpf: null,
      rg: null,
      ctps: null,
      pis_pasep: null,
      data_admissao: null,
      data_demissao: null,
      data_nascimento: null,
      cargo: null,
      departamento: null,
      departamento_id: null,
      email: null,
      telefone: null,
      celular: null,
      cidade: null,
      estado: null,
      cep: null,
      endereco: null,
      status: 'Ativo',
      tipo_contrato: null,
      empresa_id: null,
      afastamento_motivo: null,
      afastamento_data_inicio: null,
      afastamento_data_fim: null,
      dados_completos: {},
    }
    setSelecionado(colab)
    setBusca(colab.nome_completo)
    setMostrarSugestoes(false)
    onChange(colab)
  }

  const handleLimpar = () => {
    setSelecionado(null)
    setBusca('')
    setMostrarSugestoes(false)
    setColaboradores([])
    onChange(null)
    setTimeout(() => buscaRef.current?.focus(), 50)
  }

  return (
    <div ref={containerRef} className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}

      {selecionado ? (
        <div className="p-3 bg-blue-50 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800 break-words">{selecionado.nome_completo}</p>
            <p className="text-xs text-slate-500">
              Matrícula: {selecionado.matricula} | {selecionado.cargo || '—'}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleLimpar} className="text-xs h-7 gap-1">
            <X className="h-3 w-3" /> Trocar
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            ref={buscaRef}
            placeholder={placeholder}
            value={busca}
            onChange={(e) => handleBuscaChange(e.target.value)}
            onFocus={() => {
              if (colaboradores.length > 0) {
                setMostrarSugestoes(true)
              } else if (departamentoId) {
                buscarPorDepartamento()
              }
            }}
            onBlur={(e) => {
              const relatedTarget = e.relatedTarget as Node | null
              const focoFoiParaDentro = relatedTarget && containerRef.current?.contains(relatedTarget)
              if (permitirNovo && !selecionado && busca.trim() && !focoFoiParaDentro) {
                handleSelecionarNovo(busca.trim())
              }
            }}
            className="text-sm pl-9"
            autoComplete="off"
          />

          {mostrarSugestoes && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {carregando ? (
                <div className="p-3 text-center text-xs text-slate-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400 mx-auto"></div>
                </div>
              ) : colaboradores.length === 0 ? (
                permitirNovo && busca.trim() ? (
                  <div
                    className="p-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                    onClick={() => handleSelecionarNovo(busca.trim())}
                  >
                    <p className="text-sm font-medium text-slate-700">+ Usar &quot;{busca.trim()}&quot;</p>
                    <p className="text-xs text-slate-500">Colaborador não cadastrado</p>
                  </div>
                ) : (
                  <div className="p-3 text-xs text-slate-400 text-center">Nenhum colaborador encontrado</div>
                )
              ) : (
                colaboradores.map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-0"
                    onClick={() => handleSelecionar(c)}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700 break-words">{c.nome_completo}</p>
                      <p className="text-xs text-slate-500">
                        {c.matricula} — {c.cargo || '—'} — {c.departamento || '—'}
                        {departamentoId && c.departamento_id === departamentoId && (
                          <span className="ml-1 text-green-600 font-medium">(deste dept.)</span>
                        )}
                      </p>
                    </div>
                    <BadgeStatus status={c.status} />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
