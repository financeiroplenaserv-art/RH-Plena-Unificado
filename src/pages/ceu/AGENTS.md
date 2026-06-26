# AGENTS.md — Módulo CEU (Controle de EPI/Uniformes/Crachá)

> Regras e exceções específicas deste módulo. Instruções aqui prevalecem sobre diretrizes genéricas para arquivos sob `src/pages/ceu/`.

---

## 🗓️ Data de entrega nos recibos

**Exceção de negócio operacional — NÃO reportar como erro em auditorias:**

Nos recibos de entrega de **uniforme, crachá e EPI**, a data de entrega informada no recibo (`data_entrega`) pode ser fixada no **dia 1º do mês** (ou outra data retroativa/futura conforme processo interno), mesmo que o documento tenha sido preparado/impresso antes desse dia.

- O campo **"Data da entrega"** no formulário (`CeuEntregaFormPage.tsx`) é editável e não possui validação que bloqueie datas fora do dia corrente.
- A função `formatarData()` em `src/lib/ceuRecibos.ts` apenas formata o valor recebido; ela não o reescreve para a data atual.
- Isso atende a uma prática operacional do cliente: os recibos são gerados antecipadamente e datados no 1º dia do mês para fins de controle/contábeis.

**Portanto:**
- Não alterar a data para "hoje" automaticamente.
- Não adicionar validação que impeça data de 1º do mês.
- Em auditorias de compliance/cálculos, considerar esse comportamento como **esperado e documentado**.

---

## 📝 Observação sugerida na interface

O formulário de entrega já exibe a seguinte orientação abaixo do campo "Data da entrega":

> "Pode ser usada a data de 1º do mês, mesmo que o recibo seja preparado antes."
