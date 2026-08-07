# Capítulo 6 — Extras (Faltas, Coberturas e Pagamentos)

O módulo de Extras é onde a empresa registra as faltas dos colaboradores e quem cobriu cada posto. A partir desses lançamentos, o sistema monta o balanço diário para enviar no WhatsApp, consolida os valores para pagamento e emite os recibos que o colaborador assina. É aqui que começa e termina todo o processo de pagamento de extras.

O módulo aparece no menu lateral como **Extras** e tem as abas: **Lançamentos**, **Novo**, **Balanço Diário**, **Relatório Semanal**, **Recibos**, **Categorias** e **Mobile**.

> ATENÇÃO: a pergunta **"Gera extra?"** só tem duas respostas: **Sim** e **Não**. **Não** significa que o colaborador **não recebe** pelo serviço — o registro fica só para controle (aparece no balanço diário do WhatsApp, mas não entra no pagamento nem nos recibos) e o valor é sempre gravado como R$ 0,00.

## Lançamentos

É a tela principal do módulo: a lista de todos os extras lançados em um período. Aqui você consulta o que foi registrado, edita lançamentos, exclui registros feitos por engano e vê o total pendente de pagamento.

[IMAGEM: extras-lancamentos.png]

Ao abrir, a tela já mostra os lançamentos do **mês atual** (do dia 1 até o último dia do mês). Os filtros que você usar ficam guardados: se sair da tela e voltar, eles continuam os mesmos.

### Como fazer

**Filtrar os lançamentos:**
1. Ajuste os campos de filtro (período, categoria, status, colaborador ou a busca por texto). A lista já se atualiza sozinha conforme você muda os campos.
2. Se preferir, clique em **Aplicar** para confirmar.
3. Para voltar ao padrão (mês atual, sem filtros), clique em **Limpar**.

**Editar um lançamento:**
1. Na linha do registro, clique no ícone de **lápis** (✏️).
2. O sistema abre o formulário com os dados preenchidos — veja a seção **Novo Extra**.
3. Altere o que precisar e clique em **Atualizar**. Você volta para a lista.

**Excluir um lançamento feito por engano:**
1. Na linha do registro, clique no ícone de **lixeira** (vermelho).
2. O sistema pergunta "Excluir extra? O registro será removido permanentemente."
3. Clique em **Sim, excluir** para confirmar, ou em **Cancelar** para desistir.

> ATENÇÃO: a lixeira só aparece para os perfis **Administrador**, **Mesa** e **Inspetoria** — são eles que podem excluir um lançamento errado. A exclusão é permanente e não pode ser desfeita.

> DICA: no rodapé da lista, o sistema mostra o **Total pendente no período** — a soma dos valores de todos os lançamentos com status "Pendente" visíveis na tela. É uma forma rápida de saber quanto falta pagar.

### Campos e botões

- **Novo extra** (botão no topo): abre o formulário de lançamento. Aparece para quem pode lançar (Administrador, Mesa, Inspetoria).
- **Data início / Data fim**: período da consulta. Começa no mês atual.
- **Categoria**: filtra por tipo de serviço (Limpeza, Portaria, Operacional, Zelador, Jardinagem, Medidas disciplinares, Outros) ou "Todas".
- **Status**: filtra por Pendente, Pago, Cancelado ou "Todos".
- **Colaborador**: filtra por um colaborador específico (lista os ativos) ou "Todos".
- **Buscar**: campo de texto livre — procura no posto, no nome do ausente, no nome do substituto e no motivo.
- **Aplicar**: confirma os filtros escolhidos.
- **Limpar**: volta os filtros ao padrão (mês atual, tudo liberado).
- **Tabela de resultados**, com as colunas:
  - **Data**: dia da ocorrência.
  - **Departamento**: posto onde aconteceu.
  - **Ausente**: quem faltou ("—" quando não há ausente).
  - **Substituto**: quem cobriu (ou "SEM NOME" quando ninguém cobriu).
  - **Motivo**: motivo do lançamento.
  - **Valor**: valor a pagar, em reais.
  - **Status**: selo colorido — amarelo "Pendente", verde "Pago", vermelho "Cancelado".
  - **Lançado em**: data e hora em que o registro foi feito no sistema.
  - **Ações**: lápis (editar) e lixeira (excluir), conforme o seu perfil.

## Novo Extra

Formulário para registrar uma falta, uma cobertura ou um reforço. A mesma tela serve para **criar** (botão "Novo extra") e para **editar** (lápis na lista) — quando é edição, ela abre com os dados preenchidos e o botão final se chama "Atualizar".

[IMAGEM: extras-novo.png]

### Como fazer

**Lançar um novo extra:**
1. Na aba **Lançamentos**, clique em **Novo extra** (ou vá direto na aba **Novo**).
2. Responda **"Gera extra para pagamento?"**:
   - **Sim** — o substituto vai receber pelo serviço. Informe o valor (pode ser R$ 0,00).
   - **Não** — é só um registro de controle (falta anotada, sem pagamento). O campo de valor zera e fica travado.
3. Preencha a **data da ocorrência**, o **turno**, a **categoria** e o **departamento** (posto).
4. Informe **quem faltou** (ou marque "Não tem colaborador ausente", quando for só um reforço, sem ninguém faltando).
5. Informe **quem substituiu** (ou marque "Não tem colaborador substituto", quando a falta ficou sem cobertura).
6. Escolha o **motivo**.
7. Escolha a **categoria de valor** (ela preenche o valor automaticamente) ou deixe em "Valor acordado" e digite o valor.
8. Marque **Extra faturado** se o serviço será cobrado do cliente, e **Reforço Contratual** se for um reforço previsto em contrato.
9. Preencha a seção **Comunicação com o cliente**, se o cliente foi avisado.
10. Revise e clique em **Salvar**. O sistema grava e leva você de volta para a lista de Lançamentos.

> ATENÇÃO: **Extra faturado** e **Gera extra** são coisas diferentes. "Gera extra" é o **pagamento ao colaborador**; "Extra faturado" é a **cobrança feita ao cliente**. Um colaborador pode não receber pelo serviço (Gera extra = Não) e mesmo assim o serviço ser faturado ao cliente. Os dois campos são independentes.

> DICA: se tentar salvar sem departamento, categoria ou motivo, o sistema mostra um aviso vermelho ("Selecione o departamento", etc.) e não grava — basta completar o campo indicado.

**Duplicidade:** ao salvar, o sistema verifica se já existe lançamento do mesmo colaborador, no mesmo departamento e na mesma data. Se existir, aparece o aviso "Já existe um extra lançado para..." e o registro não é gravado. A única exceção: com "Gera extra = Sim" **e** "Não tem colaborador ausente", o sistema permite vários lançamentos no mesmo posto e data — é o caso de uma equipe extra trabalhando junta, sem substituir ninguém.

### Campos e botões

- **Gera extra para pagamento?** (botões Sim/Não, no topo): define se há pagamento ao colaborador. Com **Não**, o valor zera, fica travado e é gravado R$ 0,00; o registro só aparece no balanço diário. Um texto abaixo explica isso quando o "Não" está marcado.
- **Data da ocorrência**: dia em que a falta/cobertura aconteceu. Obrigatório.
- **Turno**: Dia, Manhã, Tarde, Noite ou Noite anterior.
- **Categoria**: tipo de serviço (Limpeza, Portaria, Operacional, Zelador, Jardinagem, Medidas disciplinares, Outros). Obrigatório.
- **Departamento**: posto onde aconteceu. Ao trocar o departamento, o sistema limpa os campos de ausente e substituto. Obrigatório.
- **Colaborador ausente**: campo de busca — digite o nome e escolha na lista. Sugere primeiro os colaboradores do departamento escolhido. Se não achar o nome, pode digitar um nome novo (não cadastrado).
  - **Não tem colaborador ausente** (caixa de marcar): use quando é só um reforço, sem ninguém faltando. O campo de busca some.
- **Substituto**: campo de busca — quem cobriu o posto.
  - **Não tem colaborador substituto** (caixa de marcar): use quando a falta ficou **sem cobertura**. O registro sai como **SEM NOME** nos relatórios e esse grupo **não gera recibo** (não há quem assinar).
- **Motivo**: Atestado, Falta sem justificativa, Folga, Férias, Extra faturado, Reforço estratégico, Reforço faturado, Limpeza interna, Cobertura férias extra faturadas, Outros, Treinamento ou Movimentação Operacional. Obrigatório.
- **Categoria de valor**: "Valor acordado" (você digita o valor) ou uma das categorias cadastradas na aba **Categorias** — ao escolher uma, o valor padrão dela preenche o campo Valor automaticamente.
- **Valor (R$)**: valor a pagar ao substituto. Aceita R$ 0,00. Fica travado quando "Gera extra" está em Não.
- **Extra faturado** (caixa de marcar): o serviço será cobrado do cliente. Independe do pagamento ao colaborador.
- **Reforço Contratual** (caixa de marcar): a cobertura é um reforço previsto em contrato — sai marcado no balanço diário.
- **Comunicação com o cliente**:
  - **Meio de comunicação**: WhatsApp, Email ou "Não se aplica".
  - **Data da comunicação**: quando o cliente foi avisado.
  - **Hora da comunicação**: horário do aviso.
  - **Detalhes**: texto livre (ex.: "Whats 7:15, email 17/06, previamente agendado...").
- **Status**: Pendente, Pago ou Cancelado. Todo lançamento novo nasce "Pendente".
- **Observações**: texto livre com informações adicionais.
- **Salvar** (ou **Atualizar**, na edição): grava o registro e volta para a lista.
- **Cancelar**: volta para a lista sem gravar nada.

## Balanço Diário

Monta automaticamente a mensagem de texto do **Balanço Operacional do dia**, pronta para colar no WhatsApp. O sistema junta todos os extras da data escolhida, organiza por categoria e por departamento, e inclui no final as ocorrências do turno "Noite anterior" do dia anterior.

[IMAGEM: extras-balanco.png]

### Como fazer

**Gerar e enviar o balanço do dia:**
1. Escolha a data em **Data do balanço** (vem com o dia de hoje). A mensagem é montada sozinha, a cada mudança.
2. Confira o **Resumo**: número de ocorrências, valor total e quantas estão **sem comunicação** ao cliente (o número fica vermelho quando há pendências).
3. Se precisar, edite o texto diretamente no quadro **Mensagem para o WhatsApp**.
4. Clique em **Copiar mensagem** — o sistema mostra o aviso "Mensagem copiada para a área de transferência". Depois é só colar no grupo do WhatsApp.
5. Ou clique em **WhatsApp** para abrir o WhatsApp (aplicativo ou web) já com o texto pronto para escolher o destinatário.

> DICA: se você editou o texto e quer voltar à versão montada pelo sistema, clique em **Gerar novamente**.

> DICA: quando a mensagem fica muito longa para abrir direto no WhatsApp, o sistema envia só o começo e avisa "Mensagem muito longa; enviada parte inicial pelo WhatsApp". Nesse caso, use **Copiar mensagem** e cole manualmente.

> ATENÇÃO: o que está como "Gera extra = Não" também aparece no balanço (é o relatório diário de ocorrências). Já os lançamentos do turno **"Noite anterior"** entram no balanço do dia **seguinte**, não do próprio dia — por isso o balanço de hoje traz a seção "Noite anterior" de ontem no final.

### Campos e botões

- **Novo extra** (botão no topo): atalho para o formulário de lançamento.
- **Data do balanço**: a data de referência da mensagem.
- **Resumo**:
  - **Ocorrências**: total de registros do dia (incluindo a noite anterior).
  - **Valor total**: soma dos valores.
  - **Sem comunicação**: quantos registros estão sem aviso ao cliente (vermelho quando há, verde quando zerado).
- **Ações**:
  - **Gerar novamente**: refaz a mensagem automática, descartando edições manuais.
  - **Copiar mensagem**: copia o texto para colar onde quiser.
  - **WhatsApp**: abre o WhatsApp com o texto pronto.
- **Mensagem para o WhatsApp**: quadro de texto com o balanço completo, editável. Embaixo, o sistema mostra a quantidade de caracteres. No final da mensagem vai um rodapé fixo com as demais operações ("Operacional S/O", porteiros/faltistas em apoio etc.).

## Relatório Semanal

Consolidação dos extras de um período (por padrão, a semana atual), pensada para a conferência de pagamentos e para a emissão de recibos. Mostra o total geral, o quanto é faturado ao cliente e o quanto não é, e permite exportar tudo para o Excel.

[IMAGEM: extras-relatorio.png]

### Como fazer

**Consultar o relatório:**
1. Ajuste **Data início** e **Data fim** (vêm preenchidos com a semana atual).
2. Use o campo **Buscar** para procurar por colaborador (ausente ou substituto), departamento ou motivo.
3. Confira os cartões de totais no topo e a tabela com todos os registros do período, em ordem de data.

**Exportar para o Excel:**
1. Com os filtros prontos, clique em **Exportar Excel** (botão no topo).
2. O sistema baixa o arquivo `relatorio_semanal_extras_<início>_a_<fim>.xlsx` com exatamente o que está na tela e mostra o aviso verde "N registro(s) exportado(s) para Excel."
3. Se não houver nenhum registro no período, o sistema avisa "Nenhum registro para exportar."

### Campos e botões

- **Exportar Excel** (botão no topo): gera a planilha com as mesmas linhas e colunas da tela.
- **Data início / Data fim**: período da consulta (padrão: semana atual).
- **Buscar**: texto livre — procura no nome do ausente, do substituto, do departamento e no motivo.
- **Aplicar / Limpar**: botões do painel de filtros. Limpar esvazia a busca.
- **Cartões de totais**:
  - **Total geral**: soma de todos os valores do período.
  - **Extra faturado** (verde): soma só dos serviços cobrados do cliente.
  - **Não faturado**: soma dos serviços não faturados.
- **Tabela de resultados**, com as colunas: **Data**, **Departamento**, **Ausente**, **Substituto**, **Motivo**, **Valor**, **Faturado** (selo "Sim"/"Não") e **Status** (selo colorido).

## Recibos

Tela de pagamento: aqui os extras do período são agrupados por colaborador (o substituto que vai receber), e você gera o **recibo de pagamento**, colhe a **assinatura** na tela e marca os extras como **pagos**.

[IMAGEM: extras-recibos.png]

O fluxo completo é: **gerar o recibo → o colaborador assina na tela → o PDF sai com a assinatura → marcar como pago**.

### Como fazer

**Gerar um recibo e colher a assinatura:**
1. Escolha o período em **Data início** e **Data fim** (padrão: semana atual). A lista mostra um colaborador por linha, com a quantidade de extras e o valor total a receber.
2. Na linha do colaborador, clique em **Gerar e assinar**. O sistema cria o recibo e abre a janela de assinatura.
3. Confira o resumo (quantidade de extras, valor total e a lista de extras do período).
4. Peça para o **colaborador assinar no quadro** com o dedo (na tela sensível ao toque) ou com o mouse. Se errar, clique em **Limpar assinatura** para refazer.
5. Se quiser já dar baixa no pagamento, marque **"Marcar os extras como Pago após assinar"**.
6. Clique em **Confirmar e gerar PDF**. O sistema grava a assinatura e baixa o recibo em PDF.

> ATENÇÃO: sem assinatura no quadro, o botão de confirmar mostra o aviso "É necessário assinar antes de confirmar" e nada é gravado.

**Emitir o recibo em papel (sem assinatura digital):**
1. Marque a opção **"Emissão em papel (sem assinatura digital)"** nos filtros.
2. O botão da linha passa a se chamar **Gerar para impressão**.
3. Clique nele: o sistema cria o recibo e já baixa o PDF **com a linha de assinatura em branco**, para imprimir e colher a assinatura à caneta. O sistema mostra o aviso "Recibo para impressão gerado".

**Marcar os extras como pagos:**
1. Na linha do colaborador, clique no botão de **cifrão** (💲).
2. O sistema só deixa prosseguir se já existir um **recibo assinado** (digital ou em papel) do colaborador no período, e se os extras baterem com o recibo. Caso contrário, avisa que é preciso gerar o recibo antes.
3. Confirme em **Sim, marcar**. Os extras passam para o status "Pago" e o sistema mostra o aviso "N extra(s) marcado(s) como Pago".

> ATENÇÃO: marcar como pago **exige recibo assinado** — é a prova do pagamento. Se os extras mudarem depois do recibo (alguém editou ou excluiu um lançamento), o sistema bloqueia com o aviso "Os extras atuais não correspondem ao recibo assinado. Gere um novo recibo antes de marcar como pago." — exclua o recibo antigo e gere outro.

**Reemitir ou consultar um recibo já assinado:**
1. Na seção **Recibos assinados** (embaixo da lista), localize o recibo.
2. Clique em **Detalhes** para ver a lista de extras que o recibo cobre (somente leitura).
3. Clique em **PDF** para baixar o recibo novamente, com a assinatura.
4. Para remover um recibo, clique na **lixeira** e confirme em **Sim, excluir**.

> ATENÇÃO: o grupo **"SEM NOME"** (falta sem ninguém cobrindo) **não aparece** nesta tela — não há quem assinar o recibo. Também não aparecem registros com "Gera extra = Não" (não há pagamento) nem grupos com total R$ 0,00.

> DICA: perfis com acesso a esta tela: gerar/assinar recibos — Administrador, Mesa, DP1, Financeiro e Inspetoria; marcar como pago — Administrador, Financeiro e Inspetoria; excluir recibo — Administrador e Financeiro.

### Campos e botões

- **Filtros**:
  - **Data início / Data fim**: período dos extras (padrão: semana atual).
  - **Colaborador**: filtra a lista por parte do nome.
  - **Empresa**: filtra por empresa (ou "Todas as empresas").
  - **Emissão em papel (sem assinatura digital)**: troca o modo de emissão para recibo de imprimir.
  - **Atualizar**: recarrega os dados da tela.
- **Cartões de totais**: **Colaboradores com extras** (quantidade de pessoas a receber), **Total de extras** (quantidade de lançamentos) e **Valor total do período**.
- **Tabela "Colaboradores com extras"**:
  - **Colaborador**: nome de quem vai receber. Clique no título da coluna para inverter a ordem alfabética (seta para cima/baixo).
  - **Qtd. extras**: quantos lançamentos a pessoa tem no período.
  - **Valor total**: quanto ela tem a receber.
  - **Status**: selo "Pendente" (nada pago), "Parcial" (parte paga) ou "Pago" (tudo pago).
  - **Ações**: botão de **cifrão** (marcar como pago), **Gerar e assinar** / **Gerar para impressão**, ou o selo verde **"Recibo já emitido"** quando o recibo do período já existe.
- **Tabela "Recibos assinados"**: colunas **Colaborador**, **Período**, **Qtd.**, **Valor**, **Data assinatura** e ações (**Detalhes**, **PDF**, lixeira).
- **Janela de assinatura**:
  - **Resumo**: quantidade de extras e valor total.
  - **Extras do período**: tabela com data, turno, departamento, motivo e valor de cada extra.
  - **Assinatura do colaborador**: quadro para desenhar a assinatura.
  - **Marcar os extras como Pago após assinar**: dá baixa automática no pagamento.
  - **Limpar assinatura**: apaga o desenho para refazer.
  - **Confirmar e gerar PDF**: grava a assinatura e baixa o recibo (o botão mostra "Assinando..." durante o processo).

## Categorias

Cadastro das **categorias de valor** — os preços padrão dos extras (ex.: "ASG 7:20 hs" — R$ 120,00). Ao lançar um extra e escolher uma categoria, o valor padrão dela preenche o campo Valor sozinho, agilizando o lançamento.

[IMAGEM: extras-categorias.png]

### Como fazer

**Cadastrar uma categoria:**
1. Clique em **Nova categoria** (botão no topo).
2. Preencha o **Nome** e o **Valor padrão (R$)** e deixe a caixa **Ativa** marcada.
3. Clique em **Salvar**. A categoria entra na lista e passa a aparecer no campo "Categoria de valor" dos formulários.

> ATENÇÃO: se o nome estiver vazio, o sistema avisa "Informe o nome da categoria" e não grava.

**Editar uma categoria:**
1. Clique no ícone de **lápis** na linha da categoria.
2. O formulário abre preenchido no topo. Altere e clique em **Salvar** (ou **Cancelar** para desistir).

**Excluir uma categoria:**
1. Clique na **lixeira** vermelha na linha da categoria.
2. Confirme em **Sim, excluir**. A remoção é permanente.

**Desativar sem excluir:** edite a categoria e desmarque a caixa **Ativa**. Ela fica com o selo "Inativa" e deixa de ser sugerida, sem perder o histórico.

> DICA: quem pode criar e editar categorias: Administrador, Mesa, Inspetoria e Financeiro. Quem pode excluir: Administrador, Mesa e Financeiro.

### Campos e botões

- **Nova categoria** (botão no topo): abre o formulário de cadastro.
- **Formulário (Nova/Editar categoria)**:
  - **Nome**: nome da categoria (ex.: "ASG 7:20 hs"). Obrigatório.
  - **Valor padrão (R$)**: preço que preenche o lançamento automaticamente.
  - **Ativa** (caixa de marcar): define se a categoria está disponível para uso.
  - **Salvar**: grava. **Cancelar**: fecha o formulário sem gravar.
- **Tabela "Categorias cadastradas"**: colunas **Nome**, **Valor padrão**, **Status** (selo "Ativa"/"Inativa") e **Ações** (lápis e lixeira, conforme o perfil).

## Registro de Plantão

Formulário simplificado para lançar **vários extras em sequência** durante o plantão: ao salvar, o formulário se limpa sozinho e já fica pronto para o próximo registro. Tem campos grandes, pensado também para uso em tela menor.

[IMAGEM: extras-plantao.png]

### Como fazer

1. Preencha **data**, **turno**, **categoria** e **departamento**.
2. Informe **quem faltou** (ou marque "Não tem colaborador ausente") e **quem substituiu** (ou marque "Não tem colaborador substituto" — sai como SEM NOME).
3. Escolha o **motivo**, a **categoria de valor** (preenche o valor sozinha) e confira o **valor a pagar**.
4. Marque **Extra faturado** se o serviço será cobrado do cliente.
5. Preencha a **comunicação com o cliente** (meio, data, hora e detalhes), se houve aviso.
6. Escreva **observações**, se preciso.
7. Clique em **Salvar registro**. O sistema mostra o aviso verde "Registro salvo com sucesso" e limpa o formulário — pode lançar o próximo.
8. Use **Novo registro** para limpar o formulário manualmente a qualquer momento, ou **Voltar** para retornar aos Lançamentos.

> ATENÇÃO: diferente do formulário "Novo Extra", aqui o **substituto é obrigatório**: se não escolher ninguém nem marcar "Não tem colaborador substituto", o sistema avisa e não grava. Departamento, categoria e motivo também são obrigatórios.

### Campos e botões

- **Data da ocorrência**, **Turno**, **Categoria**, **Departamento**, **Colaborador ausente** (com "Não tem colaborador ausente"), **Substituto** (com "Não tem colaborador substituto") e **Motivo**: mesmos campos do formulário Novo Extra.
- **Categoria de valor**: "Valor acordado" ou uma categoria cadastrada — preenche o valor automaticamente.
- **Valor a pagar (R$)**: valor do extra.
- **Extra faturado** (caixa de marcar): serviço cobrado do cliente.
- **Comunicação com o cliente**: **Meio de comunicação** (WhatsApp, Email ou "Não se aplica"), **Data**, **Hora** e **Detalhes**.
- **Observações**: texto livre.
- **Salvar registro**: grava e limpa o formulário para o próximo lançamento.
- **Novo registro**: limpa todos os campos sem gravar.
- **Voltar**: retorna à lista de Lançamentos.

## Lançar Falta no celular

Tela feita para o **inspetor** registrar a falta direto do celular, no fim de semana ou no plantão, sem abrir o sistema inteiro. O endereço é `https://plena-corh.netlify.app/mobile/falta` e a tela também fica na aba **Mobile** do módulo Extras. É um assistente em **5 passos**: Ocorrência → Pessoas → Valor → Comunicação → Revisar.

[IMAGEM: mobile-falta.png]

**Instale na tela inicial do celular (faz uma vez só):**
- **Android (Chrome):** abra o endereço, faça login, toque no menu **⋮** → **"Instalar app"** ou **"Adicionar à tela inicial"**. Segurando o dedo no ícone do CORH, aparece o atalho **"Lançar falta"**.
- **iPhone (Safari):** abra o endereço no Safari, faça login, toque em **Compartilhar** → **"Adicionar à Tela de Início"**.
- O login fica salvo — você não digita a senha toda vez.

### Como fazer

1. **Passo 1 — Ocorrência:** informe a **data**, toque no **turno** (Dia, Manhã, Tarde, Noite ou Noite anterior), escolha o **departamento** (posto), a **categoria** e o **motivo**. Toque em **Próximo**.
2. **Passo 2 — Pessoas:** selecione **quem faltou** — o campo mostra primeiro os colaboradores do departamento escolhido ("Deste departamento"); digite o nome ou a matrícula para buscar em todos. Se for só um reforço, escolha a opção **"Não tem colaborador ausente"** no topo da lista. Depois selecione **quem substituiu** — ou a opção **"Não tem colaborador substituto"** quando ninguém cobriu (a falta fica anotada como SEM NOME).
3. **Passo 3 — Valor:** responda **"Gera extra para pagamento?"**:
   - **Sim** → escolha a **categoria de valor** (preenche o valor sozinha) ou deixe em "Valor acordado" e digite o valor (pode ser R$ 0,00). Depois responda o **tipo**: "Extra normal" ou "Extra faturado" (cobrança do cliente).
   - **Não** → a falta fica só registrada para controle: aparece no balanço diário do WhatsApp, mas não entra no pagamento nem nos recibos. O campo de valor fica travado em R$ 0,00.
   - Por fim, responda **"Reforço Contratual?"** — marque **Sim 🪙** quando a cobertura for um reforço previsto em contrato.
4. **Passo 4 — Comunicação:** toque no meio de comunicação (WhatsApp, Email ou "Não se aplica"). Se o cliente foi avisado, preencha **data**, **hora** e **detalhes** (ex.: "WhatsApp às 7h15"). Escreva **observações**, se preciso.
5. **Passo 5 — Revisar:** confira o resumo completo (inclusive se está "Extra (com pagamento)" ou "Não gera extra (sem pagamento)") e toque em **Salvar**.

**Deu certo:** aparece a tela verde com ✓ e a mensagem "Registro salvo!". Nela você pode tocar em **Novo registro** (lançar outra falta), **Ver lançamentos** ou **Voltar ao início**.

> ATENÇÃO: não lance o mesmo registro duas vezes. Se tentar repetir o mesmo colaborador + departamento + data, o sistema avisa "Já existe um extra lançado para..." — nesse caso, não insista e fale com a mesa de operações.

> ATENÇÃO: se aparecer mensagem de erro, **não tente de novo várias vezes** — anote o que aconteceu e avise a responsável, pois o registro pode ter sido salvo mesmo assim. E precisa de internet para salvar: se estiver sem sinal, anote e lance quando tiver conexão.

> DICA: se faltar preencher algo obrigatório, o sistema mostra o aviso "Preencha os campos obrigatórios" e marca o campo em vermelho. Dá para tocar nas bolinhas numeradas do topo para voltar a um passo anterior e corrigir.

### Campos e botões

- **Cabeçalho**: título "Nova falta", contador "Passo X de 5" e botão **X** (sair, voltando aos Lançamentos).
- **Bolinhas numeradas (1 a 5)**: mostram o progresso. As verdes (com ✓) são passos já concluídos — toque para voltar a eles.
- **Passo 1**: **Data da ocorrência**, **Turno** (botões), **Departamento**, **Categoria** e **Motivo** (listas de seleção).
- **Passo 2**: **Colaborador ausente** e **Substituto** — campos de busca com as opções especiais "Não tem colaborador ausente" e "Não tem colaborador substituto".
- **Passo 3**: **Gera extra para pagamento?** (Sim/Não), **Categoria de valor**, **Valor a pagar (R$)**, **Tipo** (Extra normal / Extra faturado) e **Reforço Contratual?** (Não / Sim 🪙).
- **Passo 4**: **Meio de comunicação** (WhatsApp, Email, Não se aplica), **Data**, **Hora**, **Detalhes** e **Observações**.
- **Passo 5**: resumo de tudo que foi preenchido, para conferência.
- **Voltar**: retorna ao passo anterior.
- **Próximo**: avança (valida os campos obrigatórios do passo).
- **Salvar** (botão verde, no passo 5): grava o registro. Enquanto grava, mostra "Salvando...".

## Dúvidas frequentes

**Lancei um extra errado. Como corrijo?**
Se for erro de preenchimento, clique no lápis na tela Lançamentos e edite. Se o lançamento não deveria existir, peça a alguém dos perfis Mesa ou Inspetoria (ou Administrador) para excluir pela lixeira — só esses perfis podem excluir.

**Qual a diferença entre "Gera extra = Não" e "Extra faturado"?**
"Gera extra" controla o **pagamento ao colaborador**: Não = ninguém recebe, o valor grava R$ 0,00 e o registro só aparece no balanço diário. "Extra faturado" controla a **cobrança do cliente** e independe do pagamento — um serviço pode não ser pago ao colaborador e mesmo assim ser faturado ao cliente.

**Ninguém cobriu a falta. O que eu marco no campo Substituto?**
Marque a opção **"Não tem colaborador substituto"**. O registro sai como **SEM NOME** nos relatórios, para a falta ficar anotada em vez de parecer esquecimento. Esse grupo não gera recibo — não há quem assinar.

**Posso pagar sem recibo assinado?**
Não. O botão de marcar como pago (cifrão, na tela Recibos) só libera depois que existe um **recibo assinado** do colaborador no período — digital (assinatura na tela) ou em papel. E os extras precisam bater exatamente com o recibo; se algo mudou, gere um novo recibo.

**O inspetor lançou pelo celular e deu erro. O que fazer?**
Não lance de novo no automático: o registro pode ter sido salvo. Confira primeiro na tela **Lançamentos** (filtre pela data e pelo posto). Se não estiver lá, aí sim refaça o lançamento.
