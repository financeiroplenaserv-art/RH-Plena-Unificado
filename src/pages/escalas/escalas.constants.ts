import type { LocalTrabalhoDiario, MapeamentoFlitLocalTrabalho } from '@/types/database'

export const FONTES_INFO: Record<LocalTrabalhoDiario['fonte'], { label: string; cor: string }> = {
  dispositivo: { label: 'Dispositivo fixo', cor: 'bg-green-100 text-green-800 border-green-200' },
  perimetro: { label: 'Perímetro', cor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  turno_departamento: { label: 'Turno + Departamento', cor: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  manual: { label: 'Confirmado manualmente', cor: 'bg-blue-100 text-blue-800 border-blue-200' },
  nao_identificado: { label: 'Não identificado', cor: 'bg-red-100 text-red-800 border-red-200' },
}

export const TIPOS_MATCH: { value: MapeamentoFlitLocalTrabalho['tipo_match']; label: string }[] = [
  { value: 'dispositivo', label: 'Dispositivo (Flit Multi)' },
  { value: 'perimetro', label: 'Perímetro' },
  { value: 'turno_departamento', label: 'Turno contém Departamento' },
]
