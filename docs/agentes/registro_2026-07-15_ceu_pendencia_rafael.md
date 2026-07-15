# Registro de Alterações — CEU: pendência RAFAEL DE CARVALHO LEMOS (15/07/2026)

## Contexto

Durante a importação das movimentações do CEU (`dados-locais/relatorio_por_colaborador que estava no CEU - colabs ativos.xls`), 25 movimentações do colaborador **RAFAEL DE CARVALHO LEMOS** não foram importadas porque a planilha usava a matrícula **1107**, mas o colaborador estava cadastrado no banco com a matrícula **000764**.

## Diagnóstico

- O colaborador já existia no banco (`id: cd5c6089-7914-4a5a-ae7a-045ff9a35bbc`).
- Matrícula anterior: `000764`.
- Status: `Inativo` (demissão em 2026-05-13).
- A planilha CEU registrava 25 entregas para o mesmo nome, com matrícula `1107` e departamento `ENSEADA PARK`.
- Não havia outro colaborador com matrícula `1107` na mesma empresa (`fe2f1e37-3915-4801-a2a4-179268a56fa2`).

## Ação tomada

Atualizada a matrícula do colaborador no banco de `000764` para `001107` e reimportadas as 25 movimentações pendentes.

## Script utilizado

`scripts/resolver-pendencia-rafael-ceu.mjs`

- Atualiza a matrícula do colaborador.
- Lê a planilha original.
- Filtra apenas as linhas do colaborador `RAFAEL DE CARVALHO LEMOS`.
- Faz o matching dos itens pelo nome (mesma lógica do script principal).
- Insere as entregas na tabela `entregas` sem apagar os dados já importados.

## Resultado

- Matrícula atualizada com sucesso: `000764` → `001107`.
- Movimentações importadas: **25**.
- Total de entregas no banco após a correção: **5.525**.
- ~~Restam **1** movimentação não importada por data inválida (`01/07/22026`).~~ ✅ **Removida da planilha em 15/07/2026.**

## Validação

```
Colaborador: {
  id: 'cd5c6089-7914-4a5a-ae7a-045ff9a35bbc',
  matricula: '001107',
  nome_completo: 'RAFAEL DE CARVALHO LEMOS'
}
Total entregas do colaborador: 25
```

## Próximos passos (opcionais)

1. Verificar no sistema (`/ceu/movimentacoes` ou `/ceu/entregas`) se as 25 entregas aparecem corretamente para o colaborador.
2. A planilha agora está limpa: **5.525 movimentações**, sem datas inválidas.
