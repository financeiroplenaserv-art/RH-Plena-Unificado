# Capítulo 10 — Gestão: e-Contador, Auditoria, Permissões, Configurações e Relatórios

Este capítulo reúne as telas de administração do sistema. É aqui que você importa colaboradores do sistema contábil, consulta o histórico de ações dos usuários, define o que cada perfil pode fazer e encontra os atalhos para todos os relatórios. Em geral, essas telas são usadas pelo Administrador e por perfis de gestão.

## Importação e-Contador

A tela e-Contador traz empresas e funcionários diretamente do sistema contábil Alterdata para dentro do CORH, sem digitação manual. Você informa o token de acesso uma única vez, escolhe a empresa e importa os funcionários com poucos cliques. Somente os perfis **Administrador, DP1 e DP2** acessam esta tela.

[IMAGEM: importar-econtador.png]

A tela é organizada em passos numerados: primeiro o token, depois a empresa, depois a lista de funcionários.

> ATENÇÃO: o token de acesso fica salvo de forma segura e nunca aparece na tela. Depois de salvo, a tela mostra apenas o aviso "🔒 Token salvo de forma segura. Ele não é exibido nem transita nesta página."

### Como fazer

**Salvar o token pela primeira vez:**

1. No passo **1. Token de acesso**, cole o token do e-Contador Alterdata no campo **Token JWT** (o texto digitado fica oculto, como uma senha).
2. Clique em **Salvar token e listar empresas**.
3. O sistema mostra a mensagem verde "Token salvo" e, em seguida, carrega as empresas no passo 2. Se nenhuma empresa for encontrada, aparece o aviso "Nenhuma empresa Plena encontrada no e-Contador com este token".

**Importar funcionários de uma empresa:**

1. Com o token salvo, clique em **Listar empresas** (nas próximas vezes o token já estará gravado, não precisa digitar de novo).
2. No passo **2. Selecionar empresa**, clique no botão com o nome da empresa desejada. O sistema carrega os funcionários e mostra uma barra de progresso com a contagem de registros.
3. Se quiser, escolha no seletor **Importar** o tipo de lista: todos, somente ativos, demitidos nos últimos 15 dias ou admitidos nos últimos 15 dias. A lista é recarregada conforme a escolha.
4. Opcional: use o campo de busca para localizar funcionários por nome, matrícula, CPF ou departamento.
5. Opcional: marque a caixinha de cada funcionário que deseja importar (ou a caixinha do cabeçalho para marcar todos da página). Se nenhum estiver marcado, o sistema importa todos da lista.
6. Clique no botão azul **Importar ... funcionários** (o texto mostra a quantidade que será importada).
7. Ao final, o sistema mostra etiquetas coloridas com o resultado: verde para "novos", azul para "atualizados" e vermelho para "erros". Se houver erros, uma caixa vermelha chamada **Detalhes dos erros** lista o nome do colaborador e o motivo.

> DICA: quem já existe no sistema é atualizado com os dados novos; quem não existe é cadastrado. Por isso você pode repetir a importação sem medo de duplicar cadastros.

**Reimportar a partir do histórico:**

1. No cartão **Histórico de importações**, localize a linha da importação desejada.
2. Clique em **Reimportar**. O sistema refaz a importação daquela empresa e mostra o resultado na tela.

**Exportar a lista sem importar:**

1. Carregue os funcionários da empresa.
2. Clique em **Excel** ou **CSV**. O arquivo é baixado pelo navegador com a lista exibida na tela (o CPF sai parcialmente oculto, por segurança).

**Redefinir o token:**

1. Com o token salvo, clique em **Redefinir token** no passo 1.
2. O sistema mostra "Token removido", o campo de digitação volta a aparecer e a lista de empresas é limpa.
3. Cole o novo token e salve novamente.

**Limpar o histórico da tela:**

1. Clique em **Limpar** no cartão do histórico.
2. Na janela "Limpar histórico?", clique em **Limpar** para confirmar (ou **Cancelar** para desistir).
3. O sistema avisa que o histórico foi limpo apenas da tela; os registros continuam guardados no sistema.

### Campos e botões

- **Token JWT**: campo para colar o token de acesso do e-Contador. Some depois de salvo, dando lugar ao aviso de cadeado.
- **Salvar token e listar empresas**: grava o token e já busca as empresas disponíveis.
- **Listar empresas**: aparece quando o token já está salvo; apenas recarrega a lista de empresas.
- **Redefinir token**: apaga o token salvo para permitir informar outro.
- **Botões de empresa** (passo 2): cada botão mostra o nome e o código da empresa; clicar carrega os funcionários dela.
- **Importar (seletor)**: escolhe o recorte da lista — "Importar todos", "Importar somente ativos", "Importar demitidos nos últimos 15 dias" ou "Importar admitidos nos últimos 15 dias".
- **Campo de busca**: filtra a lista por nome, matrícula, CPF ou departamento, conforme você digita.
- **Excel**: baixa a lista exibida em planilha Excel (matrícula, nome, CPF, departamento, status, cargo, admissão, cidade e e-mail).
- **CSV**: baixa a lista exibida em arquivo CSV (matrícula, nome, CPF, departamento, status, cargo e admissão).
- **Caixinhas de seleção**: marcam funcionários específicos para importar; a caixinha do cabeçalho marca/desmarca todos da página.
- **Setas de página**: navegam pela lista, que mostra 50 funcionários por página.
- **Importar ... funcionários**: botão azul que grava os funcionários no sistema; mostra a quantidade de selecionados ou o total da lista.
- **Cartões de resumo** (topo da tela): mostram o total de funcionários da lista, quantos foram novos e quantos foram atualizados na última importação.
- **Histórico de importações**: tabela com as últimas 10 importações (data, empresa, quantidade, novos, atualizados e erros).
- **Reimportar**: refaz a importação da linha escolhida no histórico.
- **Limpar** (histórico): oculta o histórico da tela, com confirmação antes.

## Auditoria

A tela Auditoria mostra quem fez o quê dentro do sistema: cada inclusão, alteração, exclusão e cancelamento fica registrado com data, hora e o nome do usuário. Serve para conferir alterações e investigar dúvidas sobre um cadastro. Somente os perfis **Gestor e Administrador** acessam esta tela.

[IMAGEM: auditoria.png]

### Como fazer

**Consultar o histórico:**

1. A tabela já abre com os registros mais recentes. Cada linha mostra a data, a área alterada (coluna **Tabela**), o tipo de ação, o código do registro e o usuário.
2. O tipo de ação aparece em etiquetas coloridas: verde para **Criação**, azul para **Atualização**, vermelho para **Exclusão** e amarelo para **Cancelamento**.
3. Clique em uma linha para abrir o detalhe: o sistema mostra lado a lado os **Dados anteriores** e os **Dados novos**, para você ver exatamente o que mudou. Clique de novo para fechar.
4. Use as setas de paginação no rodapé para ver registros mais antigos (50 por página).

**Filtrar os registros:**

1. Digite no campo de busca um termo de tabela, ação, registro ou nome de usuário.
2. Escolha uma área no seletor **Tabela** (Colaboradores, Empresas, Departamentos, Ocorrências, Extras, Recibos de extras, Categorias de extras, Contratos adicionais, Vínculos adicionais, Calendário adicionais, Itens CEU, Entregas CEU — ou "Todas as tabelas").
3. Se quiser limitar o período, preencha as datas **Data inicial** e **Data final**.
4. Clique em **Aplicar**. A tabela é recarregada com os filtros.
5. Para voltar a ver tudo, clique em **Limpar**.

> DICA: a busca também funciona pelo nome do usuário — útil para ver tudo o que uma pessoa fez em um período.

### Campos e botões

- **Busca**: campo livre que procura por tabela, ação, registro ou usuário. Apertar Enter também aplica o filtro.
- **Tabela**: seletor com as áreas do sistema; filtra os registros de uma área só. Trocar a área já atualiza a lista na hora.
- **Data inicial**: mostra só registros a partir desta data.
- **Data final**: mostra só registros até esta data.
- **Aplicar**: aplica a busca e as datas digitadas.
- **Limpar**: apaga todos os filtros e volta a lista completa.
- **Seta da linha** (última coluna): abre/fecha o detalhe com os dados anteriores e novos do registro.
- **Paginação** (rodapé): mostra o total de registros e os botões de página anterior/próxima.

## Permissões

A tela Permissões é onde o **Administrador** liga e desliga cada permissão de cada perfil de acesso. Cada item tem uma caixinha: marcada, o perfil pode fazer aquela ação; desmarcada, não pode. Somente o **Administrador** acessa esta tela.

[IMAGEM: permissoes.png]

> ATENÇÃO: a mudança vale na hora. Ao marcar ou desmarcar uma caixinha, o sistema salva imediatamente e mostra "Permissões salvas com sucesso". Enquanto grava, aparece um aviso escuro "Salvando..." no canto inferior direito.

> ATENÇÃO: o perfil Administrador sempre tem acesso total e não pode ser alterado por esta tela.

### Como fazer

**Alterar uma permissão:**

1. No cartão **Selecionar perfil**, escolha o perfil desejado na lista (Gestor, RH, DP1, DP2, Mesa, Inspetoria, Financeiro ou Visualizador).
2. Percorra os cartões de grupos — Dados Mestres, Integrações, Ocorrências, Extras, VR, Adicionais, Alertas / Configurações, Escalas, CEU, Férias, Menus e Rotas.
3. Marque ou desmarque a caixinha do item desejado. O sistema salva na hora e confirma com a mensagem verde.
4. Repita para cada permissão que quiser ajustar.

**Voltar um perfil ao padrão:**

1. Selecione o perfil na lista.
2. Clique em **Restaurar padrão deste perfil**.
3. Na janela de confirmação, clique em **Restaurar padrão** (ou **Cancelar** para desistir).
4. O sistema mostra a mensagem verde "Permissões do perfil ... restauradas para o padrão" e as caixinhas voltam à configuração original.

> DICA: os grupos **Menus** e **Rotas** controlam o que aparece no menu lateral e quais telas o perfil consegue abrir. Se alguém reclamar que um menu sumiu, é aqui que se ajusta.

### Campos e botões

- **Perfil**: seletor com os perfis de acesso editáveis; define qual perfil está sendo configurado.
- **Restaurar padrão deste perfil**: devolve todas as permissões do perfil selecionado à configuração original, após confirmação.
- **Caixinhas de permissão**: ligam/desligam cada permissão, agrupadas por assunto:
  - **Dados Mestres**: editar/excluir empresas, editar/excluir/importar departamentos, editar dados básicos e completos do colaborador, ver CPF completo, cadastrar, excluir, importar (e-Contador) e exportar colaboradores.
  - **Integrações**: gerenciar e-Contador e configurar o token do e-Contador.
  - **Ocorrências**: criar, editar, cancelar, ver detalhes, aprovar, anexar arquivos, adicionar testemunhas, gerar PDF e gerenciar modelos.
  - **Extras**: criar/editar, excluir, editar e excluir categorias de valor, gerenciar recibos, marcar como pago, cancelar/excluir recibo, ver relatório, ver balanço e enviar comunicação.
  - **VR**: visualizar e gerenciar projetos.
  - **Adicionais**: editar contratos, editar vínculos, editar calendário e ver relatório.
  - **Alertas / Configurações**: gerenciar alertas, ver configurações e ver auditoria.
  - **Escalas**: visualizar, editar locais de trabalho, mapear Flit ↔ Local, importar Excel do Flit, confirmar local manualmente e editar local de um dia.
  - **CEU**: registrar entrega, registrar devolução, excluir entrega, emitir recibos, cadastrar/editar itens, excluir itens, gerenciar fornecedores, importar planilha e ver relatórios.
  - **Férias**: importar planilha do Flit, exportar visão geral para Excel e lançar previsões/notificações.
  - **Menus**: mostram ou escondem cada item do menu lateral (Dashboard, Colaboradores, Empresas, Departamentos, e-Contador, Ocorrências, Extras, Benefícios (VR), CEU, Adicionais, Alertas, Auditoria, Permissões, Relatórios e Férias).
  - **Rotas**: liberam ou bloqueiam a abertura de cada tela (colaboradores, empresas, departamentos, ocorrências, extras, VR, CEU, adicionais, importação e-Contador, configurações, auditoria, permissões, alertas, relatórios, férias e lançamento mobile de falta).

## Configurações

A tela Configurações reúne opções gerais do sistema. No momento ela não tem nenhuma configuração ativa: ao abrir, você vê apenas o aviso "Nenhuma configuração ativa no momento" e a orientação de que a configuração do token do e-Contador foi movida para a tela de importação.

[IMAGEM: configuracoes.png]

### Como fazer

Não há tarefas nesta tela no momento. Para configurar o token do e-Contador, use a tela **Importação e-Contador** (passo 1, descrito no início deste capítulo).

### Campos e botões

- Não há campos nem botões ativos — apenas a mensagem informativa central.

## Relatórios

A tela Relatórios é o ponto de partida para as exportações do sistema. Ela mostra cartões-atalho para o relatório de cada módulo, agrupados por assunto. Você só enxerga os cartões das telas que o seu perfil tem permissão de abrir.

[IMAGEM: relatorios.png]

### Como fazer

**Abrir um relatório:**

1. Localize o grupo do módulo desejado (Extras, Adicionais, CEU, Férias, Escalas, Benefícios (VR) ou Gestão).
2. Clique no cartão do relatório. O sistema abre a tela correspondente, onde você filtra o período e exporta o arquivo.
3. Se o seu perfil não tiver acesso a nenhuma tela de relatório, a página mostra o aviso "Nenhum relatório disponível".

### Campos e botões

- **Relatório Semanal** (Extras): extras por período com totais por colaborador e categoria; exporta em Excel.
- **Balanço Operacional** (Extras): resumo diário da operação (faltas, coberturas e reforços) para o relatório de WhatsApp.
- **Recibos de Pagamento** (Extras): geração, assinatura e controle de pagamento dos recibos de extras.
- **Relatório de Adicionais** (Adicionais): insalubridade, periculosidade e feriados por vínculo e período; exporta CSV e Excel.
- **Relatórios do CEU** (CEU): entregas por colaborador, data, item, vencimento e estoque; exporta em Excel.
- **Painel CLT de Férias** (Férias): situação de cada colaborador (em gozo, agendado, a vencer, vencido); exporta em Excel.
- **Local de Trabalho Diário** (Escalas): onde cada colaborador trabalhou em cada dia, com exportação do período.
- **Projetos de VR** (Benefícios): resultados do cálculo de vale-refeição e comprovantes por projeto.
- **Auditoria** (Gestão): atalho para a trilha de ações dos usuários, descrita neste capítulo.

## Dúvidas frequentes

**Importei os funcionários errados. E agora?**
Quem já existia no sistema é apenas atualizado, não duplicado. Se precisar corrigir um cadastro, ajuste na tela de Colaboradores ou refaça a importação com a lista certa.

**O token do e-Contador venceu. Como troco?**
Na tela Importação e-Contador, clique em **Redefinir token**, cole o novo token e clique em **Salvar token e listar empresas**.

**Consigo apagar registros da Auditoria?**
Não. A Auditoria é um histórico de consulta — serve justamente para preservar o rastro de quem fez o quê. Você pode filtrar e expandir os registros, mas não editá-los nem excluí-los pela tela.

**Desmarquei uma permissão por engano. Como volto atrás?**
Marque a caixinha de novo — a mudança é imediata nos dois sentidos. Se não lembrar como estava, use **Restaurar padrão deste perfil** para voltar tudo ao original daquele perfil.

**Por que não vejo todos os cartões na tela Relatórios?**
Os cartões aparecem conforme a permissão do seu perfil. Se um relatório que você precisa não aparece, peça ao Administrador para liberar o acesso na tela Permissões.
