import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, checked, ...props }, ref) => {
    return (
      <label
        className={cn(
          'inline-flex items-center justify-center w-5 h-5 rounded border border-slate-300 cursor-pointer transition-colors',
          checked ? 'bg-slate-900 border-slate-900' : 'bg-white hover:border-slate-400',
          className
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <Check
          className={cn(
            'w-3.5 h-3.5 text-white transition-opacity',
            checked ? 'opacity-100' : 'opacity-0'
          )}
        />
      </label>
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
