// Diagnóstico do erro "Erro ao gerar recibo" (Extras > Recibos).
// Simula o insert exato que o app faz em recibos_extras e imprime o erro completo.
// Uso: node scripts/diagnostico-recibo-extras.mjs
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

const hoje = new Date()
const fmt = (d) => d.toISOString().slice(0, 10)
const inicio = fmt(new Date(hoje.getTime() - 7 * 86400000))
const fim = fmt(hoje)

console.log(`Buscando extras de ${inicio} a ${fim}...`)
const { data: extras, error: errExtras } = await sb
  .from('extras')
  .select('id, data_ocorrencia, substituto_id, substituto_nome, valor, status, gera_extra')
  .gte('data_ocorrencia', inicio)
  .lte('data_ocorrencia', fim)
  .neq('status', 'Cancelado')
  .limit(500)

if (errExtras) {
  console.error('Erro ao ler extras:', errExtras)
  process.exit(1)
}
console.log(`${extras.length} extras no período.`)

const grupo = new Map()
for (const e of extras) {
  if (e.gera_extra === false) continue
  if (!e.substituto_id && !e.substituto_nome) continue
  const chave = e.substituto_id || e.substituto_nome
  if (!grupo.has(chave)) grupo.set(chave, { substituto_id: e.substituto_id, substituto_nome: e.substituto_nome, ids: [], total: 0 })
  const g = grupo.get(chave)
  g.ids.push(e.id)
  g.total += Number(e.valor) || 0
}
console.log(`${grupo.size} grupos de substituto.`)

const [primeiro] = grupo.values()
if (!primeiro) {
  console.log('Nenhum grupo para testar.')
  process.exit(0)
}
console.log('Testando insert para:', primeiro.substituto_nome, '| substituto_id:', primeiro.substituto_id)

// Verifica se o colaborador existe (FK de colaborador_id)
if (primeiro.substituto_id) {
  const { data: colab, error: errColab } = await sb
    .from('colaboradores')
    .select('id, nome_completo')
    .eq('id', primeiro.substituto_id)
    .maybeSingle()
  if (errColab) console.error('Erro ao consultar colaborador:', errColab)
  else console.log('Colaborador encontrado?', colab ? `SIM (${colab.nome_completo})` : 'NÃO — FK FALHARIA!')
}

const payload = {
  colaborador_id: primeiro.substituto_id,
  colaborador_nome: primeiro.substituto_nome,
  data_inicio: inicio,
  data_fim: fim,
  valor_total: primeiro.total,
  quantidade_extras: primeiro.ids.length,
  assinatura_colaborador: null,
  extras_ids: primeiro.ids,
  marcar_pago: false,
  status: 'pendente_assinatura',
  data_assinatura: null,
  usuario_id: null,
}

const { data: inserido, error: errInsert } = await sb
  .from('recibos_extras')
  .insert(payload)
  .select('id')
  .single()

if (errInsert) {
  console.error('INSERT FALHOU:')
  console.error(JSON.stringify(errInsert, null, 2))
  process.exit(1)
}

console.log('INSERT OK, id:', inserido.id, '— removendo o registro de teste...')
const { error: errDel } = await sb.from('recibos_extras').delete().eq('id', inserido.id)
if (errDel) console.error('Falha ao remover teste (remover manualmente):', errDel)
else console.log('Registro de teste removido. O insert em si funciona com service role (bypass RLS).')
