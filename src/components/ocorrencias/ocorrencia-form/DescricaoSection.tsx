import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { FileText, Building2 } from 'lucide-react'

interface DescricaoFormValues {
  descricao: string
}

interface DescricaoSectionProps {
  form: DescricaoFormValues
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  empresa: { nome: string; cnpj: string } | null
}

export function DescricaoSection({ form, onChange, empresa }: DescricaoSectionProps) {
  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" /> 6. Descrição do Fato *
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {empresa && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
            <Building2 className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs text-blue-700">
              Modelo pré-preenchido: {empresa.nome} — CNPJ: {empresa.cnpj || 'Não informado'}
            </span>
          </div>
        )}
        <p className="text-xs text-slate-500">
          O texto abaixo foi pré-preenchido com base no tipo selecionado. Complete os campos [___]
          conforme necessidade.
        </p>
        <Textarea
          name="descricao"
          value={form.descricao}
          onChange={onChange}
          required
          rows={14}
        />
      </CardContent>
    </Card>
  )
}
