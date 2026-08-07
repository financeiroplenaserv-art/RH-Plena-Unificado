# Geração do Manual do Usuário (CORH)

Esta pasta contém a infraestrutura que gera o **Manual do Usuário** do CORH
(Word + PDF) com capturas de tela automáticas e dados fictícios.

## Arquivos

- `capturar-telas.cjs` — captura prints de todas as telas. Usa Chrome headless
  (puppeteer-core) com interceptação de rede: simula uma sessão de login
  (perfil Administrador) e responde todas as chamadas do Supabase (REST, Auth,
  Storage, Edge Functions) com dados de exemplo. **Nenhuma chamada real chega
  ao banco.** Requer o dev server rodando (`npm run dev` na raiz).
- `capitulos/` — capítulos do manual em Markdown (01 a 10), escritos à mão
  a partir do código das telas. É AQUI que o texto do manual é editado.
- `prints/` — screenshots capturados (1440×900; mobile 390×844 @2x).
- `gerar-manual.cjs` — monta os capítulos + prints em
  `docs/manual/Manual-do-Usuario-CORH.docx` e em `manual.html`
  (fonte do PDF).
- `manual.html` — versão HTML do manual, gerada (não editar à mão).

## Como atualizar o manual

1. **Texto:** edite os arquivos em `capitulos/`. Formato:
   `#` capítulo, `##` tela, `###` subseção, `-` bullets, `**negrito**`,
   `[IMAGEM: nome.png]` numa linha sozinha, `> DICA:` e `> ATENÇÃO:`.
2. **Prints novos** (se o sistema mudou):
   ```bash
   npm run dev            # na raiz do projeto, deixe rodando
   cd scripts/manual
   node capturar-telas.cjs            # todas as telas
   node capturar-telas.cjs escalas    # ou só algumas
   ```
   Confira `erros.log` e `requests.log` se alguma tela sair em branco —
   geralmente é campo/tabela faltando no mapa `DATA` do script.
3. **Gerar Word + HTML:**
   ```bash
   node gerar-manual.cjs
   ```
4. **Gerar o PDF** (Chrome headless):
   ```bash
   "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless \
     --disable-gpu --no-pdf-header-footer \
     --print-to-pdf="C:/Users/usuario/Documents/projetos/RH-Plena-Unificado/docs/manual/Manual-do-Usuario-CORH.pdf" \
     "file:///C:/Users/usuario/Documents/projetos/RH-Plena-Unificado/scripts/manual/manual.html"
   ```

## Saída final

- `docs/manual/Manual-do-Usuario-CORH.docx`
- `docs/manual/Manual-do-Usuario-CORH.pdf`

## Observações

- Os dados das telas são **fictícios** (nomes "Exemplo/Modelo/Fictícia").
  O manual avisa isso ao leitor na seção "Sobre este manual".
- A dependência `puppeteer-core` usa o Chrome já instalado no Windows —
  não baixa navegador.
- Ao capturar a tela Alertas em 07/08/2026 foi encontrado um bug latente:
  `src/pages/rh/AlertasPage.tsx` tem um `<SelectItem value="">` que o Radix
  rejeita. A captura foi feita com um patch temporário (revertido depois).
  Vale corrigir de verdade em uma próxima sessão.
