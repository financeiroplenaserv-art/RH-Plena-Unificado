# Regras de Negócio — RH Plena Unificado

Documento de decisões de negócio validadas com a gestão. As regras aqui devem ser respeitadas por desenvolvedores e agentes de auditoria.

---

## Adicionais / Insalubridade / Periculosidade

### Regra dos 30 dias (atualizada em 01/08/2026 e refinada em 03/08/2026, validada com a gestão)
- **Titular (qualquer escala):** trabalhou tudo → **30 dias**. Faltou → **30 − faltas**.
- **Titular com férias ou afastado coberto por substituto:** os dias cobertos saem da conta dele → **30 − faltas − dias transferidos**.
  - No **12×36**: o adicional é pago em trabalhado + folga, e o par do 12×36 é (dia de escala, folga seguinte) — se o substituto trabalhou **qualquer dia do par**, o par inteiro transfere (cada dia apenas se estiver no bloco de férias/afastado). O ritmo do substituto NÃO precisa coincidir com a escala do titular (ajuste fino de 03/08/2026, caso Mariana/Marcelo: ele trabalhou as folgas dela + 04 e 07/07 — os 9 dias tocam os 9 pares → 18 transferidos → titular 12, substituto 18).
  - Nas **demais escalas**: transferem os dias cobertos (dias corridos da "outra parte do mês").
  - Férias/afastado **sem substituto registrado** não transferem dias — o titular mantém 30 − faltas.
  - Falta antes das férias **desconta** da parte do titular (decisão confirmada em 01/08/2026).
- **Substituto (sem vínculo próprio no contrato):**
  - **Insalubridade:** recebe **todos os dias cobertos** — faltas/folgas de substituição **e** o bloco de férias/afastado ("a outra parte do mês").
  - **Periculosidade:** recebe **apenas os dias de férias/afastado cobertos**; cobertura de falta **não** gera periculosidade.
- Afastado (atestado/INSS) segue a **mesma regra de férias** (decisão confirmada em 01/08/2026).
- **Alerta "precisa de substituto" (ajuste de 28/08/2026, caso Alcemir):** só dispara em dia de **escala** do vínculo. Férias/afastado caindo em **folga** da escala (ex.: o dia de descanso do 12×36 dentro das férias) **não exigem substituto** — ninguém trabalha a folga, e o par já transfere pelo dia de escala coberto. Falta e "folga com substituição" continuam sempre exigindo. Helper: `diaExigeSubstituto` em `src/lib/adicionais/calculoAdicionais.ts` (com testes).
- **Substituição "sem adicional" (controle interno — decisão da gestão, 27/08/2026):** ao definir o substituto (dia único ou em lote), o checkbox "Não gerar adicional (controle interno)" grava `calendario_adicionais.substituto_sem_adicional = true` (migration 105). Uso: o substituto cobre o posto mas é pago por fora (extra) — ele **não recebe o adicional nem aparece no relatório final**. Os dias cobertos **continuam saindo da conta do titular** (a transferência acontece normalmente) e **não são pagos a ninguém** — os dias se perdem para ambos. No calendário, o dia conta como coberto (sem alerta de "precisa de substituto"). O flag só é definido na criação — para mudar, remove-se a substituição e lança de novo. Helper: `substituicaoGeraAdicional` em `src/lib/adicionais/calculoAdicionais.ts` (com testes).
- Lógica pura: `src/lib/adicionais/calculoAdicionais.ts` (`adicionalTitular30`, `insalubridadeSubstituto`, `periculosidadeSubstituto` — com testes). Aplicada no fechamento de `src/pages/adicionais/AdicionaisRelatorioPage.tsx`.
- **Substituída em 01/08/2026:** a regra anterior ("12×36 sempre 30 dias cheios, nunca proporcional") não vale mais — não reverter sem validação da gestão.

---

## Permissões de Acesso

### e-Contador / Importação Alterdata
- Apenas perfis: **adm, dp1, dp2**.
- A usuária administradora é a única com acesso direto ao Supabase.
- Gestão do token (salvar/remover via Edge Function): **admin, adm, dp1 e dp2** — decisão confirmada em 2026-07-23 (achado M2 da auditoria de segurança); o DP opera a integração no dia a dia.

### Extras (lançamentos, recibos, categorias)
- Visualização: **adm, mesa, financeiro, dp1**.
- Edição: mantida pela função `is_editor()` (adm, gestor, rh, dp1, dp2, mesa, inspetoria, financeiro).
- Exclusão: apenas **adm**.

### Ocorrências
- Visualização: **adm, gestor, dp1, dp2, mesa, inspetor, financeiro** (financeiro incluído em 01/08/2026 — migration 098).
- Criação: **adm, gestor, rh, dp1, dp2, mesa, inspetoria, financeiro** (financeiro incluído em 01/08/2026 — migration 098; ele só cria e visualiza, não edita/cancela/anexa).
- Edição: mantida pela função `is_editor()`.
- Exclusão: apenas **adm**.
- Após gerar o PDF, registra-se **como o documento foi assinado** (`forma_assinatura`: papel ou Youk — opcional) e o impresso assinado pode ser anexado como **"Documento assinado"** (`tipo_documento` no anexo). Decisão de 2026-07-23.
- **Documentos obrigatórios para ativar (status Pendente → Ativa):** em geral são 2 — o **documento comprobatório do motivo da sanção** e o **documento assinado pelo colaborador**. **Exceção (decisão da gestão, 06/08/2026):** as ocorrências nascidas de atestado médico — **Falta Justificada (atestado)**, **Licença Médica (até 15 dias)** e **Licença Médica (acima 15 dias — INSS)** — exigem **apenas o documento comprobatório** (o próprio atestado); o documento de assinatura não é obrigatório. Lógica em `src/lib/ocorrencias/tiposOcorrencia.ts` (`TIPOS_SEM_ASSINATURA_OBRIGATORIA`, `exigeDocumentoAssinado`), com testes.

### Colaboradores (quadro de informações)
- A tela de detalhes (`/rh/colaboradores/:id`) é acessível ao **financeiro** desde o seed (rota + SELECT já existiam); em 01/08/2026 a seção de ocorrências passou a funcionar para ele (migration 098) e o botão "Nova Ocorrência" passou a seguir a permissão `ocorrencia.criar`.
- CPF completo (listagem e ficha) segue a ação `colaborador.ver_cpf_completo`: **gestor, rh, dp1, dp2 e financeiro** (financeiro incluído em 01/08/2026 — migration 098). Demais perfis veem o CPF mascarado (LGPD).

---

## Recibos

### Recibos de Extras
- Ficam **armazenados no próprio sistema** (tabela `recibos_extras`).
- **Não** são enviados para o Youk.

### Demais Recibos
- Continuam sendo gerenciados no **Youk**.

---

## Módulo Férias (reconstruído — migration 112, decisões da gestão de 25/09/2026)

Fonte de verdade: **`ferias_solicitacoes`** (tipo gozo/agendado/previsto + workflow `pendente → aprovada → em_andamento → concluida`, mais `cancelada`). A tabela `ferias_periodos` é legada, somente leitura até o drop em migration futura. "Contrato" = `departamentos`. "Função" vem de `colaboradores.cargo` (texto livre), resolvida para `ferias_funcoes` por aliases normalizados.

**Terminologia — ferista ≠ faltista:** o **ferista** cobre FÉRIAS (carteira `ferias_feristas`, alocações `ferias_alocacoes`); o **faltista** cobre faltas pontuais e segue no módulo Extras.

- **RN-01 — Teto de ausência simultânea e aprovação por antiguidade:** cada contrato+função tolera no máximo `max_simultaneos` ausentes (`ferias_regras`; linha NULL/NULL = default global 1). Ao programar, o sistema conta as solicitações aprovadas/em_andamento sobrepostas no mesmo contrato+função e mostra aviso **âmbar listando os conflitos — NÃO bloqueia** (a decisão é do RH). As pendências de aprovação são ordenadas pela admissão mais antiga.
- **RN-02 — Prioridade de alocação do ferista:** 1) mesmo contrato (departamento do cadastro do ferista) + mesma função + disponível; 2) mesma função em outro contrato; 3) matriz — cobre a função da vaga via `cobre_funcoes`, sendo função diferente; 4) desempate fairness — há mais tempo sem alocar; quem nunca alocou vem antes de todos. **Elegibilidade (RN-02.3): matriz explícita `ferias_funcoes.cobre_funcoes` (migration 113, decisão da gestão 25/09/2026)** — a função A cobre a função B apenas se B consta em A.cobre_funcoes; cobrir a própria função é implícito. O `nivel` não decide elegibilidade (só desempate/exibição). Seeds: ASG cobre Jardineiro; Porteiro cobre Vigia; Encarregado cobre Porteiro — o restante é configurado pelo RH na aba Feristas → Catálogo de funções. **Pesos do score: sequência 400 > mesmo contrato 300 > mesma função outro contrato 200 > matriz 100 > fairness 0–99.**
- **RN-03 — Conflito de datas:** ferista nunca alocado em 2 lugares no mesmo período, nem alocado durante as próprias férias.
- **RN-04 — Ferista também tira férias:** as solicitações dele (gozo/agendado, não cancelada) bloqueiam a disponibilidade como qualquer colaborador.
- **RN-05 — Limites de carga:** `max_coberturas_mes` (conta alocações confirmadas com qualquer dia no mês da vaga) e `max_dias_consecutivos` (dias da vaga + coberturas confirmadas adjacentes encadeadas — fim de uma = início da outra −1). Atingiu → não é elegível (força rotação). **Exceção de continuação (decisão da gestão, 25/09/2026): os limites NÃO se aplicam à vaga sequencial no MESMO contrato da cobertura mais recente do ferista (folga ≤ 3 dias)** — ficar meses seguidos cobrindo férias encadeadas no mesmo posto é o ideal operacional, não sobrecarga (ex.: contrato com 4 porteiros saindo um após o outro → o mesmo ferista cobre os 4 meses).
- **RN-06 — Saídas simultâneas do mesmo posto:** são vagas independentes; o lote aloca feristas DIFERENTES (a trava de conflito de datas garante, inclusive entre sugestões da mesma execução).
- **RN-07 — Sequencialidade:** férias do mesmo posto uma após a outra → preferir o MESMO ferista na vaga seguinte se ele estiver livre a tempo (folga ≤ 3 dias). **Na continuação no mesmo contrato, RN-07 vence RN-05** (ver exceção na RN-05).
- **RN-08 — Cobertura crítica:** sem ferista elegível, a vaga aparece no painel vermelho "coberturas críticas" com o motivo (nenhum elegível para a função / todos no limite de carga / todos de férias / conflito de datas) — nunca falha silenciosa.
- **RN-09 — Pré-agendamento anual:** aba Programação mostra a grade contratos × 12 meses (azul = planejamento/gozo; verde = coberto por ferista do mesmo contrato; amarelo = de outro contrato; vermelho = sem cobertura) com KPIs do ano e fill rate (meta **85–92%**: verde ≥ 85, âmbar 70–84, vermelho < 70).
- **RN-10 — Rastreabilidade:** toda alocação grava `origem` ('automatica'/'manual') + `usuario_id`, score e motivo legível.
- **RN-11 — Pedido do colaborador e plano automático (decisão da gestão, 25/09/2026):** o colaborador pode dizer quando quer tirar férias — o RH registra no dialog de programação (checkbox "Pedido do próprio colaborador", coluna `pedido_colaborador`, migration 114). Pedidos têm **prioridade na aprovação** (topo das pendências, com selo) e o plano automático não os altera. **Quem não pede nada (a maioria):** o botão "Gerar plano automático" na aba Programação propõe, para o período escolhido, previsões de todos os ativos cujo limite concessivo vence no período — na ordem **limite mais antigo primeiro** (urgência CLT = melhor para a empresa), **encadeadas por contrato+função** (N cadeias paralelas = `max_simultaneos` do teto RN-01); quem já tem qualquer solicitação no período é pulado; vaga com início dentro do período é proposta mesmo que o fim estoure. As previsões nascem `pendente` (observação "plano automático — <motivo>") e seguem o fluxo normal: aprovação → alocação de ferista.
- **e-Contador (férias em andamento):** funcionário com `afastamentodescricao = 'Férias'` gera/atualiza solicitação origem `'econtador'` (dedup por colaborador + data_início; sem `retorno`, fim = início + 29 dias marcado "fim estimado — confirmar com DP"). **Nunca sobrescreve registros origem 'manual'/'flit'.** O status do colaborador NÃO muda (decisão de 12/08/2026 mantida: férias = status Ativo).
- **Importação Flit:** match do colaborador por CPF → matrícula → nome (CPF só dígitos com zero à esquerda; matrícula sem zeros à esquerda). Reimportar apaga só os registros origem 'flit' dos colaboradores do arquivo e baixa previsões manuais cobertas.

---

## Escalas / Relatórios

- Serão desenvolvidos **após** aprovação nas auditorias de segurança e arquitetura.
- Antes de implementar novos módulos, será feita a **definição do design system** para padronizar a interface.

---

## Decisões de Compliance

### Ocorrências / Prazo de Defesa
- Não haverá prazo formal de defesa no sistema.
- O colaborador pode registrar justificativa no campo existente.
- Empresa comunica sanção e o colaborador assina ou não.

### Assinatura Digital
- O sistema **não** implementa certificado digital próprio.
- Usa assinatura simples (canvas/base64) para registro interno.
- Para valor jurídico pleno, utiliza-se **Youk** ou outra ferramenta externa.

---

*Última atualização: 2026-09-28 (módulo Férias reconstruído — migration 112)*
