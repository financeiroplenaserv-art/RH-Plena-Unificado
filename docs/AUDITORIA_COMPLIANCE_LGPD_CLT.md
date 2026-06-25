# Relatório de Auditoria de Compliance — LGPD e CLT

**Projeto:** RH Plena Unificado  
**Repositório:** `c:\Projetos\RH-Plena-Unificado`  
**Data da análise:** 2026-06-25  
**Escopo:** Conformidade legal do sistema de RH (LGPD e CLT)

---

## Resumo Executivo

O sistema possui uma estrutura de autenticação e algum controle de RLS, mas as falhas de segurança nas tabelas mais recentes (`extras`, `recibos_extras`), a ausência de consentimento, a falta de criptografia de dados pessoais, a auditoria manual, a assinatura digital sem valor jurídico e os recibos de EPI incompletos tornam o **compliance insuficiente para operação legal segura**. As correções P0 devem ser implementadas antes de qualquer deploy em produção.

---

## Nota Geral de Compliance

**Nota: 3,0 / 10**

---

## Achados Críticos

| # | Problema | Base Legal / Risco | Onde |
|---|----------|-------------------|------|
| 1 | **Tabelas `extras`, `categorias_extras`, `recibos_extras` com RLS aberto** — qualquer autenticado lê/escreve/exclui. | LGPD: art. 46 (segurança); vazamento de dados financeiros e assinaturas. | `supabase/migrations/018_extras.sql`, `026_recibos_extras.sql` |
| 2 | **Storage buckets sem isolamento por usuário/empresa.** | LGPD: art. 46; anexos de ocorrências (vídeo/áudio) podem ser acessados por qualquer usuário logado. | `supabase/migrations/011_storage_buckets_rls.sql` |
| 3 | **Não há consentimento informado dos colaboradores** para coleta e tratamento de dados pessoais. | LGPD: arts. 7º, 9º; tratamento sem base legal válida. | Todo o sistema |
| 4 | **Não há política de retenção de dados de demitidos.** | LGPD: art. 16; dados podem ser mantidos além do necessário. | `colaboradores`, `ocorrencias`, `extras`, `recibos_extras` |
| 5 | **Assinatura digital em recibos de extras sem valor jurídico.** | CLT: arts. 462, 464; Prova digital exige certificado ICP-Brasil ou outro meio válido. | `src/lib/extrasRecibos.ts` |
| 6 | **Recibos de EPI (CEU) podem estar incompletos.** | NR-6: registro de entrega de EPI deve conter CNPJ do empregador, descrição completa do item, CA, data e identificação do trabalhador. | `src/lib/ceuRecibos.ts` |
| 7 | **Ocorrências disciplinares sem controle de prazo para defesa.** | *Reavaliado: o processo interno da empresa é chamar o colaborador, ouvir sua justificativa e aplicar/encerrar a ocorrência no mesmo ato. Não há prazo formal de defesa. Item mantido como observação de boa prática.* | `src/pages/rh/OcorrenciaFormPage.tsx`, `OcorrenciaDetailPage.tsx` |

---

## Achados Altos

| # | Problema | Base Legal / Risco | Onde |
|---|----------|-------------------|------|
| 8 | **Dados pessoais não criptografados no banco.** | LGPD: art. 46, §3º; dados sensíveis (CPF, endereço, dados bancários) devem ter proteção reforçada. | `colaboradores`, `recibos_extras`, `extras` |
| 9 | **Token e-Contador acessível no frontend e sem log de auditoria.** | LGPD: art. 46; LGPD: art. 50 (boa-fé e accountability). | `src/services/econtadorApi.ts`, `configuracoes` |
| 10 | **Comunicação por WhatsApp sem registro de consentimento.** | LGPD: art. 7º, V; número de telefone é dado pessoal. | `src/pages/extras/ExtrasBalancoPage.tsx` |
| 11 | **Progressão disciplinar configurada como 3+ ocorrências ativas = alerta crítico**, mas sem garantia de observância ao art. 482 CLT. | CLT: art. 482; justa causa exige proporcionalidade e graduação. | `src/hooks/useAlertas.ts` |
| 12 | **Não há direitos do titular (acesso, retificação, exclusão, portabilidade).** | LGPD: arts. 18–22; obrigação legal do controlador. | Não implementado |
| 13 | **Não há registro de operações de tratamento (RoPA).** | LGPD: art. 37; obrigação para controladores de médio/large porte. | Não implementado |

---

## Achados Médios

| # | Problema | Base Legal / Risco | Onde |
|---|----------|-------------------|------|
| 14 | **Anexos de ocorrências sem criptografia em repouso.** | LGPD: art. 46, §3º; dados sensíveis em vídeo/áudio. | Supabase Storage `ocorrencia-anexos` |
| 15 | **Auditoria manual — não há triggers automáticas.** | LGPD: art. 46; accountability e rastreabilidade. | `log_auditoria` |
| 16 | **Exportações de dados sem anonimização/máscara.** | LGPD: art. 7º, IX; minimização de dados. | Exportações de colaboradores, recibos |
| 17 | **Prazo de estabilidade e suspensão referenciados na UI sem validação automática.** | CLT: arts. 474, 853; risco de notificação fora do prazo. | `src/hooks/useAlertas.ts`, `src/pages/rh/AlertasPage.tsx` |
| 18 | **Mensagens de balanço operacional podem expor nomes de colaboradores no WhatsApp.** | LGPD: art. 46; vazamento de dados em grupos. | `src/pages/extras/ExtrasBalancoPage.tsx` |

---

## Recomendações Práticas

### Imediatas (P0)

1. **Fechar RLS das tabelas `extras`, `categorias_extras`, `recibos_extras`.**
   - Aplicar as mesmas regras de `is_admin`, `is_editor`, `is_visualizador` das demais tabelas.

2. **Isolar storage por contexto e usuário.**
   - Adicionar metadados de `owner`, `ocorrencia_id`, `projeto_vr_id`.
   - Policies devem validar relacionamento com registro acessível.

3. **Implementar consentimento do colaborador.**
   - Tela de consentimento no primeiro acesso ou cadastro.
   - Registrar `consentimento_lgpd` no banco com data, versão e finalidade.

4. **Definir política de retenção de dados.**
   - Criar documento formal com prazos de guarda e descarte.
   - Demitidos: anonimizar/apagar dados pessoais após prazo legal (5 anos para documentos trabalhistas, conforme orientação jurídica).
   - Anexos de ocorrências resolvidas: arquivar/após prazo.

5. **Rever assinatura digital de recibos.**
   - *Reavaliado: a empresa utiliza o sistema Youk para assinatura e arquivamento externo dos documentos gerados no RH Plena. Não é necessário implementar assinatura digital própria.*
   - Recomendação: manter registro interno de que o documento foi enviado para assinatura no Youk (opcional).

6. **Garantir prazo de defesa nas ocorrências.**
   - *Reavaliado: o processo interno da empresa não prevê prazo formal de defesa. O colaborador é chamado, ouvido e a ocorrência é encerrada no ato.*
   - Recomendação de boa prática: registrar no campo `defesa_funcionario` ou em `ocorrencia_defesas` o teor da justificativa apresentada.

### Curtas (P1)

7. **Criptografar dados pessoais sensíveis no banco.**
   - CPF, RG, PIS, endereço, dados bancários.
   - Usar `pgcrypto` ou criptografia na aplicação.

8. **Implementar direitos do titular LGPD.**
   - Telas/fluxos para acesso, retificação, exclusão, portabilidade e revogação de consentimento.

9. **Registrar consentimento para comunicação.**
   - WhatsApp e email devem ter consentimento explícito.
   - Evitar exposição de nomes completos em mensagens de grupos.

10. **Auditoria automática no banco.**
    - Triggers em tabelas críticas (`colaboradores`, `ocorrencias`, `extras`, `recibos_extras`).

11. **Completar recibos de EPI.**
    - *Reavaliado: o template atual (`src/lib/ceuRecibos.ts`) já contém CNPJ do empregador, descrição completa do item, CA, data de entrega, identificação do trabalhador e espaço para assinatura. Item considerado atendido.*

### Médio prazo (P2)

12. **Token e-Contador.**
    - Logar toda consulta/alteração do token.
    - Implementar rotação periódica e alerta de vencimento.

13. **Registro de Operações (RoPA).**
    - Documentar finalidades, bases legais, compartilhamentos, retenção e segurança.

14. **DPO e canal de comunicação.**
    - Definir encarregado de dados e canal para titulares.

---

*Documento gerado em: 2026-06-25*
