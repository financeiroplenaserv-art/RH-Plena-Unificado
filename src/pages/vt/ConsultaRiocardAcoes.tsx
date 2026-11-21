import { Copy, ExternalLink } from 'lucide-react'
import { copiarCpf, URL_CONSULTA_RIOCARD } from '@/lib/vt/riocardConsulta'

/**
 * Atalhos para consultar o Bilhete Único na Riocard (decisão da gestora,
 * 21/11/2026). O site tem reCAPTCHA, então NADA é automatizado: o botão só abre
 * a página de consulta e o "Copiar CPF" leva os 11 dígitos para colar lá. O CPF
 * nunca vai na URL. Só renderizar para quem tem `colaborador.ver_cpf_completo`.
 */
export function ConsultaRiocardAcoes({ cpf, nome }: { cpf: string | null | undefined; nome: string }) {
  const classe =
    'inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-primary hover:bg-accent'
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5">
      <a
        href={URL_CONSULTA_RIOCARD}
        target="_blank"
        rel="noopener noreferrer"
        className={classe}
        aria-label={`Consultar na Riocard — ${nome}`}
      >
        <ExternalLink className="size-3" />
        Consultar na Riocard
      </a>
      <button
        type="button"
        className={classe}
        aria-label={`Copiar CPF — ${nome}`}
        onClick={() => void copiarCpf(cpf)}
      >
        <Copy className="size-3" />
        Copiar CPF
      </button>
    </span>
  )
}
