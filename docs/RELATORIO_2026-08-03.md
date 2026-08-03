# Relatório do dia 03/08/2026 — CORH

> Resumo de tudo o que foi feito nesta sessão: o que estava errado, o que foi corrigido e o que mudou no sistema. Documento para a gestão; detalhes técnicos completos em `docs/HANDOFF_03-08-2026.md`.

---

## 1. Caso Mariana (insalubridade 12×36) — RESOLVIDO

**O problema:** o relatório de adicionais não fechava a conta das férias da Mariana (deveria dar Mariana 12 dias / Marcelo 18 dias).

**O que descobrimos:**
- O "erro no leitor do PDF" que suspeitávamos **não existia** — era uma falha no script de diagnóstico, não no sistema.
- O erro real era duplo: (1) o Marcelo estava marcado nos dias errados do calendário; (2) a regra de cálculo só reconhecia a cobertura quando o substituto trabalhava nos dias de escala da titular — mas o Marcelo trabalhou no ritmo inverso (nas folgas dela).

**A correção (validada com a gestão):** no 12×36, cada par (dia de escala + folga seguinte) agora é transferido **se o substituto trabalhou qualquer dia do par**, nos dois sentidos. Marcelo recebe pelo dia trabalhado e pela folga.

**Verificado com os dados reais do banco: Mariana 12 / Marcelo 18.** ✓

## 2. Usuários reais no sistema

- **10 contas criadas** com perfil e nome corretos: Eliane e Érica (financeiro), Maciel (mesa), Tayrone e Augusto (inspetoria), Rosely (RH), Ludmila (DP1), Elizabeth (DP2), Alexandre (gestor), Elisangela (administradora).
- Cada um recebeu **senha temporária individual** (mensagens prontas em `dados-locais/mensagens_primeiro_acesso_2026-08-03.txt`).
- A conta antiga `eliane@plenafacilities.com.br` virou **administradora** e teve a senha redefinida; o nome foi corrigido para "Eliane".
- **"Esqueci a senha" criado** (não existia): link na tela de login → e-mail com link → tela para definir a nova senha. **E-mails do sistema traduzidos para português** (redefinição, confirmação de cadastro e link de acesso — templates configurados no Supabase).

## 3. Transferência de autoria e exclusão dos usuários de teste

Os logins de teste eram usados pelas próprias pessoas que agora têm conta real — nada podia se perder.

- **Varredura completa no banco** encontrou tudo o que os testes fizeram: 2.600 registros de auditoria, **255 movimentações do CEU**, 73 confirmações de local de trabalho, 22 extras, 8 importações e-Contador e 4 projetos de VR.
- **Tudo foi transferido para as contas reais** (DP1→Ludmila, DP2→Elizabeth, Mesa→Maciel, Gestor→Alexandre, Financeiro→Érica, Inspetoria→Augusto, RH→Rosely), com **backup completo antes** (`dados-locais/backup_transferencia_usuarios_teste_2026-08-03.json` — permite desfazer).
- Só depois de confirmar **zero pendências**, as **9 contas de teste foram excluídas**.
- Estado final: 12 usuários no sistema (os 10 novos + 2 contas de administradora).

## 4. CEU — item novo que "não aparecia"

**O problema:** o item 1004 foi cadastrado mas não aparecia na lista.

**Causa:** não era erro de gravação (o item estava no banco) — um **filtro de pesquisa esquecido** na tela escondia o item novo (efeito colateral do recurso novo que mantém os filtros ao navegar).

**Correção:** ao cadastrar um item novo, a lista agora limpa os filtros automaticamente — o item recém-criado sempre aparece.

## 5. Ordenação A→Z

- **Calendário de Adicionais:** novo controle "Ordenar por" (Colaborador, Departamento ou Adicional) com setinha A→Z / Z→A.
- **Relatório de Adicionais:** cabeçalhos clicáveis com setinha em Colaborador, Departamento e nas colunas de adicionais (Noturno, Periculosidade, Insalubridade, Intrajornada, Feriado).

## 6. Auditoria — três melhorias

- **Filtro corrigido:** "Entregas CEU" e "Itens CEU" não mostravam nada (a tela procurava o nome errado da tabela no banco).
- **Paginação:** a lista só mostrava os 200 registros mais recentes; agora navega por **todo o histórico** (50 por página, com total).
- **Busca global + período:** dá para pesquisar por tabela, ação, registro ou **nome do usuário** em todo o histórico, e filtrar por datas ("De"/"Até").

## 7. Incidente do dia (transparência)

- A conta do Netlify tem **dois sites** e o primeiro deploy foi parar no site errado — produção ficou desatualizada por algumas horas e **30 créditos foram gastos** em deploys perdidos. Corrigido, e a armadilha foi **documentada no AGENTS.md e no handoff** com o procedimento de verificação obrigatória (comparar a versão publicada com a local após cada deploy) para não se repetir.

## 8. Deploys e qualidade

- **3 deploys de produção efetivos** no dia (o último verificado: https://plena-corh.netlify.app com a versão mais recente).
- **255 testes automatizados passando**, lint limpo, build ok.
- Commits no GitHub: `9ddd859`, `45a0af2`, `0943990`, `c896bb0`, `afa63c0`, `7d5cb6a`, `01237f1`, `bae53d1`.

## 9. Pendências conhecidas

- Validar em produção: relatório Mariana 12/Marcelo 18, "Esqueci a senha" de ponta a ponta, ordenações, item novo no CEU, auditoria (paginação e busca).
- A busca da Auditoria não pesquisa dentro do conteúdo das alterações (JSON) — segunda etapa, se necessário.
- Pendências antigas: validações de produção (feriados, assinatura, "Lançado em", financeiro em ocorrências), recibo do Ricardo, importação unificada de ocorrências, revisão visual dos menus por perfil.

---

*Documento gerado em 03/08/2026. Handoff técnico: `docs/HANDOFF_03-08-2026.md`.*
