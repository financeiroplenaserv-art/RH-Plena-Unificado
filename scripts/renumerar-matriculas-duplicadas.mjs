// Renumera matrículas duplicadas dos registros importados em 25/06/2026
// (lote de ex-colaboradores do sistema antigo) com prefixo ANT-.
// Decisão da usuária em 29/07/2026. Quem está no quadro atual mantém a matrícula.
// Uso: node scripts/renumerar-matriculas-duplicadas.mjs [--aplicar]
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function carregarEnv(caminho) {
  if (!fs.existsSync(caminho)) return
  for (const linha of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    const t = linha.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv(path.resolve(process.cwd(), '.env'))

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

// registros a renumerar: os do lote antigo (criados em 25/06), identificados por nome
const RENUMERAR = [
  { nome: 'ROSANE GONÇALO DA S. OLIVEIRA', matriculaAtual: '000016' },
  { nome: 'ISANEIVA TEIXEIRA PEREIRA', matriculaAtual: '000017' },
  { nome: 'ELZA COLODINA DE MELO', matriculaAtual: '000008' },
  { nome: 'NADIA MARIA DA SILVA DE LIMA', matriculaAtual: '000003' },
]

const aplicar = process.argv.includes('--aplicar')

const plano = []
let problemas = 0
for (const item of RENUMERAR) {
  const { data, error } = await sb
    .from('colaboradores')
    .select('id, nome_completo, matricula, status, created_at')
    .eq('matricula', item.matriculaAtual)
  if (error) throw error
  const alvo = data.find((c) => c.nome_completo === item.nome)
  if (!alvo) {
    console.log(`❌ Registro não encontrado: ${item.nome} (${item.matriculaAtual})`)
    problemas++
    continue
  }
  if (data.length !== 2) {
    console.log(`⚠️  Matrícula ${item.matriculaAtual} tem ${data.length} registro(s), esperado 2 — revisar manualmente`)
    problemas++
    continue
  }
  const novaMatricula = `ANT-${item.matriculaAtual}`
  // garante que a nova matrícula não colide com nada
  const { data: colisao } = await sb.from('colaboradores').select('id').eq('matricula', novaMatricula)
  if (colisao && colisao.length > 0) {
    console.log(`❌ ${novaMatricula} já existe — escolher outro padrão`)
    problemas++
    continue
  }
  console.log(`✅ ${alvo.nome_completo} (${alvo.status}) — ${item.matriculaAtual} → ${novaMatricula}`)
  plano.push({ id: alvo.id, de: item.matriculaAtual, para: novaMatricula, nome: alvo.nome_completo })
}

if (problemas > 0) {
  console.log(`\n⛔ ${problemas} problema(s). Nada foi alterado.`)
  process.exit(1)
}
if (!aplicar) {
  console.log('\nDry-run OK. Rode com --aplicar para executar (faz backup local antes).')
  process.exit(0)
}

// backup local das linhas afetadas
const { data: backup, error: eB } = await sb
  .from('colaboradores').select('*').in('id', plano.map((p) => p.id))
if (eB) throw eB
const arquivoBackup = path.resolve('dados-locais', `backup_colaboradores_renumeracao_${new Date().toISOString().slice(0, 10)}.json`)
fs.writeFileSync(arquivoBackup, JSON.stringify(backup, null, 2))
console.log(`\nBackup local: ${arquivoBackup} (${backup.length} linhas)`)

for (const p of plano) {
  const { error } = await sb.from('colaboradores').update({ matricula: p.para }).eq('id', p.id)
  if (error) throw error
  console.log(`✔ ${p.nome}: ${p.de} → ${p.para}`)
}

// verificação final: nenhuma matrícula duplicada pode restar
const pagina = 1000
let from = 0
const todos = []
for (;;) {
  const { data } = await sb.from('colaboradores').select('matricula').range(from, from + pagina - 1)
  todos.push(...data)
  if (data.length < pagina) break
  from += pagina
}
const contagem = new Map()
for (const c of todos) {
  const m = (c.matricula || '').trim()
  contagem.set(m, (contagem.get(m) || 0) + 1)
}
const dups = [...contagem.entries()].filter(([, n]) => n > 1)
const vazias = contagem.get('') || 0
console.log(`\nVerificação: ${dups.length} matrícula(s) duplicada(s) restante(s); ${vazias} vazia(s).`)
if (dups.length > 0) {
  console.log('Duplicadas:', dups.map(([m, n]) => `${m}×${n}`).join(', '))
  process.exit(1)
}
console.log('✅ Pronto para o índice único.')
