import { useMemo } from 'react'
import { cssCracha, montarCracha, type DadosCracha, type ModoCracha } from '@/lib/ceu/crachas'

interface CrachaPreviewProps {
  dados: DadosCracha
  modo: ModoCracha
  /** Fator de zoom da miniatura (1 = tamanho real, 54 x 85,6 mm) */
  zoom?: number
}

/**
 * Miniatura do crachá na tela. Usa o MESMO HTML/CSS da folha impressa
 * (src/lib/ceu/crachas.ts) — o que aparece aqui é o que sai no papel.
 * O HTML é gerado com escape e só aceita imagens em data URL.
 */
export function CrachaPreview({ dados, modo, zoom = 0.8 }: CrachaPreviewProps) {
  const html = useMemo(() => montarCracha(dados, modo), [dados, modo])
  return (
    <div
      className="cracha-previa shrink-0 overflow-hidden rounded-[3mm] shadow-md ring-1 ring-black/10"
      style={{ zoom }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** CSS das miniaturas (injetado uma vez na página). */
export function EstilosCrachaPreview({ modo }: { modo: ModoCracha }) {
  return (
    <style>{`.cracha-previa { --azul: #1a9be0; --azul-topo: #0aa0e2; width: 54mm; height: 85.6mm; }
.cracha-previa * { box-sizing: border-box; }
${cssCracha(modo)}`}</style>
  )
}
