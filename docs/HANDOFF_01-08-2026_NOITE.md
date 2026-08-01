# Handoff — 01/08/2026 (noite: persistência de filtros, filtro de adicional no Calendário, resumo de direito, caso Mariana)

> Passagem para o próximo agente. Terceira sessão do dia 01/08. Nada de migration nova. Deploy Netlify pendente (acumulou o dia inteiro — 1 deploy cobre tudo).

## 1. Persistência de filtros em TODAS as telas

- Novo hook `src/hooks/useFiltroPersistente.ts` (8 testes): `useState` que persiste no **sessionStorage** sob `corh:filtros:<chave>` — filtros sobrevivem à navegação, são **independentes por aba** e morrem ao fechar a aba. Botão "Limpar" continua funcionando (persiste o valor limpo).
- Aplicado em ~25 telas: Ocorrências, Colaboradores, Auditoria, Extras (4), Adicionais (4), CEU (5, incl. `relatorios/useFiltrosRelatorio.ts` com rascunho+aplicado), Escalas (`AbaEscalasDiario.tsx` — a `EscalasPage` é só shell), Férias (2), VR, Departamentos, Empresas.
- Convenção de chave: `<modulo>.<tela>.<campo>` (telas com rascunho+aplicado: `.draft.`/`.aplicado.`). NÃO persistidos: paginação, modais, seleção, formulários, Sets/Maps/Dates, dados do servidor.
- Duas abas com o mesmo usuário **já funcionavam** (NavLink aceita Ctrl+clique; sessão é compartilhada) — orientado à usuária.

## 2. Aba Calendário (Adicionais): filtro de adicional + resumo de direito

- Novo filtro **Adicional** (mesmo Select das telas Contratos/Vínculos/Relatório) — filtra pelos adicionais do próprio vínculo (fallback: flag do contrato). Persistido (`adicionais.calendario.adicional`).
- Cada card de vínculo ganhou rodapé **"Direito no período"** com chips por adicional ativo do contrato, só para o **titular** do posto: insalubridade/periculosidade = `adicionalTitular30(faltas, transferidos)` (mesma regra 01/08 do relatório); noturno = trabalhados; intrajornada = trabalhados em dias configurados; feriado = `contarDiasFeriadoEscalado`. Com o filtro de adicional ativo, mostra só o chip escolhido. Considera alterações não salvas (usa `getDia`/`getSubstituto`).

## 3. Caso Mariana Ribeiro da Silva (Insalub. Quatre, 12×36, vínculo 20/06–19/07)

- **Regra confirmada:** férias 20/06–07/07 cobertas por MARCELO RAMOS RUFINO → titular recebe **12** (8–19/07: 6 trabalhados + 6 folgas) e substituto **18**. Soma 30 ✓.
- **1ª correção** (`scripts/corrigir-ferias-mariana-2026-08-01.sql`): inseridos 20, 22, 24, 26, 28/06 como férias+Marcelo (o bloco estava "furado" nos dias de escala). Backup: `dados-locais/backup_mariana_correcao_ferias_2026-08-01.json`.
- **Reimportação (14:31) apagou o substituto** de 30/06–07/07 e os dias 23 e 29/06 sumiram → **2ª correção** (`scripts/corrigir-ferias-mariana-pos-reimportacao-2026-08-01.sql`): UPDATE nos 8 dias + INSERT dos 2. Backup: `dados-locais/backup_mariana_pos_reimportacao_2026-08-01.json`. Estado final verificado no banco: 18 férias, todas com Marcelo.
- **Comportamento da importação (decisão da usuária, 01/08):** reimportar o ponto **reseta** o período ao estado do espelho — lançamentos manuais e substitutos são apagados de propósito (é o jeito de consertar lançamento errado). Após reimportar, refazer o substituto pelo Calendário → "Definir substituto (N dias)" em lote. O reset só cobre vínculos de quem está no PDF, no período do PDF.

## 5. Regra 12×36 — folga pareada do substituto (ajuste fino da regra 01/08)

- Decisão final da gestão: o substituto cobre **os dias de escala** do titular, mas o adicional do 12×36 paga trabalhado + folga → **cada dia de escala coberto transfere também a folga pareada** (dia seguinte, se também férias/afastado). Ex.: 9 dias de escala cobertos num bloco de 18 → 18 transferidos.
- Nova função pura `contarDiasTransferidos` em `calculoAdicionais.ts` (7 testes novos — caso Mariana, dedupe, borda de bloco, regime indefinido, escalas normais). Aplicada no fechamento do **Relatório** (coleta `feriasAfastPorVinculo` com e sem substituto) e no **resumo do Calendário**.
- Auditoria por agente (explore): implementação considerada **fiel à regra**; achados de borda registrados (vínculo duplicado mesma chave, pareamento com data_inicio vazio, dois substitutos no mesmo bloco) — nenhum afeta o caso real.
- **Caso Mariana encerrado:** banco correto (18 férias 20/06–07/07, trabalhou/folga 8–19/07). Esperado após registrar o substituto: **Mariana 12 / Marcelo 18**.
- **Bug de parser identificado (pendente):** no espelho salvo (`20jun a 19jul (1).pdf`), a página da Mariana parseia com `nome=undefined` (CPF 161.636.867-56 parseia normal) — na prévia o nome dela não aparece, embora o match por CPF funcione. Investigar `parsePaginasEspelho` para o layout da página dela. Script de inspeção: `scripts/inspecionar-espelho-mariana.ts [NOME|CPF]` (baixa o espelho do bucket e mostra os dias parseados).

## Estado final

- `npm run lint` — limpo · `npm test` — **242 passando, 1 skipped** · `npm run build` — ok
- Banco: sem migration nova; apenas as 2 correções de dados acima (aplicadas e verificadas).

## Pendências

- **Deploy Netlify** (acumulou: hooks anti-falso-sucesso, /relatorios, regra de adicionais, financeiro, filtros persistentes, calendário).
- Validar com a usuária: relatório de junho mostrando Mariana 12 / Marcelo 18; filtro de adicional + resumo no Calendário; filtros persistindo ao navegar.
- Pendências antigas: validações de produção (feriados, assinatura preta, "Lançado em"), recibo do Ricardo, importação unificada (~60 ocorrências), revisão visual dos menus por perfil, casos ambíguos da varredura anti-falso-sucesso.
