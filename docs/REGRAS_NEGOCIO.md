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
