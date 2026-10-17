import * as XLSX from '@e965/xlsx'
import type { MatCompra, MatCompraItem } from '@/types/materiais'
import {
  aoaCompraAoFornecedor,
  aoaEntregaPorRota,
  aoaPedidoPorCliente,
  montarMatrizCompra,
  nomeArquivoCompra,
} from './excelCompra'

// Gera e baixa o .xlsx da compra (lógica da matriz em excelCompra.ts).
export function baixarExcelCompra(compra: MatCompra, itens: MatCompraItem[], fornecedorNome: string, comValores: boolean): void {
  const m = montarMatrizCompra(itens)
  const cab = { fornecedor: fornecedorNome, competencia: compra.competencia, numero: compra.numero }
  const wb = XLSX.utils.book_new()
  const aba1 = XLSX.utils.aoa_to_sheet(aoaPedidoPorCliente(m, cab, comValores))
  aba1['!cols'] = [{ wch: 38 }, ...m.colunas.map(() => ({ wch: 12 })), { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, aba1, 'Pedido por Cliente')
  const aba2 = XLSX.utils.aoa_to_sheet(aoaCompraAoFornecedor(m, cab, comValores))
  aba2['!cols'] = [{ wch: 38 }, { wch: 12 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, aba2, 'Compra ao Fornecedor')
  const aba3 = XLSX.utils.aoa_to_sheet(aoaEntregaPorRota(m))
  aba3['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 38 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, aba3, 'Entrega por Rota')
  XLSX.writeFile(wb, nomeArquivoCompra(fornecedorNome, compra, comValores))
}
