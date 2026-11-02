# VT — Como criar a chave do Google Cloud (Routes API)

> Passo a passo para a gestora/ti (02/11/2026). Tempo estimado: 10 minutos.
> A chave é **paga por uso, mas com franquia gratuita mensal** que cobre o
> nosso volume (~250 trajetos na 1ª rodada, depois só trajetos novos) — o
> custo esperado é **R$ 0**. Mesmo assim o Google exige cartão cadastrado.
> O passo 6 coloca um **alerta de US$ 1** para qualquer gasto inesperado.

## Passos

1. Acesse <https://console.cloud.google.com> e entre com a conta Google da
   empresa (sugestão: a mesma conta de e-mail do financeiro/TI).
2. Crie um projeto: no topo, seletor de projeto → **"Novo projeto"** → nome:
   `corh-vt` → Criar.
3. Ative o faturamento: menu ☰ → **Faturamento** → **"Vincular conta de
   faturamento"** → criar conta (CNPJ + cartão). O Google faz uma cobrança de
   verificação de R$ 0–1 que estorna.
4. Ative a API: menu ☰ → **APIs e serviços** → **Biblioteca** → pesquise
   **"Routes API"** → clique → **Ativar**.
5. Crie a chave: menu ☰ → **APIs e serviços** → **Credenciais** →
   **"+ Criar credenciais"** → **"Chave de API"**. Copie a chave.
6. **Restrinja a chave (obrigatório)**: na lista de credenciais, clique na
   chave → em "Restrições de API" marque **"Restringir chave"** → selecione
   só **Routes API** → Salvar. (Assim, se a chave vazar, não serve para
   outros serviços pagos.)
7. **Alerta de gasto**: menu ☰ → Faturamento → **Orçamentos e alertas** →
   "Criar orçamento" → valor US$ 1 → alertas em 50%, 90%, 100% → e-mail da
   gestora.
8. Me envie a chave (por aqui mesmo, eu gravo como secret do Supabase e no
   `.env` local — **nunca** no código nem no frontend).

## Depois da chave

- Eu rodo a POC: `npx tsx --tsconfig tsconfig.scripts.json scripts/vt/poc-rotas-api.ts`
  sobre uma amostra de trajetos conhecidos (Joyce, Adalto, Marco Antônio,
  Thiago...) e comparo o bilhete sugerido com o cadastrado.
- Se a POC confirmar a cobertura boa na nossa região, a roteirização entra na
  aba Trajetos (Edge Function `vt-rota`, chave em secret — nunca no frontend).

## O que o Google vê (LGPD)

Só os **endereços** (origem e destino). Nunca nome, CPF ou matrícula — a
chamada é servidor→Google sem dados pessoais identificáveis além do endereço,
que é dado necessário à finalidade (cálculo do VT) e já autorizado no
consentimento LGPD do sistema.
