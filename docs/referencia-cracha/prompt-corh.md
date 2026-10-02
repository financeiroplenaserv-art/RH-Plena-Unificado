# Prompt para colar no Claude Code (projeto CORH)

> Cole tudo abaixo da linha no Claude Code, dentro do VS Code, com o projeto CORH aberto.
> Antes de colar, copie os arquivos `cracha.html` e `cracha-teste-sem-cor.html` para a pasta `docs/referencia-cracha/` do projeto (crie a pasta se não existir).

---

Você vai trabalhar no CORH, meu sistema de DP e RH. Ainda não sei dizer qual é a tecnologia usada, então comece descobrindo isso sozinho. Fale comigo em português e sem jargão desnecessário.

## Objetivo

Quero que o usuário do CORH consiga **emitir crachás direto do sistema**, a partir dos funcionários que já estão cadastrados:

- selecionar um ou vários funcionários (por exemplo, com caixas de seleção numa lista);
- o crachá puxa **nome, cargo e foto** do cadastro, sem digitar de novo;
- antes de gerar, o usuário pode **editar o nome que aparece no crachá** (por exemplo, nome social ou nome abreviado). Essa edição vale só para o crachá e **não altera o cadastro** do funcionário;
- gerar a impressão (ou PDF) com vários crachás por folha, no formato descrito abaixo.

## Material de referência

Já copiei dois arquivos para `docs/referencia-cracha/`:

- `cracha.html`: gerador de crachás autônomo, com o visual final e a impressão exatos. É a referência oficial.
- `cracha-teste-sem-cor.html`: o mesmo layout, sem cor e sem foto, para testar a impressão gastando pouca tinta e conferir as medidas.

**Leia os dois arquivos inteiros antes de planejar.** Se houver diferença entre o que está escrito neste prompt e os arquivos, os arquivos valem, e me avise da diferença.

## Especificações essenciais (resumo, para não depender só dos arquivos)

**Cartão**
- Tamanho CR80: **54 mm x 85,6 mm** (em pé), cantos arredondados de **3 mm**.
- Fundo em degradê vertical de **#0aa0e2** (topo) até **branco em 62%** da altura; o resto da altura é branco.

**Posições (medidas a partir do canto superior esquerdo do cartão)**
- Logo: centralizado, começando a **8,6 mm** do topo. O logo padrão é um círculo azul com um "P" branco (13,6 mm) e os textos "plena" e "facilities" abaixo. O logo oficial deve ser **uma imagem configurável** (arquivo enviado nas configurações do sistema), com altura máxima de cerca de 26 mm e largura máxima de 30 mm. Se não houver imagem configurada, usar um desenho aproximado como o do arquivo.
- Foto: formato **3x4** (22 mm x 29,33 mm), centralizada, a **36,8 mm** do topo, com borda preta fina (0,25 mm) e `object-fit: cover` (recorta sem deformar). Sem foto no cadastro, mostrar a moldura vazia em cinza claro.
- Nome: a **67,8 mm** do topo, **Arial negrito**, MAIÚSCULAS, 3,3 mm, centralizado, com 2 mm de margem lateral.
- Cargo: a **75,4 mm** do topo, **Arial normal**, MAIÚSCULAS, 3,3 mm, centralizado.
- Nomes ou cargos longos podem quebrar em duas linhas, sem sair do cartão.

**Folha A4 (impressão)**
- **9 crachás por folha** (3 colunas x 3 linhas), A4 em pé, **margens de 10 mm**.
- **Vão de 8 mm** entre os crachás, definido num único valor fácil de mudar (no arquivo de referência é `--vao-corte`).
- **Marcas de corte** nos cantos de cada crachá, no vão, fora do cartão.
- Impressão em **escala 100%** (tamanho real), sem ajustar à página. Mostrar essa orientação ao usuário.
- Cores de fundo precisam sair na impressão (`print-color-adjust: exact`).
- Mais de 9 funcionários geram novas folhas, sem cortar um crachá no meio.

**Modo teste sem cor**
- Uma opção "modo teste sem cor" que gera a mesma folha, com as mesmas medidas, mas: fundo branco, contorno preto de 0,2 mm no cartão, logo só em contorno (ou retângulo tracejado "LOGO" se for imagem), foto não impressa (só a moldura 3x4 com um "3x4" pequeno), nome e cargo em cinza, marcas de corte mantidas e uma pequena régua de conferência na primeira folha. Serve para imprimir em rascunho e medir com régua antes de gastar tinta e papel bom.

## O que eu quero que você faça

1. **Explore primeiro, sem alterar nada.** Descubra e me conte, em poucas linhas:
   - qual é a tecnologia (linguagem, framework, banco de dados, como roda o projeto);
   - onde ficam o cadastro de funcionários, as fotos (arquivo no disco, banco, nuvem?) e os cargos;
   - como funcionam as permissões (quem pode ver dados de funcionários);
   - como são as telas (componentes, estilos, botões, tabelas), para o novo recurso parecer parte do sistema;
   - como os testes existentes são feitos e como rodá-los.
2. **Proponha um plano curto** (no máximo uma página): onde a nova tela entra no menu, quais arquivos serão criados ou alterados, como a foto será obtida, e qual caminho de geração você recomenda. **Pare e espere eu aprovar o plano antes de escrever código.**
3. **Escolha entre PDF ou página de impressão**, conforme a tecnologia do CORH, e justifique em duas ou três frases. Em geral, uma página de impressão com CSS (como nos arquivos de referência) é mais simples e fiel; PDF gerado no servidor pode ser melhor se o sistema já tiver essa estrutura. Em qualquer caso, as medidas em milímetros precisam sair exatas.
4. Depois da aprovação, implemente.

## Regras de implementação

- Siga os padrões, nomes, estrutura de pastas, componentes e estilo visual que já existem no CORH. Não introduza biblioteca nova sem necessidade; se precisar, me explique antes.
- Respeite as **permissões**: só quem já pode ver dados de funcionários pode emitir crachás. Valide no servidor (ou na camada de dados), não apenas escondendo o botão.
- **Não exponha fotos nem dados de funcionários fora do sistema**: nada de enviar a serviços externos, fontes ou imagens baixadas da internet, nem de links públicos para fotos. O logo e as fontes devem ser locais.
- A edição do nome do crachá não pode modificar o cadastro. Se fizer sentido guardar o nome de crachá escolhido, proponha isso no plano e deixe eu decidir.
- Trate casos de borda: funcionário sem foto, foto muito grande ou em pé/deitada, nome ou cargo muito longo, funcionário sem cargo, seleção vazia (avisar o usuário) e muitos funcionários de uma vez.
- Escreva **testes compatíveis com o projeto** (no mesmo estilo e ferramenta dos que já existem), cobrindo ao menos: permissão, dados do crachá (nome editado x cadastro) e número de crachás por folha. Rode os testes e me diga o resultado.
- **Não faça commit nem push** a menos que eu peça.
- Não altere os arquivos de `docs/referencia-cracha/`.

## Critérios de aceite

Vou considerar pronto quando todos estes itens forem verdadeiros (marque cada um no seu resumo final e diga como verificou):

- [ ] Existe um caminho claro no sistema para emitir crachás, acessível pelo menu ou pela lista de funcionários.
- [ ] Posso selecionar um funcionário ou vários e gerar os crachás de uma vez.
- [ ] Nome, cargo e foto vêm do cadastro automaticamente.
- [ ] Consigo editar o nome exibido no crachá antes de gerar, e o cadastro do funcionário continua intacto.
- [ ] O cartão mede 54 x 85,6 mm, com cantos de 3 mm, degradê de #0aa0e2 até branco em 62%, e as posições de logo, foto, nome e cargo iguais às do `cracha.html`.
- [ ] A foto sai em 3x4 com borda preta e sem deformar (recorte centralizado).
- [ ] Nome em Arial negrito maiúsculo; cargo em Arial normal maiúsculo.
- [ ] A folha A4 traz 9 crachás, com margens de 10 mm, vão de 8 mm e marcas de corte; a partir do 10º funcionário abre outra folha.
- [ ] O logo oficial é uma imagem configurável, e há um logo padrão quando nada foi configurado.
- [ ] Existe a opção "modo teste sem cor" com as mesmas medidas do modo normal.
- [ ] Impresso em 100%, as medidas conferem com régua (conferi com a folha do modo teste).
- [ ] Usuário sem permissão para ver dados de funcionários não consegue emitir crachás (nem digitando o endereço direto).
- [ ] Nenhuma foto nem dado de funcionário é enviado para fora do sistema; não há arquivo externo carregado da internet.
- [ ] A tela nova segue o visual e os componentes do CORH.
- [ ] Os testes novos passam e os testes que já existiam continuam passando.
- [ ] Nada foi commitado nem enviado (push) sem eu pedir.
- [ ] Você me entregou um resumo curto, em português, com os arquivos criados ou alterados, como usar o recurso e qualquer pendência.

Comece pela exploração (passo 1) e me mostre o que descobriu e o plano (passo 2). Não escreva código antes da minha aprovação.
