/* Gera o quadro de colaboradores (cartaz A4 para elevadores) de um contrato.
 *
 * Uso:
 *   node scripts/gerar-quadro-colaboradores.mjs \
 *     --xlsx="docs/Quadro de colaboradores.xlsx" \
 *     --cliente="Condomínio Chácara do Itaguaí" \
 *     --saida="dados-locais/quadro-colaboradores/chacara-do-itaguai.html"
 *
 * Lê a planilha (colunas Nome, Cargo, Horário, Escala), casa os nomes com o
 * cadastro do Supabase para buscar as fotos (bucket privado colaborador-fotos,
 * via SUPABASE_SERVICE_KEY do .env) e grava HTMLs autossuficientes (fotos e
 * logo embutidos em base64) prontos para imprimir em A4:
 *   - <saida>            quadro principal, agrupado por função, sem o ferista
 *   - <saida>.ferista.*  cartaz separado do ferista/faltista (reimprime só ele
 *                        quando o ferista do contrato trocar)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import XLSX from '@e965/xlsx'
import sharp from 'sharp'

// ---------- args ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/)
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]
  }),
)
const XLSX_PATH = args.xlsx || 'docs/Quadro de colaboradores.xlsx'
const CLIENTE = args.cliente || 'Condomínio Chácara do Itaguaí'
const SAIDA = args.saida || 'dados-locais/quadro-colaboradores/quadro.html'
const SAIDA_FERISTA = SAIDA.replace(/\.html$/, '') + '.ferista.html'

// ---------- .env ----------
const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

// ---------- normalização ----------
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const normNome = (s) => semAcento(String(s).toUpperCase().replace(/\s+/g, ' ').trim())

const ehFerista = (cargo) => normNome(cargo).includes('FERISTA')

function cargoBonito(cargo) {
  const c = normNome(cargo)
  if (ehFerista(c)) return 'Porteiro — Ferista/Faltista'
  if (c.startsWith('PORTEIRO')) return 'Porteiro(a)'
  if (c.startsWith('AUXILIAR DE SERV GERAIS')) return 'Aux. de Serviços Gerais'
  if (c.startsWith('AUXILIAR DE JARDINAGEM')) return 'Auxiliar de Jardinagem'
  if (c.startsWith('ENCARREGADA')) return 'Encarregada'
  if (c.startsWith('ENCARREGADO PLENO')) return 'Encarregado Pleno'
  if (c.startsWith('ENCARREGADO')) return 'Encarregado'
  return String(cargo).trim()
}

// grupo de exibição (seções do cartaz) — ordem de aparição
const GRUPOS = ['Porteiros', 'Encarregados', 'Limpeza', 'Jardinagem', 'Outros']
function grupoDo(cargo) {
  const c = normNome(cargo)
  if (c.startsWith('PORTEIRO')) return 'Porteiros'
  if (c.startsWith('ENCARREGADO') || c.startsWith('ENCARREGADA')) return 'Encarregados'
  if (c.startsWith('AUXILIAR DE SERV GERAIS')) return 'Limpeza'
  if (c.startsWith('AUXILIAR DE JARDINAGEM')) return 'Jardinagem'
  return 'Outros'
}

function horarioBonito(h) {
  const s = String(h || '').trim()
  if (!s) return null
  const m = s.match(
    /(\d{1,2})(?::(\d{2}))?\s*(?:hs?|hrs)?\s*(?:às|as|a|-)\s*(\d{1,2})(?::(\d{2}))?\s*(?:hs?|hrs)?/i,
  )
  if (!m) return s
  const fmt = (h1, m1) => `${String(h1).padStart(2, '0')}h${m1 && m1 !== '00' ? m1 : ''}`
  return `${fmt(m[1], m[2])} às ${fmt(m[3], m[4])}`
}

const escalaBonita = (e) => String(e || '').trim().replace(/\s*[xX]\s*/g, '×')

// ---------- planilha ----------
const wb = XLSX.read(readFileSync(XLSX_PATH))
const ws = wb.Sheets[wb.SheetNames[0]]
const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
const iCab = matriz.findIndex((r) => normNome(r[0]) === 'NOME')
if (iCab < 0) throw new Error('Linha de cabeçalho (Nome, Cargo, Horário, Escala) não encontrada')
const linhas = matriz
  .slice(iCab + 1)
  .filter((r) => String(r[0] || '').trim())
  .map((r) => ({
    nome: String(r[0]).trim(),
    cargoOriginal: String(r[1] || '').trim(),
    cargo: cargoBonito(r[1]),
    grupo: grupoDo(r[1]),
    ferista: ehFerista(r[1]),
    horario: horarioBonito(r[2]),
    escala: escalaBonita(r[3]),
  }))
console.log(`${linhas.length} colaboradores na planilha (${linhas.filter((l) => l.ferista).length} ferista(s))`)

// ---------- cadastro + fotos ----------
const { data: colaboradores, error } = await supabase
  .from('colaboradores')
  .select('id, nome_completo, foto_path, status')
if (error) throw error
const porNome = new Map()
for (const c of colaboradores) {
  const k = normNome(c.nome_completo)
  if (!porNome.has(k) || c.status === 'Ativo') porNome.set(k, c)
}

// fallback fuzzy: casa quando no máximo 1 token diverge (erro de grafia).
// Regras de segurança: o PRIMEIRO nome tem que bater (exato ou prefixo) —
// evita casar sobrenomes de pessoas diferentes (caso real: "Thiago Morais
// da Silva" casou com "Lourene da Silva Morais" por 3 tokens iguais).
// Exato vale 2, prefixo vale 1; desempate: mesmo nº de tokens, depois Ativo.
function buscarCadastro(nomePlanilha) {
  const exato = porNome.get(normNome(nomePlanilha))
  if (exato) return exato
  const tokensAlvo = normNome(nomePlanilha).split(' ')
  const casa = (t, r) => (r === t ? 2 : r.startsWith(t) || t.startsWith(r) ? 1 : 0)
  let melhor = null
  let melhorScore = -1
  let melhorEmpate = -1
  for (const c of colaboradores) {
    const tokensCad = normNome(c.nome_completo).split(' ')
    if (Math.abs(tokensCad.length - tokensAlvo.length) > 1) continue
    if (!casa(tokensAlvo[0], tokensCad[0])) continue // primeiro nome precisa bater
    const restantes = [...tokensCad.slice(1)]
    let score = casa(tokensAlvo[0], tokensCad[0])
    for (const t of tokensAlvo.slice(1)) {
      let melhorI = -1
      let melhorP = 0
      for (let i = 0; i < restantes.length; i++) {
        const p = casa(t, restantes[i])
        if (p > melhorP) {
          melhorP = p
          melhorI = i
        }
      }
      if (melhorI >= 0) {
        restantes.splice(melhorI, 1)
        score += melhorP
      }
    }
    if (score < 2 * (tokensAlvo.length - 1)) continue // no máximo 1 token divergente
    const empate = (tokensCad.length === tokensAlvo.length ? 2 : 0) + (c.status === 'Ativo' ? 1 : 0)
    if (score > melhorScore || (score === melhorScore && empate > melhorEmpate)) {
      melhor = c
      melhorScore = score
      melhorEmpate = empate
    }
  }
  if (melhor) console.warn(`  ~ fuzzy: ${nomePlanilha} -> ${melhor.nome_completo}`)
  return melhor
}

// ---------- ajustes manuais de enquadramento (por nome normalizado) ----------
// { "AGOSTINHO DOS SANTOS GUEDES": { "zoom": 1.4, "dx": 0, "dy": -0.15 } }
// zoom > 1 aproxima (menos torso, mais rosto); dx/dy deslocam o centro
// (-1 a 1, fração da largura/altura — dy negativo sobe o recorte).
const AJUSTES_PATH = args.ajustes || 'dados-locais/quadro-colaboradores/ajustes-fotos.json'
let ajustes = {}
try {
  ajustes = JSON.parse(readFileSync(AJUSTES_PATH, 'utf8'))
  console.log(`ajustes manuais: ${Object.keys(ajustes).length} foto(s) em ${AJUSTES_PATH}`)
} catch { /* sem arquivo de ajustes — tudo automático */ }

async function fotoFinal(buf, nome) {
  const aj = ajustes[normNome(nome)]
  // recorte manual fracionário sobre a ORIGINAL: { "recorte": { "x": 0.04, "y": 0.02, "w": 0.92 } }
  // (x/y = canto superior esquerdo em fração da largura/altura; w = largura em fração; a altura
  //  é derivada para manter a proporção 3:4 do cartão)
  if (aj && aj.recorte) {
    const meta = await sharp(buf).metadata()
    const W = meta.width
    const H = meta.height
    const w = Math.round(Math.min(1, aj.recorte.w ?? 0.9) * W)
    const h = Math.round(w * 4 / 3)
    const clamp = (v, max) => Math.max(0, Math.min(max, Math.round(v)))
    const mini = await sharp(buf)
      .extract({
        left: clamp((aj.recorte.x ?? 0) * W, W - w),
        top: clamp((aj.recorte.y ?? 0) * H, H - h),
        width: w,
        height: Math.min(h, H),
      })
      .resize(600, 800)
      .jpeg({ quality: 88 })
      .toBuffer()
    return mini
  }
  // recorte 3:4 (proporção do cartão) centrado no rosto (saliência "attention")
  let mini = await sharp(buf)
    .resize(600, 800, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 88 })
    .toBuffer()
  if (aj && (aj.zoom > 1 || aj.dx || aj.dy)) {
    const zoom = aj.zoom > 1 ? aj.zoom : 1
    const w = Math.round(600 / zoom)
    const h = Math.round(800 / zoom)
    const cx = 300 + (aj.dx || 0) * 600
    const cy = 400 + (aj.dy || 0) * 800
    const clamp = (v, max) => Math.max(0, Math.min(max, v))
    mini = await sharp(mini)
      .extract({
        left: Math.round(clamp(cx - w / 2, 600 - w)),
        top: Math.round(clamp(cy - h / 2, 800 - h)),
        width: w,
        height: h,
      })
      .resize(600, 800)
      .jpeg({ quality: 88 })
      .toBuffer()
  }
  return mini
}

let semCadastro = 0
let semFoto = 0
for (const l of linhas) {
  const cad = buscarCadastro(l.nome)
  if (!cad) {
    console.warn(`  ! sem cadastro: ${l.nome}`)
    semCadastro++
    l.foto = null
    continue
  }
  if (!cad.foto_path) {
    console.warn(`  ! sem foto: ${l.nome}`)
    semFoto++
    l.foto = null
    continue
  }
  const { data: blob, error: e2 } = await supabase.storage
    .from('colaborador-fotos')
    .download(cad.foto_path)
  if (e2) {
    console.warn(`  ! erro ao baixar foto de ${l.nome}: ${e2.message}`)
    semFoto++
    l.foto = null
    continue
  }
  const buf = Buffer.from(await blob.arrayBuffer())
  const mini = await fotoFinal(buf, l.nome)
  l.foto = `data:image/jpeg;base64,${mini.toString('base64')}`
}
console.log(`fotos ok: ${linhas.length - semCadastro - semFoto} | sem cadastro: ${semCadastro} | sem foto: ${semFoto}`)

// ---------- logo ----------
const logo = `data:image/jpeg;base64,${readFileSync('docs/assets/logo_plena_cab.jpg').toString('base64')}`

// ---------- HTML ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const PLACEHOLDER = `<div class="foto sem-foto"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#b8cbe0"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" fill="#b8cbe0"/></svg></div>`

function cardHtml(l) {
  const foto = l.foto ? `<img class="foto" src="${l.foto}" alt="">` : PLACEHOLDER
  const info = [l.horario, l.escala].filter(Boolean).join(' · ')
  return `<div class="card">
  <div class="foto-wrap">${foto}</div>
  <div class="nome">${esc(l.nome)}</div>
  <div class="cargo">${esc(l.cargo)}</div>
  ${info ? `<div class="horario">${esc(info)}</div>` : '<div class="horario vago">conforme escala</div>'}
</div>`
}

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 0; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #0C1730;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pagina {
    width: 210mm; height: 297mm;
    padding: 9mm 9mm 0;
    display: flex; flex-direction: column;
    background: #fff;
    page-break-after: always;
  }
  .pagina:last-child { page-break-after: auto; }

  /* ---------- cabeçalho ---------- */
  header { display: flex; align-items: center; gap: 6mm; }
  header img.logo { height: 14mm; }
  header .linha-vertical { width: 0.5mm; align-self: stretch; background: linear-gradient(180deg, #0F6CBD, #0aa0e2); border-radius: 1mm; }
  header .titulos { flex: 1; }
  header .sobre {
    font-size: 7pt; font-weight: 600; letter-spacing: 0.22em;
    text-transform: uppercase; color: #0F6CBD;
  }
  header h1 { font-size: 18pt; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1; }
  header .sub { font-size: 8pt; color: #5a6b85; margin-top: 0.8mm; }
  .faixa {
    height: 1.4mm; margin: 3.5mm 0 4.5mm;
    background: linear-gradient(90deg, #0C1730 0%, #0F6CBD 45%, #0aa0e2 100%);
    border-radius: 1mm;
  }

  /* ---------- seções ---------- */
  .secao { margin-bottom: 5mm; }
  .secao-titulo {
    display: flex; align-items: baseline; gap: 2.5mm;
    font-size: 9.5pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    color: #0C1730; margin-bottom: 2.5mm;
  }
  .secao-titulo .qtd { font-size: 7.5pt; font-weight: 600; color: #0F6CBD; letter-spacing: 0.05em; }
  .secao-titulo::after { content: ''; flex: 1; height: 0.4mm; background: #d8e2ee; border-radius: 1mm; align-self: center; }

  /* ---------- grade ---------- */
  .grade {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 3mm;
  }
  .grade.cheia { flex: 1; min-height: 0; grid-auto-rows: 1fr; }
  .card {
    border: 0.3mm solid #d8e2ee;
    border-radius: 2.5mm;
    overflow: hidden;
    background: #fff;
    display: flex; flex-direction: column;
    min-height: 0;
    break-inside: avoid;
  }
  .foto-wrap { aspect-ratio: 3 / 4; background: #eef3f9; }
  .grade.cheia .foto-wrap { flex: 1; min-height: 0; aspect-ratio: auto; position: relative; }
  .foto {
    width: 100%; height: 100%;
    object-fit: cover; object-position: center center;
    display: block;
  }
  .grade.cheia .foto { position: absolute; inset: 0; }
  .foto.sem-foto { display: flex; align-items: center; justify-content: center; }
  .foto.sem-foto svg { width: 60%; }
  .nome {
    font-size: 7.4pt; font-weight: 700; line-height: 1.15;
    padding: 1.6mm 2mm 0;
    min-height: 7.4mm;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .cargo {
    font-size: 5.8pt; font-weight: 600; letter-spacing: 0.03em;
    text-transform: uppercase; color: #0F6CBD;
    padding: 0.6mm 2mm 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .horario {
    margin: 1.2mm 2mm 1.8mm;
    font-size: 6pt; font-weight: 600; color: #0C1730;
    background: linear-gradient(90deg, #e3f0fb, #f2f8fd);
    border-radius: 2mm;
    padding: 0.8mm 0; text-align: center;
  }
  .horario.vago { color: #7a8aa0; font-weight: 500; background: none; }

  /* ---------- rodapé ---------- */
  footer {
    margin: auto -9mm 0;
    background: #0C1730;
    color: #cfe0f2;
    font-size: 7pt;
    padding: 2.6mm 9mm;
    display: flex; justify-content: space-between; align-items: center;
  }
  footer b { color: #fff; font-weight: 600; }

  /* ---------- cartaz do ferista ---------- */
  .palco-ferista { flex: 1; display: flex; flex-direction: column; align-items: center; padding-top: 8mm; }
  .palco-ferista .card { width: 62mm; }
  .nota-ferista {
    margin-top: 4mm; font-size: 8pt; color: #5a6b85; text-align: center; max-width: 120mm;
  }
`

const HEADER = `<header>
  <img class="logo" src="${logo}" alt="Plena">
  <div class="linha-vertical"></div>
  <div class="titulos">
    <div class="sobre">Informativo Operacional · Quadro de Colaboradores</div>
    <h1>${esc(CLIENTE)}</h1>
    <div class="sub">Equipe Plena Facilities atuante neste condomínio</div>
  </div>
</header>
<div class="faixa"></div>`

const FOOTER = `<footer>
  <span><b>Plena Facilities</b> — Rua Dr. Borman, 23 · salas 1206/1210 · Centro · Niterói/RJ</span>
  <span>Tel: (21) 2621-0111 · www.plenafacilities.com.br</span>
</footer>`

const secaoHtml = (titulo, itens, cheia) => `
  <section class="secao${cheia ? ' cresce' : ''}">
    <div class="secao-titulo">${esc(titulo)} <span class="qtd">· ${itens.length}</span></div>
    <div class="grade${cheia ? ' cheia' : ''}">
${itens.map(cardHtml).join('\n')}
    </div>
  </section>`

// ---------- montagem das páginas ----------
const normais = linhas.filter((l) => !l.ferista)
const feristas = linhas.filter((l) => l.ferista)
const porGrupo = new Map()
for (const l of normais) {
  if (!porGrupo.has(l.grupo)) porGrupo.set(l.grupo, [])
  porGrupo.get(l.grupo).push(l)
}
const gruposPresentes = GRUPOS.filter((g) => porGrupo.has(g))

// página 1 = maior grupo sozinho (cresce para preencher a folha); demais na página 2
const [maior] = [...gruposPresentes].sort((a, b) => porGrupo.get(b).length - porGrupo.get(a).length)
const pagina1 = secaoHtml(maior, porGrupo.get(maior), true)
const CSS_EXTRA = `.secao.cresce { flex: 1; min-height: 0; display: flex; flex-direction: column; }`
const pagina2 = gruposPresentes
  .filter((g) => g !== maior)
  .map((g) => secaoHtml(g, porGrupo.get(g), false))
  .join('\n')

const paginas = [pagina1, pagina2]
  .filter(Boolean)
  .map(
    (conteudo) => `  <div class="pagina">
${HEADER}
${conteudo}
${FOOTER}
  </div>`,
  )
  .join('\n')

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Quadro de Colaboradores — ${esc(CLIENTE)}</title>
<style>${CSS}${CSS_EXTRA}</style>
</head>
<body>
${paginas}
</body>
</html>
`

mkdirSync(dirname(SAIDA), { recursive: true })
writeFileSync(SAIDA, html)
console.log(`HTML gerado: ${SAIDA}`)

// ---------- cartaz separado do ferista ----------
if (feristas.length > 0) {
  const cardsFerista = feristas.map(cardHtml).join('\n')
  const htmlFerista = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Ferista/Faltista — ${esc(CLIENTE)}</title>
<style>${CSS}</style>
</head>
<body>
  <div class="pagina">
${HEADER.replace('Quadro de Colaboradores', 'Ferista / Faltista')}
    <div class="palco-ferista">
${cardsFerista}
      <div class="nota-ferista">Colaborador ferista/faltista — cobre férias e ausências da equipe deste condomínio, conforme escala.</div>
    </div>
${FOOTER}
  </div>
</body>
</html>
`
  writeFileSync(SAIDA_FERISTA, htmlFerista)
  console.log(`HTML do ferista gerado: ${SAIDA_FERISTA}`)
}
