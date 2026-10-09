import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { buscarColaboradores, type CandidatoColaborador } from '@/lib/materiais/filas'

interface SeletorColaboradorProps {
  id: string
  candidatos: CandidatoColaborador[]
  onEscolher: (c: { id: string; nome: string }) => void
  placeholder?: string
  /** Rótulo acessível do campo de busca. */
  rotulo: string
}

/**
 * Busca livre entre os colaboradores ativos (ex.: ferista de fora da equipe).
 * Mostra no máximo 8 resultados; escolher limpa o campo.
 */
export function SeletorColaborador({ id, candidatos, onEscolher, placeholder = 'Buscar colaborador…', rotulo }: SeletorColaboradorProps) {
  const [termo, setTermo] = useState('')
  const resultados = useMemo(() => buscarColaboradores(termo, candidatos), [termo, candidatos])

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
      <Input
        id={id}
        aria-label={rotulo}
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
        autoComplete="off"
      />
      {termo.trim().length >= 2 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-sm shadow-md" role="listbox">
          {resultados.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">Ninguém encontrado</li>
          ) : (
            resultados.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left hover:bg-accent/60"
                  onClick={() => {
                    onEscolher({ id: r.id, nome: r.nome })
                    setTermo('')
                  }}
                >
                  {r.nome}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
