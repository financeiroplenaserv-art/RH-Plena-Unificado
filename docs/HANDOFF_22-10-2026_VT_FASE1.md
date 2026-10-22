# HANDOFF — Módulo VT (Vale-Transporte) — Fase 1 + 2a + coberturas — 22/10/2026

> **Para o próximo agente:** o módulo VT foi concebido, validado e implementado do zero nos dias 21–22/10/2026, na branch **`vt-fase1`** (commitada e com push; **NÃO mesclada na `main`**). Deploy de produção ficou para "amanhã, após algumas implementações" (decisão da gestora em 22/10 à noite) — seguir o checklist do AGENTS.md §10 quando chegar a hora (branch `main` limpa, `MODULO_FERIAS_LIBERADO` e `MODULO_VT_LIBERADO` conferidos, hash do bundle). **O módulo está oculto por `MODULO_VT_LIBERADO = false`** (`src/lib/modulos.ts`) — só vira `true` com liberação expressa da gestora.
>
> **Leia primeiro:** `docs/PLANO_MODULO_VT.md` — o plano completo, com TODAS as decisões da gestora (§10, itens 1–10) e as evidências (§9). Ele é a fonte de verdade do módulo.

## 1. O que o módulo é (resumo executivo)

Objetivo da gestora: carga de VT **100% certa — "nem a mais, nem a menos"**. Síntese dela (gravada no plano §6.4): **"VR olha para trás, VT olha para a frente. O único olhar para trás do VT é o fechamento: faltou, desconta no mês seguinte."**

- **Previsão (carga, ~dia 25)**: relatório **"Gestão de escalas" do Flit** do mês seguinte (matriz pessoa × dia: `[T]` trabalha / `[F]` folga / `[FR]` férias / `[AF]` afastado / `[AT]` atestado) + coberturas de férias registradas (`vt_coberturas`) + trajetos confirmados (casa → posto × bilhete). Regra dura: **nunca a menos** (sem VT a pessoa não consegue ir trabalhar).
- **Fechamento (mês seguinte — Fase 2b, NÃO implementada)**: ponto real (espelho arquivado no bucket `ponto-espelhos`) + extras + substitutos do calendário de adicionais → quem faltou (qualquer motivo) tem o dia descontado na próxima carga.
- **Precificação**: catálogo de **9 bilhetes nomeados com valor diário fechado** (ida+volta), até 2 bilhetes por trajeto (custo = soma). A maioria usa BU INTERMUNICIPAL (R$ 18,80) ou BU NITERÓI (R$ 11,20). Reajuste = nova linha de vigência (imutável, padrão `ceu_itens_precos`).
- **Faltista ≠ ferista**: faltista cobre faltas (imprevisível — recebe valor cheio no trajeto-base, sem novidade de sistema); ferista cobre FÉRIAS (planejado, mas o Flit não mostra o destino — por isso existe `vt_coberturas`).

## 2. Estado do código (branch `vt-fase1`, tudo commitado)

- **Página `/vt`** (`src/pages/vt/`): abas **Colaboradores** (marca optante + tipo de bilhete; cabeçalho Nome com ordenação A→Z/Z→A por seta clicável), **Trajetos** (par casa→posto, bilhete 1 obrigatório + "+ 2º bilhete" opcional e recolhido, custo/dia, selo precisão exato/bairro, botão "Ver rota" = link Google Maps de transporte público preenchido, "Confirmar"), **Carga** (importar Gestão de escalas → seção "Férias no mês" com destino obrigatório por titular → tabela por optante → "Gravar carga" com portão de pendências + "Baixar Excel"), **Bilhetes** (catálogo com vigências, ordenado por valor crescente).
- **Lógica pura `src/lib/vt/`** (testes ao lado de cada arquivo): `bilhetes.ts` (vigentes, custo do dia, formatarCentavos), `enderecos.ts` (normalização da POC: corta "LT/QD/BLC/CS/FUNDOS", número "0"/"S/N", rua dupla; precisão exato/bairro; link do Google Maps), `trajetos.ts` (custo do trajeto, pares da escala, escopo sugerido por cidades), `carga.ts` (competência, agrupar dias por posto, aplicarCoberturas com prioridade e **síntese de dias do ferista** — cobertura cria dia de trabalho no posto coberto até em folga do relatório, mas NUNCA sobre `[FR]`/`[AF]`/`[AT]`), `gestaoEscalasFlit.ts` (parser do relatório; **blocos `[FR]` separados por buraco ≤ 2 dias são mesclados** — férias são corridas; o `[T]` dentro do período mesclado segue contando como trabalho, regra "nunca a menos"), `ordenacao.ts`.
- **Hooks**: `useVt.ts` (optantes/bilhetes/trajetos), `useVtCarga.ts` (importação do relatório + pipeline), `useVtCoberturas.ts`. Toda escrita com `.select('id')` + conferência (anti-falso-sucesso).
- **Permissões**: `vt.gerenciar` (gestor, mesa, dp1, dp2), `vt.visualizar` (+ financeiro) no `PERMISSOES_PADRAO` + tela Permissões; seeds `menu/rota.vt` na migration 155. Rota protegida por `rota.vt`.
- **Checks no commit**: `npx vitest run` **1.285 verdes** · `tsc` exit 0 · ESLint limpo nos arquivos do módulo · `npm run build` ok. (Lint GLOBAL quebrado por causa de `.claude/worktrees/` de agentes antigos — pré-existente; apagar a pasta resolve.)

## 3. Estado do banco (produção) — migrations APLICADAS via Management API

| Migration | O que é | Verificação |
|---|---|---|
| `155_vt_fase1.sql` | `colaboradores.vt_optante`/`vt_tipo_cartao`; `vt_bilhetes` (9 seeds); `vt_trajetos`; `vt_geocode_cache`; seeds de permissão; `reset_permissoes_perfil` recriada **+ correção da regressão bi da cadeia 115→129** (decisão 111: rh/dp1/dp2/financeiro voltam a ter `menu/rota.bi` true no "Restaurar padrão") | 9 bilhetes, 2 colunas, 36 linhas de permissão, 0 mojibake |
| `156_vt_bilhetes_rename.sql` | "combinação" → **"bilhete"** (termo da gestora) — rename de tabela/colunas/constraints | 9 bilhetes, tabela antiga inexistente |
| `157_vt_cargas.sql` | `vt_cargas` (1 por colaborador×competência; detalhe jsonb; ajuste vem da reconciliação futura) | tabela criada, 0 linhas |
| `158_vt_coberturas.sql` | `vt_coberturas` (ferista × posto × período; DELETE `is_editor()`) | tabela criada |
| `159_vt_coberturas_ferias.sql` | `vt_coberturas.ferias_colaborador_id` (de quem são as férias) + ferista nullable (= "sem cobertura") + unique parcial | coluna presente |

**Carga inicial de dados (22/10/2026)**: da planilha de VT vigente da operação (`dados-locais/valores de vt por colab.xlsx`): **236 optantes + 236 trajetos confirmados** (matrícula exata normalizada + valor diário → bilhete 1:1; 5 demitidos ignorados; 0 pendências). Script: `scripts/vt/importar-vt-vigente.ts` (dry-run padrão, `--aplicar` grava, backup antes). Backup: `dados-locais/backup_vt_preenchimento_2026-10-22/`. Backups das migrations: `dados-locais/backup_vt_155_2026-10-21/`.

## 4. Investigações que embasaram o desenho (não refazer)

- **API da Alterdata NÃO expõe VT** (nem flag optante, nem vales, nem %VT) — verificado ao vivo com o token ePlugin em 21/10 (`scripts/econtador-probe-vt.mjs` e `-vt2.mjs`; 39 atributos, nada de VT, nem por `fields[]` nem por `include`). **Expõe `salarioBase`** (correto, validado pela gestora) — importação dele ficou para quando o freeze do e-Contador acabar (needed p/ desconto de 6%). `horarios` da ficha Alterdata: **não usar** (desatualizado; jornada vem do Flit).
- **Endereços**: 320/320 ativos com endereço+CEP+cidade (sync diário da Alterdata); 62/64 postos idem (faltam PLENA TECH ADM e DUOCONNECT).
- **Geocodificação (POC, 4 rodadas)**: endereço residencial falha ~50% no nível da porta (número "0", lote/bloco no texto, CEP divergente); **bairro resolve ~100%** — mas o teste porta × bairro mostrou que **intermunicipal precisa do exato** (o ponto de embarque define a linha). Regra: exato primeiro, bairro com selo + confirmação humana; intermunicipal sempre confirma. Auditoria completa: `scripts/poc-vt-auditoria-geocode.mjs`, resultado em `dados-locais/poc_vt_auditoria_geocode.json` (38% exato+municipal, 11% exato+inter, 33% bairro+municipal, **9% bairro+inter = grupo crítico**, 3% falha).
- **Sem chave do Google por ora** (decisão da gestora): rotas via link gratuito do Google Maps + confirmação humana; geocode futuro via Nominatim gratuito. Se a fila de confirmação pesar, aí faz a chave (Routes API) e a leitura das pernas vira automática.
- **Tarifas reais**: Niterói VT da empresa = R$ 5,60 (não R$ 4,45 — a compra é da empresa, mesmo com CPF no cartão) com **integração confirmada pela gestora** (2 ônibus em 1h = R$ 5,60 o trecho); BUI = R$ 9,40 (2 modais/3h). Compra hoje: site **Riocard Mais → Para Empresas**, na mão — meta é automação (Fase 4). Fonte de tarifas por cidade: base da Otimiza.pro.

## 5. O que falta (nesta ordem — plano §6 e §10)

1. **Fase 2b — fechamento/reconciliação** ("olhar para trás"): depois do ponto importado, dias reais × custo/dia vs. creditado; faltou (qualquer motivo) → desconto automático na próxima carga (alimenta `vt_cargas.ajuste_centavos`). Fonte: espelho de ponto arquivado (`ponto-espelhos`, parser `pdfPosicional`) + extras + substitutos do calendário de adicionais (são dados do período passado — servem só para o fechamento, nunca para a previsão). Verificar antes: se o espelho traz o local por dia.
2. **Desconto de 6% em folha** (`min(6% × salario_base, necessidade)`): depende de importar `salarioBase` da Alterdata — **congelado junto com o freeze do e-Contador** (Férias não liberado; NÃO redeployar `econtador`/`sync-econtador` — AGENTS.md §10). Coluna existe no plano; hoje a tela mostra "—".
3. **Fase 3 — alertas**: troca de posto na escala → "o bilhete cobre o trajeto novo?"; evento "meu bilhete acabou" com previsto × real; gatilho futuro da ocorrência "Transferência de Setor" (que já atualiza `departamento_id`).
4. **Fase 4 — automação Riocard Mais** (carga em lote/API) e **exportação no formato oficial** dela (hoje sai Excel genérico).
5. **Integração futura com o módulo Férias liberado**: `ferias_alocacoes` alimenta `vt_coberturas` automaticamente (o registro manual se aposenta).
6. **Dados**: endereços dos postos PLENA TECH ADM e DUOCONNECT; 11 colaboradores sem geocode nem por bairro (lista na auditoria); 18 sem posto vinculado.

## 6. Para retomar o trabalho

```bash
git checkout vt-fase1           # branch do módulo (push feito)
# testar local com o módulo visível: MODULO_VT_LIBERADO = true em src/lib/modulos.ts
# (NUNCA commitar o flag true) + npm run dev → http://localhost:5173/vt
```

- Aplicar migration nova: backup antes + `powershell scripts/lib/executar-arquivo-sql-management-api.ps1 -Arquivo supabase\migrations\NNN_arquivo.sql` (arquivo UTF-8 — NUNCA SQL com acento inline; incidente da migration 131).
- A gestora testou tudo ao vivo em 21–22/10 (F5 no dev server) e aprovou cada peça: bilhetes, trajetos preenchidos, carga com relatório do Flit, férias com destino obrigatório, ordenações.
- Relatório de teste usado: `dados-locais/Gestao_de_escalas_22-10-2026 (1).xlsx` (outubro). Para o ciclo real, ela gera o de novembro ~dia 25.
