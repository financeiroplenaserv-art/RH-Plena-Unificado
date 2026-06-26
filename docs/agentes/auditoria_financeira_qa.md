# Relatório de Auditoria Financeira / QA — Módulos de Pagamento de Pessoal
**Projeto:** RH Plena Unificado  
**Repositório:** `c:\Projetos\RH-Plena-Unificado`  
**Data da análise:** 25/06/2026  
**Escopo:** Módulos VR, Extras e Adicionais Contratuais

---

## 1. Resumo Executivo

O sistema é um front-end React/Supabase que processa pagamentos de VR (vale-refeição), extras em cash e adicionais contratuais. Os cálculos críticos estão concentrados em poucos arquivos TypeScript no `src/lib`, com pouca ou nenhuma cobertura de testes automatizados. Foram encontradas falhas objetivas no parser de ponto dos adicionais (teste existente quebra), riscos trabalhistas no cálculo de insalubridade/periculosidade (fixado em 30 dias) e inconsistências na geração dos arquivos de remessa. A governança do banco também apresenta gaps: tabelas do módulo VR (`projetos_vr`, `resultados_vr`) não possuem migrations de criação versionadas. A confiabilidade financeira atual é **baixa a média** e requer validação manual rigorosa antes de qualquer fechamento.

---

## 2. Achados por Severidade

### 2.1 Críticos — podem gerar pagamento errado ou risco trabalhista

| # | Achado | Arquivo / Função | Impacto |
|---|--------|------------------|---------|
| C1 | **Parser de ponto para adicionais não extrai os dias.** O teste `npm run test:adicionais` falha com `UnknownErrorException: Ensure that the standardFontDataUrl API parameter is provided` e retorna 0 dias para todos os colaboradores. | `src/lib/adicionais/importarPonto.ts` → `parsePontoPDF` | Lançamento zerado de dias trabalhados, folgas e faltas; pagamento de adicionais incorreto. |
| C2 | **Cálculo de insalubridade/periculosidade força 30 dias** independentemente de quantos dias o colaborador realmente trabalhou no período, afastamentos ou admissão/demissão no mês. | `src/pages/adicionais/AdicionaisRelatorioPage.tsx` linhas 409-417 | Risco trabalhista: pagar adicional não devido ou omitir proporcionalidade. |
| C3 | **Elegibilidade VR pode inflar dias.** A fórmula `diasElegiveis = diasPdf + diasEscala - diasAbatimento` soma dias já trabalhados (PDF) com dias futuros (escala). Se houver sobreposição de datas, o valor fica acima do real. | `src/lib/vr/calculoVR.ts` linha 77 | Pagamento de VR acima do devido. |
| C4 | **Arquivo Alterdata aplica desconto percentual sobre valor bruto**, sem evidência de que o percentual está de acordo com convenção coletiva ou acordo individual. Qualquer alteração no percentual desconta proporcionalmente errado. | `src/lib/vr/calculoVR.ts` linhas 493-494 | Desconto em folha errado; risco de desconto indevido ou menor. |
| C5 | **Arquivo PAT inclui beneficiários sem validar CPF.** Apenas verifica 11 dígitos; dígitos verificadores inválidos passam e geram registro no arquivo de remessa. | `src/lib/vr/calculoVR.ts` linhas 358-362 | Rejeição do arquivo pelo operador de VR ou crédito em CPF inexistente. |
| C6 | **Tabelas `projetos_vr` e `resultados_vr` não possuem migrations de criação** no repositório. Apenas RLS é aplicado se as tabelas já existirem. | `supabase/migrations/` | Impossível reproduzir/schema drift; risco de perda de dados e inconsistência entre ambientes. |
| C7 | **Status “Pago” em extras pode ser marcado independentemente de recibo assinado.** O botão “Marcar como pago” atualiza a tabela `extras` diretamente sem exigir recibo. | `src/pages/extras/ExtrasRecibosPage.tsx` linhas 307-326 | Prova de pagamento frágil; risco trabalhista de acusação de não pagamento. |
| C8 | **Recibo de extras usa data de emissão como data de recebimento**, não a data real do pagamento. | `src/lib/extrasRecibos.ts` linhas 104-106 | Documento comprobatório pode não refletir a data efetiva do pagamento. |
| C9 | **Assinatura digital em base64 sem timestamp ou hash de integridade.** Não há garantia de não-repúdio nem vinculação ao documento. | `src/lib/extrasRecibos.ts` | Valor jurídico reduzido em eventual processo. |
| C10 | **CNPJ da empresa hardcoded nos recibos** com regras fixas “Plena EA Facilities” / “Plena Tech”. | `src/lib/extrasRecibos.ts` linhas 110-117 | Recibo pode sair com CNPJ errado para outras empresas do grupo. |

### 2.2 Altos — risco operacional ou de controle

| # | Achado | Arquivo / Função | Impacto |
|---|--------|------------------|---------|
| A1 | **Matching de colaboradores por substring de nome** pode vincular ponto de uma pessoa à escala de outra. | `src/lib/vr/calculoVR.ts` linhas 33-58 | Pagamento de VR para pessoa errada. |
| A2 | **Parser de PDF VR descarta seção inteira se não achar CPF válido.** Colaboradores com CPF mascarado ou ausente no PDF não entram no cálculo. | `src/lib/vr/pdfParser.ts` linhas 44-46 | Exclusão indevida de beneficiários. |
| A3 | **Cálculo 12×36 assume data_início do vínculo como primeiro dia trabalhado.** Se o colaborador começou em folga, todos os dias subsequentes invertem. | `src/pages/adicionais/AdicionaisCalendarioPage.tsx` e `AdicionaisRelatorioPage.tsx` | Dias trabalhados/folga invertidos. |
| A4 | **Intrajornada/feriado usa dia 7 sem lógica de feriados.** O dia 7 representa feriado, mas não há integração com calendário de feriados. | `src/types/adicionais.ts` e `src/lib/adicionais/calculoAdicionais.ts` | Horas extras em feriados podem ser ignoradas. |
| A5 | **Fallback de regime 12×36 gera dias “trabalhou” quando não há lançamento salvo.** | `src/pages/adicionais/AdicionaisRelatorioPage.tsx` `calcularStatusPorRegime` | Contagem de dias trabalhados fictícia se o ponto não foi importado. |
| A6 | **Alterações manuais de dias/extras no VR não são auditadas nem salvas no banco automaticamente.** | `src/hooks/useCalculoVR.ts` `atualizarResultado` e `src/pages/vr/VrProjetoDetailPage.tsx` | Risco de fraude ou erro sem rastreabilidade. |
| A7 | **Remover colaboradores com 0 dias altera apenas o estado local**, não persistindo a exclusão. | `src/pages/vr/VrProjetoDetailPage.tsx` linhas 278-284 | Ao recarregar, os registros zerados reaparecem. |

### 2.3 Médios — melhorias necessárias

| # | Achado | Arquivo / Função |
|---|--------|------------------|
| M1 | Não há testes unitários automatizados no projeto (`src/**/*.test.ts` inexistente). | Todo `src/` |
| M2 | O script `test:adicionais` é um teste de integração manual e depende de mock em `localStorage`. | `scripts/teste-adicionais.ts` |
| M3 | Categorias de extras podem ter `valor_padrao = 0`, permitindo salvamento com valor zero. | `src/pages/extras/ExtrasCategoriasPage.tsx` |
| M4 | `parseMoeda` converte strings vazias/zero para `0`, podendo ocultar erros de digitação. | `src/lib/utils.ts` |
| M5 | Layouts PAT/Alterdata dependem de campos fixos sem validação de CNPJ/CEP/UF. | `src/lib/vr/calculoVR.ts` |
| M6 | Função `campoNum` trunca valores à direita se excederem o tamanho, em vez de alertar. | `src/lib/vr/calculoVR.ts` linha 229 |

### 2.4 Baixos — ajustes de qualidade

| # | Achado | Arquivo / Função |
|---|--------|------------------|
| B1 | Código de cálculo de regime 12×36/6×1/5×2 duplicado entre calendário e relatório. | `AdicionaisCalendarioPage.tsx` e `AdicionaisRelatorioPage.tsx` |
| B2 | Label “Intradiurna (HE)” na tela e tipo `intrajornada` no código geram ambiguidade. | `src/pages/adicionais/AdicionaisContratosPage.tsx` |
| B3 | Console logs de debug deixados no script de teste. | `scripts/teste-adicionais.ts` |

---

## 3. Arquivos e Funções de Maior Risco de Cálculo Errado

### Módulo VR
- **`src/lib/vr/calculoVR.ts`**
  - `calcularVR` — fórmula de elegibilidade e matching
  - `gerarArquivoVRPAT` — layout 350 posições
  - `gerarArquivoAlterdata` — layout 61 posições e cálculo de desconto
  - `carregarDatasNascimento` — parsing de base de matrícula/datas
- **`src/lib/vr/pdfParser.ts`**
  - `parsePDFPonto` — extração de nome/CPF/registros
  - `contarDiasPdf6h` — contagem de dias trabalhados
  - `contarAbatimentos` — contagem de faltas/suspensões
- **`src/lib/vr/excelParser.ts`**
  - `parseExcelEscala` — parsing de escala futura

### Módulo Extras
- **`src/lib/extrasRecibos.ts`**
  - `gerarReciboExtraPDF` — emissão e cálculo de total
- **`src/pages/extras/ExtrasRecibosPage.tsx`**
  - `handleAssinar`, `marcarExtrasComoPago` — controle de pagamento
- **`src/hooks/useExtrasRecibos.ts`**
  - `assinar` — atualização de status e marcar pago

### Módulo Adicionais Contratuais
- **`src/pages/adicionais/AdicionaisRelatorioPage.tsx`**
  - `linhasAgregadas` / regra de 30 dias — cálculo de adicionais
  - `calcularStatusPorRegime` e `statusEfetivo` — regime e fallback
- **`src/lib/adicionais/importarPonto.ts`**
  - `parsePontoPDF` e `detectarStatus` — parser de ponto (atualmente falha)
- **`src/lib/adicionais/calculoAdicionais.ts`**
  - `diaIntrajornada` — lógica de intrajornada/feriado

---

## 4. Cenários de Teste que Devem ser Validados

### VR
1. Colaborador com 22 dias trabalhados no PDF e 8 dias na escala futura: deve resultar em 22 dias (sem duplicar).
2. Colaborador com 3 faltas no mês anterior: verificar se abate exatamente 3 dias no mês atual.
3. Arquivo PAT: validar byte-a-byte (350 posições), CPF com dígitos verificadores válidos, matrícula alinhada à direita.
4. Arquivo Alterdata: simular VR R$ 22,00 × 20 dias × 10% de desconto e conferir se o valor do evento é R$ 44,00.
5. Colaborador sem CPF no PDF mas presente na escala/base: deve ser possível gerar o arquivo corretamente.
6. Exportar PAT sem base de datas de nascimento: validar data default `01/01/1990`.

### Extras
7. Criar 3 extras de R$ 100,00 para o mesmo substituto; gerar recibo; marcar “pago”; verificar se todos os registros ficam com `status = 'Pago'`.
8. Tentar marcar extras como pagos sem recibo assinado: o sistema deve bloquear ou exigir justificativa/auditoria.
9. Alterar o valor de um extra após recibo assinado: o PDF reemitido deve refletir o novo valor ou bloquear alteração.
10. Recibo com data de pagamento diferente da data de emissão: validar se o documento permite registrar a data real.

### Adicionais Contratuais
11. Colaborador admitido no dia 15 do mês, com insalubridade: deve receber proporcional aos dias trabalhados, não 30 dias.
12. Colaborador com 2 faltas no mês e insalubridade: regra de desconto deve ser `30 - 2 = 28` apenas se o regime for mensal integral; se proporcional, recalcular.
13. Importar PDF de ponto de um colaborador 12×36: verificar se dias de folga e trabalho estão corretos (executar `npm run test:adicionais` e corrigir).
14. Substituto em dia de falta: deve contar os adicionais do contrato para o substituto, mas sem gerar pagamento duplicado para o titular.
15. Dia de feriado configurado como intrajornada: verificar se é computado corretamente.

---

## 5. Recomendações Práticas

### Imediatas (antes do próximo fechamento)
1. **Corrigir o parser de ponto dos adicionais** e fazer o `npm run test:adicionais` passar.
2. **Revisar a fórmula de elegibilidade VR** para evitar duplicação entre PDF atual e escala futura; considerar `UNION` de dias únicos ou usar o maior dos dois.
3. **Remover o hardcode de 30 dias** para insalubridade/periculosidade; calcular proporcional aos dias do período/mês e faltas.
4. **Adicionar migrations de criação** para `projetos_vr` e `resultados_vr`.
5. **Impedir marcação de “Pago”** sem recibo assinado ou, no mínimo, exigir justificativa e registrar auditoria.

### Curtas (próximas 2 semanas)
6. **Implementar validação de dígitos verificadores** de CPF antes de gerar o PAT.
7. **Adicionar testes unitários** para `calculoVR.ts`, `pdfParser.ts`, `excelParser.ts`, `importarPonto.ts` e `calculoAdicionais.ts`.
8. **Unificar a lógica de regime 12×36/6×1/5×2** em uma única função reutilizada no calendário e relatório.
9. **Registrar auditoria** das alterações manuais de dias/extras no VR e adicionais.
10. **Validar CNPJ/CEP/UF** nos campos do layout PAT.

### Médias
11. Integrar calendário de feriados oficiais na lógica de intrajornada.
12. Tornar o CNPJ da empresa configurável por empresa e não hardcoded.
13. Adicionar hash/timestamp nos recibos digitais.
14. Implementar testes de snapshot dos arquivos PAT/Alterdata.

---

## 6. Nota Geral de Confiabilidade Financeira

**Nota: 4,5 / 10**
