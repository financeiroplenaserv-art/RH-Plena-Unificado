# Aplicar Migrations 066, 067 e 068 — Leva 3 (integridade e LGPD)

> Data de criação: 2026-07-18
> Aplicar na ordem: 066 → 067 → 068. Cada uma em uma query separada no SQL Editor.

---

## Migration 066 — Auditoria nas tabelas operacionais

Adiciona triggers de auditoria (`log_auditoria`) em: `departamentos`, `empresas`, `itens`, `fornecedores`, `entregas`, `contratos_adicionais`, `vinculos_adicionais`, `calendario_adicionais`.

Arquivo: `supabase/migrations/066_auditoria_tabelas_operacionais.sql`

Validação: altere um departamento e confira o registro em `select * from log_auditoria order by created_at desc limit 5;`.

## Migration 067 — RPCs transacionais (VR e recibos)

Cria 3 funções:

- `salvar_resultados_vr_lote` — delete + insert de resultados VR em transação única (sem risco de perder tudo se o insert falhar).
- `assinar_recibo_extras` — assina o recibo e marca os extras como Pago na mesma transação.
- `cancelar_recibo_extras` — cancela o recibo e reverte os extras para Pendente (em vez de apagar).

Arquivo: `supabase/migrations/067_rpcs_transacionais_vr_recibos.sql`

Validação: emitir e assinar um recibo de extras e confirmar que os extras ficam `Pago`; cancelar e confirmar que voltam para `Pendente`.

## Migration 068 — Consentimento LGPD com prova

- Tabela `consentimentos_lgpd` (append-only, prova imutável com timestamp do servidor; SELECT só admin).
- RPC `registrar_consentimento_lgpd` — valida a versão do termo ativo no servidor, grava o consentimento e a prova numa transação.
- Trigger que impede setar `consentimento_lgpd = true` fora do fluxo da RPC.

Arquivo: `supabase/migrations/068_consentimento_lgpd_rpc.sql`

Validação:
1. Entre com um usuário novo (ou limpe o consentimento de um usuário de teste: `update perfis set consentimento_lgpd = false where ...`) e aceite o termo — deve funcionar.
2. No SQL, `select * from consentimentos_lgpd order by created_at desc limit 3;` deve mostrar a prova.
3. Tentativa de bypass deve falhar:
   ```sql
   -- logado como usuário comum, deve dar erro "Consentimento deve ser registrado pelo fluxo próprio"
   update public.perfis set consentimento_lgpd = true where id = auth.uid();
   ```

## Atenção

- A migration 068 muda o fluxo de consentimento: se algum usuário estiver no meio do primeiro acesso durante a aplicação, peça para recarregar a página.
- Se o termo LGPD for atualizado (nova versão em `termos_lgpd`), usuários já consentidos não precisam re-consentir automaticamente — novos consentimentos usarão a nova versão.
