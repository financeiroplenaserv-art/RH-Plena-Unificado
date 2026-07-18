import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface CeuDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function CeuDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: CeuDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-sm overflow-hidden p-0', className)}>
        <DialogHeader className="border-b border-border p-6 pb-4">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-xs">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        {children && <div className="px-6 py-4">{children}</div>}
        {footer && <DialogFooter className="px-6 pb-6 gap-2">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
