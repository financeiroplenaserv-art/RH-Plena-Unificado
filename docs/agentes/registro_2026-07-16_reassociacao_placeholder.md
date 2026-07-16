# Registro de Alterações — Reassociação de Ocorrências do Placeholder (16/07/2026)

## Contexto

Após gerar a planilha de revisão dos 496 nomes não identificados (`dados-locais/revisao_496_nomes.xlsx`), o usuário solicitou a reassociação automática das ocorrências do placeholder que possuem match **exato** ou **alto-token** no cadastro de colaboradores.

## Script utilizado

`scripts/reassociar-placeholder-exato-token.py`

## Resultado

- **Ocorrências analisadas no placeholder:** 505
- **Ocorrências com match exato:** 0 (todos os matches exatos já haviam sido identificados na importação anterior)
- **Ocorrências com match alto-token:** 1
- **Ocorrências reassociadas:** 1

### Reassociação realizada

| Nome na planilha | Colaborador vinculado | Matrícula | Status | Método |
|---|---|---|---|---|
| PAULO JOSE DA SILVA | JOSE PAULO SILVA DE ARAUJO | 000658 | Inativo | alto-token |

## Totais no banco após reassociação

- **Total de ocorrências:** 973
- **Ocorrências vinculadas ao placeholder:** 504

## Observações

- Os demais níveis de confiança (Primeiro+Último, Substring, Similaridade e Não encontrado) permanecem no placeholder aguardando revisão manual via planilha `dados-locais/revisao_496_nomes.xlsx`.
- O colaborador `JOSE PAULO SILVA DE ARAUJO` está com status `Inativo` no cadastro.
