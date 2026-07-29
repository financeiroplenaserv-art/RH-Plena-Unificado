import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { EntregaCEU } from '@/types/database'
import type { EntregaComSnapshot } from './relatorios.utils'

export type StatusFiltroRelatorio = 'todos' | 'em_aberto' | 'devolvido'

export function useFiltrosRelatorio(dadosEntregas: EntregaCEU[]) {
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroColaborador, setFiltroColaborador] = useState('todos')
  const [filtroItem, setFiltroItem] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroDepartamento, setFiltroDepartamento] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltroRelatorio>('todos')

  const [inputDataInicio, setInputDataInicio] = useState('')
  const [inputDataFim, setInputDataFim] = useState('')
  const [inputColaborador, setInputColaborador] = useState('todos')
  const [inputItem, setInputItem] = useState('todos')
  const [inputTipo, setInputTipo] = useState('todos')
  const [inputDepartamento, setInputDepartamento] = useState('')
  const [inputStatus, setInputStatus] = useState<StatusFiltroRelatorio>('todos')

  const [colabIdsDepartamento, setColabIdsDepartamento] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function resolverColaboradores() {
      if (!filtroDepartamento || filtroDepartamento === 'todos') {
        setColabIdsDepartamento(new Set())
        return
      }
      const nomeCurto = filtroDepartamento.trim()
      const { data: deptData } = await supabase
        .from('departamentos')
        .select('id, nome, nome_curto')
        .or(`nome_curto.ilike.%${nomeCurto}%,nome.ilike.%${nomeCurto}%`)

      let queryColab = supabase.from('colaboradores').select('id')
      if (deptData && deptData.length > 0) {
        const ids = new Set<string>()
        const filtrosDepto: string[] = []
        deptData.forEach((dept) => {
          ids.add(dept.id)
          if (dept.nome) filtrosDepto.push(`departamento.ilike.%${dept.nome}%`)
          if (dept.nome_curto && dept.nome_curto !== dept.nome) {
            filtrosDepto.push(`departamento.ilike.%${dept.nome_curto}%`)
          }
        })
        filtrosDepto.unshift(`departamento_id.in.(${Array.from(ids).join(',')})`)
        queryColab = queryColab.or(filtrosDepto.join(','))
      } else {
        queryColab = queryColab.ilike('departamento', `%${nomeCurto}%`)
      }
      const { data } = await queryColab
      const ids = new Set((data || []).map((c) => c.id))
      setColabIdsDepartamento(ids)
    }
    resolverColaboradores()
  }, [filtroDepartamento])

  const entregasFiltradas = useMemo(() => {
    return dadosEntregas.filter((e: EntregaComSnapshot) => {
      if (filtroColaborador && filtroColaborador !== 'todos' && e.colaborador_id !== filtroColaborador) return false

      const tipo = e.item?.tipo || e.snapshot_item?.tipo
      if (filtroTipo && filtroTipo !== 'todos' && tipo !== filtroTipo) return false

      if (filtroItem && filtroItem !== 'todos') {
        const itemId = e.item_id
        const itemNome = e.item?.nome || e.snapshot_item?.nome || ''
        if (itemId !== filtroItem && !itemNome.toLowerCase().includes(filtroItem.toLowerCase())) return false
      }

      if (filtroDepartamento && filtroDepartamento !== 'todos') {
        if (!colabIdsDepartamento.has(e.colaborador_id)) return false
      }

      if (filtroStatus === 'em_aberto' && e.data_devolucao) return false
      if (filtroStatus === 'devolvido' && !e.data_devolucao) return false

      if (filtroDataInicio && e.data_entrega < filtroDataInicio) return false
      if (filtroDataFim && e.data_entrega > filtroDataFim) return false

      return true
    })
  }, [dadosEntregas, filtroColaborador, filtroTipo, filtroItem, filtroDepartamento, filtroStatus, filtroDataInicio, filtroDataFim, colabIdsDepartamento])

  const aplicarFiltros = () => {
    setFiltroDataInicio(inputDataInicio)
    setFiltroDataFim(inputDataFim)
    setFiltroColaborador(inputColaborador)
    setFiltroItem(inputItem)
    setFiltroTipo(inputTipo)
    setFiltroDepartamento(inputDepartamento.trim() || 'todos')
    setFiltroStatus(inputStatus)
  }

  const limparFiltros = () => {
    setInputDataInicio('')
    setInputDataFim('')
    setInputColaborador('todos')
    setInputItem('todos')
    setInputTipo('todos')
    setInputDepartamento('todos')
    setInputStatus('todos')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroColaborador('todos')
    setFiltroItem('todos')
    setFiltroTipo('todos')
    setFiltroDepartamento('todos')
    setFiltroStatus('todos')
  }

  return {
    entregasFiltradas,
    inputDataInicio,
    inputDataFim,
    inputColaborador,
    inputItem,
    inputTipo,
    inputDepartamento,
    inputStatus,
    setInputDataInicio,
    setInputDataFim,
    setInputColaborador,
    setInputItem,
    setInputTipo,
    setInputDepartamento,
    setInputStatus,
    aplicarFiltros,
    limparFiltros,
  }
}

export type FiltrosRelatorio = ReturnType<typeof useFiltrosRelatorio>
