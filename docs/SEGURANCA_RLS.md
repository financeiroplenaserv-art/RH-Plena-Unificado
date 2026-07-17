# Segurança — Row Level Security (RLS)

Este documento registra o histórico, as regras e o processo de validação do RLS no projeto RH Plena Unificado.

## Histórico de correções

O projeto passou por múltiplas iterações de controle de acesso no banco:

- **010**: Aplicou RLS aberto (`USING (true)`) em tabelas de negócio.
- **014/034**: Introduziram policies restritas, mas ainda deixaram SELECT aberto (`USING (true)`).
- **037**: Aplicou RBAC granular, mas recriou policies abertas (`Permitir select para autenticados`) em várias tabelas sensíveis.
- **040**: Corrigiu policy aberta deixada pela 037 em `perfis`, `configuracoes`, `auditoria` e `log_auditoria`.
- **041**: Reforçou RLS de `configuracoes`, isolando o token do e-Contador.
- **042**: Limpou policies legadas em tabelas sensíveis.
- **043**: Restringiu `extras`, `recibos_extras` e `ocorrencias`.
- **058**: Consolidação geral do RLS, criando funções auxiliares por módulo (`pode_ver_colaboradores`, `pode_ver_ocorrencias`, `pode_ver_vr`, etc.).
- **059**: Corrige policies conflitantes remanescentes nas tabelas sensíveis, eliminando SELECTs abertos e consolidando múltiplas policies permissivas.

## Por que migration 059 foi necessária?

Apesar da migration 058 ter consolidado grande parte do RLS, a análise automatizada detectou que várias tabelas ainda possuíam policies conflitantes:

- `configuracoes` tinha 5 policies de SELECT (incluindo policies abertas).
- `perfis` tinha 4 policies de SELECT.
- `ocorrencia_anexos`, `ocorrencia_aprovacoes`, `ocorrencia_defesas`, `ocorrencia_testemunhas` ainda herdavam SELECT aberto da 037.
- `projetos_vr`, `resultados_vr`, `recibos_extras`, `contratos_adicionais`, `vinculos_adicionais` e `log_auditoria` ainda tinham policies abertas.

Como o PostgreSQL avalia policies permissivas com `OR`, a coexistência de uma policy aberta (`USING (true)`) com uma policy restrita anula a proteção.

## Regras atuais por tabela

| Tabela | SELECT | INSERT/UPDATE | DELETE |
|--------|--------|---------------|--------|
| `perfis` | Próprio ou admin | Admin | Admin |
| `colaboradores` | `pode_ver_colaboradores()` | `is_rh_ou_admin()` ou `is_editor()` | `is_admin()` |
| `ocorrencias` e relacionadas | `pode_ver_ocorrencias()` | `is_admin()` ou `is_editor()` ou `is_rh_ou_admin()` | `is_admin()` |
| `configuracoes` | Geral exceto token; token só admin/rh | Comum: editor; Token: admin/dp | Admin |
| `auditoria` / `log_auditoria` | Admin ou editor | Admin | Admin |
| `projetos_vr` / `resultados_vr` | `pode_ver_vr()` | Admin ou `pode_ver_vr()` | Admin |
| `recibos_extras` | `pode_ver_extras()` | Admin ou editor | Admin |
| `contratos_adicionais` / `vinculos_adicionais` | `pode_ver_adicionais()` | Admin ou editor | Admin |
| `historico_importacoes_econtador` | Próprio ou admin | Próprio | Admin |

## Funções auxiliares

As funções a seguir devem estar disponíveis no banco (criadas na migration 058 ou anteriores):

- `public.is_admin()`
- `public.is_editor()`
- `public.is_rh_ou_admin()`
- `public.is_admin_ou_dp()`
- `public.pode_ver_colaboradores()`
- `public.pode_ver_ocorrencias()`
- `public.pode_ver_vr()`
- `public.pode_ver_extras()`
- `public.pode_ver_adicionais()`

## Validação automatizada

O script `scripts/validar_rls.py` simula o estado final das migrations e verifica:

1. Se tabelas sensíveis possuem policy SELECT aberto (`USING (true)`).
2. Se tabelas sensíveis possuem múltiplas policies de SELECT (risco de OR anular a proteção).
3. Se tabelas sensíveis estão sem nenhuma policy (alerta de RLS não habilitado).

### Como executar

```bash
python scripts/validar_rls.py
```

O script sai com código `0` se estiver tudo OK, ou `1` se encontrar problemas.

### Teste automatizado

O teste `src/lib/rls.test.ts` executa o validador no pipeline de testes:

```bash
npm run test
```

## Recomendações para novas migrations

- Sempre usar `DROP POLICY IF EXISTS ...` antes de criar uma policy.
- Evite `USING (true)` em tabelas sensíveis.
- Evite deixar múltiplas policies do mesmo comando (SELECT, INSERT, UPDATE, DELETE) na mesma tabela.
- Se precisar de exceções (ex: token e-Contador), prefira uma única policy com `OR` explícito a duas policies separadas.
- Após criar uma migration de RLS, execute `python scripts/validar_rls.py` antes de fazer deploy.

## Quando aplicar a migration 059

A migration 059 deve ser aplicada em todos os ambientes que já estejam na migration 058 ou posterior. Ela não altera schema, apenas remove policies conflitantes e recria policies seguras. Como remove policies antigas e recria novas imediatamente, não há janela de acesso aberto.
