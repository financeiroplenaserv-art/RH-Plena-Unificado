import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import type { AuditoriaLog } from '@/types/database'

interface AuditoriaTabProps {
  logs: AuditoriaLog[]
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('pt-BR')
}

export function AuditoriaTab({ logs }: AuditoriaTabProps) {
  return (
    <Card className="border-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Histórico de Auditoria
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">
            <Clock className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            Nenhum registro de auditoria.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="p-3 rounded-lg border border-slate-100 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      l.operacao === 'INSERT'
                        ? 'bg-emerald-50 text-emerald-700'
                        : l.operacao === 'UPDATE'
                          ? 'bg-blue-50 text-blue-700'
                          : l.operacao === 'CANCEL'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    {l.operacao}
                  </span>
                  <span className="text-xs text-slate-400">{fmtDateTime(l.created_at || '')}</span>
                </div>
                {l.dados_novos && (
                  <div className="text-xs text-slate-600 mt-1">
                    {l.operacao === 'UPDATE' &&
                    l.tabela === 'ocorrencias' &&
                    l.dados_novos.status &&
                    l.dados_anteriores?.status ? (
                      <span>
                        Status alterado: <strong>{String(l.dados_anteriores.status)}</strong> →{' '}
                        <strong>{String(l.dados_novos.status)}</strong>
                      </span>
                    ) : null}
                    {l.operacao === 'INSERT' && l.tabela === 'ocorrencias' ? (
                      <span>
                        Ocorrência criada:{' '}
                        <strong>{String(l.dados_novos.tipo_ocorrencia || '')}</strong>
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
