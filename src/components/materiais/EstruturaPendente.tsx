import { Construction } from 'lucide-react'
import { EmptyState } from '@/components/corh/EmptyState'
import { MENSAGEM_ESTRUTURA_PENDENTE } from '@/lib/materiais/erros'

/** Aviso quando as migrations do módulo (121–123) ainda não foram aplicadas. */
export function EstruturaPendente() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <EmptyState
        icon={<Construction className="size-6" />}
        title={MENSAGEM_ESTRUTURA_PENDENTE}
        description="As telas ficam disponíveis assim que as tabelas do módulo Materiais forem criadas no banco. Nada foi perdido — avise o administrador."
      />
    </div>
  )
}
