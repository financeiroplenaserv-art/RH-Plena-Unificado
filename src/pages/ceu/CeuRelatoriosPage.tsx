import { useEffect, useMemo, useState } from 'react'

import {
  Users,
  CalendarDays,
  Package,
  AlertTriangle,
  Warehouse,
  FileSpreadsheet,
  FileJson,
  Search,
  RotateCcw,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCEUEntregas } from '@/hooks/useCEUEntregas'
import { useCEUItens } from '@/hooks/useCEUItens'
import { CeuPageWrapper } from './CeuPageWrapper'
import { CeuCard } from '@/components/ceu/CeuCard'
import { CeuButton } from '@/components/ceu/CeuButton'
import { CeuInput } from '@/components/ceu/CeuInput'
import { CeuBadge } from '@/components/ceu/CeuBadge'
import { ITENS_MOCK, ENTREGAS_MOCK } from '@/components/ceu/mockData'
import type { Colaborador } from '@/types/database'
import * as XLSX from 'xlsx'

const ABAS = [
  { id: 'colaborador', label: 'Por colaborador', icon: Users },
  { id: 'data', label: 'Por data', icon: CalendarDays },
  { id: 'itens', label: 'Itens com colaboradores', icon: Package },
  { id: 'vencimento', label: 'Alertas de vencimento', icon: AlertTriangle },
  { id: 'estoque', label: 'Controle de estoque', icon: Warehouse },
] as const

type AbaId = (typeof ABAS)[number]['id']


function badgeType(tipo: string) {
  switch (tipo) {
    case 'EPI':
      return 'epi'
    case 'Uniforme':
      return 'uniforme'
    case 'Crachá':
      return 'cracha'
    case 'Equipamento':
      return 'equipamento'
    default:
      return 'outros'
  }
}

function diasAte(dataStr: string) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const data = new Date(dataStr)
  data.setHours(0, 0, 0, 0)
  return Math.ceil((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

function diasAteTroca(dataEntregaStr: string, prazoDias: number | null) {
  if (!prazoDias || !dataEntregaStr) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dataEntrega = new Date(dataEntregaStr)
  dataEntrega.setHours(0, 0, 0, 0)
  const dataLimite = new Date(dataEntrega.getTime() + prazoDias * 24 * 60 * 60 * 1000)
  return Math.ceil((dataLimite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

function formatarData(dataStr: string | null) {
  if (!dataStr) return '—'
  return new Date(dataStr).toLocaleDateString('pt-BR')
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function CeuRelatoriosPage() {
  const { itens, loading: loadingItens, listar: listarItens } = useCEUItens()
  const { entregas, loading: loadingEntregas, listar: listarEntregas } = useCEUEntregas()

  const [abaAtiva, setAbaAtiva] = useState<AbaId>('colaborador')
  const [modoMock, setModoMock] = useState(false)
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroColaborador, setFiltroColaborador] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'em_aberto' | 'devolvido'>('todos')

  useEffect(() => {
    listarItens()
    listarEntregas()
  }, [listarItens, listarEntregas])

  const dadosItens = modoMock ? ITENS_MOCK : itens
  const dadosEntregas = modoMock ? ENTREGAS_MOCK : entregas

  const colaboradoresUnicos = useMemo(() => {
    const map = new Map<string, Colaborador>()
    dadosEntregas.forEach((e) => {
      if (e.colaborador && !map.has(e.colaborador_id)) {
        map.set(e.colaborador_id, e.colaborador)
      }
    })
    return Array.from(map.values()).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
  }, [dadosEntregas])

  const tiposUnicos = useMemo(() => {
    const tipos = new Set<string>()
    dadosItens.forEach((i) => tipos.add(i.tipo))
    dadosEntregas.forEach((e) => {
      if (e.item?.tipo) tipos.add(e.item.tipo)
      const snapshot = e.snapshot_item as { tipo?: string } | undefined
      if (snapshot?.tipo) tipos.add(snapshot.tipo)
    })
    return Array.from(tipos).sort()
  }, [dadosItens, dadosEntregas])

  const entregasFiltradas = useMemo(() => {
    return dadosEntregas.filter((e) => {
      if (filtroColaborador && e.colaborador_id !== filtroColaborador) return false

      const tipo = e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo
      if (filtroTipo && tipo !== filtroTipo) return false

      if (filtroStatus === 'em_aberto' && e.data_devolucao) return false
      if (filtroStatus === 'devolvido' && !e.data_devolucao) return false

      if (filtroDataInicio && e.data_entrega < filtroDataInicio) return false
      if (filtroDataFim && e.data_entrega > filtroDataFim) return false

      return true
    })
  }, [dadosEntregas, filtroColaborador, filtroTipo, filtroStatus, filtroDataInicio, filtroDataFim])

  const limparFiltros = () => {
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroColaborador('')
    setFiltroTipo('')
    setFiltroStatus('todos')
  }

  const exportarExcel = () => {
    const dados = dadosExportacao()
    if (dados.length === 0) return
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório CEU')
    XLSX.writeFile(wb, `relatorio_ceu_${abaAtiva}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const exportarTSV = () => {
    const dados = dadosExportacao()
    if (dados.length === 0) return
    const headers = Object.keys(dados[0])
    const rows = dados.map((row) =>
      headers.map((h) => String(row[h as keyof typeof row] ?? '')).join('\t')
    )
    const tsv = [headers.join('\t'), ...rows].join('\n')
    downloadFile(tsv, `relatorio_ceu_${abaAtiva}_${new Date().toISOString().split('T')[0]}.tsv`, 'text/tab-separated-values')
  }

  function dadosExportacao() {
    switch (abaAtiva) {
      case 'colaborador':
        return entregasFiltradas.map((e) => ({
          Colaborador: e.colaborador?.nome_completo || e.colaborador_id,
          Matrícula: e.colaborador?.matricula || '—',
          Departamento: e.colaborador?.departamento || '—',
          Item: e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—',
          Tipo: e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || '—',
          CA: e.item?.ca || (e.snapshot_item as { ca?: string })?.ca || '—',
          Quantidade: e.quantidade,
          'Data entrega': formatarData(e.data_entrega),
          'Data devolução': formatarData(e.data_devolucao),
          Status: e.data_devolucao ? 'Devolvido' : 'Em aberto',
          Observação: e.observacao || '—',
        }))
      case 'data':
        return entregasFiltradas.map((e) => ({
          'Data entrega': formatarData(e.data_entrega),
          Colaborador: e.colaborador?.nome_completo || e.colaborador_id,
          Matrícula: e.colaborador?.matricula || '—',
          Item: e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—',
          Tipo: e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || '—',
          Quantidade: e.quantidade,
          'Data devolução': formatarData(e.data_devolucao),
          Status: e.data_devolucao ? 'Devolvido' : 'Em aberto',
        }))
      case 'itens':
        return entregasFiltradas
          .filter((e) => !e.data_devolucao)
          .map((e) => ({
            Item: e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—',
            Tipo: e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || '—',
            CA: e.item?.ca || (e.snapshot_item as { ca?: string })?.ca || '—',
            Colaborador: e.colaborador?.nome_completo || e.colaborador_id,
            Matrícula: e.colaborador?.matricula || '—',
            Departamento: e.colaborador?.departamento || '—',
            Quantidade: e.quantidade,
            'Data entrega': formatarData(e.data_entrega),
          }))
      case 'vencimento':
        return dadosItens
          .filter((item) => item.ca && item.validade)
          .map((item) => ({
            Item: item.nome,
            Tipo: item.tipo,
            CA: item.ca,
            Validade: formatarData(item.validade),
            'Dias restantes': diasAte(item.validade!),
            Situação: diasAte(item.validade!) < 0 ? 'Vencido' : diasAte(item.validade!) <= 30 ? 'Próximo do vencimento' : 'OK',
          }))
      case 'estoque':
        return dadosItens
          .filter(
            (item) =>
              typeof item.estoque === 'number' &&
              typeof item.estoque_minimo === 'number' &&
              item.estoque_minimo > 0 &&
              item.estoque <= item.estoque_minimo
          )
          .map((item) => ({
            Item: item.nome,
            Tipo: item.tipo,
            'Estoque atual': item.estoque,
            'Estoque mínimo': item.estoque_minimo,
            'Diferença': (item.estoque || 0) - (item.estoque_minimo || 0),
          }))
      default:
        return []
    }
  }

  const renderConteudoAba = () => {
    if (abaAtiva === 'colaborador') {
      const porColaborador = colaboradoresUnicos.map((c) => ({
        colaborador: c,
        entregas: entregasFiltradas.filter((e) => e.colaborador_id === c.id),
      }))

      return (
        <div className="space-y-4">
          {porColaborador.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Nenhum resultado encontrado.</p>
          ) : (
            porColaborador.map(({ colaborador, entregas }) => (
              <div key={colaborador.id} className="border rounded-lg border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{colaborador.nome_completo}</p>
                      <p className="text-xs text-slate-500">
                        {colaborador.matricula} — {colaborador.departamento || '—'}
                      </p>
                    </div>
                    <CeuBadge type="default">{entregas.length} registro(s)</CeuBadge>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-white">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-slate-700">Item</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-700">Tipo</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-700">Qtd</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-700">Data</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entregas.map((e) => (
                      <tr key={e.id} className="border-t border-slate-100">
                        <td className="px-4 py-2">{e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—'}</td>
                        <td className="px-4 py-2">
                          <CeuBadge type={badgeType(e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || '')}>
                            {e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || '—'}
                          </CeuBadge>
                        </td>
                        <td className="px-4 py-2">{e.quantidade}</td>
                        <td className="px-4 py-2">{formatarData(e.data_entrega)}</td>
                        <td className="px-4 py-2">
                          <CeuBadge type={e.data_devolucao ? 'equipamento' : 'epi'}>
                            {e.data_devolucao ? 'Devolvido' : 'Em aberto'}
                          </CeuBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )
    }

    if (abaAtiva === 'data') {
      return (
        <div className="border rounded-lg border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Data entrega</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Colaborador</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Item</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Tipo</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Qtd</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {entregasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    Nenhuma entrega encontrada no período/filtro.
                  </td>
                </tr>
              ) : (
                entregasFiltradas.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{formatarData(e.data_entrega)}</td>
                    <td className="px-4 py-2">{e.colaborador?.nome_completo || e.colaborador_id}</td>
                    <td className="px-4 py-2">{e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—'}</td>
                    <td className="px-4 py-2">
                      <CeuBadge type={badgeType(e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || '')}>
                        {e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || '—'}
                      </CeuBadge>
                    </td>
                    <td className="px-4 py-2">{e.quantidade}</td>
                    <td className="px-4 py-2">
                      <CeuBadge type={e.data_devolucao ? 'equipamento' : 'epi'}>
                        {e.data_devolucao ? 'Devolvido' : 'Em aberto'}
                      </CeuBadge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )
    }

    if (abaAtiva === 'itens') {
      const entregasEmAberto = entregasFiltradas.filter((e) => !e.data_devolucao)
      const porItem = dadosItens
        .map((item) => ({
          item,
          entregas: entregasEmAberto.filter(
            (e) => e.item_id === item.id || e.item?.id === item.id
          ),
        }))
        .filter(({ entregas }) => entregas.length > 0)

      return (
        <div className="space-y-4">
          {porItem.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Nenhum item em aberto com colaboradores.</p>
          ) : (
            porItem.map(({ item, entregas }) => (
              <div key={item.id} className="border rounded-lg border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{item.nome}</p>
                      <p className="text-xs text-slate-500">{item.subgrupo || '—'}</p>
                    </div>
                    <CeuBadge type={badgeType(item.tipo)}>{item.tipo}</CeuBadge>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-white">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-slate-700">Colaborador</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-700">Matrícula</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-700">Qtd</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-700">Data entrega</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entregas.map((e) => (
                      <tr key={e.id} className="border-t border-slate-100">
                        <td className="px-4 py-2">{e.colaborador?.nome_completo || e.colaborador_id}</td>
                        <td className="px-4 py-2">{e.colaborador?.matricula || '—'}</td>
                        <td className="px-4 py-2">{e.quantidade}</td>
                        <td className="px-4 py-2">{formatarData(e.data_entrega)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )
    }

    if (abaAtiva === 'vencimento') {
      const vencimentosCA = dadosItens
        .filter((item) => item.ca && item.validade)
        .map((item) => ({ item, dias: diasAte(item.validade!) }))
        .filter(({ dias }) => dias <= 30)
        .sort((a, b) => a.dias - b.dias)

      const trocasPrazo = dadosEntregas
        .filter((e) => !e.data_devolucao)
        .map((e) => {
          const prazo =
            e.item?.prazo_uso_dias ||
            (e.snapshot_item as { prazo_uso_dias?: number | null })?.prazo_uso_dias ||
            null
          const dias = diasAteTroca(e.data_entrega, prazo)
          return { e, prazo, dias }
        })
        .filter(({ dias }) => dias !== null && dias <= 30)
        .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0))

      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Validade do Certificado de Aprovação (CA)
            </h3>
            <div className="border rounded-lg border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Item</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Tipo</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">CA</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Validade</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Dias restantes</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {vencimentosCA.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        Nenhum CA próximo do vencimento.
                      </td>
                    </tr>
                  ) : (
                    vencimentosCA.map(({ item, dias }) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-4 py-2">{item.nome}</td>
                        <td className="px-4 py-2">
                          <CeuBadge type={badgeType(item.tipo)}>{item.tipo}</CeuBadge>
                        </td>
                        <td className="px-4 py-2">{item.ca}</td>
                        <td className="px-4 py-2">{formatarData(item.validade)}</td>
                        <td className="px-4 py-2 font-semibold">{dias}</td>
                        <td className="px-4 py-2">
                          <CeuBadge type={dias < 0 ? 'epi' : dias <= 15 ? 'epi' : 'cracha'}>
                            {dias < 0 ? 'Vencido' : 'Próximo do vencimento'}
                          </CeuBadge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Prazo de Troca — Colaboradores com itens a vencer
            </h3>
            <div className="border rounded-lg border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Colaborador</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Matrícula</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Item</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Data entrega</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Prazo (dias)</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Dias até troca</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {trocasPrazo.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">
                        Nenhum colaborador com prazo de troca próximo.
                      </td>
                    </tr>
                  ) : (
                    trocasPrazo.map(({ e, prazo, dias }) => (
                      <tr key={e.id} className="border-t border-slate-100">
                        <td className="px-4 py-2">{e.colaborador?.nome_completo || e.colaborador_id}</td>
                        <td className="px-4 py-2">{e.colaborador?.matricula || '—'}</td>
                        <td className="px-4 py-2">
                          {e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—'}
                        </td>
                        <td className="px-4 py-2">{formatarData(e.data_entrega)}</td>
                        <td className="px-4 py-2">{prazo}</td>
                        <td className="px-4 py-2 font-semibold">{dias}</td>
                        <td className="px-4 py-2">
                          <CeuBadge type={dias! < 0 ? 'epi' : dias! <= 15 ? 'epi' : 'cracha'}>
                            {dias! < 0 ? 'Vencido' : 'Próximo da troca'}
                          </CeuBadge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
    }

    if (abaAtiva === 'estoque') {
      const estoqueBaixo = dadosItens
        .filter(
          (item) =>
            typeof item.estoque === 'number' &&
            typeof item.estoque_minimo === 'number' &&
            item.estoque_minimo > 0 &&
            item.estoque <= item.estoque_minimo
        )
        .sort((a, b) => (a.estoque || 0) - (b.estoque || 0))

      return (
        <div className="border rounded-lg border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Item</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Tipo</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Estoque atual</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Estoque mínimo</th>
                <th className="text-left px-4 py-2 font-medium text-slate-700">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {estoqueBaixo.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    Nenhum item abaixo do estoque mínimo.
                  </td>
                </tr>
              ) : (
                estoqueBaixo.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{item.nome}</td>
                    <td className="px-4 py-2">
                      <CeuBadge type={badgeType(item.tipo)}>{item.tipo}</CeuBadge>
                    </td>
                    <td className="px-4 py-2 font-semibold text-orange-600">{item.estoque}</td>
                    <td className="px-4 py-2">{item.estoque_minimo}</td>
                    <td className="px-4 py-2">{(item.estoque || 0) - (item.estoque_minimo || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )
    }

    return null
  }

  return (
    <CeuPageWrapper>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Relatórios CEU</h2>
            <p className="text-sm text-slate-500">Análise de entregas, itens e alertas</p>
          </div>
          <CeuButton variant="outline" size="sm" onClick={() => setModoMock((m) => !m)}>
            {modoMock ? 'Usar dados reais' : 'Usar dados de demonstração'}
          </CeuButton>
        </div>

        <CeuCard title="Filtros" icon={<Search className="w-4 h-4" />} gradient="blue">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data inicial</Label>
              <CeuInput
                id="data_inicio"
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_fim">Data final</Label>
              <CeuInput
                id="data_fim"
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
                <SelectTrigger className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {colaboradoresUnicos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de item</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {tiposUnicos.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}>
                <SelectTrigger className="border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="em_aberto">Em aberto</SelectItem>
                  <SelectItem value="devolvido">Devolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <CeuButton variant="outline" size="sm" onClick={limparFiltros}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Limpar
            </CeuButton>
            <CeuButton variant="outline" size="sm" onClick={exportarExcel}>
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              Exportar Excel
            </CeuButton>
            <CeuButton variant="outline" size="sm" onClick={exportarTSV}>
              <FileJson className="w-3.5 h-3.5 mr-1.5" />
              Exportar TSV
            </CeuButton>
          </div>
        </CeuCard>

        <div className="border-b border-slate-200">
          <div className="flex flex-wrap gap-1">
            {ABAS.map((aba) => {
              const Icon = aba.icon
              const ativa = aba.id === abaAtiva
              return (
                <button
                  key={aba.id}
                  onClick={() => setAbaAtiva(aba.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    ativa
                      ? 'border-[#3B82F6] text-[#1E40AF]'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {aba.label}
                </button>
              )
            })}
          </div>
        </div>

        <CeuCard title={ABAS.find((a) => a.id === abaAtiva)?.label || ''} gradient="blue">
          {(loadingItens || loadingEntregas) && !modoMock ? (
            <div className="text-center py-12 text-slate-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3B82F6] mx-auto mb-2" />
              Carregando dados...
            </div>
          ) : (
            renderConteudoAba()
          )}
        </CeuCard>
      </div>
    </CeuPageWrapper>
  )
}
