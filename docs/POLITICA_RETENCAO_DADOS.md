# Política de Retenção e Descarte de Dados Pessoais

**Projeto:** RH Plena Unificado  
**Aprovado em:** 2026-06-25  
**Responsável:** Controlador de dados (a definir)  
**Próxima revisão:** Anual ou quando houver mudança legal relevante

---

## 1. Objetivo

Definir os prazos de armazenamento e as formas de descarte dos dados pessoais tratados pelo sistema RH Plena Unificado, em conformidade com a LGPD (Lei nº 13.709/2018), a CLT e a legislação previdenciária/trabalhista vigente.

---

## 2. Escopo

Esta política se aplica a todos os dados pessoais de colaboradores, ex-colaboradores, candidatos, prestadores de serviço e usuários do sistema armazenados no banco de dados Supabase, nos arquivos do sistema e em buckets de storage.

---

## 3. Princípios

1. **Necessidade e proporcionalidade:** manter apenas os dados necessários às finalidades declaradas.
2. **Obrigação legal:** guardar documentos exigidos por lei pelos prazos legais mínimos.
3. **Segurança:** descartar dados de forma segura e irreversível ao final do prazo.
4. **Transparência:** informar os titulares sobre os prazos de retenção no termo de consentimento.

---

## 4. Prazos de retenção

### 4.1 Dados de colaboradores ativos

| Categoria | Prazo | Fundamentação |
|-----------|-------|---------------|
| Cadastro completo (dados pessoais e contratuais) | Durante a vigência do contrato de trabalho + prazo legal pós-contratual | Execução de contrato e obrigação legal |
| Registros de ponto | 5 anos | Prazo prescricional trabalhista |
| Ocorrências disciplinares | 5 anos | Prazo prescricional trabalhista |
| Recibos de EPI/uniforme/crachá | 5 anos | NR-6 e prazo prescricional trabalhista |
| Recibos de extras/pagamentos | 5 anos | CLT arts. 462 e 464 |
| Documentos previdenciários (GPS, folhas, atestados de afastamento) | 10 anos | Lei 8.212/1991 e Decreto 3.048/1999 |
| FGTS | 30 anos | Legislação previdenciária/trabalhista |
| Registro de empregados | Prazo indeterminado | Obrigação legal e fiscalização trabalhista |

### 4.2 Dados de colaboradores demitidos

| Categoria | Prazo | Observação |
|-----------|-------|------------|
| Dados cadastrais mínimos | 2 anos após o término do contrato | CF, art. 7º, XXIX |
| Documentos comprobatórios da relação de trabalho | 5 anos após o término do contrato | Prazo prescricional trabalhista |
| Documentos previdenciários/fiscais | 10 anos | Conforme legislação específica |
| FGTS | 30 anos | Conforme legislação específica |
| Dados desnecessários após os prazos | Anonimizar ou excluir | LGPD, art. 16 |

### 4.3 Dados de usuários do sistema

| Categoria | Prazo | Observação |
|-----------|-------|------------|
| Perfil e logs de acesso | Durante a vigência do vínculo com a empresa + 2 anos | Segurança e auditoria |
| Logs de auditoria de alterações | 5 anos | Rastreabilidade e accountability |
| Consentimentos LGPD | 5 anos após revogação ou término do vínculo | Prova do consentimento |

### 4.4 Dados de candidatos (processo seletivo)

| Categoria | Prazo | Observação |
|-----------|-------|------------|
| Currículos e dados de candidatos não aprovados | 90 dias após o encerramento do processo seletivo | Salvo consentimento específico para talentos |
| Currículos de candidatos aprovados/contratados | Migrar para cadastro de colaborador | Aplicam-se regras de colaboradores |

### 4.5 Anexos de ocorrências

| Categoria | Prazo | Observação |
|-----------|-------|------------|
| Anexos de ocorrências ativas | Enquanto a ocorrência estiver ativa | - |
| Anexos de ocorrências resolvidas | 5 anos após resolução | Prazo prescricional trabalhista |
| Anexos de ocorrências canceladas | 1 ano após cancelamento | Prova de retratação |

---

## 5. Formas de descarte

Ao final do prazo de retenção, os dados devem ser:

1. **Anonimizados:** quando for necessário manter estatísticas ou registros históricos sem identificação do titular.
2. **Excluídos:** quando não houver necessidade de manutenção, mesmo que anonimizada.
3. **Descarte seguro de arquivos:** exclusão física/lógica dos arquivos em storage e do banco de dados, com registro em log de auditoria.

---

## 6. Exceções

A retenção pode ser prorrogada nas seguintes situações:

1. Exigência legal, fiscal ou regulatória.
2. Cumprimento de ordem judicial ou administrativa.
3. Execução de contrato ou exercício regular de direito em processo judicial.
4. Pedido expresso do titular para manutenção enquanto durar uma contestação.

---

## 7. Direitos do titular

O titular pode solicitar:

1. **Acesso** aos dados pessoais armazenados.
2. **Retificação** de dados incorretos.
3. **Exclusão** dos dados, exceto quando houver obrigação legal de retenção.
4. **Portabilidade** dos dados, quando aplicável.
5. **Revogação do consentimento**, sem prejuízo do tratamento anterior.

---

## 8. Responsabilidades

| Papel | Responsabilidade |
|-------|------------------|
| Administrador do sistema | Configurar rotinas de anonimização/exclusão conforme esta política. |
| Departamento de RH/DP | Identificar colaboradores demitidos e documentos elegíveis para descarte. |
| Jurídico | Validar prazos e exceções legais. |
| Encarregado de dados (DPO) | Atender solicitações dos titulares e supervisionar o cumprimento desta política. |

---

## 9. Revisão

Esta política deve ser revisada:

1. Anualmente.
2. Sempre que houver alteração na legislação aplicável.
3. Sempre que houver mudança significativa no tratamento de dados pelo sistema.

---

## 10. Referências legais

- Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD).
- Constituição Federal, art. 7º, XXIX.
- Consolidação das Leis do Trabalho (CLT), arts. 462, 464, 473, 474 e 482.
- Lei nº 8.212/1991 — Plano de Custo de Previdência Social.
- Decreto nº 3.048/1999 — Regulamento da Previdência Social.
- Norma Regulamentadora nº 6 (NR-6) — Equipamentos de Proteção Individual.

---

*Documento criado em 2026-06-25. As definições aqui contidas devem ser validadas pelo jurídico da empresa antes de sua efetiva implementação.*
