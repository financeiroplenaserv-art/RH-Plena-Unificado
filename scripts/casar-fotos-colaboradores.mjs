// Fase 1 — casa as fotos de dados-locais/Fotos/fotos com os colaboradores (SOMENTE LEITURA).
// Não envia nada ao banco/storage. Gera:
//   dados-locais/Fotos/relatorio_fotos_<data>.xlsx   (para a usuária conferir)
//   dados-locais/Fotos/mapeamento_fotos.json         (entrada da fase 2)
// Entradas (todas em dados-locais/, que é ignorado pelo git):
//   Fotos/fotos/*            fotos nomeadas pelo nome do colaborador
//   Fotos/_colab.json        colaboradores (id, matricula, cpf, nome_completo, status, foto_path)
//   Fotos/_guia_ocr.txt      texto extraído (OCR) das imagens do "Arquivo guia.docx" (opcional)
// Uso: node scripts/casar-fotos-colaboradores.mjs
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import * as XLSX from '@e965/xlsx'

const RAIZ = path.resolve('dados-locais/Fotos')
const PASTA = path.join(RAIZ, 'fotos')
const DATA = new Date().toISOString().slice(0, 10)
const SUFIXO = '_v2'

// mesmo normalizador do projeto (src/lib/ceu/importarEntregas.ts), em maiúsculas
const norm = (s) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

const cpfDig = (c) => String(c || '').replace(/\D/g, '').padStart(11, '0')
const STOP = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E'])
const FUNCOES = new Set(['PORTEIRO', 'ASG', 'TECH', 'VIGIA', 'ZELADOR', 'FILHO', 'JR', 'NETO'].filter((x) => !['FILHO', 'JR', 'NETO'].includes(x)))

function lev(a, b) {
  const m = a.length, n = b.length
  if (!m) return n
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}

// ---------- colaboradores ----------
const colabs = JSON.parse(fs.readFileSync(path.join(RAIZ, '_colab.json'), 'utf8').replace(/^﻿/, ''))
for (const c of colabs) {
  c.n = norm(c.nome_completo)
  c.tok = c.n.split(' ').filter((t) => t && !STOP.has(t))
  c.cpfd = cpfDig(c.cpf)
  c.ativo = c.status !== 'Inativo' // Ativo e Afastado seguem vinculados
}
const porNome = new Map()
for (const c of colabs) {
  if (!porNome.has(c.n)) porNome.set(c.n, [])
  porNome.get(c.n).push(c)
}

// ---------- arquivo guia (OCR) ----------
const guia = [] // { nome, cpfOcr, colab, via }
const noGuia = new Set()
const arqOcr = path.join(RAIZ, '_guia_ocr.txt')
if (fs.existsSync(arqOcr)) {
  const grupos = {}
  for (const l of fs.readFileSync(arqOcr, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const [img, ...r] = l.split('\t')
    if (!img) continue
    ;(grupos[img] ||= []).push(r.join('\t').trim())
  }
  for (const linhas of Object.values(grupos)) {
    const nomes = [], cpfs = []
    for (const t of linhas) {
      const dig = (t.match(/\d/g) || []).length
      const letras = (t.match(/[A-Za-z]/g) || []).length
      if (dig >= 8 && /-/.test(t)) cpfs.push(t.replace(/\D/g, ''))
      else if (letras >= 5 && dig === 0 && t.toLowerCase() !== 'logo') nomes.push(t)
    }
    nomes.forEach((nome, i) => guia.push({ nome: norm(nome.replace(/\.\.\.$/, '')), cpfOcr: nomes.length === cpfs.length ? cpfs[i] : null }))
  }
  for (const g of guia) {
    // regra 1: CPF (tolerando erros de OCR) — único colaborador a distância <= 2
    if (g.cpfOcr && g.cpfOcr.length >= 9) {
      const hit = colabs.filter((c) => lev(c.cpfd, g.cpfOcr) <= 2)
      if (hit.length === 1) { g.colab = hit[0]; g.via = 'cpf' }
    }
    if (!g.colab) {
      const ex = porNome.get(g.nome)
      if (ex?.length === 1) { g.colab = ex[0]; g.via = 'nome' }
      else {
        const ord = colabs.map((c) => [lev(c.n, g.nome) / Math.max(c.n.length, g.nome.length), c]).sort((a, b) => a[0] - b[0])
        if (ord[0] && ord[0][0] <= 0.12 && (!ord[1] || ord[1][0] - ord[0][0] > 0.05)) { g.colab = ord[0][1]; g.via = 'nome aproximado' }
      }
    }
    if (g.colab) noGuia.add(g.colab.id)
  }
}

// ---------- arquivos ----------
const EXT_IMG = /\.(jpe?g|png|gif)$/i
const todos = fs.readdirSync(PASTA)
const ignorados = []
const imagens = []
const LIXO = /^(IMG-|Nota |MENSAGEM|Microsoft|CARTEIRAS|RELATORIO|Aniversariantes|FOTOS\b|altlib|Thumbs)/i
for (const f of todos) {
  if (!EXT_IMG.test(f)) { ignorados.push([f, 'não é imagem (extensão ' + path.extname(f) + ')']); continue }
  if (LIXO.test(f) || /\.pptx\.jpg$/i.test(f)) { ignorados.push([f, 'imagem que não é foto de colaborador (documento/mensagem/print)']); continue }
  imagens.push(f)
}

function nomeDoArquivo(f) {
  let s = f.replace(EXT_IMG, '')
  s = s.replace(/\(.*?\)/g, ' ').replace(/[_\-]+/g, ' ')
  s = norm(s)
  s = s.replace(/\b\d{1,2}\.\d{1,2}(\.\d{2,4})?\b/g, ' ') // datas soltas
  const antes = s
  s = s.replace(/(?<=[A-Z])\d+\b/g, ' ').replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim()
  return { limpo: s, numerado: s !== antes }
}

function tokOk(f, d) {
  if (f === d) return true
  if (f.length === 1 && d[0] === f) return true // inicial
  if (f.length >= 5 && d.length >= 5 && lev(f, d) <= 1) return true
  return false
}
// F é subsequência ordenada de D (cada token de F casa com um token de D, na ordem)
function subseq(F, D) {
  let j = 0
  for (const f of F) {
    while (j < D.length && !tokOk(f, D[j])) j++
    if (j >= D.length) return false
    j++
  }
  return true
}

const info = {}
for (const f of imagens) {
  const st = fs.statSync(path.join(PASTA, f))
  let w = 0, h = 0
  try { const m = await sharp(path.join(PASTA, f)).metadata(); w = m.width || 0; h = m.height || 0 } catch { /* corrompida */ }
  info[f] = { tamanho: st.size, mtime: st.mtime, w, h }
}

const certasPorColab = new Map() // id -> [{arquivo, criterio}]
const duvidas = []
for (const f of imagens) {
  if (!info[f].w) { ignorados.push([f, 'imagem ilegível/corrompida']); continue }
  const { limpo, numerado } = nomeDoArquivo(f)
  const bruto = norm(f.replace(EXT_IMG, ''))
  let c = null, crit = ''
  const ex = porNome.get(bruto) || (numerado ? porNome.get(limpo) : null)
  if (ex && ex.length === 1) {
    c = ex[0]
    crit = porNome.get(bruto) ? 'nome do arquivo = nome do cadastro' : 'nome igual ao cadastro (número/data no fim do arquivo ignorado)'
  } else if (ex && ex.length > 1) {
    duvidas.push({ f, cands: ex, motivo: 'mais de um colaborador com o mesmo nome' })
    continue
  }
  if (c) {
    if (!certasPorColab.has(c.id)) certasPorColab.set(c.id, [])
    certasPorColab.get(c.id).push({ f, crit, c })
    continue
  }
  // fuzzy -> sempre dúvida
  const F = limpo.split(' ').filter((t) => t && !STOP.has(t) && !FUNCOES.has(t))
  let cands = []
  if (F.length) {
    cands = colabs
      .filter((d) => d.tok.length && tokOk(F[0], d.tok[0]) && (subseq(F, d.tok) || (d.tok.length >= 2 && subseq(d.tok, F))))
      .map((d) => ({ d, pts: F.filter((t) => d.tok.some((x) => x === t)).length + (noGuia.has(d.id) ? 0.5 : 0) + (d.ativo ? 0.25 : 0) }))
      .sort((a, b) => b.pts - a.pts)
      .map((x) => x.d)
  }
  let motivo = 'nome do arquivo não bate com o cadastro (abreviação, nome incompleto ou grafia diferente)'
  if (!cands.length) motivo = 'nenhum candidato no cadastro (provável ex-colaborador não cadastrado ou nome muito diferente)'
  else if (cands[0].tok.join(' ') === F.join(' ')) motivo = 'só difere por preposição (DA/DE/DO) ou função no fim do nome — provável mesma pessoa'
  else if (cands.length > 1) motivo += '; vários candidatos possíveis'
  duvidas.push({ f, cands: cands.slice(0, 4), total: cands.length, motivo, tokArq: limpo.split(' ').filter((t) => t && !STOP.has(t)) })
}

// ---------- separar certas / conflitos / inativos ----------
const certas = [], conflitos = [], inativos = []
for (const lista of certasPorColab.values()) {
  const c = lista[0].c
  if (!c.ativo) { lista.forEach((x) => inativos.push(x)); continue }
  if (lista.length === 1) certas.push(lista[0])
  else {
    const ord = [...lista].sort((a, b) => (info[b.f].w * info[b.f].h) - (info[a.f].w * info[a.f].h) || info[b.f].mtime - info[a.f].mtime)
    ord.forEach((x, i) => conflitos.push({ ...x, sugerida: i === 0 }))
  }
}
const idsComFoto = new Set([...certas.map((x) => x.c.id), ...conflitos.map((x) => x.c.id)])
const ativosSemFoto = colabs.filter((c) => c.ativo && !idsComFoto.has(c.id))
// dúvidas com candidato ativo sem foto são sugestões úteis — anotar
const semFotoIds = new Set(ativosSemFoto.map((c) => c.id))

// ---------- separar dúvidas: quase certas / dúvidas / descartadas ----------
const quaseCand = new Map()
for (const d of duvidas) {
  if (d.cands.length === 1 && d.cands[0].ativo && semFotoIds.has(d.cands[0].id) && d.tokArq?.join(' ') === d.cands[0].tok.join(' '))
    quaseCand.set(d.cands[0].id, (quaseCand.get(d.cands[0].id) || 0) + 1)
}
const quase = [], duvidasFinal = [], descartadas = []
for (const d of duvidas) {
  const c0 = d.cands[0]
  if (d.cands.length === 1 && c0.ativo && semFotoIds.has(c0.id) && d.tokArq?.join(' ') === c0.tok.join(' ') && quaseCand.get(c0.id) === 1) quase.push(d)
  else if (!d.cands.length) descartadas.push([d, 'sem candidato no cadastro (provável ex-colaborador não cadastrado)'])
  else if (!d.cands.some((c) => c.ativo)) descartadas.push([d, 'candidato(s) só entre inativos'])
  else duvidasFinal.push(d)
}

// ---------- planilha ----------
const dim = (f) => `${info[f].w}x${info[f].h}`
const kb = (f) => Math.round(info[f].tamanho / 1024)
const dt = (f) => info[f].mtime.toISOString().slice(0, 10)
const sheets = {
  Certas: [['Arquivo', 'Matrícula', 'Nome no cadastro', 'Situação', 'Critério', 'No arquivo guia?', 'Dimensões', 'KB'],
    ...certas.sort((a, b) => a.c.n.localeCompare(b.c.n)).map((x) => [x.f, x.c.matricula, x.c.nome_completo, x.c.status, x.crit, noGuia.has(x.c.id) ? 'sim' : 'não', dim(x.f), kb(x.f)])],
  'Quase certas': [['Arquivo', 'Candidato', 'Matrícula', 'Situação', 'Motivo', 'APROVAR (S/N)'],
    ...quase.sort((a, b) => a.cands[0].n.localeCompare(b.cands[0].n)).map((x) => [x.f, x.cands[0].nome_completo, x.cands[0].matricula, x.cands[0].status, 'único candidato, ativo sem foto; só difere por preposição, acento ou pontuação', 'S'])],
  Dúvidas: [['Arquivo', 'Candidato sugerido', 'Matrícula', 'Situação', 'Ativo sem foto?', 'Outros candidatos', 'Motivo', 'CONFIRMAR (S/N)'],
    ...duvidasFinal.sort((a, b) => (semFotoIds.has(b.cands[0]?.id) - semFotoIds.has(a.cands[0]?.id)) || a.f.localeCompare(b.f)).map((x) => {
      const [p, ...r] = x.cands
      return [x.f, p?.nome_completo || '', p?.matricula || '', p?.status || '', p ? (semFotoIds.has(p.id) ? 'sim' : 'não') : '', r.map((y) => `${y.nome_completo} (${y.matricula}, ${y.status})`).join(' | '), x.motivo, '']
    })],
  Conflitos: [['Matrícula', 'Nome no cadastro', 'Arquivo', 'Dimensões', 'KB', 'Modificado em', 'Sugestão (maior resolução)', 'USAR ESTA (S)'],
    ...conflitos.sort((a, b) => a.c.n.localeCompare(b.c.n) || (b.sugerida - a.sugerida)).map((x) => [x.c.matricula, x.c.nome_completo, x.f, dim(x.f), kb(x.f), dt(x.f), x.sugerida ? 'sugerida' : '', ''])],
  Inativos: [['Arquivo', 'Matrícula', 'Nome no cadastro', 'Situação', 'Critério'],
    ...inativos.sort((a, b) => a.c.n.localeCompare(b.c.n)).map((x) => [x.f, x.c.matricula, x.c.nome_completo, x.c.status, x.crit])],
  'Ativos sem foto': [['Matrícula', 'Nome no cadastro', 'Situação', 'No arquivo guia?', 'Possível foto em Dúvidas'],
    ...ativosSemFoto.sort((a, b) => a.n.localeCompare(b.n)).map((c) => [c.matricula, c.nome_completo, c.status, noGuia.has(c.id) ? 'sim' : 'não',
      duvidas.filter((d) => d.cands.some((y) => y.id === c.id)).map((d) => d.f).join(' | ')])],
  Descartadas: [['Arquivo', 'Motivo', 'Candidato (se houver)', 'Matrícula', 'Situação'],
    ...descartadas.sort((a, b) => a[0].f.localeCompare(b[0].f)).map(([d, m]) => [d.f, m, d.cands[0]?.nome_completo || '', d.cands[0]?.matricula || '', d.cands[0]?.status || ''])],
  Ignorados: [['Arquivo', 'Motivo'], ...ignorados.sort((a, b) => a[0].localeCompare(b[0]))],
}
const wb = XLSX.utils.book_new()
for (const [nome, linhas] of Object.entries(sheets)) {
  const ws = XLSX.utils.aoa_to_sheet(linhas)
  ws['!cols'] = linhas[0].map((_, i) => ({ wch: Math.min(60, Math.max(10, ...linhas.slice(0, 200).map((r) => String(r[i] ?? '').length)) + 2) }))
  XLSX.utils.book_append_sheet(wb, ws, nome)
}
const arqXlsx = path.join(RAIZ, `relatorio_fotos_${DATA}${SUFIXO}.xlsx`)
fs.writeFileSync(arqXlsx, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

// ---------- mapeamento para a fase 2 ----------
const mapa = []
for (const x of certas) mapa.push({ arquivo: x.f, colaborador_id: x.c.id, matricula: x.c.matricula, status: x.c.status, criterio: x.crit, situacao: 'certa' })
for (const x of conflitos) mapa.push({ arquivo: x.f, colaborador_id: x.c.id, matricula: x.c.matricula, status: x.c.status, criterio: x.crit, situacao: 'conflito', sugerida: x.sugerida })
for (const x of inativos) mapa.push({ arquivo: x.f, colaborador_id: x.c.id, matricula: x.c.matricula, status: x.c.status, criterio: x.crit, situacao: 'inativo' })
const mp = (x, situacao) => ({ arquivo: x.f, colaborador_id: x.cands[0]?.id || null, matricula: x.cands[0]?.matricula || null, status: x.cands[0]?.status || null, criterio: 'fuzzy', situacao })
for (const x of quase) mapa.push(mp(x, 'quase_certa'))
for (const x of duvidasFinal) mapa.push(mp(x, 'duvida'))
for (const [x] of descartadas) mapa.push(mp(x, 'descartada'))
fs.writeFileSync(path.join(RAIZ, 'mapeamento_fotos.json'), JSON.stringify({ gerado_em: new Date().toISOString(), itens: mapa }, null, 1))

const ativosTotal = colabs.filter((c) => c.ativo).length
console.log(JSON.stringify({
  arquivos_na_pasta: todos.length, imagens_validas: imagens.length - ignorados.filter((i) => imagens.includes(i[0])).length,
  ignorados: ignorados.length, certas: certas.length, quase_certas: quase.length, duvidas: duvidasFinal.length, descartadas: descartadas.length, descartadas_sem_candidato: descartadas.filter(([d]) => !d.cands.length).length,
  conflitos_colaboradores: new Set(conflitos.map((x) => x.c.id)).size, conflitos_arquivos: conflitos.length,
  inativos_fotos: inativos.length, ativos_total: ativosTotal, ativos_sem_foto: ativosSemFoto.length,
  guia_linhas: guia.length, guia_casadas: guia.filter((g) => g.colab).length, guia_via: guia.reduce((a, g) => ((a[g.via || 'sem'] = (a[g.via || 'sem'] || 0) + 1), a), {}),
  ativos_no_guia: colabs.filter((c) => c.ativo && noGuia.has(c.id)).length,
  certas_no_guia: certas.filter((x) => noGuia.has(x.c.id)).length,
}, null, 1))
console.log('relatório:', arqXlsx)
