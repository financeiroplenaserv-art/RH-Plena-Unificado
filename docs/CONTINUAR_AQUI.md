# CONTINUAR AQUI — RH Plena Unificado

> **Último trabalho:** 28/07/2026 — Importação de ponto UNIFICADA (Adicionais + Ocorrências) + CEU devolução por item + Extras duplicidade (TUDO EM PRODUÇÃO — commit `ebf102c`, deploy Netlify feito no fim do dia; lembrar usuários de Ctrl+Shift+R por causa do PWA)
> **Relatório do dia:** `docs/HANDOFF_28-07-2026.md`
>
> ## ✅ 28/07/2026 — Pacote em produção (2º deploy do dia)
> - **Importação de ponto UNIFICADA (Adicionais + Ocorrências)**: um único upload do espelho Flit **com CPF** alimenta os dois módulos. **O relatório no Flit se chama "CORH - Adicionais e Ocorrências"** (a tela instrui esse nome). A tela única ficou em **Adicionais → Importar Ponto** (`/adicionais/importar-ponto`): grava os dias em `calendario_adicionais` e, com o checkbox "Lançar ocorrências..." (agora funcional, **ligado por padrão**), cria as ocorrências com as regras já validadas (fusão de atestados, tipo por duração, deduplicação). A aba "Importar Ponto" das Ocorrências virou atalho para essa tela; a página `/rh/ocorrencias/importar-ponto` foi removida. Motor: parser posicional único (`src/lib/ocorrencias/importacaoPonto.ts` + novo `src/lib/pdfPosicional.ts` + mapeamento `src/lib/adicionais/importarEspelho.ts`, 14 testes novos). Matching por CPF para os dois lados. Defaults documentados: Suspensão→falta, Falta BH→folga, Feriado→folga (ajustáveis se a usuária decidir diferente).
>   - **Prévia de ocorrências com checkbox por linha**: card "Ocorrências que serão lançadas (N)" lista cada ocorrência antes de confirmar; duplicadas travadas/esmaecidas; botão Marcar/Desmarcar todas; só as marcadas são inseridas. Edição manual de status de um dia na prévia recalcula as ocorrências em tempo real.
>   - **Importação NÃO cria mais vínculos automaticamente** (decisão da usuária — adicionais são exceção: ex. só 2 colaboradores recebem insalubridade Abaeté). Dias vão para `calendario_adicionais` **somente de quem já tem vínculo** cobrindo a data; colaborador com 2 vínculos grava nos 2; sem vínculo → pulado (badge "Sem vínculo (só ocorrências)" + toast) com ocorrências criadas normalmente. **Fluxo: criar vínculos na aba Vínculos primeiro, depois importar.**
>   - **Bugs corrigidos:** (1) a página nunca chamava `listarContratos()` — caía no erro "Nenhum contrato cadastrado"; (2) a exclusão de dias do período usava o estado `calendario` nunca carregado — agora usa o retorno de `listarCalendario(periodo)`.
>   - O parser texto-livre antigo (`src/lib/adicionais/importarPonto.ts`) foi **mantido** só porque scripts em `scripts/` o usam — não é mais usado pelo app.
> - **CEU — devolução por item** (`src/pages/ceu/CeuMovimentacoesPage.tsx`): o botão ↩️ nas Movimentações abre dialog com os itens em aberto do grupo (checkbox) — dá para devolver 1 item específico (antes devolvia sempre o primeiro). Devolução continua por linha inteira do item (sem devolução parcial de unidades — decisão da usuária; paliativo = lançar a entrega já separada em linhas de 1 unidade).
> - **Extras — duplicidade permitida com "não se aplica"** (`src/pages/extras/ExtrasFormPage.tsx`): lançamento com "Gera extra = Sim" + ausente "Não se aplica" **não checa mais duplicidade** de cliente/data — permite equipe extra (3-4 colabs) no mesmo serviço sem substituir ninguém. Com ausente informado, ou "Não — falta (controle interno)", a checagem continua igual.
> - **✅ Migration 077 APLICADA no SQL Editor em 28/07/2026** (`supabase/migrations/077_rpc_extra_plantao_duplicidade_nao_se_aplica.sql`): mesma regra de duplicidade na RPC `registrar_extra_plantao` (mobile `/mobile/falta`).
>
> ## ✅ 28/07/2026 — Já em produção (commit `5b17764`, deploy feito)
> - **Importação de espelho de ponto (PDF do Flit) para ocorrências** — nova aba "Importar Ponto" no módulo Ocorrências (`/rh/ocorrencias/importar-ponto`): upload do PDF → prévia com cards e checkboxes → importação em lotes. Lógica pura em `src/lib/ocorrencias/importacaoPonto.ts` (24 testes).
>   - Regras validadas com a usuária: importa **somente** `Falta` (→ Falta Injustificada) e `Atestado` (→ por duração: ≤8 dias = Falta Justificada (atestado); 9–15 = Licença Médica até 15 dias; >15 = INSS). `Falta BH`, `Afastado`, `Suspensão`, `Férias`, `Feriado` NÃO viram ocorrência.
>   - Faltas agrupam só dias estritamente consecutivos. Atestados **fundem pulando folgas/feriados** (atestado dias 3 e 5 com folga no 4 = 1 ocorrência "Atestado de 3 dias"); título = "Atestado de N dias" / "Licença médica de N dias".
>   - Matching por **CPF** (validação cruzada de nome); duplicadas (mesmo colaborador + data início + tipo) vêm desmarcadas; status segue `exigeDocumento` (atestado/licença entram como Pendente).
>   - Aba "Importar" antiga do módulo Ocorrências foi **removida** (rota `/rh/importar` ainda existe, sem entrada na navegação).
>   - Scripts de apoio: `scripts/extrair-ponto-unificado.cjs` (gera planilha de revisão em `dados-locais/`) e `scripts/validar-importacao-ponto.ts` (dry-run do plano contra o PDF real).
> - **LGPD:** o `unificado.pdf` (329 espelhos, com CPFs) foi movido de `public/` para `dados-locais/` (gitignored) — nunca deixar PDFs com dados pessoais em `public/` (vai para o deploy público).
> - **Chave do Resend rotacionada** em 28/07 (nova chave no painel Resend + `supabase secrets set RESEND_API_KEY=...`); pendência do handoff 27/07 encerrada. Fluxo LGPD com usuário teste validado pela usuária.
> - Teste de importação real: 1 ocorrência (falta do Adriano) importada pela usuária como teste — as demais 61 ficam para quando ela decidir; a tela marcará as já importadas como duplicadas.
>
> ~~**AGENTS.md raiz está desatualizado**~~ — ✅ atualizado em 28/07/2026 (77 migrations, Edge Function `suporte`, módulo Férias, importação unificada, contagem de testes).
>
> **Relatório anterior:** 27/07/2026 — Netlify resolvido + LGPD/header/botões Limpar + ordenação Férias + suporte por e-mail (TUDO EM PRODUÇÃO)
> **Relatório do dia:** `docs/HANDOFF_27-07-2026.md`
> **🐛 27/07/2026 — usuários travados na tela de consentimento LGPD:** a RPC `registrar_consentimento_lgpd` (migration 068) recebia `p_finalidades` como `jsonb` e atribuía direto na coluna `TEXT[]` (migration 036) — erro de tipo no UPDATE, usuário preso na tela. Bug oculto desde 068 porque todos os consentimentos anteriores foram gravados antes dela existir. **Correção: migration 076** (`supabase/migrations/076_fix_consentimento_lgpd_rpc.sql`) — ✅ **aplicada no SQL Editor em 27/07/2026.** Validar logando com um usuário teste.
> **✅ 27/07/2026 — Edge Function `suporte` no ar e VALIDADA:** secret `RESEND_API_KEY` configurado, deploy feito via CLI e **e-mail de teste recebido** (cai no spam na 1ª vez — marcar "Não é spam"). O botão de ajuda (bóia no header) envia e-mail de verdade para financeiroplenaserv@gmail.com. ⚠️ A chave do Resend foi colada no chat — rotacionar quando possível (nova chave no painel Resend + `supabase secrets set RESEND_API_KEY=<nova> --project-ref jmdjdogskvybsdjtmpmb`).
> **✅ 27/07/2026 (tarde) — LGPD, suporte, botões Limpar e ordenação em Férias (deploy em produção):**
> - **LGPD não aparecia para usuários teste:** eles foram criados em 26/06 já com `consentimento_lgpd=true`. Resetado para `false` (script `scripts/resetar-consentimento-lgpd-testes.mjs`) — no próximo login cada um vê a tela de consentimento.
> - **Header novo:** dropdown no chip do usuário (nome, e-mail, "Termo de privacidade (LGPD)" — `TermoLGPDDialog`) e botão de **ajuda/suporte** (ícone de bóia ao lado do sininho — `SuporteDialog`). Suporte envia e-mail via **Edge Function `suporte`** (Resend; endereço oculto no backend). ⚠️ **Pendente:** criar conta no Resend, configurar secret `RESEND_API_KEY` e rodar `supabase functions deploy suporte` — passo a passo em `docs/CONFIGURAR_FUNCAO_SUPORTE.md`. Sem isso o dialog abre mas avisa "Serviço de e-mail não configurado".
> - **Botões Limpar** ao lado de Aplicar/Filtrar agora são iguais ao Aplicar (degradê azul, texto branco): `Filters.tsx` (9 telas) + CEU (Movimentações, Relatórios, Itens). Não mexidos: "Limpar filtros" dos chips (Adicionais calendário, CEU entrega), "Limpar assinatura" e "Limpar histórico" (ações diferentes).
> - **Férias: ordenação clicável** nas colunas Último gozo, Previsão RH, Próximo agendado e Limite concessivo (setinha no cabeçalho; clique alterna crescente/decrescente; sem data sempre por último; exportação Excel segue a ordenação da tela).
> - **Deploy feito em 27/07 ~20h** (`npm run deploy:netlify`, 15 créditos) — inclui também os headers de cache do `netlify.toml`. Orientar usuários: Ctrl+Shift+R se algo parecer velho (PWA).
> **✅ RESOLVIDO em 27/07/2026 — créditos Netlify:** o vilão **não era banda** (0,1 crédito no período; 274 requests no total). O que zerou os 300 créditos do plano Free em 23–24/07 foram **~18 deploys de produção × 15 créditos ≈ 270** — incluindo **7 deploys manuais via CLI em 24/07 (~105 créditos)**: o `npm run deploy:netlify` **consome 15 créditos por deploy sim** (a informação de que era grátis, registrada no handoff de 24/07, estava errada; o painel mostra "Production deploys — 1 deploy — 15 credits" referente ao deploy manual das 16:30). Grátis de verdade só deploy **preview** (sem `--prod`). Conta hoje no plano Personal ($9 = 1.000 créditos/mês; 984,9 livres em 27/07). Legados pausados (24/07), builds automáticos desligados, auto-recharge desligado. **Regra de ouro: 1–2 deploys por dia de trabalho, agrupando mudanças** (cada deploy de produção = 15 créditos). Headers de cache preparados no `netlify.toml` (27/07) — vão junto no próximo deploy, não gastar 15 créditos só para isso.
> **Relatório completo do dia:** `docs/HANDOFF_24-07-2026.md`
> **✅ RESOLVIDO em 24/07/2026:** PDF saindo "Plena EA" era o **service worker do PWA segurando JS antigo** no navegador. Solução: `skipWaiting()` em `src/sw.ts` (próximas atualizações ativam sozinhas) + marcador de build no rodapé do PDF para diagnóstico. No mesmo pacote: CPF do colaborador passou a sair no PDF (`COLUNAS_AUTOCOMPLETE` não trazia a coluna `cpf`). Validado pela usuária em produção (Plena EA e Plena Tech). Detalhes: `docs/HANDOFF_23-07-2026_PDF_EMPRESA.md`.
> **Relatório completo:** `docs/HANDOFF_23-07-2026_NOITE.md` (anterior: `docs/HANDOFF_23-07-2026.md` — módulo Férias)  
> **Checklist:** `docs/CHECKLIST_IMPLANTACAO.md`  
> **Perfis/Permissões:** `docs/PERFIL_ACOES_MODELO.md`  
> **Regras de negócio:** `docs/REGRAS_NEGOCIO.md`  

---

## ✅ Estado atual

### Extras — falta sem extra (controle interno) + Reforço Contratual (24/07/2026)
- **Migration 074** (`074_extras_falta_sem_extra_reforco.sql`): `extras.gera_extra` (default true) e `extras.reforco_contratual` (default false). ✅ **Aplicada no SQL Editor em 24/07/2026.**
- Formulário de extra pergunta **"Gera extra para pagamento?"** no topo: "Não — falta (controle interno)" trava categoria **Faltista** (única que aceita R$ 0,00 — cadastrada no banco em 24/07) e zera o valor.
- Faltas de controle interno **aparecem no relatório diário de WhatsApp** (Balanço Operacional), mas ficam **fora do balanço/recibos de pagamento** (filtro `gera_extra !== false` em `ExtrasRecibosPage`).
- Checkbox **Reforço Contratual** ao lado de "Extra faturado" — independente de `gera_extra` (faltista pode fazer reforço contratual sem receber extra). No WhatsApp sai como `🪙 *REFORÇO CONTRATUAL*` (💰 continua sendo do faturado).
- **Mobile (`/mobile/falta`) com paridade completa** (24/07/2026): pergunta "Gera extra para pagamento?" no passo Valor, Reforço Contratual Sim/Não e revisão exibindo o tipo de registro. **Migration 075** recria a RPC `registrar_extra_plantao` gravando `gera_extra`/`reforco_contratual` (a RPC tinha lista fixa de colunas e ignoraria os campos novos). ✅ **Aplicada no SQL Editor em 24/07/2026.**
- Plantão web (`ExtrasPlantaoPage`) segue com `gera_extra=true` fixo (fluxo inalterado).

### Recibos CEU — empresa, CA, situação e número sequencial (24/07/2026)
- **Migration 073** (`073_ceu_recibo_sequencial_situacao.sql`): colunas `entregas.numero_recibo` e `entregas.situacao` + sequência `ceu_recibo_seq` e função `proximo_numero_recibo()` (`REC-AAAA-NNNNN`). ✅ **Aplicada no SQL Editor em 24/07/2026.**
- **Empresa real do colaborador no recibo** (antes: Plena EA fixa no código) — helper `src/lib/empresas.ts` com fallback Plena EA, mesma regra do PDF de ocorrências.
- **CA sempre no recibo**, vindo do `snapshot_item` da entrega: trocar o CA no cadastro do item (novo lote) **não altera recibos já emitidos**.
- **Situação por item** (Novo, Substituição, Troca, Extravio/Perda) — seletor no wizard de entrega, gravada na entrega e exibida colorida no recibo.
- **Número sequencial e único** gravado na entrega na 1ª emissão; **reemissão reutiliza o mesmo número** (wizard, individual e lote).
- **Brecha fechada:** o wizard "Nova entrega" agora marca `recibo_emitido` ao emitir (a regra "não excluir após recibo emitido" só valia nas Movimentações).
- Correção extra: join de colaborador nas Movimentações passou a trazer `cpf`, `data_admissao` e `empresa_id` (recibos reemitidos saíam com CPF zerado).
- **Emissão unificada em `src/lib/ceu/emissaoRecibos.ts`** (24/07/2026): Movimentações (individual/lote) e Relatórios usam o mesmo módulo. Lote passou a buscar **todas** as entregas do período no banco (antes filtrava só a página de 50 em memória). Botões "Gerar Recibo" e "Relatório em Lote" da aba Relatórios (estavam sem ação) ligados, respeitando os filtros da tela. Relatório "Por colaborador" separa **Situação** (entrega) de **Status** (Em aberto/Devolvido); item devolvido sai como "Devolvido" no recibo.

### Assinatura de ocorrências (23/07/2026 — noite)
- **Migration 072** (`072_ocorrencia_assinatura.sql`): `ocorrencias.forma_assinatura` (`papel`/`youk`, opcional) e `ocorrencia_anexos.tipo_documento` (`comprovante`/`documento_assinado`). ✅ **Aplicada no SQL Editor em 23/07/2026.**
- Detalhes da ocorrência: campo "Assinatura" no card de dados e tipo "Documento assinado" no upload de anexos (selo verde "Assinado").
- Formulário de nova ocorrência reordenado: **Macro Grupo → Tipo → Título** (título agora é o item 4, depois do tipo).
- PDF da ocorrência com logo institucional e CNPJ no cabeçalho; forma de assinatura e anexos assinados refletidos no documento.
- **Edge Function e-Contador**: `/funcionarios` restrito às empresas permitidas (cache 5 min) + encoding dos parâmetros. ✅ **Re-deploy feito em 23/07/2026.**
- Relatório completo: `docs/HANDOFF_23-07-2026_NOITE.md`.

### Cabeçalho do PDF de ocorrência (23/07/2026 — noite, complemento)
- Logo trocada para `logo_plena_30anos_redonda.png` e cabeçalho passou a exibir nome + CNPJ reais da empresa.
- `gerarPDFOcorrencia` resolve a empresa em cadeia: ocorrência → colaborador → departamento (id ou nome) → fallback Plena EA (`src/lib/pdf.ts`).
- **Correção de dados via SQL Editor (sem migration):** 58 ocorrências dos colaboradores reais da **Plena Tech** estavam com `empresa_id` divergente (Plena EA/nulo) e foram alinhadas ao `empresa_id` do colaborador.
- **Acidente revertido:** a primeira versão do UPDATE moveu também as ~5.033 históricas do placeholder "OCORRENCIAS HISTORICAS – NAO IDENTIFICADO" (matrícula `999999`) para Plena Tech; revertidas para Plena EA (estado da importação) na mesma sessão. O placeholder teve `empresa_id` zerado — ele não pertence a empresa nenhuma; **nunca usar empresa de colaborador como fonte para UPDATE em lote sem excluir a matrícula 999999**.
- Históricas de ex-colaboradores de empresas que não existem mais ficam como estão (só histórico — decisão da gestão). Retrato final: Plena EA 9.175 / Plena Tech 58 ocorrências.
- **Causa raiz do "PDF sai Plena EA":** `COLUNAS_AUTOCOMPLETE` (`src/components/AutocompleteColaborador.tsx`) não incluía `empresa_id` — ocorrências criadas pelo formulário ("Nova ocorrência") salvavam `empresa_id` NULL e o PDF caía no fallback. Corrigido; `buscarEmpresaDoRegistro` também consulta o cadastro do colaborador no banco quando o objeto vem incompleto.
- Atenção: o app é PWA — após deploy, orientar Ctrl+Shift+R (ou unregister do service worker) para o navegador largar o JS antigo.

### Módulo Férias (23/07/2026)
- **Rota `/ferias`** saiu do placeholder e ganhou 3 abas (padrão `ModuleShell`): Visão geral, Importar e Notificações.
- **Migration 070** (`ferias_periodos`): períodos por colaborador — tipos `gozo` (histórico), `agendado` (confirmado via Flit) e `previsto` (planejamento do RH); origem `flit`/`manual`. RLS padrão + auditoria.
- **Migration 071** (`ferias_notificacoes`): controle de notificações ao colaborador e ao responsável pelo contrato; DELETE de períodos manuais liberado para editores (Flit continua só admin).
- **Docs de aplicação:** `docs/APLICAR_MIGRATION_070.md` e `docs/APLICAR_MIGRATION_071.md` — **aplicar as duas no SQL Editor, em ordem**.
- **Importação Flit** (`/ferias/importar`): lê a planilha de férias do Flit (ex.: `dados-locais/Férias_23-07-2026.xlsx`), casa colaboradores por nome normalizado, mostra preview e grava de forma idempotente (delete+insert dos períodos `flit` do colaborador).
- **Últimas férias gozadas via PDF** (24/07/2026): o PDF "Previsão de Férias" do Flit (frente/verso, linhas casadas por posição) foi importado por matrícula com `scripts/importar-ferias-gozadas-pdf.cjs` — **125 períodos de gozo** preenchidos só para quem estava vazio (gozo = data + 29 dias, 30 dias CLT); 107 já tinham gozo (pulados); 3 com início 27/07/2026 já estavam como `agendado` da importação anterior. Total: 254 períodos. Arquivo em `dados-locais/Férias.pdf` (**nunca** em `public/` — LGPD).
- **Previsão manual do RH** (botão "Nova previsão"): lança período `previsto`/`manual`. Quando o período confirmado chega do Flit cobrindo as mesmas datas, a previsão é **baixada automaticamente** na importação.
- **Notificações**: registro por colaborador (destinatário: colaborador ou responsável pelo contrato), com data, observação e usuário registrante.
- **Painel CLT**: situação por colaborador ativo — Em gozo, Agendado, Previsto, A vencer (≤60 dias do limite concessivo), Vencido, Em dia, Sem dados — calculada em `src/lib/ferias/calculoFerias.ts`. Cards, filtros e exportação Excel (respeita filtros aplicados).
- **Permissões**: `ferias.importar`, `ferias.exportar`, `ferias.gerenciar` no `PERMISSOES_PADRAO` e na tela Permissões.
- Arquivos: `src/lib/ferias/` (parser + cálculo + 26 testes), `src/hooks/useFerias.ts`, `src/pages/ferias/`.
- **Visão futura** (não implementada): saldos por período aquisitivo, alocação de feristas — ver `docs/agentes/arquitetura_modulo_ferias.md`.

### Ocorrências históricas e da inspetoria
- **961 ocorrências históricas** importadas do sistema antigo (`public/Ocorrências de advertência e suspensão para CORH em sem cpf 15jul26.xlsx`).
  - Script: `scripts/importar-ocorrencias-antigas.py`
  - 465 vinculadas a colaboradores existentes
  - 496 vinculadas ao colaborador placeholder
  - 9 casos de múltiplos matches (vinculados ao primeiro encontrado)
- **12 ocorrências da inspetoria** importadas (`public/ocorrencias_inspetoria_classificado.xlsx`).
  - Script: `scripts/importar-ocorrencias-inspetoria.py`
- Colaborador placeholder criado: `OCORRENCIAS HISTORICAS - NAO IDENTIFICADO` (matrícula `999999`, status `Inativo`).
- Nome original preservado em `colaborador_nome`; número original em `titulo` e `descricao`.
- **1 ocorrência reassociada** após varredura dos 496 nomes: `PAULO JOSE DA SILVA` → `JOSE PAULO SILVA DE ARAUJO`.
- Planilha de revisão gerada: `dados-locais/revisao_496_nomes.xlsx`.
- **869 ocorrências da planilha Eliane** importadas (`public/ELIANE_OCO_Funcionarios_160726 occ rh tratada_final.xlsx`).
  - Script: `scripts/importar-ocorrencias-eliane.py`
  - 402 vinculadas a colaboradores existentes
  - 467 vinculadas ao colaborador placeholder
  - 0 inconsistências entre Macro e Tipo
  - Coluna `Matrícula` ignorada conforme orientação
- **5.380 ocorrências importadas hoje:**
  - Ocorrências históricas: 961
  - Ocorrências da inspetoria: 12
  - Planilha Eliane: 869
  - Planilha de faltas: 4.372
  - (6 ocorrências da planilha de faltas foram ignoradas por múltiplos matches)
- **Total atual no banco: 5.345 ocorrências** (2.969 vinculadas ao placeholder).

### Ajustes na tela de Ocorrências
- Busca textual agora inclui `colaborador_nome` e `descricao`.
- Filtros reorganizados em 3 linhas + dica informativa.
- Página de detalhes exibe nome original e aviso para ocorrências do placeholder.
- **Listagem e detalhes mostram nome de colaboradores inativos/não cadastrados** usando o campo `colaborador_nome`.
- Filtro de tipos com autocomplete — substituiu o filtro de gravidade; permite selecionar múltiplos tipos com chips.
- Botão "Limpar" ao lado de "Aplicar" para resetar todos os filtros rapidamente.
- Edição de ocorrências habilitada — botão "Editar" na lista e nos detalhes, rota `/rh/ocorrencias/:id/editar`.
- Arquivos alterados: `src/hooks/useOcorrencias.ts`, `src/pages/rh/OcorrenciasPage.tsx`, `src/pages/rh/OcorrenciaDetailPage.tsx`.

### Responsividade mobile / PWA
- Página `/mobile/falta` com inputs reduzidos no celular ✅
- CSS para normalizar inputs de data no mobile ✅
- Tabelas com `break-words` para evitar estouro de textos ✅
- PWA configurado com `vite-plugin-pwa` ✅

### Segurança / RLS
- Migrations 038–045 aplicadas: RLS de `extras`, `recibos_extras`, `categorias_extras`, `ocorrencias`, storage e isolamento por contexto ✅
- Migrations 044–045 aplicadas: isolamento de storage por `ocorrencia_id`/`projeto_id` via path ✅
- Edge Function `econtador` re-deployada com permissão adm/dp1/dp2 ✅
- Regras de negócio documentadas em `docs/REGRAS_NEGOCIO.md` ✅

### Qualidade / Preparação para produção
- Permissões de configurações e e-Contador corrigidas em `src/lib/permissoes.ts` ✅
- Tela administrativa de permissões criada em `src/pages/PermissoesPage.tsx` ✅
- Rotas e menus controlados pela tela de permissões ✅
- Mocks removidos do bundle de produção ✅
- Tratamento de erros silenciados ajustado ✅

### Correções de usabilidade
- Filtro por departamento na tela de colaboradores corrigido ✅
- Menu e-Contador unificado ✅
- Página de auditoria global criada ✅
- Build de produção estabilizado com `cross-env` ✅

### Sidebar reorganizado em grupos expansíveis
- Agrupamento por área: Cadastros, Operacional, RH, DP, Gestão e Relatórios ✅
- Grupos colapsáveis/expandíveis com estado no `localStorage` ✅
- Rótulos atualizados: "Uniformes" → "CEU", "VR" → "Benefícios" ✅

### Botão Voltar em todas as páginas
- Componente `PageHeader` criado ✅
- Aplicado em todas as páginas principais, listagens, formulários e detalhes ✅

### Permissões dinâmicas finalizadas
- Tabela `permissoes_perfil` criada via migration 046 ✅
- Seed de 132 permissões via migration 047 ✅
- Hook `usePermissoes`, `src/lib/permissoes.ts`, `ProtectedRoute`, `App.tsx` e `Sidebar` integrados ✅

### Segurança do token e-Contador
- Endpoints `/token-status` e `/remover-token` na Edge Function `econtador` ✅
- Frontend verifica token apenas pela Edge Function ✅
- Input de token continua `type="password"` ✅

### Módulo Escalas / Local de Trabalho Diário
- Tabelas `locais_trabalho`, `mapeamento_flit_local_trabalho`, `locais_trabalho_diario` (migrations 048–051) ✅
- Migrations 048–051 aplicadas no banco de produção ✅
- Importação Flit, inferência de local, aba Escalas, modal de confirmação, exportações ✅
- Importação de departamentos com deduplicação por similaridade de nome ✅

### Página de login
- Redesign com layout split: lado esquerdo em azul escuro degradê, texto "CORH — Controle Operacional e de RH", design limpo com cards de destaque; formulário de login do lado direito. ✅

---

## 🎯 Próximos passos pendentes (priorizados)

### 🟠 Alto
1. ~~**Aplicar migration 072** no SQL Editor e validar~~ — ✅ aplicada em 23/07/2026.
2. ~~**Re-deploy da Edge Function e-Contador**~~ — ✅ feito em 23/07/2026.
3. **Revisar/associar mais ocorrências do placeholder** usando `dados-locais/revisao_496_nomes.xlsx`.
4. **Revisar os 9 casos de múltiplos matches** da importação histórica.
5. **Verificar no sistema** se a busca e os detalhes das ocorrências históricas funcionam corretamente.
6. **Aplicar mais importações** conforme arquivos novos disponibilizados (ocorrências, colaboradores, departamentos, etc.).
7. **Testes manuais de login/perfis** — verificar menus e rotas para cada perfil de teste.
8. **Testes manuais de storage** — upload/visualização de anexos de ocorrências e arquivos VR.
9. **Testes manuais do fluxo de extras** — cálculo, pagamento e auditoria.
10. **Testes manuais do módulo Escalas** — importação Flit, confirmação de local e exportações.
11. **Revisar type assertions (`as`)** — reduzir uso, especialmente em formulários grandes.
12. **Quebrar páginas monolíticas** — `OcorrenciaFormPage`, `OcorrenciaDetailPage`, `CeuRelatoriosPage`.
13. **Unificar componentes de UI** — `CeuButton`, `VrButton`, `ExtrasButton`, etc.

### 🟡 Médio / após auditoria
12. **Confirmar PWA no celular** — "Adicionar à tela inicial" e tela cheia.
13. **Testar validação de duplicidade de extras** em cenário real.
14. **Definir design system** antes de implementar módulos novos.
15. **Módulos placeholders:** `/ferias`, `/escalas` (estrutura já criada), `/relatorios`.

---

## ⚠️ Atenções

- **O colaborador placeholder (`OCORRENCIAS HISTORICAS - NAO IDENTIFICADO`, matrícula `999999`) não deve ser excluído** enquanto houver ocorrências históricas vinculadas a ele.
- **Não alterar regras de cálculo de VR/adicionais sem consultar a usuária.**
- **Regras de negócio validadas estão em `docs/REGRAS_NEGOCIO.md`.**
- Sempre rodar `npm run build`, `npm run lint` e `npm test` após alterações.
- **Workflow de defesa em ocorrências:** não será implementado por decisão de negócio.
- O Vite dev server pode apresentar erro 504 ao carregar módulos lazy em desenvolvimento. Se ocorrer, reiniciar com `npm run dev` geralmente resolve.

---

*Se este arquivo estiver desatualizado, verifique o log de commits recentes e `docs/HANDOFF_PROXIMO_AGENTE_2026_07_16.md`.*
