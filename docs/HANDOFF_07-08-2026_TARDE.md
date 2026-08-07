# Handoff — 07/08/2026 (tarde): Manual do Usuário + correção da tela Alertas

> Passagem para o próximo agente. Sessão da tarde de 07/08. Commits `0edb09c` (fix) e `22ffdab` (manual) na main, push feito.
> **Deploy Netlify PENDENTE — decisão da gestão: NÃO deployar agora, acumular com a próxima mudança.** No próximo deploy, incluir o commit `0edb09c` (a tela Alertas em produção segue com o bug até lá).

## 1. Manual do Usuário criado (commit `22ffdab`)

- **Entrega:** `docs/manual/Manual-do-Usuario-CORH.docx` (4,9 MB, editável) e `docs/manual/Manual-do-Usuario-CORH.pdf` (~130 páginas).
- **Conteúdo:** 10 capítulos (Primeiros passos, Cadastros, Ocorrências, CEU, Adicionais, Extras, Escalas, Férias, VR, Gestão), 51 telas com print + passo a passo + campos/botões + Dicas/Atenções + Dúvidas frequentes. Linguagem simples, sem jargão. Anexo ensinando a gravar vídeos de treinamento (Win+G) — vídeo em si não foi produzido (fora da capacidade do agente).
- **Infraestrutura em `scripts/manual/`** (README próprio com instruções):
  - `capturar-telas.cjs` — screenshots automáticos via Chrome headless (puppeteer-core) com **interceptação total de rede**: sessão fake de admin + dados fictícios respondidos localmente (REST/Auth/Storage/Edge Functions). Nenhuma chamada real ao banco. Requer `npm run dev` rodando.
  - `capitulos/*.md` — o texto do manual vive aqui (formato: `#`/`##`/`###`, `[IMAGEM: x.png]`, `> DICA:`, `> ATENÇÃO:`).
  - `gerar-manual.cjs` — gera o `.docx` (pacote `docx`) e o `manual.html`; o PDF sai do HTML via Chrome headless `--print-to-pdf`.
- Prints usam dados fictícios ("Mariana Souza Exemplo" etc.) — decisão deliberada (LGPD) e avisada no próprio manual.

## 2. Correção da tela Alertas (commit `0edb09c`)

- **Bug latente encontrado durante as capturas:** `src/pages/rh/AlertasPage.tsx` tinha `<SelectItem value="">` ("Todas severidades") — o Radix rejeita `value` vazio e a tela quebrava ao renderizar. Era o único caso no código (varredura feita).
- **Correção:** valor `"todas"` + mapeamento no `onValueChange` (`'todas'` → `''`). Lint limpo, 279 testes passando (1 skipped — rls.test sem Python).
- **Produção segue com o bug até o próximo deploy** (ver topo).

## 3. Estado e próximos passos

- Working tree limpa, main = `22ffdab`, push feito.
- **Próximo deploy (quando a gestão pedir):** incluirá o fix de Alertas. Regras de sempre: site `plena-corh`, verificar hash do bundle, 1–2 deploys/dia.
- Se o sistema mudar telas, o manual pode ser regenerado: atualizar capítulos em `scripts/manual/capitulos/`, recapturar prints com `capturar-telas.cjs` e rodar `gerar-manual.cjs` + comando do PDF (tudo no README da pasta).
