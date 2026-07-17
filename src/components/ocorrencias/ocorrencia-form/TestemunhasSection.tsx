import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Users } from 'lucide-react'

interface TestemunhasFormValues {
  testemunha_1_nome: string
  testemunha_1_cargo: string
  testemunha_2_nome: string
  testemunha_2_cargo: string
}

interface TestemunhasSectionProps {
  form: TestemunhasFormValues
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function TestemunhasSection({ form, onChange }: TestemunhasSectionProps) {
  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <Users className="h-3.5 w-3.5" /> 8. Testemunhas (opcional)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Testemunha 1 — Nome</Label>
            <Input
              name="testemunha_1_nome"
              value={form.testemunha_1_nome}
              onChange={onChange}
              className="text-xs h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Testemunha 1 — Cargo</Label>
            <Input
              name="testemunha_1_cargo"
              value={form.testemunha_1_cargo}
              onChange={onChange}
              className="text-xs h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Testemunha 2 — Nome</Label>
            <Input
              name="testemunha_2_nome"
              value={form.testemunha_2_nome}
              onChange={onChange}
              className="text-xs h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Testemunha 2 — Cargo</Label>
            <Input
              name="testemunha_2_cargo"
              value={form.testemunha_2_cargo}
              onChange={onChange}
              className="text-xs h-9"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
