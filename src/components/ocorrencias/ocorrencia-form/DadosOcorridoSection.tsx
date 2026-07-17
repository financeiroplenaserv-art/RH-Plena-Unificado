import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Clock } from 'lucide-react'

interface DadosOcorridoFormValues {
  data_hora_ocorrido: string
  data_ocorrencia: string
  local_ocorrido: string
}

interface DadosOcorridoSectionProps {
  form: DadosOcorridoFormValues
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function DadosOcorridoSection({ form, onChange }: DadosOcorridoSectionProps) {
  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" /> 5. Dados do Ocorrido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Data do Ocorrido *</Label>
            <Input
              type="date"
              name="data_hora_ocorrido"
              value={form.data_hora_ocorrido}
              onChange={onChange}
              required
              className="text-xs h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Data do Registro</Label>
            <Input
              type="date"
              name="data_ocorrencia"
              value={form.data_ocorrencia}
              onChange={onChange}
              required
              className="text-xs h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Local</Label>
            <Input
              name="local_ocorrido"
              value={form.local_ocorrido}
              onChange={onChange}
              placeholder="Ex: Escritório Central"
              className="text-xs h-9"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
