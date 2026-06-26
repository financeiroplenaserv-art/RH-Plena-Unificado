# Relatório de Compliance Legal — RH Plena Unificado

## Resumo executivo

O sistema unifica dados pessoais sensíveis de colaboradores (CPF, RG, CTPS, PIS, data de nascimento, endereço, telefone, e-mail, foto), registros disciplinares com anexos de vídeo/áudio, recibos de pagamento e entregas de EPI. A arquitetura de segurança apresenta falhas estruturais graves: **tabelas críticas criadas após a migração 014 possuem RLS totalmente permissivo**, permitindo que qualquer usuário autenticado leia, altere e exclua dados de qualquer colaborador. Não há registro de consentimento, aviso de privacidade, anonimização, criptografia de dados pessoais em repouso, auditoria automática nem gestão de retenção. A “assinatura digital” dos recibos de extras é um desenho em canvas salvo em base64, sem valor jurídico robusto. O módulo CEU gera recibos sem número de CA nem assinatura do empregado. **A nota geral de compliance é 3,0/10 — inaceitável para produção sem remediação urgente.**

---

## Achados por severidade

### 🔴 Críticos (risco de sanção e de processo trabalhista)

| # | Achado | Evidência | Risco legal |
|---|--------|-----------|-------------|
| 1 | **RLS permissivo em `extras`, `categorias_extras` e `recibos_extras`** | `supabase/migrations/018_extras.sql` e `026/027_recibos_extras*.sql` criam policies `Permitir leitura/gerenciamento` com `USING (true)` / `WITH CHECK (true)`, sem passar pela migração 014. | LGPD arts. 6º, VII; 7º, VIII; 46. Vazamento/alteração de dados financeiros e trabalhistas por qualquer usuário logado. |
| 2 | **Novo usuário autenticado vira `admin` automaticamente** | `src/hooks/useAuth.ts` cria perfil com `nivel_acesso: 'admin'` quando não existe registro. | LGPD arts. 6º, VII; 46. Escalada de privilégios; acesso irrestrito a dados pessoais. |
| 3 | **Ausência total de consentimento e aviso de privacidade** | Nenhuma tela, política ou registro de consentimento encontrado. Importação em massa via e-Contador traz dados sem notificação ao titular. | LGPD arts. 7º, 9º, 10, 18, 23 e 33. Base legal indefinida; direito à informação violado. |
| 4 | **Dados pessoais armazenados sem criptografia/mascaramento** | `colaboradores` contém CPF, RG, CTPS, PIS, data_nascimento, telefone, celular, e-mail, endereço, foto_url e `dados_completos` (JSON livre). Nenhuma criptografia de coluna. | LGPD arts. 7º, VIII; 46. Exposição em caso de vazamento do banco. |
| 5 | **Anexos de ocorrências (vídeo/áudio/atestados) acessíveis a qualquer autenticado** | `supabase/migrations/011_storage_buckets_rls.sql`: qualquer `authenticated` pode ler/inserir/atualizar objetos em `ocorrencia-anexos`. URLs públicas são geradas no front (`useAnexos.ts`). | LGPD arts. 7º, VIII; 46; 50. Vazamento de provas, atestados e registros disciplinares. |

### 🟠 Altos

| # | Achado | Evidência | Risco legal |
|---|--------|-----------|-------------|
| 6 | **Assinatura digital dos recibos de extras sem ICP-Brasil / carimbo de tempo** | `src/components/extras/AssinaturaCanvas.tsx` + `src/lib/extrasRecibos.ts`: canvas salvo em base64 em `recibos_extras.assinatura_colaborador`. | Lei 14.063/17; CLT arts. 10-A, 10-B, 10-C. Recibo pode ser contestado; fraude é trivial. |
| 7 | **Modo “papel” permite marcar recibo como assinado sem assinatura** | `src/pages/extras/ExtrasRecibosPage.tsx` envia `status: 'assinado'` quando `modoPapel` está ativo. | CLT arts. 462, 477, 611. Risco de pagamento sem comprovação de recebimento. |
| 8 | **Recibos de CEU/EPI sem CA do item e sem assinatura do empregado** | `src/components/ceu/CeuReciboModal.tsx` define `numero_ca: null` e gera HTML apenas para visualização/impresão. | NR-6 (Portaria GM nº 6.142/2020, item 6.8). Comprovante de entrega de EPI incompleto. |
| 9 | **Prazo de defesa e notificação ao empregado não implementados** | `src/pages/rh/OcorrenciaFormPage.tsx` exige `defesa_funcionario` no momento da criação, misturando notificação e defesa. Não há controle de prazo (48h) nem envio ao colaborador. | CLT arts. 474, 475-A; Súmula 14 do TST. Ocorrência disciplinar pode ser anulada. |
| 10 | **Comunicação por WhatsApp sem consentimento e com dados de terceiros** | `src/pages/extras/ExtrasBalancoPage.tsx` gera mensagem com nomes de colaboradores e substitutos para cópia no WhatsApp. | LGPD arts. 7º, 9º, 18, 33. Compartilhamento indevido de dados pessoais em grupos. |

### 🟡 Médios

| # | Achado | Evidência | Risco legal |
|---|--------|-----------|-------------|
| 11 | **Auditoria manual; sem triggers automáticas de log** | Tabelas `auditoria`/`log_auditoria` existem, mas não há triggers no banco. O hook `useAuditoria` depende de chamadas manuais. | LGPD arts. 6º, VII; 46; 50. Dificulta investigação de incidentes. |
| 12 | **Tabela `auditoria` acessível a todos os autenticados** | `010/014_rls*.sql` aplicam políticas genéricas (todos leem; editores escrevem; admin deleta). | LGPD art. 50. Logs podem ser apagados/alterados por usuários não autorizados. |
| 13 | **Sem direitos do titular (acesso, retificação, exclusão, portabilidade)** | Não há telas/APIs para o colaborador exercer direitos LGPD. | LGPD arts. 18, 19, 20, 21, 22. |
| 14 | **Retenção de dados de demitidos sem anonimização ou política de prazo** | `data_demissao` existe, mas não há rotina de anonimização/exclusão de dados pessoais após prazo legal. | LGPD arts. 7º, III; 16; 18, VII. Retenção indefinida de dados pessoais. |
| 15 | **Token e-Contador sem log de consulta nem rotação automática** | `src/services/econtadorApi.ts` lê token de `configuracoes`. RLS protege (boa prática), mas não há log nem refresh. | LGPD art. 46. Risco de acesso não rastreável à API de folha. |

### 🟢 Baixos

| # | Achado | Evidência | Risco legal |
|---|--------|-----------|-------------|
| 16 | **Perfis e dados pessoais sem máscara em telas de detalhe** | `src/pages/rh/OcorrenciaDetailPage.tsx` exibe CPF completo do colaborador. | LGPD art. 7º, VIII (boa prática de minimização de exposição). |
| 17 | **Progressão disciplinar só gera alerta; não bloqueia irregularidades** | `src/hooks/useAlertas.ts` alerta 3+ ocorrências ativas, mas não impede salto de advertência para justa causa. | CLT art. 482 + Súmula 14 do TST (risco de desproporcionalidade). |
| 18 | **Mensagem de balanço operacional editável e copiável** | `src/pages/extras/ExtrasBalancoPage.tsx` permite editar a mensagem antes de copiar. | Risco operacional de informação incorreta, sem validade formal. |

---

## Artigos e normas relevantes

### LGPD (Lei 13.709/2018)
- **Art. 6º, VII** — segurança da informação.
- **Art. 7º** — bases legais; **§3º** — consentimento deve ser livre, informado, inequívoco.
- **Art. 9º** — dados sensíveis; **Art. 10** — dados pessoais de crianças/adolescentes (não aplicável aqui).
- **Art. 16** — princípio da minimização e da necessidade.
- **Art. 18** — direitos do titular.
- **Art. 33** — comunicação ao titular sobre uso dos dados.
- **Art. 46** — medidas técnicas e administrativas de segurança.
- **Art. 50** — boas práticas e governança.

### CLT (Consolidação das Leis do Trabalho)
- **Art. 59** — horas extras autorizadas.
- **Art. 462** — responsabilidade civil do empregado.
- **Art. 474** — suspensão disciplinar e prazo para defesa.
- **Art. 482** — justa causa.
- **Art. 477** — rescisão do contrato.
- **Arts. 10-A a 10-C da Lei 11.419/06** (com redação da Lei 14.063/17) — assinatura eletrônica.

### NR-6 / EPI
- **Portaria GM nº 6.142/2020, item 6.8** — comprovante de entrega de EPI deve conter identificação do EPI, CA, data e assinatura do empregado.

### Outras
- **Lei 14.457/2022** — assédio moral.
- **Súmula 14 do TST** — prazo para defesa em medida disciplinar.

---

## Recomendações práticas de remediação

### Imediatas (P0 — bloqueantes para produção)

1. **Corrigir RLS de `extras`, `categorias_extras` e `recibos_extras`**
   - Aplicar migration equivalente à 014: `SELECT` para autenticados; `INSERT/UPDATE` apenas `is_editor()`; `DELETE` apenas `is_admin()`.
   - Garantir que recibos só sejam lidos/editados pelo próprio colaborador ou por perfis autorizados, se aplicável.

2. **Eliminar criação automática de perfil `admin`**
   - No primeiro acesso, criar usuário como `visualizador` ou exigir aprovação de um admin existente.
   - Implementar confirmação de e-mail e convite por admin.

3. **Implementar consentimento e aviso de privacidade**
   - Criar tela/registro de “Termo de Consentimento para Tratamento de Dados Pessoais” no cadastro/edição do colaborador.
   - Definir finalidades: gestão de pessoal, folha, segurança do trabalho, comunicações operacionais.
   - Registrar data, versão do termo e titular.

4. **Criptografar dados pessoais sensíveis em repouso**
   - Criptografar colunas: CPF, RG, CTPS, PIS, data_nascimento, endereço, telefone, celular, e-mail, foto_url e `dados_completos`.
   - Considerar criptografia no application-level antes de enviar ao Supabase.

5. **Restringir acesso aos anexos de ocorrências**
   - Alterar policies do Storage para `is_editor()` para insert/update; `is_admin()` para delete.
   - Remover geração de URL pública; servir arquivos via signed URL com expiração curta.
   - Adicionar hash/verificação de integridade e scan de vírus (ou bucket com integração de antimalware).

### Curtíssimo prazo (P1)

6. **Auditoria automática no banco**
   - Criar triggers PostgreSQL em `colaboradores`, `ocorrencias`, `ocorrencia_anexos`, `entregas`, `extras`, `recibos_extras` e `perfis` para inserir em `log_auditoria` com `dados_anteriores`, `dados_novos`, `usuario_id`, IP e timestamp.
   - Restringir `log_auditoria` a `admin`/`rh` para leitura e ninguém para update/delete.

7. **Assinatura digital com valor jurídico**
   - Substituir canvas por assinatura com certificado ICP-Brasil ou, no mínimo, assinatura eletrônica com OTP/senha pessoal + carimbo de tempo (art. 10-C da Lei 11.419/06).
   - Proibir status “assinado” no modo papel sem upload de comprovante assinado escaneado.

8. **Recibo de CEU/EPI conforme NR-6**
   - Incluir número do CA, descrição completa do EPI, data de entrega, validade do CA e campo de assinatura do empregado (digital ou física escaneada).
   - Vincular o CA ao cadastro do item e alertar validade ≤ 30 dias.

9. **Workflow de defesa em ocorrências disciplinares**
   - Separar criação da notificação do registro da defesa.
   - Implementar prazo de 48h para defesa, com notificação ao colaborador (e-mail/portal).
   - Bloquear ativação de suspensão/justa causa até o fim do prazo ou ciência expressa.

10. **Política de retenção e anonimização**
    - Após 5 anos da rescisão (prazo prescricional trabalhista geral), anonimizar/excluir dados pessoais desnecessários.
    - Manter apenas dados estatísticos/anonimizados.

### Médio prazo (P2)

11. **Direitos do titular LGPD**
    - Telas para acesso, retificação, exclusão, portabilidade e revogação de consentimento.

12. **Governança de comunicação**
    - Registrar consentimento explícito para WhatsApp/e-mail.
    - Evitar exposição de nomes de colaboradores em mensagens de grupos; usar código ou iniciais.

13. **Token e-Contador**
    - Logar toda consulta/alteração do token.
    - Implementar rotação periódica e alerta de vencimento.

---

## Nota geral de compliance: **3,0 / 10**
