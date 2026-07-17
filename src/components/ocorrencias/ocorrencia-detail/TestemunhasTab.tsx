import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, Trash2, Loader2 } from 'lucide-react'
import type { OcorrenciaTestemunha } from '@/types/database'

interface TestemunhasTabProps {
  testemunhas: OcorrenciaTestemunha[]
  loadingTest: boolean
  podeTestemunha: boolean
  isCancelada: boolean
  mostrarFormTestemunha: boolean
  novaTestemunha: {
    nome: string
    cargo: string
    departamento: string
    cpf: string
  }
  onToggleForm: () => void
  onNovaTestemunhaChange: (field: keyof TestemunhasTabProps['novaTestemunha'], value: string) => void
  onSalvarTestemunha: (e: React.FormEvent) => void
  onRemoverTestemunha: (id: string) => void
}

export function TestemunhasTab({
  testemunhas,
  loadingTest,
  podeTestemunha,
  isCancelada,
  mostrarFormTestemunha,
  novaTestemunha,
  onToggleForm,
  onNovaTestemunhaChange,
  onSalvarTestemunha,
  onRemoverTestemunha,
}: TestemunhasTabProps) {
  return (
    <Card className="border-slate-100">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Testemunhas da Ocorrência
        </CardTitle>
        {!isCancelada && podeTestemunha && (
          <Button
            size="sm"
            onClick={onToggleForm}
            className="gap-1 text-xs h-7 bg-amber-600 hover:bg-amber-700"
          >
            <UserPlus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {mostrarFormTestemunha && (
          <form onSubmit={onSalvarTestemunha} className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input
                  value={novaTestemunha.nome}
                  onChange={(e) => onNovaTestemunhaChange('nome', e.target.value)}
                  required
                  className="text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs">CPF</Label>
                <Input
                  value={novaTestemunha.cpf}
                  onChange={(e) => onNovaTestemunhaChange('cpf', e.target.value)}
                  className="text-xs h-8"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label className="text-xs">Cargo</Label>
                <Input
                  value={novaTestemunha.cargo}
                  onChange={(e) => onNovaTestemunhaChange('cargo', e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Departamento</Label>
                <Input
                  value={novaTestemunha.departamento}
                  onChange={(e) => onNovaTestemunhaChange('departamento', e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleForm}
                className="text-xs h-7"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs h-7 bg-amber-600 hover:bg-amber-700"
              >
                Salvar Testemunha
              </Button>
            </div>
          </form>
        )}

        {loadingTest ? (
          <div className="text-center py-4 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : testemunhas.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">
            <UserPlus className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            Nenhuma testemunha cadastrada.
          </div>
        ) : (
          <div className="space-y-2">
            {testemunhas.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t.nome}</p>
                    <p className="text-xs text-slate-500">
                      {t.cargo}
                      {t.departamento ? ` | ${t.departamento}` : ''}
                      {t.cpf ? ` | CPF: ${t.cpf}` : ''}
                    </p>
                  </div>
                </div>
                {!isCancelada && podeTestemunha && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoverTestemunha(t.id)}
                    className="text-slate-400 hover:text-red-600 h-7 w-7 p-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
