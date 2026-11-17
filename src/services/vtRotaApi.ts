import { supabase } from '@/lib/supabase'
import type { RespostaGoogleRoutes } from '@/lib/vt/googleRoutes'

const REQUEST_TIMEOUT_MS = 45_000

export interface EntradaSugestaoRotas {
  origin: string
  destination: string
  departureTime: string
}

export async function sugerirRotasGoogle(entrada: EntradaSugestaoRotas): Promise<RespostaGoogleRoutes> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL não configurada')

  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Usuário não autenticado')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/vt-rota`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entrada),
      signal: controller.signal,
    })
    if (!response.ok) {
      const corpo = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
      throw new Error(corpo.error || corpo.message || 'Não foi possível consultar o Google Routes')
    }
    return (await response.json()) as RespostaGoogleRoutes
  } finally {
    clearTimeout(timeoutId)
  }
}
