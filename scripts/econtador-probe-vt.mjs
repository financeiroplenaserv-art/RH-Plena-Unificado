/**
 * Diagnóstico pontual (não é feature): descobre QUAIS atributos a API do
 * e-Contador devolve em GET /funcionarios, procurando dados de vale-transporte
 * (valestrasnportes, percentual VT, salário).
 *
 * Uso (Git Bash, na raiz do projeto):
 *   read -s -p "Cole o token ePlugin e tecle Enter (não aparece): " T; echo
 *   ECONTADOR_PROBE_TOKEN="$T" node scripts/econtador-probe-vt.mjs; unset T
 *
 * O token NUNCA é impresso, gravado em arquivo ou enviado a outro lugar —
 * só vai no header Authorization das chamadas à própria Alterdata.
 */

const BASE = 'https://dp.pack.alterdata.com.br/api/v1'
const TOKEN = process.env.ECONTADOR_PROBE_TOKEN

if (!TOKEN) {
  console.error('Token não informado. Rode com ECONTADOR_PROBE_TOKEN (veja o cabeçalho do script).')
  process.exit(1)
}

const alvos = ['000773', '000756'] // Aline (com %VT=6) e Marcelo (sem %VT) — dos prints
const chavesInteresse = /vale|transpor|salario|percent|vt/i

async function get(caminho) {
  const resp = await fetch(`${BASE}${caminho}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.api+json' },
  })
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => '')
    throw new Error(`HTTP ${resp.status} em ${caminho}: ${corpo.slice(0, 300)}`)
  }
  return resp.json()
}

// 1) Empresas da conta — acha as Plena
const empresasResp = await get('/empresas?page[limit]=100')
const empresas = (empresasResp.data || []).map((e) => ({
  id: String(e.id),
  nome: String(e.attributes?.nome || e.attributes?.razaosocial || ''),
}))
console.log(`\n=== EMPRESAS NA CONTA (${empresas.length}) ===`)
for (const e of empresas) console.log(`  ${e.id}  ${e.nome}`)

const plenas = empresas.filter((e) => /plena/i.test(e.nome))
if (plenas.length === 0) {
  console.log('\nNenhuma empresa com "Plena" no nome. Informe o id manualmente no script.')
  process.exit(0)
}

// 2) Funcionários de cada Plena — coleta TODAS as chaves de atributo
const todasChaves = new Set()
const encontrados = []
let totalLidos = 0

for (const emp of plenas) {
  let offset = 0
  for (let pagina = 0; pagina < 15; pagina++) {
    const resp = await get(
      `/funcionarios?filter[funcionarios][empresa.id][EQ]=${encodeURIComponent(emp.id)}&page[limit]=100&page[offset]=${offset}`,
    )
    const lista = resp.data || []
    if (lista.length === 0) break
    totalLidos += lista.length
    for (const f of lista) {
      const attrs = f.attributes || {}
      for (const k of Object.keys(attrs)) todasChaves.add(k)
      const codigo = String(attrs.codigo ?? '')
      if (alvos.includes(codigo)) {
        encontrados.push({ empresa: emp.nome, codigo, nome: attrs.nome, attrs })
      }
    }
    if (!resp.links?.next) break
    offset += 100
  }
}

console.log(`\n=== FUNCIONÁRIOS LIDOS: ${totalLidos} ===`)
console.log(`\n=== TODOS OS ATRIBUTOS QUE A API DEVOLVE (${todasChaves.size}) ===`)
console.log([...todasChaves].sort().join(', '))

const chavesVt = [...todasChaves].filter((k) => chavesInteresse.test(k))
console.log(`\n=== ATRIBUTOS RELACIONADOS A VT/SALÁRIO (${chavesVt.length}) ===`)
console.log(chavesVt.length ? chavesVt.join(', ') : '(nenhum encontrado)')

console.log('\n=== PESSOAS DOS PRINTS ===')
if (encontrados.length === 0) {
  console.log('Aline (000773) e Marcelo (000756) não encontrados nas empresas Plena.')
}
for (const p of encontrados) {
  console.log(`\n--- ${p.nome} (cód. ${p.codigo}, ${p.empresa}) ---`)
  for (const k of [...Object.keys(p.attrs)].sort()) {
    if (chavesInteresse.test(k)) console.log(`  ${k} = ${JSON.stringify(p.attrs[k])}`)
  }
}
console.log('\nFim. O token não foi gravado em lugar nenhum.')
