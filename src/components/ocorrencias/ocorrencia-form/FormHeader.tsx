import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface FormHeaderProps {
  isEdicao: boolean
}

export function FormHeader({ isEdicao }: FormHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate('/rh/ocorrencias')}
        className="gap-1 h-8"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </Button>
      <h2 className="text-lg font-semibold text-slate-900">
        {isEdicao ? 'Editar Ocorrência' : 'Nova Ocorrência'}
      </h2>
    </div>
  )
}
