import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Departamento } from '@/types/database'

const COLUNAS_DEPARTAMENTO_AUTOCOMPLETE = 'id, nome, nome_curto'

interface DepartamentoAutocompleteProps {
  value: string
  onChange: (value: string) => void
  mode?: 'id' | 'nome_curto'
  placeholder?: string
  className?: string
  formatLabel?: (departamento: Departamento) => string
  /** Valor emitido ao limpar a seleção. Filtros usam 'todos'; formulários de cadastro usam ''. */
  clearValue?: string
  /** Rótulo da opção de limpar ("Todos os departamentos" em filtros, "Sem departamento" em cadastros). */
  clearLabel?: string
}

const defaultFormatLabel = (dep: Departamento) => dep.nome_curto || dep.nome

export function DepartamentoAutocomplete({
  value,
  onChange,
  mode = 'id',
  placeholder = 'Buscar departamento...',
  className,
  formatLabel,
  clearValue = 'todos',
  clearLabel = 'Todos os departamentos',
}: DepartamentoAutocompleteProps) {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)

  const renderLabel = formatLabel || defaultFormatLabel

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase
        .from('departamentos')
        .select(COLUNAS_DEPARTAMENTO_AUTOCOMPLETE)
        .eq('status', 'Ativo')
        .not('nome_curto', 'is', null)
        .neq('nome_curto', '')
        .order('nome_curto')
      if (error) {
        console.error('Erro ao carregar departamentos:', error.message)
        return
      }
      setDepartamentos((data || []) as Departamento[])
    }
    carregar()
  }, [])

  const selecionado = useMemo(() => {
    if (value === clearValue || !value) return null
    return departamentos.find((d) => (mode === 'id' ? d.id === value : d.nome_curto === value))
  }, [value, departamentos, mode, clearValue])

  useEffect(() => {
    if (aberto) return
    if (selecionado) {
      setBusca(renderLabel(selecionado))
    } else {
      setBusca('')
    }
  }, [selecionado, aberto, renderLabel])

  const filtrados = useMemo(() => {
    const termo = busca
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
    if (!termo) return departamentos.slice(0, 25)
    return departamentos
      .filter((d) => {
        const curto = (d.nome_curto || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
        const nome = d.nome
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
        return curto.includes(termo) || nome.includes(termo)
      })
      .slice(0, 50)
  }, [busca, departamentos])

  const handleSelecionar = (dep: Departamento) => {
    onChange(mode === 'id' ? dep.id : (dep.nome_curto || dep.nome))
    setAberto(false)
  }

  const handleLimpar = () => {
    onChange(clearValue)
    setBusca('')
    setAberto(false)
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        placeholder={placeholder}
        value={busca}
        onChange={(e) => {
          const novo = e.target.value
          setBusca(novo)
          setAberto(true)
          if (novo.trim() === '' && value !== clearValue) {
            onChange(clearValue)
          }
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 200)}
        autoComplete="off"
      />
      {aberto && filtrados.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-96 overflow-y-auto">
          <button
            type="button"
            onMouseDown={handleLimpar}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-50"
          >
            {clearLabel}
          </button>
          {filtrados.map((d) => (
            <button
              key={d.id}
              type="button"
              onMouseDown={() => handleSelecionar(d)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0"
            >
              {renderLabel(d)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
