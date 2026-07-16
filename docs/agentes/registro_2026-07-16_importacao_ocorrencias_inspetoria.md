# Registro de Alterações — Importação de Ocorrências da Inspetoria (16/07/2026)

## Contexto

Continuação da importação de ocorrências históricas. O usuário solicitou a importação das ocorrências da inspetoria contidas no arquivo `ocorrencias_inspetoria_classificado.xlsx`.

## Arquivo fonte

- `public/ocorrencias_inspetoria_classificado.xlsx`
- Aba: `Ocorrências`
- 12 ocorrências
- Colunas: `Data`, `Seq.`, `MACRO`, `TIPO`, `Funcionário`, `Local`, `Descrição do Ocorrido`, `Resumo`

## Script utilizado

`scripts/importar-ocorrencias-inspetoria.py`

## Estratégia

1. **Associação por nome completo:** matching exato e por tokens.
2. **Placeholder para não identificados:** reutilizado o colaborador `OCORRENCIAS HISTORICAS - NAO IDENTIFICADO` (matrícula `999999`).
3. **Mapeamento de macro grupo e tipo:** valores da planilha convertidos para o formato utilizado no sistema (ex: `Jornada e Ponto` → `1. Jornada e Ponto`).
4. **Preservação do número original:** `Seq.` inserido no título (`[30853] Atraso no posto de trabalho`).
5. **Local informado mantido:** o valor `FALTISTA E FERISTA` foi mantido em `local_ocorrido`, conforme solicitação do usuário.
6. **Data:** a coluna `Data` foi usada tanto para `data_ocorrencia` quanto para `data_hora_ocorrido`.
7. **Status:** todas as ocorrências importadas como `Ativa`.

## Resultado

- **Ocorrências importadas:** 12
- **Associadas a colaboradores existentes:** 3
  - ANDREA CRISTINA GONCALVES CARVALHO
  - LUIS CARLOS NUNES FERREIRA
  - JOSE ROBERTO MIRANDA ALBINO
- **Associadas ao placeholder (não identificadas):** 9
  - EDUARDO DA CONCEIÇÃO SANTOS
  - ROCKI LANE DE LIMA ESTEVES
  - CLEIZE MONTEIRO DE FREITAS
  - EMILIANA MAGALHAES DO AMARAL
  - JOSE GUSTAVO DOS SANTOS LOPES
  - JULIANA MENDES VIANA
  - ANTONIO MARCOS RIBEIRO VIEIRA
  - WENDELL ARANTES PEREIRA
  - SANDRA DE OLIVEIRA MOREIRA
- **Múltiplos matches:** 0

## Totais no banco após importação

- **Total de ocorrências:** 973
- **Ocorrências vinculadas ao placeholder:** 505

## Observações

- As 9 ocorrências não identificadas guardam o nome original do funcionário em `colaborador_nome` e na descrição.
- Quando os colaboradores forem cadastrados no banco, pode-se rodar um script de reassociação para atualizar `colaborador_id`, `empresa_id` e `colaborador_nome`.
- O script de importação suporta o parâmetro `--dry-run` para validação antes da inserção real.
