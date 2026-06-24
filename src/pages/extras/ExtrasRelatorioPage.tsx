import { ExtrasPageWrapper, ExtrasCard } from './ExtrasPageWrapper'

export function ExtrasRelatorioPage() {
  return (
    <ExtrasPageWrapper>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: '#1F2937' }}>Relatório Semanal</h2>
        <p className="text-sm" style={{ color: '#94A3B8' }}>Consolidação de extras para pagamento e emissão de recibos</p>
      </div>

      <ExtrasCard>
        <p className="text-center py-12" style={{ color: '#94A3B8' }}>
          Funcionalidade em desenvolvimento. Será implementada na próxima fase.
        </p>
      </ExtrasCard>
    </ExtrasPageWrapper>
  )
}
