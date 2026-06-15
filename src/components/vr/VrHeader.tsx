import { Utensils } from 'lucide-react'

interface VrHeaderProps {
  title: string
  subtitle?: string
}

export function VrHeader({ title, subtitle }: VrHeaderProps) {
  return (
    <div
      className="rounded-xl px-6 py-5 text-white shadow-md"
      style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)' }}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <Utensils className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-blue-100">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}
