# Capítulo 3 — RH: Ocorrências

O módulo de Ocorrências é onde você registra e acompanha tudo o que acontece com os colaboradores: atrasos, faltas, advertências, suspensões, licenças médicas e muito mais. Cada ocorrência guarda a descrição do fato, os documentos que comprovam o motivo e as testemunhas. O sistema também avisa quando algo precisa da sua atenção, por meio dos Alertas. Você acessa essas telas pelo menu lateral, na área de RH, usando as abas no topo da tela: **Ocorrências**, **Importar Ponto**, **Modelos** e **Alertas**.

## Lista de Ocorrências

É a tela principal do módulo. Ela mostra todas as ocorrências registradas, com a data, o colaborador, o grupo, o tipo, o título e a situação de cada uma. No topo, o sistema mostra o total de registros e quantos estão pendentes.

Cada ocorrência tem uma situação (status), indicada por uma etiqueta colorida:

- **Pendente** (amarela): a ocorrência foi registrada, mas ainda faltam os documentos exigidos. Essas linhas aparecem com fundo cinza claro na lista.
- **Ativa** (azul): a ocorrência está valendo, com todos os documentos anexados.
- **Resolvida** (verde): o caso foi encerrado.
- **Cancelada** (cinza): a ocorrência foi anulada e ficou guardada só no histórico.

[IMAGEM: ocorrencias.png]

### Como fazer

**Encontrar uma ocorrência:**

1. Escolha primeiro a aba de busca: **Cadastrados** (para procurar por um colaborador que existe no sistema) ou **Históricos** (para procurar ocorrências de colaboradores que não estão mais cadastrados, pelo nome original ou pelo texto da descrição).
2. Na aba **Cadastrados**, comece a digitar o nome no campo de busca e escolha a pessoa na lista que aparece. Na aba **Históricos**, digite o nome ou parte da descrição e pressione Enter.
3. Se quiser, refine com os demais filtros: colaborador ativo ou inativo, empresa, status, grupo, tipo e período.
4. Clique em **Aplicar** para atualizar a lista. A lista também se atualiza sozinha quando você muda um filtro.
5. Para começar uma busca do zero, clique em **Limpar**: todos os filtros voltam ao padrão.

> DICA: no filtro de **Tipo**, digite o nome do tipo e pressione Enter. Você pode filtrar vários tipos ao mesmo tempo — cada um vira uma etiqueta abaixo do campo, e você remove clicando no X da etiqueta.

**Abrir uma ocorrência:**

1. Na linha da ocorrência, clique no ícone de olho (Ver detalhes). O sistema abre a tela de detalhe.
2. Se preferir corrigir algo, clique no ícone de lápis (Editar) — ele aparece para quem tem permissão e não aparece em ocorrências canceladas.

**Excluir uma ocorrência:**

1. Na linha da ocorrência, clique no ícone de lixeira.
2. O sistema pergunta "Remover ocorrência?" e avisa que a exclusão é permanente.
3. Clique em **Sim, excluir** para confirmar ou em **Cancelar** para desistir.

> ATENÇÃO: excluir uma ocorrência é definitivo — não dá para desfazer. Essa exclusão é reservada ao Administrador. Se você só quer anular uma ocorrência sem apagar, use o botão **Cancelar** dentro da tela de detalhe: ela fica guardada no histórico com a situação "Cancelada".

**Cadastrar uma nova ocorrência:**

1. Clique no botão azul **Nova Ocorrência**, no canto superior direito. O sistema abre o formulário de cadastro (veja a próxima seção). O botão aparece para os perfis Administrador, Gestor, RH, DP1, DP2, Mesa e Financeiro.

### Campos e botões

- **Abas Cadastrados / Históricos**: trocam o modo de busca. Cadastrados procura por colaboradores que existem no sistema; Históricos procura em ocorrências de colaboradores não cadastrados, pelo nome original ou pela descrição.
- **Campo de busca**: na aba Cadastrados, busca o colaborador pelo nome ou matrícula; na aba Históricos, busca por nome original ou texto da descrição.
- **Colaborador**: filtra por colaboradores ativos, inativos ou todos. O padrão é mostrar só os ativos.
- **Empresa**: mostra ocorrências de uma empresa específica ou de todas.
- **Status**: filtra pela situação (Pendente, Ativa, Resolvida ou Cancelada).
- **Macro grupo**: filtra pela família da ocorrência (Jornada e Ponto, Conduta e Disciplina, Saúde e Segurança, Afastamentos e Licenças, Desempenho e Produtividade, Relacionamento Interpessoal, Patrimonial, Administrativas ou Registro do RH).
- **Tipo**: filtra por um ou mais tipos de ocorrência (digite e pressione Enter).
- **Período**: duas datas ("de" e "até") para ver só ocorrências daquele intervalo.
- **Incluir colaboradores não identificados**: marca essa caixa para a lista incluir também ocorrências antigas cujo colaborador não foi identificado no sistema.
- **Aplicar**: atualiza a lista com os filtros escolhidos.
- **Limpar**: apaga todos os filtros e volta à lista completa.
- **Nova Ocorrência**: abre o formulário de cadastro.
- **Olho (Ver detalhes)**: abre a tela de detalhe da ocorrência.
- **Lápis (Editar)**: abre o formulário para corrigir os dados. Não aparece em ocorrências canceladas.
- **Lixeira**: exclui a ocorrência de forma permanente, após confirmação (reservada ao Administrador).
- **Paginação**: a lista mostra 50 registros por página. Use os botões de página anterior e próxima no rodapé para navegar.

## Nova Ocorrência

É o formulário usado para registrar uma ocorrência. Ele é dividido em oito partes numeradas, de cima para baixo. A mesma tela serve para editar uma ocorrência já registrada — nesse caso, o título muda para "Editar Ocorrência" e os campos vêm preenchidos.

Uma facilidade importante: quando você escolhe o **tipo de ocorrência**, o sistema preenche sozinho a descrição com um texto padrão, já com o nome e o CNPJ da empresa do colaborador. Você só precisa completar os trechos marcados com `[___]` (como datas e horários).

[IMAGEM: ocorrencia-nova.png]

### Como fazer

**Registrar uma nova ocorrência:**

1. Na lista de ocorrências, clique em **Nova Ocorrência**.
2. Na parte **1. Colaborador**, digite o nome ou a matrícula e escolha a pessoa na lista. O sistema mostra um cartão azul com nome, matrícula, cargo e empresa.
3. Na parte **2. Macro Grupo**, escolha a família da ocorrência (por exemplo, "1. Jornada e Ponto").
4. Na parte **3. Tipo de Ocorrência**, escolha o tipo. A lista só mostra os tipos do grupo escolhido, e avisa quais "(exige anexo)". Ao escolher, o sistema preenche automaticamente a **Gravidade**, a **Base Legal** e o texto da **Descrição**.
5. Na parte **4. Título da Ocorrência**, escreva um título curto e claro. Ele aparece na lista, mas não sai no documento que o colaborador assina.
6. Na parte **5. Dados do Ocorrido**, informe a data em que o fato aconteceu, a data do registro (já vem com o dia de hoje) e, se quiser, o local.
7. Na parte **6. Descrição do Fato**, revise o texto preenchido automaticamente e complete os trechos `[___]`.
8. Na parte **7. Defesa e Medidas Corretivas**, escreva a defesa do funcionário — esse campo é obrigatório. Registre se ele aceitou a notificação, recusou assinar ou apresentou defesa. Se houver, informe a medida corretiva e o prazo de acompanhamento.
9. Na parte **8. Testemunhas**, se houver, informe nome e cargo de até duas testemunhas.
10. Clique em **Salvar**.

Depois de salvar, acontece o seguinte:

- Se o tipo exige documentos, o sistema grava a ocorrência como **Pendente** e mostra o aviso: "Ocorrência registrada como PENDENTE. Anexe documentos comprobatórios para ativar."
- Se o tipo não exige documentos, ela já nasce **Ativa**, com o aviso "Ocorrência registrada como ATIVA."
- O sistema tenta gerar automaticamente o PDF da ocorrência (o documento para o colaborador assinar) e abre a tela de detalhe. Se o PDF não puder ser gerado na hora, aparece um aviso amarelo dizendo que você pode gerá-lo depois na tela de detalhes — a ocorrência já está salva.

> DICA: se a ocorrência veio de uma falta ou atestado registrado no ponto, ela pode já existir no sistema. A importação de ponto (módulo Adicionais → Importar Ponto) cria ocorrências automaticamente — verifique a lista antes de cadastrar para não duplicar.

> ATENÇÃO: se faltar informação obrigatória ao salvar, o sistema avisa o que falta: selecionar o colaborador, informar o título, selecionar o tipo, preencher a descrição ou preencher a defesa do funcionário.

**Editar uma ocorrência:**

1. Na lista, clique no lápis da ocorrência (ou no botão **Editar** da tela de detalhe).
2. Corrija os campos necessários e clique em **Salvar**. O sistema mostra a mensagem verde "Ocorrência atualizada com sucesso." e volta para a tela de detalhe.
3. Para sair sem salvar, clique em **Cancelar** ou na seta de voltar.

> ATENÇÃO: ao editar, o sistema mantém a situação atual da ocorrência — editar não ativa uma ocorrência pendente. Para ativar, anexe os documentos na tela de detalhe.

### Campos e botões

- **Seta de voltar**: retorna à lista de ocorrências.
- **1. Colaborador**: campo de busca por nome ou matrícula. Obrigatório. Depois de escolhido, vira um cartão azul com os dados da pessoa.
- **2. Macro Grupo**: família da ocorrência. Trocar o grupo limpa o tipo, a gravidade, a base legal e a descrição já preenchidos.
- **3. Tipo**: tipo da ocorrência, filtrado pelo grupo. Obrigatório. Tipos marcados com "(exige anexo)" precisam de documentos para ficarem ativos.
- **Gravidade**: mostrada automaticamente (Leve, Moderada, Grave ou Gravíssima), com cor conforme a seriedade.
- **Base Legal**: o artigo da CLT ou norma que fundamenta o tipo. Preenchida automaticamente.
- **4. Título**: resumo curto da ocorrência. Obrigatório. Aparece na lista; não sai no documento de assinatura.
- **5. Data do Ocorrido**: dia em que o fato aconteceu. Obrigatório.
- **Data do Registro**: dia do registro no sistema (vem com a data de hoje).
- **Local**: onde aconteceu (opcional).
- **6. Descrição do Fato**: texto completo da ocorrência. Obrigatório. Vem pré-preenchido pelo tipo — complete os trechos `[___]`.
- **7. Defesa do Funcionário**: registro do posicionamento do colaborador (aceitou, recusou assinar, apresentou defesa). Obrigatório.
- **Medida Corretiva Tomada**: o que foi decidido (advertência, treinamento etc.). Opcional.
- **Prazo de Acompanhamento**: data limite para acompanhar o caso. Opcional.
- **8. Testemunhas**: nome e cargo de até duas testemunhas. Opcional — você também pode cadastrar testemunhas depois, na tela de detalhe.
- **Cancelar**: sai sem salvar e volta para a lista.
- **Salvar**: grava a ocorrência. Durante a gravação, o botão mostra "Salvando...".

## Detalhe da Ocorrência

É a ficha completa de uma ocorrência. Aqui você vê todos os dados, anexa os documentos, cadastra testemunhas, gera o PDF para assinatura, ativa ou cancela a ocorrência. No topo aparecem o título, o número da ocorrência, o tipo, a data e a etiqueta de situação.

Abaixo do topo, um quadro colorido resume a situação:

- **Laranja (Pendente)**: avisa quais documentos ainda faltam para ativar e quantos anexos já existem. Esse quadro explica que "Pendente" é só um controle interno do RH — o status não aparece no PDF que o colaborador assina.
- **Verde (Ativa)**: confirma que a ocorrência está ativa e informa quantos documentos estão anexados.

Na coluna da esquerda ficam dois cartões: **Colaborador** (nome, matrícula, CPF, cargo e departamento) e **Dados da Ocorrência** (empresa, título, tipo, data, status, forma de assinatura, data de registro, descrição, defesa, medida corretiva e prazo de acompanhamento). Na coluna da direita ficam as abas **Documentos**, **Testemunhas** e **Auditoria**.

[IMAGEM: ocorrencia-detalhe.png]

### Como fazer

**Anexar um documento:**

1. Abra a aba **Documentos**.
2. Em "Anexar Documento", marque o tipo: **Documento comprobatório do motivo da sanção** (atestado, foto, print, e-mail etc.) ou **Documento assinado** (o registro assinado pelo colaborador).
3. Se quiser, escreva uma descrição do documento.
4. Clique em **Selecionar Arquivo** e escolha o arquivo no seu computador. O envio começa na hora.
5. O documento aparece na lista com nome, etiqueta ("Doc. comprobatório" ou "Assinado"), tamanho e data. Vídeos e áudios podem ser reproduzidos direto na tela.

> DICA: são aceitos PDF, Word, Excel, TXT, imagens (JPG, PNG, GIF, WEBP), vídeos (MP4, MOV e outros) e áudios (MP3, WAV, OGG, AAC e outros). Limites: 10 MB para documentos e imagens, 100 MB para vídeos e 20 MB para áudios. Se o arquivo passar do limite ou for de um tipo não aceito, o sistema mostra um aviso vermelho.

**Ativar uma ocorrência pendente:**

1. Anexe os documentos exigidos (veja o quadro laranja para saber o que falta).
2. Clique no botão verde **Ativar**, no topo. Se ainda faltar documento, o botão fica desativado — passe o mouse sobre ele para ver o que falta.
3. O sistema mostra a mensagem verde "Ocorrência ativada com sucesso" e o quadro muda para verde.

> ATENÇÃO: regra de documentos para ativar — a maioria dos tipos que exigem anexo precisa de **dois** documentos: o comprobatório do motivo **e** o documento assinado pelo colaborador. A exceção são as ocorrências de atestado médico — **Falta Justificada (atestado)**, **Licença Médica (até 15 dias)** e **Licença Médica (acima 15 dias — INSS)** — que precisam **apenas do atestado anexado** como documento comprobatório. O botão **Ativar** aparece para os perfis Administrador, Gestor, RH, DP1 e DP2.

**Gerar o PDF da ocorrência:**

1. Clique no botão **Gerar PDF**, no topo.
2. O sistema monta o documento com os dados da ocorrência, da empresa, dos anexos e das testemunhas, e baixa o arquivo no seu navegador.
3. Imprima para o colaborador assinar ou envie para assinatura eletrônica. Depois, anexe o documento assinado na aba Documentos.

> DICA: no cartão "Dados da Ocorrência", o campo **Assinatura** registra como o documento foi assinado: "Não informado", "Assinou em papel" ou "Enviado via Youk". Ao escolher, o sistema salva na hora e mostra "Forma de assinatura registrada".

**Cadastrar uma testemunha:**

1. Abra a aba **Testemunhas** e clique em **Adicionar**.
2. Preencha o nome (obrigatório) e, se souber, CPF, cargo e departamento.
3. Clique em **Salvar Testemunha**. Ela aparece na lista numerada.
4. Para remover, clique na lixeira ao lado do nome e confirme em **Sim, excluir**.

**Consultar a auditoria:**

1. Abra a aba **Auditoria** (aparece apenas para o perfil Gestor e o Administrador).
2. Veja o histórico de tudo o que aconteceu com a ocorrência: quando foi criada e cada mudança de status, com data e hora.

**Cancelar uma ocorrência:**

1. Clique no botão **Cancelar**, no topo (aparece enquanto a ocorrência está Pendente ou Ativa).
2. O sistema pergunta "Cancelar ocorrência?" e avisa que ela ficará no histórico como "Cancelada".
3. Clique em **Confirmar cancelamento** ou em **Voltar** para desistir. O sistema mostra "Ocorrência cancelada".

> ATENÇÃO: cancelar não apaga a ocorrência — ela continua no histórico. Em uma ocorrência cancelada, não é mais possível editar, anexar documentos nem cadastrar testemunhas.

### Campos e botões

- **Seta de voltar**: retorna à lista de ocorrências.
- **Gerar PDF**: baixa o documento da ocorrência pronto para impressão e assinatura.
- **Editar**: abre o formulário para corrigir os dados. Não aparece em ocorrências canceladas.
- **Ativar**: transforma a ocorrência pendente em ativa, depois que os documentos exigidos foram anexados.
- **Cancelar**: anula a ocorrência, que fica no histórico como "Cancelada".
- **Assinatura**: campo no cartão de dados para registrar se o colaborador assinou em papel ou se o documento foi enviado via Youk.
- **Aba Documentos (N)**: lista os anexos, com o total entre parênteses. Cada anexo mostra nome, etiqueta de tipo, descrição, tamanho e data.
- **Olho (Abrir arquivo)**: abre o anexo em uma nova aba do navegador.
- **Lixeira do anexo**: remove o arquivo de forma permanente, após confirmação.
- **Aba Testemunhas (N)**: lista as testemunhas numeradas, com cargo, departamento e CPF.
- **Adicionar**: abre o formulário de nova testemunha.
- **Aba Auditoria**: histórico de criação e mudanças de status da ocorrência (visível para Gestor e Administrador).

## Modelos de Ocorrência

É a tela onde ficam os modelos de documento usados no cadastro de ocorrências. Cada modelo tem um nome, um tipo e um texto padrão. A lista aparece agrupada por tipo (Advertência Verbal, Advertência Escrita, Suspensão, Falta, Afastamento, Férias, e assim por diante), com a quantidade de modelos de cada grupo.

[IMAGEM: modelos.png]

### Como fazer

**Cadastrar os modelos padrão de uma vez:**

1. Clique no botão **Cadastrar 46 Padrões**, no topo.
2. O sistema cadastra os 46 modelos padrão que ainda não existirem (atraso, advertência, suspensão, faltas de todos os tipos, afastamentos, férias, desligamento etc.) e mostra quantos foram cadastrados. Se já estiverem todos lá, ele avisa "Todos os modelos já estão cadastrados".

**Adicionar um modelo personalizado:**

1. No cartão "Adicionar Novo Modelo", preencha o **Nome** (ex.: "Falta - Abonada") e o **Tipo** (ex.: "Falta"). Os dois são obrigatórios.
2. Se quiser, escreva um **Texto Padrão** — o texto que aparece quando o modelo é usado. Se deixar em branco, o sistema usa um texto genérico com a data.
3. Clique em **Adicionar**. O sistema mostra a mensagem verde "Modelo adicionado" e o modelo entra na lista.

**Excluir um modelo:**

1. Passe o mouse sobre o modelo na lista e clique na lixeira que aparece à direita.
2. O sistema pergunta "Excluir modelo?" e avisa que a ação não pode ser desfeita.
3. Clique em **Excluir** para confirmar ou em **Cancelar** para desistir.

> ATENÇÃO: cadastrar, excluir e usar o botão de padrões só é possível para os perfis Administrador, Gestor, RH, DP1 e DP2. Os demais perfis apenas visualizam a lista.

### Campos e botões

- **Cadastrar 46 Padrões**: cria de uma vez todos os modelos padrão do sistema, sem duplicar os que já existem.
- **Nome**: nome do modelo, como aparece na lista. Obrigatório.
- **Tipo**: grupo do modelo (Falta, Suspensão, Afastamento etc.). Obrigatório — é o tipo que organiza os cartões da tela.
- **Texto Padrão (opcional)**: texto sugerido quando o modelo é usado.
- **Adicionar**: salva o novo modelo.
- **Lixeira**: exclui o modelo, após confirmação. Aparece ao passar o mouse sobre a linha.

## Alertas

É a tela de avisos automáticos do RH. O sistema analisa as ocorrências e aponta situações que pedem atenção, sempre com base na legislação trabalhista: limite de suspensões, estabilidade do colaborador, faltas excessivas, prazo de defesa, ocorrências paradas como pendentes, progressão disciplinar e homologação necessária.

No topo, quatro cartões resumem a situação: **Total** de alertas, **Críticos**, **Altos** e **Médios**. Cada alerta da lista tem uma cor conforme a gravidade: vermelho (crítica), laranja (alta), âmbar (média) e azul (baixa).

[IMAGEM: alertas.png]

### Como fazer

**Gerar os alertas:**

1. Clique no botão **Verificar Alertas**, no topo. Enquanto o sistema analisa, o botão mostra "Analisando...".
2. Ao terminar, o sistema mostra quantos alertas novos foram gerados — ou avisa que não encontrou nenhum alerta novo.

**Filtrar os alertas:**

1. Use os botões **Ativos**, **Lidos** e **Todos** para escolher quais alertas ver. A tela abre mostrando os ativos.
2. Se quiser, refine pela gravidade na lista "Todas severidades" (Crítica, Alta, Média ou Baixa). O filtro vale na hora.

**Tratar um alerta:**

1. Leia o título e a descrição do alerta. Se houver data limite, ela aparece em "Vence:".
2. Se o alerta for sobre um colaborador, clique no link **Ver colaborador** para abrir a ficha dele.
3. Quando o alerta estiver resolvido ou apenas conferido, clique no ícone de **check** (Marcar como lido): ele sai da lista de ativos e passa para a aba Lidos.
4. Se o alerta não se aplica mais, clique no ícone de **caixa** (Arquivar): ele some da lista.

> ATENÇÃO: o botão **Verificar Alertas**, o "marcar como lido" e o "arquivar" aparecem para o Administrador e para o perfil DP1. Os demais perfis apenas visualizam os alertas.

### Campos e botões

- **Verificar Alertas**: faz o sistema analisar as ocorrências e gerar os alertas automáticos.
- **Selo vermelho no topo**: mostra a quantidade de alertas críticos ativos, quando existe algum.
- **Cartões Total / Críticos / Altos / Médios**: resumo numérico dos alertas.
- **Ativos / Lidos / Todos**: filtra os alertas pela situação.
- **Todas severidades**: filtra pela gravidade (Crítica, Alta, Média ou Baixa).
- **Cartão de alerta**: mostra a gravidade, o tipo de alerta, a data de vencimento (quando houver), o título, a descrição e o link para o colaborador.
- **Check (Marcar como lido)**: move o alerta para a lista de lidos.
- **Caixa (Arquivar)**: arquiva o alerta, tirando-o da lista.
- **Base Legal dos Alertas**: quadro no rodapé com os artigos da CLT usados nas análises (Art. 482 — progressão disciplinar; Art. 474 — limite de suspensão; Art. 853 — estabilidade; Art. 211 — faltas justificadas).

## Dúvidas frequentes

**Por que minha ocorrência ficou "Pendente"?**
Porque o tipo escolhido exige documentos. Abra a ocorrência, anexe os documentos exigidos na aba Documentos e clique em **Ativar**. O quadro laranja sempre diz exatamente o que falta.

**Quais documentos preciso anexar para ativar?**
Em geral, dois: o documento comprobatório do motivo (atestado, foto, print etc.) e o documento assinado pelo colaborador. Exceção: as ocorrências de atestado médico (Falta Justificada, Licença Médica até 15 dias e Licença Médica acima de 15 dias — INSS) precisam só do atestado anexado.

**O colaborador vê que a ocorrência está "Pendente"?**
Não. "Pendente" é um controle interno do RH. O PDF gerado para assinatura não mostra essa situação.

**Apaguei uma ocorrência por engano. Tem como recuperar?**
Não — a exclusão é permanente e reservada ao Administrador. Se a ideia é só anular, prefira o botão **Cancelar** da tela de detalhe: a ocorrência fica guardada no histórico como "Cancelada".

**Encontrei uma ocorrência que eu não cadastrei. De onde veio?**
Provavelmente da importação de ponto: ao importar o espelho de ponto no módulo Adicionais, o sistema cria ocorrências automaticamente para faltas, atestados e afastamentos encontrados.
