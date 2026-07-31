# Relatório da semana de testes — 24/07 a 31/07/2026

> **Para quem é este documento:** gestores e diretoria. Linguagem simples, sem termos técnicos.
> **O que ele conta:** tudo o que foi melhorado e corrigido no sistema CORH durante a semana de testes com usuários reais.

---

## Sexta-feira, 24/07 — dia de deixar a casa em ordem

- **Segurança e economia:** removemos arquivos pesados e com dados pessoais que estavam expostos na pasta pública do sistema — isso também reduziu o custo de hospedagem.
- **Aplicativo que não atualizava:** corrigido o problema do sistema "preso" numa versão antiga no navegador (era o bug do PDF que mostrava a empresa errada).
- **CEU (Crachá/Uniforme/EPI):** os recibos passaram a sair com a empresa real do colaborador, número sequencial único (REC-2026-00001, 00002...), situação do item (Novo, Troca, Extravio) e o CA do EPI do dia da entrega. Os botões de recibo na tela de Relatórios, que não funcionavam, foram consertados.
- **Extras:** criado o lançamento de "falta sem extra" (controle interno, não gera pagamento) e o marcador de **Reforço Contratual**.
- **Férias:** importação das últimas férias gozadas a partir do PDF do Flit.
- **Extras pelo celular:** o formulário mobile ficou igual ao do computador (campo "gera extra?", Faltista R$0).
- Atualizado o **guia do inspetor** com as novidades.

## Domingo, 27/07 — suporte e LGPD

- **Consentimento LGPD travado:** quem tentava aceitar o termo no primeiro login ficava preso na tela — corrigido.
- **Botão de suporte:** criada a "bóia" no topo da tela para pedir ajuda por e-mail, com anexos (foto/PDF) — o endereço de destino fica escondido no servidor.
- Menu LGPD no topo da tela e melhorias na ordenação da tela de Férias.

## Segunda-feira, 28/07 — o dia do "Importando..."

- **Importação de ponto travada:** a tela ficava eternamente em "Importando..." ao subir o espelho do Flit — achamos a causa e corrigimos; agora importa em lote e mostra o progresso.
- **Importação unificada:** um único upload do espelho de ponto alimenta Adicionais e Ocorrências ao mesmo tempo (antes eram dois processos separados).
- **CEU:** devolução item a item (antes era a entrega inteira de uma vez).
- **Extras:** regra de duplicidade ajustada — equipe extra no mesmo serviço agora é permitida quando não há ausente.
- **Busca de colaborador:** passou a encontrar também os inativos (necessário para ocorrências antigas).
- **Segurança:** apagadas 27 tabelas de backup antigas que estavam sem proteção no banco de dados (alerta crítico do painel de segurança).

## Terça-feira, 29/07 — faxina de dados e permissões

- **Matrículas duplicadas:** renumeração dos casos antigos e trava no banco para nunca mais acontecer.
- **Ocorrências órfãs:** as ocorrências que estavam num "colaborador genérico" foram reassociadas aos colaboradores certos pelo CPF.
- **Permissões:** o banco foi alinhado com a tela de Permissões — o financeiro passou a gerenciar recibos de extras e departamentos, e a mesa ganhou exclusão de extras (antes a tela permitia, mas o banco bloqueava escondido).
- **Vale Refeição:** os relatórios passaram a mostrar o nome correto do colaborador, resolvido pelo CPF do cadastro.
- **Departamento sumindo:** ao editar um extra, o departamento ficava em branco — corrigido.
- **Navegadores antigos:** leitura de PDF (ponto e recibos) voltou a funcionar em celulares e navegadores mais velhos.
- **dp1 no VR:** conseguia processar o ponto, mas o anexo do arquivo era bloqueado — corrigido.

## Quarta-feira, 30/07 — varredura geral de segurança

- **Assinatura de recibo travada:** financeiro/mesa não conseguiam assinar nem cancelar recibos de extras — eram dois problemas escondidos um atrás do outro; ambos corrigidos.
- **Data de demissão:** passou a constar oficialmente no cadastro e aparece na tela de Detalhes; ao preencher a demissão, o status muda para Inativo automaticamente.
- **Extras:** filtro por empresa na tela de Recibos (todos os extras estavam sem empresa preenchida — corrigido com preenchimento automático dos 67 históricos), botão **Exportar Excel** no Relatório Semanal e balanço operacional incluindo o período da Noite do dia anterior.
- **Permissões finais:** mesa/dp1/dp2 com os mesmos poderes do admin em vínculos; inspetoria pode gerar recibo de extras para o colaborador assinar.
- **Varredura com 10 auditores automáticos:** revisamos segurança, permissões, dados e regras de negócio. Nenhum problema crítico encontrado — e corrigimos o que apareceu:
  - 8 telas onde o sistema **dizia "salvo com sucesso" sem ter salvo** (quando a permissão do banco bloqueava). Agora avisam o erro de verdade.
  - 1 brecha onde qualquer usuário podia gastar números da sequência de recibos do CEU.
  - Recibos de extras: admin e financeiro podem excluir (decisão da gestão).
  - CEU: a matrícula do colaborador agora fica gravada em cada entrega (5.542 entregas antigas preenchidas retroativamente).
- **Testes automatizados:** 202 passando, zero falhas.

## Sexta-feira, 31/07 — tamanhos, agilidade no CEU e fim do retrabalho

- **Espelho de ponto guardado no servidor:** quem processa o PDF do Flit em Adicionais agora deixa o arquivo salvo no sistema. Qualquer colega (ex.: mesa) que abrir a tela depois vê o card "Arquivos já enviados" e clica em "Usar este arquivo" — acabou a necessidade de ficar passando PDF por WhatsApp/e-mail. Se o arquivo já foi enviado, o sistema pergunta antes: reutilizar ou reenviar.
- **Lançamento Rápido do CEU muito mais rápido:** ao entregar vários itens para a mesma pessoa, a linha nova já vem com data e nome preenchidos (em azul, para não confundir); dá para lançar tudo pelo teclado (Enter pula de campo em campo); o produto ganhou pesquisa com sugestões; e código errado fica vermelho na hora — antes a linha simplesmente sumia sem aviso.
- **Nada se perde mais:** linhas incompletas não são mais apagadas ao salvar, e o rascunho fica guardado no navegador — pode sair da tela e voltar que está tudo lá.
- **Tamanhos de uniforme/EPI agora são do CEU:** criamos a aba **Tamanhos** dentro do CEU, onde se cadastra camisa, calça, calçado e luva de cada colaborador — essas medidas saíram do cadastro geral (nem todo mundo precisa vê-las). A lista mostra todos os ativos, inclusive quem ainda está sem tamanho, para ir completando.
- **Preenchimento automático pelo histórico:** varremos todas as 5.542 entregas já registradas e preenchemos os tamanhos de **162 colaboradores**, valendo sempre a entrega mais recente (recebeu calça M em janeiro e G em fevereiro? Ficou a G).
- **Alerta de tamanho divergente:** no lançamento, se o item escolhido tem tamanho diferente do cadastro (cadastro diz 39, item é 40), o campo fica **vermelho em negrito** — é só um aviso, não trava o lançamento.
- **Substituição de férias com um clique:** antes era preciso lançar o substituto dia por dia. Agora, no calendário de Adicionais, o botão "Definir substituto" cobre todas as férias (ou faltas) do período de uma vez — e o novo filtro "⚠️ Precisa de substituto" mostra só quem ainda está descoberto.
- **Escalas com função:** a grade de Escalas ganhou a coluna Função com abreviações (ASG, Port., Enc. Jr...), ordenável de A a Z.
- **Recibos de R$ 0,00:** não aparecem mais na fila de recibos de extras (não faz sentido gerar recibo sem valor).
- **Testes automatizados:** 215 passando, zero falhas. Tudo publicado em produção no mesmo dia.

---

## Resumo em uma frase

Saímos de um sistema em testes com usuários, com pequenos travamentos e permissões desalinhadas, para um sistema **auditado, com dados consistentes e que avisa quando algo dá errado** — em vez de fingir que deu certo.

## Números da semana

- **50 entregas** de melhorias e correções (commits)
- **10 frentes** de auditoria de segurança executadas
- **215 testes automatizados** passando
- **162 colaboradores** com tamanhos de uniforme preenchidos automaticamente pelo histórico de entregas
- **0 problemas críticos** pendentes ao fim da semana

---

*Documento gerado em 30/07/2026 e atualizado em 31/07/2026.*
