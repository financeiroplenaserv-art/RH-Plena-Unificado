import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Gavel } from 'lucide-react'

interface MacroGrupoSectionProps {
  value: string
  onChange: (macroGrupo: string) => void
  macroGrupos: string[]
}

export function MacroGrupoSection({ value, onChange, macroGrupos }: MacroGrupoSectionProps) {
  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <Gavel className="h-3.5 w-3.5" /> 2. Macro Grupo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={value} onValueChange={onChange} required>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o macro grupo..." />
          </SelectTrigger>
          <SelectContent>
            {macroGrupos.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
