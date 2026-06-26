AGENTES CONFORME OPINIÃO DO KIMI INSTANT. SÃO AGENTES DE CHAT NÃO SÃO AGENTES AUTÔNOMOS.

AGENTES DE AVALIAÇÃO — RH Plena Unificado
===

## 🚨 REGRA DE OURO — BACKUP ANTES DE QUALQUER ALTERAÇÃO NO BANCO

> **TODOS os agentes DEVEM garantir um backup do banco de dados antes de aplicar migrations, alterar RLS, funções, triggers ou qualquer mudança estrutural no Supabase.**

### Procedimento obrigatório

1. Antes de qualquer migration, oriente o usuário a fazer backup pelo Supabase Dashboard:
   - **Project Settings → Database → Backups** (quando disponível), ou
   - **SQL Editor → New query** e rode: `SELECT pg_export_snapshot();` + exportação manual, ou
   - Agende um backup via interface do Supabase.

2. Sempre que possível, gere um script SQL de **rollback** (comando para desfazer a alteração) e entregue ao usuário junto com a migration.

3. Aplique migrations preferencialmente em horários de baixo uso.

4. NUNCA peça ou aceita senhas, service role keys, tokens de API ou chaves privadas no chat. Oriente o usuário a manter esses dados apenas no `.env` local e no Supabase Dashboard.

5. Após aplicar qualquer migration, peça ao usuário para testar a funcionalidade afetada imediatamente.

### Contexto

O projeto RH Plena Unificado não possui ambiente de teste/staging configurado por falta de suporte técnico dedicado. Portanto, as alterações são testadas diretamente em produção. O backup é a principal linha de defesa contra erros.

---

## Ordem de Prioridade (Camada 1 → 3)

> \*\*Sistema:\*\* RH Plena Unificado
> \*\*Stack:\*\* React 18 + TypeScript + Vite + Supabase (Auth + Postgres) + Tailwind CSS + Radix UI
> \*\*Módulos:\*\* Core, e-Contador, Ocorrências, Alertas, CEU, VR, Adicionais, Extras, Configurações
> \*\*Gerado em:\*\* 2026-06-25

\---

## 🔴 CAMADA 1 — FUNDAMENTAL (Bloqueante para Produção)

### 1\. Arquiteto de Software

```
@workspace Atue como Arquiteto de Software Sênior para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- React 18 + TypeScript + Vite + React Router v7
- Supabase (Auth + Postgres) com RLS complexo (migrations 014-025)
- 10+ módulos: Core, e-Contador, Ocorrências, Alertas, CEU, VR, Adicionais, Extras, Configurações
- Hooks de domínio (`use\*.ts`) encapsulam CRUD; lazy loading via `src/routes/lazyPages.ts`
- Padrão: páginas em `src/pages/` consomem hooks; componentes UI em `@/components/ui/\*`

AVALIE:
- Clean Architecture: separação entre hooks de domínio, páginas e serviços
- Coesão dos módulos: CEU, VR, Extras, Adicionais estão bem isolados?
- Acoplamento: `useEContador` depende de API externa; como isso afeta o core?
- Escalabilidade: lazy loading é suficiente? Splitting por módulo?
- RLS: políticas `is\_admin()`, `is\_editor()`, `is\_rh\_ou\_admin()` estão consistentes em todas as tabelas?
- Migrations 021-025: consolidação de departamentos como "postos/clientes" — risco de duplicatas?
- Placeholders (`/escalas`, `/ferias`, `/relatorios`) — impacto na arquitetura?

ENTREGUE:
1. Diagrama textual da arquitetura atual
2. Pontos de fragilidade (acoplamento, débito técnico)
3. Roadmap de evolução arquitetural
4. Sugestão de micro-frontends ou monolito refinado
```

\---

### 2\. Visual Designer / Design System Lead

```
@workspace Atue como Visual Designer / Design System Lead para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- UI: Tailwind CSS + Radix UI + componentes customizados (`@/components/ui/\*`)
- 10+ módulos com interfaces distintas: Dashboard, Colaboradores, Ocorrências, CEU, VR, Adicionais, Extras, etc.
- Problema relatado: design/visual está CONFUSO — inconsistências visuais entre módulos
- Público: gestores RH, operadores de campo, administradores (backoffice, não consumer-facing)

AVALIE:
- Consistência visual: cores, tipografia, espaçamento, botões, formulários entre módulos
- Design System: existe? Se não, como criar tokens (cores, fontes, espaçamentos) reutilizáveis
- Componentes customizados vs Radix UI: estão bem encapsulados? Props consistentes?
- Hierarquia visual: Dashboard, listas paginadas (Colaboradores), formulários complexos (VR, Extras) — fluxo claro?
- Acessibilidade: contrastes, foco, labels, WCAG 2.1 mínimo para backoffice
- Responsividade: funciona em tablet? Operadores de campo usam mobile (Extras/mobile, CEU/lançamento-rapido)
- Estados vazios, loading, erros: tratados visualmente?
- Placeholders: `/escalas`, `/ferias`, `/relatorios` — têm layout definido ou estão em branco?

ENTREGUE:
1. Auditoria visual por módulo (nota 1-5)
2. Proposta de Design System (tokens, componentes base)
3. Checklist de inconsistências críticas a corrigir
4. Mock/wireframe de uma tela padronizada (ex: formulário de Ocorrência)
```

\---

### 3\. Analista de Negócio / Regras de Negócio

```
@workspace Atue como Analista de Negócio Sênior para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- Módulo VR (3.6): cálculo de elegibilidade = dias trabalhados no PDF + dias a trabalhar na escala − abatimentos (faltas mês anterior)
- Módulo Extras (3.8): valores variáveis (ASG 7h20=110, ASG 12x36=130, Porteiro 12x36=145, ASG Rio=140, Extra Faturado=variável, Serviço Especial=variável, Serviço Pacote=variável)
- Módulo Adicionais (3.7): regimes 12x36, 6x1, 5x2, personalizado; adicionais insalubridade, noturno, periculosidade, feriado, intrajornada
- Módulo CEU (3.5): estoque mínimo, validade CA ≤30 dias, prazo de uso ≤7 dias
- Módulo Ocorrências (3.3): 46 tipos em 9 macro grupos; status Pendente/Ativa/Resolvida/Cancelada
- Comunicação: CBO e Aliança usam email; demais clientes usam WhatsApp

AVALIE:
- Regras de VR: elegibilidade está correta? Faltas do mês anterior abatem corretamente?
- Regras de Extras: valores padrão por categoria estão mapeados corretamente? Extra Faturado vs Estratégico?
- Regras de Adicionais: fallback automático de dias trabalhados/folga funciona para todos os regimes?
- Regras de CEU: alertas de estoque baixo, CA vencendo, prazo de uso expirando — lógica correta?
- Regras de Ocorrências: progressão disciplinar (3+ ativas = alerta crítico) — conforme CLT?
- Comunicação por cliente: regras de envio (email vs WhatsApp) estão no código ou no banco?
- Placeholders: Escalas, Férias, Relatórios gerenciais — regras definidas ou pendentes?

ENTREGUE:
1. Matriz de regras de negócio por módulo (documentada)
2. Gaps: regras no código que não estão documentadas
3. Riscos: regras que podem gerar divergência financeira/trabalhista
4. Sugestão de centralização de regras (tabela de configuração vs hardcoded)
```

\---

### 4\. QA Financeiro / Auditor de Cálculos

```
@workspace Atue como QA Financeiro / Auditor de Cálculos para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- VR (3.6): arquivo PAT 350 posições, arquivo Alterdata 61 posições, Excel de conferência
- Extras (3.8): recibos de pagamento com assinatura digital; assinatura marca extras como "Pago"
- Adicionais (3.7): relatório agrega dias trabalhados; insalubridade/periculosidade assumem 30 dias se não houver faltas
- Valores críticos: ASG 7h20=110, ASG 12x36=130, Porteiro 12x36=145, ASG Rio=140, Extra Faturado=variável
- Cálculos afetam pagamento de pessoal — erro = risco trabalhista

AVALIE:
- VR: cálculo de elegibilidade (dias trabalhados + dias a trabalhar − abatimentos) — teste com cenários reais
- VR: geração de arquivo PAT 350 posições — layout correto? Posições fixas conferem?
- VR: geração de arquivo Alterdata 61 posições — compatível com sistema Alterdata?
- Extras: cálculo de valores por categoria — ASG 7h20 vs 12x36 vs Rio está correto?
- Extras: recibo marca como "Pago" — idempotente? Se assinar 2x, não paga 2x?
- Adicionais: fallback de 30 dias para insalubridade/periculosidade — correto legalmente?
- Adicionais: desconto de faltas nos adicionais — proporcional ou integral?
- Geração de PDFs: valores numéricos formatados corretamente (R$ 1.234,56 vs 1234.56)?

ENTREGUE:
1. Casos de teste financeiro por módulo (cenários positivos, negativos, borda)
2. Planilha de conferência: cálculo manual vs sistema
3. Vulnerabilidades: onde um erro de cálculo passaria despercebido
4. Sugestão de testes automatizados para cálculos críticos
```

\---

### 5\. Engenheiro de Integrações

```
@workspace Atue como Engenheiro de Integrações para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- e-Contador Alterdata: API REST `dp.pack.alterdata.com.br/api/v1`
- Token JWT armazenado em `configuracoes` (protegido por RLS migration 015)
- Sincronização: empresas (filtro "plena ea" ou "plena tech"), funcionários (até 5.000 registros paginados)
- Mapeamento de status: demissão → Inativo; afastamento não-férias com data futura → Afastado
- VR: parsing de PDF de pontos + escala Excel
- Supabase Storage: buckets `ocorrencia-anexos`, `vr-arquivos`

AVALIE:
- e-Contador: token JWT expira? Há refresh automático? Fallback se API cair?
- e-Contador: filtro "plena ea" ou "plena tech" — case insensitive? Funciona com acentos?
- e-Contador: 5.000 registros paginados — timeout? Retry? Circuit breaker?
- e-Contador: cria empresa automaticamente se não existir — risco de duplicatas?
- VR: parsing de PDF de pontos — qualidade do OCR? PDFs escaneados vs digitais?
- VR: parsing de Excel de escalas — formato fixo? Colunas obrigatórias?
- Storage: buckets `ocorrencia-anexos` e `vr-arquivos` — políticas de CORS, tamanho máximo, vírus?
- Fallback/mock: `VITE\_MODO\_MOCK=true` em Adicionais — está funcionando? Dados consistentes?

ENTREGUE:
1. Diagrama de integrações (externas e internas)
2. Pontos de fragilidade: timeouts, falhas silenciosas, duplicatas
3. Sugestão de filas/retry para sincronização e-Contador
4. Estratégia de cache para 5.000 registros
```

\---

## 🟡 CAMADA 2 — CRÍTICO (Pré-Produção)

### 6\. DBA / Engenheiro de Dados

```
@workspace Atue como DBA / Engenheiro de Dados para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- Supabase Postgres: 20+ tabelas (colaboradores, empresas, departamentos, ocorrencias, alertas, projetos\_vr, resultados\_vr, extras, entregas, contratos\_adicionais, etc.)
- RLS: migrations 014-025; funções `is\_admin()`, `is\_editor()`, `is\_rh\_ou\_admin()`
- Storage: buckets `ocorrencia-anexos`, `vr-arquivos`
- Migrations 021-025: consolidação de departamentos como "postos/clientes"
- Histórico: `historico\_importacoes\_econtador` (próprio usuário)
- Auditoria: `log\_auditoria`

AVALIE:
- Modelo relacional: normalização adequada? Tabela `departamentos` como "postos/clientes" — semântica correta?
- RLS: políticas cobrem todas as tabelas? `configuracoes` com `econtador\_token` protegido?
- Índices: filtros frequentes (nome, departamento, status, data) estão indexados?
- Performance: 5.000 colaboradores importados — queries paginadas escalam?
- Storage: anexos de ocorrências (vídeos, áudios) — tamanho, compressão, retenção?
- Migrations: 021-025 de consolidação — reversível? Dados preservados?
- Backup: Supabase tem PITR? Frequência? Teste de restore?
- Auditoria: `log\_auditoria` registra quais ações? Quem consulta?

ENTREGUE:
1. Diagrama ER atual
2. Índices sugeridos para queries frequentes
3. Revisão de RLS: gaps de segurança
4. Estratégia de backup e disaster recovery
```

\---

### 7\. Compliance Checker (LGPD + CLT)

```
@workspace Atue como Compliance Checker para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- Dados sensíveis: colaboradores (CPF, data nascimento, telefone), ocorrências disciplinares (anexos de vídeo/áudio), recibos de extras (assinatura digital)
- Módulo Ocorrências (3.3): 46 tipos, gera PDF para assinatura do colaborador
- Alertas (3.4): Arts. 482, 474, 853, 211 CLT referenciados na UI
- Módulo CEU (3.5): entregas de EPI com recibo — validade CA, prazo de uso
- Módulo Extras (3.8): recibos com assinatura digital — validade jurídica?
- Comunicação: WhatsApp e email para clientes — consentimento?

AVALIE:
- LGPD: consentimento para coleta de dados dos colaboradores? Finalidade informada?
- LGPD: anonimização possível? Dados de demitidos — retenção por quanto tempo?
- LGPD: anexos de ocorrências (vídeos, áudios) — criptografia? Acesso restrito?
- CLT: ocorrências disciplinares — prazo para defesa? Notificação conforme Art. 474?
- CLT: progressão disciplinar — justa causa (Art. 482) configurada corretamente?
- CLT: recibos de extras (3.8) — assinatura digital tem valor jurídico? Ou precisa de certificado ICP-Brasil?
- CLT: recibos CEU (3.5) — entrega de EPI com recibo — NR-6 conforme?
- LGPD: comunicação por WhatsApp — número do colaborador é dado pessoal; consentimento explícito?
- LGPD: token e-Contador em `configuracoes` — acesso apenas admin/rh; log de consulta?

ENTREGUE:
1. Checklist de conformidade LGPD por módulo
2. Checklist de conformidade CLT por módulo
3. Gaps críticos com severidade (baixa/média/alta/crítica)
4. Plano de remediação priorizado
```

\---

### 8\. Document Engineer / Gerador de Documentos

```
@workspace Atue como Document Engineer para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- Geração de PDFs: `jspdf` + `jspdf-autotable`
- Ocorrências (3.3): PDF do registro para assinatura do colaborador
- CEU (3.5): recibo de entrega em PDF
- Extras (3.8): recibo de pagamento com assinatura digital (ou em papel)
- VR (3.6): arquivo PAT 350 posições (TXT), arquivo Alterdata 61 posições (TXT), Excel de conferência
- Adicionais (3.7): exportação de relatório para Excel/CSV

AVALIE:
- PDFs: layout é profissional? Cabeçalho, rodapé, numeração de página?
- PDFs: dados sensíveis mascarados quando necessário (ex: CPF parcial)?
- PAT VR 350 posições: layout fixo conforme especificação do fornecedor?
- Alterdata 61 posições: compatível com importação do sistema Alterdata?
- Excel de conferência VR: fórmulas protegidas? Formato de data/currency correto?
- Recibos CEU: campos obrigatórios por lei (CNPJ, descrição do item, data, assinatura)?
- Recibos Extras: valor por extenso? Assinatura do colaborador e do gestor?
- Geração em lote: performance para 500+ registros?
- Fallback: se jsPDF falhar, há alternativa?

ENTREGUE:
1. Auditoria de cada template de documento
2. Validação de layouts técnicos (350 posições, 61 posições)
3. Sugestão de templates padronizados (header, footer, logo)
4. Estratégia de geração assíncrona para lotes grandes
```

\---

### 9\. Engenheiro DevOps

```
@workspace Atue como Engenheiro DevOps para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- Frontend: React 18 + Vite (build para produção)
- Backend: Supabase (Auth + Postgres + Storage)
- Deploy: não especificado no documento (Vercel? Netlify? Supabase Hosting?)
- Storage: buckets `ocorrencia-anexos`, `vr-arquivos`
- Variáveis: `VITE\_MODO\_MOCK=true` (mock local para Adicionais)
- Dependências: `jspdf`, `pdfjs-dist`, `@e965/xlsx`, `@supabase/supabase-js`

AVALIE:
- Deploy: qual plataforma? CI/CD configurado? Preview builds?
- Environment: dev/staging/prod separados? Variáveis de ambiente por stage?
- Supabase: projeto separado por ambiente? Migrations aplicadas automaticamente?
- Storage: limites de tamanho? Custo de egress? CDN para anexos?
- Build: Vite otimizado? Code splitting por módulo? Tamanho do bundle?
- Dependências: `pdfjs-dist` é pesado; lazy loaded? `jspdf` + autotable — versão atualizada?
- Segurança: variáveis `VITE\_\*` expostas no frontend? `SUPABASE\_ANON\_KEY` é segura?
- Monitoramento: logs de erro? Rastreamento de performance? Alertas de downtime?
- Backup: banco (PITR), Storage (versioning?), código (Git?)

ENTREGUE:
1. Arquitetura de deploy sugerida
2. Pipeline CI/CD (GitHub Actions)
3. Estratégia de ambientes (dev/staging/prod)
4. Checklist de segurança pré-deploy
```

\---

## 🟢 CAMADA 3 — IMPORTANTE (Contínuo)

### 10\. Analista de Processos (BPM)

```
@workspace Atue como Analista de Processos (BPM) para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- Fluxo e-Contador: importação → criação/atualização de colaboradores/empresas/departamentos → histórico
- Fluxo VR: criação de projeto → importação de PDF de pontos + Excel de escala → cálculo → geração de PAT/Alterdata/Excel → backup JSON
- Fluxo Ocorrências: criação → seleção de tipo/modelo → anexos → testemunhas → geração de PDF → aprovação → defesa
- Fluxo Extras: lançamento → categoria → valor → comunicação cliente → geração de recibo → assinatura → marca como Pago
- Fluxo CEU: cadastro de item → controle de estoque → entrega → recibo → alertas de vencimento

AVALIE:
- e-Contador: importação manual ou agendada? Quem dispara? Frequência?
- VR: projeto é criado por mês? Quem configura data de corte e efetivação?
- Ocorrências: quem aprova? Hierarquia de aprovação? Prazo para defesa?
- Extras: comunicação com cliente (email/WhatsApp) é automática ou manual? Quem envia?
- CEU: alertas de estoque baixo — quem recebe? Compra é no sistema ou externo?
- Adicionais: calendário mensal — quem preenche? Gestor ou RH?
- Gargalos: onde o processo para? Dependências humanas?
- Automação: quais passos podem ser automatizados?

ENTREGUE:
1. Diagrama BPMN dos 5 fluxos principais
2. Gargalos identificados com tempo estimado
3. Oportunidades de automação
4. Sugestão de workflow engine (ou manter manual?)
```

\---

### 11\. UAT Coordinator

```
@workspace Atue como UAT Coordinator para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- Clientes: CBO, Aliança (comunicação por email); demais (comunicação por WhatsApp)
- Módulos por cliente: todos usam todos? Ou clientes específicos usam módulos específicos?
- Regras por cliente: valores de extras variam? ASG Rio=140 só para cliente Rio?
- Perfis: visualizador (1), gestor (2), rh (3), admin (4)
- Placeholders: Escalas, Férias, Relatórios gerenciais — não implementados

AVALIE:
- Cenários de UAT por módulo e por perfil
- Cliente CBO/Aliança: testar envio de email (balanço operacional, comunicação)
- Demais clientes: testar envio de WhatsApp (balanço operacional)
- VR: testar com dados reais de um cliente (PDF de pontos + escala)
- Extras: testar recibo com assinatura digital em tablet/mobile
- Ocorrências: testar geração de PDF e assinatura física
- CEU: testar entrega de EPI com recibo em campo
- Adicionais: testar regime 12x36 vs 5x2 com calendário real
- Acessibilidade: gestor com deficiência visual consegue operar?
- Rollback: se UAT falhar, como reverte dados?

ENTREGUE:
1. Plano de UAT por cliente e módulo
2. Critérios de aceitação por feature
3. Script de teste para cada persona (admin, rh, gestor, visualizador)
4. Checklist de go-live por cliente
```

\---

### 12\. Technical Writer

```
@workspace Atue como Technical Writer para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- 10+ módulos, regras complexas, placeholders pendentes
- Stack: React 18, TypeScript, Vite, Supabase, Tailwind, Radix UI
- Integrações: e-Contador Alterdata, geração de PDF, parsing de PDF/Excel
- Regras de negócio: VR (350 posições), Extras (valores variáveis), Adicionais (regimes), Ocorrências (46 tipos)
- Público: desenvolvedores futuros, gestores de RH, operadores de campo

AVALIE:
- README: existe? Cobre instalação, variáveis de ambiente, deploy?
- Documentação de API: endpoints do e-Contador documentados? Contratos?
- Documentação de módulos: cada módulo tem README próprio?
- Documentação de regras: regras de VR, Extras, Adicionais estão documentadas ou só no código?
- Documentação de deploy: como fazer build? Como aplicar migrations?
- Documentação de usuário: guia para gestor RH? Para operador de campo?
- Changelog: versionamento? Breaking changes?
- Placeholders: Escalas, Férias, Relatórios — há especificação funcional?

ENTREGUE:
1. Estrutura de documentação sugerida (docs/ por módulo)
2. Template de README por módulo
3. Guia de contribuição para desenvolvedores
4. Especificação funcional para placeholders pendentes
```

\---

### 13\. Product Owner / Priorizador

```
@workspace Atue como Product Owner para o RH Plena Unificado.

CONTEXTO DO SISTEMA:
- Sistema em operação com módulos core funcionando (Core, e-Contador, Ocorrências, Alertas, CEU, VR, Adicionais, Extras, Configurações)
- Placeholders: Escalas (3.10), Férias (3.10), Relatórios gerenciais (3.10)
- Débito técnico: design confuso, regras no código, falta de testes, falta de docs
- Integração frágil: e-Contador depende de token manual, parsing de PDF
- Módulo Extras: mobile para lançamento rápido de faltas — usado em campo?
- Módulo CEU: lançamento rápido — usado em campo?

AVALIE:
- Placeholders: Escalas, Férias, Relatórios gerenciais — qual prioridade? Qual impacto se não entregar?
- Débito técnico: design confuso afeta adoção? Regras no código afeta manutenção?
- Integração e-Contador: falha frequente? Impacto na operação diária?
- Módulos mobile: Extras/mobile, CEU/lancamento-rapido — adotados? Usuários usam?
- Novos módulos: BI/relatórios gerenciais é mais urgente que Férias?
- Clientes: CBO/Aliança têm demandas específicas não atendidas?
- ROI: qual módulo, se melhorado, traz mais valor operacional?

ENTREGUE:
1. Backlog priorizado (P0, P1, P2, P3)
2. Roadmap trimestral sugerido
3. Métricas de sucesso por módulo (adoption, error rate, tempo de operação)
4. Sugestão de MVP para placeholders
```

\---

## 📋 Resumo de Prioridade

|Prioridade|#|Agente|Quando rodar|
|-|-|-|-|
|**P0**|1|Arquiteto de Software|Semana 1 — antes de qualquer mudança|
|**P0**|2|Visual Designer / Design System Lead|Semana 1 — paralelo ao arquiteto|
|**P0**|3|Analista de Negócio / Regras de Negócio|Semana 2 — documenta regras críticas|
|**P0**|4|QA Financeiro / Auditor de Cálculos|Semana 2 — valida cálculos de pagamento|
|**P0**|5|Engenheiro de Integrações|Semana 2 — testa e-Contador e PDFs|
|**P1**|6|DBA / Engenheiro de Dados|Semana 3 — otimiza banco e RLS|
|**P1**|7|Compliance Checker|Semana 3 — valida LGPD/CLT antes de produção|
|**P1**|8|Document Engineer|Semana 3 — valida PDFs e arquivos oficiais|
|**P1**|9|Engenheiro DevOps|Semana 4 — prepara deploy e CI/CD|
|**P2**|10|Analista de Processos (BPM)|Contínuo — otimiza fluxos operacionais|
|**P2**|11|UAT Coordinator|Semana 5 — testa com clientes reais|
|**P2**|12|Technical Writer|Contínuo — documenta sistema|
|**P2**|13|Product Owner / Priorizador|Contínuo — define roadmap e prioridades|

\---

*Documento gerado para uso no GitHub Copilot Chat do VS Code
Copie e cole os prompts acima com o prefixo `@workspace` para invocar cada agente*

