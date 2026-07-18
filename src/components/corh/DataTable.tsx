import { cn } from '@/lib/utils'

interface DataTableProps {
  title: React.ReactNode
  count?: number
  children: React.ReactNode
  className?: string
  minWidth?: number
}

export function DataTable({ title, count, children, className, minWidth = 720 }: DataTableProps) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-border bg-card shadow-sm', className)}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="text-[14px] font-semibold text-foreground">
          {title}
          {typeof count === 'number' && (
            <span className="ml-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-primary">
              {count}
            </span>
          )}
        </h2>
      </div>
      <div className="overflow-x-auto" style={{ minWidth }}>
        {children}
      </div>
    </section>
  )
}
