# Capítulo 8 — Férias

O módulo Férias mostra a situação das férias de todos os colaboradores ativos em um só lugar. A partir da data de admissão e dos períodos já gozados, o sistema calcula o prazo máximo que a lei (CLT) dá para cada colaborador sair de férias e avisa quem está perto de estourar esse prazo. As férias em si vêm da planilha exportada do Flit (controle de ponto) e entram no sistema pela aba Importar; além disso, o RH pode registrar previsões de planejamento e anotar os avisos de férias já comunicados.

Cada colaborador pode ter períodos de férias em três situações: **em gozo** (está de férias agora ou já gozou), **agendadas** (data já marcada no Flit) e **previstas** (planejamento lançado pelo próprio RH dentro do CORH).

O módulo tem três abas, no topo da tela: **Visão geral**, **Importar** e **Notificações**.

## Visão geral

É a tela principal do módulo. No topo, cinco cartões resumem o quadro geral: quantos colaboradores estão de férias hoje, quantos têm férias agendadas, quantos estão com previsão do RH, quantos estão com o prazo legal perto do fim (60 dias ou menos) e quantos já passaram do prazo. Abaixo, uma tabela lista um colaborador por linha, com o último período gozado, a previsão do RH, o próximo período agendado, o limite concessivo e a situação de cada um.

O **limite concessivo** é a data máxima que a lei dá para o colaborador sair de férias do período mais antigo ainda não gozado. Quando essa data está a 60 dias ou menos, a situação vira **A vencer**; quando já passou, vira **Vencido** — e aí a empresa precisa agir rápido.

[IMAGEM: ferias.png]

### Como fazer

**Consultar a situação de um colaborador:**

1. Abra o módulo Férias pelo menu lateral. A aba Visão geral já é a primeira.
2. No painel de filtros, digite o nome no campo **Buscar**.
3. Clique em **Aplicar**. A tabela mostra só os nomes que batem com a busca.
4. Leia a situação na última coluna: o selo colorido indica Em gozo, Agendado, Previsto, A vencer, Vencido, Em dia ou Sem dados.

**Filtrar por departamento ou situação:**

1. No painel de filtros, escolha um **Departamento** e/ou uma **Situação** (por exemplo, "Vencido" para ver só os casos urgentes).
2. Clique em **Aplicar**.
3. Para voltar à lista completa, clique em **Limpar** e depois em **Aplicar**.

**Ordenar a tabela por data:**

1. Clique no título da coluna **Último gozo**, **Previsão RH**, **Próximo agendado** ou **Limite concessivo**.
2. A lista é reordenada pela data. Clique de novo para inverter a ordem (mais antiga primeiro ou mais recente primeiro). Linhas sem data ficam sempre no final.

**Cadastrar uma nova previsão de férias (planejamento do RH):**

1. Clique no botão **Nova previsão**, no canto superior direito.
2. Na janela que abre, digite o nome no campo **Colaborador** e selecione na lista (apenas colaboradores ativos aparecem).
3. Preencha **Início previsto**. O sistema já sugere automaticamente o **Fim previsto** 30 dias depois (padrão CLT); ajuste se precisar.
4. Se quiser, escreva uma **Observação** (ex.: "previsão informada ao contrato em reunião").
5. Clique em **Salvar previsão**. A janela fecha e o colaborador aparece na tabela com a situação **Previsto** e o período na coluna Previsão RH.

> DICA: quando o período for confirmado no sistema de ponto e chegar pela importação do Flit, a previsão é baixada automaticamente — você não precisa apagar à mão.

**Excluir uma previsão lançada errado:**

1. Na linha do colaborador, clique no ícone de **lixeira** (ele só aparece quando existe uma previsão ativa).
2. Na janela de confirmação, confira o nome e o período e clique em **Excluir**.
3. A previsão some da tabela. Apenas previsões do RH podem ser excluídas aqui; os períodos que vieram do Flit não têm lixeira.

**Registrar um aviso de férias direto da linha do colaborador:**

1. Na linha do colaborador, clique no ícone de **sino**.
2. A janela de notificação abre já com o colaborador preenchido. Escolha para quem o aviso foi enviado (o colaborador ou o responsável pelo contrato), confira a data, escreva uma observação se quiser e clique em **Registrar**.
3. O aviso fica guardado na aba Notificações.

**Exportar a lista para Excel:**

1. Aplique os filtros que quiser (ou deixe tudo em "Todos" para exportar a lista completa).
2. Clique em **Exportar Excel**, no canto superior direito.
3. O navegador baixa o arquivo `ferias_AAAA-MM-DD.xlsx` com as mesmas colunas da tabela, e o sistema mostra a mensagem verde com a quantidade de registros exportados.

> ATENÇÃO: se não houver nenhum registro na lista filtrada, o sistema avisa "Nenhum registro para exportar. Aplique um filtro primeiro." e nenhum arquivo é baixado.

### Campos e botões

**Cartões de resumo (topo da tela):**

- **Em gozo hoje**: quantos colaboradores estão de férias neste momento (número azul).
- **Agendados**: quantos têm férias com data marcada futura.
- **Previstos (RH)**: quantos têm previsão de planejamento lançada pelo RH.
- **A vencer (≤ 60d)**: quantos têm o limite concessivo a 60 dias ou menos de vencer (número amarelo).
- **Vencidos**: quantos já passaram do limite concessivo (número vermelho) — exigem providência imediata.

**Filtros:**

- **Buscar**: procura pelo nome do colaborador.
- **Departamento**: restringe a lista a um departamento. A opção "Todos" mostra tudo.
- **Situação**: restringe a uma situação (Em gozo, Agendado, Previsto, A vencer, Vencido, Em dia ou Sem dados).
- **Aplicar**: aplica os filtros escolhidos à tabela.
- **Limpar**: apaga os filtros e volta à lista completa.

**Colunas da tabela:**

- **Colaborador**: nome, com as iniciais num círculo cinza.
- **Departamento**: departamento do colaborador.
- **Admissão**: data de admissão (base de todos os cálculos de prazo).
- **Último gozo**: período das férias mais recentes já gozadas (início a fim). Um traço (-) indica que nunca gozou.
- **Previsão RH**: próximo período previsto lançado pelo RH, se houver.
- **Próximo agendado**: próximo período de férias já confirmado no Flit, se houver.
- **Limite concessivo**: data máxima legal para o colaborador sair de férias do período mais antigo ainda não gozado.
- **Situação**: selo colorido com o estado atual — Em gozo (azul), Agendado (azul), Previsto (cinza), A vencer (amarelo), Vencido (vermelho), Em dia (verde) ou Sem dados (cinza).

**Botões e ícones:**

- **Nova previsão** (botão azul, topo): abre a janela para lançar uma previsão de férias. Aparece para os perfis Administrador, Gestor, RH, DP1 e DP2.
- **Exportar Excel** (botão, topo): baixa a lista filtrada em Excel. Aparece para os perfis Administrador, Gestor, RH, DP1, DP2 e Mesa.
- **Sino** (na linha): abre a janela para registrar um aviso de férias para aquele colaborador.
- **Lixeira** (na linha): exclui a previsão de férias daquele colaborador, após confirmação. Só aparece quando há previsão ativa e para perfis que podem gerenciar férias.

**Janela "Nova previsão de férias":**

- **Colaborador**: campo de busca por nome (apenas ativos).
- **Início previsto**: data de início das férias previstas.
- **Fim previsto**: data de fim — preenchida automaticamente com 30 dias a partir do início, mas editável.
- **Observação (opcional)**: texto livre para anotar detalhes da previsão.
- **Salvar previsão**: grava a previsão. Se faltar colaborador ou datas, o sistema mostra o aviso em vermelho dentro da janela (ex.: "A data fim não pode ser anterior à data início").
- **Cancelar**: fecha a janela sem salvar.

## Importar

É a tela onde entram no CORH as férias de verdade — os períodos gozados e agendados. O sistema lê a planilha de férias exportada do Flit (controle de ponto), casa cada nome com o cadastro de colaboradores e mostra uma prévia antes de gravar qualquer coisa. Ao reimportar, os períodos anteriores que vieram do Flit dos mesmos colaboradores são substituídos pelos novos — nunca ficam duplicados.

[IMAGEM: ferias-importar.png]

A planilha precisa ter as colunas **Colaborador**, **Último período** e **Próximo período**, com os períodos no formato "DD/MM/AAAA - DD/MM/AAAA" (ex.: 01/03/2026 - 30/03/2026). O último período entra como férias gozadas e o próximo período como férias agendadas. A tela também aceita as colunas de descrição (Últ. descrição e Próx. descrição), que são guardadas junto com cada período.

### Como fazer

**Importar a planilha de férias do Flit:**

1. No Flit, exporte a planilha de férias (Excel, .xlsx ou .xls).
2. No CORH, abra Férias e clique na aba **Importar**.
3. Clique no seletor de arquivo e escolha a planilha no seu computador.
4. O sistema lê o arquivo e mostra a **Pré-visualização**: quantos colaboradores foram encontrados no cadastro e quantos períodos de gozo e agendados serão importados. Confira as listas de avisos (nomes não encontrados, nomes duplicados e períodos não interpretados).
5. Clique em **Importar para o CORH**. O botão mostra "Importando..." enquanto grava.
6. Ao terminar, aparece a mensagem verde com a quantidade de períodos importados e o quadro **Resumo da importação**: períodos importados, colaboradores atualizados e, quando houver, quantas previsões do RH foram baixadas automaticamente porque o período confirmado chegou do Flit.

> ATENÇÃO: os nomes na planilha precisam ser iguais aos do cadastro do CORH. Nomes que não casam com ninguém e nomes duplicados no cadastro ficam de fora da importação e aparecem nas listas amarelas da prévia — corrija o cadastro (ou a planilha) e importe de novo.

> DICA: se a pré-visualização mostrar "Erro ao ler o arquivo", confira se a planilha tem a coluna de nome do colaborador — a mensagem de erro lista as colunas que o sistema encontrou.

### Campos e botões

- **Arquivo Excel de férias**: seletor do arquivo da planilha (.xlsx ou .xls). Ao escolher, a leitura e a prévia acontecem na hora, antes de gravar.
- **Quadro "Como funciona a importação"**: lembrete fixo do formato esperado (colunas Colaborador, Último período e Próximo período) e da regra de substituição sem duplicar.
- **Importar para o CORH**: grava os períodos da prévia no sistema. Fica desabilitado enquanto não há arquivo válido lido ou enquanto a importação está em andamento. Aparece para os perfis Administrador, Gestor, RH, DP1, DP2 e Mesa; os demais perfis veem o aviso "Seu perfil não tem permissão para importar férias."
- **Pré-visualização** (aparece após escolher o arquivo):
  - **Colaboradores encontrados no cadastro**: quantos nomes da planilha casaram com o cadastro.
  - **Períodos de gozo e agendados a importar**: quantidade de cada tipo que será gravada.
  - **Não encontrados no CORH**: nomes da planilha sem cadastro correspondente — não são importados.
  - **Nomes duplicados no cadastro — não importados**: quando há mais de um colaborador ativo com o mesmo nome, o sistema não arrisca e pula a linha.
  - **Períodos não interpretados**: nomes cujo texto de período não estava no formato esperado.
- **Resumo da importação** (aparece após importar): períodos importados, colaboradores atualizados e previsões do RH baixadas automaticamente.

## Notificações

É o diário de avisos de férias. Toda vez que o RH comunica um colaborador sobre suas férias (o aviso de 30 dias, por exemplo) ou avisa o responsável pelo contrato de um cliente, o registro é lançado aqui — com data, destinatário e observação. Serve para provar que a comunicação foi feita e para ninguém avisar duas vezes.

[IMAGEM: ferias-notificacoes.png]

### Como fazer

**Registrar uma notificação:**

1. Abra a aba **Notificações**.
2. Clique em **Registrar notificação**, no canto superior direito.
3. Na janela, busque e selecione o **Colaborador** (apenas ativos).
4. Em **Enviada para**, marque se o aviso foi para **o colaborador** ou para **o responsável pelo contrato**.
5. Confira a **Data da notificação** — já vem preenchida com o dia de hoje, mas você pode mudar se o aviso foi enviado antes.
6. Se quiser, escreva uma **Observação** (ex.: "aviso de 30 dias enviado por e-mail").
7. Clique em **Registrar**. A janela fecha e o aviso aparece na lista.

> DICA: também dá para registrar o aviso sem sair da Visão geral — clique no ícone de sino na linha do colaborador. Nesse caso, a janela já abre com o nome preenchido e vinculada ao período de férias mais próximo dele.

**Procurar notificações antigas:**

1. No painel de filtros, digite o nome ou a matrícula no campo **Buscar** e/ou escolha o **Destinatário** (Ao colaborador ou Responsável pelo contrato).
2. Clique em **Aplicar**. A lista mostra só os registros que batem com o filtro.
3. Para ver tudo de novo, clique em **Limpar**.

### Campos e botões

**Filtros:**

- **Buscar**: procura pelo nome ou pela matrícula do colaborador.
- **Destinatário**: restringe a lista a avisos enviados "Ao colaborador" ou ao "Responsável pelo contrato". A opção "Todos" mostra os dois.
- **Aplicar**: aplica os filtros à lista.
- **Limpar**: apaga os filtros e volta à lista completa.

**Colunas da tabela:**

- **Data**: data em que o aviso foi enviado.
- **Colaborador**: nome do colaborador avisado.
- **Matrícula**: matrícula do colaborador.
- **Departamento**: departamento do colaborador.
- **Destinatário**: selo que indica para quem foi o aviso — "Colaborador" (azul) ou "Responsável contrato" (amarelo).
- **Observação**: anotação livre registrada no lançamento.

**Botões:**

- **Registrar notificação** (botão azul, topo): abre a janela de novo registro. Aparece para os perfis Administrador, Gestor, RH, DP1 e DP2.

**Janela "Registrar notificação de férias":**

- **Colaborador**: campo de busca por nome (apenas ativos). Quando a janela é aberta pelo sino da Visão geral, o nome já vem preenchido e fixo.
- **Enviada para**: escolha entre "O colaborador" e "O responsável pelo contrato".
- **Data da notificação**: data do envio do aviso (vem com hoje).
- **Observação (opcional)**: texto livre sobre como o aviso foi feito.
- **Registrar**: grava o aviso. Se faltar colaborador ou data, o sistema mostra o aviso em vermelho dentro da janela.
- **Cancelar**: fecha a janela sem salvar.

## Dúvidas frequentes

**O que é o limite concessivo?**
É a data máxima que a CLT dá para o colaborador sair de férias do período mais antigo ainda não gozado. O sistema calcula essa data sozinho a partir da admissão e dos períodos já gozados. Passou dessa data sem o colaborador gozar as férias, a situação vira "Vencido" e a empresa precisa agir.

**Um colaborador aparece como "Sem dados". O que faço?**
Significa que o sistema não conseguiu calcular o prazo — em geral porque a data de admissão está vazia no cadastro ou não há nenhum período de férias registrado. Confira o cadastro do colaborador e importe a planilha de férias do Flit na aba Importar.

**Importei a planilha e alguns nomes ficaram de fora. Por quê?**
Dois motivos possíveis: o nome na planilha não é igual ao do cadastro do CORH, ou há mais de um colaborador ativo com o mesmo nome (o sistema não arrisca e pula). Os dois casos aparecem nas listas amarelas da pré-visualização. Corrija o cadastro ou a planilha e importe de novo — reimportar não duplica nada.

**Lancei uma previsão errada. Como apago?**
Na Visão geral, clique no ícone de lixeira na linha do colaborador e confirme. Só dá para excluir previsões do RH; os períodos que vieram do Flit só são atualizados por uma nova importação.

**O que acontece com a previsão do RH quando as férias são confirmadas?**
Quando o período confirmado chega do Flit pela importação, a previsão é baixada automaticamente e o colaborador passa a aparecer como "Agendado" — o resumo da importação mostra quantas previsões foram baixadas.
