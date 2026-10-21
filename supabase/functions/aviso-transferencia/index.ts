// Edge Function: aviso-transferencia
//
// Envia e-mail para a mesa e o DP (perfis mesa, dp1, dp2) sempre que uma
// carta de transferência é emitida no módulo Ocorrências. O lembrete central
// é o DP atualizar a lotação na Alterdata no mesmo dia — o sync diário do
// e-Contador honra a Alterdata e pode voltar o posto antigo se ela não for
// atualizada.
//
// Variáveis de ambiente necessárias (secrets do Supabase):
//   - RESEND_API_KEY: a mesma da function `suporte` (nenhuma secret nova)
//
// Endpoint:
//   POST / -> AvisoTransferencia (ver src/lib/ocorrencias/avisoTransferencia.ts)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.2'

const EMAIL_REMETENTE = 'CORH <corh@plenafacilities.com.br>'
const PERFIS_DESTINATARIOS = ['mesa', 'dp1', 'dp2']
const PERFIS_EMISSORES = [
  'admin',
  'adm',
  'gestor',
  'rh',
  'dp1',
  'dp2',
  'mesa',
  'inspetoria',
  'financeiro',
]

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

function lerTexto(valor: unknown, teto: number): string {
  return typeof valor === 'string' ? valor.trim().slice(0, teto) : ''
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const clienteUsuario = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: userData, error: erroAuth } = await clienteUsuario.auth.getUser()
    if (erroAuth || !userData.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers: cors })
    }
    const usuario = userData.user

    if (!checkRateLimit(usuario.id)) {
      return new Response(JSON.stringify({ error: 'Muitas requisições. Aguarde um minuto.' }), { status: 429, headers: cors })
    }

    // 2. Perfil do chamador: só quem pode criar ocorrência emite o aviso
    const { data: perfil } = await clienteUsuario
      .from('perfis')
      .select('nivel_acesso')
      .eq('id', usuario.id)
      .single()
    if (!perfil || !PERFIS_EMISSORES.includes(perfil.nivel_acesso)) {
      return new Response(JSON.stringify({ error: 'Sem permissão para emitir aviso de transferência' }), { status: 403, headers: cors })
    }

    // 3. Validação do payload
    const corpo = await req.json().catch(() => null)
    const aviso = {
      colaboradorNome: lerTexto(corpo?.colaboradorNome, 200),
      matricula: lerTexto(corpo?.matricula, 20),
      postoOrigem: lerTexto(corpo?.postoOrigem, 200),
      postoDestino: lerTexto(corpo?.postoDestino, 200),
      dataTransferencia: lerTexto(corpo?.dataTransferencia, 20),
      gravidade: lerTexto(corpo?.gravidade, 20),
      descricao: lerTexto(corpo?.descricao, 4000),
      atualizouCadastro: corpo?.atualizouCadastro === true,
      ocorrenciaId: lerTexto(corpo?.ocorrenciaId, 40),
    }
    if (!aviso.colaboradorNome || !aviso.postoDestino || !aviso.ocorrenciaId) {
      return new Response(JSON.stringify({ error: 'Dados incompletos do aviso' }), { status: 400, headers: cors })
    }

    // 4. Destinatários: e-mails das contas com perfil mesa/dp1/dp2
    const clienteAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: destinatarios, error: erroDestinatarios } = await clienteAdmin
      .from('perfis')
      .select('email')
      .in('nivel_acesso', PERFIS_DESTINATARIOS)
      .not('email', 'is', null)
    if (erroDestinatarios) {
      console.error('Falha ao buscar destinatários:', erroDestinatarios)
      return new Response(JSON.stringify({ error: 'Falha ao buscar destinatários' }), { status: 500, headers: cors })
    }
    const emails = [
      ...new Set(
        (destinatarios || [])
          .map((d) => (d.email || '').trim())
          .filter((email) => email.length > 0)
      ),
    ]
    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, enviados: 0, aviso: 'Sem destinatários com perfil mesa/dp1/dp2' }),
        { status: 200, headers: cors }
      )
    }

    // 5. Envio via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.error('RESEND_API_KEY não configurada')
      return new Response(JSON.stringify({ error: 'Serviço de e-mail não configurado' }), { status: 500, headers: cors })
    }

    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const respostaResend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_REMETENTE,
        to: emails,
        subject: `[CORH] Transferência emitida — ${aviso.colaboradorNome}`,
        html: `
          <h2>Carta de transferência emitida — CORH</h2>
          <p><strong>Colaborador:</strong> ${escapeHtml(aviso.colaboradorNome)}${aviso.matricula ? ` (matrícula ${escapeHtml(aviso.matricula)})` : ''}</p>
          <p><strong>Transferência:</strong> ${escapeHtml(aviso.postoOrigem || 'posto não identificado')} → <strong>${escapeHtml(aviso.postoDestino)}</strong></p>
          <p><strong>Data da transferência:</strong> ${escapeHtml(aviso.dataTransferencia || 'não informada')}</p>
          <p><strong>Gravidade registrada:</strong> ${escapeHtml(aviso.gravidade || 'não informada')}</p>
          <p><strong>Cadastro no CORH atualizado para o novo posto:</strong> ${aviso.atualizouCadastro ? 'Sim' : 'Não'}</p>
          <p><strong>Emitida em:</strong> ${agora} (horário de Brasília)</p>
          <p style="background:#fff3cd;border:1px solid #ffeeba;padding:8px;border-radius:4px;">
            <strong>DP:</strong> atualizar a lotação do(a) colaborador(a) na Alterdata ainda hoje —
            o sync diário do e-Contador honra a Alterdata e pode voltar o posto antigo se ela não for atualizada.
          </p>
          <hr />
          <p style="white-space: pre-wrap;">${escapeHtml(aviso.descricao)}</p>
        `,
      }),
    })

    if (!respostaResend.ok) {
      const detalhe = await respostaResend.text()
      console.error('Falha no Resend:', respostaResend.status, detalhe)
      return new Response(JSON.stringify({ error: 'Falha ao enviar e-mail' }), { status: 502, headers: cors })
    }

    return new Response(JSON.stringify({ ok: true, enviados: emails.length }), { status: 200, headers: cors })
  } catch (error) {
    console.error('Erro inesperado:', error)
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: cors })
  }
})
