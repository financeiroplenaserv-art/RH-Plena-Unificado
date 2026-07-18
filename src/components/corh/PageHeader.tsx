import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
  showBackButton?: boolean
  backTo?: string
  onBack?: () => boolean | void
}

export function PageHeader({
  title,
  description,
  children,
  className,
  showBackButton = true,
  backTo,
  onBack,
}: PageHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      const result = onBack()
      if (result === true) return
    }
    if (backTo) {
      navigate(backTo)
      return
    }
    navigate(-1)
  }

  return (
    <div className={cn('mb-5', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {showBackButton && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleBack}
              title="Voltar"
              className="flex-shrink-0"
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">{title}</h1>
            {description && <p className="text-[13px] text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  )
}
