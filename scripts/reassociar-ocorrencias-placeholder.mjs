// Reassocia ocorrências do placeholder (matrícula 999999) aos colaboradores
// corretos, conforme lista aprovada pela usuária em 29/07/2026.
// Uso: node scripts/reassociar-ocorrencias-placeholder.mjs [--aplicar]
// Sem --aplicar: apenas dry-run (verificação). Com --aplicar: backup local + UPDATE.
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

// nome na ocorrência (grafia como exibida na planilha) → matrícula do colaborador correto
const APROVADAS = [
  // CATIA MOREIRA BERNARDINO (5 ocorr.): NÃO aplicada em 29/07 — não consta no cadastro do CORH.
  // Aguardando decisão da usuária (cadastrar ou manter no placeholder).
  { nomeOcorrencia: 'ROBSON ESPIRITO SANTO DOS SANTOS', matricula: '000988', nomeEsperado: 'ROBSON ESPIRITO SANTO DOS SANTOS DA SILVA' },
  { nomeOcorrencia: 'BRUNO SANTANA', matricula: '000871', nomeEsperado: 'BRUNO SANT ANA' },
  { nomeOcorrencia: 'LILIANE IZIDRO DA SILVA', matricula: '000019', nomeEsperado: 'LILIANE IZIDRO DA SILVA PEREIRA' },
  { nomeOcorrencia: 'LUIS THIAGO F.MEDEIROS GOMES DE ARAUJO', matricula: '001065', nomeEsperado: 'LUIS THIAGO FURRIEL MEDEIROS GOMES DE ARAUJO' },
  { nomeOcorrencia: 'RAFAEL RESENDE NASCIMENTO', matricula: '001053', nomeEsperado: 'RAFAEL RESENDE DO NASCIMENTO' },
  { nomeOcorrencia: "PRISCILA SANT`ANNA DE MIRANDA FERREIRA", matricula: '000839', nomeEsperado: 'PRISCILA SANT ANNA DE MIRANDA FERREIRA' },
  { nomeOcorrencia: 'RITA DE CASSIA DO ESPIRITO SANTO DA SILV', matricula: '000805', nomeEsperado: 'RITA DE CASSIA DO ESPIRITO SANTO DA SILVA' },
  { nomeOcorrencia: 'ALEXANDRA DA CONCEIÇAO PEREIRA DOS SANTO', matricula: '001067', nomeEsperado: 'ALEXANDRA DA CONCEICAO PEREIRA DOS SANTOS' },
  { nomeOcorrencia: 'ALESSANDRA ALVES FORTUNATO DA SILVA', matricula: '000016', nomeEsperado: 'ALESSANDRA ALVES FORTUNATO DA SILVA' },
]

const normalizar = (s) =>
  (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim()

const aplicar = process.argv.includes('--aplicar')

// paginação genérica (service key; tabelas podem exceder 1000 linhas)
async function buscarTudo(query) {
  const pagina = 1000
  let from = 0
  const out = []
  for (;;) {
    const { data, error } = await query.range(from, from + pagina - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < pagina) return out
    from += pagina
  }
}

const { data: placeholder, error: ePh } = await sb
  .from('colaboradores').select('id').eq('matricula', '999999').single()
if (ePh) throw ePh

// nomes distintos reais no banco (com contagem) para casar a grafia exata
const ocorrencias = await buscarTudo(
  sb.from('ocorrencias').select('id, colaborador_nome').eq('colaborador_id', placeholder.id)
)
const porNome = new Map()
for (const o of ocorrencias) {
  const chave = normalizar(o.colaborador_nome)
  if (!porNome.has(chave)) porNome.set(chave, { nomeReal: o.colaborador_nome, ids: [] })
  porNome.get(chave).ids.push(o.id)
}

console.log(`Placeholder: ${ocorrencias.length} ocorrências, ${porNome.size} nomes distintos\n`)

const plano = []
let problemas = 0
for (const item of APROVADAS) {
  // 1) localiza o nome real no banco (grafia exata pode ter acento/truncamento)
  let alvo = porNome.get(normalizar(item.nomeOcorrencia))
  if (!alvo) {
    // tenta casar prefixo (nomes truncados na planilha, ex.: "...DA SILV")
    const candidatos = [...porNome.entries()].filter(([k]) => k.startsWith(normalizar(item.nomeOcorrencia)))
    if (candidatos.length === 1) alvo = candidatos[0][1]
  }
  if (!alvo) {
    console.log(`❌ NOME NÃO ENCONTRADO no placeholder: "${item.nomeOcorrencia}"`)
    problemas++
    continue
  }
  // 2) valida o colaborador de destino (por matrícula ou por nome exato)
  let colabQuery = sb.from('colaboradores').select('id, nome_completo, matricula, status, empresa_id')
  colabQuery = item.matricula ? colabQuery.eq('matricula', item.matricula) : colabQuery.eq('nome_completo', item.nomeEsperado)
  const { data: colabs, error: eCol } = await colabQuery
  if (eCol) throw eCol
  if (!colabs || colabs.length === 0) {
    console.log(`❌ COLABORADOR inexistente para "${item.nomeOcorrencia}" (matrícula ${item.matricula})`)
    problemas++
    continue
  }
  // matrícula pode estar duplicada no cadastro (ex.: 000016) — desempata pelo nome esperado
  const porNomeColab = colabs.filter((c) => normalizar(c.nome_completo) === normalizar(item.nomeEsperado))
  const colab = porNomeColab.length === 1 ? porNomeColab[0] : colabs.length === 1 ? colabs[0] : null
  if (!colab) {
    console.log(`❌ COLABORADOR ambíguo para "${item.nomeOcorrencia}" (matrícula ${item.matricula}): ${colabs.length} encontrados, nenhum casa o nome`)
    problemas++
    continue
  }
  const nomeOk = normalizar(colab.nome_completo) === normalizar(item.nomeEsperado)
  if (!nomeOk) {
    console.log(`⚠️  Nome divergente: esperado "${item.nomeEsperado}", banco tem "${colab.nome_completo}" (${colab.matricula}) — pulando por segurança`)
    problemas++
    continue
  }
  console.log(`✅ "${alvo.nomeReal}" (${alvo.ids.length} ocorr.) → ${colab.nome_completo} — ${colab.matricula} — ${colab.status}`)
  plano.push({ ids: alvo.ids, colab, nomeReal: alvo.nomeReal })
}

const totalIds = plano.reduce((acc, p) => acc + p.ids.length, 0)
console.log(`\nPlano: ${plano.length}/10 associações válidas, ${totalIds} ocorrências a mover.`)

if (problemas > 0) {
  console.log(`\n⛔ ${problemas} problema(s) no dry-run. Nada foi alterado.`)
  process.exit(1)
}
if (!aplicar) {
  console.log('\nDry-run OK. Rode com --aplicar para executar (faz backup local antes).')
  process.exit(0)
}

// 3) backup local das linhas afetadas (NÃO criar tabela de backup sem RLS — lição da migration 078)
const todosIds = plano.flatMap((p) => p.ids)
const backup = []
for (let i = 0; i < todosIds.length; i += 200) {
  const { data, error } = await sb.from('ocorrencias').select('*').in('id', todosIds.slice(i, i + 200))
  if (error) throw error
  backup.push(...data)
}
const arquivoBackup = path.resolve('dados-locais', `backup_ocorrencias_reassociacao_${new Date().toISOString().slice(0, 10)}.json`)
fs.writeFileSync(arquivoBackup, JSON.stringify(backup, null, 2))
console.log(`\nBackup local: ${arquivoBackup} (${backup.length} linhas)`)

// 4) UPDATE em lote por associação: colaborador_id + empresa_id do colaborador
for (const p of plano) {
  const { error } = await sb
    .from('ocorrencias')
    .update({ colaborador_id: p.colab.id, empresa_id: p.colab.empresa_id })
    .in('id', p.ids)
  if (error) throw error
  console.log(`✔ ${p.ids.length} ocorrências de "${p.nomeReal}" → ${p.colab.nome_completo}`)
}

// 5) retrato final
const { count } = await sb
  .from('ocorrencias').select('id', { count: 'exact', head: true }).eq('colaborador_id', placeholder.id)
console.log(`\nRetrato final: ${count} ocorrências permanecem no placeholder.`)
