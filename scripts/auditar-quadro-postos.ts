// Auditoria (somente leitura) do Quadro de Colaboradores:
// replica a lógica da página (postosDisponiveis + idsColaboradoresDoDepartamento)
// contra os dados de produção e responde:
//   1. quais postos do seletor voltam 0 colaboradores ativos;
//   2. quais colaboradores ATIVOS não aparecem em NENHUM posto selecionável
//      (invisíveis no quadro) e para qual departamento eles resolvem.
//
// Entrada: JSONs crus da Management API (acentos íntegros), gerados com:
//   powershell -NoProfile -File scripts/lib/executar-sql-arquivo.ps1 -Saida dados-locais/tmp_audit_deps.json -Query "select id, nome, nome_curto, empresa_id, status from departamentos order by nome;"
//   powershell -NoProfile -File scripts/lib/executar-sql-arquivo.ps1 -Saida dados-locais/tmp_audit_colabs.json -Query "select id, nome_completo, departamento_id, departamento, empresa_id from colaboradores where status = 'Ativo' order by nome_completo;"
//
// Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/auditar-quadro-postos.ts

import fs from 'fs'
import {
  encontrarDepartamentoFuzzy,
  idsColaboradoresDoDepartamento,
  normalizarDepartamento,
  type DepartamentoFuzzy,
} from '../src/lib/departamentos'

interface Colab {
  id: string
  nome_completo: string
  departamento_id: string | null
  departamento: string | null
  empresa_id: string | null
}

const departamentos = JSON.parse(fs.readFileSync('dados-locais/tmp_audit_deps.json', 'utf-8')) as DepartamentoFuzzy[]
const colaboradores = JSON.parse(fs.readFileSync('dados-locais/tmp_audit_colabs.json', 'utf-8')) as Colab[]

// postosDisponiveis (mesma regra da página): ativos com nome_curto, dedup
const vistos = new Set<string>()
const postos: DepartamentoFuzzy[] = []
for (const d of departamentos) {
  const nc = d.nome_curto?.trim()
  if (d.status === 'Inativo' || !nc) continue
  const chave = normalizarDepartamento(nc)
  if (vistos.has(chave)) continue
  vistos.add(chave)
  postos.push(d)
}

const cobertos = new Set<string>()
const zerados: string[] = []
const contagem: { posto: string; total: number }[] = []
for (const p of postos) {
  const ids = idsColaboradoresDoDepartamento(departamentos, colaboradores, p.nome_curto!)
  for (const id of ids) cobertos.add(id)
  contagem.push({ posto: p.nome_curto!, total: ids.size })
  if (ids.size === 0) zerados.push(p.nome_curto!)
}

const fora = colaboradores.filter((c) => !cobertos.has(c.id))

console.log(`== POSTOS NO SELETOR: ${postos.length} | COLABORADORES ATIVOS: ${colaboradores.length} ==`)
console.log(`\n-- POSTOS COM 0 COLABORADORES (${zerados.length}) --`)
for (const z of zerados) console.log(`  ${z}`)
console.log(`\n-- COLABORADORES ATIVOS FORA DE QUALQUER POSTO (${fora.length}) --`)
for (const c of fora) {
  const dep = encontrarDepartamentoFuzzy(departamentos, c.departamento_id, c.departamento, c.empresa_id)
  console.log(
    `  ${c.nome_completo}\n    texto: "${c.departamento ?? ''}" id: ${c.departamento_id ?? 'null'}\n` +
      `    resolve para: ${dep ? `${dep.nome} [curto=${dep.nome_curto ?? 'null'} status=${dep.status}]` : 'NENHUM'}`,
  )
}
console.log(`\n-- CONTAGEM POR POSTO --`)
for (const c of contagem.sort((a, b) => a.posto.localeCompare(b.posto, 'pt-BR'))) {
  console.log(`  ${String(c.total).padStart(3)}  ${c.posto}`)
}
