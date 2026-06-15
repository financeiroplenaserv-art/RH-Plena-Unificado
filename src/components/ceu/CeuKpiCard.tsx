import { cn } from '@/lib/utils'

interface CeuKpiCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  gradient: 'blue' | 'orange' | 'green' | 'dark-blue'
  className?: string
}

const gradients = {
  blue: 'bg-gradient-to-br from-[#3B82F6] to-[#1E40AF]',
  'dark-blue': 'bg-gradient-to-br from-[#1E3A5F] to-[#1E40AF]',
  orange: 'bg-gradient-to-br from-[#F97316] to-[#EA580C]',
  green: 'bg-gradient-to-br from-[#16A34A] to-[#15803D]',
}

export function CeuKpiCard({ label, value, icon, gradient, className }: CeuKpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-5 text-white shadow-md',
        gradients[gradient],
        className
      )}
      style={{ boxShadow: '0 4px 6px -1px rgba(30, 58, 95, 0.12), 0 2px 4px -2px rgba(30, 58, 95, 0.08)' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/90">{label}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className="p-2.5 bg-white/20 rounded-lg">{icon}</div>
      </div>
    </div>
  )
}
