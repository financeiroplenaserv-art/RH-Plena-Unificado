import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClipboardCheck } from 'lucide-react'
import type { TipoOcorrencia } from '@/lib/ocorrencias/tiposOcorrencia'

interface TipoOcorrenciaFormValues {
  macro_grupo: string
  tipo_ocorrencia: string
  tipo_penalidade: string
  gravidade: string
  base_legal: string
}

interface TipoOcorrenciaSectionProps {
  form: TipoOcorrenciaFormValues
  tiposFiltrados: TipoOcorrencia[]
  onTipoChange: (tipo: string) => void
}

export function TipoOcorrenciaSection({
  form,
  tiposFiltrados,
  onTipoChange,
}: TipoOcorrenciaSectionProps) {
  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <ClipboardCheck className="h-3.5 w-3.5" /> 3. Tipo de Ocorrência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Tipo *</Label>
          <Select
            value={form.tipo_ocorrencia}
            onValueChange={onTipoChange}
            disabled={!form.macro_grupo}
            required
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  form.macro_grupo ? 'Selecione...' : 'Escolha um macro grupo primeiro'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {tiposFiltrados.map((t) => (
                <SelectItem key={t.tipo} value={t.tipo}>
                  {t.tipo} — {t.gravidade}
                  {t.exigeAnexo ? ' (exige anexo)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.tipo_penalidade && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <span className="text-xs text-slate-400 block">Gravidade</span>
              <span
                className={`text-sm font-semibold ${
                  form.gravidade === 'Leve'
                    ? 'text-blue-600'
                    : form.gravidade === 'Moderada'
                      ? 'text-amber-600'
                      : form.gravidade === 'Grave'
                        ? 'text-orange-600'
                        : 'text-red-600'
                }`}
              >
                {form.gravidade}
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 sm:col-span-2">
              <span className="text-xs text-slate-400 block">Base Legal</span>
              <span className="text-sm text-slate-700">{form.base_legal}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export type { TipoOcorrencia }
