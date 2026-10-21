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
- `151_testes.sql` — precisa da 151 (já aplicada em produção).
- `152_testes.sql` — múltiplo de compra: monte com a 152 duas vezes (testa a idempotência) e os testes:
  `{ echo "begin;"; cat $M/152_materiais_multiplo_compra.sql $M/152_materiais_multiplo_compra.sql $T/152_testes.sql; echo "select 'TUDO OK' as resultado;"; echo "rollback;"; } > /tmp/t152.sql`
  (usa 2 pedidos de outubro em `em_validacao`; o gestor os aprova dentro da transação).
- `154_testes.sql` — depósito Plena (rota 0, snapshot do fornecedor, chegada no depósito, separação por inspetoria): monte com a 154 duas vezes e os testes (mesmo molde da 152). Usa 1 pedido de outubro em `em_validacao`, um fornecedor "Compra Avulsa" e um "Antolimp", e os perfis de inspetoria e financeiro por consulta.
- Resultado esperado: `[{"resultado":"TUDO OK"}]`. Qualquer `FALHOU ...` aborta a transação.
- Os testes usam os ids reais de perfis (gestor, mesa, inspetoria, financeiro, dp1, adm) e os pedidos de outubro/2026; depois de aplicadas as migrations, rodá-los de novo também é seguro (rollback).
