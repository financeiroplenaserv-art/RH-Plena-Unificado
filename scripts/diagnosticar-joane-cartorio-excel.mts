// Baixa o Excel de escala mais recente do bucket escala-arquivos e mostra
// como são as linhas da JOANE (dispositivo, perímetro, departamento, turno),
// para explicar por que a inferência não resolve o local dela.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { parseWorkbookBinary, agruparBatidasPorDia } from '../src/lib/escalas/importarFlit'

function carregarEnv(caminho: string) {
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
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const { data: arquivos, error: e1 } = await sb
  .from('escala_arquivos')
  .select('id, nome_arquivo, storage_path, created_at')
  .order('created_at', { ascending: false })
  .limit(3)
if (e1) throw e1
console.log('Arquivos recentes:', arquivos?.map((a) => `${a.nome_arquivo} (${a.created_at})`))

const arquivo = arquivos?.[0]
if (!arquivo) {
  console.log('Nenhum arquivo salvo no servidor.')
  process.exit(0)
}

const { data: blob, error: e2 } = await sb.storage.from('escala-arquivos').download(arquivo.storage_path)
if (e2) throw e2
const buffer = Buffer.from(await blob.arrayBuffer())
console.log(`\nBaixado: ${arquivo.nome_arquivo} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`)

const dias = agruparBatidasPorDia(await parseWorkbookBinary(buffer))
const diasJoane = dias.filter((d) => d.nomeColaborador.toUpperCase().includes('JOANE'))
console.log(`\n=== ${diasJoane.length} dia(s) da Joane no Excel ===`)
for (const d of diasJoane) {
  console.log(`  ${d.data} | tipoDisp="${d.tipoDispositivo}" | nomeDisp="${d.nomeDispositivo}" | perimetro="${d.perimetro}" | depto="${d.departamento}" | turno="${d.turno}" | batidas=${d.batidas.length}`)
}

// Panorama: quais valores distintos de dispositivo/perímetro/departamento aparecem
// para todo mundo, contendo "CART" — para ver se alguém bate ponto no Cartório
const vistos = new Map<string, number>()
for (const d of dias) {
  for (const [campo, valor] of [
    ['nomeDisp', d.nomeDispositivo],
    ['perimetro', d.perimetro],
    ['depto', d.departamento],
  ] as const) {
    if (valor && valor.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes('CART')) {
      const chave = `${campo}="${valor}"`
      vistos.set(chave, (vistos.get(chave) || 0) + 1)
    }
  }
}
console.log('\n=== Valores com "CART..." em qualquer colaborador do Excel ===')
if (vistos.size === 0) console.log('  (nenhum)')
for (const [k, n] of vistos) console.log(`  ${n}x | ${k}`)
