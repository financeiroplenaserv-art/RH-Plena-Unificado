// Gera o Manual do Usuário do CORH em Word (.docx) e HTML (para PDF).
// Lê os capítulos em markdown de scripts/manual/capitulos/ e os prints
// de scripts/manual/prints/.
//
// Uso: node gerar-manual.cjs

const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun,
  AlignmentType, Footer, PageNumber, BorderStyle,
} = require('docx')

const DIR_CAPITULOS = path.join(__dirname, 'capitulos')
const DIR_PRINTS = path.join(__dirname, 'prints')
const DIR_SAIDA = path.join(__dirname, '..', '..', 'docs', 'manual')
const LOGO = path.join(__dirname, '..', '..', 'public', 'corh_icone_app_512.png')

const TITULO_MANUAL = 'Manual do Usuário'
const SUBTITULO_MANUAL = 'CORH — Controle Operacional e de RH'
const RODAPE_DATA = 'Agosto de 2026 · Versão 1.0'

// ------------------------------------------------------------ parser markdown
function parseInline(texto) {
  // Divide em trechos comum / **negrito** / `codigo`
  const runs = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let ultimo = 0
  let m
  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) runs.push(new TextRun({ text: texto.slice(ultimo, m.index), size: 22 }))
    const trecho = m[0]
    if (trecho.startsWith('**')) {
      runs.push(new TextRun({ text: trecho.slice(2, -2), bold: true, size: 22 }))
    } else {
      runs.push(new TextRun({ text: trecho.slice(1, -1), size: 22, font: 'Consolas' }))
    }
    ultimo = m.index + trecho.length
  }
  if (ultimo < texto.length) runs.push(new TextRun({ text: texto.slice(ultimo), size: 22 }))
  return runs
}

function imagemInfo(arquivo) {
  const caminho = path.join(DIR_PRINTS, arquivo)
  if (!fs.existsSync(caminho)) return null
  const data = fs.readFileSync(caminho)
  if (arquivo.startsWith('mobile')) {
    const altura = 460
    return { data, width: Math.round(altura * (780 / 1688)), height: altura }
  }
  const largura = 610
  return { data, width: largura, height: Math.round(largura * (900 / 1440)) }
}

function mdParaDocx(md) {
  const linhas = md.split(/\r?\n/)
  const filhos = []
  for (const linha of linhas) {
    const l = linha.trimEnd()
    const t = l.trim()
    if (!t) continue

    if (t.startsWith('# ')) {
      filhos.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 240 },
        children: [new TextRun({ text: t.slice(2), bold: true, size: 36, color: '0C1730' })],
      }))
    } else if (t.startsWith('## ')) {
      filhos.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 160 },
        children: [new TextRun({ text: t.slice(3), bold: true, size: 28, color: '0F6CBD' })],
      }))
    } else if (t.startsWith('### ')) {
      filhos.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: t.slice(4), bold: true, size: 24, color: '334155' })],
      }))
    } else if (t.startsWith('[IMAGEM:')) {
      const arquivo = t.replace('[IMAGEM:', '').replace(']', '').trim()
      const img = imagemInfo(arquivo)
      if (img) {
        filhos.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 160, after: 160 },
          children: [new ImageRun({ type: 'png', data: img.data, transformation: { width: img.width, height: img.height } })],
        }))
        filhos.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: `Tela: ${arquivo.replace('.png', '')} (imagem com dados de exemplo)`, italics: true, size: 16, color: '94A3B8' })],
        }))
      }
    } else if (t.startsWith('> DICA:')) {
      filhos.push(new Paragraph({
        shading: { fill: 'E8F5E9' },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: '43A047' } },
        spacing: { before: 120, after: 120 },
        indent: { left: 200 },
        children: [new TextRun({ text: '💡 DICA — ', bold: true, size: 21, color: '2E7D32' }), ...parseInline(t.slice(7).trim())],
      }))
    } else if (t.startsWith('> ATENÇÃO:')) {
      filhos.push(new Paragraph({
        shading: { fill: 'FFF3E0' },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'F57C00' } },
        spacing: { before: 120, after: 120 },
        indent: { left: 200 },
        children: [new TextRun({ text: '⚠️ ATENÇÃO — ', bold: true, size: 21, color: 'E65100' }), ...parseInline(t.slice(10).trim())],
      }))
    } else if (t.startsWith('- ')) {
      filhos.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: parseInline(t.slice(2)),
      }))
    } else if (/^\d+\.\s/.test(t)) {
      filhos.push(new Paragraph({
        spacing: { after: 60 },
        indent: { left: 360 },
        children: parseInline(t),
      }))
    } else {
      filhos.push(new Paragraph({
        spacing: { after: 140 },
        children: parseInline(t),
      }))
    }
  }
  return filhos
}

// ------------------------------------------------------------ HTML para PDF
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function inlineHtml(texto) {
  return escapeHtml(texto)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}
function mdParaHtml(md) {
  const linhas = md.split(/\r?\n/)
  const partes = []
  let listaAberta = null
  const fechaLista = () => { if (listaAberta) { partes.push(`</${listaAberta}>`); listaAberta = null } }
  for (const linha of linhas) {
    const t = linha.trim()
    if (!t) { fechaLista(); continue }
    if (t.startsWith('# ')) { fechaLista(); partes.push(`<h1>${inlineHtml(t.slice(2))}</h1>`) }
    else if (t.startsWith('## ')) { fechaLista(); partes.push(`<h2>${inlineHtml(t.slice(3))}</h2>`) }
    else if (t.startsWith('### ')) { fechaLista(); partes.push(`<h3>${inlineHtml(t.slice(4))}</h3>`) }
    else if (t.startsWith('[IMAGEM:')) {
      fechaLista()
      const arquivo = t.replace('[IMAGEM:', '').replace(']', '').trim()
      const cls = arquivo.startsWith('mobile') ? 'img-mobile' : 'img-desktop'
      partes.push(`<figure><img class="${cls}" src="prints/${arquivo}"><figcaption>Tela: ${arquivo.replace('.png', '')} (imagem com dados de exemplo)</figcaption></figure>`)
    } else if (t.startsWith('> DICA:')) { fechaLista(); partes.push(`<p class="dica">💡 <strong>DICA</strong> — ${inlineHtml(t.slice(7).trim())}</p>`) }
    else if (t.startsWith('> ATENÇÃO:')) { fechaLista(); partes.push(`<p class="atencao">⚠️ <strong>ATENÇÃO</strong> — ${inlineHtml(t.slice(10).trim())}</p>`) }
    else if (t.startsWith('- ')) {
      if (listaAberta !== 'ul') { fechaLista(); partes.push('<ul>'); listaAberta = 'ul' }
      partes.push(`<li>${inlineHtml(t.slice(2))}</li>`)
    } else if (/^\d+\.\s/.test(t)) {
      if (listaAberta !== 'ol') { fechaLista(); partes.push('<ol>'); listaAberta = 'ol' }
      partes.push(`<li>${inlineHtml(t.replace(/^\d+\.\s/, ''))}</li>`)
    } else { fechaLista(); partes.push(`<p>${inlineHtml(t)}</p>`) }
  }
  fechaLista()
  return partes.join('\n')
}

// ------------------------------------------------------------ textos fixos
function sobreEsteManualDocx() {
  const p = (txt, opts = {}) => new Paragraph({ spacing: { after: 140 }, children: parseInline(txt), ...opts })
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 240 },
      children: [new TextRun({ text: 'Sobre este manual', bold: true, size: 36, color: '0C1730' })],
    }),
    p('Este manual ensina, passo a passo, a usar o **CORH** — o sistema de Controle Operacional e de RH da Plena. Ele foi feito para quem usa o sistema no dia a dia, sem precisar de conhecimento técnico.'),
    p('Cada capítulo cobre um módulo do sistema. Dentro de cada capítulo, cada tela tem uma explicação do que ela faz, o passo a passo das tarefas mais comuns e a descrição de todos os campos e botões.'),
    p('**Sobre as imagens:** todas as telas deste manual foram capturadas com **dados de exemplo (fictícios)** — nomes, CPFs e valores não são de pessoas reais. No seu sistema, as telas são as mesmas, mas com os dados verdadeiros da empresa.'),
    p('**O que você vê pode ser diferente:** o menu lateral mostra só os módulos que o seu perfil pode acessar. Se um capítulo falar de uma tela que não aparece para você, é porque o seu perfil não tem essa permissão — fale com o Administrador.'),
    p('**Dica de ouro:** se o sistema parecer desatualizado (uma tela não abre ou falta algo novo), pressione **Ctrl+Shift+R** no teclado para recarregar a página por completo.'),
    p('**Precisa de ajuda?** Use o botão de suporte (a bóia salva-vidas no topo da tela) para enviar sua dúvida sem sair do sistema. Você pode anexar imagens da tela para explicar melhor.'),
  ]
}

function sobreEsteManualHtml() {
  return `
<h1>Sobre este manual</h1>
<p>Este manual ensina, passo a passo, a usar o <strong>CORH</strong> — o sistema de Controle Operacional e de RH da Plena. Ele foi feito para quem usa o sistema no dia a dia, sem precisar de conhecimento técnico.</p>
<p>Cada capítulo cobre um módulo do sistema. Dentro de cada capítulo, cada tela tem uma explicação do que ela faz, o passo a passo das tarefas mais comuns e a descrição de todos os campos e botões.</p>
<p><strong>Sobre as imagens:</strong> todas as telas deste manual foram capturadas com <strong>dados de exemplo (fictícios)</strong> — nomes, CPFs e valores não são de pessoas reais. No seu sistema, as telas são as mesmas, mas com os dados verdadeiros da empresa.</p>
<p><strong>O que você vê pode ser diferente:</strong> o menu lateral mostra só os módulos que o seu perfil pode acessar. Se um capítulo falar de uma tela que não aparece para você, é porque o seu perfil não tem essa permissão — fale com o Administrador.</p>
<p><strong>Dica de ouro:</strong> se o sistema parecer desatualizado (uma tela não abre ou falta algo novo), pressione <strong>Ctrl+Shift+R</strong> no teclado para recarregar a página por completo.</p>
<p><strong>Precisa de ajuda?</strong> Use o botão de suporte (a bóia salva-vidas no topo da tela) para enviar sua dúvida sem sair do sistema. Você pode anexar imagens da tela para explicar melhor.</p>`
}

function apendiceVideoDocx() {
  const p = (txt) => new Paragraph({ spacing: { after: 140 }, children: parseInline(txt) })
  const b = (txt) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: parseInline(txt) })
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 240 },
      children: [new TextRun({ text: 'Anexo — Como gravar vídeos de treinamento', bold: true, size: 36, color: '0C1730' })],
    }),
    p('Além deste manual, você pode gravar vídeos curtos mostrando as telas em movimento. Não é preciso nenhum programa pago: o próprio Windows já tem um gravador de tela.'),
    new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 160 }, children: [new TextRun({ text: 'Gravando com o Windows (sem instalar nada)', bold: true, size: 28, color: '0F6CBD' })] }),
    p('1. Abra o sistema CORH na tela que você quer mostrar.'),
    p('2. Pressione as teclas **Windows + G** para abrir a barra de gravação do Windows.'),
    p('3. Clique no botão de **gravar** (a bolinha) e faça a tarefa na tela, falando o que está fazendo.'),
    p('4. Para terminar, pressione **Windows + Alt + R**. O vídeo fica salvo na pasta **Vídeos > Capturas** do computador.'),
    new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 160 }, children: [new TextRun({ text: 'Dicas para bons vídeos de treinamento', bold: true, size: 28, color: '0F6CBD' })] }),
    b('**Um vídeo por tarefa:** prefira vários vídeos curtos (1 a 3 minutos) a um vídeo longo. Ex.: "Como lançar um extra", "Como importar o ponto".'),
    b('**Siga o manual:** use o passo a passo do capítulo correspondente como roteiro do que mostrar na tela.'),
    b('**Use dados de exemplo:** evite gravar informações pessoais reais (CPF, salários) nos vídeos.'),
    b('**Fale devagar e aponte:** diga em voz alta o nome do botão antes de clicar nele.'),
  ]
}

function apendiceVideoHtml() {
  return `
<h1>Anexo — Como gravar vídeos de treinamento</h1>
<p>Além deste manual, você pode gravar vídeos curtos mostrando as telas em movimento. Não é preciso nenhum programa pago: o próprio Windows já tem um gravador de tela.</p>
<h2>Gravando com o Windows (sem instalar nada)</h2>
<p>1. Abra o sistema CORH na tela que você quer mostrar.</p>
<p>2. Pressione as teclas <strong>Windows + G</strong> para abrir a barra de gravação do Windows.</p>
<p>3. Clique no botão de <strong>gravar</strong> (a bolinha) e faça a tarefa na tela, falando o que está fazendo.</p>
<p>4. Para terminar, pressione <strong>Windows + Alt + R</strong>. O vídeo fica salvo na pasta <strong>Vídeos &gt; Capturas</strong> do computador.</p>
<h2>Dicas para bons vídeos de treinamento</h2>
<ul>
<li><strong>Um vídeo por tarefa:</strong> prefira vários vídeos curtos (1 a 3 minutos) a um vídeo longo. Ex.: "Como lançar um extra", "Como importar o ponto".</li>
<li><strong>Siga o manual:</strong> use o passo a passo do capítulo correspondente como roteiro do que mostrar na tela.</li>
<li><strong>Use dados de exemplo:</strong> evite gravar informações pessoais reais (CPF, salários) nos vídeos.</li>
<li><strong>Fale devagar e aponte:</strong> diga em voz alta o nome do botão antes de clicar nele.</li>
</ul>`
}

// ------------------------------------------------------------ montagem
async function main() {
  fs.mkdirSync(DIR_SAIDA, { recursive: true })
  const arquivos = fs.readdirSync(DIR_CAPITULOS).filter(f => f.endsWith('.md')).sort()
  const capitulos = arquivos.map(f => ({
    arquivo: f,
    md: fs.readFileSync(path.join(DIR_CAPITULOS, f), 'utf8'),
    titulo: '',
  }))
  for (const c of capitulos) {
    const m = c.md.match(/^#\s+(.+)$/m)
    c.titulo = m ? m[1] : c.arquivo
  }

  // ---------------- DOCX ----------------
  const capa = [
    new Paragraph({ spacing: { before: 2400 } }),
    fs.existsSync(LOGO) ? new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 400 },
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(LOGO), transformation: { width: 110, height: 110 } })],
    }) : new Paragraph({}),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: TITULO_MANUAL, bold: true, size: 56, color: '0C1730' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1200 }, children: [new TextRun({ text: SUBTITULO_MANUAL, size: 32, color: '0F6CBD' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'Guia completo de uso do sistema, tela por tela', size: 24, color: '64748B' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: RODAPE_DATA, size: 22, color: '94A3B8' })] }),
  ]

  const sumario = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 240 },
      children: [new TextRun({ text: 'Sumário', bold: true, size: 36, color: '0C1730' })],
    }),
    new Paragraph({ spacing: { after: 120 }, children: parseInline('**Sobre este manual** — leia antes de começar') }),
    ...capitulos.map(c => new Paragraph({ spacing: { after: 120 }, children: parseInline(`**${c.titulo}**`) })),
    new Paragraph({ spacing: { after: 120 }, children: parseInline('**Anexo** — Como gravar vídeos de treinamento') }),
  ]

  const corpo = [
    ...sobreEsteManualDocx(),
    ...capitulos.flatMap(c => mdParaDocx(c.md)),
    ...apendiceVideoDocx(),
  ]

  const doc = new Document({
    title: `${TITULO_MANUAL} — CORH`,
    creator: 'Plena',
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
    },
    sections: [{
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Manual do Usuário — CORH · página ', size: 16, color: '94A3B8' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '94A3B8' }),
            ],
          })],
        }),
      },
      children: [...capa, ...sumario, ...corpo],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const caminhoDocx = path.join(DIR_SAIDA, 'Manual-do-Usuario-CORH.docx')
  fs.writeFileSync(caminhoDocx, buffer)
  console.log('DOCX:', caminhoDocx, `(${(buffer.length / 1024 / 1024).toFixed(1)} MB)`)

  // ---------------- HTML (para PDF) ----------------
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${TITULO_MANUAL} — CORH</title>
<style>
  @page { size: A4; margin: 2cm 1.8cm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; color: #1e293b; font-size: 11pt; line-height: 1.5; }
  h1 { color: #0C1730; font-size: 20pt; page-break-before: always; margin: 0 0 14pt; }
  h1:first-of-type { page-break-before: avoid; }
  h2 { color: #0F6CBD; font-size: 14.5pt; margin: 18pt 0 8pt; }
  h3 { color: #334155; font-size: 12pt; margin: 12pt 0 6pt; }
  p { margin: 0 0 8pt; }
  ul, ol { margin: 0 0 8pt; padding-left: 22pt; }
  li { margin-bottom: 3pt; }
  code { font-family: Consolas, monospace; background: #f1f5f9; padding: 0 3px; border-radius: 3px; font-size: 9.5pt; }
  figure { text-align: center; margin: 10pt 0 14pt; page-break-inside: avoid; }
  figure img { border: 1px solid #e2e8f0; border-radius: 6px; }
  .img-desktop { width: 100%; max-width: 17cm; }
  .img-mobile { height: 11.5cm; }
  figcaption { font-size: 8pt; color: #94a3b8; font-style: italic; margin-top: 4pt; }
  .dica { background: #E8F5E9; border-left: 4px solid #43A047; padding: 6pt 8pt; border-radius: 3px; }
  .atencao { background: #FFF3E0; border-left: 4px solid #F57C00; padding: 6pt 8pt; border-radius: 3px; }
  .capa { text-align: center; padding-top: 6cm; page-break-after: always; }
  .capa img { width: 2.9cm; }
  .capa h1 { page-break-before: avoid; font-size: 30pt; margin-top: 1cm; }
  .capa .sub { color: #0F6CBD; font-size: 16pt; margin-bottom: 3cm; }
  .capa .desc { color: #64748b; font-size: 12pt; }
  .capa .data { color: #94a3b8; font-size: 11pt; margin-top: 4pt; }
  .sumario p { margin-bottom: 6pt; }
</style>
</head>
<body>
<div class="capa">
  ${fs.existsSync(LOGO) ? '<img src="../../public/corh_icone_app_512.png">' : ''}
  <h1>${TITULO_MANUAL}</h1>
  <p class="sub">${SUBTITULO_MANUAL}</p>
  <p class="desc">Guia completo de uso do sistema, tela por tela</p>
  <p class="data">${RODAPE_DATA}</p>
</div>
<div class="sumario">
<h1>Sumário</h1>
<p><strong>Sobre este manual</strong> — leia antes de começar</p>
${capitulos.map(c => `<p><strong>${inlineHtml(c.titulo)}</strong></p>`).join('\n')}
<p><strong>Anexo</strong> — Como gravar vídeos de treinamento</p>
</div>
${sobreEsteManualHtml()}
${capitulos.map(c => mdParaHtml(c.md)).join('\n')}
${apendiceVideoHtml()}
</body>
</html>`
  const caminhoHtml = path.join(__dirname, 'manual.html')
  fs.writeFileSync(caminhoHtml, html)
  console.log('HTML:', caminhoHtml)
}

main().catch(e => { console.error(e); process.exit(1) })
