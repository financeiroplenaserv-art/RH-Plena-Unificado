import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { limparCacheFotos } from '@/lib/colaboradorFotos'
import { reduzirImagem } from '@/lib/ceu/crachasImagem'
import {
  carregarFotoDataUrl,
  enviarFotoColaborador,
  removerFotoColaborador,
} from '@/lib/ceu/crachasDados'

interface FotoColaboradorFieldProps {
  colaboradorId: string
  fotoPath: string | null
  onChange?: (fotoPath: string | null) => void
  /** Só exibe a foto (perfis que veem o cadastro mas não emitem crachás). */
  somenteLeitura?: boolean
}

/**
 * Foto 3x4 do cadastro (bucket privado colaborador-fotos, URL assinada).
 * Reduz no cliente (máx. 600 px, JPEG 0.85) antes de enviar e grava o caminho
 * via RPC salvar_dados_cracha. Usado na ficha do colaborador.
 */
export function FotoColaboradorField({ colaboradorId, fotoPath, onChange, somenteLeitura = false }: FotoColaboradorFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true
    if (!fotoPath) {
      setUrl(null)
      return
    }
    carregarFotoDataUrl(fotoPath).then((dataUrl) => {
      if (ativo) setUrl(dataUrl)
    })
    return () => {
      ativo = false
    }
  }, [fotoPath])

  const enviar = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setEnviando(true)
    try {
      const dataUrl = await reduzirImagem(arquivo, false)
      const path = await enviarFotoColaborador(colaboradorId, dataUrl)
      limparCacheFotos()
      setUrl(dataUrl)
      onChange?.(path)
      toast.success('Foto salva no cadastro')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar a foto')
    } finally {
      setEnviando(false)
    }
  }

  const remover = async () => {
    setEnviando(true)
    try {
      await removerFotoColaborador(colaboradorId)
      limparCacheFotos()
      setUrl(null)
      onChange?.(null)
      toast.success('Foto removida do cadastro')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover a foto')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
        {url ? (
          <img src={url} alt="Foto do colaborador" className="size-full object-cover" />
        ) : (
          <User className="size-5 text-muted-foreground" />
        )}
      </div>
      {!somenteLeitura && (
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void enviar(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={enviando} onClick={() => inputRef.current?.click()}>
          <Camera className="mr-1.5 size-4" />
          {fotoPath ? 'Trocar foto' : 'Enviar foto'}
        </Button>
        {fotoPath && (
          <Button type="button" variant="ghost" size="sm" disabled={enviando} onClick={() => void remover()}>
            <Trash2 className="mr-1.5 size-4" />
            Remover
          </Button>
        )}
      </div>
      )}
    </div>
  )
}
