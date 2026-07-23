# Regras de Negócio — RH Plena Unificado

Documento de decisões de negócio validadas com a gestão. As regras aqui devem ser respeitadas por desenvolvedores e agentes de auditoria.

---

## Adicionais / Insalubridade / Periculosidade

### Regra dos 30 dias
- Quem trabalha em regime **12×36** tem direito a receber insalubridade/periculosidade de **um mês cheio (30 dias)**, independentemente de quantos dias efetivamente trabalhou no mês.
- Não é erro. Não deve ser alterado para cálculo proporcional.
- Reforçado em: `src/pages/adicionais/AdicionaisRelatorioPage.tsx`.

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
- Visualização: **adm, gestor, dp1, dp2, mesa, inspetor**.
- Edição: mantida pela função `is_editor()`.
- Exclusão: apenas **adm**.
- Após gerar o PDF, registra-se **como o documento foi assinado** (`forma_assinatura`: papel ou Youk — opcional) e o impresso assinado pode ser anexado como **"Documento assinado"** (`tipo_documento` no anexo). Decisão de 2026-07-23.

---

## Recibos

### Recibos de Extras
- Ficam **armazenados no próprio sistema** (tabela `recibos_extras`).
- **Não** são enviados para o Youk.

### Demais Recibos
- Continuam sendo gerenciados no **Youk**.

---

## Férias / Escalas / Relatórios

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

*Última atualização: 2026-06-26*
