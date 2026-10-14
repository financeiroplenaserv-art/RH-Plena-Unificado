# HANDOFF — 14/10/2026 — Materiais (carga, tela do líder) + incidente do histórico do CEU

> Branch `materiais-fase1` (NÃO mergeada em `main`; site oficial NÃO publicado — `plena-corh` segue no
> bundle anterior). Pré-visualização grátis do Netlify: https://materiais-teste--plena-corh.netlify.app
> (mesmo banco de produção). **Trabalho do módulo Materiais PAUSADO** a pedido da gestora até a
> conclusão do incidente do CEU (seção 3).

## 1. Materiais — o que foi feito hoje

| Commit | Conteúdo |
|---|---|
| `99ba7f1` | Carga inicial (`scripts/materiais/carregar-materiais.ts`, dry-run / `--ensaio` / `--aplicar`) a partir de `dados-locais/materiais_conferencia_2026-10-09.xlsx` revisada pela gestão; migration **127** (categorias limpeza/portaria/descartaveis/acessorios/piscina) |
| `ca1b769` | Botão "Substituir em todos os kits" (migration **128**, RPC `mat_substituir_item_kits`, cadeia `substituido_por_id` na média) |
| `3904156`, `d1befe3` | Nova tela do líder + kit de uniforme/EPI por contrato (migration **129**) |

**Produção (aplicado com autorização, backups em `dados-locais/backup_materiais_*_2026-10-14/`):**
migrations 127, 128 e 129; carga do cadastro (17 fornecedores, 116 itens, 37 variações, 151 preços,
250 nomes antigos, 64 contratos de pedido, 334 linhas de kit, 9.108 de histórico 01/2025–06/2026);
carga do kit de uniforme (`mat_contrato_ceu_itens`: 785 peças em 63 contratos); Edge Function
`pedido-materiais` **v2** publicada.

**Decisões da gestora (14/10):** MB LOFT, Punta Del Mar e MODELO SUSO fora da carga; 4 fornecedores
antigos (só CNPJ, uniformes) preservados; Cera Novas Cores = 2 bombonas 5 L; baldes Mopinho × Grande
são itens diferentes; variações de mop/flanela/cera do kit derivadas do histórico (Mérito Barreto e
Vila de Cascais = Max Teck, marca do pedido mais recente); rotas ficam para a tela; itens de portaria
cadastrados depois na tela; contratos sem kit ficam assim; Telex mostra a equipe do departamento
inteiro nos 4 contratos e inclui o departamento DUOCONNECT (contrato é com a DuoConnect, trabalham nas
lojas Telex) via `mat_contratos.departamentos_equipe_extra`; EPIs de limpeza só para
ASG/encarregado/manutenção/jardinagem; dp2 (Beth) acessa Kit Mensal (uniformes editáveis, produtos
só leitura); busca "Preciso de outro item" é fuzzy local (Jev fica como extensão futura).

**Teste em andamento:** 5 contratos (Abaeté, Itaguaí, Enseada Park, Telex Bar/Tij/Ipa, Exclusive),
links gerados pela pré-visualização e preenchidos por alguém do escritório no celular, em paralelo
aos Google Forms de outubro. Gestora quer mais testes antes de publicar.

**Pendências do módulo:** comparar pedidos do teste × Forms; a carga do kit de uniforme usou o
histórico do CEU contaminado (luva já tratada; **camisa bege → azul ASG ainda não**) — refazer depois
da correção do CEU; pedidos de teste a apagar/marcar; contrato TECH tem 3 peças do form sem item no
CEU; merge + deploy oficial só com autorização.

## 2. Arquivo não versionado de propósito

`scripts/lancar-epis-mensal.mjs` estava modificado ANTES desta sessão — não foi tocado nem commitado.

## 3. INCIDENTE — itens errados no histórico de entregas do CEU (em investigação)

Resumo (detalhes e provas em `dados-locais/investigacao_luva_2026-10-14/`,
`investigacao_recibos_2026-10-14/`, `investigacao_prevencao_2026-10-14/`):

- A importação do histórico em 13/07/2026 (`scripts/importar-movimentacoes-ceu.mjs`, função
  `encontrarItem`) ligou itens errados sem aviso: ~1.918 entregas (1.129 luvas látex G/M/P → "LUVA DE
  CORTE"; 663 camisa azul ASG 312 → 331; 115 camisa bege encarregado 314 → 331; casos pequenos).
  Causa reproduzida (98/98): `corrigirEncoding` corrompe os nomes do cadastro, tamanhos de 1 letra
  descartados, palpite por "mais palavras em comum" sem mínimo e sem empate.
- Recibos em papel de 01/07/2026 (sistema ANTIGO, numeração "REC-00xxx" sem ano) dizem luva látex —
  o papel está certo, o CORH está errado. Em 04/08 o CORH deu números REC-2026 a essas entregas antigas
  (sem documento assinado correspondente, exceto ~7 recibos gerados na tela com "LUVA DE CORTE").
- Achados de numeração: 7 números REC-2026 em entregas de datas diferentes; 41 misturam EPI e uniforme
  (emissão em lote e Relatórios → "Gerar recibo" herdam número via `numeroDoGrupo`).
- **Pode repetir hoje:** scripts perigosos ainda executáveis (alguns apagam todas as entregas); CEU →
  Importar e o lançamento mensal ainda inferem item e marcam "OK"; banco sem trava para entrega com
  recibo; recibo reimpresso usa nome/situação do cadastro atual.

**Estado:** NADA foi corrigido nos dados (a tentativa de UPDATE das luvas foi bloqueada pelo
classificador de permissões e, depois, a gestora pediu para parar e investigar). A gestora vai rodar
uma **revisão independente** com outro agente usando
`dados-locais/investigacao_revisao_independente_2026-10-14/PROMPT_REVISAO_INDEPENDENTE.md` e trazer o
retorno.

**Perguntas abertas para a gestora:** 312 "polo azul – ASG" e 331 "polo azul clara – ASG" são a mesma
peça? O que fazer com os números REC-2026 dados em 04/08 a entregas cujo recibo válido é o papel do
sistema antigo? Autoriza o passo 1 (aposentar scripts perigosos + regra no AGENTS.md, sem tocar dados)?

**Plano proposto (não executado):** (1) aposentar scripts + regra; (2) importação só aceita casamento
exato, palpite = revisão obrigatória, na tela e no lançamento mensal, antes de 01/11; (3) recibo de uma
data e um tipo, sem herdar número; (4) testes; (5) recibo pelo snapshot; (6) trava no banco + RPC de
correção auditada; (7) correção dos dados pelo código do sistema antigo, com backup e dry-run.
