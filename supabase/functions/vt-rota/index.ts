// Edge Function: vt-rota
// Sugere alternativas de itinerário pela Google Routes API, sem expor a chave
// no frontend e sem gravar trajetos, colaboradores ou cargas.
//
// Secret necessária: GOOGLE_MAPS_API_KEY
// Deploy futuro, somente após validação: VerifyJwt true.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'

const PERFIS_REVISAO = ['admin', 'adm', 'gestor', 'mesa', 'dp1', 'dp2']
const RATE_LIMIT_MAX = 12
const RATE_LIMIT_WINDOW_MS = 60_000
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function origensPermitidas(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean)
}

function corsHeaders(origem: string): Record<string, string> {
  const permitidas = origensPermitidas()
  const permitida = permitidas.length === 0 || permitidas.includes(origem)
  return {
    'Access-Control-Allow-Origin': permitida ? origem : (permitidas[0] ?? ''),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  }
}

function dentroDoLimite(usuarioId: string): boolean {
  const agora = Date.now()
  const atual = rateLimitMap.get(usuarioId)
  if (!atual || agora > atual.resetAt) {
    rateLimitMap.set(usuarioId, { count: 1, resetAt: agora + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (atual.count >= RATE_LIMIT_MAX) return false
  atual.count++
  return true
}

function texto(valor: unknown, maximo: number): string {
  return typeof valor === 'string' ? valor.trim().slice(0, maximo) : ''
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? ''
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método não permitido' }, { status: 405, headers: cors })
  }

  try {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return Response.json({ error: 'Não autenticado' }, { status: 401, headers: cors })

    const clienteUsuario = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: userData, error: erroAuth } = await clienteUsuario.auth.getUser()
    if (erroAuth || !userData.user) {
      return Response.json({ error: 'Sessão inválida' }, { status: 401, headers: cors })
    }

    const { data: perfil } = await clienteUsuario
      .from('perfis')
      .select('nivel_acesso')
      .eq('id', userData.user.id)
      .single()
    if (!perfil || !PERFIS_REVISAO.includes(perfil.nivel_acesso)) {
      return Response.json({ error: 'Sem permissão para revisar itinerários' }, { status: 403, headers: cors })
    }
    if (!dentroDoLimite(userData.user.id)) {
      return Response.json({ error: 'Muitas consultas. Aguarde um minuto.' }, { status: 429, headers: cors })
    }

    const corpo = await req.json().catch(() => null)
    const origem = texto(corpo?.origin, 500)
    const destino = texto(corpo?.destination, 500)
    const partida = texto(corpo?.departureTime, 40)
    if (!origem || !destino || !partida || !Number.isFinite(Date.parse(partida))) {
      return Response.json(
        { error: 'Informe origin, destination e departureTime (ISO) válidos.' },
        { status: 400, headers: cors },
      )
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!apiKey) {
      return Response.json({ error: 'Integração com o Google Routes ainda não configurada.' }, { status: 503, headers: cors })
    }

    const resposta = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.legs.steps.travelMode,routes.legs.steps.transitDetails,routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { address: origem },
        destination: { address: destino },
        travelMode: 'TRANSIT',
        departureTime: new Date(partida).toISOString(),
        computeAlternativeRoutes: true,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!resposta.ok) {
      return Response.json(
        { error: `Não foi possível consultar o Google Routes (HTTP ${resposta.status}).` },
        { status: 502, headers: cors },
      )
    }

    const dados = await resposta.json()
    return Response.json(dados, { headers: cors })
  } catch {
    return Response.json({ error: 'Erro inesperado ao consultar o itinerário.' }, { status: 500, headers: cors })
  }
})
