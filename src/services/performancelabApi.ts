import { supabase } from '@/lib/supabase'

// O sync percorre 90 dias na API do PL e pode levar mais de 1 minuto
const REQUEST_TIMEOUT_MS = 150_000

export interface ResultadoSyncPerformanceLab {
  ok: boolean
  locais: number
  checklists: number
  coletas: number
  eventos: number
  analises: number
  removidos: number
}

/**
 * Dispara o sync do PerformanceLab fora dos horários do cron (botão
 * "Atualizar agora" da página PerformanceLab). A Edge Function só aceita
 * usuário logado com perfil admin/adm; o sync é idempotente.
 */
export async function sincronizarPerformanceLab(): Promise<ResultadoSyncPerformanceLab> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL não configurada')

  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Usuário não autenticado')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-performancelab`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: controller.signal,
    })
    if (!response.ok) {
      const corpo = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(corpo.error || 'Erro ao sincronizar com o PerformanceLab')
    }
    return (await response.json()) as ResultadoSyncPerformanceLab
  } finally {
    clearTimeout(timeoutId)
  }
}
