import { toast } from 'sonner'

export const URL_CONSULTA_RIOCARD = 'https://www.cartaoriocard.com.br/vt2/visitante/consultas/consultacpf.jsp'

/** Só dígitos; null quando não sobra nada para copiar. */
export function cpfSoDigitos(cpf: string | null | undefined): string | null {
  const digitos = (cpf ?? '').replace(/\D/g, '')
  return digitos ? digitos : null
}

export async function copiarCpf(cpf: string | null | undefined): Promise<boolean> {
  const digitos = cpfSoDigitos(cpf)
  if (!digitos) {
    toast.error('Este colaborador não tem CPF cadastrado.')
    return false
  }
  try {
    await navigator.clipboard.writeText(digitos)
    toast.success('CPF copiado. Cole na consulta da Riocard.')
    return true
  } catch {
    toast.error('Não foi possível copiar o CPF.')
    return false
  }
}
