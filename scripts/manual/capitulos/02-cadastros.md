# Capítulo 2 — Cadastros (Colaboradores, Departamentos e Empresas)

Este módulo guarda os cadastros básicos do sistema: as pessoas que trabalham na empresa (colaboradores), os postos de trabalho e clientes onde elas atuam (departamentos) e os CNPJs do grupo (empresas). Quase todos os outros módulos usam esses dados, então é aqui que tudo começa. Os dados dos colaboradores chegam principalmente pela importação do e-Contador ou por planilha, mas dá para consultar e corrigir pela tela sempre que preciso.

## Lista de Colaboradores

É a tela principal do cadastro de pessoas. Ela mostra a lista de colaboradores com nome, função, departamento, telefone e status (Ativo, Inativo ou Afastado). A partir dela você localiza uma pessoa, vê um resumo dos dados dela e faz correções rápidas, como telefone ou cargo.

[IMAGEM: colaboradores.png]

A tela abre mostrando apenas os colaboradores **Ativos**. Para ver demitidos ou afastados, mude o filtro de Status.

> DICA: o CPF aparece completo apenas para os perfis Administrador, Gestor, RH, DP1, DP2 e Financeiro. Para os demais perfis, ele sai mascarado (por exemplo, `***.456.789-**`). Isso vale na lista, na ficha e em qualquer tela do sistema.

### Como fazer

**Localizar um colaborador:**

1. No campo de busca, digite parte do nome da pessoa. Você também pode escolher um Departamento, uma Função, um Status ou uma Empresa nas caixas de seleção ao lado.
2. Clique em **Aplicar**. A lista mostra só quem combina com o que você pediu.
3. Para voltar à lista padrão (só os Ativos, sem busca), clique em **Limpar**.

> DICA: dentro do campo de busca, você pode apertar a tecla Enter em vez de clicar em Aplicar — o resultado é o mesmo.

**Ver os dados de um colaborador:**

1. Clique em qualquer lugar da linha da pessoa na lista.
2. Abre-se a janela **Detalhes**, com o nome, a matrícula, o status e cartões com Cargo, Departamento, Admissão, Demissão, Telefone, E-mail, Endereço e Documentos (CPF e RG).
3. Para fechar, clique no **X** no canto superior direito da janela.

**Corrigir dados básicos (telefone, cargo, e-mail etc.):**

1. Clique no ícone de **lápis** na linha da pessoa (ou abra os Detalhes e clique no botão **Editar**). A janela vira o modo **Editar colaborador**.
2. Altere o que precisar: nome completo, cargo, departamento, telefone, celular, e-mail ou status.
3. Clique em **Salvar**. O sistema mostra a mensagem verde "Colaborador atualizado" e a lista já volta com o dado novo.
4. Se desistir, clique em **Cancelar** — nada é alterado.

> ATENÇÃO: o botão Editar e o lápis só aparecem para os perfis Administrador, Gestor, RH, DP1, DP2 e Mesa. O Visualizador, a Inspetoria e o Financeiro só consultam.

**Atualizar a lista:**

1. Clique no botão **Atualizar**, no canto superior direito da tela. O sistema busca os dados mais recentes (útil quando outra pessoa acabou de importar ou editar cadastros).

### Campos e botões

- **Buscar por nome**: campo de texto que localiza o colaborador pelo nome.
- **Departamento**: caixa de seleção com busca — comece a digitar o nome do posto e escolha na lista. Filtra quem trabalha naquele local.
- **Função**: caixa de seleção com todas as funções cadastradas. "Todas as funções" não filtra nada.
- **Status**: caixa de seleção com Todos, Ativo, Inativo e Afastado. O padrão ao abrir a tela é Ativo.
- **Empresa**: caixa de seleção com as empresas do grupo. "Todas as empresas" não filtra nada.
- **Aplicar**: botão que executa a busca com os filtros escolhidos.
- **Limpar**: botão que apaga a busca e volta os filtros ao padrão (Status = Ativo).
- **Atualizar**: botão no topo que recarrega a lista com os dados mais recentes.
- **Colaborador** (coluna): foto ou iniciais da pessoa, seguidas do nome completo. Clicar na linha abre os Detalhes.
- **Cargo** (coluna): função da pessoa. Mostra um traço (—) quando não há cargo cadastrado.
- **Departamento** (coluna): nome curto do posto onde a pessoa trabalha.
- **Telefone** (coluna): telefone fixo ou, se não houver, o celular.
- **Status** (coluna): etiqueta colorida com a situação (Ativo, Inativo ou Afastado).
- **Lápis** (ícone na linha): abre a janela já no modo de edição. Só aparece para quem tem permissão de edição.
- **Paginação**: no rodapé da lista, mostra "Mostrando X a Y de Z resultados" e os botões **Anterior** e **Próxima**. A lista mostra 50 colaboradores por página.
- **Editar** (na janela de Detalhes): transforma a janela em formulário de edição.
- **Salvar** (no modo de edição): grava as alterações. Fica desativado enquanto o nome estiver vazio ou enquanto o sistema estiver salvando.
- **Cancelar** (no modo de edição): sai do modo de edição sem gravar.

## Ficha do colaborador

É a página completa de uma pessoa: além dos dados cadastrais, mostra todas as ocorrências registradas para ela e permite imprimir a ficha em PDF. Você chega a ela, por exemplo, clicando no nome do colaborador em um alerta do módulo RH.

[IMAGEM: colaborador-detalhe.png]

No topo aparecem o nome, a matrícula, o status e o cargo. Logo abaixo, um cartão reúne CPF, departamento, datas de admissão e demissão, e-mail, telefones, CEP e endereço. Se a pessoa estiver afastada, aparece um aviso laranja com o motivo e o período do afastamento.

### Como fazer

**Imprimir a ficha em PDF:**

1. Clique no botão **Ficha PDF**, no canto superior direito.
2. O sistema gera e baixa um arquivo PDF com os dados da pessoa e a lista das ocorrências dela, com a data de emissão no topo.

**Registrar uma ocorrência para a pessoa:**

1. Clique no botão **Nova Ocorrência** (laranja), acima da lista de ocorrências.
2. O sistema abre a tela de registro de ocorrência já com o colaborador preenchido (detalhes no capítulo de Ocorrências).

> ATENÇÃO: o botão Nova Ocorrência aparece para Administrador, Gestor, RH, DP1, DP2, Mesa e Financeiro.

**Abrir uma ocorrência da lista:**

1. Na seção **Ocorrências**, cada cartão mostra o tipo, a data, a descrição e o status (Pendente, Ativa, Resolvida ou Cancelada). Ocorrências pendentes ficam com fundo alaranjado.
2. Clique no ícone de **olho** para abrir a tela de detalhes da ocorrência, ou no ícone de **impressora** para baixar o PDF daquela ocorrência.

**Cancelar/excluir uma ocorrência pela ficha:**

1. Clique no ícone de **lixeira** no cartão da ocorrência (não aparece em ocorrências já canceladas).
2. O sistema pergunta "Remover ocorrência?". Clique em **Excluir** para confirmar ou em **Cancelar** para desistir.
3. Confirmando, o sistema mostra a mensagem verde "Ocorrência removida" e a lista é atualizada.

> ATENÇÃO: a lixeira de ocorrência só aparece para Administrador, Gestor, RH, DP1 e Mesa, e a exclusão é definitiva.

**Editar o cadastro completo:**

1. Clique no botão azul **Editar**, no topo. O sistema abre a tela Editar Colaborador (próxima seção).

**Voltar:**

1. Clique no botão com a **seta para a esquerda**, no topo da página, para voltar à lista de colaboradores.

### Campos e botões

- **Seta para a esquerda**: volta para a lista de colaboradores.
- **Ficha PDF**: gera o PDF da ficha com dados cadastrais e ocorrências.
- **Editar** (botão azul): abre a tela de edição completa do cadastro. Só aparece para Administrador, Gestor, RH, DP1, DP2 e Mesa.
- **CPF**: número do CPF. Completo só para Administrador, Gestor, RH, DP1, DP2 e Financeiro; mascarado para os demais.
- **Departamento**: posto/local de trabalho da pessoa.
- **Admissão / Demissão**: datas de entrada e de saída da empresa.
- **E-mail, Telefone, Celular, CEP, Endereço**: dados de contato e endereço cadastrados.
- **Aviso de afastamento** (faixa laranja): aparece só quando há afastamento registrado, com motivo e período.
- **Ocorrências** (seção): lista das ocorrências da pessoa, com contador total e, quando houver, um selo com a quantidade de pendentes.
- **Olho** (ícone): abre os detalhes da ocorrência.
- **Impressora** (ícone): baixa o PDF da ocorrência.
- **Lixeira** (ícone): exclui a ocorrência, após confirmação. Só para perfis com permissão de cancelamento.

## Editar Colaborador

É o formulário completo do cadastro, aberto pelo botão Editar da ficha. Aqui você corrige qualquer dado da pessoa — inclusive documentos e datas — e registra a demissão.

[IMAGEM: colaborador-form.png]

O formulário é dividido em três blocos: **Dados Pessoais**, **Endereço e Contato** e **Dados Profissionais**. Os únicos campos obrigatórios são Nome Completo e Matrícula.

### Como fazer

**Corrigir o cadastro:**

1. Altere os campos que precisar, em qualquer um dos três blocos.
2. Clique em **Salvar Colaborador**.
3. O sistema mostra a mensagem verde "Colaborador atualizado com sucesso" e volta sozinho para a lista de colaboradores.
4. Se desistir, clique em **Cancelar** ou em **Voltar** — nada é gravado.

**Registrar uma demissão:**

1. No bloco Dados Profissionais, preencha o campo **Data de Demissão**.
2. Clique em **Salvar Colaborador**.
3. Ao salvar, o sistema muda o status da pessoa para **Inativo** automaticamente — não é preciso mexer no campo Status.

> DICA: se a pessoa foi reintegrada, apague a Data de Demissão e salve de novo, ajustando o Status para Ativo.

### Campos e botões

- **Voltar**: retorna à lista de colaboradores sem salvar.
- **Nome Completo** *: nome da pessoa (obrigatório).
- **Matrícula** *: número de matrícula (obrigatório). Cada matrícula é única no sistema — se você tentar salvar uma matrícula que já existe, aparece a mensagem de erro "Matrícula já existe no sistema".
- **CPF**: número do CPF. O sistema confere os dígitos: se o CPF for inválido, o salvamento é bloqueado com o aviso "CPF inválido. Verifique os dígitos."
- **RG**: número da identidade.
- **CTPS**: número da carteira de trabalho.
- **PIS/PASEP**: número do PIS/PASEP.
- **Data de Nascimento**: selecione no calendário.
- **Email**: e-mail da pessoa.
- **Endereço Completo, Cidade, Estado (UF), CEP**: endereço. O campo Estado aceita no máximo 2 letras.
- **Telefone / Celular**: o próprio campo coloca a máscara `(00) 00000-0000` enquanto você digita.
- **Cargo/Função**: função da pessoa.
- **Departamento**: posto/local de trabalho.
- **Tipo de Contrato**: caixa de seleção com CLT, PJ, Estágio e Temporário.
- **Data de Admissão**: data de entrada na empresa.
- **Data de Demissão**: data de saída. Ao preenchê-la e salvar, o status vira Inativo sozinho.
- **Status**: caixa de seleção com Ativo, Inativo e Afastado.
- **Cancelar**: sai sem salvar.
- **Salvar Colaborador**: grava as alterações e volta para a lista. Enquanto grava, o botão mostra "Salvando...".

## Importar colaboradores por planilha (Importar RH)

É a tela para cadastrar ou atualizar colaboradores em lote, a partir de uma planilha Excel. Em vez de digitar pessoa por pessoa, você envia um arquivo e o sistema grava tudo de uma vez. Quem já existe no sistema (mesma matrícula) tem o cadastro atualizado; quem não existe é cadastrado.

[IMAGEM: importar-rh.png]

> ATENÇÃO: a importação é liberada apenas para os perfis Administrador, DP1 e DP2. Se outro perfil tentar abrir a tela, o sistema avisa que não há permissão e volta para a lista de colaboradores.

> ATENÇÃO: células vazias na planilha **não apagam** o que já está cadastrado — o sistema só substitui os campos que vierem preenchidos. Linhas sem matrícula ou sem nome são ignoradas.

### Como fazer

**Importar a planilha:**

1. Clique na área tracejada "Clique para selecionar arquivo Excel" e escolha o arquivo no seu computador. Só valem arquivos **.xlsx** ou **.xls** — outro formato mostra o aviso "Formato inválido".
2. O sistema lê o arquivo e mostra a mensagem verde com a quantidade de registros encontrados, o nome e o tamanho do arquivo, e uma **pré-visualização** com os 10 primeiros registros (Matrícula, Nome, CPF, Cargo e Status). Confira se as colunas caíram nos lugares certos.
3. Se o arquivo estiver errado, clique no **X** vermelho ao lado do nome do arquivo para descartá-lo e escolher outro.
4. Clique em **Iniciar Importação**. A tela mostra o progresso ("Importando... N registros").
5. Ao terminar, o sistema mostra a mensagem verde "N colaboradores importados com sucesso!" e limpa a tela para uma nova importação.

**Entender os avisos durante a importação:**

- "N linha(s) ignorada(s) por falta de matrícula ou nome": essas linhas não entraram. Corrija a planilha e importe de novo se precisar delas.
- "N CPF(s) inválido(s) não foram salvos (demais dados importados)": a pessoa foi importada, mas o CPF ficou de fora porque os dígitos não conferem. Corrija depois pela ficha.
- "Erro no lote N": parte do arquivo falhou. O sistema informa qual trecho deu problema; os demais lotes continuam.

**Preparar a planilha:**

A tela mostra o quadro **Colunas Suportadas**. Você pode usar os nomes técnicos (ex.: `matricula`, `nome_completo`, `cpf`) ou os nomes amigáveis mais comuns — o sistema reconhece variações como "Matricula", "Nome Completo", "CPF", "Data Admissão", "Data Demissão", "Cargo", "Função", "Celular" etc. As datas podem estar em formato de data do Excel ou texto. Se a coluna **Data Demissão** vier preenchida, a pessoa entra como Inativa; caso contrário, como Ativa.

### Campos e botões

- **Área de seleção de arquivo**: clique para escolher a planilha (.xlsx ou .xls) no computador.
- **Nome e tamanho do arquivo**: confirmação visual do arquivo escolhido.
- **X vermelho**: descarta o arquivo escolhido e limpa a pré-visualização.
- **Pré-visualização**: tabela com os 10 primeiros registros lidos, para conferência antes de gravar.
- **Iniciar Importação**: botão que grava os dados no sistema.
- **Colunas Suportadas** (quadro): lista das colunas que a planilha pode ter: matricula, nome_completo, cpf, rg, ctps, pis_pasep, data_nascimento, email, telefone, celular, endereco, cidade, estado, cep, data_admissao, data_demissao, tipo_contrato, cargo, departamento e status.
- **Abas do módulo** (no topo): Ocorrências, Importar Ponto, Modelos e Alertas — atalhos para as outras telas do módulo RH.

## Departamentos / Postos

Departamentos são os postos de trabalho e clientes onde os colaboradores atuam — condomínios, empresas e hospitais atendidos pela Plena. Nesta tela você cadastra cada local com endereço, contatos da portaria e do síndico/administrador e a data de início do contrato.

[IMAGEM: departamentos.png]

A tela abre mostrando só os departamentos **Ativos**. A busca filtra a lista na hora, conforme você digita — não é preciso clicar em Aplicar.

### Como fazer

**Localizar um departamento:**

1. Digite no campo de busca parte do nome (completo ou curto) ou do nome de um contato. A lista se filtra sozinha.
2. Use a caixa **Status** para alternar entre Ativos, Inativos e Todos.
3. Para voltar ao padrão, clique em **Limpar**.

**Ordenar a lista:**

1. Clique no título da coluna **Departamento** ou **Endereço** para ordenar de A a Z. Clique de novo para inverter a ordem (a setinha ao lado do título indica a direção).

**Cadastrar um departamento:**

1. Clique em **Novo departamento**, no canto superior direito.
2. Preencha pelo menos **Nome** e **Nome curto** (obrigatórios). Os demais campos são opcionais.
3. Clique em **Salvar**. O sistema mostra a mensagem verde "Departamento criado" e o novo local já aparece na lista.
4. Se faltar o nome ou o nome curto, o sistema avisa o que está faltando e não salva.

> ATENÇÃO: o botão Novo departamento só aparece para Administrador, Gestor, DP1, DP2, Mesa e Financeiro.

**Editar um departamento:**

1. Clique no ícone de **lápis** na linha do departamento.
2. A janela abre com os dados atuais. Altere o que precisar — por exemplo, marcar o Status como Inativo quando o contrato terminar.
3. Clique em **Atualizar**. O sistema mostra a mensagem verde "Departamento atualizado".

**Excluir um departamento:**

1. Clique no ícone de **lixeira** vermelha na linha.
2. O sistema pergunta "Excluir departamento?" e avisa que a ação não pode ser desfeita.
3. Clique em **Excluir** para confirmar ou em **Cancelar** para desistir. Confirmando, aparece a mensagem verde "Departamento removido".

> ATENÇÃO: a lixeira só aparece para Administrador, Gestor e Financeiro. Na dúvida, prefira marcar o departamento como Inativo em vez de excluir.

**Exportar para Excel:**

1. Clique no botão **Excel** (na área de filtros). O sistema baixa o arquivo `departamentos.xlsx` com todos os campos dos departamentos que estão na tela — os filtros aplicados valem para a exportação.

**Importar por CSV:**

1. Clique no botão **CSV** e escolha o arquivo no computador.
2. O sistema cadastra os departamentos do arquivo e mostra a mensagem verde "N departamento(s) importado(s)". Linhas sem nome são ignoradas.
3. O arquivo CSV deve ter os mesmos cabeçalhos da planilha exportada pelo botão Excel (Nome, Nome curto, Contato portaria/adm, Endereço, Bairro, Cidade, Estado, CEP, Nome do contato, Telefone do contato, E-mail do contato, Nome do contato 2, Telefone do contato 2, E-mail do contato 2, Data início contrato, Status).

> ATENÇÃO: os botões CSV e Sync só aparecem para Administrador, Gestor, RH, DP1, DP2 e Mesa. O botão Sync é de uso interno — no uso normal do sistema, clicar nele apenas mostra um aviso de que a sincronização não está disponível.

### Campos e botões

**Na tela principal:**

- **Buscar por nome, contato...**: campo de texto que filtra a lista na hora por nome, nome curto, contato da portaria ou nome do síndico.
- **Status**: caixa de seleção com Ativos, Inativos e Todos.
- **Aplicar / Limpar**: botões de filtro. Como a busca já filtra sozinha, o uso prático é o Limpar, que zera a busca e volta ao filtro Ativos.
- **Excel**: exporta a lista exibida para uma planilha.
- **CSV**: importa departamentos de um arquivo CSV. Restrito por perfil.
- **Sync**: botão de uso interno; sem efeito no uso normal. Restrito por perfil.
- **Novo departamento**: abre a janela de cadastro. Restrito por perfil.
- **Departamento** (coluna): nome curto em destaque, com o nome completo em letras menores embaixo. Clicável para ordenar.
- **Endereço** (coluna): endereço com bairro e cidade embaixo. Clicável para ordenar.
- **Contato portaria/adm** (coluna): nome do contato da portaria e telefone.
- **Síndico / Administrador** (coluna): nome do contato principal e telefone.
- **Início contrato** (coluna): data de início do contrato com o local.
- **Status** (coluna): etiqueta Ativo (verde) ou Inativo (cinza).
- **Lápis / Lixeira** (ícones): editar e excluir o departamento, conforme o perfil.

**Na janela de cadastro/edição:**

- **Nome** *: nome completo do local (ex.: Condomínio Solar da Praia).
- **Nome curto** *: apelido usado nas listas e filtros do sistema (ex.: Solar).
- **Contato portaria/adm**: nome de quem atende na portaria ou administração.
- **Endereço, Bairro, Cidade, Estado, CEP**: endereço do local. Estado com 2 letras; o CEP recebe a máscara sozinho.
- **Nome do síndico/administrador, Telefone, E-mail**: primeiro contato do cliente.
- **Nome do 2º contato, Telefone 2, E-mail 2**: segundo contato, opcional.
- **Status**: Ativo ou Inativo.
- **Data de início do contrato**: data de início do contrato com o local.
- **Cancelar**: fecha a janela sem salvar.
- **Salvar / Atualizar**: grava o cadastro (Salvar no cadastro novo, Atualizar na edição).

## Empresas

É o cadastro das empresas do grupo — um registro para cada CNPJ. Esses dados aparecem nos filtros de outras telas e são usados na emissão de recibos e relatórios.

[IMAGEM: empresas.png]

A busca filtra a lista na hora, conforme você digita.

### Como fazer

**Cadastrar uma empresa:**

1. Clique no botão **Cadastrar**, no canto superior direito.
2. Preencha a **Razão social / Nome** (obrigatório). O CNPJ recebe a máscara `00.000.000/0000-00` enquanto você digita; o sistema confere os dígitos e bloqueia o salvamento se o CNPJ for inválido.
3. Se a empresa tiver código no sistema de folha (Alterdata), preencha o **Código Alterdata**.
4. Clique em **Cadastrar** (na janela). O sistema mostra a mensagem verde "Empresa criada com sucesso" e a empresa aparece na lista.

> ATENÇÃO: o botão Cadastrar e a edição só aparecem para Administrador, Gestor, DP1, DP2 e Financeiro.

**Editar uma empresa:**

1. Clique no ícone de **lápis** na linha da empresa.
2. Altere os dados e clique em **Atualizar**. O sistema mostra a mensagem verde "Empresa atualizada".

**Excluir uma empresa:**

1. Clique no ícone de **lixeira** vermelha na linha.
2. O sistema pergunta "Remover empresa?" e avisa que a ação não pode ser desfeita.
3. Clique em **Excluir** para confirmar. Aparece a mensagem verde "Empresa removida".

> ATENÇÃO: a lixeira só aparece para o Administrador.

### Campos e botões

**Na tela principal:**

- **Buscar por nome, CNPJ ou código...**: campo de texto que filtra a lista na hora por qualquer um desses dados.
- **Aplicar / Limpar**: botões de filtro. O uso prático é o Limpar, que zera a busca.
- **Cadastrar**: abre a janela de nova empresa. Restrito por perfil.
- **Nome** (coluna): razão social da empresa.
- **CNPJ** (coluna): CNPJ formatado; mostra um traço (—) quando não informado.
- **Código Alterdata** (coluna): código da empresa no sistema de folha; traço quando não informado.
- **Lápis / Lixeira** (ícones): editar e excluir, conforme o perfil.

**Na janela de cadastro/edição:**

- **Razão social / Nome** *: nome da empresa (obrigatório).
- **CNPJ**: número do CNPJ, com máscara e conferência automática dos dígitos.
- **Código Alterdata**: código usado na integração com a folha de pagamento.
- **Cancelar**: fecha sem salvar.
- **Cadastrar / Atualizar**: grava os dados (Cadastrar na empresa nova, Atualizar na edição).

## Dúvidas frequentes

**Demiti uma pessoa. Preciso apagar o cadastro dela?**
Não — e o sistema nem oferece exclusão de colaborador pelas telas comuns. Basta preencher a Data de Demissão na ficha de edição: o status vira Inativo sozinho e a pessoa sai das listas de ativos, mas o histórico (ocorrências, entregas, recibos) fica preservado.

**Importei a planilha e um colaborador sumiu dos dados. O que houve?**
Provavelmente a linha estava sem matrícula ou sem nome — o sistema ignora essas linhas e avisa na mensagem amarela. CPF errado não apaga o cadastro: a pessoa entra, só o CPF fica de fora. Corrija a planilha ou a ficha e repita.

**Importei de novo uma planilha antiga. Vai duplicar as pessoas?**
Não. O sistema usa a matrícula como chave: quem já existe é atualizado, quem não existe é cadastrado. Por isso a matrícula precisa estar sempre certa na planilha.

**Por que o CPF de algumas pessoas aparece com asteriscos para mim?**
É uma proteção de dado pessoal. O CPF completo só aparece para Administrador, Gestor, RH, DP1, DP2 e Financeiro. Se você precisa do número para um trabalho legítimo e não tem acesso, peça a um desses perfis.

**O contrato com um posto acabou. Excluo o departamento?**
Prefira editar e mudar o Status para Inativo: o posto sai das listas do dia a dia, mas o histórico ligado a ele (escalas, entregas, ocorrências) continua consultável. A exclusão é definitiva e restrita a poucos perfis.
