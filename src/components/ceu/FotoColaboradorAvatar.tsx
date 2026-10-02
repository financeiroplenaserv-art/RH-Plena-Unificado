import { useState } from 'react'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FotoColaboradorAvatarProps {
  /** URL assinada já resolvida (ver useFotosColaboradores); vazio = iniciais. */
  url?: string | null
  iniciais: string
  className?: string
}

/** Avatar redondo: foto quando houver (e carregar), senão iniciais. Se a imagem falhar, volta às iniciais. */
export function FotoColaboradorAvatar({ url, iniciais, className }: FotoColaboradorAvatarProps) {
  const [falhou, setFalhou] = useState<string | null>(null)
  const mostrar = url && falhou !== url
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground',
        className,
      )}
    >
      {mostrar ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFalhou(url)}
        />
      ) : iniciais && iniciais !== '—' ? (
        <span>{iniciais}</span>
      ) : (
        <User className="size-4" />
      )}
    </div>
  )
}
