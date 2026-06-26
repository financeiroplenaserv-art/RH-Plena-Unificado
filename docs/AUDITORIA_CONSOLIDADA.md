# Relatório Consolidado de Auditorias — RH Plena Unificado

**Data:** 2026-06-25  
**Objetivo:** avaliar segurança, cálculos financeiros, integração e-Contador, compliance LGPD/CLT e arquitetura de código antes de prosseguir com o projeto.

---

## 📊 Resumo Executivo

Foram realizadas **5 auditorias profundas** por agentes especializados no código do projeto. O resultado geral é **preocupante**: o sistema tem bases funcionais, mas apresenta **falhas críticas de segurança, cálculos financeiros com risco trabalhista, integração frágil, compliance insuficiente e arquitetura acoplada**.

> **Recomendação geral:** NÃO coloque o sistema em produção com dados reais até que as correções críticas (P0) sejam implementadas e validadas.

---

## 🎯 Notas por Auditoria

| Auditoria | Nota | Status |
|-----------|------|--------|
| Segurança e RLS | **3.5 / 10** | 🔴 Crítico |
| Cálculos Financeiros | **4.5 / 10** | 🔴 Crítico |
| Integração e-Contador | **4.5 / 10** | 🔴 Crítico |
| Compliance LGPD/CLT | **3.0 / 10** | 🔴 Crítico |
| Arquitetura e Código | **5.5 / 10** | 🟠 Alto |
| **Média Geral** | **4.2 / 10** | 🔴 Crítico |

---

## 🚨 Top 10 Prioridades Críticas (P0)

Estes itens devem ser corrigidos **antes** de qualquer deploy em produção:

| # | Problema | Por que é grave | Relatório |
|---|----------|-----------------|-----------|
| 1 | Novo usuário vira `admin` automaticamente | Qualquer pessoa que criar conta tem acesso total | Segurança |
| 2 | Token do e-Contador exposto no frontend | Terceiros podem usar o token da empresa | Segurança + Integração |
| 3 | Tabelas `extras`, `categorias_extras`, `recibos_extras` com RLS aberto | Qualquer usuário lê/edita/apaga dados financeiros | Segurança + Compliance |
| 4 | Storage buckets sem isolamento | Anexos de ocorrências e VR acessíveis por qualquer usuário | Segurança + Compliance |
| 5 | Parser de ponto dos adicionais não funciona | Pagamento de adicionais sai zerado ou errado | Cálculos |
| 6 | Insalubridade/periculosidade forçada em 30 dias | Pode pagar adicional não devido ou omitir proporcionalidade | Cálculos + Compliance |
| 7 | Elegibilidade VR pode duplicar dias | Pagamento de VR acima do devido | Cálculos |
| 8 | Status “Pago” em extras sem recibo assinado | Prova de pagamento frágil; risco trabalhista | Cálculos + Compliance |
| 9 | Não há consentimento LGPD dos colaboradores | Tratamento de dados pessoais sem base legal | Compliance |
| 10 | Não há testes automatizados no projeto | Qualquer correção pode quebrar outra coisa | Arquitetura |

---

## 📋 Correções Imediatas Sugeridas (ordem de execução)

### Semana 1 — Segurança base
1. Corrigir criação automática de `admin` em `useAuth.ts`.
2. Proteger rota `/importar/econtador` com `ProtectedRoute`.
3. Fechar RLS das tabelas `extras`, `categorias_extras`, `recibos_extras`.
4. Isolar storage buckets por `owner`/`contexto`.

### Semana 2 — Integração e cálculos
5. Mover chamadas e-Contador para Edge Function do Supabase.
6. Criptografar token do e-Contador no banco.
7. Corrigir parser de ponto dos adicionais.
8. Revisar fórmula de elegibilidade VR.
9. Remover hardcode de 30 dias em insalubridade/periculosidade.

### Semana 3 — Compliance e comprovantes
10. Implementar consentimento LGPD no primeiro acesso/cadastro.
11. Bloquear marcação de “Pago” em extras sem recibo assinado.
12. Adicionar prazo de defesa obrigatório em ocorrências.
13. Rever recibos de EPI e de extras para adequação legal.

### Semana 4 — Fundação técnica
14. Versionar schema inicial do banco (migrations `000_*`).
15. Implementar auditoria automática via triggers Postgres.
16. Configurar ambiente de testes (Vitest + React Testing Library).
17. Criar primeiros testes unitários para cálculos críticos.

---

## 📁 Relatórios Detalhados

- [AUDITORIA_SEGURANCA_RLS.md](./AUDITORIA_SEGURANCA_RLS.md)
- [AUDITORIA_CALCULOS_FINANCEIROS.md](./AUDITORIA_CALCULOS_FINANCEIROS.md)
- [AUDITORIA_INTEGRACAO_ECONTADOR.md](./AUDITORIA_INTEGRACAO_ECONTADOR.md)
- [AUDITORIA_COMPLIANCE_LGPD_CLT.md](./AUDITORIA_COMPLIANCE_LGPD_CLT.md)
- [AUDITORIA_ARQUITETURA_CODIGO.md](./AUDITORIA_ARQUITETURA_CODIGO.md)

---

## 💡 Recomendação Estratégica

Antes de construir novos módulos (Escalas, Férias, Relatórios gerenciais), invista em:
1. **Segurança e compliance** (base para operar legalmente).
2. **Cálculos financeiros confiáveis** (base para não ter processos trabalhistas).
3. **Integração robusta com e-Contador** (base para dados corretos).
4. **Arquitetura sustentável com testes** (base para crescer sem quebrar).

Isso pode parecer “perda de tempo” no curto prazo, mas é o que vai garantir que o sistema **sobreviva ao uso real** e não gere prejuízo jurídico/financeiro para a empresa.

---

## ✅ Próximos Passos Sugeridos

1. Reunir equipe técnica e apresentar este relatório.
2. Priorizar as 10 correções críticas acima.
3. Estimar prazo e recursos necessários.
4. Decidir se o sistema atual pode ser usado em **ambiente de teste** apenas, sem dados reais.
5. Após correções, rodar nova rodada de auditorias para validar.

---

*Documento gerado em: 2026-06-25*
