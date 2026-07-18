# Aplicar Migration 063 — RLS de empresas e departamentos por perfil

> Data de criação: 2026-07-18
> Objetivo: impedir que perfis sem acesso leiam `empresas` e `departamentos` diretamente pela API.

---

## O que ela faz

- Cria `pode_ver_empresas()` e `pode_ver_departamentos()` (mesmo padrão das funções `pode_ver_colaboradores` etc.).
- Troca o `SELECT` aberto (`USING true`) das duas tabelas pelo uso dessas funções.

Perfis com leitura liberada: `admin`, `adm`, `gestor`, `rh`, `dp1`, `dp2`, `mesa`, `financeiro`, `inspetoria`.
Perfil bloqueado: `visualizador`.

## Por que mesa e inspetoria ficam na lista

Eles leem esses cadastros em telas operacionais (não só nas telas de cadastro):

- **mesa:** filtro de empresa em Ocorrências; seleção de empresa ao emitir recibo de extras; dropdowns de departamento em Escalas, Extras e CEU.
- **inspetoria:** filtro de empresa em Ocorrências; dropdowns de departamento.

Os JOINs do Supabase (embeds como `departamento:departamentos(nome)`) respeitam a RLS da tabela relacionada: tirar um perfil da lista faz listas pararem de exibir o nome do departamento/empresa para ele.

> O bloqueio de acesso às **telas** de cadastro (menu/rota) continua sendo controlado pela tela **Permissões**.

## Passo a passo

1. Acesse `https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb` → **SQL Editor → New query**.
2. Cole o conteúdo de `supabase/migrations/063_rls_empresas_departamentos_por_perfil.sql`.
3. Clique em **Run**.
4. Valide:
   - Login com `teste.mesa`: o sistema continua funcionando (filtros e dropdowns carregam).
   - Login com um usuário `visualizador`: as listas de empresas/departamentos retornam vazio.

## Antes de aplicar

Revise a lista de perfis no arquivo da migration. Para bloquear mais perfis, remova-os do `IN (...)` das duas funções — verificando antes se eles não usam as telas citadas acima.
