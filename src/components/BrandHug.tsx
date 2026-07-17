import { useEffect, useRef, useState } from 'react'
import './BrandHug.css'

/**
 * Assinatura de marca "Abraço" — canto superior direito da tela de login.
 * Carrega os SVGs do kit CORH inline para permitir animação dos paths.
 */
export function BrandHug() {
  const drawRef = useRef<HTMLDivElement>(null)
  const finalRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadSvgs() {
      try {
        const [drawRes, finalRes] = await Promise.all([
          fetch('/corh_abraco_draw.svg'),
          fetch('/corh_abraco_final.svg'),
        ])

        if (!drawRes.ok || !finalRes.ok) {
          throw new Error(`Erro ao carregar SVGs: ${drawRes.status} / ${finalRes.status}`)
        }

        const [drawText, finalText] = await Promise.all([drawRes.text(), finalRes.text()])

        if (cancelled) return

        if (drawRef.current) drawRef.current.innerHTML = drawText
        if (finalRef.current) finalRef.current.innerHTML = finalText

        // Dispara a animação no próximo frame, após o SVG estar no DOM.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setLoaded(true))
        })
      } catch (err) {
        console.error('Erro ao carregar SVGs do Abraço:', err)
      }
    }

    loadSvgs()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="brand-hug" aria-hidden="true">
      <div ref={drawRef} className={`draw-layer ${loaded ? 'animate' : ''}`} />
      <div ref={finalRef} className={`final-layer ${loaded ? 'visible' : ''}`} />
      <img src="/logo_plena_30anos_redonda.png" alt="" className={loaded ? 'pop' : ''} />
    </div>
  )
}
