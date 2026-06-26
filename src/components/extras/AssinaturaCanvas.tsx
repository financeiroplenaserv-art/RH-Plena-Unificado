import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export interface AssinaturaCanvasRef {
  limpar: () => void
  toDataURL: (tipo?: string, qualidade?: number) => string | undefined
  isEmpty: () => boolean
}

interface AssinaturaCanvasProps {
  width?: number
  height?: number
  className?: string
}

export const AssinaturaCanvas = forwardRef<AssinaturaCanvasRef, AssinaturaCanvasProps>(
  ({ width = 600, height = 160, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [desenhando, setDesenhando] = useState(false)
    const [temAssinatura, setTemAssinatura] = useState(false)

    const desenharFundo = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Linha guia cinza clara
      ctx.strokeStyle = '#E2E8F0'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(20, canvas.height - 40)
      ctx.lineTo(canvas.width - 20, canvas.height - 40)
      ctx.stroke()

      // Texto indicativo
      ctx.fillStyle = '#94A3B8'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Assine aqui', canvas.width / 2, canvas.height - 20)
    }

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 3
      ctx.strokeStyle = '#000000'

      desenharFundo(canvas, ctx)
    }, [])

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0]?.clientX || e.changedTouches[0]?.clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0]?.clientY || e.changedTouches[0]?.clientY : e.clientY
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      }
    }

    const iniciar = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      setDesenhando(true)
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      const { x, y } = getPos(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
    }

    const mover = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      if (!desenhando) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      const { x, y } = getPos(e)
      ctx.lineTo(x, y)
      ctx.stroke()
      setTemAssinatura(true)
    }

    const finalizar = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      setDesenhando(false)
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) ctx.beginPath()
    }

    const limpar = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      desenharFundo(canvas, ctx)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 3
      ctx.strokeStyle = '#000000'
      setTemAssinatura(false)
    }

    const toDataURL = (tipo = 'image/png', qualidade = 1) => {
      return canvasRef.current?.toDataURL(tipo, qualidade)
    }

    const isEmpty = () => !temAssinatura

    useImperativeHandle(ref, () => ({ limpar, toDataURL, isEmpty }))

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={className}
        style={{
          touchAction: 'none',
          cursor: 'crosshair',
          backgroundColor: '#FFFFFF',
          border: '1px solid #CBD5E1',
          borderRadius: '0.5rem',
          display: 'block',
        }}
        onMouseDown={iniciar}
        onMouseMove={mover}
        onMouseUp={finalizar}
        onMouseLeave={finalizar}
        onTouchStart={iniciar}
        onTouchMove={mover}
        onTouchEnd={finalizar}
      />
    )
  }
)

AssinaturaCanvas.displayName = 'AssinaturaCanvas'
