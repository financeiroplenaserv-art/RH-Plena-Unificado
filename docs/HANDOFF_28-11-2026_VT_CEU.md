# Handoff 28/11/2026 — VT e CEU

## No ar hoje (todos com push na `main`)
| Commit | O quê |
|---|---|
| 072b84b | VT: rascunho do lote salvo no banco ao importar (incidente: carga de dezembro do Maciel só no navegador); banner de estado; aviso de carga parcial; botão **Arquivo Riocard** (TXT PEF 01.00 por CNPJ, matrícula da Riocard pelo CPF no PDF "Cadastro de Funcionários" anexado, valor final do lote confirmado); endereço nº 0/vazio não é mais erro; ônibus Rio R$ 5,00 só no Jaé confirmado; Niterói R$ 4,45 (dia R$ 8,90) = decisão da gestora |
| 52084c1 | CEU: migration **177 aplicada** — "Atender selecionadas" lança as entregas (janela com todas as linhas, data 1º do mês, CA por item, sem recibo) + "Trocar contrato" na linha |
| 384f83d | CEU "Marcar todas / Atender todas as marcadas"; VT Carga ordena por nome; VT Trajetos busca por nome + filtro por departamento; trava contra 2 rascunhos simultâneos |
| 9e0532e | VT: migration **178 aplicada** (`vt_escala_dias`) + pop-up do calendário da pessoa na Carga |
| b3bebb2 | VT: cobertura de férias só troca o posto dos dias [T] (antes transformava folga em trabalho — caso Alexandre); fila de recálculo na Carga; migration **179 aplicada** (sem TRUNCATE para authenticated nas vt_*) |
| 524934e | VT: treinamento também só [T] (Flit marca [T] no treinamento) — síntese removida |

## Em andamento (NÃO publicado)
- **PUBLICADO em 28/11/2026** (583 testes VT, tsc, eslint e build ok): **seletor "Esta linha é de:"** em cada ônibus das alternativas do Google na revisão de rota (Niterói / São Gonçalo / Itaboraí-Maricá gratuito / Rio Jaé / Intermunicipal), recalculando pelo motor e registrando em `itinerario.ajustesManuais`. Caso: Andressa Cristina Assumpção Marques (Marambaia, Itaboraí → ENSEADA): linhas 39/76 são de Itaboraí (gratuitas), Google diz Niterói. Ao retomar: verificar `git status`, rodar testes VT, pedir OK e publicar. Contorno enquanto isso: "Informar a rota que a pessoa usa" com "Ônibus municipal gratuito (Itaboraí/Maricá)" + 416M + 49 (deve dar R$ 18,80).

## Próximos passos da gestora / Maciel
1. **Maciel**: Ctrl+Shift+R no CORH e "Recalcular rascunho" (ou reimportar) dezembro. O recálculo das 16:07 rodou com a versão antiga (cache) — ainda tem 119 dias de cobertura após 15/12. Esperado Alexandre: 8 dias × R$ 8,90 = R$ 71,20 (marcas T F T F gravadas em `vt_escala_dias`).
2. Gestora: conferir "Fora da carga" → confirmar o lote (parcial até 15/12, intencional) → Excel → **Arquivo Riocard** (anexar PDFs EA e Tech) → mandar TXT/Excel para comparar com o manual antes de subir na Riocard (confirmar CRLF/ASCII com a Riocard no 1º envio).
3. **Beth (CEU)**: marcar as 171 linhas de EPI de dezembro e atender (digitar CA da LUVA TÉRMICA Tam. 11, cód. 713). Recibos pelo caminho normal.

## Perguntas em aberto para a gestora
- Tarifa do ônibus municipal de **São Gonçalo** (R$ 5,55, marcada "a conferir" em `src/lib/vt/motor/tarifas.ts`) — enquanto não confirmar, rota com ônibus de SG fica pendente.
- Eliana Silvino dos Santos (só Jaé): cadastrar cidade do posto DUOCONNECT e informar rota manual com ônibus do Rio.

## Pendências técnicas
- Varredura de TRUNCATE/REFERENCES/TRIGGER para `authenticated` nas tabelas dos **demais módulos** (feito só no VT, migration 179). Pedido da gestora: "depois veremos os demais".
- Tela de substituição de lote confirmado não existe (dezembro parcial é intencional; não precisa agora).
- 6 scripts antigos de VT fora de commit em `scripts/vt/` (out/2026) — avaliar se ficam.
