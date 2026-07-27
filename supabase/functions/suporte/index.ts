// Edge Function: suporte
//
// Recebe mensagens de ajuda/suporte dos usuários autenticados e as envia
// por e-mail à equipe. O endereço de destino e a chave do provedor de
// e-mail ficam somente no backend — nunca no frontend.
//
// Variáveis de ambiente necessárias (secrets do Supabase):
//   - RESEND_API_KEY: chave da API do Resend (https://resend.com)
//
// Endpoint:
//   POST / -> { mensagem: string, pagina?: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'

const EMAIL_DESTINO = 'financeiroplenaserv@gmail.com'
const EMAIL_REMETENTE = 'CORH Suporte <onboarding@resend.dev>'
const MAX_MENSAGEM = 2000

// Controle simples de rate limiting em memória (por usuário)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60_000

function getAllowedOrigins(): string[] {
  const env = Deno.env.get('ALLOWED_ORIGINS')
  if (!env) return []
  return env.split(',').map((o) => o.trim()).filter(Boolean)
}

function isOriginAllowed(origin: string): boolean {
  const allowed = getAllowedOrigins()
  if (allowed.length === 0) return true
  return allowed.includes(origin)
}

function getCorsHeaders(origin: string): Record<string, string> {
  const allowOrigin = isOriginAllowed(origin) ? origin : getAllowedOrigins()[0] || ''
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  }
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || ''
  const cors = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), { status: 405, headers: cors })
  }

  try {
    // 1. Autenticação: valida o JWT do usuário
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: cors })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: userData, error: erroAuth } = await supabase.auth.getUser()
    if (erroAuth || !userData.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers: cors })
    }
    const usuario = userData.user

    if (!checkRateLimit(usuario.id)) {
      return new Response(JSON.stringify({ error: 'Muitas mensagens. Aguarde um minuto.' }), { status: 429, headers: cors })
    }

    // 2. Validação da mensagem
    const corpo = await req.json().catch(() => null)
    const mensagem = typeof corpo?.mensagem === 'string' ? corpo.mensagem.trim() : ''
    const pagina = typeof corpo?.pagina === 'string' ? corpo.pagina.slice(0, 200) : ''

    if (!mensagem) {
      return new Response(JSON.stringify({ error: 'Mensagem vazia' }), { status: 400, headers: cors })
    }
    if (mensagem.length > MAX_MENSAGEM) {
      return new Response(JSON.stringify({ error: `Mensagem excede ${MAX_MENSAGEM} caracteres` }), { status: 400, headers: cors })
    }

    // 3. Envio via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.error('RESEND_API_KEY não configurada')
      return new Response(JSON.stringify({ error: 'Serviço de e-mail não configurado' }), { status: 500, headers: cors })
    }

    const emailUsuario = usuario.email || 'sem e-mail'
    const nomeUsuario = (usuario.user_metadata?.nome as string) || emailUsuario
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

    const respostaResend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_REMETENTE,
        to: [EMAIL_DESTINO],
        reply_to: usuario.email ? [usuario.email] : undefined,
        subject: `[CORH Suporte] Mensagem de ${nomeUsuario}`,
        html: `
          <h2>Nova mensagem de suporte — CORH</h2>
          <p><strong>Usuário:</strong> ${escapeHtml(nomeUsuario)} (${escapeHtml(emailUsuario)})</p>
          <p><strong>Página:</strong> ${escapeHtml(pagina || 'não informada')}</p>
          <p><strong>Data:</strong> ${agora}</p>
          <hr />
          <p style="white-space: pre-wrap;">${escapeHtml(mensagem)}</p>
        `,
      }),
    })

    if (!respostaResend.ok) {
      const detalhe = await respostaResend.text()
      console.error('Falha no Resend:', respostaResend.status, detalhe)
      return new Response(JSON.stringify({ error: 'Falha ao enviar e-mail' }), { status: 502, headers: cors })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors })
  } catch (error) {
    console.error('Erro inesperado:', error)
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: cors })
  }
})
