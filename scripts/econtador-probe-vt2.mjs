/**
 * Diagnóstico 2 (pontual): testa se a API do e-Contador devolve dados de
 * vale-transporte quando os campos são pedidos EXPLICITAMENTE via
 * fields[funcionarios]=... (o pacote padrão não traz — ver probe 1).
 *
 * Uso (Git Bash, na raiz do projeto):
 *   read -s -p "Cole o token e tecle Enter (não aparece): " T; echo
 *   ECONTADOR_PROBE_TOKEN="$T" node scripts/econtador-probe-vt2.mjs; unset T
 */

const BASE = 'https://dp.pack.alterdata.com.br/api/v1'
const TOKEN = process.env.ECONTADOR_PROBE_TOKEN
const EMPRESA = '34' // PLENA EA FACILITIES (onde estão Aline e Marcelo)
const alvos = ['000773', '000756']

const candidatos = [
  'valestrasnportes',        // nome na doc de pré-admissão (com o typo deles)
  'valestransportes',        // sem o typo
  'valetransporte',
  'percentualvaletransporte',
  'percentualvt',
  'percvt',
  'optantevaletransporte',
  'usavaletransporte',
  'descontavaletransporte',
]

if (!TOKEN) {
  console.error('Token não informado. Veja o cabeçalho do script.')
  process.exit(1)
}

async function getRaw(caminho) {
  const resp = await fetch(`${BASE}${caminho}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.api+json' },
  })
  const texto = await resp.text()
  let json = null
  try { json = JSON.parse(texto) } catch { /* corpo não-JSON */ }
  return { status: resp.status, json, texto }
}

// 0) Pré-checagem de autenticação: sem token válido, NADA do teste vale
const pre = await getRaw(
  `/funcionarios?filter[funcionarios][empresa.id][EQ]=${EMPRESA}&page[limit]=1&fields[funcionarios]=codigo,nome`,
)
if (pre.status === 401 || pre.status === 403) {
  console.log('*** TOKEN VAZIO OU INVÁLIDO (HTTP ' + pre.status + ') ***')
  console.log('O teste NÃO rodou. Copie o token de novo no eContador e repita os 2 comandos.')
  process.exit(1)
}
if (pre.status !== 200) {
  console.log(`Resposta inesperada da API (HTTP ${pre.status}). Tente de novo em alguns minutos.`)
  process.exit(1)
}
console.log('Token aceito pela API. Testando os campos...\n')

// 1) Para cada candidato: pede 1 funcionário com fields=codigo,nome,<cand>
console.log('=== TESTE DE CAMPOS EXPLÍCITOS (Plena EA) ===')
const aceitos = []
for (const c of candidatos) {
  const r = await getRaw(
    `/funcionarios?filter[funcionarios][empresa.id][EQ]=${EMPRESA}&page[limit]=1&fields[funcionarios]=codigo,nome,${encodeURIComponent(c)}`,
  )
  if (r.status !== 200) {
    const motivo = r.status === 400 ? 'campo NÃO existe na API' : `erro HTTP ${r.status}`
    console.log(`  ${c}: ${motivo}`)
    continue
  }
  const attrs = r.json?.data?.[0]?.attributes || {}
  const presente = c in attrs
  console.log(`  ${c}: ${presente ? 'VENHA NA RESPOSTA ✔' : 'aceito, mas não veio'}`)
  if (presente) aceitos.push(c)
}

// 2) Se algum campo veio, percorre a Plena EA e mostra o valor na Aline e no Marcelo
if (aceitos.length === 0) {
  console.log('\nNenhum campo de VT disponível nem por pedido explícito.')
  console.log('Conclusão: a API não expõe o flag de VT nem a lista de vales.')
} else {
  console.log(`\n=== VALORES DOS CAMPOS ENCONTRADOS (${aceitos.join(', ')}) ===`)
  const encontrados = []
  let offset = 0
  for (let pagina = 0; pagina < 15 && encontrados.length < alvos.length; pagina++) {
    const r = await getRaw(
      `/funcionarios?filter[funcionarios][empresa.id][EQ]=${EMPRESA}&page[limit]=100&page[offset]=${offset}&fields[funcionarios]=codigo,nome,${aceitos.map(encodeURIComponent).join(',')}`,
    )
    const lista = r.json?.data || []
    if (lista.length === 0) break
    for (const f of lista) {
      const attrs = f.attributes || {}
      if (alvos.includes(String(attrs.codigo ?? ''))) {
        encontrados.push({ nome: attrs.nome, codigo: attrs.codigo, attrs })
      }
    }
    if (!r.json?.links?.next) break
    offset += 100
  }
  for (const p of encontrados) {
    console.log(`\n--- ${p.nome} (cód. ${p.codigo}) ---`)
    for (const c of aceitos) console.log(`  ${c} = ${JSON.stringify(p.attrs[c])}`)
  }
  if (encontrados.length === 0) console.log('Aline e Marcelo não encontrados na paginação.')
}
console.log('\nFim. O token não foi gravado em lugar nenhum.')
