# Testes de fumaça das migrations 146 e 147 (Fase 2 do Materiais)

Rodam SEMPRE dentro de uma transação desfeita (`begin; ... rollback;`) — nada fica no banco.

Montagem (bash), a partir da raiz do projeto:

```bash
M=supabase/migrations; T=scripts/materiais/testes-fase2
{ echo "begin;"; cat $M/146_materiais_estoque.sql $M/147_materiais_compras.sql $T/147_testes.sql; echo "select 'TUDO OK' as resultado;"; echo "rollback;"; } > /tmp/t147.sql
powershell -NoProfile -File scripts/lib/executar-arquivo-sql-management-api.ps1 -Arquivo /tmp/t147.sql
```

- `146_testes.sql` — só precisa da 146.
- `147_testes.sql` e `147_testes_cancelamento_envio.sql` — precisam da 146 e da 147 (arquivos separados porque o 1º consome todas as linhas aprovadas de outubro).
- Resultado esperado: `[{"resultado":"TUDO OK"}]`. Qualquer `FALHOU ...` aborta a transação.
- Os testes usam os ids reais de perfis (gestor, mesa, inspetoria, financeiro, dp1, adm) e os pedidos de outubro/2026; depois de aplicadas as migrations, rodá-los de novo também é seguro (rollback).
