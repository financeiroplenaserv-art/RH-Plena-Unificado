# Handoff — 27/10/2026 — VT: endereços no link do Maps, revisão de CEP e layout da Riocard

Sessão que retomou o trabalho do Kimi (timeout no meio da revisão de endereços).
Antes de continuar, leia também `docs/HANDOFF_23-10-2026_VT_FASE2B.md` e `docs/PLANO_MODULO_VT.md`.

## Estado final

- Branch `vt-fase1`, **commitada e enviada ao GitHub**. **NÃO mesclada na `main` e NÃO publicada**: o deploy fica para depois, por decisão da gestora.
- Produção continua com o bundle de 23/10 (VT no ar, Férias oculto).
- Banco: migrations **163** e **164** já **aplicadas** em 24/10/2026, pelo agente anterior. Backups em `dados-locais/backup_permissoes_dp3_vt_163_2026-10-24/` e `dados-locais/backup_perfis_164_2026-10-24.json`. A verificação da 163 confirma dp3 com `menu.vt`, `rota.vt` e `vt.visualizar` = true e `vt.gerenciar` = false.
- Checks: `npx vitest run src` = 99 arquivos e 1.342 testes passando; `tsc -p tsconfig.app.json` limpo; `eslint` nos arquivos do VT limpo.

## O que entrou neste commit

### 1. Feito pelo agente anterior em 24/10 (estava sem commit)
- **163**: dp3 (estagiária) vê o VT em modo somente leitura. `PERMISSOES_PADRAO` espelhado e rótulo "DP3 (crachás e VT)".
- **164**: bloqueio de acesso por pessoa (`perfis.acesso_bloqueado`). O `useAuth` desloga quem está bloqueado. A tela Permissões ganhou a seção "Usuários" (`src/components/permissoes/UsuariosAcessoCard.tsx`, rótulos em `src/lib/perfis.ts`).
- **Cartão ≠ valor** (decisão de 24/10): selo "cartão: BUI/BUN/Comum" na aba Trajetos e aviso âmbar `avisoBilheteIncompativel`. A correção de dados (35 trajetos BUI → BU Niterói) já está no banco.
- Os detalhes de cada item estão no AGENTS.md (§8 migrations 163/164, §11 "VT — o cartão que a pessoa TEM ≠ o valor que ela RECEBE").

### 2. Link do Google Maps com UF e CEP (esta sessão)
- **Problema relatado pela gestora:** endereços marcados "exato" que o Google não encontrava (prints: Rua Sete/Spar Inoã-Maricá, Rua Diogo Pereira/Porto do Rosa-SG, Travessa Leia/Niterói, Rua Vitória Antiga/Maré-RJ).
- **Causa:** o link mandava só "rua, número, bairro, cidade". Os 207 trajetos "exato" têm CEP válido no cadastro, mas o CEP não ia no link, e `colaboradores.estado` está vazio em todos. Sem UF e CEP o Google confunde nomes comuns e não conhece loteamentos.
- **Correção** (`src/lib/vt/enderecos.ts`):
  - `textoOrigemCasa(endereco, cidade, cep?)` agora termina com "cidade - UF, 00000-000".
  - A UF vem da **faixa do CEP** (`ufDoCep`; 20000–28999 = RJ, tabela fixa dos Correios), então não é inferência.
  - Novo `textoDestinoPosto` faz o mesmo para o posto (substitui o `destinoPosto` local da aba). `cepFormatado` descarta CEP inválido.
  - `useVt` passou a ler `cep` de colaboradores e departamentos.
  - Testes em `enderecos.test.ts`.
- **"exato" não quer dizer "verificado":** `precisao_origem = 'exato'` só significa "tem rua e número". Nada mudou nessa regra.
- **Por que o teste do Kimi não vale:** ele usou o Nominatim (OpenStreetMap), que não achou 201 de 207 endereços, inclusive ruas óbvias. Não serve como prova para o Brasil. O que vale é o cruzamento com o ViaCEP, descrito abaixo.

### 3. Revisão dos 207 endereços "exato" pelo CEP (só leitura, nada gravado)
- Cada CEP foi consultado no ViaCEP e comparado com a rua do cadastro.
- **179 batem.** **28 a revisar**, na planilha `dados-locais/revisao_enderecos_vt_2026-10-24/revisao_enderecos_vt.xlsx` (aba "A revisar"):

  | Situação | Qtde |
  |---|---|
  | CEP de outra rua | 12 |
  | CEP que não existe | 5 |
  | CEP genérico (da cidade ou da rua principal) | 4 |
  | Cidade errada no cadastro | 4 |
  | Só a grafia é diferente (nada a fazer) | 3 |

- **Possível valor errado, para a gestora decidir (nenhum trajeto foi alterado):**
  - Marcio Isalen: cadastro diz SG, a rua e o CEP são do Barreto/Niterói. Está com BUI (R$ 18,80); se mora em Niterói, seria BU Niterói (R$ 11,20).
  - José Orlando e Thiago Lontra: cadastro diz Niterói, a rua e o CEP são de São Gonçalo (Tribobó e Jardim Catarina). Estão com BU Niterói; se moram em SG, pode faltar valor.
  - José Camilo: só a cidade do cadastro está errada (o bilhete já combina com Niterói).
- **Os endereços vêm da Alterdata**: corrigir lá. Uma correção feita no CORH seria desfeita pelo sync diário do e-Contador.
- Arquivos de apoio (dados pessoais, só local, `dados-locais/` é gitignored): `exatos.json`, `resultado_viacep.json`, `comparacao_cep.json`, `bilhetes.json`, `resultado_nominatim.json` (descartável).

## Riocard — layout do arquivo de PEDIDO (Fase 4, ainda não implementada)

A gestora trouxe dois documentos:
- `docs/PEF-V14-Ver1.6.0_-_Layouts_dos_arquivos_de_importacao_de_usuarios_e_pedidos.pdf`: layout oficial, versionado neste commit.
- `dados-locais/Cadastro de todos os colabs que tem VT.pdf`: exportação do portal Riocard em 26/10/2026, com matrícula, nome, CPF, status, nº do cartão e status BU. Tem CPFs, por isso **não** é versionado.
- (O `docs/passo a passo de como fazemos hoje.docx` é do módulo **Materiais**, não da Riocard.)

### Arquivo de pedido (seção 2 do PEF, versão 01.00), texto de largura fixa
- **Nome do arquivo:** `PEDIDO_0100_<CNPJ 14 dígitos>_<aaaammdd>_<hhmm>.txt`. A Plena EA usa o CNPJ 00.378.476/0001-60, que é o do cabeçalho da exportação. A Plena Tech tem CNPJ próprio: confirmar com a gestora se ela compra separado.
- **Regras gerais:** campo numérico alinhado à direita com zeros; campo alfa alinhado à esquerda com espaços; valores em centavos sem vírgula; campo opcional vira espaços.
- **Registros** (`Nr_seq_reg` tem 5 dígitos, começa em 1 e sobe a cada linha do arquivo):

  | Tipo | Conteúdo | Tamanho |
  |---|---|---|
  | `01` Header | seq(5) + `01` + `PEDIDO` + `01.00` + CNPJ(14) | 32 |
  | `02` Item | seq(5) + `02` + matrícula **Alfa 15** + Vl_carga Num 8 (centavos) | 30 |
  | `03` Entrega (opcional) | seq(5) + `03` + Dt_liber_carga ddmmaaaa(8) + Tp_entrega `D`/`A`(1) + agência(4) | — |
  | `99` Trailer | seq(5) + `99` + Vl_pedido Num 10 (soma das cargas, centavos) | 17 |

  O registro `03` só é necessário se o pedido NÃO for finalizado no site.
- **Exemplo do manual:**
  ```
  0000101PEDIDO01.0022333444000155
  000020255666          00007500
  ...
  00008990000043000
  ```
- **A matrícula do pedido é a matrícula cadastrada NA RIOCARD**, que não é necessariamente a da Alterdata.

### Cruzamento do cadastro Riocard × CORH (por CPF, só leitura, 27/10/2026)
- 885 linhas na Riocard: **268 ativos**, 266 deles com cartão.
- Todos os 268 ativos existem no CORH.
- **262 com a mesma matrícula** (comparando sem zeros à esquerda) e **6 com matrícula diferente**. Exemplos: Riocard `0878` × CORH `001111`; `01027Q` × `001027`; `94232` × `001038`.
- **O formato da matrícula na Riocard varia** ("0772", "01022", "94410"). Como o campo é Alfa 15, a matrícula precisa ir **exatamente como está na Riocard**. Gerar a partir da matrícula da Alterdata quebraria esses casos.
- 22 ativos na Riocard estão **inativos no CORH** (cancelar na Riocard, motivo 01 Demissão da Tabela 05).
- 34 ativos na Riocard **não são optantes no CORH**: conferir quem está certo.
- 233 optantes ativos no CORH; **2 sem cadastro na Riocard** (precisam do arquivo CADUSU antes do primeiro pedido).

### Proposta para implementar (a confirmar com a gestora)
1. Migration: `colaboradores.vt_matricula_riocard` (text) e `vt_cartao_riocard` (text), ou uma tabela `vt_usuarios_riocard`.
2. Importar a exportação do portal (PDF ou, de preferência, a versão Excel/CSV, se o portal oferecer), casando **por CPF exato**. Nunca casar por nome (regra "importação nunca grava palpite").
3. A aba Carga ganha o botão "Arquivo Riocard (.txt)": um registro `02` por optante com `valor > 0` na carga gravada da competência, e o trailer com a soma, que deve ser igual ao total da carga. Lógica pura em `src/lib/vt/arquivoRiocard.ts`, testada com o exemplo do manual. O montador do TXT da Alterdata (`txtInsalubridade.ts`) é o precedente de largura fixa.
4. Bloquear a geração (com lista) quando algum optante com carga não tiver matrícula Riocard.
5. Depois, avaliar o arquivo CADUSU (seção 1 do PEF; versão 04.02 é a mais recente) para cadastrar admitidos e cancelar demitidos.

## Pendências que seguem
- **Deploy**: mesclar `vt-fase1` na `main` e publicar seguindo o checklist do AGENTS.md §10 (main limpa, `MODULO_FERIAS_LIBERADO = false`, conferir o hash do bundle). Não há migration pendente para este deploy.
- Gestora: decidir os 3 casos de possível valor errado e repassar ao DP as 25 correções de endereço/CEP para a Alterdata.
- Riocard: confirmar a proposta acima e se há compra separada pela Plena Tech.
- Pendências do handoff de 23/10 continuam valendo: carga de novembro, fechamento de outubro, espelhos sem metadados, `npm run lint` quebrando por `.claude/worktrees/`.
