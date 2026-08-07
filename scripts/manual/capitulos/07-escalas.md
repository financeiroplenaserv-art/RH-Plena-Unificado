# Capítulo 7 — Escalas (Locais de Trabalho Diários)

O módulo Escalas mostra, dia a dia, em qual local de trabalho (posto) cada colaborador esteve. O sistema lê o arquivo Excel de marcações do Flit e descobre sozinho o local de cada pessoa em cada dia. O que ele não conseguir descobrir fica marcado como "Não identificado" e espera a sua confirmação na mão.

O módulo tem quatro abas, que aparecem no topo de todas as telas: **Escalas** (o diário), **Importar**, **Locais** e **Mapeamento**.

> DICA: antes de importar pela primeira vez, cadastre os locais na aba Locais e ensine o sistema na aba Mapeamento. Assim a importação já sai quase toda identificada automaticamente.

## Escalas (Diário de escalas)

Esta é a tela principal do módulo. Ela mostra uma lista com uma linha para cada dia de cada colaborador: dia, nome, função e o local de trabalho daquele dia. Quando o sistema não conseguiu descobrir o local, a linha aparece como "Não identificado" (em itálico) e o botão da linha se chama "Confirmar". Quando o local já está definido, o botão se chama "Alterar" e serve para corrigir.

No topo há um painel de filtros para escolher o período e refinar a lista. A competência padrão vai do dia 20 de um mês ao dia 19 do mês seguinte — a própria tela mostra o intervalo exato logo abaixo do mês escolhido.

[IMAGEM: escalas.png]

### Como fazer

**Ver a escala de uma competência**

1. No painel de filtros, deixe marcada a opção "Competência (20 a 19)".
2. Escolha o **Ano** e o **Mês**. A tela mostra logo abaixo o intervalo exato (por exemplo, de 20/06/2026 a 19/07/2026).
3. Clique em **Aplicar**. A lista é atualizada com os dias daquela competência.

**Ver um período qualquer**

1. Marque a opção "Período livre".
2. Preencha **Data início** e **Data fim**.
3. Clique em **Aplicar**.

> DICA: para ver só o que falta confirmar, mude o filtro **Status** para "Não identificados" e clique em **Aplicar**.

**Confirmar um dia que ficou "Não identificado"**

1. Na linha do dia, clique no botão **Confirmar**.
2. Na janela que abre, o sistema mostra o nome do colaborador, a matrícula e a data. Se o colaborador já trabalhou em alguns locais recentemente, eles aparecem como botões prontos na parte de cima da janela — clique em um deles para preencher o local com um toque.
3. Se preferir, escolha o local na lista **Local de Trabalho**.
4. Se quiser, escreva uma **Observação** (por exemplo: "Confirmado via geolocalização no Flit").
5. Clique em **Salvar**. O sistema mostra a mensagem verde "Local confirmado", a janela fecha e a linha passa a exibir o local escolhido.

> DICA: confirmações feitas na mão nunca são apagadas ao reimportar o Excel. Pode confirmar sem medo.

**Alterar o local de um dia já identificado**

1. Na linha do dia, clique em **Alterar**.
2. Escolha o novo local, ajuste a observação se quiser e clique em **Salvar**.

**Confirmar vários dias de uma vez (em lote)**

1. Marque a caixinha de seleção no início de cada linha que você quer confirmar. Para marcar tudo de uma vez, clique na caixinha do cabeçalho da tabela.
2. Ao marcar a primeira linha, aparece acima da tabela a barra **"Aplicar local em N dia(s)"**.
3. Escolha o local na lista da barra e, se quiser, escreva uma observação.
4. Clique em **Confirmar em lote**. O sistema mostra a mensagem verde "N dia(s) atualizado(s)" e as linhas marcadas passam a exibir o local escolhido.

**Ordenar a tabela**

1. Clique no título da coluna **Dia**, **Colaborador** ou **Função** para ordenar em ordem crescente.
2. Clique de novo para inverter a ordem. Uma setinha ao lado do título indica a direção atual.

**Exportar para Excel**

1. Aplique os filtros desejados primeiro.
2. Clique em **Exportar Excel**. O navegador baixa o arquivo `escalas_AAAA-MM-DD.xlsx` com as colunas Dia, Colaborador, Local de Trabalho, Fonte e Observação, e o sistema avisa quantos registros foram exportados.

**Exportar para PDF**

1. Aplique os filtros desejados primeiro.
2. Clique em **Exportar PDF**. O navegador baixa o arquivo `escalas_AAAA-MM-DD.pdf`, com uma página por mês de competência e as colunas Dia, Colaborador, Local de Trabalho e Fonte.

> ATENÇÃO: se não houver nenhum registro nos filtros aplicados, o sistema avisa "Nenhum registro para exportar. Aplique um filtro primeiro." e não baixa nada.

### Campos e botões

- **Competência (20 a 19)**: opção de período que usa a regra da folha — do dia 20 do mês escolhido ao dia 19 do mês seguinte.
- **Período livre**: opção de período para escolher datas de início e fim manualmente.
- **Ano / Mês**: ano e mês base da competência (só aparecem com "Competência" marcada). Logo abaixo, a tela mostra o intervalo exato calculado.
- **Data início / Data fim**: datas do período livre (só aparecem com "Período livre" marcado).
- **Colaborador**: filtra a lista por uma pessoa. A opção "Todos" mostra todos.
- **Local**: filtra a lista por um local de trabalho. A opção "Todos" mostra todos.
- **Status**: "Todos", "Identificados" (dias com local definido) ou "Não identificados" (dias pendentes de confirmação).
- **Aplicar**: botão que executa a pesquisa com os filtros escolhidos.
- **Limpar**: volta os filtros ao padrão (competência atual, todos os colaboradores e locais).
- **Exportar Excel**: baixa a lista filtrada em planilha.
- **Exportar PDF**: baixa a lista filtrada em PDF, uma página por mês.
- **Aviso amarelo "N dia(s) aguardando confirmação manual"**: aparece acima da tabela quando há dias não identificados na lista atual.
- **Caixinha de seleção (cada linha e cabeçalho)**: marca dias para a confirmação em lote.
- **Barra "Aplicar local em N dia(s)"**: aparece quando há linhas marcadas; nela você escolhe o local, escreve uma observação e clica em **Confirmar em lote**.
- **Confirmar em lote**: grava o local escolhido em todos os dias marcados. Fica desabilitado até você escolher um local.
- **Confirmar / Alterar (botão de cada linha)**: abre a janela para definir ou corrigir o local daquele dia.
- **Janela de confirmação — Locais usados recentemente**: botões com os últimos locais daquele colaborador (com a quantidade de vezes entre parênteses); clicar em um deles preenche o local automaticamente.
- **Janela de confirmação — Local de Trabalho**: lista para escolher o local do dia.
- **Janela de confirmação — Observação**: campo livre para anotar como o local foi confirmado.
- **Cancelar / Salvar (na janela)**: fecha sem gravar ou grava o local escolhido. O botão Salvar fica desabilitado até escolher um local.
- **Importar escala**: botão que aparece quando a lista está vazia; leva direto para a aba Importar.

## Importar

Esta tela recebe o arquivo Excel de marcações do Flit e grava os dias no sistema. Ao importar, o sistema tenta descobrir sozinho o local de cada dia, seguindo esta ordem de pistas:

1. **Dispositivo fixo** — em qual aparelho "Flit Multi" a pessoa bateu o ponto;
2. **Perímetro** — a cerca virtual (geolocalização) registrada na marcação;
3. **Nome do horário (turno)** — o nome da escala do dia, que costuma trazer o posto;
4. **Departamento** — o cadastro da pessoa, usado como conferência final.

A ordem faz diferença: quem é faltista tem departamento fixo e genérico, mas trabalha em postos diferentes a cada dia — por isso o turno é lido antes do departamento. O que nenhuma pista resolver fica como "Não identificado" para você confirmar na aba Escalas.

[IMAGEM: escalas-importar.png]

### Como fazer

**Importar um Excel novo**

1. Clique no campo **Arquivo Excel do Flit** e escolha o arquivo (`.xlsx` ou `.xls`) no seu computador. A tela mostra uma pré-visualização com as primeiras linhas (colaborador, matrícula, data, local e dispositivo) para você conferir se é o arquivo certo.
2. Escolha o **Modo de importação**:
   - **Importar todos os dias do Excel**: grava tudo o que está no arquivo;
   - **Apenas o dia anterior**: grava só as marcações de ontem (útil para a rotina diária);
   - **Filtrar por competência**: grava só os dias dentro da competência escolhida — preencha **Ano** e **Mês base** e confira o intervalo exato que a tela mostra (dia 20 a dia 19).
3. Clique em **Importar para o CORH**. Enquanto processa, o botão mostra "Importando...".
4. Ao terminar, aparece o cartão **Resumo da importação** com: quantos dias foram importados, quantos foram identificados automaticamente, quantos ficaram não identificados e, quando for o caso, quantas confirmações manuais foram preservadas. Se algum nome do Excel não existir no cadastro do CORH, ele aparece na lista "Colaboradores não encontrados no CORH".

> ATENÇÃO: reimportar um período já importado **não apaga** as confirmações feitas na mão na aba Escalas. Os dias em comum são atualizados com os dados novos, mas o que você confirmou manualmente é preservado (o resumo mostra quantas confirmações foram preservadas).

**Reaproveitar um Excel já enviado**

1. Sem escolher arquivo novo, olhe o cartão **Arquivos já enviados**. Ele lista cada Excel enviado, com data, nome de quem enviou e tamanho.
2. Clique em **Usar este arquivo** na linha desejada. O sistema baixa o arquivo do servidor e o carrega como se você tivesse anexado — aparece a pré-visualização e você segue o passo a passo normal de importação, sem precisar do arquivo em mãos.

> DICA: todo Excel importado fica salvo no servidor automaticamente. Qualquer operador pode reaproveitá-lo depois — útil quando outra pessoa fez o primeiro envio.

**Excluir um arquivo salvo** (somente Administrador)

1. No cartão **Arquivos já enviados**, clique na lixeira vermelha na linha do arquivo.
2. Confirme em **Excluir** na janela que abre. O arquivo é removido do servidor e não pode mais ser reutilizado. O sistema mostra a mensagem "Arquivo removido".

### Campos e botões

- **Arquivo Excel do Flit**: seletor de arquivo; aceita `.xlsx` e `.xls`. Ao escolher, a pré-visualização das primeiras linhas aparece na hora.
- **Modo de importação — Importar todos os dias do Excel**: grava todos os dias presentes no arquivo.
- **Modo de importação — Apenas o dia anterior**: grava somente as marcações de ontem.
- **Modo de importação — Filtrar por competência**: grava só os dias dentro da competência informada.
- **Ano / Mês base**: ano e mês da competência (só aparecem no modo "Filtrar por competência"); abaixo, a tela mostra o intervalo exato de 20 a 19.
- **Caixa azul "Como funciona a importação"**: lembrete de que os dias importados ficam salvos, que reimportar atualiza os dias em comum e que confirmações manuais não são sobrescritas.
- **Importar para o CORH**: inicia a importação. Fica desabilitado sem arquivo, enquanto importa ou se o arquivo tiver erro de leitura.
- **Pré-visualização (primeiras linhas)**: tabela com colaborador, matrícula, data, local de trabalho e dispositivo das primeiras linhas do arquivo. Se o arquivo estiver ilegível, aparece no lugar um aviso vermelho com o motivo.
- **Arquivos já enviados**: cartão com os Excels salvos no servidor (nome, data de envio, quem enviou e tamanho).
- **Usar este arquivo**: baixa o Excel salvo e o carrega para uma nova importação.
- **Lixeira (no cartão de arquivos)**: exclui o arquivo salvo. Só aparece para o Administrador.
- **Resumo da importação**: cartão com o resultado — dias importados, identificados automaticamente, não identificados, confirmações manuais preservadas e a lista de colaboradores não encontrados no cadastro.

## Locais

Aqui você cadastra os locais de trabalho (postos) que o sistema usa nas escalas. Cada local tem um nome completo e um **nome curto**, que é a forma abreviada exibida nas listas e relatórios. O botão "Importar de Departamentos" cria locais automaticamente a partir dos departamentos já cadastrados no sistema, pulando os que já existem com nome parecido.

[IMAGEM: escalas-locais.png]

### Como fazer

**Cadastrar um local**

1. No cartão **Novo Local de Trabalho**, preencha o **Nome** (por exemplo: "Matizes").
2. Se quiser, preencha o **Nome curto** (a forma curta que aparece nas telas). Se deixar em branco, o sistema usa o próprio nome.
3. Clique em **Adicionar**. O sistema mostra a mensagem verde "Local de trabalho criado" e o local aparece na lista abaixo.

**Importar locais dos departamentos**

1. Clique em **Importar de Departamentos**, no topo da tela.
2. O sistema cria como locais os departamentos ativos que têm nome curto e que ainda não existem como local (nomes parecidos são ignorados para não duplicar).
3. Ao final, uma mensagem informa quantos locais foram importados e quantos foram ignorados por já existirem.

**Editar um local**

1. Na lista **Locais cadastrados**, clique em **Editar** na linha do local.
2. A linha vira dois campos editáveis: nome e nome curto. Ajuste o que precisar.
3. Clique em **Salvar** para gravar (mensagem "Local de trabalho atualizado") ou **Cancelar** para desistir.

**Excluir um local**

1. Clique na lixeira vermelha na linha do local.
2. Na janela de confirmação, clique em **Sim, excluir**. O local é removido permanentemente e o sistema mostra a mensagem "Local de trabalho removido".

> ATENÇÃO: a exclusão é permanente e não pode ser desfeita. Se o local já foi usado em escalas, pense antes de excluir — prefira editar o nome quando for só uma correção.

### Campos e botões

- **Nome**: nome completo do local de trabalho. Obrigatório — sem ele o botão Adicionar fica desabilitado.
- **Nome curto**: forma abreviada exibida nas listas e relatórios. Se ficar vazio, o sistema repete o nome completo.
- **Adicionar**: grava o novo local.
- **Importar de Departamentos** (topo da tela): cria locais a partir dos departamentos ativos com nome curto, sem duplicar os que já existem.
- **Locais cadastrados**: lista com todos os locais ativos, mostrando nome completo e nome curto.
- **Editar**: transforma a linha em campos editáveis (nome e nome curto).
- **Salvar / Cancelar** (na linha em edição): grava ou descarta a alteração.
- **Lixeira**: exclui o local, após confirmação.

## Mapeamento

A aba Mapeamento é onde você **ensina o sistema**: quando o Excel do Flit trouxer determinado texto, o local de trabalho é tal. Cada mapeamento liga um **valor que aparece no Flit** a um **local cadastrado na aba Locais**. Quanto melhores os mapeamentos, menos dias caem como "Não identificado" na importação.

Existem três tipos de mapeamento, correspondentes às pistas que o sistema usa na inferência:

- **Dispositivo (Flit Multi)**: o nome do aparelho de ponto fixo onde a pessoa bateu (a pista mais forte);
- **Perímetro**: o nome da cerca virtual de geolocalização registrada na marcação;
- **Turno contém Departamento**: um texto que aparece no nome do horário (turno) ou no departamento da pessoa.

O sistema compara os textos sem ligar para maiúsculas/minúsculas e acentos, e basta o texto do Flit **conter** o valor cadastrado. Por exemplo: o mapeamento "CBO - MACAÉ" casa com o turno "08X17 CBO - MACAÉ".

> ATENÇÃO: não cadastre valores genéricos demais. Um mapeamento só com "CBO" casaria tanto com "CBO - NITERÓI" quanto com "CBO - MACAÉ" — e os dois postos brigariam pelo mesmo texto. Quanto mais específico o valor (mais longo, com o detalhe que distingue o posto), melhor. Traços e pontos ajudam a diferenciar: "CBO -" já separa Niterói de Macaé.

> DICA: turnos de função (como "Faltista ASG" ou "Inspetor Diurno") não indicam lugar — eles dizem o que a pessoa faz, não onde ela está. Os dias desses colaboradores ficam para confirmação manual mesmo, por desenho do sistema.

[IMAGEM: escalas-mapeamento.png]

### Como fazer

**Cadastrar um mapeamento**

1. No cartão **Novo mapeamento**, escolha o **Local de Trabalho** na lista.
2. Escolha o **Tipo**: Dispositivo (Flit Multi), Perímetro ou Turno contém Departamento.
3. Em **Valor no Flit**, escreva o texto exatamente como aparece no Excel do Flit (por exemplo: "MATIZES" ou "CBO - MACAÉ").
4. Clique em **Adicionar**. O sistema mostra a mensagem verde "Mapeamento criado" e a regra aparece na lista.

> DICA: se já existir um mapeamento com o mesmo tipo e o mesmo valor, o sistema avisa "Este mapeamento já existe (mesmo tipo e valor no Flit)" e não duplica.

**Procurar um mapeamento na lista**

1. Digite no campo de busca (a lupa) um trecho do nome do local ou do valor no Flit — a lista filtra na hora, sem precisar de botão.
2. Ou use a lista ao lado para mostrar só os mapeamentos de um local específico.
3. Quando houver filtro, a tela mostra "Exibindo X de Y mapeamento(s)" logo acima da lista.

**Editar um mapeamento**

1. Clique no lápis na linha do mapeamento.
2. A linha vira campos editáveis: local, tipo e valor no Flit. Ajuste o que precisar.
3. Clique em **Salvar** (mensagem "Mapeamento atualizado") ou **Cancelar** para desistir.

**Excluir um mapeamento**

1. Clique na lixeira vermelha na linha do mapeamento.
2. Na janela de confirmação, clique em **Sim, excluir**. O mapeamento é removido permanentemente e o sistema mostra a mensagem "Mapeamento removido". Dias já importados não mudam — a exclusão só afeta importações futuras.

### Campos e botões

- **Local de Trabalho**: local que será atribuído quando o texto aparecer no Flit. Obrigatório.
- **Tipo**: onde o sistema procura o texto — Dispositivo (Flit Multi), Perímetro ou Turno contém Departamento.
- **Valor no Flit**: texto que deve aparecer no Excel do Flit. Obrigatório — sem ele (ou sem local) o botão Adicionar fica desabilitado.
- **Adicionar**: grava o novo mapeamento.
- **Campo de busca (lupa)**: filtra a lista por trecho do nome do local ou do valor no Flit, na hora.
- **Lista "Todos os locais"**: filtra a lista para mostrar só os mapeamentos de um local.
- **Mapeamentos cadastrados**: lista mostrando o nome curto do local e a regra no formato "Tipo → valor".
- **Lápis**: edita o mapeamento na própria linha.
- **Salvar / Cancelar** (na linha em edição): grava ou descarta a alteração.
- **Lixeira**: exclui o mapeamento, após confirmação.

## Dúvidas frequentes

**Reimportei o Excel e perdi as confirmações que fiz na mão?**
Não. Dias confirmados manualmente são preservados em qualquer reimportação. O resumo da importação mostra quantas confirmações foram preservadas.

**Por que um dia ficou como "Não identificado"?**
Porque nenhuma das quatro pistas (dispositivo, perímetro, turno, departamento) casou com um mapeamento cadastrado. Confirme o dia na mão na aba Escalas e, se for um caso que se repete, crie o mapeamento correspondente na aba Mapeamento para as próximas importações saírem identificadas.

**O que é a "competência 20 a 19"?**
É o período usado pela folha: começa no dia 20 de um mês e termina no dia 19 do mês seguinte. Ao escolher ano e mês, a própria tela mostra o intervalo exato das datas.

**O Excel que outra pessoa importou sumiu para mim?**
Não. Todo Excel importado fica salvo no servidor. Abra a aba Importar sem escolher arquivo novo e use o cartão "Arquivos já enviados" — o botão "Usar este arquivo" reimporta sem precisar anexar de novo.

**Cadastrei o mapeamento "CBO" e os postos saíram trocados. Como corrijo?**
O valor "CBO" é genérico demais e casa com mais de um posto. Edite ou exclua esse mapeamento e cadastre valores específicos, como "CBO - NITERÓI" e "CBO - MACAÉ". Depois, corrija na mão os dias que já foram importados com o local errado.
