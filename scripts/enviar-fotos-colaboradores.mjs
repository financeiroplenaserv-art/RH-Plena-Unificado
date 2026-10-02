// Fase 2 — envia as fotos aprovadas para o bucket privado `colaborador-fotos` e grava colaboradores.foto_path.
// Dry-run por padrão; use --aplicar para valer.
//
// Uso:
//   node scripts/enviar-fotos-colaboradores.mjs                      (simulação)
//   node scripts/enviar-fotos-colaboradores.mjs --aplicar
// Opções:
//   --relatorio=<xlsx>        planilha conferida pela usuária (padrão: o relatorio_fotos_*.xlsx mais recente)
//   --limite=N                envia no máximo N fotos (piloto)
//   --sobrescrever            também troca a foto de quem já tem foto_path
//   --incluir-inativos        envia também fotos de colaboradores Inativos (padrão: não)
//   --aceitar-sugestao-conflitos   nos Conflitos sem nenhuma linha marcada "S", usa a sugerida (maior resolução)
//
// O que entra (aprovado):
//   - "certa" do mapeamento_fotos.json (colaborador Ativo/Afastado);
//   - linhas da aba "Quase certas" com APROVAR = S;
//   - linhas da aba "Dúvidas" com CONFIRMAR = S (usa o candidato sugerido);
//   - linhas da aba "Conflitos" com USAR ESTA = S (ou a sugerida, com --aceitar-sugestao-conflitos).
//
// Redução de imagem: sharp (já presente em node_modules, dependência do toolchain Vite/PWA) — rotaciona pela
// orientação EXIF, limita a 600 px no maior lado e grava JPEG qualidade 85 (equivale a 0.85 do canvas do app).
// Se `sharp` não carregar, rode `npm i -D sharp` (alternativa Windows sem dependência: System.Drawing no PowerShell).
//
// Autenticação: SUPABASE_SERVICE_ROLE_KEY do .env (mesmo padrão de lancar-epis-mensal.mjs). A chave nunca é impressa.
// O upload usa o mesmo caminho do app (`<colaborador_id>.jpg`, upsert) — ver enviarFotoColaborador em
// src/lib/ceu/crachasDados.ts. A escrita de foto_path é um UPDATE direto (service role não tem auth.uid() para a
// RPC salvar_dados_cracha) terminando em .select('id') — anti-falso-sucesso.
// DADOS PESSOAIS: as fotos e o mapeamento ficam só em dados-locais/ (ignorado pelo git).

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import * as XLSX from '@e965/xlsx'

function carregarEnv(caminho) {
  for (const linha of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv('.env')

const APLICAR = process.argv.includes('--aplicar')
const SOBRESCREVER = process.argv.includes('--sobrescrever')
const INCLUIR_INATIVOS = process.argv.includes('--incluir-inativos')
const ACEITAR_SUGESTAO = process.argv.includes('--aceitar-sugestao-conflitos')
const argValor = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? null

const RAIZ = path.resolve('dados-locais/Fotos')
const PASTA = path.join(RAIZ, 'fotos')
const BUCKET = 'colaborador-fotos'
const MAX_PX = 600

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
)

// ---------- 1) montar a lista aprovada ----------
const mapa = JSON.parse(fs.readFileSync(path.join(RAIZ, 'mapeamento_fotos.json'), 'utf8')).itens
const porArquivo = new Map(mapa.map((x) => [x.arquivo, x]))

let xlsxPath = argValor('relatorio')
if (!xlsxPath) {
  const achados = fs.readdirSync(RAIZ).filter((f) => /^relatorio_fotos_.*\.xlsx$/.test(f)).sort()
  xlsxPath = achados.length ? path.join(RAIZ, achados[achados.length - 1]) : null
}
const wb = xlsxPath && fs.existsSync(xlsxPath) ? XLSX.read(fs.readFileSync(xlsxPath), { type: 'buffer' }) : null
const linhasDe = (aba) => (wb?.Sheets[aba] ? XLSX.utils.sheet_to_json(wb.Sheets[aba], { defval: '' }) : [])
const sim = (v) => String(v).trim().toUpperCase() === 'S'

const aprovados = new Map() // colaborador_id -> { arquivo, origem, matricula, status }
const avisos = []
function aprovar(item, origem) {
  if (!item.colaborador_id) return
  if (item.status === 'Inativo' && !INCLUIR_INATIVOS) return
  if (aprovados.has(item.colaborador_id)) {
    // Mais de uma foto aprovada para a mesma pessoa: guarda as alternativas e,
    // depois, fica com a de MAIOR resolução (decisão da usuária, 02/10/2026)
    aprovados.get(item.colaborador_id).alternativas.push(item.arquivo)
    return
  }
  aprovados.set(item.colaborador_id, { arquivo: item.arquivo, origem, matricula: item.matricula, status: item.status, alternativas: [item.arquivo] })
}

async function resolucao(arquivo) {
  try {
    const m = await sharp(path.join(PASTA, arquivo), { animated: false }).metadata()
    return (m.width || 0) * (m.height || 0)
  } catch {
    return 0
  }
}

async function escolherMaiorResolucao() {
  for (const a of aprovados.values()) {
    if (a.alternativas.length < 2) continue
    let melhor = a.arquivo, melhorPx = -1
    for (const arq of a.alternativas) {
      const px = await resolucao(arq)
      if (px > melhorPx) { melhor = arq; melhorPx = px }
    }
    avisos.push(`Colaborador ${a.matricula}: ${a.alternativas.length} fotos aprovadas (${a.alternativas.join(' | ')}) — usando a de maior resolução: ${melhor}`)
    a.arquivo = melhor
  }
}

for (const x of mapa) if (x.situacao === 'certa') aprovar(x, 'certa')
if (INCLUIR_INATIVOS) for (const x of mapa) if (x.situacao === 'inativo') aprovar(x, 'inativo')

for (const l of linhasDe('Quase certas')) {
  if (sim(l['APROVAR (S/N)'])) {
    const it = porArquivo.get(l['Arquivo'])
    if (it) aprovar(it, 'quase certa aprovada')
    else avisos.push(`Quase certas: arquivo não está no mapeamento: ${l['Arquivo']}`)
  }
}
for (const l of linhasDe('Dúvidas')) {
  if (sim(l['CONFIRMAR (S/N)'])) {
    const it = porArquivo.get(l['Arquivo'])
    if (it) aprovar(it, 'dúvida confirmada')
    else avisos.push(`Dúvidas: arquivo não está no mapeamento: ${l['Arquivo']}`)
  }
}
// conflitos: linha marcada S; senão (opcional) a sugerida
const confl = linhasDe('Conflitos')
const marcados = new Set(confl.filter((l) => sim(l['USAR ESTA (S)'])).map((l) => l['Arquivo']))
const matriculasComMarca = new Set(confl.filter((l) => sim(l['USAR ESTA (S)'])).map((l) => String(l['Matrícula'])))
for (const x of mapa.filter((m) => m.situacao === 'conflito')) {
  if (marcados.has(x.arquivo)) aprovar(x, 'conflito resolvido')
  else if (ACEITAR_SUGESTAO && x.sugerida && !matriculasComMarca.has(String(x.matricula))) aprovar(x, 'conflito: sugerida')
}

await escolherMaiorResolucao()

// ---------- 2) confrontar com o banco (foto_path atual) ----------
const ids = [...aprovados.keys()]
const atuais = new Map()
for (let i = 0; i < ids.length; i += 100) {
  const { data, error } = await supabase.from('colaboradores').select('id, foto_path').in('id', ids.slice(i, i + 100))
  if (error) { console.error('Erro ao ler colaboradores:', error.message); process.exit(1) }
  for (const c of data) atuais.set(c.id, c.foto_path)
}

const fila = [], pulados = []
for (const [id, a] of aprovados) {
  if (!atuais.has(id)) { pulados.push([a, 'colaborador não encontrado no banco']); continue }
  if (atuais.get(id) && !SOBRESCREVER) { pulados.push([a, 'já tem foto (use --sobrescrever)']); continue }
  fila.push({ id, ...a })
}

// --somente=000743,000815 → restringe a fila a essas matrículas (ex.: reenvio pontual com --sobrescrever)
const SOMENTE = (argValor('somente') || '').split(',').map((s) => s.trim()).filter(Boolean)
if (SOMENTE.length) {
  const manter = fila.filter((f) => SOMENTE.includes(String(f.matricula)))
  fila.length = 0
  fila.push(...manter)
}
const LIMITE = Number(argValor('limite')) || 0
if (LIMITE && fila.length > LIMITE) fila.length = LIMITE
console.log(`Modo: ${APLICAR ? 'APLICAR (grava de verdade)' : 'simulação (dry-run)'}`)
console.log(`Relatório lido: ${xlsxPath ? path.basename(xlsxPath) : '(nenhum — só as "certas")'}`)
console.log(`Aprovadas: ${aprovados.size} | a enviar: ${fila.length} | puladas: ${pulados.length}`)
const porOrigem = {}
for (const f of fila) porOrigem[f.origem] = (porOrigem[f.origem] || 0) + 1
console.log('Por origem:', porOrigem)
for (const [a, motivo] of pulados.slice(0, 20)) console.log(`  pulada ${a.matricula}: ${motivo}`)
avisos.forEach((a) => console.log('  AVISO:', a))

if (!APLICAR) {
  console.log('\nNada foi enviado. Rode novamente com --aplicar para valer.')
  process.exit(0)
}

// ---------- 3) backup + envio ----------
// Carimbo com hora para cada execução ter seu próprio backup (não sobrescrever o lote anterior)
const backup = path.resolve(`dados-locais/backup_colaboradores_foto_path_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`)
fs.writeFileSync(backup, JSON.stringify(fila.map((f) => ({ id: f.id, matricula: f.matricula, foto_path_anterior: atuais.get(f.id) ?? null })), null, 1))
console.log('Backup dos foto_path anteriores:', backup)

let ok = 0
const falhas = []
for (const f of fila) {
  try {
    const buf = await sharp(path.join(PASTA, f.arquivo), { animated: false })
      .rotate()
      .resize({ width: MAX_PX, height: MAX_PX, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85 })
      .toBuffer()
    const caminho = `${f.id}.jpg`
    const up = await supabase.storage.from(BUCKET).upload(caminho, buf, { upsert: true, contentType: 'image/jpeg' })
    if (up.error) throw new Error('upload: ' + up.error.message)
    const { data, error } = await supabase.from('colaboradores').update({ foto_path: caminho }).eq('id', f.id).select('id')
    if (error) throw new Error('foto_path: ' + error.message)
    if (!data?.length) throw new Error('foto_path: nenhuma linha atualizada')
    ok++
  } catch (e) {
    falhas.push(`${f.matricula} (${f.arquivo}): ${e.message}`)
  }
}
console.log(`Enviadas: ${ok} | falhas: ${falhas.length}`)
falhas.forEach((m) => console.log('  FALHA', m))
