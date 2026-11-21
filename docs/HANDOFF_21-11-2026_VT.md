# Handoff VT — 21/11/2026

> Ponto de retomada. Continuação de `docs/HANDOFF_19-11-2026_VT.md`.
> **Nada foi publicado no site (Netlify).** Tudo está no GitHub (`main`).

## 1. O que foi feito

### Publicado no Supabase
- **Edge Function `vt-rota` v2** (com `arrivalTime`), com JWT exigido.

### No código (commits `fe6881f`, `32e5655`, `e40a781`, `37fb49c`)
- **Aba "Rotas a confirmar"** (`/vt/rotas`):
  - fila com os motivos da pendência, botão "Revisar" e botão "Próxima da fila";
  - **"Criar e revisar"** para quem não tem trajeto;
  - entram também os **postos exigidos pelo mês** (coberturas de férias e treinamentos em `vt_coberturas`, e o detalhe de `vt_cargas` do mês atual e do seguinte), com o filtro "Só o que a carga do mês precisa";
  - **"Endereço mudou"**: a rota volta para a fila mostrando antes × agora. Só vale para rotas revisadas a partir de 21/11, porque as anteriores não gravaram o endereço.
- **Folga de 10 min**: a ida é calculada para chegar 10 minutos antes da entrada do turno. A hora de chegada não aparece na tela (decisão da gestora).
- **Botões "Consultar na Riocard" e "Copiar CPF"** (abas Colaboradores e Trajetos): só aparecem para quem tem `colaborador.ver_cpf_completo`.
- **Tarifa DETRO por seção**: seletor "Trecho pago" na revisão. Sem a seção escolhida, a cotação fica pendente e o sistema nunca escolhe sozinho. A linha é classificada como intermunicipal pelo **código** (consta na tabela DETRO), nunca pela operadora informada pelo Google.
- **Ônibus municipal gratuito de Itaboraí e Maricá**: R$ 0, reconhecido por uma lista explícita de operadoras (`OPERADORAS_MUNICIPAIS_GRATUITAS` em `googleRoutes.ts`). **Os nomes da lista são palpite e precisam ser confirmados numa consulta real.** Linhas com ar-condicionado de Maricá ficam pendentes.
- **Migration 175 APLICADA** (backup em `dados-locais/backup_vt_175_2026-11-21/`): `vt_trajetos.bilhete_id` passou a aceitar nulo, com CHECK "trajeto confirmado exige bilhete".
- **Parecer de 4 especialistas**: `docs/PARECER_VT_REGRAS_2026-11-21.md`. Os agentes ficaram salvos em `.claude/agents/`: `vt-legislacao`, `vt-niteroi`, `vt-rio` e `vt-sao-goncalo`.
- `docs/VT_REGRAS_TARIFARIAS.md` atualizado com o parecer e as respostas da gestora.

### Dados (aplicados nesta sessão)
- **Situação do Bilhete Único atualizada** a partir do relatório da Riocard "Cadastro de Funcionários da Empresa" (Plena EA, emitido em 21/11/2026).
  - Campos gravados: `vt_bu_situacao`, `vt_bu_ativado`, `vt_bu_consultado_em = 2026-11-21` e `vt_riocard_numero_cartao`.
  - **227 optantes atualizados**, por CPF exato e cadastro **ativo** na Riocard. Nenhum acento corrompido.
  - Backup em `dados-locais/riocard_2026-11-21/backup_bu_antes_2026-11-21.json`. SQL aplicado: `atualizar_bu_2026-11-21.sql`. PDF original e linhas extraídas (`riocard_linhas.json`) na mesma pasta.
- **Resultado do cruzamento** (`cruzamento.json`):

  | Situação | Optantes |
  |---|---|
  | Ativado | 169 |
  | Suspenso Setrans | 44 |
  | Não possui BU no cartão | 11 |
  | Desativado | 2 |
  | Ativação solicitada | 1 |
  | Fora da conta Plena EA (são da Plena Tech) | 10 |
  | Só com cadastro inativo na Riocard (Renato de Oliveira Pereira) | 1 |

  - **8 mudaram desde 28/10.**
  - **Achado:** em 3 casos (Antonio Vidal, Rodrigo Silverio e Vagner Correa) o cartão de outubro é **diferente** do cartão VT ativo de hoje. Provável explicação: o BUI está ativo em outro cartão do mesmo CPF.
- **Planilha para inativar na Riocard**: `dados-locais/riocard_2026-11-21/inativar_na_riocard_plena_ea.xlsx`, com 47 pessoas:
  - 20 demitidas;
  - 3 afastadas;
  - 24 ativas e não optantes. Destas, 6 estão marcadas "CONFERIR ANTES" porque têm cobertura de férias ou trajeto no VT: Ronald, Ronaldo da Silva, José Robson, Francisco de Assis F. Pereira, José Ricardo e Ricardo Maia.

## 2. Decisões da gestora (21/11/2026)
- R$ 4,45 confirmado por pesquisa com colaboradores: 1 ônibus, ou 2 no mesmo sentido, paga R$ 4,45.
- Todos os colaboradores ganham abaixo do teto do BUI (R$ 3.205,20), e todos os cartões VT são "Personalizado Usuário".
- A tarifa cheia é exceção raríssima: todos são tratados como quem usa integração, com aviso para regularizar.
- A Plena **compra VT no Jaé** (ônibus municipal do Rio). O modelo de planilha do Jaé fica para depois.
- **O portal da Riocard NÃO mostra o saldo dos cartões**: a empresa não consegue abater o saldo que sobra na recarga seguinte.
- O CORH é a fonte correta de quem é optante.
- A importação mensal da situação do BU deve ser feita **por empresa**: há conta Riocard da Plena EA e outra da Plena Tech.

## 3. Pendências
1. **Jurídico**: base de Niterói R$ 4,45 × R$ 5,60 (Decreto 10.854/2021, tarifa integral; conferir se é o art. 124). O texto da consulta está no histórico da conversa e o resumo no parecer, §5. **Nenhuma carga real com R$ 8,90 até a resposta.**
2. **Relatório da Plena Tech** ("Cadastro de Funcionários da Empresa" da conta Plena Tech), para os 10 optantes que faltaram.
3. **Item B, importação mensal pela tela**: PDF "Cadastro de Funcionários da Empresa" das duas empresas, com prévia (quem ganhou, perdeu ou trocou de cartão; quem inativar; quem falta) e histórico por data (tabela nova, que exige migration e autorização). Aviso na Carga se a última importação tiver mais de 30 dias. A leitura do PDF já foi validada num script descartável: pdfjs, linhas ancoradas pela matrícula, 930 linhas. Ver a seção 4.
4. **Rio/Jaé**: modelo da planilha de pedido do Jaé; depois, tarifas do Rio no motor e carga separada Riocard × Jaé.
5. Nomes reais das operadoras de ônibus gratuito de Itaboraí/Maricá no Google.
6. 11 optantes com "Não possui BU": pedir a habilitação no portal. 44 "Suspenso Setrans": investigar, provavelmente BUI em outro cartão.
7. Publicar no site quando a gestora pedir, seguindo o checklist do AGENTS.md §10.

## 4. Como o PDF da Riocard foi lido (para o item B)
- O PDF é a impressão da tela `ImprimirPesquisaUsuarios.do`. Colunas: Matrícula, Nome, CPF, Status (Ativo/Inativo), Nr. do Cartão, Status BU Cartão, Compra de Passagem Inter. Rodoviária. O cabeçalho traz a empresa e o CNPJ.
- Leitura com pdfjs (`getTextContent`):
  - âncora = item na coluna da matrícula (x < 80, regex `^\d+[A-Z]?$`);
  - os itens da linha ficam a ±12 de y da âncora;
  - "Suspenso Setrans" e "Não possui BU" vêm quebrados em duas linhas e precisam ser juntados;
  - o texto "Solicitada Ativação" vem invertido: normalizar para "Ativação Solicitada".
- 35 linhas antigas não têm CPF (inativas), e há muitos CPFs duplicados com cadastro antigo inativo. **Sempre usar o cadastro ATIVO.**
- Casamento só por CPF com 11 dígitos (`padStart`); o CORH tem CPF sem o zero à esquerda.
