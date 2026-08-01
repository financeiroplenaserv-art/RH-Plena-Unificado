import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import type { EntregaCEU } from '@/types/database'
import type { EntregaComSnapshot } from './relatorios.utils'

export type StatusFiltroRelatorio = 'todos' | 'em_aberto' | 'devolvido'

export function useFiltrosRelatorio(dadosEntregas: EntregaCEU[]) {
  const [filtroDataInicio, setFiltroDataInicio] = useFiltroPersistente('ceu.relatorios.aplicado.data_inicio', '')
  const [filtroDataFim, setFiltroDataFim] = useFiltroPersistente('ceu.relatorios.aplicado.data_fim', '')
  const [filtroColaborador, setFiltroColaborador] = useFiltroPersistente('ceu.relatorios.aplicado.colaborador', 'todos')
  const [filtroItem, setFiltroItem] = useFiltroPersistente('ceu.relatorios.aplicado.item', 'todos')
  const [filtroTipo, setFiltroTipo] = useFiltroPersistente('ceu.relatorios.aplicado.tipo', 'todos')
  const [filtroDepartamento, setFiltroDepartamento] = useFiltroPersistente('ceu.relatorios.aplicado.departamento', 'todos')
  const [filtroStatus, setFiltroStatus] = useFiltroPersistente<StatusFiltroRelatorio>('ceu.relatorios.aplicado.status', 'todos')

  const [inputDataInicio, setInputDataInicio] = useFiltroPersistente('ceu.relatorios.draft.data_inicio', '')
  const [inputDataFim, setInputDataFim] = useFiltroPersistente('ceu.relatorios.draft.data_fim', '')
  const [inputColaborador, setInputColaborador] = useFiltroPersistente('ceu.relatorios.draft.colaborador', 'todos')
  const [inputItem, setInputItem] = useFiltroPersistente('ceu.relatorios.draft.item', 'todos')
  const [inputTipo, setInputTipo] = useFiltroPersistente('ceu.relatorios.draft.tipo', 'todos')
  const [inputDepartamento, setInputDepartamento] = useFiltroPersistente('ceu.relatorios.draft.departamento', '')
  const [inputStatus, setInputStatus] = useFiltroPersistente<StatusFiltroRelatorio>('ceu.relatorios.draft.status', 'todos')

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
