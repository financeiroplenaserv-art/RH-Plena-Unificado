// Busca possíveis ocorrências de TESTE: títulos muito curtos/lixo criados
// em julho/2026, mais os Refs citados no handoff (81A0EC78, 25A4EDC6, DA91A7B0).
const fs = require('fs')

const env = fs.readFileSync('.env', 'utf8')
const get = (k) => (env.match(new RegExp(k + '=(.+)')) || [])[1]?.trim()
const url = get('VITE_SUPABASE_URL')
const key = get('SUPABASE_SERVICE_ROLE_KEY') || get('SUPABASE_SERVICE_KEY')
const H = { apikey: key, Authorization: 'Bearer ' + key }

const REFS_TESTE = ['81a0ec78', '25a4edc6', 'da91a7b0']
const PADROES_LIXO = /^(d+|g+|a+|s+|f+|q+|w+|e+|x+|z+|1+|12+|123+|teste.*|asdf.*|sdsd.*|dsa.*|fds.*|hj.*|kk+|ll+|çç+|\.+|\s*)$/i

async function main() {
  // Busca todas criadas em julho/2026 (inclui as importações, filtradas depois)
  const de = '2026-07-01T00:00:00-03:00'
  const q =
    `${url}/rest/v1/ocorrencias` +
    `?created_at=gte.${encodeURIComponent(de)}` +
    `&select=id,titulo,colaborador_nome,tipo_ocorrencia,status,created_at` +
    `&order=created_at.desc&limit=10000`
  const res = await fetch(q, { headers: H })
  if (!res.ok) {
    console.error('Erro:', res.status, await res.text())
    process.exit(1)
  }
  const rows = await res.json()
  console.log(`Total criadas desde 01/07: ${rows.length}`)

  const suspeitas = rows.filter((r) => {
    const ref = r.id.substring(0, 8)
    const titulo = (r.titulo || '').trim()
    if (REFS_TESTE.includes(ref)) return true
    if (titulo.length <= 8 && PADROES_LIXO.test(titulo)) return true
    return false
  })

  console.log(`Suspeitas de teste: ${suspeitas.length}\n`)
  for (const r of suspeitas) {
    console.log(
      `${r.id.substring(0, 8)} | ${r.created_at.substring(0, 16)} | ${String(r.status).padEnd(10)} | título: "${r.titulo}" | ${r.colaborador_nome || '-'}`
    )
  }
}

main()
