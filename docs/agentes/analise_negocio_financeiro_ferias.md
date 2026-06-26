# Análise de Negócio — Módulo de Gestão de Férias e Alocação de Feristas (CORH)

**Data:** 2026-06-25  
**Objetivo:** avaliar o problema, as regras de negócio, o impacto financeiro, os KPIs, o MVP e os riscos do novo módulo de Férias/Feristas.  
**Base de análise:** contexto do CORH + premissas de RH terceirizado (pendente de validação com briefing oficial).

---

## 1. Resumo do problema e da oportunidade de valor

### Problema atual (hipóteses a confirmar)
- **Férias são planejadas de forma reativa**, muitas vezes já próximo ao vencimento do período aquisitivo, dificultando a cobertura dos postos.
- **Substituições improvisadas** geram horas-extras, pagamento de adicionais não previstos e risco de postos descobertos para o cliente.
- **Falta de visibilidade** sobre quem está de férias, quando volta e qual é o custo real do ferista que o substitui.
- **Risco trabalhista e fiscal:** férias vencidas (acúmulo de mais de 12 meses sem gozo) sujeitam a multas, dobro do período e problemas na homologação.
- **Comunicação tardia com clientes:** o cliente só é informado da troca no dia, gerando insatisfação e quebra de SLA.

### Oportunidade de valor
- **Centralizar** planejamento de férias e alocação de feristas dentro do CORH, eliminando planilhas paralelas.
- **Antecipar a cobertura**, reduzindo horas-extras e pagamento de “quebra de escala”.
- **Evitar passivos trabalhistas** com alertas de férias a vencer e controle do limite legal.
- **Medir o custo real da substituição** (ferista vs. colaborador titular, custo por posto/cliente).
- **Melhorar o fill rate** operacional e a confiabilidade junto aos clientes.

---

## 2. Regras de negócio críticas que precisam de validação com o RH

### CLT / Compliance
1. A empresa segue a regra de que as férias devem ser concedidas dentro de **12 meses** após a aquisição do direito? E como tratar férias vencidas históricas?
2. É permitido vender 1/3 dos dias de férias (pecúni)? O módulo precisa calcular isso automaticamente?
3. As férias podem ser fracionadas em **até 3 períodos**? Existe regra interna de período mínimo (ex.: 5 dias)?
4. Como tratar **férias coletivas**, férias durante aviso prévio e férias de gestantes?
5. Quem é o responsável legal por aprovar o calendário de férias (RH, gestor de operações, cliente)?

### Processo de planejamento
6. Qual é o **prazo mínimo de antecedência** ideal para marcar férias (30/45/60 dias)?
7. As férias são negociadas primeiro com o colaborador, depois com o cliente, ou o cliente impõe datas?
8. Existe um **calendário de sazonalidade** (ex.: não pode tirar férias em determinados meses por causa do cliente)?
9. Como lidar com **férias canceladas ou adiadas** por força maior? Quem pode fazer isso no sistema?

### Alocação de feristas
10. Os feristas são funcionários da Plena (temporários) ou de uma agência/terceirizada?
11. Um ferista pode ser **compartilhado entre postos/clientes** ou é dedicado a um único posto?
12. Qual é a regra de **prioridade de alocação**: primeiro ferista já treinado no posto, primeiro disponível, menor custo, proximidade geográfica?
13. O ferista precisa ter as mesmas **certificações/ASO/EPI** do colaborador titular? Como o sistema valida isso?
14. Existe limite de dias consecutivos que um ferista pode ocupar o mesmo posto (risco de vínculo empregatício)?

### Financeiro / Contratual
15. O custo do ferista é repassado integralmente ao cliente (mark-up) ou absorvido pela operação?
16. Como calcular o **custo-hora do ferista**: salário + encargos + taxa da agência + transporte + EPI?
17. O cliente paga pelo posto coberto ou pelo colaborador? Se o ferista custa mais, quem absorve a diferença?
18. Existem **SLAs contratuais** de cobertura (ex.: posto descoberto por mais de X horas gera multa)?

### Integração / Dados
19. As informações de férias virão do **e-Contador/Alterdata** ou serão lançadas manualmente no CORH?
20. O status de “férias” já é importado corretamente hoje pela integração? (A auditoria indica problemas no mapeamento de afastamentos/férias.)
21. Qual é a fonte oficial da lista de feristas disponíveis?

---

## 3. Análise financeira

### Onde há economia de valor
| Fonte de economia | Estimativa / Mecanismo |
|---|---|
| **Redução de horas-extras** | Evitar que colaboradores do próprio quadro façam substituição em sobreaviso; economia direta no valor da hora-extra + adicional noturno/fins de semana. |
| **Evitar multas trabalhistas** | Férias vencidas podem gerar pagamento em dobro, multas e indenizações. Alertas automáticos reduzem o passivo. |
| **Otimização de feristas** | Alocar o ferista certo no posto certo reduz turnover de temporários e custo de agenciamento (taxas de reposição). |
| **Menos postos descobertos** | Cumprir SLA evita multas contratuais e perda de clientes. |
| **Visibilidade de custo** | Permite renegociar preços com clientes onde a substituição é recorrente e cara. |

### Onde há custo
| Tipo de custo | Observação |
|---|---|
| **Desenvolvimento do módulo** | Front, back, banco, testes, integração com e-Contador. |
| **Mão de obra de feristas** | Mesmo com otimização, o custo do temporário pode ser maior que o do titular; o módulo não elimina o custo, apenas o torna visível. |
| **Treinamento / change management** | Operadores de mesa, inspetores e DP precisam adotar o fluxo. |
| **Manutenção e compliance** | Regras da CLT mudam; o módulo precisa de atualizações periódicas e auditoria. |
| **Infra / suporte** | Novas tabelas, políticas de RLS, possível Edge Function para cálculos sensíveis. |

### Riscos de implementação
- **ROI incerto:** se a operação já controla férias em planilhas e o volume de feristas é baixo, o ganho pode não compensar o investimento.
- **Dados inconsistentes:** se a integração e-Contador continuar frágil, o módulo operará com dados errados (ex.: colaborador marcado como ativo quando está de férias).
- **Regras complexas:** fracionamento, pecúni, férias coletivas e afastamentos podem aumentar muito o escopo.
- **Dependência de outros módulos:** Escalas e Relatórios gerenciais ainda são placeholders; sem eles, o módulo de férias terá valor limitado.

---

## 4. KPIs e métricas essenciais para o dashboard (além do fill rate)

| KPI | Definição | Por que importa |
|---|---|---|
| **Taxa de cobertura de férias** | % de férias planejadas que tiveram ferista alocado com antecedência ≥ X dias. | Mede a eficácia do planejamento. |
| **Fill rate por cliente/posto** | % de postos efetivamente ocupados durante o período de férias. | Impacta diretamente o SLA. |
| **Férias vencidas / em risco** | Nº de colaboradores com férias não agendadas a menos de 60/30 dias do vencimento. | Risco trabalhista e financeiro. |
| **Tempo médio de alocação** | Dias entre a solicitação de férias e a confirmação do ferista. | Agilidade operacional. |
| **Custo médio de substituição** | Custo total do ferista / dias cobertos, por posto e cliente. | Base para precificação e negociação. |
| **Variação de custo (ferista vs. titular)** | % de diferença entre custo do ferista e custo do colaborador titular. | Identifica clientes/posts deficitários. |
| **Horas-extras evitadas** | Comparação de horas-extras de cobertura antes e depois do módulo. | Economia tangível. |
| **Taxa de ausência do ferista** | % de dias em que o ferista não compareceu após alocação. | Qualidade da operação. |
| **Satisfação do cliente** | Nº de reclamações relacionadas a substituição/troca de posto. | Indicador de experiência. |
| **SLA de comunicação** | % de substituições comunicadas ao cliente dentro do prazo contratual. | Conformidade contratual. |
| **Tempo de retorno ao posto** | Dias entre o fim das férias e o colaborador titular reassumir o posto. | Garante continuidade. |

---

## 5. Sugestões de simplificação do MVP

Para entregar valor mais rápido e reduzir risco, a primeira versão do módulo pode **não incluir**:

1. **Cálculos automáticos de 1/3 férias e pecúni** — deixar para o payroll/e-Contador; no CORH, apenas registrar os dias.
2. **Otimização inteligente de alocação (IA/heurística complexa)** — no MVP, a alocação é manual com filtros e ordenação simples.
3. **Férias fracionadas e coletivas** — atender primeiro o cenário mais comum: férias de 30 dias ou bloco único.
4. **Portal do cliente** — a comunicação pode sair por e-mail/WhatsApp manualmente, integrado depois.
5. **Mobile para o ferista** — no MVP, o acompanhamento é feito pela mesa/DP.
6. **Integração bidirecional com e-Contador** — importar apenas o saldo de férias e o status de afastamento; não escrever de volta.
7. **Relatórios avançados e BI** — priorizar dashboard operacional simples; relatórios gerenciais vêm após o módulo de Relatórios (placeholder hoje).
8. **Controle de custo total do ferista** — no MVP, registrar apenas o valor pago ao ferista/agência; encargos detalhados entram depois.

### O que o MVP deve ter
- Cadastro/visualização de período aquisitivo e dias de férias por colaborador.
- Calendário de férias com filtros por cliente/posto.
- Cadastro de feristas e indicação de disponibilidade.
- Tela de alocação manual do ferista ao posto liberado.
- Alertas de férias a vencer (30/60 dias).
- Dashboard com fill rate, cobertura de férias e férias vencidas/em risco.
- Logs de auditoria das alocações.

---

## 6. Riscos operacionais e como mitigar

| Risco | Impacto | Mitigação sugerida |
|---|---|---|
| **Dados errados vindos do e-Contador** | Alocação baseada em status/desligamento incorreto. | Validar status de férias/afastamento; permitir correção manual com trilha de auditoria; tratar a integração como “sugestão”. |
| **Non compliance com a CLT** | Férias vencidas, fracionamento irregular, pagamento errado. | Revisar regras com departamento jurídico/DP; implementar alertas automáticos; nunca automatizar decisões sem aprovação humana. |
| **Alocação duplicada do ferista** | Dois postos reservam o mesmo ferista. | Controle de concorrência no banco (unique constraints/transações); indicar visualmente ocupação no calendário. |
| **Última hora: ferista falta** | Posto descoberto e cliente insatisfeito. | Lista de reserva/stand-by; notificação push/e-mail para operadores; fallback para hora-extra autorizada. |
| **Resistência dos usuários** | Placas seguem usando planilhas; sistema subutilizado. | Treinamento curto e contextual; manter planilha de contingência até adoção ≥ 80%. |
| **Vazamento de dados de feristas/colaboradores** | Problemas LGPD. | Aplicar RLS corretamente (as auditorias apontam falhas críticas hoje); registrar consentimento; limitar acesso por perfil. |
| **Escopo crescer demais** | MVP vira projeto de 6 meses. | Congelar regras no início da sprint; priorizar cenário “férias de 30 dias”; revisar após 30 dias de uso. |
| **Indisponibilidade do sistema** | Não consegue alocar ferista. | Manter planilha de contingência; exportar calendário de férias em Excel/CSV semanalmente. |

---

## Recomendação estratégica imediata

Antes de iniciar o desenvolvimento do módulo de Férias/Feristas, **fortalecer as bases do CORH**:
1. **Corrigir as falhas críticas de segurança e RLS** apontadas nas auditorias — o módulo lidará com dados pessoais e financeiros sensíveis.
2. **Estabilizar a integração com e-Contador** — dados de férias/afastamentos precisam ser confiáveis.
3. **Definir um MVP enxuto** com as regras da seção 5 e só expandir após validação operacional.
4. **Realizar uma reunião de validação** com RH, Operações, Jurídico e Financeiro usando as perguntas da seção 2.

---

**Próximo passo sugerido:**  
