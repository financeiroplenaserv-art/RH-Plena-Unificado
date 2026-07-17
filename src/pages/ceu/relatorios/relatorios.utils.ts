import type { EntregaCEU, ItemCEU } from '@/types/database'

export function badgeType(tipo: string) {
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

export function diasAte(dataStr: string) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const data = new Date(dataStr)
  data.setHours(0, 0, 0, 0)
  return Math.ceil((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export function diasAteTroca(dataEntregaStr: string, prazoDias: number | null) {
  if (!prazoDias || !dataEntregaStr) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dataEntrega = new Date(dataEntregaStr)
  dataEntrega.setHours(0, 0, 0, 0)
  const dataLimite = new Date(dataEntrega.getTime() + prazoDias * 24 * 60 * 60 * 1000)
  return Math.ceil((dataLimite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatarData(dataStr: string | null) {
  if (!dataStr) return '—'
  return new Date(dataStr).toLocaleDateString('pt-BR')
}

export function downloadFile(content: string, filename: string, type: string) {
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

export type EntregaComSnapshot = EntregaCEU & {
  snapshot_item?: { nome?: string; tipo?: string; ca?: string; prazo_uso_dias?: number | null } | null
}

export function nomeItem(e: EntregaComSnapshot) {
  return e.item?.nome || (e.snapshot_item as { nome?: string })?.nome || '—'
}

export function tipoItem(e: EntregaComSnapshot) {
  return e.item?.tipo || (e.snapshot_item as { tipo?: string })?.tipo || ''
}

export function caItem(e: EntregaComSnapshot) {
  return e.item?.ca || (e.snapshot_item as { ca?: string })?.ca || '—'
}

export function prazoUsoItem(e: EntregaComSnapshot) {
  return e.item?.prazo_uso_dias || (e.snapshot_item as { prazo_uso_dias?: number | null })?.prazo_uso_dias || null
}

export function estoqueBaixo(item: ItemCEU) {
  return (
    typeof item.estoque === 'number' &&
    typeof item.estoque_minimo === 'number' &&
    item.estoque_minimo > 0 &&
    item.estoque <= item.estoque_minimo
  )
}
