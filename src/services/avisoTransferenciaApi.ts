import { supabase } from '@/lib/supabase'
import type { AvisoTransferencia } from '@/lib/ocorrencias/avisoTransferencia'

const REQUEST_TIMEOUT_MS = 30000

export async function avisarTransferencia(payload: AvisoTransferencia): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL não configurada')

  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Usuário não autenticado')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/aviso-transferencia`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      const erro = await response.json().catch(() => ({ error: 'Falha ao enviar aviso' }))
      throw new Error(erro.error || 'Falha ao enviar aviso')
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
