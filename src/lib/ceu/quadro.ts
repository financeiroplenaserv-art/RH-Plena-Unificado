/* Quadro de Colaboradores — cartaz A4 por posto (CEU → Quadro).
 *
 * Lógica pura (sem DOM/Supabase): agrupa por função, separa o ferista/faltista
 * (folha própria — migration 119), monta o HTML de impressão. O visual foi
 * validado com a gestão no protótipo scripts/gerar-quadro-colaboradores.mjs
 * (PDFs aprovados em dados-locais/quadro-colaboradores/) — alterações de
 * layout devem manter a fidelidade com aquele resultado.
 */
import type { FocoFotoQuadro } from '@/types/database'
import { escaparHtml } from './crachas'

// ---------- tipos ----------

export interface ColaboradorQuadro {
  id: string
  nome: string
  funcao: string // cargo_cracha ?? cargo, já resolvido pela tela
  fotoDataUrl: string | null
  foco: FocoFotoQuadro | null
  horario: string | null // horario_quadro salvo; null = padrão (turno/regime/"conforme escala")
  turno: string | null // turno mais recente da escala Flit (locais_trabalho_diario.turno, migration 120)
  regime: string | null // regime_trabalho do contrato do vínculo mais recente ('12x36' etc.)
  ferista: boolean
}

export interface SecaoQuadro {
  grupo: string
  itens: ColaboradorQuadro[]
  /** true = grade elástica que preenche a folha (maior grupo sozinho na página) */
  preencher: boolean
}

export type PaginaQuadro = SecaoQuadro[]

// ---------- grupos de função ----------

export const ORDEM_GRUPOS = ['Porteiros', 'Encarregados', 'Limpeza', 'Jardinagem', 'Outros'] as const

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s: string) => semAcento(s.toUpperCase().replace(/\s+/g, ' ').trim())

export function grupoDoCargo(cargo: string | null | undefined): string {
  // só letras, maiúsculas — o legado tem grafias como "AUXILIARDE JARDINAGEM"
  const c = norm(cargo || '').replace(/[^A-Z]/g, '')
  if (c.startsWith('PORTEIRO') || c.startsWith('PORTARIA')) return 'Porteiros'
  if (c.startsWith('ENCARREGADO') || c.startsWith('ENCARREGADA')) return 'Encarregados'
  if (c.startsWith('AUXILIARDESERV') || c.startsWith('AUXDESERV') || c.startsWith('ASG')) return 'Limpeza'
  if (c.includes('JARDINAGEM') || c.startsWith('JARDINEIRO')) return 'Jardinagem'
  return 'Outros'
}

// ---------- horário / escala ----------

const REGIME_BONITO: Record<string, string> = {
  '12x36': '12×36',
  '6x1': '6×1',
  '5x2': '5×2',
  personalizado: 'Personalizado',
}

export function regimeBonito(regime: string | null | undefined): string | null {
  if (!regime) return null
  return REGIME_BONITO[regime] ?? regime
}

/**
 * Extrai o horário do turno da escala Flit (ex.: "19 às 7h CBO MACAÉ VIGIA N.
 * PAR" → "19h às 07h"; "7h às 15:20h CASCAIS ASG 2" → "07h às 15h20").
 * Turno sem "X às Y" (só local/função) devolve null.
 */
export function extrairHorarioDoTurno(turno: string | null | undefined): string | null {
  const s = (turno || '').trim()
  if (!s) return null
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*h?s?\s*às\s*(\d{1,2})(?::(\d{2}))?\s*h?s?/i)
  if (!m) return null
  const fmt = (h: string, min?: string) => `${h.padStart(2, '0')}h${min && min !== '00' ? min : ''}`
  return `${fmt(m[1], m[2])} às ${fmt(m[3], m[4])}`
}

/** Texto da pílula: horário salvo → horário do turno (+ regime) → regime → "conforme escala". */
export function textoHorarioEscala(c: Pick<ColaboradorQuadro, 'horario' | 'turno' | 'regime'>): string {
  const salvo = c.horario?.trim()
  if (salvo) return salvo
  const doTurno = extrairHorarioDoTurno(c.turno)
  const regime = regimeBonito(c.regime)
  if (doTurno && regime) return `${doTurno} · ${regime}`
  if (doTurno) return doTurno
  if (regime) return regime
  return 'conforme escala'
}

// ---------- foco da foto ----------

export const FOCO_PADRAO: FocoFotoQuadro = { zoom: 1, px: 50, py: 20 }

export function normalizarFoco(foco: unknown): FocoFotoQuadro | null {
  if (!foco || typeof foco !== 'object') return null
  const f = foco as Partial<FocoFotoQuadro>
  const zoom = Number(f.zoom)
  const px = Number(f.px)
  const py = Number(f.py)
  if (!Number.isFinite(zoom) || !Number.isFinite(px) || !Number.isFinite(py)) return null
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
  // zoom < 1 = afastar (a área vazia é coberta pela camada de fundo desfocada)
  return { zoom: clamp(zoom, 0.5, 2.5), px: clamp(px, 0, 100), py: clamp(py, 0, 100) }
}

/** CSS do enquadramento (img dentro de contêiner 3×4 com overflow hidden). */
export function cssFocoFoto(foco: FocoFotoQuadro | null): string {
  const f = normalizarFoco(foco) ?? FOCO_PADRAO
  const base = `object-position: ${f.px}% ${f.py}%;`
  if (f.zoom === 1) return base
  return `${base} transform: scale(${f.zoom}); transform-origin: ${f.px}% ${f.py}%;`
}

/** true quando o enquadramento "afasta" (zoom < 1) — precisa da camada de fundo desfocada. */
export function focoAfastado(foco: FocoFotoQuadro | null): boolean {
  return (normalizarFoco(foco) ?? FOCO_PADRAO).zoom < 1
}

// ---------- divisão em páginas ----------

export const LIMITE_UMA_PAGINA = 10
export const CELULAS_POR_FOLHA_CHEIA = 15 // grade 5 × 3

function agrupar(itens: ColaboradorQuadro[]): SecaoQuadro[] {
  const porGrupo = new Map<string, ColaboradorQuadro[]>()
  for (const c of itens) {
    const g = grupoDoCargo(c.funcao)
    if (!porGrupo.has(g)) porGrupo.set(g, [])
    porGrupo.get(g)!.push(c)
  }
  return ORDEM_GRUPOS.filter((g) => porGrupo.has(g)).map((g) => ({
    grupo: g,
    itens: porGrupo.get(g)!,
    preencher: false,
  }))
}

/**
 * Divide o quadro principal (sem feristas) em páginas:
 * - até LIMITE_UMA_PAGINA pessoas: 1 página com as seções empilhadas;
 * - acima disso: o maior grupo fica sozinho na 1ª página (grade elástica que
 *   preenche a folha, fatiada em CELULAS_POR_FOLHA_CHEIA) e os demais grupos
 *   vão empilhados na página seguinte.
 */
export function dividirEmPaginas(itens: ColaboradorQuadro[]): PaginaQuadro[] {
  const secoes = agrupar(itens)
  if (secoes.length === 0) return []
  const total = itens.length
  if (total <= LIMITE_UMA_PAGINA) return [secoes]

  const maior = secoes.reduce((a, b) => (b.itens.length > a.itens.length ? b : a))
  const paginas: PaginaQuadro[] = []
  for (let i = 0; i < maior.itens.length; i += CELULAS_POR_FOLHA_CHEIA) {
    paginas.push([{ grupo: maior.grupo, itens: maior.itens.slice(i, i + CELULAS_POR_FOLHA_CHEIA), preencher: true }])
  }
  const restantes = secoes.filter((s) => s !== maior)
  if (restantes.length > 0) paginas.push(restantes)
  return paginas
}

// ---------- HTML ----------

const PLACEHOLDER_FOTO = `<div class="foto sem-foto"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#b8cbe0"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" fill="#b8cbe0"/></svg></div>`

function cardHtml(c: ColaboradorQuadro): string {
  const fundo = c.fotoDataUrl && focoAfastado(c.foco)
    ? `<img class="foto fundo" src="${escaparHtml(c.fotoDataUrl)}" alt="">`
    : ''
  const foto = c.fotoDataUrl
    ? `${fundo}<img class="foto" style="${cssFocoFoto(c.foco)}" src="${escaparHtml(c.fotoDataUrl)}" alt="">`
    : PLACEHOLDER_FOTO
  const info = textoHorarioEscala(c)
  const vago = info === 'conforme escala'
  return `<div class="card">
  <div class="foto-wrap">${foto}</div>
  <div class="nome">${escaparHtml(c.nome)}</div>
  <div class="cargo">${escaparHtml(c.funcao)}</div>
  <div class="horario${vago ? ' vago' : ''}">${escaparHtml(info)}</div>
</div>`
}

function secaoHtml(s: SecaoQuadro): string {
  return `
  <section class="secao${s.preencher ? ' cresce' : ''}">
    <div class="secao-titulo">${escaparHtml(s.grupo)} <span class="qtd">· ${s.itens.length}</span></div>
    <div class="grade${s.preencher ? ' cheia' : ''}">
${s.itens.map(cardHtml).join('\n')}
    </div>
  </section>`
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

  .secao { margin-bottom: 5mm; break-inside: avoid; page-break-inside: avoid; }
  .secao.cresce { flex: 1; min-height: 0; display: flex; flex-direction: column; margin-bottom: 4mm; }
  .secao-titulo {
    display: flex; align-items: baseline; gap: 2.5mm;
    font-size: 9.5pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    color: #0C1730; margin-bottom: 2.5mm;
  }
  .secao-titulo .qtd { font-size: 7.5pt; font-weight: 600; color: #0F6CBD; letter-spacing: 0.05em; }
  .secao-titulo::after { content: ''; flex: 1; height: 0.4mm; background: #d8e2ee; border-radius: 1mm; align-self: center; }

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
  .foto-wrap { aspect-ratio: 3 / 4; background: #eef3f9; overflow: hidden; position: relative; }
  .grade.cheia .foto-wrap { flex: 1; min-height: 0; aspect-ratio: auto; }
  .foto {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  /* zoom < 1 (afastar): a mesma foto desfocada cobre as bordas vazias */
  .foto.fundo { filter: blur(8px) brightness(0.92); transform: scale(1.15); }
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

  footer {
    margin: auto -9mm 0;
    background: #0C1730;
    color: #cfe0f2;
    font-size: 7pt;
    padding: 2.6mm 9mm;
    display: flex; justify-content: space-between; align-items: center;
  }
  footer b { color: #fff; font-weight: 600; }

  .palco-ferista { flex: 1; display: flex; flex-direction: column; align-items: center; padding-top: 8mm; }
  .palco-ferista .card { width: 62mm; }
  .palco-ferista .card + .card { margin-top: 5mm; }
  .nota-ferista {
    margin-top: 4mm; font-size: 8pt; color: #5a6b85; text-align: center; max-width: 120mm;
  }
`

const FOOTER_HTML = `<footer>
  <span><b>Plena Facilities</b> — Rua Dr. Borman, 23 · salas 1206/1210 · Centro · Niterói/RJ</span>
  <span>Tel: (21) 2621-0111 · www.plenafacilities.com.br</span>
</footer>`

function cabecalhoHtml(logoDataUrl: string, cliente: string, sobre: string): string {
  return `<header>
  <img class="logo" src="${escaparHtml(logoDataUrl)}" alt="Plena">
  <div class="linha-vertical"></div>
  <div class="titulos">
    <div class="sobre">${escaparHtml(sobre)}</div>
    <h1>${escaparHtml(cliente)}</h1>
    <div class="sub">Equipe Plena Facilities atuante neste contrato</div>
  </div>
</header>
<div class="faixa"></div>`
}

export interface DocumentoQuadro {
  cliente: string // nome_curto do departamento (ex.: "Condomínio Chácara do Itaguaí")
  logoDataUrl: string
  paginas: PaginaQuadro[]
}

/** Documento A4 completo do quadro principal (uma <div class="pagina"> por folha). */
export function montarDocumentoQuadro({ cliente, logoDataUrl, paginas }: DocumentoQuadro): string {
  const corpo = paginas
    .map(
      (pagina) => `  <div class="pagina">
${cabecalhoHtml(logoDataUrl, cliente, 'Informativo Operacional · Quadro de Colaboradores')}
${pagina.map(secaoHtml).join('\n')}
${FOOTER_HTML}
  </div>`,
    )
    .join('\n')
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Quadro de Colaboradores — ${escaparHtml(cliente)}</title>
<style>${CSS}</style>
</head>
<body>
${corpo}
</body>
</html>
`
}

/** Folha separada do(s) ferista(s)/faltista(s) — reimprime só ela quando troca. */
export function montarDocumentoFerista(cliente: string, logoDataUrl: string, feristas: ColaboradorQuadro[]): string {
  const cards = feristas.map(cardHtml).join('\n')
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Ferista/Faltista — ${escaparHtml(cliente)}</title>
<style>${CSS}</style>
</head>
<body>
  <div class="pagina">
${cabecalhoHtml(logoDataUrl, cliente, 'Informativo Operacional · Ferista / Faltista')}
    <div class="palco-ferista">
${cards}
      <div class="nota-ferista">Colaborador ferista/faltista — cobre férias e ausências da equipe deste contrato, conforme escala.</div>
    </div>
${FOOTER_HTML}
  </div>
</body>
</html>
`
}
