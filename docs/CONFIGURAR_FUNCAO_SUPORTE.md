# Configurar a Edge Function `suporte` (botão de ajuda)

> Criada em 27/07/2026. O botão de ajuda (ícone de bóia, ao lado do sininho no header) envia as mensagens dos usuários por e-mail para **financeiroplenaserv@gmail.com** — o endereço fica só no backend, nunca aparece no frontend.

## Como funciona

- O dialog `src/components/layout/SuporteDialog.tsx` chama `POST {SUPABASE_URL}/functions/v1/suporte` com o JWT do usuário.
- A função `supabase/functions/suporte/index.ts` valida o JWT, aplica rate limit (5 msg/min por usuário) e envia o e-mail via **Resend** (https://resend.com).
- O e-mail sai de `CORH Suporte <onboarding@resend.dev>` (remetente de teste do Resend, funciona sem verificar domínio) e chega em `financeiroplenaserv@gmail.com`, com `reply_to` no e-mail do usuário (basta responder o e-mail para falar com ele).

## Setup (uma vez só)

1. Criar conta grátis no **Resend** (https://resend.com) — plano free: 100 e-mails/dia.
2. Em **API Keys**, criar uma chave e copiá-la.
3. No dashboard do Supabase (projeto `jmdjdogskvybsdjtmpmb`):
   - **Edge Functions → Secrets** (ou Project Settings → Edge Functions): adicionar o secret `RESEND_API_KEY` com a chave copiada.
4. Deploy da função:
   ```bash
   supabase functions deploy suporte --project-ref jmdjdogskvybsdjtmpmb
   ```

## Teste

1. Fazer login no sistema e clicar no ícone de bóia (ao lado do sininho).
2. Escrever uma mensagem e enviar — deve aparecer o toast "Mensagem enviada".
3. Conferir a caixa de entrada de financeiroplenaserv@gmail.com (verificar spam na 1ª vez).

## Observações

- Sem o `RESEND_API_KEY` configurado, o dialog mostra "Serviço de e-mail não configurado" — o resto do sistema não é afetado.
- Se um dia quiser remetente próprio (ex.: `suporte@plena...`), basta verificar o domínio no Resend e trocar `EMAIL_REMETENTE` na função.
- O CORS usa o mesmo padrão da função `econtador` (secret `ALLOWED_ORIGINS` opcional).
