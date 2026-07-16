# Registro — Importação de Ocorrências da Planilha Eliane

**Data:** 16/07/2026  
**Agente:** Kimi Code CLI  
**Arquivo fonte:** `public/ELIANE_OCO_Funcionarios_160726 occ rh tratada_final.xlsx`  
**Script:** `scripts/importar-ocorrencias-eliane.py`  

---

## Resumo

Importadas **869 ocorrências** da planilha Eliane para o módulo de Ocorrências do CORH.

| Métrica | Valor |
|---|---|
| Total na planilha | 869 |
| Identificados (match por nome) | 402 |
| Não identificados (placeholder) | 467 |
| Múltiplos matches | 0 |
| Inconsistências Macro/Tipo | 0 |

**Total de ocorrências no banco após importação:** 1.842  
**Ocorrências no placeholder após importação:** 971

---

## Como foi feito

1. O script lê a aba `Plan1` da planilha Excel.
2. Para cada linha, associa o colaborador pelo nome completo (`Funcionário`) com os colaboradores cadastrados no banco.
3. Colaboradores não encontrados são vinculados ao placeholder `OCORRENCIAS HISTORICAS - NAO IDENTIFICADO` (matrícula `999999`).
4. A coluna `Matrícula` da planilha foi **ignorada** neste momento, conforme orientação do usuário.
5. O número da ocorrência foi preservado no `titulo` (ex: `[75274] Elogio do síndico por bom serviço`) e na `descricao`.
6. O nome original do colaborador na planilha foi preservado no campo `colaborador_nome`.
7. Macro e Tipo foram mapeados para os valores padronizados do sistema (`1. Jornada e Ponto`, `2. Conduta e Disciplina`, etc.).
8. Gravidade e base legal foram atribuídos com base em `docs/ocorrencias-grupos-tipos.md`.
9. A coluna `Data` foi usada tanto para `data_ocorrencia` quanto para `data_hora_ocorrido`.
10. Foi feito um double-check de consistência entre Macro e Tipo: nenhuma inconsistência foi encontrada.
11. O status de todas as ocorrências importadas foi `Ativa`.

---

## Execução

```bash
# Dry-run (validação)
.venv-pwa/Scripts/python scripts/importar-ocorrencias-eliane.py

# Importação real
.venv-pwa/Scripts/python scripts/importar-ocorrencias-eliane.py --real
```

---

## Arquivos relacionados

- `scripts/importar-ocorrencias-eliane.py`
- `docs/CONTINUAR_AQUI.md`
- `docs/HANDOFF_PROXIMO_AGENTE_2026_07_16.md`
- `docs/ocorrencias-grupos-tipos.md`

---

## Próximos passos sugeridos

1. Reassociar ocorrências do placeholder quando houver revisão manual.
2. Verificar no sistema se a busca e os detalhes das novas ocorrências estão funcionando corretamente.
3. Testar filtros por macro grupo e tipo com os novos registros.
