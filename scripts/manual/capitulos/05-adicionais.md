# Capítulo 5 — Adicionais (Insalubridade, Periculosidade e Jornada)

O módulo Adicionais calcula quantos dias de insalubridade, periculosidade, adicional noturno, intrajornada (hora extra) e feriado cada colaborador tem direito no mês. Ele funciona em três passos: você cadastra os **contratos** (o que foi combinado com o cliente), liga os colaboradores a esses contratos (**vínculos**) e confere dia a dia quem trabalhou, faltou ou foi substituído (**calendário**). No fim, o **relatório** mostra o total de dias de cada adicional, pronto para enviar ao financeiro.

Quase todo o preenchimento do calendário é automático: basta importar o espelho de ponto em PDF do Flit na tela **Importar Ponto**. O mesmo arquivo também lança as ocorrências de faltas e atestados no módulo de Ocorrências.

O módulo tem seis abas, visíveis no topo de todas as telas: **Contratos**, **Vínculos**, **Calendário**, **Feriados**, **Relatório** e **Importar Ponto**.

> DICA: a ordem certa de trabalho é: 1) cadastrar o contrato, 2) criar os vínculos, 3) importar o ponto, 4) conferir o calendário e definir os substitutos, 5) tirar o relatório.

## Contratos

É a tela onde você cadastra cada contrato de trabalho que tem adicional combinado (por exemplo, "Limpeza no Condomínio Solar"). Aqui você diz qual é o departamento, quantas pessoas o contrato prevê, qual é a escala (12x36, 6x1 etc.) e quais adicionais o contrato paga.

[IMAGEM: adicionais-contratos.png]

### Como fazer

**Cadastrar um contrato:**

1. No cartão "Novo contrato", escreva o **Nome do contrato**.
2. Escolha o **Departamento** na lista (ou deixe "Sem departamento").
3. Informe a **Quantidade de colaboradores** prevista no contrato.
4. Escolha o **Regime de trabalho**.
5. Marque os **Adicionais contratuais** que o contrato paga. Se marcar "Intradiurna (HE)", aparece a lista de **Dias de intrajornada** — marque os dias da semana em que trabalhar gera a hora extra.
6. Clique em **Salvar**. O contrato aparece na lista "Contratos cadastrados".

**Editar um contrato:**

1. Na lista, clique no **lápis** do contrato.
2. O cartão do topo muda para "Editar contrato", já preenchido.
3. Altere o que precisar e clique em **Atualizar**. Para desistir, clique em **Cancelar**.

**Excluir um contrato:**

1. Clique na **lixeira vermelha** do contrato.
2. O sistema pergunta "Excluir contrato?" e avisa que a ação não pode ser desfeita.
3. Clique em **Excluir** para confirmar, ou em **Cancelar**.

**Ver quem está vinculado ao contrato:**

1. Na coluna "# de colaboradores", clique no número (por exemplo, `3/4`).
2. Abre a janela "Colaboradores vinculados", com nome, período e matrícula de cada pessoa.
3. Clique em **Fechar** para sair.

**Encontrar um contrato na lista:**

1. Use o filtro **Departamento** para ver só os contratos de um departamento.
2. Use o filtro **Adicional** para ver só os contratos que pagam determinado adicional.
3. A lista se ajusta sozinha, assim que você escolhe o filtro.

### Campos e botões

- **Nome do contrato**: nome que identifica o contrato nas outras telas. Obrigatório — sem ele, o botão Salvar fica desabilitado.
- **Departamento**: departamento ao qual o contrato pertence. Pode ficar "Sem departamento".
- **Quantidade de colaboradores**: quantas pessoas o contrato prevê. Serve de conferência: na lista, o sistema compara com os vínculos criados.
- **Regime de trabalho**: a escala do contrato. Opções: "12 × 36 (dia sim, dia não)", "6 × 1 (6 trabalhados, 1 folga)", "5 × 2 (seg a sex)" e "Personalizado (preencher dia a dia)". É ela que monta o calendário automaticamente.
- **Adicionais contratuais**: caixas de marcação para Insalubridade, Noturno, Periculosidade, Feriado e Intradiurna (HE).
- **Dias de intrajornada**: aparece só quando "Intradiurna (HE)" está marcada. São os dias da semana (Seg a Dom) e a opção "Feriado" em que trabalhar gera o adicional de intrajornada.
- **Salvar / Atualizar**: grava o contrato. "Atualizar" aparece quando você está editando.
- **Cancelar**: abandona a edição e limpa o cartão.
- **Filtro Departamento**: campo de busca de departamento acima da lista.
- **Filtro Adicional**: mostra só contratos que pagam o adicional escolhido (Noturno, Periculosidade, Insalubridade, Intrajornada ou Feriado).
- **Coluna "# de colaboradores"**: mostra `vinculados/previstos` (ex.: `3/4`). Fica amarela com a palavra "incompleto" quando faltam vínculos. Clique no número para ver quem está vinculado.
- **Lápis**: edita o contrato.
- **Lixeira vermelha**: exclui o contrato (pede confirmação).

> ATENÇÃO: o cartão "Novo contrato" e os botões de editar e excluir só aparecem para os perfis Administrador, Gestor, DP2, Mesa e Financeiro. Os demais perfis apenas veem a lista.

## Vínculos

Vínculo é a ligação entre um colaborador e um contrato, com data de início e fim. É o vínculo que faz o colaborador aparecer no Calendário e no Relatório: **sem vínculo, a importação de ponto não grava os dias dele no calendário** (só as ocorrências). O vínculo novo herda automaticamente os adicionais marcados no contrato.

[IMAGEM: adicionais-vinculos.png]

### Como fazer

**Criar um vínculo:**

1. No cartão "Novo vínculo", escolha o **Colaborador** (a lista mostra nome e matrícula).
2. Escolha o **Contrato**.
3. Preencha **Início** e **Fim** do período de atuação.
4. Clique em **Adicionar vínculo**. Ele aparece na lista abaixo.

**Editar um vínculo:**

1. Clique no **lápis** do vínculo.
2. Na janela "Editar vínculo" você pode trocar o contrato, ligar ou desligar adicionais **só para aquela pessoa** (caixas "Adicionais deste vínculo") e mudar as datas.
3. Clique em **Salvar**. Para desistir, clique em **Cancelar**.

**Excluir um vínculo:**

1. Clique na **lixeira vermelha** do vínculo.
2. O sistema avisa que o histórico de calendário daquele vínculo também será removido.
3. Clique em **Excluir** para confirmar, ou em **Cancelar**.

**Copiar os vínculos para o mês seguinte:**

1. Clique em **Copiar do período anterior**, no topo da tela.
2. O sistema explica que vai criar, no mês seguinte, vínculos iguais aos que estão ativos no mês atual — empurrando as datas um mês para frente. Vínculos que já existirem no destino são ignorados (não duplica).
3. Clique em **Confirmar cópia**. Durante o processo o botão mostra "Copiando...".

**Corrigir vínculos antigos:**

1. Clique em **Corrigir vínculos**, no topo da tela.
2. O sistema preenche automaticamente nome, matrícula e adicionais em vínculos antigos que foram gravados sem essas informações.

**Encontrar um vínculo na lista:**

1. Use os filtros **Departamento** e **Adicional**, ou digite no campo **Buscar** (aceita nome do colaborador, matrícula ou nome do contrato).
2. A lista se ajusta sozinha enquanto você digita.

### Campos e botões

- **Colaborador**: pessoa que será ligada ao contrato. A lista mostra nome e matrícula, em ordem alfabética.
- **Contrato**: contrato ao qual a pessoa será ligada.
- **Início / Fim**: período de atuação no contrato. Só os dias dentro desse período entram no calendário.
- **Adicionar vínculo**: grava o vínculo. Fica desabilitado até preencher tudo.
- **Corrigir vínculos**: botão do topo que conserta vínculos antigos gravados sem nome, matrícula ou adicionais.
- **Copiar do período anterior**: botão do topo que replica os vínculos ativos para o mês seguinte.
- **Filtro Departamento**: mostra só vínculos de contratos daquele departamento.
- **Filtro Adicional**: mostra só vínculos que têm o adicional escolhido.
- **Buscar**: procura por nome do colaborador, matrícula ou nome do contrato.
- **Lápis**: abre a janela de edição (contrato, adicionais da pessoa e datas).
- **Lixeira vermelha**: exclui o vínculo e o calendário dele (pede confirmação).

> ATENÇÃO: excluir um vínculo apaga também todos os dias já lançados para ele no Calendário. Se a pessoa continua no contrato e só mudou o período, prefira editar as datas.

> DICA: o cartão "Novo vínculo", o botão de salvar na edição e os botões "Corrigir vínculos" e "Copiar do período anterior" só aparecem para os perfis Administrador, DP1, DP2 e Mesa.

## Calendário

É a tela principal do módulo. Aqui você vê, para cada colaborador vinculado, uma fileira de quadradinhos — um para cada dia do período — com a situação daquele dia: trabalhou, faltou, férias, afastado ou folga. É aqui também que você indica **quem substituiu** quem faltou ou saiu de férias, porque isso muda o cálculo dos adicionais.

O período exibido não é o mês fechado: vai do **dia 20 de um mês ao dia 19 do seguinte** (o período de apuração da folha). Use as setas "Período anterior" e "Próximo período" para navegar.

[IMAGEM: adicionais-calendario.png]

### Como fazer

**Mudar o status de um dia:**

1. Encontre o cartão do colaborador (use os filtros ou a busca, se precisar).
2. Clique no quadradinho do dia.
3. Na janela "Alterar status do dia", clique na situação certa: ✅ Trabalhou, ❌ Falta, 🏖️ Férias, 🏥 Afastado, 🏠 FO Folga sem substituição ou 👥 FS Folga com substituição.
4. O sistema mostra o aviso "Status alterado... Clique em Salvar para confirmar" e o dia fica com borda amarela (alteração pendente).
5. Repita para os demais dias e, no fim, clique no botão **Salvar** no topo da tela. Ele mostra entre parênteses quantas alterações serão gravadas.

> ATENÇÃO: as mudanças de status só são gravadas quando você clica em **Salvar**. Se sair da tela antes, elas se perdem.

**Definir o substituto de um dia:**

1. Dias de falta, férias, afastamento ou folga com substituição ficam pulsando com um selo amarelo — é o sistema pedindo o substituto. Eles também aparecem no cartão "Substituições pendentes", no topo.
2. Clique no selo amarelo do dia (ou no próprio dia e escolha "FS Folga com substituição", que já abre a janela).
3. Na janela "Adicionar substituto", digite o nome ou a matrícula no campo de busca.
4. Clique na pessoa na lista (ela mostra nome, matrícula e departamento).
5. Clique em **Confirmar substituição**. O dia ganha um selo verde de substituto definido.

**Definir o substituto de vários dias de uma vez (ideal para férias):**

1. No cartão do colaborador que tem dias pendentes, clique em **Definir substituto (N dias)**.
2. A janela já mostra todos os dias pendentes marcados. Clique em um dia para tirá-lo da lista, se preciso.
3. Busque e escolha o substituto.
4. Clique em **Confirmar (N dias)**. O sistema mostra a mensagem verde "Fulano definido como substituto em N dia(s)".

**Dispensar o substituto de um dia (ninguém cobriu mesmo):**

1. Abra a janela "Adicionar substituto" do dia.
2. Clique em **Ignorar**. O alerta amarelo daquele dia some.

**Apagar o lançamento de um dia:**

1. Clique no dia e, na janela de status, clique em **Remover lançamento**.
2. Confirme em **Sim, excluir**. O dia volta ao padrão da escala.

**Filtrar o que aparece na tela:**

1. Use os filtros **Departamento**, **Contrato**, **Adicional** e **Buscar colaborador** (nome ou matrícula).
2. Na "Legenda (clique para filtrar)", clique num status para ver só os cartões que têm aquele tipo de dia — por exemplo, clique em "⚠️ Precisa de substituto" para ver só quem está pendente.
3. Clique em **Limpar filtros** para voltar a ver tudo.

### Campos e botões

- **Período anterior / Próximo período**: setas que mudam o período exibido (sempre de dia 20 a dia 19).
- **Departamento**: filtra os cartões por departamento.
- **Contrato**: filtra os cartões por contrato.
- **Adicional**: mostra só vínculos com o adicional escolhido. Também faz o resumo "Direito no período" mostrar apenas esse adicional.
- **Ordenar por**: organiza os cartões por Colaborador, Departamento ou Adicional. A setinha ao lado inverte a ordem (A → Z ou Z → A).
- **Buscar colaborador**: procura por nome ou matrícula.
- **Salvar**: grava todas as alterações pendentes. Mostra o número de alterações entre parênteses e fica com um anel amarelo enquanto há o que salvar.
- **Legenda (clique para filtrar)**: botões coloridos de cada status. Clicar filtra os cartões; clicar de novo desfaz.
- **⚠️ Precisa de substituto**: filtro especial que mostra só os vínculos com dias sem substituto definido.
- **Quadradinho do dia**: mostra o número do dia e um emoji (✅ trabalhou, ❌ falta, 🏖️ férias, 🏥 afastado, 🏠 folga, 👥 folga com substituição). Passe o mouse para ver a explicação. Borda amarela = alteração ainda não salva; borda tracejada cinza = dia não preenchido (vale o padrão da escala).
- **Selo verde no canto do dia**: há substituto definido (ou a pessoa está substituindo alguém nesse dia).
- **Selo amarelo no canto do dia**: falta definir o substituto. Clique nele para abrir a janela.
- **Selo azul "HE"**: naquele dia, trabalhar gera o adicional de intrajornada (hora extra), conforme os dias configurados no contrato.
- **Definir substituto (N dias)**: botão no topo do cartão do colaborador, abre a janela de substituição em lote.
- **Remover lançamento**: dentro da janela de status, apaga o lançamento do dia.
- **Ignorar**: dentro da janela de substituto, dispensa a cobertura daquele dia.
- **Direito no período**: faixa no rodapé de cada cartão que mostra o cálculo do titular — por exemplo, "Insalubridade: 28 dias".

### Como o sistema calcula o direito do titular e do substituto

- **Titular do posto**: recebe o adicional pelos **30 dias do mês**, descontando as **faltas** e os dias de férias ou afastamento **em que alguém o substituiu**. Se ninguém substituiu, o titular não perde nada.
- **Escala 12x36**: quando o substituto cobre um dia de escala do titular, o sistema desconta do titular o dia trabalhado **mais a folga do dia seguinte** (a folga "pareada"). Por isso cada dia coberto no 12x36 vale dois no desconto.
- **Substituto — insalubridade**: recebe pelos dias em que cobriu férias ou afastamento **e também** pelas coberturas de falta e de folga.
- **Substituto — periculosidade**: recebe **apenas** pelos dias em que cobriu férias ou afastamento. Cobrir falta não gera periculosidade para o substituto.
- **Feriado**: conta só para quem tem o adicional de feriado marcado no contrato **e** cuja escala previa trabalho naquele dia. Quem cobriu um feriado como substituto não recebe — não estava escalado.
- **Noturno e intrajornada**: contam os dias efetivamente trabalhados (a intrajornada, só nos dias configurados no contrato).

> DICA: marcar o dia como férias ou afastado **sem** definir substituto não desconta nada do titular. O desconto só acontece quando você confirma quem cobriu.

## Feriados

Lista das datas que geram o adicional de feriado. Os feriados nacionais já vêm cadastrados; aqui você acrescenta os municipais e as datas específicas de cada contrato (por exemplo, aniversário da cidade ou feriado do condomínio).

[IMAGEM: adicionais-feriados.png]

### Como fazer

**Cadastrar um feriado:**

1. No cartão "Novo feriado", escolha a **Data**.
2. Escreva o **Nome** (ex.: "Aniversário de Niterói").
3. Clique em **Adicionar feriado**. O sistema mostra a mensagem verde "Feriado XX/XX/XXXX cadastrado" e a data aparece na lista.

**Excluir um feriado (só Administrador):**

1. Clique na **lixeira vermelha** da linha.
2. O sistema avisa que o relatório de adicionais deixará de contar aquela data.
3. Clique em **Sim, excluir** para confirmar.

### Campos e botões

- **Data**: dia do feriado.
- **Nome**: como o feriado aparece na lista.
- **Adicionar feriado**: grava a data. Fica desabilitado até preencher data e nome.
- **Lista "Feriados cadastrados (N)"**: mostra data e nome de todos os feriados, com o total entre parênteses.
- **Lixeira vermelha**: exclui o feriado. **Só aparece para o Administrador.**

> ATENÇÃO: o feriado só gera adicional para o vínculo cujo contrato tem o adicional "Feriado" marcado **e** cuja escala previa trabalho naquele dia. Substituto que cobre um feriado não recebe o adicional.

## Relatório

Consolida o período em uma tabela: uma linha por colaborador e contrato, com os totais de dias de cada adicional, além de folgas, faltas, férias e afastamentos. É o resultado final do módulo, pronto para exportar em Excel ou CSV e mandar para o financeiro. Quem trabalhou como substituto aparece com linha própria no contrato que cobriu, com os dias calculados pela regra do substituto.

[IMAGEM: adicionais-relatorio.png]

### Como fazer

**Consultar o período:**

1. Use as **setas** ao lado das datas para trocar o período (sempre de dia 20 a dia 19).
2. A tabela se recalcula sozinha.

**Filtrar o resultado:**

1. Use **Departamento** para ver só um departamento.
2. Use **Adicional** para ver só as linhas de contratos que pagam aquele adicional.
3. Use **Buscar** para procurar por colaborador, contrato ou departamento.

**Ordenar a tabela:**

1. Clique no título da coluna: Colaborador, Departamento, Noturno, Periculosidade, Insalubridade, Intrajornada ou Feriado.
2. Clique de novo para inverter a ordem. Nas colunas de números, o primeiro clique ordena do maior para o menor.

**Exportar:**

1. Clique em **Excel** para baixar o arquivo `relatorio_adicionais.xlsx`, ou em **CSV** para baixar `relatorio_adicionais.csv`.
2. O arquivo sai com as mesmas linhas que você está vendo na tela (filtros aplicados).

### Campos e botões

- **Setas de período**: mudam o mês de apuração (dia 20 a dia 19).
- **Departamento**: filtra por departamento.
- **Adicional**: filtra por contratos que pagam o adicional escolhido.
- **Buscar**: procura por colaborador, contrato ou departamento.
- **Excel**: baixa a planilha com os resultados filtrados.
- **CSV**: baixa o arquivo de texto com os mesmos dados.
- **Coluna Colaborador**: nome da pessoa. Clicável para ordenar.
- **Coluna Contrato**: contrato do vínculo (ou do posto coberto, no caso do substituto).
- **Coluna Departamento**: departamento do contrato. Clicável para ordenar.
- **Trabalhados**: dias trabalhados no período.
- **Noturno**: dias com direito ao adicional noturno. Clicável para ordenar.
- **Periculosidade**: dias de direito — para o titular, 30 menos faltas e dias transferidos ao substituto; para o substituto, só os dias de férias/afastamento cobertos. Clicável para ordenar.
- **Insalubridade**: mesma regra do titular; o substituto soma também as coberturas de falta e folga. Clicável para ordenar.
- **Intrajornada**: dias trabalhados que caem nos dias de intrajornada configurados no contrato. Clicável para ordenar.
- **Feriado**: feriados do período em que a pessoa estava escalada e o contrato paga o adicional. Clicável para ordenar.
- **Folgas / Faltas / Férias / Afastados**: contagens de conferência do período.

## Importar Ponto

É a tela que alimenta o módulo automaticamente. Você exporta do Flit o relatório **"CORH - Adicionais e Ocorrências"** em PDF e envia aqui. O sistema lê o espelho de ponto de cada colaborador, localiza a pessoa no cadastro **pelo CPF**, preenche o Calendário de quem tem vínculo e ainda lança as ocorrências de faltas e atestados no módulo de Ocorrências — tudo com um único arquivo.

[IMAGEM: adicionais-importar-ponto.png]

### Como fazer

**Importar um novo PDF:**

1. Clique em **Selecionar arquivo** e escolha o PDF exportado do Flit.
2. O nome do arquivo aparece ao lado do botão. Clique em **Processar PDF**.
3. Se esse mesmo arquivo já tiver sido enviado antes, o sistema pergunta o que fazer: **Usar o que está no sistema** (aproveita o registro antigo), **Reenviar arquivo** (grava de novo) ou **Cancelar**.
4. O sistema analisa o PDF e mostra uma mensagem para cada colaborador: verde quando encontrado, amarela quando o nome diverge do cadastro (o CPF bateu, então vale), vermelha quando não encontrado.
5. Confira o cartão "Resumo dos colaboradores do PDF" e a "Pré-visualização" (veja abaixo como revisar).
6. Clique em **Confirmar importação**. O botão mostra "Importando..." durante o processo.
7. No fim, o sistema mostra a mensagem verde com o resumo: "X dia(s) importado(s), Y ocorrência(s) criada(s), Z duplicada(s) ignorada(s)" — e avisos amarelos se houve colaborador não encontrado ou sem vínculo.

**Reutilizar um PDF que outra pessoa já enviou:**

1. Sem nenhum arquivo selecionado, procure o cartão **"Arquivos já enviados"**.
2. Ele lista os espelhos salvos, com data, nome de quem enviou e tamanho.
3. Clique em **Usar este arquivo**. O sistema baixa o PDF e processa como se você tivesse acabado de enviar.

**Excluir um arquivo salvo (só Administrador):**

1. No cartão "Arquivos já enviados", clique na **lixeira vermelha** do arquivo.
2. Confirme em **Excluir**. O arquivo some e não pode mais ser reutilizado.

**Revisar a pré-visualização antes de confirmar:**

1. Cada colaborador do PDF vira um cartão com nome, CPF parcialmente oculto, matrícula e o resultado da localização: ✅ Encontrado, ⚠️ Nome diverge (casado pelo CPF) ou ⚠️ Não encontrado. Aparece também "🔗 Com vínculo" ou "⚠️ Sem vínculo (só ocorrências)".
2. Os selos coloridos do cartão resumem o espelho: ✅ trabalhados, 🏠 folgas, ❌ faltas, 🏖️ férias, 🏥 afastados e ⚠️ dias para revisar.
3. Clique no cartão para abrir a tabela dia a dia, com os horários e o status de cada dia.
4. Para corrigir um dia, mude o **Status** na lista da linha (trabalhou, falta, férias, afastado ou folga). As alterações já valem para a importação — inclusive criam ou cancelam ocorrências.
5. Se aparecer o aviso amarelo "Existem dias marcados para revisão", procure as linhas com a palavra "Revisar" e confira antes de confirmar.

**Importar só alguns colaboradores:**

1. Na pré-visualização, desmarque a **caixa de seleção** ao lado do nome de quem não deve entrar.
2. Colaboradores desmarcados ficam esmaecidos, com o aviso "⏭️ Dias não serão importados" — e, para eles, o calendário do período **não** é apagado nem alterado.
3. Use **Marcar todos / Desmarcar todos** para mudar todos de uma vez.

**Conferir as ocorrências que serão lançadas:**

1. No cartão "Opções", a caixa **"Lançar ocorrências automaticamente para Faltas e Atestados"** já vem marcada. Desmarque se quiser importar só o calendário.
2. O cartão "Ocorrências que serão lançadas" lista cada ocorrência: colaborador, tipo, período, quantidade de dias e status inicial.
3. Desmarque a caixa da linha para não lançar aquela ocorrência. Linhas esmaecidas já existem no sistema e serão ignoradas automaticamente (não duplica).

### Campos e botões

- **Selecionar arquivo**: abre a janela para escolher o PDF do Flit.
- **Nome do arquivo com X**: mostra o arquivo escolhido; o X vermelho limpa a seleção e a pré-visualização.
- **Processar PDF**: lê o arquivo e monta a pré-visualização. Mostra "Processando..." durante a leitura.
- **Arquivos já enviados**: cartão com os PDFs salvos no sistema, disponíveis para qualquer operador reutilizar.
- **Usar este arquivo**: baixa e processa um PDF já enviado, sem precisar do arquivo em mãos.
- **Lixeira do arquivo salvo**: exclui o PDF do sistema. **Só aparece para o Administrador.**
- **Resumo dos colaboradores do PDF**: lista colorida — verde (encontrado), amarelo (nome diverge, casado pelo CPF), vermelho (não encontrado). Quem não é encontrado não recebe dias nem ocorrências; confira o cadastro dele.
- **Pré-visualização**: cartões dos colaboradores com caixa de seleção (marca quem terá os dias importados), resumo de dias e tabela dia a dia ao clicar.
- **Status (na tabela do dia)**: lista para corrigir a situação de cada dia antes de importar.
- **Lançar ocorrências automaticamente para Faltas e Atestados**: caixa do cartão "Opções". Só aparece para quem pode lançar ocorrências (Administrador, Gestor, RH, DP1, DP2, Mesa e Financeiro).
- **Ocorrências que serão lançadas (N)**: lista com caixa de seleção por linha. O status inicial mostra "Ativa", "Pendente (aguarda anexo)" ou "Já existe — será ignorada".
- **Marcar todas / Desmarcar todas**: atalho para as caixas da lista de ocorrências.
- **Confirmar importação**: grava os dias no Calendário e lança as ocorrências marcadas.
- **Cancelar**: descarta a pré-visualização e limpa a tela.

> ATENÇÃO: reimportar o mesmo período **apaga os lançamentos manuais e os substitutos** do calendário dos colaboradores marcados, voltando tudo ao estado do PDF. Depois de reimportar, refaça os substitutos pela aba **Calendário** (o botão "Definir substituto" cobre as férias de uma vez).

> DICA: o aviso "X colaborador(es) sem vínculo de adicional" significa que a pessoa foi encontrada, mas não tem vínculo cobrindo as datas do espelho — os dias dela não vão para o calendário (as ocorrências são lançadas normalmente). Crie o vínculo na aba **Vínculos** e importe de novo.

## Dúvidas frequentes

**Por que o período vai do dia 20 ao dia 19, e não do dia 1 ao 30?**

Esse é o período de apuração usado para o fechamento da folha. O Calendário, o Relatório e a importação de ponto seguem todos essa mesma faixa de datas.

**Reimportei o PDF do ponto e os substitutos sumiram. E agora?**

É o comportamento esperado: reimportar devolve o período ao estado do espelho, apagando lançamentos manuais e substitutos dos colaboradores marcados. Vá à aba **Calendário**, filtre por "⚠️ Precisa de substituto" e refaça as coberturas — o botão "Definir substituto (N dias)" resolve as férias de uma vez.

**O colaborador apareceu no PDF, mas não ganhou dias no calendário. Por quê?**

Ele não tem vínculo cobrindo as datas do espelho. A importação só grava dias para quem tem vínculo ativo — sem vínculo, vão só as ocorrências. Crie o vínculo na aba **Vínculos** e processe o arquivo de novo (pode usar o botão "Usar este arquivo" no cartão "Arquivos já enviados").

**O substituto que cobriu uma falta recebe periculosidade por esse dia?**

Não. Para o substituto, a periculosidade só conta nos dias em que ele cobriu férias ou afastamento do titular. Já a insalubridade conta nas duas situações: cobertura de férias/afastamento e também de faltas e folgas.

**Quem pode excluir feriados e os PDFs já enviados?**

Apenas o Administrador. A lixeira da aba **Feriados** e a do cartão "Arquivos já enviados" na tela **Importar Ponto** não aparecem para os demais perfis.
