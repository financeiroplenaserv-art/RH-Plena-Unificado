import * as XLSX from '@e965/xlsx'
import type { ItemCEU } from '@/types/database'
import {
  caItem,
  diasAte,
  downloadFile,
  formatarData,
  nomeItem,
  tipoItem,
  type EntregaComSnapshot,
} from './relatorios.utils'
import type { AbaId } from './abas'
import { hojeBrasil } from '@/lib/utils'

type LinhaExportacao = Record<string, string | number | null | undefined>

export function dadosExportacao(
  abaAtiva: AbaId,
  entregasFiltradas: EntregaComSnapshot[],
  dadosItens: ItemCEU[]
): LinhaExportacao[] {
  switch (abaAtiva) {
    case 'colaborador':
      return entregasFiltradas.map((e) => ({
        Colaborador: e.colaborador?.nome_completo || e.colaborador_id,
        Matrícula: e.colaborador?.matricula || '—',
        Departamento: e.colaborador?.departamento || '—',
        Item: nomeItem(e),
        Tipo: tipoItem(e) || '—',
        CA: caItem(e),
        Quantidade: e.quantidade,
        'Data entrega': formatarData(e.data_entrega),
        'Data devolução': formatarData(e.data_devolucao),
        Situação: e.situacao || 'Novo',
        Status: e.data_devolucao ? 'Devolvido' : 'Em aberto',
        Observação: e.observacao || '—',
      }))
    case 'data':
      return entregasFiltradas.map((e) => ({
        'Data entrega': formatarData(e.data_entrega),
        Colaborador: e.colaborador?.nome_completo || e.colaborador_id,
        Matrícula: e.colaborador?.matricula || '—',
        Item: nomeItem(e),
        Tipo: tipoItem(e) || '—',
        Quantidade: e.quantidade,
        'Data devolução': formatarData(e.data_devolucao),
        Status: e.data_devolucao ? 'Devolvido' : 'Em aberto',
      }))
    case 'itens':
      return entregasFiltradas
        .filter((e) => !e.data_devolucao)
        .map((e) => ({
          Item: nomeItem(e),
          Tipo: tipoItem(e) || '—',
          CA: caItem(e),
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

export function exportarExcel(
  abaAtiva: AbaId,
  entregasFiltradas: EntregaComSnapshot[],
  dadosItens: ItemCEU[]
) {
  const dados = dadosExportacao(abaAtiva, entregasFiltradas, dadosItens)
  if (dados.length === 0) return
  const ws = XLSX.utils.json_to_sheet(dados)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório CEU')
  XLSX.writeFile(wb, `relatorio_ceu_${abaAtiva}_${hojeBrasil()}.xlsx`)
}

export function exportarTSV(
  abaAtiva: AbaId,
  entregasFiltradas: EntregaComSnapshot[],
  dadosItens: ItemCEU[]
) {
  const dados = dadosExportacao(abaAtiva, entregasFiltradas, dadosItens)
  if (dados.length === 0) return
  const headers = Object.keys(dados[0])
  const rows = dados.map((row) =>
    headers.map((h) => String(row[h] ?? '')).join('\t')
  )
  const tsv = [headers.join('\t'), ...rows].join('\n')
  downloadFile(tsv, `relatorio_ceu_${abaAtiva}_${hojeBrasil()}.tsv`, 'text/tab-separated-values')
}
