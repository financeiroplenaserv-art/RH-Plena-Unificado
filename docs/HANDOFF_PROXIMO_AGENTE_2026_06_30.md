# Handoff para o Próximo Agente — 30/06/2026

> Último agente: Kimi Code CLI  
> Tarefa em andamento: testes manuais gerais do sistema  
> Estado: permissões resetadas e prontas para teste; preview local rodando

---

## ✅ O que foi feito nesta sessão

### 1. Análise e correção do sistema de permissões

- Confirmamos que o sistema usa a tabela `public.permissoes_perfil` (tela `/permissoes`) com fallback em `src/lib/permissoes.ts`.
- O estado anterior estava inconsistente: o perfil `adm` tinha várias permissões `false` no banco e existiam permissões customizadas que não refletiam as regras de negócio.

### 2. Script de reset completo

📄 `scripts/reset_permissoes_padrao.sql`

- Apaga todas as permissões dos perfis padrão e reinsere o seed seguro.
- Inclui permissões das migrations 046, 047 e 048 (ações, menus/rotas e Escalas).
- Corrige regras validadas pela usuária:
  - **RH não acessa e-Contador**.
  - **Inspetoria acessa Extras**.
  - **Escalas é visível para todos os perfis**.

### 3. Trigger de auditoria

📄 `supabase/migrations/053_auditoria_permissoes_perfil.sql`

- Adiciona trigger em `permissoes_perfil` registrando INSERT/UPDATE/DELETE em `log_auditoria`.
- Só registra quando o valor `permitido` realmente muda (evita spam do upsert do frontend).
- Corrige inconsistência de nome de coluna (`acao` → `operacao`) e atualiza a função genérica `auditar_operacao`.

### 4. Função de reset por perfil

📄 `supabase/migrations/054_funcao_reset_permissoes_perfil.sql`

- Cria RPC `reset_permissoes_perfil(p_perfil)` chamada pelo botão da tela `/permissoes`.
- Só pode ser executada por administradores.
- Também inclui as permissões de Escalas e as correções de RH/Inspetoria.

### 5. Botão "Restaurar padrão" na tela `/permissoes`

📄 `src/pages/PermissoesPage.tsx` e `src/hooks/usePermissoes.ts`

- Adiciona botão com modal de confirmação.
- Chama a RPC, recarrega as permissões e registra auditoria.
- Tipagem da RPC adicionada em `src/types/database.ts`.

### 6. Migration de ajuste pontual

📄 `supabase/migrations/055_ajuste_permissoes_rh_inspetoria.sql`

- Aplica as correções de RH/Inspetoria sem precisar rodar o reset completo.

### 7. Diagnóstico e planilha de testes

📄 `scripts/diagnostico_testes.sql`  
📄 `docs/RESULTADO_TESTES_2026_06_30.md`

- Script SQL para verificar usuários de teste e permissões atuais.
- Planilha de testes manuais atualizada considerando a tela `/permissoes`.

---

## 🟡 Estado atual do banco

- Migrations 053, 054 e 055 aplicadas no Supabase.
- Reset de permissões executado com sucesso.
- Permissões estão alinhadas com as regras validadas:
  - `adm`/`admin`: acesso total (`todos`, `menu:todos`, `rota:todos`).
  - `gestor`: cadastros, ocorrências, adicionais, CEU, auditoria, configurações, escalas.
  - `rh`: cadastros, ocorrências, escalas. **Sem e-Contador.**
  - `dp1`/`dp2`: dados mestres, ocorrências, VR, extras, adicionais, escalas.
  - `mesa`: ocorrências, extras, adicionais, CEU, escalas.
  - `inspetoria`: ocorrências, extras, CEU, escalas.
  - `financeiro`: extras, adicionais, empresas/departamentos, escalas.
  - `visualizador`: apenas visualização básica e escalas.

---

## 👥 Usuários de teste

Todos existem e estão com perfis aplicados:

- `teste.adm@plena.local` → `adm`
- `teste.gestor@plena.local` → `gestor`
- `teste.rh@plena.local` → `rh`
- `teste.dp1@plena.local` → `dp1`
- `teste.dp2@plena.local` → `dp2`
- `teste.mesa@plena.local` → `mesa`
- `teste.inspetoria@plena.local` → `inspetoria`
- `teste.financeiro@plena.local` → `financeiro`
- `teste.visualizador@plena.local` → `visualizador`

Senha provável: `Teste@1234`.

> Contas extras sem perfil no banco: `teste.agente.cli@plena.local` e `teste.smoke.1781391300128@plena.local`. São sobras de testes anteriores e podem ser ignoradas.

---

## 🎯 Próximos passos pendentes

1. **Testes manuais por perfil**
   - Acessar http://localhost:4175/login com cada usuário de teste.
   - Validar login, sidebar e acesso às rotas.
   - Usar `docs/RESULTADO_TESTES_2026_06_30.md` para anotar resultados.

2. **Teste da tela `/permissoes`**
   - Verificar se apenas `adm` acessa.
   - Testar marcar/desmarcar permissões.
   - Testar o botão **"Restaurar padrão deste perfil"**.
   - Verificar se a auditoria registra as mudanças.

3. **Testes de funcionalidades críticas**
   - Ocorrências e anexos.
   - VR (projetos, upload, cálculo).
   - Extras (categorias, lançamentos, recibos, pagamento).
   - e-Contador (com perfis permitidos).
   - Permissões de exclusão.

4. **Testes de segurança**
   - Storage e RLS.

---

## 🖥️ Ambiente

- **Preview local**: http://localhost:4175
- **Build**: OK
- **Lint**: OK
- **Testes automatizados**: 60/60 passando

---

## 📁 Arquivos alterados/criados

- `src/hooks/usePermissoes.ts` (adicionado `resetarPerfil`)
- `src/pages/PermissoesPage.tsx` (botão e modal de reset)
- `src/types/database.ts` (tipagem da RPC)
- `scripts/reset_permissoes_padrao.sql` *(novo)*
- `scripts/diagnostico_testes.sql` *(novo)*
- `supabase/migrations/053_auditoria_permissoes_perfil.sql` *(novo)*
- `supabase/migrations/054_funcao_reset_permissoes_perfil.sql` *(novo)*
- `supabase/migrations/055_ajuste_permissoes_rh_inspetoria.sql` *(novo)*
- `docs/RESULTADO_TESTES_2026_06_30.md` *(novo)*
- `docs/HANDOFF_PROXIMO_AGENTE_2026_06_30.md` *(novo)*

---

## ⚠️ Atenções

- Não alterar regras de cálculo de VR/adicionais sem consultar a usuária.
- Regras de negócio validadas estão em `docs/REGRAS_NEGOCIO.md`.
- Sempre rodar `npm run build`, `npm run lint` e `npm test` após alterações.
