import { StatusBadge } from '@/components/corh/StatusBadge'
import { formatarData } from '@/lib/utils'

/**
 * Situação do Bilhete Único na Riocard (fato importado do site oficial —
 * colaboradores.vt_bu_situacao / vt_bu_ativado / vt_bu_consultado_em).
 * Usado nas abas Trajetos e Colaboradores; somente leitura.
 */
export function BuRiocardBadge({
  situacao,
  ativado,
  consultadoEm,
  mostrarConsulta = false,
}: {
  situacao: string | null | undefined
  ativado: boolean | null | undefined
  consultadoEm?: string | null
  mostrarConsulta?: boolean
}) {
  if (!situacao) return <span className="text-[12px] text-muted-foreground">não consultado</span>
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <StatusBadge variant={ativado === false ? 'warning' : 'success'}>{situacao}</StatusBadge>
      {mostrarConsulta && consultadoEm && (
        <span className="text-[11px] text-muted-foreground">consulta de {formatarData(consultadoEm)}</span>
      )}
    </span>
  )
}
