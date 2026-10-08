import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { carregarFotoDataUrl } from '@/lib/ceu/crachasDados'
import { FOCO_PADRAO, normalizarFoco } from '@/lib/ceu/quadro'
import type { FocoFotoQuadro } from '@/types/database'

interface FotoFocoDialogProps {
  aberto: boolean
  onFechar: () => void
  colaboradorId: string
  nome: string
  fotoPath: string | null
  focoAtual: FocoFotoQuadro | null
  /** Chamado após gravar (null = voltou ao padrão). */
  onSalvo: (foco: FocoFotoQuadro | null) => void
}

/**
 * Editor de enquadramento da foto 3×4 do quadro (arrastar = mover, slider =
 * zoom). Grava colaboradores.foto_foco ({zoom, px, py} — CSS object-position +
 * scale; ver src/lib/ceu/quadro.ts). Zoom ≥ 1 sobre o ponto focal nunca expõe
 * bordas vazias, então qualquer combinação é segura para impressão.
 */
export function FotoFocoDialog({ aberto, onFechar, colaboradorId, nome, fotoPath, focoAtual, onSalvo }: FotoFocoDialogProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [foco, setFoco] = useState<FocoFotoQuadro>(FOCO_PADRAO)
  const [salvando, setSalvando] = useState(false)
  const [dimensoes, setDimensoes] = useState<{ w: number; h: number } | null>(null)
  const quadroRef = useRef<HTMLDivElement>(null)
  const arraste = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!aberto) return
    setFoco(normalizarFoco(focoAtual) ?? FOCO_PADRAO)
    setDataUrl(null)
    setDimensoes(null)
    if (fotoPath) void carregarFotoDataUrl(fotoPath).then(setDataUrl)
  }, [aberto, fotoPath, focoAtual])

  const aoArrastar = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!arraste.current || !quadroRef.current || !dimensoes) return
      const frame = quadroRef.current.getBoundingClientRect()
      // tamanho da imagem com object-fit: cover (zoom 1)
      const escala = Math.max(frame.width / dimensoes.w, frame.height / dimensoes.h)
      const excedenteX = Math.max(0, dimensoes.w * escala - frame.width)
      const excedenteY = Math.max(0, dimensoes.h * escala - frame.height)
      const dx = e.clientX - arraste.current.x
      const dy = e.clientY - arraste.current.y
      arraste.current = { x: e.clientX, y: e.clientY }
      setFoco((f) => {
        const clamp = (v: number) => Math.min(100, Math.max(0, v))
        return {
          zoom: f.zoom,
          // arrastar o conteúdo revela a parte oposta; /zoom compensa a ampliação
          px: excedenteX > 0 ? clamp(f.px - (dx / excedenteX / f.zoom) * 100) : 50,
          py: excedenteY > 0 ? clamp(f.py - (dy / excedenteY / f.zoom) * 100) : f.py,
        }
      })
    },
    [dimensoes],
  )

  const salvar = async () => {
    setSalvando(true)
    try {
      const padrao = foco.zoom === FOCO_PADRAO.zoom && foco.px === FOCO_PADRAO.px && foco.py === FOCO_PADRAO.py
      const valor = padrao ? null : foco
      const { data, error } = await supabase
        .from('colaboradores')
        .update({ foto_foco: valor })
        .eq('id', colaboradorId)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Nenhuma linha atualizada — sem permissão de gravação')
      toast.success(padrao ? 'Enquadramento voltou ao padrão' : 'Enquadramento salvo')
      onSalvo(valor)
      onFechar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar o enquadramento')
    } finally {
      setSalvando(false)
    }
  }

  const estiloFoto: React.CSSProperties = {
    objectPosition: `${foco.px}% ${foco.py}%`,
    ...(foco.zoom > 1 ? { transform: `scale(${foco.zoom})`, transformOrigin: `${foco.px}% ${foco.py}%` } : {}),
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Enquadrar foto — {nome}</DialogTitle>
        </DialogHeader>

        <div
          ref={quadroRef}
          className="relative mx-auto aspect-[3/4] w-56 cursor-grab touch-none overflow-hidden rounded-lg border border-border bg-muted active:cursor-grabbing"
          onPointerDown={(e) => {
            arraste.current = { x: e.clientX, y: e.clientY }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={aoArrastar}
          onPointerUp={() => (arraste.current = null)}
          onPointerCancel={() => (arraste.current = null)}
        >
          {dataUrl ? (
            <>
              {foco.zoom < 1 && (
                <img
                  src={dataUrl}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 size-full scale-110 object-cover blur-md brightness-[0.92] select-none"
                />
              )}
              <img
                src={dataUrl}
                alt=""
                draggable={false}
                className="absolute inset-0 size-full select-none object-cover"
                style={estiloFoto}
                onLoad={(e) => {
                  const img = e.currentTarget
                  setDimensoes({ w: img.naturalWidth, h: img.naturalHeight })
                }}
              />
            </>
          ) : (
            <div className="flex size-full items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Zoom ({foco.zoom.toFixed(2)}×)
          </label>
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.05}
            value={foco.zoom}
            onChange={(e) => setFoco((f) => ({ ...f, zoom: Number(e.target.value) }))}
            className="w-full accent-primary"
          />
          <p className="text-xs text-muted-foreground">
            Arraste a foto para centralizar o rosto. Zoom acima de 1× aproxima; abaixo de 1× afasta (o fundo
            desfocado preenche as bordas).
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setFoco(FOCO_PADRAO)} disabled={salvando}>
            <RotateCcw className="mr-1.5 size-4" />
            Voltar ao padrão
          </Button>
          <Button type="button" size="sm" onClick={() => void salvar()} disabled={salvando || !dataUrl}>
            {salvando && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Salvar enquadramento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
