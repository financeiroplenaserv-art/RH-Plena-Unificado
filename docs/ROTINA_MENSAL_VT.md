# Rotina mensal do Vale-Transporte

Ordem do trabalho antes de gerar o VT do mês seguinte (por volta do dia 20 a 25).
Combinado com a gestora em 21/11/2026, depois do recomeço do módulo.

## 1. Quem é optante (relatórios do Alterdata)

Tirar do Alterdata, para a **Plena EA** e a **Plena Tech**:

- relatório de quem **desconta VT** (lista com CNPJ, matrícula, nome e CPF);
- **Declaração de Não Beneficiário** (uma página por pessoa).

Regras:

- ninguém pode estar nos dois;
- todo colaborador ativo ou afastado precisa estar em um dos dois.

Quem aparece em "desconta" é optante no CORH; quem aparece em "não desconta" não é.
Os dias e valores desses relatórios não servem: usar só para saber quem é optante.

> **Como fazer (desde 22/11/2026):** aba **VT → Importações do mês**, cartão 1. Anexe os dois PDFs
> (pode ser de uma vez), confira a prévia (vão virar optantes / vão deixar de ser / nos dois relatórios /
> não encontrados / fora dos relatórios) e clique em **Gravar mudanças**. O casamento é por CPF
> exato (ou matrícula, se o relatório não trouxer CPF), nunca por nome; quem está nos dois relatórios
> não é alterado. Há um Excel de conferência com as listas.

## 2. Situação do Bilhete Único (relatório da Riocard)

No portal da Riocard, em cada conta (**Plena EA** e **Plena Tech**), abrir a lista de
usuários e imprimir "Cadastro de Funcionários da Empresa" em PDF.

O CORH grava, para cada optante, a situação do BU (Ativado, Suspenso Setrans,
Não possui BU, Desativado, Ativação Solicitada) e o número do cartão.

O portal **não mostra o saldo** dos cartões.

> **Como fazer (desde 22/11/2026):** aba **VT → Importações do mês**, cartão 2. Anexe o PDF de cada conta
> (Plena EA e Plena Tech), confira a data da consulta e a prévia (mudanças de situação, quem inativar na
> Riocard, quem cadastrar) e clique em **Gravar mudanças**. Casamento só por CPF, cadastro ativo.

Com o resultado, o RH faz no portal da Riocard:

- **inativar** quem saiu da empresa ou deixou de ser optante;
- **habilitar** o BU de quem está "Não possui BU";
- **investigar** quem está "Suspenso Setrans" (pode ser o BUI ativo em outro cartão da pessoa);
- **cadastrar** o optante que não está na Riocard.

## 3. Rotas (aba VT → Rotas a confirmar)

Zerar a fila antes de gerar a carga. Toda pessoa optante precisa de rota confirmada para
o posto do mês, inclusive quem vai cobrir férias em outro posto.

- **"Criar e revisar"** para quem não tem rota.
- **Consultar a ida.** A volta é consultada junto.
- **Escolher a rota que a pessoa usa de verdade e confirmar.**
- **"Endereço mudou":** conferir e confirmar de novo.
- **Linha DETRO com mais de um trecho:** escolher o trecho que a pessoa paga.
- **Volta diferente da ida:** confirmar com o colaborador como ele volta.

## 4. Escala do mês seguinte (relatório "Gestão de escalas" do Flit)

Importar na aba **Carga** o relatório "Gestão de escalas" do mês seguinte (já programado).
Ele traz os dias de trabalho, as férias e os afastamentos de cada pessoa.

- Para cada férias, informar **quem cobre** (ou "sem cobertura").
- Registrar o **treinamento** do ferista no posto novo, quando houver.

## 5. Gerar e gravar a carga

Gerar a carga do mês e conferir o banner: ele precisa ficar **verde ("Carga gravada")**.

> A carga ainda precisa ser ligada às rotas confirmadas (desenvolvimento pendente).

**Extra no mês (R$)** — só quando a gestora decidir (migration 176 aplicada): na seção "Extra no mês" da aba Carga, escolher a pessoa, informar o valor TOTAL do mês (ex.: 15,00) e o motivo (obrigatório) e clicar em "Gravar extra". O rascunho é recalculado na hora; o valor soma ao da pessoa, aparece na coluna "Extra no mês" e no Excel. Vale só para a competência — no mês seguinte começa vazio. Não é descontado pelo Fechamento. Depois de **confirmar** o lote não dá mais para alterar o extra.

## 6. Fechamento do mês anterior (espelho de ponto do Flit)

Na aba **Fechamento**, usar o espelho de ponto do período (20 a 19). Ele pode vir em
mais de um arquivo.

- **Falta:** desconta na carga seguinte.
- **Dia trabalhado fora da escala:** credita na carga seguinte.

## Arquivos do mês (resumo)

| Arquivo | De onde vem | Para quê |
|---|---|---|
| Desconta VT (EA e Tech) | Alterdata | Quem é optante |
| Declaração de Não Beneficiário (EA e Tech) | Alterdata | Quem não é optante |
| Cadastro de Funcionários da Empresa (EA e Tech) | Portal Riocard | Situação do BU e cartão; quem inativar ou habilitar |
| Gestão de escalas do mês seguinte | Flit | Dias de trabalho, férias, postos |
| Espelho de ponto (CORH - Adicionais e Ocorrências) | Flit | Fechamento: faltas e dias extras |
