import { useEffect, useRef } from 'react'
import { Chart, registerables, type ChartConfiguration } from 'chart.js'
import { cn } from '@/lib/utils'

Chart.register(...registerables)

interface GraficoProps {
  /** Configuração completa do Chart.js — o gráfico é recriado quando muda (passe memoizado) */
  config: ChartConfiguration
  /** Altura do container em px (padrão 300, como o template) */
  altura?: number
  className?: string
}

/** Wrapper React mínimo para Chart.js v4: cria o chart no canvas e destrói ao desmontar/trocar config */
export function Grafico({ config, altura = 300, className }: GraficoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const chart = new Chart(canvas, config)
    return () => chart.destroy()
  }, [config])

  return (
    <div className={cn('relative w-full', className)} style={{ height: altura }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
