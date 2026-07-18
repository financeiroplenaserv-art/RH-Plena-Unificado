import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ClipboardCheck } from 'lucide-react'

interface DefesaMedidasFormValues {
  defesa_funcionario: string
  medida_corretiva: string
  prazo_acompanhamento: string
}

interface DefesaMedidasSectionProps {
  form: DefesaMedidasFormValues
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
}

export function DefesaMedidasSection({ form, onChange }: DefesaMedidasSectionProps) {
  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <ClipboardCheck className="h-3.5 w-3.5" /> 7. Defesa e Medidas Corretivas *
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">
            Defesa do Funcionário (obrigatório — confirme se ele aceitou a notificação) *
          </Label>
          <Textarea
            name="defesa_funcionario"
            value={form.defesa_funcionario}
            onChange={onChange}
            required
            rows={3}
            placeholder="Descreva: o funcionário aceitou a notificação? Recusou assinar? Apresentou defesa? Qual foi o posicionamento dele?"
          />
        </div>
        <div>
          <Label className="text-xs">Medida Corretiva Tomada</Label>
          <Input
            name="medida_corretiva"
            value={form.medida_corretiva}
            onChange={onChange}
            placeholder="Ex: Aplicação de advertência verbal, encaminhamento para treinamento, etc."
            className="text-xs h-9"
          />
        </div>
        <div>
          <Label className="text-xs">Prazo de Acompanhamento (opcional)</Label>
          <Input
            type="date"
            name="prazo_acompanhamento"
            value={form.prazo_acompanhamento}
            onChange={onChange}
            className="text-xs h-9"
          />
        </div>
      </CardContent>
    </Card>
  )
}
