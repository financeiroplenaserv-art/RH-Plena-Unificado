# Registro de Alterações — Importação de Ocorrências Antigas (16/07/2026)

## Contexto

O usuário solicitou a importação das ocorrências de advertência e suspensão do programa anterior para o CORH. O arquivo fornecido continha 961 ocorrências de 428 funcionários diferentes, sem CPF ou matrícula — apenas o nome completo como chave de associação.

## Arquivo fonte

- `public/Ocorrências de advertência e suspensão para CORH em sem cpf 15jul26.xlsx`
- 961 ocorrências
- 428 funcionários únicos
- Apenas macro grupo: `Conduta e Disciplina`
- Tipos: `Advertência Escrita`, `Advertência Verbal`, `Suspensão 1`, `Suspensão 2`, `Suspensão 3`

## Estratégia

1. **Associação por nome completo:** matching exato, por tokens e por similaridade (Levenshtein).
2. **Placeholder para não identificados:** criado colaborador `OCORRENCIAS HISTORICAS - NAO IDENTIFICADO` (matrícula `999999`) para receber as ocorrências sem match no banco atual.
3. **Correção ortográfica:** instalado `pyspellchecker` com dicionário pt-BR para corrigir descrições mal escritas e separar palavras grudadas (ex: `insubordinaçãocom` → `insubordinação com`).
4. **Limpeza de locais:** removidos sufixos como `LIMPEZA`, `PORTARIA`, `ENCARREGADO`, `PERICULOSIDADE`, etc., mantendo apenas o nome do local.
5. **Número da ocorrência antiga:** preservado no título (`[75266] ...`) e na descrição para pesquisa futura.
6. **Campos obrigatórios sem dados:** preenchidos com textos padrão indicando "importação histórica do sistema anterior".

## Script utilizado

`scripts/importar-ocorrencias-antigas.py`

## Resultado

- **Ocorrências importadas:** 961
- **Associadas a colaboradores existentes:** 465
- **Associadas ao placeholder (não identificadas):** 496
- **Múltiplos matches resolvidos:** 9 (escolhido o colaborador ativo ou com nome mais curto)
- **Status de todas:** `Ativa`

## Placeholder criado

- **Nome:** OCORRENCIAS HISTORICAS - NAO IDENTIFICADO
- **Matrícula:** 999999
- **Status:** Inativo
- **ID:** `af8cb17e-8065-445b-89e5-a29e9b7e822f`

## Como reassociar ocorrências do placeholder no futuro

As ocorrências não identificadas guardam o nome original do funcionário em:
- `colaborador_nome`
- `descricao` (trecho `Colaborador na planilha: NOME`)

Quando o colaborador for cadastrado no banco, basta executar um script que:
1. Busca ocorrências vinculadas ao placeholder.
2. Tenta encontrar o colaborador pelo nome.
3. Atualiza `colaborador_id`, `empresa_id` e `colaborador_nome`.

## Observações

- A correção ortográfica melhorou bastante as descrições, mas não é perfeita. Algumas palavras cortadas com espaço no meio (ex: `expedien te`) ou nomes próprios/locais podem precisar de ajuste manual.
- A instalação do Microsoft Visual C++ Build Tools 2022 foi necessária para tentar instalar corretores ortográficos nativos, mas a solução final utilizou `pyspellchecker` (Python puro).

## Próximos passos sugeridos

1. Verificar no sistema (`/rh/ocorrencias`) se as ocorrências aparecem corretamente.
2. Testar a busca pelo número da ocorrência antiga (ex: `75266`).
3. Quando novos colaboradores forem cadastrados, reassociar as ocorrências do placeholder.
