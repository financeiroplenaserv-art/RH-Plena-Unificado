# Checklist de Correções Críticas — RH Plena Unificado

> **Iniciado em:** 2026-06-25  
> **Responsável:** Kimi Code CLI  
> **Objetivo:** aplicar correções críticas identificadas nas auditorias de segurança, cálculos financeiros, integração e-Contador, compliance e arquitetura.

---

## ⚠️ Regra de Ouro

- **Nunca commitar código quebrado.**
- **Sempre testar build (`npm run build`) após alterações.**
- **Sempre documentar no final do dia o que foi feito e o que falta.**
- **Se o sistema "cair" ou a sessão for interrompida, outro agente deve conseguir continuar lendo este arquivo.**

---

## 📋 Correções por Área

### 1. SEGURANÇA E RLS

| # | Correção | Status | Arquivos | Observações |
|---|----------|--------|----------|-------------|
| 1.1 | Corrigir criação automática de admin em `useAuth.ts` | ✅ Feito | `src/hooks/useAuth.ts` | Novo usuário agora é `visualizador` por padrão. Apenas fluxo de primeiro acesso passa `admin`. Futuro: integrar com sistema de permissões granular. |
| 1.2 | Proteger rota `/importar/econtador` com `ProtectedRoute` | 🟡 Revisar | `src/App.tsx` | Atualmente apenas `admin` ou `rh` acessam. Cliente deseja permissões granulares: inspetores podem lançar extras mas NÃO acessar e-Contador. |
| 1.3 | Fechar RLS de `extras`, `categorias_extras`, `recibos_extras` | ✅ Feito | `supabase/migrations/027_rls_extras_e_recibos.sql` | Regras `is_admin`, `is_editor`, SELECT para autenticados. |
| 1.4 | Proteger/mover token do e-Contador | ✅ Feito | `supabase/functions/econtador/index.ts`, `supabase/migrations/030_criptografar_token_econtador.sql`, `src/services/econtadorApi.ts`, `.env.example` | Edge Function deployada. Token criptografado com AES-256-GCM. `VITE_USAR_EDGE_FUNCTION_ECONTADOR=true` ativado. Migration 030 aplicada. |
| 1.5 | Isolar storage buckets por contexto | 🟡 Parcial | `supabase/migrations/035_isolar_storage_buckets.sql` | Buckets privados. SELECT/INSERT/UPDATE restritos a editores. DELETE apenas admin. Isolamento por contexto específico (ex: só anexos de ocorrências que o usuário pode ver) ainda pendente. |
| 1.6 | Remover SELECT irrestrito em dados sensíveis | ✅ Feito | `supabase/migrations/034_restringir_select_dados_sensiveis.sql` | `visualizador` não lê mais `perfis`, `configuracoes`, `log_auditoria` e `auditoria`. `is_editor` atualizado com novos perfis. |
| 1.7 | Proteger primeiro acesso (contagem pública de perfis) | ✅ Feito | `src/App.tsx`, `.env.example` | Consulta pública só ocorre se `VITE_PERMITIR_PRIMEIRO_ACESSO=true`. Em produção deve ser `false`. |
| 1.8 | Implementar auditoria automática no banco | ✅ Feito | `supabase/migrations/029_auditoria_automatica.sql` | Triggers em `ocorrencias`, `colaboradores`, `extras`, `recibos_extras`, `projetos_vr`, `resultados_vr`. |
| 1.9 | Mascarar dados sensíveis em exportações | ✅ Feito | `src/lib/utils.ts`, `src/pages/ImportarEContadorPage.tsx` | CPF mascarado em CSV/Excel de funcionários. PDFs de recibos/ocorrências ainda exibem CPF — revisar. |
| 1.10 | Adicionar proteções de login (rate limiting, captcha) | ⏳ Pendente | `src/pages/LoginPage.tsx`, `src/lib/auth.ts` | Não crítico para MVP, mas importante. |

### 2. CÁLCULOS FINANCEIROS

| # | Correção | Status | Arquivos | Observações |
|---|----------|--------|----------|-------------|
| 2.1 | Corrigir parser de ponto dos adicionais | ✅ Feito | `src/lib/vr/pdfExtractor.ts`, `src/lib/adicionais/importarPonto.ts` | `useSystemFonts: true` no Node.js e regex flexível para PDFs com data/conteúdo em linhas separadas. Teste passando. |
| 2.2 | Revisar fórmula de elegibilidade VR | ✅ Revertido | `src/lib/vr/calculoVR.ts` | Regra original restaurada (`diasPdf + diasEscala - diasAbatimento`). Não deve ser alterada sem consulta. |
| 2.3 | Remover hardcode de 30 dias em insalubridade/periculosidade | ✅ Revertido | `src/pages/adicionais/AdicionaisRelatorioPage.tsx` | Regra original restaurada (`30 - faltas`). Escala 12×36 recebe adicional cheio. Não deve ser alterada sem consulta. |
| 2.4 | Validar CPF ao gerar arquivo PAT | ✅ Feito | `src/lib/utils.ts`, `src/lib/vr/calculoVR.ts` | Criada função `validarCPF` com dígitos verificadores. PAT pula colaboradores com CPF inválido. |
| 2.5 | Impedir marcação de “Pago” sem recibo assinado | ✅ Feito | `src/pages/extras/ExtrasRecibosPage.tsx` | Botão agora exige recibo com `status='assinado'` no período. |
| 2.11 | Corrigir erro de tipo no CPF do e-Contador | ✅ Feito | `src/lib/utils.ts`, `src/mappers/econtadorMapper.ts` | CPF vindo como número causava `t.replace is not a function`. Convertido para string antes de formatar. |
| 2.12 | Permitir importar somente colaboradores selecionados | ✅ Feito | `src/pages/ImportarEContadorPage.tsx` | Checkboxes adicionados na tabela. Botão mostra quantos serão importados. |
| 2.13 | Mostrar detalhes dos erros na importação | ✅ Feito | `src/hooks/useEContador.ts`, `src/pages/ImportarEContadorPage.tsx`, `supabase/migrations/031_historico_importacao_detalhes_erros.sql` | Erros salvos no histórico e exibidos com nome do colaborador + mensagem. |
| 2.6 | Corrigir data de pagamento nos recibos | ✅ Feito | `src/lib/extrasRecibos.ts`, `src/hooks/useExtrasRecibos.ts`, `src/pages/extras/ExtrasRecibosPage.tsx` | Recibo passa a usar `data_assinatura` como data de recebimento/pagamento; emissão em papel registra data de assinatura no recibo. |
| 2.7 | Tornar CNPJ da empresa configurável nos recibos | ✅ Feito | `src/lib/extrasRecibos.ts`, `src/pages/extras/ExtrasRecibosPage.tsx` | CNPJ vem do cadastro da empresa (`empresas.cnpj`); hardcodes de Plena EA/Plena Tech removidos. Fallback `[CNPJ]` quando não informado. |
| 2.8 | Melhorar matching de colaboradores no VR | ✅ Feito | `src/lib/vr/calculoVR.ts`, `src/types/vr.ts`, `src/lib/vr/calculoVR.test.ts` | Matching seguro: CPF > nome exato > palavras (1º+2º nome) > similaridade Levenshtein (threshold 0.85). Substring pura removida. Campo `matchTipo` adicionado para rastreabilidade. |
| 2.9 | Remoção de colaboradores com 0 dias no VR | ✅ Feito (decisão: não persistir) | `src/pages/vr/VrProjetoDetailPage.tsx` | Decidido com o cliente não persistir a remoção automaticamente, pois 0 dias pode significar férias/afastamento. Adicionados avisos claros no modal e na tela. |
| 2.10 | Adicionar testes unitários para cálculos | 🟡 Em andamento | `src/lib/**/*.test.ts` | Testes criados para `utils`, `importarPonto` e `calculoVR` (11 testes passando). |

### 3. INTEGRAÇÃO E-CONTADOR

| # | Correção | Status | Arquivos | Observações |
|---|----------|--------|----------|-------------|
| 3.1 | Mover chamadas e-Contador para Edge Function | ✅ Feito | `supabase/functions/econtador/index.ts` | Front nunca vê o token. Deploy realizado no projeto Supabase. |
| 3.2 | Criptografar token no banco | ✅ Feito | `supabase/migrations/030_criptografar_token_econtador.sql`, `supabase/functions/econtador/index.ts` | Criptografia AES-256-GCM com `valor_cifrado`, `iv` e `tag`. |
| 3.3 | Adicionar timeout e retry nas requisições | ✅ Feito | `src/services/econtadorApi.ts` | Timeout de 15s adicionado. Retry ainda pendente. |
| 3.4 | Implementar importação em lotes | ⏳ Pendente | Edge Function / hook | 100-200 registros por vez. |
| 3.5 | Adicionar constraints de unicidade | 🟡 Parcial | `supabase/migrations/033_matricula_unica_por_empresa.sql` | Matrícula agora é única por empresa (ajuste necessário por causa das duas empresas no e-Contador). Outras constraints pendentes. |
| 3.6 | Validar token antes de salvar | ✅ Feito | `src/pages/ConfiguracoesPage.tsx` | Testa chamada à API antes de persistir. |
| 3.7 | Melhorar matching de departamentos | ✅ Feito | `src/hooks/useEContador.ts` | Sincronização busca match exato e depois por `nome_curto` contido no nome do e-Contador, vinculando ao departamento manual correto. |

### 4. COMPLIANCE LGPD/CLT

| # | Correção | Status | Arquivos | Observações |
|---|----------|--------|----------|-------------|
| 4.1 | Implementar consentimento LGPD | ✅ Feito | `supabase/migrations/036_consentimento_lgpd.sql`, `src/pages/ConsentimentoLGPDPage.tsx`, `src/hooks/useAuth.ts`, `src/App.tsx` | Tela de termos após login; versionamento no banco; RLS ajustada para perfil próprio. |
| 4.2 | Definir política de retenção de dados | ✅ Feito | `docs/POLITICA_RETENCAO_DADOS.md` | Prazos de guarda e descarte documentados. Implementação automatizada futura. |
| 4.3 | Garantir prazo de defesa em ocorrências | ⚪ N/A | `src/pages/rh/OcorrenciaFormPage.tsx`, `OcorrenciaDetailPage.tsx` | Processo interno não prevê prazo formal; colaborador é ouvido e ocorrência encerrada no ato. |
| 4.4 | Completar recibos de EPI | ✅ Feito | `src/lib/ceuRecibos.ts` | Template já contém CNPJ, item, CA, data, identificação e assinatura. |
| 4.5 | Revisar assinatura digital dos recibos | ✅ Feito | `src/lib/extrasRecibos.ts` | Assinatura realizada externamente via Youk. Não é necessário implementar assinatura própria. |
| 4.6 | Registrar consentimento para comunicação | ⏳ Pendente | `src/pages/extras/ExtrasBalancoPage.tsx` | WhatsApp/email. Verificar necessidade com cliente. |

### 5. ARQUITETURA E CÓDIGO

| # | Correção | Status | Arquivos | Observações |
|---|----------|--------|----------|-------------|
| 5.1 | Criar camada de serviço/repositório | ⏳ Futuro | `src/services/` | Isolar chamadas ao Supabase. |
| 5.2 | Consolidar componentes de UI | ⏳ Futuro | `src/components/ui/`, wrappers | Unificar botões/cards por módulo. |
| 5.3 | Remover mock data do bundle de produção | ⏳ Pendente | `src/components/ceu/mockData.ts`, `useAdicionaisContratuais.ts` | Dynamic import em dev apenas. |
| 5.4 | Centralizar catálogos estáticos | ⏳ Futuro | `src/constants/` ou tabelas | Tipos de ocorrência, turnos, motivos. |
| 5.5 | Configurar Vitest + React Testing Library | ✅ Feito | `package.json`, `vitest.config.ts`, `src/test/setup.ts` | Vitest v4.1.9 configurado com jsdom, React Testing Library e jest-dom. |
| 5.6 | Versionar schema inicial do banco | 🟡 Parcial | `supabase/migrations/028_create_projetos_vr_resultados_vr.sql` | Criadas tabelas `projetos_vr` e `resultados_vr`. Outras tabelas principais ainda sem CREATE TABLE versionado. |

---

## 📝 Log de Execução

### 2026-06-25
- [x] Criado checklist inicial.
- [x] Corrigido `useAuth.ts` para não criar admin automaticamente.
- [x] Protegida rota `/importar/econtador`.
- [x] Criada migration `027_rls_extras_e_recibos.sql` fechando RLS das tabelas financeiras.
- [x] Adicionado timeout e validação de token do e-Contador.
- [x] Protegido primeiro acesso com variável `VITE_PERMITIR_PRIMEIRO_ACESSO`.
- [x] Criada migration `028_create_projetos_vr_resultados_vr.sql`.
- [x] Corrigido parser de ponto dos adicionais (teste passando).
- [x] Ajustada fórmula de elegibilidade VR para evitar duplicação.
- [x] Ajustada regra de insalubridade/periculosidade para ser proporcional aos dias trabalhados.
- [x] Bloqueado marcação de "Pago" em extras sem recibo assinado.
- [x] Mascarado CPF nas exportações CSV/Excel de funcionários.
- [x] Criada migration `029_auditoria_automatica.sql` com triggers de auditoria.
- [x] Criada e deployada Edge Function `econtador`.
- [x] Criada migration `030_criptografar_token_econtador.sql` para criptografar token.
- [x] Corrigido erro de tipo no CPF vindo do e-Contador.
- [x] Adicionada seleção individual de colaboradores na importação.
- [x] Corrigida importação de departamentos do e-Contador.
- [x] Melhorado matching de departamentos pelo `nome_curto`.
- [x] Criada migration `031_historico_importacao_detalhes_erros.sql` para detalhar erros.
- [x] Criada migration `033_matricula_unica_por_empresa.sql`.
- [x] Ajustado `upsertPorMatricula` para considerar empresa e tratar conflitos.
- [ ] Isolar storage buckets.
- [x] Implementar consentimento LGPD.

---

## ❓ Dúvidas Pendentes para o Cliente

1. **VR zerado/exceções:** você mencionou que "às vezes o VR pode ficar zerado, mas tem exceções". Quando exatamente o VR deve ser zero? Isso afeta a fórmula que acabei de ajustar.
2. **Adicionais 30 dias:** a regra atual que ajustei paga proporcional aos dias trabalhados. Há casos onde deve pagar 30 dias mesmo trabalhando menos (ex: ferias/afastamentos contados)?
3. **Assinatura digital:** quer investir em certificado ICP-Brasil para recibos ou usar termo de ciência + hash/timestamp?
4. **Retenção de dados:** por quanto tempo manter dados de demitidos e ocorrências resolvidas? (sugestão: consultar jurídico)
5. **CNPJ nos recibos:** qual CNPJ usar por empresa? Cadastrar na tabela `empresas`?
6. **Primeiro acesso em produção:** qual será o fluxo? Convite manual? Edge Function de setup?

---

## 🎯 Próximos Passos Recomendados

1. Responder às dúvidas acima.
2. Aplicar migrations `027`, `028`, `029`, `030`, `031` e `033` no Supabase ✅ (aplicadas).
3. Testar importação do e-Contador em ambas as empresas ✅ (em andamento).
4. Configurar Vitest + React Testing Library.
5. Criar testes unitários para cálculos críticos.
6. Implementar consentimento LGPD ✅
7. Isolar storage buckets por contexto.

---

*Última atualização: 2026-06-25 (tarde)*
