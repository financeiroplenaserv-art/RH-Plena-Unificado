# Handoff — Adicionais e Lifecard (22/11/2026)

## Escopo deste trabalho

Foram entregues três alterações, todas locais até a preparação do commit:

1. correção do adicional **Feriado** em contratos de regime **personalizado**;
2. correção da **Intrajornada em feriados**;
3. nova rotina **VR → Lifecard** para importar o demonstrativo mensal e gerar o TXT da Alterdata com o evento **664**.

Nenhum arquivo, migration ou dado de **VT** foi alterado por este trabalho. Há alterações de outro agente na árvore, inclusive em VT; elas devem ser preservadas e não fazem parte deste pacote.

Não houve migration, gravação de dados em produção nem deploy. As consultas ao banco usadas para conferência foram somente leitura.

## 1. Adicionais — Feriado em regime personalizado

### Problema confirmado

No período 20/10/2026 a 19/11/2026, Élcio e Sara apareciam com 2 dias de feriado. O contrato "Feriado Great Place - colab flex" usa regime `personalizado`, e `escaladoParaTrabalhar` retornava `true` para todos os dias. Assim, 02/11 e 15/11 eram contados sem olhar o calendário.

Dados conferidos em produção:

- Élcio: 02/11 = folga; 15/11 = trabalhou → deve receber **1**.
- Sara: 02/11 = folga; 15/11 = folga → deve receber **0**.

### Correção

`contarDiasFeriadoEscalado` (`src/lib/adicionais/calculoAdicionais.ts`) ganhou um callback opcional com o status registrado. No regime personalizado, somente `trabalhou` gravado no próprio vínculo conta; folga ou ausência de registro não conta. Os demais regimes continuam usando a escala prevista.

O callback foi ligado ao Relatório (`src/lib/adicionais/relatorioAdicionais.ts`) e ao resumo do Calendário (`src/pages/adicionais/AdicionaisCalendarioPage.tsx`). Coberturas/substitutos não ganham o adicional por inferência.

Testes reproduzem o período e as folgas reais: ambos continuam com 26 trabalhados e 5 folgas, mas o resultado fica Élcio 1 e Sara 0.

## 2. Adicionais — Intrajornada em feriado

### Problema confirmado

A tela Contratos já permite marcar "Feriado" em "Dias de intrajornada" (código 7), e há vários contratos configurados assim. Porém `diaIntrajornada` só comparava os dias da semana de 0 a 6; feriado nunca era reconhecido.

### Correção

`diaIntrajornada` agora recebe opcionalmente o conjunto de datas de feriados. Se a data estiver cadastrada como feriado e o contrato tiver o código 7, o dia é elegível. A contagem continua exigindo status `trabalhou`; folga não conta.

A data de feriados foi passada no Calendário e no Relatório, tanto para titular quanto para substituto. A coluna separada **Feriado** não foi alterada.

O Calendário passou a usar a função pura compartilhada de `src/lib/adicionais/calculoAdicionais.ts`, em vez da cópia de dois argumentos exposta por `useAdicionaisContratuais`. Isso evitou divergência entre as duas implementações.

Testes cobrem código 7, dias da semana sem código 7, titular e substituto.

## 3. VR → Lifecard → TXT Alterdata 664

### Decisões da gestora

- Local: nova aba **VR → Lifecard** (`/vr/lifecard`).
- Valor: coluna **DESC**, incluindo eventual 2ª via.
- Competência: mês final do período do demonstrativo, editável na tela; referências do primeiro ao último dia desse mês.
- Evento: **664**, no layout Alterdata de 61 posições.
- Pessoas: cruzamento somente por CPF exato; matrícula e empresa vêm do CORH.

### Implementação

Arquivos principais:

- `src/pages/vr/VrLifecardPage.tsx` — upload, competência, totais, conferência e download.
- `src/lib/vr/lifecard.ts` — parser, conciliação e geração do TXT.
- `src/lib/vr/lifecard.test.ts` — testes, inclusive do arquivo real quando disponível em `dados-locais`.
- `src/pages/vr/VrShell.tsx` — abas Projetos VR e Lifecard.
- `src/App.tsx` e `src/routes/lazyPages.ts` — rota e lazy loading.

A primeira aba do arquivo é lida com `@e965/xlsx`. O parser reconhece MAT/CPF/NOME/COMP/2VIA/DESC e normaliza CPF para 11 dígitos. MAT do Lifecard não é usado como matrícula Alterdata.

A tela mostra registros prontos e pendências. Ficam fora do TXT, com motivo: CPF repetido ou não encontrado, duplicidade cadastral sem único ativo, matrícula ausente/maior que 6 dígitos, empresa sem código Alterdata e valor inválido. Não há soma ou escolha por palpite.

### Validação com o arquivo real

Arquivo: `dados-locais/Demonstrativo 16.10.2026  15.11.2026.xls`.

- 69 registros lidos; 69/69 prontos contra o cadastro real.
- Total DESC: **R$ 16.487,62**.
- 69 linhas geradas, todas com 61 posições e evento 664.
- Competência 2026-11; referências `011126` a `301126`.
- Nenhuma pendência no arquivo fornecido.

Exemplo comprovado: Alessandra Alves Fortunato da Silva é **Plena Tech**, código `00035`, matrícula `000016`, desconto R$ 348,91. Sua linha real ficou:

```txt
000004000350111263011260000000000000066400000000034891000016F
```

Cada linha usa a empresa do respectivo colaborador, não uma empresa única para o arquivo inteiro.

## Documentação atualizada

- `AGENTS.md` — regras de Feriado personalizado, Intrajornada em feriado e Lifecard.
- `docs/REGRAS_NEGOCIO.md` — mesmas decisões de negócio.
- Este handoff.

## Verificações executadas

- Testes focados de Adicionais: **87 passaram**.
- Testes do Lifecard: **8 passaram**.
- Suíte completa final: **1.759 testes em 150 arquivos passaram**.
- Lint dos arquivos alterados: passou.
- `npm run build`: passou, incluindo TypeScript e PWA.
- `git diff --check`: sem erro de whitespace nos arquivos do pacote.

O lint geral já apresentava erros em arquivos de VT e `dados-locais` que não pertencem a este trabalho; eles não foram modificados.

## Cuidados para o próximo agente

- Não fazer `git reset`, limpeza da árvore ou stage indiscriminado: há trabalho de outro agente em VT e em documentos/arquivos não relacionados.
- `src/App.tsx` também continha a rota `/vt/importacoes` de outro agente; somente import/rota de Lifecard pertencem a este pacote.
- `AGENTS.md` também continha registros de outro agente sobre VT 176 e Importações do mês; somente os blocos de Adicionais e Lifecard pertencem a este pacote.
- Não publicar em produção sem autorização da gestora. O deploy, quando autorizado, deve seguir o checklist do projeto: `main`, árvore limpa, flags de módulos e conferência do bundle.
- A funcionalidade Lifecard não persiste importações nem arquivos; foi propositalmente implementada sem migration. Se histórico mensal for necessário depois, isso será uma nova decisão.
