import {
  Users,
  CalendarDays,
  Package,
  AlertTriangle,
  Warehouse,
} from 'lucide-react'

export const ABAS = [
  { id: 'colaborador', label: 'Por colaborador', icon: Users },
  { id: 'data', label: 'Por data', icon: CalendarDays },
  { id: 'itens', label: 'Itens com colaboradores', icon: Package },
  { id: 'vencimento', label: 'Alertas de vencimento', icon: AlertTriangle },
  { id: 'estoque', label: 'Controle de estoque', icon: Warehouse },
] as const

export type AbaId = (typeof ABAS)[number]['id']
