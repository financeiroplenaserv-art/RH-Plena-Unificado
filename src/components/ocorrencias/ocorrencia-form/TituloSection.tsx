import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FileText } from 'lucide-react'

interface TituloSectionProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function TituloSection({ value, onChange }: TituloSectionProps) {
  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" /> 3. Título da Ocorrência
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          name="titulo"
          value={value}
          onChange={onChange}
          placeholder="Ex: Atraso recorrente em março, Desacordo com supervisor..."
          required
          className="text-sm h-9"
        />
        <p className="text-xs text-slate-400 mt-1">
          Este título aparece na lista de ocorrências. Seja breve e claro. Não vai para o
          formulário que o colaborador assina.
        </p>
      </CardContent>
    </Card>
  )
}
