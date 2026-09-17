# Handoff — 16/09/2026 (tarde)

> Sessão: Adicionais — a contagem "vinculados/esperados" da tela **Contratos**
> passa a ser **por período** (pedido da gestão: o "3/2" do contrato
> "Insalub. Enseada" somava o histórico e induzia ao erro). Sem migration,
> sem edge function — mudança só de frontend. **Deploy feito no fim da
> sessão** (Netlify `plena-corh`, deploy `6aac0568ed5a32453785ecd9`, hash do
> bundle `assets/index-CpLyM8SK.js` conferido igual ao `dist/` local).
> Commit `e0f95d5` (mudança) + handoff (push em `main`). Nada pendente de
> deploy.

## 1) O que era o problema

- A coluna "# de colaboradores" da tela Contratos usava
  `contarVinculosUnicosPorContrato(vinculos)` **sem recorte de período**:
  contava colaboradores únicos de TODOS os vínculos que já existiram.
- Caso Enseada: contrato com 2 vagas (`quantidade_colaboradores = 2`)
  mostrava **3/2** porque o Renan (vínculo encerrado em 19/07) entrava na
  conta junto com Mauro e Angelo (vínculos do período atual, 20/08 a 19/09).
- Ironia: o comentário da função já dizia que "a contagem deve refletir o
  momento atual" — a implementação nunca filtrou.
- Só existia alerta de "incompleto" (âmbar) quando faltava gente; excesso
  passava despercebido.

## 2) Solução aprovada pela gestão (opção B + alerta nos dois sentidos)

**Lógica pura** (`src/lib/adicionais/calculoAdicionais.ts`):
- `contarVinculosUnicosPorContrato(vinculos, periodoInicio?, periodoFim?)`:
  com o período informado, só contam vínculos que se sobrepõem
  (`inicio <= periodoFim && fim >= periodoInicio`). Sem os parâmetros,
  comportamento antigo (não havia outros usos).
- `limitesPeriodoAdicional(ano, mes)`: limites do período de apuração
  (dia 20 do mês ao dia 19 do seguinte; dezembro vira o ano).
- `periodoAdicionalDaData(data)`: qual período (ano/mês de início) contém a
  data — getters LOCAIS, combinar com `agoraBrasil()`.

**Tela** (`src/pages/adicionais/AdicionaisContratosPage.tsx`):
- Navegador **"Período da contagem"** (Anterior/Próximo + rótulo
  "dd/mm/aaaa a dd/mm/aaaa"), mesmo padrão do Calendário. Padrão = período
  que contém hoje (via `periodoAdicionalDaData(agoraBrasil())`); persistido
  em `adicionais.contratos.ano/mes` (`useFiltroPersistente`). O rótulo fica
  sempre visível, então não precisa de `FiltrosAtivosBadge`.
- Coluna renomeada para **"# no período"**; contagem e modal de vinculados
  filtram pelo período selecionado (o modal indica o período no subtítulo).
- Alertas nos dois sentidos: **"incompleto"** (âmbar, faltam) e
  **"excedente"** (vermelho, sobram — novo).

**Efeito prático:** Enseada no período atual mostra **2/2**; navegando para
períodos passados/futuros dá para conferir a cobertura de cada um (inclusive
o próximo período criado antecipadamente via "Copiar período anterior").

## 3) Verificações

- `npm test` ok (**416 testes, 34 arquivos** — 4 novos em
  `calculoAdicionais.test.ts`, incluindo o caso Enseada travado),
  `npm run lint` ok (0 warnings), `npm run build` ok.
- `AGENTS.md` atualizado (regra "contagem por período" na seção 11).
- Produção verificada: `index-CpLyM8SK.js` servido no ar = `dist/` local.

## Pendências

- Seguem de pé as pendências do handoff de 11/09 (validação da gestão do
  fluxo de reimportação do ponto e o espelho "01 a 08_09.pdf" com período
  de agosto).
- `func-deployada.txt` (untracked, artefato local) segue fora de propósito.
