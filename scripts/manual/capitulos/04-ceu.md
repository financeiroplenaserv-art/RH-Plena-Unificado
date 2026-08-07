# Capítulo 4 — CEU (Crachá, Equipamento e Uniforme)

O módulo CEU é onde você controla tudo o que a empresa entrega aos colaboradores: crachás, uniformes, equipamentos e EPIs (equipamentos de proteção individual). Com ele você registra entregas e devoluções, emite recibos para assinatura, acompanha o estoque e sabe exatamente o que está com cada pessoa. O módulo tem oito abas no topo da tela: **Movimentações**, **Itens**, **Lançamento Rápido**, **Tamanhos**, **Relatórios**, **Fornecedores** e **Importar**. Este capítulo explica cada uma delas.

---

## Movimentações

É a tela principal do módulo. Ela mostra a lista de todas as entregas e devoluções registradas, agrupadas por colaborador e por data. Daqui você registra devoluções, emite recibos (um por um ou em lote) e exclui entregas lançadas por engano.

[IMAGEM: ceu-movimentacoes.png]

Acima da tabela há uma legenda de cores: **laranja** para EPI, **verde** para Uniforme, **amarelo** para Crachá, **azul** para Equipamento e **cinza** para outros tipos. Um item devolvido aparece riscado, com a data da devolução ao lado.

### Como fazer

**Filtrar a lista**

1. Clique no botão **Filtros**, no topo da tela. O painel de filtros se abre.
2. Preencha o que quiser: nome ou matrícula do colaborador, período (data inicial e final), item, departamento ou status.
3. Clique em **Aplicar**. Nada muda na lista enquanto você não clicar em Aplicar (ou apertar Enter no campo de busca).
4. Para voltar a ver tudo, clique em **Limpar**.

> DICA: Se você mudou algum campo e esqueceu de aplicar, a tela mostra o aviso amarelo "Alterações não aplicadas". Enquanto houver filtros valendo, o botão Filtros mostra um selo azul com a quantidade de filtros ativos — assim você sabe que a lista está "cortada", mesmo com o painel fechado.

**Registrar uma devolução**

1. Na linha da entrega, clique no ícone de **seta circular** (a dica "Registrar devolução" aparece ao passar o mouse).
2. Na janela que abre, marque os itens que foram devolvidos.
3. Confira ou ajuste a **data da devolução** (ela já vem preenchida com o dia de hoje).
4. Clique em **Confirmar**. O sistema mostra a mensagem verde "Devolução registrada com sucesso" e o item passa a aparecer riscado na lista.

**Emitir o recibo de uma entrega**

1. Na linha da entrega, clique no botão **Recibo**.
2. O sistema gera o recibo e abre uma janela de visualização, já com o número do documento (ex.: REC-2026-00042).
3. Escolha a versão **Colorido (Digital)** ou **P&B (Impressão)** nas abas.
4. Clique em **Baixar Colorido** ou **Baixar P&B**. Um arquivo é baixado para o seu computador; abra-o no navegador e imprima para o colaborador assinar.

> ATENÇÃO: Depois que o recibo é emitido, a entrega não pode mais ser excluída — a lixeira fica desabilitada com a dica "Exclusão bloqueada: recibo já emitido". Recibo emitido é um documento definitivo.

> DICA: Se a entrega misturar EPI com uniforme/crachá, o sistema gera dois recibos separados, um para cada grupo, e mostra as abas "EPI" e "Uniforme/Crachá" na mesma janela. O CPF sai sempre no formato 000.000.000-00, e o recibo cabe sempre em uma única página A4.

**Emitir recibos em lote**

1. Clique em **Emitir recibos em lote**, no topo da tela.
2. Informe a **Data início** e a **Data fim** do período.
3. Clique em **Gerar recibos**. O sistema mostra a mensagem verde com a quantidade de recibos gerados e baixa um único arquivo com todos os recibos do período, agrupados por colaborador. Abra o arquivo no navegador e imprima de uma vez.
4. Se não houver nenhuma entrega no período, o sistema avisa: "Nenhuma entrega no período selecionado".

**Excluir uma entrega lançada por engano**

1. Na linha da entrega, clique no ícone de **lixeira**.
2. A janela "Remover entrega?" avisa que a ação não pode ser desfeita.
3. Clique em **Excluir** (botão vermelho). O sistema mostra a mensagem verde "Entrega removida com sucesso".

> ATENÇÃO: Só é possível excluir entregas que ainda não tiveram recibo emitido. Se o recibo já foi gerado, corrija o cadastro com o Administrador.

### Campos e botões

- **Nova Entrega** (botão azul): abre a tela de registro de entrega passo a passo. Aparece para Gestor, DP1, DP2, Mesa e Inspetoria, além do Administrador.
- **Emitir recibos em lote**: gera todos os recibos de um período de uma só vez.
- **Importar Planilha**: leva para a aba Importar. Aparece para Gestor, DP1 e DP2, além do Administrador.
- **Filtros**: abre ou fecha o painel de filtros.
- **Busca** (dentro dos filtros): procura por nome do colaborador ou matrícula.
- **Data inicial / Data final**: limitam o período exibido.
- **Item**: mostra só as entregas de um item específico.
- **Departamento**: digite e escolha o departamento na lista de sugestões.
- **Status**: opções Todos, Em aberto (ainda não devolvido) e Devolvido.
- **Aplicar**: aplica os filtros escolhidos.
- **Limpar**: zera todos os filtros.
- **Colunas da tabela**: Data, Colaborador (com a matrícula embaixo), Itens (com a quantidade entre parênteses), Qtd Total e Ações. Clique no título de uma coluna para ordenar a lista por ela.
- **Recibo** (por linha): gera e mostra o recibo da entrega.
- **Seta circular** (por linha): registra devolução. Só aparece quando há item em aberto.
- **Lixeira** (por linha): exclui a entrega. Aparece para Gestor, DP1 e DP2, além do Administrador — Mesa e Inspetoria não veem este botão.
- **Anterior / Próxima** (no rodapé): navegam entre as páginas da lista, que mostra 50 entregas por vez e informa "Mostrando X a Y de N resultados".

> DICA: Quando a lista está vazia, a tela mostra "Nenhuma movimentação encontrada." — verifique se há algum filtro ativo esquecido.

---

## Nova Entrega

É a tela de registro de entrega, organizada em três passos guiados: escolher o colaborador, escolher os itens e confirmar. Use-a quando quiser registrar a entrega de uma pessoa com calma, vendo o histórico dela na tela. Para lançar várias entregas de uma vez, prefira o Lançamento Rápido.

[IMAGEM: ceu-entrega-nova.png]

### Como fazer

1. Na tela Movimentações, clique em **Nova Entrega**.
2. **Passo 1 — Selecionar colaborador:** digite o nome ou a matrícula no campo e escolha a pessoa na lista de sugestões. A tela mostra um cartão com os dados dela (matrícula, departamento, status, cargo e e-mail) e, embaixo, o histórico de tudo o que ela já recebeu. Clique em **Próximo**.
3. **Passo 2 — Selecionar itens:** marque a caixinha de cada item que será entregue. Se precisar, use a busca "Nome, código ou CA..." e os seletores de Tipo e Subgrupo para achar o item. Para cada item marcado, ajuste a **Quantidade** e a **Situação**. Clique em **Próximo**.
4. **Passo 3 — Confirmar entrega:** confira a **Data da entrega** (já vem com o dia de hoje, mas pode ser alterada) e escreva uma observação se quiser. Clique em **Confirmar entrega**.
5. O sistema mostra a mensagem verde "entrega(s) registrada(s) com sucesso" e abre a tela final de confirmação.
6. Na tela final, clique em **Visualizar recibo** para gerar o recibo na hora, ou em **Ver entregas** para voltar à lista de Movimentações.

> DICA: É prática operacional da empresa datar os recibos no dia 1º do mês, mesmo quando o documento é preparado antes. A própria tela lembra disso abaixo do campo de data: "Pode ser usada a data de 1º do mês, mesmo que o recibo seja preparado antes."

> ATENÇÃO: A Situação de cada item já vem preenchida como **Troca**, porque a maioria das entregas é de reposição. Mude para **Novo** apenas quando for o kit de admissão do colaborador. Essa escolha sai impressa no recibo.

> ATENÇÃO: Uma entrega registrada não pode ser editada. Se algo saiu errado, exclua a entrega na tela Movimentações e registre de novo (vale apenas antes de emitir o recibo).

### Campos e botões

- **Voltar** (seta no topo): retorna à tela Movimentações.
- **Colaborador** (Passo 1): busca por nome ou matrícula; obrigatório. Só aparecem colaboradores ativos.
- **Buscar item** (Passo 2): procura o item por nome, código ou número do CA.
- **Tipo (Grupo)**: filtra a lista por tipo de item (EPI, Uniforme, Crachá etc.).
- **Subgrupo**: filtra dentro do tipo escolhido (as opções mudam conforme o Tipo).
- **Caixinha de seleção** (por item): marca o item para a entrega. Desmarcar remove o item da seleção.
- **Quantidade** (por item): quantas unidades serão entregues; começa em 1 e só fica editável depois de marcar o item.
- **Situação** (por item): opções Novo, Substituição, Troca e Extravio/Perda. Padrão: Troca.
- **Limpar filtros** (Passo 2): zera a busca e os seletores de tipo e subgrupo.
- **Data da entrega** (Passo 3): obrigatória; aceita qualquer data, inclusive 1º do mês.
- **Observação** (Passo 3): campo livre, opcional (ex.: "Tamanho M, substituição..."). Vale para todos os itens do lote.
- **Próximo**: avança de passo. Se faltar algo, o sistema avisa em vermelho: "Selecione um colaborador para continuar" ou "Selecione pelo menos um item".
- **Confirmar entrega**: grava a entrega. Se algo falhar, o sistema avisa "Não foi possível registrar as entregas. Nada foi salvo — verifique e tente novamente." — nesse caso nada é gravado pela metade.
- **Ver entregas / Visualizar recibo** (tela final): voltam à lista ou abrem o recibo para impressão.

> DICA: O alerta de estoque não impede a entrega. Se o item estiver zerado ou abaixo do estoque mínimo, a tela mostra avisos em vermelho ou laranja ("Sem estoque", "mín: N"), mas você pode seguir normalmente — é só uma informação.

---

## Lançamento Rápido

É uma planilha de lançamento em massa, feita para registrar muitas entregas de uma vez — por exemplo, o dia de distribuição de uniformes para uma equipe inteira. Você preenche linha por linha e salva tudo com um único clique.

[IMAGEM: ceu-lancamento-rapido.png]

A grade já abre com 5 linhas em branco, com a data de hoje, quantidade 1 e Status "Troca" preenchidos. Uma legenda no topo explica as cores: **verde** significa campo preenchido corretamente e **cinza**, campo vazio.

### Como fazer

**Lançar várias entregas de uma vez**

1. Na primeira linha, confira a **Data** e escolha o **Colaborador**: digite o nome ou a matrícula e selecione a pessoa na lista de sugestões (é preciso escolher da lista; texto digitado sem selecionar não vale).
2. Escolha o **Tipo** (EPI, Uniforme ou Crachá).
3. Informe o produto por um dos dois caminhos:
   - digite o código ou o número do CA no campo **Código** — o sistema localiza o item e preenche o Produto sozinho; ou
   - digite parte do nome no campo **Produto** e escolha o item na lista de sugestões.
4. Ajuste a **Qtd** e o **Status**, se preciso.
5. Aperte **Enter** no campo Qtd (ou clique no ícone de copiar da linha): uma nova linha é criada logo abaixo, já com a mesma data e o mesmo colaborador — basta informar o próximo item. Os campos repetidos ficam em azul para indicar que vieram da linha de cima.
6. Repita até lançar tudo. Se faltar linha, clique em **+5 Linhas** ou **+10 Linhas**.
7. Clique em **Salvar**. O sistema mostra a mensagem verde com a quantidade de entregas registradas e leva você de volta à tela Movimentações.

> DICA: Se alguma linha ficou incompleta, ela não é perdida: o sistema avisa "N linha(s) ficaram de fora (campos incompletos) — elas permanecem na tela" e mantém essas linhas na grade para você corrigir e salvar de novo.

> DICA: Tudo o que você digita fica guardado automaticamente no navegador. Se fechar a tela sem salvar, as linhas continuam lá quando você voltar. O rascunho só é apagado depois de um salvamento completo.

**Sobre os tamanhos (coluna Tam.)**

Quando você escolhe o colaborador e ele tem medidas cadastradas na aba Tamanhos, aparece abaixo do nome dele uma linha cinza com o resumo, por exemplo: "📏 Camisa M · Calça 42 · Calçado 40 · Luva G". Na coluna **Tam.**, o sistema mostra a medida de referência daquele item:

- **Selo azul**: o tamanho do item escolhido confere com o cadastro.
- **Selo vermelho em negrito**: o item escolhido tem tamanho diferente do cadastro (ex.: o cadastro indica luva M, mas você escolheu o item "LUVA LATEX G"). Passe o mouse para ver o aviso completo.

> ATENÇÃO: O selo vermelho é só um alerta para você conferir antes de salvar — ele **não bloqueia** o lançamento. O tamanho é apenas uma referência visual e não é gravado na entrega nem impresso no recibo.

### Campos e botões

- **Data** (por linha): data da entrega; obrigatória. Já vem com o dia de hoje.
- **Colaborador** (por linha): busca por nome ou matrícula; obrigatório; só sugere colaboradores ativos.
- **Tipo** (por linha): EPI, Uniforme ou Crachá; obrigatório.
- **Código** (por linha): aceita o código do item, o número do CA ou o código interno. Se não encontrar, o campo fica vermelho com o aviso "Código não encontrado no cadastro".
- **Produto** (por linha): busca o item pelo nome, respeitando o Tipo escolhido; é preciso escolher da lista de sugestões.
- **Tam.** (por linha): selo de referência com o tamanho do cadastro do colaborador (somente leitura).
- **Qtd** (por linha): quantidade entregue; começa em 1.
- **Status** (por linha): opções Troca, Novo, Substituição e Devolução. Padrão: Troca.
- **Ícone de copiar** (por linha): cria uma nova linha abaixo repetindo data e colaborador (dica: "Repetir data e colaborador numa nova linha").
- **Ícone de lixeira** (por linha): apaga a linha da grade, sem pedir confirmação.
- **+5 Linhas / +10 Linhas**: acrescentam linhas em branco no fim da grade, repetindo a data e o status da última linha.
- **Salvar**: grava todas as linhas completas. Fica desabilitado até existir pelo menos uma linha completa; se você tentar salvar sem nenhuma, o sistema avisa "Preencha pelo menos uma linha corretamente". Os mesmos botões aparecem no topo e no fim da página.

---

## Itens

É o cadastro de tudo o que a empresa entrega: crachás, uniformes, EPIs e equipamentos. Aqui você vê a lista completa, com código, CA, validade, estoque e valor de cada item, e acessa o formulário de cadastro e edição.

[IMAGEM: ceu-itens.png]

### Como fazer

**Encontrar um item**

1. Use o campo de busca "Nome, código ou CA..." ou os seletores **Tipo** e **Fornecedor**.
2. Clique em **Aplicar**. Para recomeçar, clique em **Limpar**.

**Cadastrar um item**

1. Clique em **Novo item**, no canto superior direito.
2. Preencha o formulário (detalhado na próxima seção) e clique em **Salvar item**.
3. O sistema mostra a mensagem verde "Item criado com sucesso" e volta para a lista.

**Editar um item**

1. Na linha do item, clique no ícone de **lápis**.
2. Altere o que precisar e clique em **Salvar item**.
3. O sistema mostra a mensagem verde "Item atualizado com sucesso" e volta para a lista.

**Excluir um item**

1. Na linha do item, clique no ícone de **lixeira**.
2. A janela "Remover item?" avisa que a ação não pode ser desfeita.
3. Clique em **Excluir**. O sistema mostra a mensagem verde "Item removido com sucesso".

> ATENÇÃO: A exclusão é definitiva. Se o item apenas saiu de uso (parou de ser comprado, por exemplo), o mais seguro é editá-lo e mudar a **Situação** para **Inativo** — assim ele sai das telas de entrega, mas o histórico das entregas antigas continua intacto.

### Campos e botões

- **Novo item**: abre o formulário de cadastro. Aparece para Gestor, DP1 e DP2, além do Administrador.
- **Busca**: procura por nome, código ou número do CA.
- **Tipo**: filtra por Crachá, Uniforme ou EPI (opção padrão: Todos os tipos).
- **Fornecedor**: filtra por um fornecedor cadastrado (opção padrão: Todos os fornecedores).
- **Aplicar / Limpar**: aplicam ou zeram os filtros.
- **Colunas da tabela**: Nome, Código, Tipo (selo colorido: amarelo para Crachá, verde para Uniforme, laranja para EPI), CA, Validade, Unidade, Última compra, Situação (selo azul "Ativo" ou vermelho "Inativo") e Valor.
- **Lápis** (por linha): abre o item para edição.
- **Lixeira** (por linha): exclui o item, com confirmação.
- Quando a busca não encontra nada, a tela mostra "Nenhum item encontrado."

---

## Novo item / Editar item

É o formulário de cadastro do item, usado tanto para criar quanto para editar. Os campos de CA (Certificado de Aprovação) só aparecem quando o tipo do item é EPI.

[IMAGEM: ceu-item-novo.png]

### Como fazer

1. Na tela Itens, clique em **Novo item** (ou no lápis de um item existente).
2. Escolha o **Tipo** (obrigatório). Se quiser, escolha também o **Subgrupo** — as opções mudam conforme o tipo.
3. Preencha o **Nome** (obrigatório) e os demais campos que fizerem sentido.
4. Se o item for EPI, informe o **Certificado de Aprovação (CA)** e a **Validade do CA**.
5. Clique em **Salvar item**. O botão fica desabilitado enquanto Nome ou Tipo estiverem vazios; se tentar salvar sem eles, o sistema avisa "Preencha nome e tipo do item".
6. O sistema mostra a mensagem verde "Item criado com sucesso" (ou "Item atualizado com sucesso", na edição) e volta para a lista.

> ATENÇÃO: O CA e a validade só valem para EPI. Se você mudar o tipo de um item para algo diferente de EPI, esses dois campos são apagados ao salvar.

> DICA: O cadastro do item pode ser atualizado livremente — por exemplo, quando o fabricante troca o CA. Recibos já emitidos não mudam: cada recibo guarda o CA que o item tinha na data da entrega, mesmo que o cadastro mude depois. Isso vale para entregas futuras e passadas, sem que você precise fazer nada.

### Campos e botões

- **Voltar**: retorna à lista de itens (não há botão "Cancelar" — use o Voltar para sair sem gravar).
- **Tipo** (obrigatório): Crachá, Uniforme ou EPI.
- **Subgrupo**: opcional; fica travado até você escolher o tipo. Para EPI: Cabeça, Ocular, Auricular, Respiratória, Mãos, Pés, Vestimenta ou Facial. Para Uniforme: Vestuário Superior, Vestuário Inferior ou Acessórios. Para Crachá: Crachá.
- **Nome** (obrigatório): como o item será chamado nas telas de entrega e nos recibos.
- **Código**: código interno do item; usado na busca e no Lançamento Rápido.
- **Valor unitário (R$)**: valor de compra, digitado já no formato de moeda.
- **Fornecedor**: escolha um fornecedor cadastrado na aba Fornecedores, ou deixe "Nenhum".
- **Unidade**: unidade de medida livre (ex.: UN, PA, KG).
- **Última compra**: data da última compra do item.
- **Situação**: Ativo (padrão) ou Inativo. Itens inativos somem das telas de entrega.
- **Estoque atual**: quantidade em estoque; alimenta o relatório de controle de estoque.
- **Estoque mínimo**: limite de alerta; quando o estoque atual chega nele ou abaixo, o item aparece no relatório de estoque e nos avisos da tela de entrega.
- **Prazo de uso (dias)**: tempo de vida do item após a entrega; alimenta o alerta de "prazo de troca" nos relatórios.
- **Certificado de Aprovação (CA)** (só para EPI): número do CA impresso no recibo.
- **Validade do CA** (só para EPI): data de vencimento do certificado; alimenta o alerta de vencimento nos relatórios.
- **Salvar item**: grava o cadastro e volta para a lista.
- Não existe campo de tamanho no item: as medidas são de cada colaborador e ficam na aba Tamanhos.

---

## Tamanhos

É o cadastro das medidas de uniforme e EPI de cada colaborador: camisa, calça, calçado e luva. O que você registra aqui aparece como referência no Lançamento Rápido, ajudando a escolher o item certo na hora da entrega.

[IMAGEM: ceu-tamanhos.png]

A tela lista todos os colaboradores ativos em ordem alfabética — inclusive os que ainda não têm nenhuma medida, justamente para você completar o cadastro. A descrição no topo mostra quantos já têm tamanho cadastrado (ex.: "Medidas de uniforme e EPI — 162 de 314 colaboradores ativos com tamanho cadastrado").

### Como fazer

**Cadastrar ou corrigir as medidas de um colaborador**

1. Se precisar, localize a pessoa no campo de busca "Buscar por nome, matrícula ou função...".
2. Na linha do colaborador, clique em **Preencher** (quando ainda não há medida) ou **Editar** (quando já existe).
3. Um cartão de edição abre no topo da página, com o título "Tamanhos de <nome do colaborador>".
4. Preencha os campos **Camisa**, **Calça**, **Calçado** e **Luva**. Deixar um campo em branco apaga aquela medida.
5. Clique em **Salvar tamanhos**. O sistema mostra a mensagem verde "Tamanhos de <nome> salvos" e o cartão se fecha.
6. Para sair sem gravar, clique em **Cancelar**.

### Campos e botões

- **Busca**: filtra por nome, matrícula, cargo completo ou abreviação da função (buscar "ASG", por exemplo, encontra os auxiliares de serviços gerais). A busca fica guardada quando você sai da tela; para zerá-la, clique em **Limpar** no selo "1 filtro ativo".
- **Colunas da tabela**: Colaborador (com a matrícula embaixo), Função (abreviada — passe o mouse para ver o cargo completo), Camisa, Calça, Calçado e Luva. Campos sem cadastro mostram "—".
- **Preencher / Editar** (por linha): abrem o cartão de edição das medidas.
- **Camisa / Calça / Calçado / Luva** (no cartão de edição): campos livres, com exemplos no próprio campo ("Ex.: M, G, GG"; "Ex.: 40, 42"; "Ex.: P, M, G, XG").
- **Salvar tamanhos**: grava as medidas.
- **Cancelar**: fecha o cartão sem gravar.
- Os botões de edição aparecem para Gestor, DP1, DP2, Mesa e Inspetoria, além do Administrador. Os demais perfis veem a lista, mas não podem alterar.

> DICA: As medidas são apenas uma referência visual. Elas não são gravadas nas entregas nem impressas nos recibos — servem para orientar quem lança e acender o alerta vermelho de divergência no Lançamento Rápido.

---

## Fornecedores

É o cadastro dos fornecedores dos itens de CEU. Tudo acontece na mesma tela: o formulário fica no topo e a lista, embaixo.

[IMAGEM: ceu-fornecedores.png]

### Como fazer

**Cadastrar um fornecedor**

1. Preencha o **Nome** (obrigatório) e, se quiser, CNPJ, telefone e e-mail.
2. Clique em **Cadastrar**. O sistema mostra a mensagem verde "Fornecedor criado com sucesso" e o fornecedor aparece na lista.

**Editar um fornecedor**

1. Na linha do fornecedor, clique no ícone de **lápis**. Os dados sobem para o formulário, que passa a se chamar "Editar fornecedor".
2. Altere o que precisar e clique em **Atualizar**. O sistema mostra a mensagem verde "Fornecedor atualizado com sucesso".
3. Para desistir da edição, clique em **Cancelar** — o formulário volta ao modo de cadastro.

**Excluir um fornecedor**

1. Na linha do fornecedor, clique no ícone de **lixeira**.
2. A janela "Remover fornecedor?" avisa que a ação não pode ser desfeita.
3. Clique em **Excluir**. O sistema mostra a mensagem verde "Fornecedor removido com sucesso".

**Encontrar um fornecedor**

1. Digite no campo "Buscar por nome ou CNPJ..." — a lista se filtra sozinha a cada letra digitada, sem precisar de botão.

### Campos e botões

- **Nome** (obrigatório): razão social ou nome fantasia.
- **CNPJ**: digite com a pontuação (00.000.000/0000-00).
- **Telefone**: a formatação (00) 00000-0000 é aplicada automaticamente enquanto você digita.
- **E-mail**: e-mail de contato do fornecedor.
- **Cadastrar / Atualizar**: grava o fornecedor (o rótulo muda conforme o modo).
- **Cancelar**: aparece só durante uma edição; limpa o formulário.
- **Lápis** (por linha): carrega o fornecedor no formulário para edição.
- **Lixeira** (por linha): exclui o fornecedor, com confirmação. A exclusão é definitiva.
- **Colunas da lista**: Nome, CNPJ, Telefone e E-mail (campos vazios mostram "—").
- O formulário e os botões de ação aparecem para Gestor, DP1 e DP2, além do Administrador. Os demais perfis só veem a lista.

---

## Relatórios

Reúne cinco visões diferentes das movimentações e do estoque, para análise e acompanhamento. Todas respeitam os filtros aplicados no topo da tela, e todas podem ser exportadas para planilha.

[IMAGEM: ceu-relatorios.png]

### Como fazer

**Gerar um relatório**

1. No cartão **Filtros**, preencha o que quiser: período, colaborador, item, grupo, departamento ou status.
2. Clique em **Aplicar**. Nada muda enquanto você não clicar em Aplicar — se esquecer, o aviso amarelo "Alterações não aplicadas" aparece.
3. Clique na aba do relatório desejado:
   - **Por colaborador**: tudo o que cada pessoa recebeu, agrupado por colaborador, com o botão **Gerar Recibo** em cada bloco para reemitir os recibos daquela pessoa.
   - **Por data**: as entregas em ordem de data.
   - **Itens com colaboradores**: mostra quem está com cada item **em aberto** (ainda não devolvido) — útil para saber onde está cada equipamento.
   - **Alertas de vencimento**: duas listas — os CAs de EPI vencidos ou vencendo em até 30 dias, e os colaboradores com itens chegando ao fim do prazo de troca.
   - **Controle de estoque**: os itens que atingiram ou ficaram abaixo do estoque mínimo, do mais crítico ao menos crítico.

**Exportar para planilha**

1. Aplique os filtros e abra a aba desejada.
2. Clique em **Exportar Excel** (arquivo .xlsx) ou **Exportar TSV** (arquivo de texto que também abre no Excel).
3. O arquivo é baixado para o seu computador com as colunas da aba aberta e os dados filtrados.

**Gerar os recibos de todo o relatório de uma vez**

1. Na aba **Por colaborador**, aplique os filtros desejados.
2. Clique em **Relatório em Lote**.
3. O sistema mostra a mensagem verde com a quantidade de recibos gerados e baixa um único arquivo com todos os recibos, pronto para imprimir e colher assinaturas.

> DICA: Apesar do nome, o "Relatório em Lote" não gera uma planilha — ele gera os recibos de entrega para impressão, um por colaborador, dentro dos filtros aplicados.

### Campos e botões

- **Data inicial / Data final**: limitam o período analisado.
- **Colaborador**: restringe a uma pessoa (padrão: Todos).
- **Item**: restringe a um item (só aparecem itens que tiveram movimentação).
- **Grupo**: filtra pelo tipo do item (EPI, Uniforme, Crachá etc.).
- **Departamento**: digite e escolha o departamento na lista de sugestões.
- **Status**: Todos, Em aberto ou Devolvido.
- **Aplicar / Limpar**: aplicam ou zeram os filtros. Os filtros ficam guardados quando você sai da tela.
- **Exportar Excel / Exportar TSV**: baixam os dados da aba aberta, com os filtros aplicados.
- **Relatório em Lote** (aba Por colaborador): gera os recibos de todas as entregas filtradas em um único arquivo.
- **Gerar Recibo** (em cada bloco de colaborador, aba Por colaborador): abre a janela de recibo daquela pessoa, com as versões colorida e P&B.
- Nas tabelas, a coluna **Status** mostra o selo "Devolvido" ou "Em aberto"; nos alertas, os selos são "Vencido" e "Próximo do vencimento" (ou "Próximo da troca").
- Se a consulta não encontrar nada, cada aba mostra seu próprio aviso (ex.: "Nenhum resultado encontrado.", "Nenhum item abaixo do estoque mínimo.").

---

## Importar

Serve para cadastrar ou atualizar itens e fornecedores em massa, a partir de uma planilha, em vez de digitar um por um.

[IMAGEM: ceu-importar.png]

### Como fazer

**Importar itens**

1. No cartão **Tipo de importação**, clique em **Itens**. A tela mostra as colunas que a planilha deve ter: id, codigo, nome, tipo, valor, ca, validade, subgrupo, estoque, estoque_minimo e prazo_uso_dias.
2. Se você quer **alterar itens já cadastrados**, clique primeiro em **Baixar modelo com itens atuais**: o sistema baixa uma planilha pronta com todos os itens. Edite nela e importe de volta — assim o sistema atualiza os itens em vez de criar duplicados.
3. Clique na área de upload (ou arraste o arquivo para ela) e escolha a planilha. São aceitos arquivos CSV e Excel (.xlsx, .xls); no Excel, apenas a primeira aba da planilha é lida.
4. Confira o **Preview**: a tela mostra quantas linhas estão válidas e quantas inválidas, com o motivo do erro em cada linha (ex.: "Nome obrigatório", "Tipo obrigatório"). Linhas inválidas ficam com fundo vermelho.
5. Clique em **Importar válidos**. Só as linhas válidas entram; as inválidas são ignoradas.
6. Ao final, o sistema mostra a mensagem verde com o total: "N registro(s) importado(s) com sucesso".
7. Para desistir, clique em **Cancelar** ou no **X** ao lado do nome do arquivo.

**Importar fornecedores**

1. No cartão **Tipo de importação**, clique em **Fornecedores**. Colunas da planilha: nome, cnpj, telefone e email.
2. Escolha o arquivo, confira o preview e clique em **Importar válidos**.

> ATENÇÃO: A importação de fornecedores **sempre cria novos cadastros** — ela não verifica duplicidade. Se você importar o mesmo arquivo duas vezes, os fornecedores ficarão duplicados.

> DICA: Para itens, a regra é diferente: se a linha tiver o id de um item existente ou um código igual ao de um item já cadastrado, o item é **atualizado**. Por isso o caminho seguro para alterações em massa é sempre: baixar o modelo, editar, importar de volta.

### Campos e botões

- **Itens / Fornecedores** (cartões do Passo 1): escolhem o tipo de importação. Trocar de tipo descarta o arquivo e o preview.
- **Baixar modelo com itens atuais** (só no tipo Itens): baixa a planilha-modelo preenchida com os itens cadastrados. Fica desabilitado se ainda não houver nenhum item.
- **Área de upload** ("Clique para fazer upload ou arraste o arquivo"): recebe arquivos CSV ou Excel (.xlsx, .xls).
- **X** (ao lado do nome do arquivo): remove o arquivo escolhido.
- **Preview**: tabela de conferência com o selo "Válido" ou "Inválido" em cada linha e a coluna Erros explicando o problema.
- **Cancelar**: descarta o arquivo e o preview.
- **Importar válidos**: executa a importação das linhas válidas (fica desabilitado se não houver nenhuma; se o arquivo estiver vazio ou ilegível, o sistema avisa "Arquivo vazio ou formato inválido").
- O acesso à importação aparece para Gestor, DP1 e DP2, além do Administrador.

---

## Dúvidas frequentes

**Registrei uma entrega errada. Como corrijo?**
Na tela Movimentações, clique na lixeira da entrega e confirme — depois registre novamente. Atenção: isso só funciona antes de o recibo ser emitido. Se o recibo já foi gerado, a exclusão fica bloqueada e você deve pedir ajuda ao Administrador.

**O fabricante mudou o CA de um EPI. Os recibos antigos ficam errados?**
Não. Cada recibo guarda o CA que o item tinha na data da entrega. Você pode atualizar o cadastro do item normalmente: as entregas futuras sairão com o CA novo, e os recibos antigos continuam mostrando o CA da época.

**Por que o selo de tamanho ficou vermelho no Lançamento Rápido?**
Porque o item escolhido tem tamanho diferente do cadastrado na aba Tamanhos (ex.: cadastro indica luva M e o item é G). É só um alerta para você conferir — o lançamento não é bloqueado. Se estiver certo mesmo, pode salvar; se a medida mudou, atualize a aba Tamanhos.

**Posso datar o recibo no dia 1º do mês?**
Sim. É a prática operacional da empresa: o campo "Data da entrega" é livre, e a própria tela de Nova Entrega lembra que a data de 1º do mês pode ser usada mesmo que o recibo seja preparado antes.

**Como imprimir os recibos de um mês inteiro de uma vez?**
Na tela Movimentações, clique em **Emitir recibos em lote**, informe o período e clique em **Gerar recibos**. O sistema baixa um único arquivo com todos os recibos agrupados por colaborador; abra o arquivo no navegador e imprima. O mesmo resultado pode ser obtido na aba Relatórios, botão **Relatório em Lote**, respeitando os filtros aplicados.
