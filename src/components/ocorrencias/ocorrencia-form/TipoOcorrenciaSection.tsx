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
import {
  GRAVIDADES_SELECIONAVEIS,
  permiteEscolherGravidade,
  type TipoOcorrencia,
} from '@/lib/ocorrencias/tiposOcorrencia'
import { DepartamentoAutocomplete } from '@/components/DepartamentoAutocomplete'

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
  isEdicao: boolean
  onGravidadeChange: (gravidade: string) => void
  postoAtualTexto: string
  postoDestinoId: string
  onPostoDestinoChange: (id: string) => void
}

const corGravidade = (gravidade: string) =>
  gravidade === 'Leve'
    ? 'text-blue-600'
    : gravidade === 'Moderada'
      ? 'text-amber-600'
      : gravidade === 'Grave'
        ? 'text-orange-600'
        : 'text-red-600'

export function TipoOcorrenciaSection({
  form,
  tiposFiltrados,
  onTipoChange,
  isEdicao,
  onGravidadeChange,
  postoAtualTexto,
  postoDestinoId,
  onPostoDestinoChange,
}: TipoOcorrenciaSectionProps) {
  const escolheGravidade = permiteEscolherGravidade(form.tipo_penalidade) && !isEdicao
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
                  {t.tipo}
                  {(t.gravidade === 'Leve' && t.macroGrupo === '9. Registro do RH') ||
                  permiteEscolherGravidade(t.tipo)
                    ? ''
                    : ` — ${t.gravidade}`}
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
              {escolheGravidade ? (
                <Select value={form.gravidade} onValueChange={onGravidadeChange}>
                  <SelectTrigger
                    className={`h-7 border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus:ring-0 ${corGravidade(form.gravidade)}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRAVIDADES_SELECIONAVEIS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className={`text-sm font-semibold ${corGravidade(form.gravidade)}`}>
                  {form.gravidade}
                </span>
              )}
            </div>
            <div className="bg-slate-50 rounded-lg p-3 sm:col-span-2">
              <span className="text-xs text-slate-400 block">Base Legal</span>
              <span className="text-sm text-slate-700">{form.base_legal}</span>
            </div>
          </div>
        )}
        {escolheGravidade && (
          <div className="border border-slate-200 rounded-lg p-3 space-y-2">
            <p className="text-xs text-slate-500">
              Posto atual:{' '}
              <span className="font-medium text-slate-700">{postoAtualTexto || 'não identificado'}</span>
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Posto de destino *</Label>
              <DepartamentoAutocomplete
                value={postoDestinoId}
                onChange={onPostoDestinoChange}
                mode="id"
                placeholder="Buscar posto de destino..."
                clearValue=""
                clearLabel="Selecione..."
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Ao salvar, o cadastro do colaborador passa a apontar para o posto de destino.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export type { TipoOcorrencia }
