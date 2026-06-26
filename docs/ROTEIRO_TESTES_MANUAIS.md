# Roteiro de Testes Manuais — RH Plena Unificado

> Ambiente: preview local
> URL: http://localhost:4177 (ou porta exibida pelo `npm run preview`)
> Última atualização: 2026-06-27

---

## 1. Preparação

### 1.1 Subir o preview local

```bash
cd /c/Projetos/RH-Plena-Unificado
npm run build
npm run preview -- --host
```

Anote a porta exibida (padrão 4173; se ocupada, usará 4174 ou outra).

### 1.2 Criar usuários de teste

1. Acesse http://localhost:4177/login
2. Clique em "Criar conta" / "Primeiro acesso" (se disponível) ou faça sign-up.
3. Crie uma conta para cada email abaixo, usando a **mesma senha** (sugestão: `Teste@1234`):

| Email | Perfil esperado |
|-------|-----------------|
| teste.adm@plena.local | adm |
| teste.gestor@plena.local | gestor |
| teste.rh@plena.local | rh |
| teste.dp1@plena.local | dp1 |
| teste.dp2@plena.local | dp2 |
| teste.mesa@plena.local | mesa |
| teste.inspetoria@plena.local | inspetoria |
| teste.financeiro@plena.local | financeiro |
| teste.visualizador@plena.local | visualizador |

4. Acesse o SQL Editor do Supabase e execute:

```sql
-- Colar o conteúdo de scripts/criar_perfis_teste.sql
```

5. Verifique se os perfis foram criados:

```sql
SELECT p.id, p.nome, p.nivel_acesso, u.email
FROM public.perfis p
JOIN auth.users u ON p.id = u.id
WHERE u.email LIKE 'teste.%@plena.local';
```

---

## 2. Testes por perfil

Para cada perfil, faça login e verifique:

### 2.1 Login e sidebar

- [ ] Login funciona com email/senha corretos.
- [ ] Sidebar exibe apenas os menus permitidos para o perfil.
- [ ] Usuário visualizador não vê menus de cadastro/edição.

### 2.2 Administrador (`adm`)

- [ ] Acessa todas as rotas do sistema.
- [ ] Cria/editar/exclui colaboradores.
- [ ] Cria/editar/excluir empresas e departamentos.
- [ ] Cria/editar ocorrências.
- [ ] Anexa arquivos em ocorrências e consegue visualizar/download.
- [ ] Acessa Configurações e Importar e-Contador.
- [ ] Acessa Auditoria Global.

### 2.3 Gestor (`gestor`)

- [ ] Visualiza colaboradores.
- [ ] Cria/edita ocorrências.
- [ ] Não acessa Configurações nem Importar e-Contador.
- [ ] Não consegue deletar registros protegidos.

### 2.4 RH (`rh`)

- [ ] Visualiza colaboradores.
- [ ] Cria/edita ocorrências.
- [ ] Acessa Importar e-Contador (se liberado no perfil).
- [ ] Não acessa Auditoria Global.

### 2.5 DP1 / DP2 (`dp1`, `dp2`)

- [ ] Acessam módulos de VR e e-Contador conforme permissões.
- [ ] DP2 consegue criar projetos VR e fazer upload de arquivos.
- [ ] Upload de arquivos VR funciona (path `<projeto_id>/<tipo>/<arquivo>`).

### 2.6 Mesa (`mesa`) e Inspetoria (`inspetoria`)

- [ ] Acessam módulo de Extras.
- [ ] Podem lançar extras.
- [ ] Não acessam e-Contador.
- [ ] Não acessam Configurações.

### 2.7 Financeiro (`financeiro`)

- [ ] Acessa módulo de Extras / Recibos.
- [ ] Consegue marcar extras como pagos (com recibo assinado).

### 2.8 Visualizador (`visualizador`)

- [ ] Consegue fazer login.
- [ ] Visualiza apenas telas de leitura.
- [ ] Não vê botões de criar/editar/excluir.
- [ ] Não acessa Configurações, Auditoria, e-Contador.

---

## 3. Testes de funcionalidades críticas

### 3.1 Ocorrências e anexos

- [ ] Criar uma ocorrência com documento obrigatório.
- [ ] Anexar PDF, imagem, áudio e vídeo.
- [ ] Visualizar o anexo na tela de detalhes.
- [ ] Fazer download do anexo.
- [ ] Verificar que a URL de download é assinada (deve conter `token=` na query string).

### 3.2 VR (Vale Refeição)

- [ ] Criar um projeto VR.
- [ ] Fazer upload de PDF anterior, PDF atual, escala e base.
- [ ] Calcular resultados.
- [ ] Salvar resultados.

### 3.3 Extras

- [ ] Criar uma categoria de extra.
- [ ] Lançar um extra para um colaborador.
- [ ] Criar um recibo e assinar.
- [ ] Marcar o extra como pago.

### 3.4 e-Contador

- [ ] Acessar Importar e-Contador com perfil permitido.
- [ ] Salvar token (se houver um token de teste).
- [ ] Listar empresas/filiais.
- [ ] Importar colaboradores selecionados.

### 3.5 Permissões de exclusão

- [ ] Usuário não-admin tenta excluir um colaborador → deve ser bloqueado.
- [ ] Usuário não-admin tenta excluir uma ocorrência → deve ser bloqueado.
- [ ] Administrador consegue excluir (se a funcionalidade existir na UI).

---

## 4. Testes de segurança

### 4.1 Storage

- [ ] Tentar acessar URL de anexo sem estar logado → deve retornar 400/403.
- [ ] Tentar acessar URL de anexo de outra ocorrização com usuário sem permissão → deve falhar.
- [ ] Tentar fazer upload para path de ocorrência inexistente → deve falhar.

### 4.2 RLS

- [ ] Usuário visualizador não consegue ver tabela `perfis` (via API direta).
- [ ] Usuário não-admin não consegue ler `econtador_token` em `configuracoes`.

---

## 5. Coleta de resultados

Anote qualquer erro, tela em branco, mensagem estranha ou comportamento inesperado.

Informações úteis para reportar:
- Perfil usado
- Rota/tela
- Passo a passo para reproduzir
- Mensagem de erro (print ou texto)
- Console do navegador (F12 → Console)

---

## 6. Pós-testes

Após concluir, execute novamente:

```bash
npm run lint
npm test -- --run
npm run build
```

E atualize este arquivo marcando os itens testados.
