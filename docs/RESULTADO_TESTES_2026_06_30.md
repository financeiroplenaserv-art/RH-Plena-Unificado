# Resultado dos Testes Manuais — 2026-06-30

> Ambiente: preview local  
> URL: http://localhost:4173  
> Responsável: ___________________  

---

## 1. Preparação do ambiente

- [x] Build de produção executado com sucesso (`npm run build`)
- [x] Preview local iniciado em http://localhost:4173
- [x] Lint sem erros (`npm run lint`)
- [x] Testes automatizados: 60/60 passando

### Verificação do estado atual

Execute o script `scripts/diagnostico_testes.sql` no SQL Editor do Supabase. Ele mostrará:

1. Se os usuários de teste existem e quais perfis estão vinculados.
2. Quantas permissões estão cadastradas na tabela `permissoes_perfil` por perfil.
3. Quais menus/rotas cada perfil pode ver.
4. Quais ações críticas cada perfil pode executar.

> **Importante:** as permissões agora são controladas pela tela `/permissoes`. Os testes abaixo devem ser validados contra o que está configurado nessa tela, não apenas contra o perfil nominal. O seed padrão está em `supabase/migrations/046_tabela_permissoes_perfil.sql` e `047_permissoes_rotas_menus.sql`.

### Como restaurar o padrão seguro

Se as permissões estiverem inconsistentes, você tem duas opções:

1. **Pela tela `/permissoes`:** selecione o perfil e clique em **"Restaurar padrão deste perfil"**. As permissões voltam ao padrão imediatamente e a ação é registrada na auditoria.
2. **Pelos scripts SQL:**
   - `scripts/reset_permissoes_padrao.sql` — restaura **todos** os perfis.
   - `supabase/migrations/054_funcao_reset_permissoes_perfil.sql` — cria a função usada pelo botão da tela.

### Auditoria de permissões

Toda alteração na tabela `permissoes_perfil` é registrada em `log_auditoria`, incluindo:
- quem alterou (`usuario_id`)
- qual permissão mudou
- valor anterior e novo
- data/hora

Reset de perfil também gera um registro de auditoria com a operação `CANCEL`.

### Contas de teste

| Email | Perfil | Senha | Conta criada? | Perfil aplicado? |
|-------|--------|-------|---------------|------------------|
| teste.adm@plena.local | adm | Teste@1234 | [ ] | [ ] |
| teste.gestor@plena.local | gestor | Teste@1234 | [ ] | [ ] |
| teste.rh@plena.local | rh | Teste@1234 | [ ] | [ ] |
| teste.dp1@plena.local | dp1 | Teste@1234 | [ ] | [ ] |
| teste.dp2@plena.local | dp2 | Teste@1234 | [ ] | [ ] |
| teste.mesa@plena.local | mesa | Teste@1234 | [ ] | [ ] |
| teste.inspetoria@plena.local | inspetoria | Teste@1234 | [ ] | [ ] |
| teste.financeiro@plena.local | financeiro | Teste@1234 | [ ] | [ ] |
| teste.visualizador@plena.local | visualizador | Teste@1234 | [ ] | [ ] |

> Script SQL para aplicar perfis (caso ainda não existam): `scripts/criar_perfis_teste.sql`

---

## 2. Testes por perfil

> **Regra atual:** o sistema usa a tabela `permissoes_perfil` como prioridade. Se uma permissão não estiver lá, usa o fallback de `src/lib/permissoes.ts`. O perfil `adm`/`admin` sempre tem acesso total.  
> Antes de testar, verifique em `/permissoes` o que está marcado para cada perfil.

### 2.1 Login e sidebar (todos os perfis)

| Perfil | Login OK? | Sidebar correta? | Menu inesperado? | Obs. |
|--------|-----------|------------------|------------------|------|
| adm | [ ] | [ ] | [ ] | |
| gestor | [ ] | [ ] | [ ] | |
| rh | [ ] | [ ] | [ ] | |
| dp1 | [ ] | [ ] | [ ] | |
| dp2 | [ ] | [ ] | [ ] | |
| mesa | [ ] | [ ] | [ ] | |
| inspetoria | [ ] | [ ] | [ ] | |
| financeiro | [ ] | [ ] | [ ] | |
| visualizador | [ ] | [ ] | [ ] | |

### 2.2 Administrador (`adm`)

- [ ] Acessa todas as rotas do sistema.
- [ ] Cria/editar/exclui colaboradores.
- [ ] Cria/editar/excluir empresas e departamentos.
- [ ] Cria/editar ocorrências.
- [ ] Anexa arquivos em ocorrências e consegue visualizar/download.
- [ ] Acessa Configurações e Importar e-Contador.
- [ ] Acessa Auditoria Global.
- [ ] Acessa a tela `/permissoes` e consegue alterar permissões.

**Observações:**

### 2.3 Gestor (`gestor`)

> Configuração esperada no `/permissoes`: pode ver colaboradores, empresas, departamentos, ocorrências, adicionais, configurações, auditoria. Não deve ter acesso a e-Contador, VR, Extras, CEU (ver seed padrão).

- [ ] Visualiza colaboradores.
- [ ] Cria/edita ocorrências.
- [ ] Não acessa Configurações nem Importar e-Contador (a menos que esteja marcado).
- [ ] Não consegue deletar registros protegidos.

**Observações:**

### 2.4 RH (`rh`)

> Configuração esperada: pode gerenciar colaboradores, departamentos, ocorrências e e-Contador. Não deve acessar VR, Extras, CEU, Auditoria, Configurações (ver seed padrão).

- [ ] Visualiza colaboradores.
- [ ] Cria/edita ocorrências.
- [ ] Acessa Importar e-Contador (se liberado no `/permissoes`).
- [ ] Não acessa Auditoria Global.

**Observações:**

### 2.5 DP1 / DP2 (`dp1`, `dp2`)

> Configuração esperada: DP1 vê/gerencia dados mestres, alertas, ocorrências, VR (visualizar), recibos de extras. DP2 tem acesso gerencial a VR, adicionais, configurações/token.

- [ ] Acessam módulos de VR e e-Contador conforme permissões.
- [ ] DP2 consegue criar projetos VR e fazer upload de arquivos.
- [ ] Upload de arquivos VR funciona (path `<projeto_id>/<tipo>/<arquivo>`).

**Observações:**

### 2.6 Mesa (`mesa`) e Inspetoria (`inspetoria`)

> Configuração esperada: acessam ocorrências e extras. Mesa também acessa adicionais e CEU. Inspetoria tem acesso mais restrito.

- [ ] Acessam módulo de Extras.
- [ ] Podem lançar extras.
- [ ] Não acessam e-Contador.
- [ ] Não acessam Configurações.

**Observações:**

### 2.7 Financeiro (`financeiro`)

> Configuração esperada: acessa extras (marcar pago, recibos, relatórios), adicionais, empresas/departamentos.

- [ ] Acessa módulo de Extras / Recibos.
- [ ] Consegue marcar extras como pagos (com recibo assinado).

**Observações:**

### 2.8 Visualizador (`visualizador`)

> Configuração esperada: apenas dashboard, colaboradores, empresas, departamentos e balanço de extras (somente leitura).

- [ ] Consegue fazer login.
- [ ] Visualiza apenas telas de leitura.
- [ ] Não vê botões de criar/editar/excluir.
- [ ] Não acessa Configurações, Auditoria, e-Contador.

**Observações:**

---

## 3. Testes da tela de permissões (`/permissoes`)

- [ ] Apenas `adm`/`admin` acessa a tela.
- [ ] Carrega as permissões do perfil selecionado.
- [ ] Marcar/desmarcar uma permissão salva imediatamente.
- [ ] Ao desmarcar um menu/rota para um perfil, o sidebar atualiza após novo login.
- [ ] Ao desmarcar uma ação para um perfil, os botões correspondentes somem da UI.
- [ ] Alterações na tela `/permissoes` refletem no `ProtectedRoute`.
- [ ] Botão **"Restaurar padrão deste perfil"** abre confirmação.
- [ ] Confirmar o reset restaura as permissões do perfil selecionado.
- [ ] Após o reset, a tela recarrega as permissões atualizadas.
- [ ] O reset gera registro em `log_auditoria`.

**Observações:**

---

## 4. Testes de funcionalidades críticas

### 4.1 Ocorrências e anexos

- [ ] Criar uma ocorrência com documento obrigatório.
- [ ] Anexar PDF, imagem, áudio e vídeo.
- [ ] Visualizar o anexo na tela de detalhes.
- [ ] Fazer download do anexo.
- [ ] Verificar que a URL de download é assinada (deve conter `token=` na query string).

**Observações:**

### 4.2 VR (Vale Refeição)

- [ ] Criar um projeto VR.
- [ ] Fazer upload de PDF anterior, PDF atual, escala e base.
- [ ] Calcular resultados.
- [ ] Salvar resultados.

**Observações:**

### 4.3 Extras

- [ ] Criar uma categoria de extra.
- [ ] Lançar um extra para um colaborador.
- [ ] Criar um recibo e assinar.
- [ ] Marcar o extra como pago.

**Observações:**

### 4.4 e-Contador

- [ ] Acessar Importar e-Contador com perfil permitido.
- [ ] Salvar token (se houver um token de teste).
- [ ] Listar empresas/filiais.
- [ ] Importar colaboradores selecionados.

**Observações:**

### 4.5 Permissões de exclusão

- [ ] Usuário não-admin tenta excluir um colaborador → deve ser bloqueado.
- [ ] Usuário não-admin tenta excluir uma ocorrência → deve ser bloqueado.
- [ ] Administrador consegue excluir (se a funcionalidade existir na UI).

**Observações:**

---

## 5. Testes de segurança

### 5.1 Storage

- [ ] Tentar acessar URL de anexo sem estar logado → deve retornar 400/403.
- [ ] Tentar acessar URL de anexo de outra ocorrização com usuário sem permissão → deve falhar.
- [ ] Tentar fazer upload para path de ocorrência inexistente → deve falhar.

**Observações:**

### 5.2 RLS

- [ ] Usuário visualizador não consegue ver tabela `perfis` (via API direta).
- [ ] Usuário não-admin não consegue ler `econtador_token` em `configuracoes`.

**Observações:**

---

## 6. Problemas encontrados

| # | Perfil | Tela/Rota | Passos para reproduzir | Erro/comportamento | Gravidade |
|---|--------|-----------|------------------------|--------------------|-----------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

---

## 7. Resumo

- **Build:** OK
- **Lint:** OK
- **Testes automatizados:** 60/60 OK
- **Preview:** http://localhost:4173
- **Bloqueadores encontrados:**
- **Ajustes necessários nas permissões (`/permissoes`):**
- **Próximos passos:**
