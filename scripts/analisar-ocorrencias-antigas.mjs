import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function carregarEnv(caminho) {
  if (!fs.existsSync(caminho)) return
  const conteudo = fs.readFileSync(caminho, 'utf-8')
  for (const linha of conteudo.split('\n')) {
    const trimmed = linha.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const chave = trimmed.slice(0, idx).trim()
    const valor = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    process.env[chave] = valor
  }
}

carregarEnv(path.resolve(process.cwd(), '.env'))

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Variáveis VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias')
  process.exit(1)
}

const supabase = createClient(url, key)

function normalizar(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function parseCSV(caminho) {
  const conteudo = fs.readFileSync(caminho, 'utf-8')
  const linhas = conteudo.split(/\r?\n/).filter(l => l.trim())
  if (linhas.length === 0) return []
  const cabecalho = parseLinhaCSV(linhas[0])
  return linhas.slice(1).map(linha => {
    const valores = parseLinhaCSV(linha)
    const row = {}
    cabecalho.forEach((h, i) => {
      row[h] = valores[i] !== undefined ? valores[i] : ''
    })
    return row
  })
}

function parseLinhaCSV(linha) {
  const resultado = []
  let atual = ''
  let dentroAspas = false
  for (let i = 0; i < linha.length; i++) {
    const char = linha[i]
    const prox = linha[i + 1]
    if (char === '"') {
      if (dentroAspas && prox === '"') {
        atual += '"'
        i++
      } else {
        dentroAspas = !dentroAspas
      }
    } else if (char === ',' && !dentroAspas) {
      resultado.push(atual)
      atual = ''
    } else {
      atual += char
    }
  }
  resultado.push(atual)
  return resultado
}

function parseDate(valor) {
  if (!valor) return null
  const str = String(valor).trim()
  const partes = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!partes) return null
  const [, dia, mes, ano] = partes
  const data = new Date(Date.UTC(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10)))
  if (Number.isNaN(data.getTime())) return null
  return data.toISOString().split('T')[0]
}

async function main() {
  console.log('=== Análise de Ocorrências Antigas ===\n')

  // 1. Carrega CSV
  const arquivo = path.resolve(process.cwd(), 'public/ocorrencias_antigas.csv')
  const rows = parseCSV(arquivo)
  console.log('Total de ocorrências na planilha:', rows.length)

  // 2. Estatísticas básicas
  const macros = new Set()
  const tipos = new Set()
  const nomesPlanilha = new Set()
  const datasInvalidas = []

  for (const row of rows) {
    macros.add(String(row['macro'] || '').trim())
    tipos.add(String(row['tipo'] || '').trim())
    nomesPlanilha.add(String(row['funcionario'] || '').trim())
    const dataOcorrido = parseDate(row['data_do_ocorrido'])
    const dataRegistro = parseDate(row['data_do_registro'])
    if (!dataOcorrido || !dataRegistro) {
      datasInvalidas.push({
        nome: row['funcionario'],
        numero: row['#_da_ocorrencia'],
        dataOcorrido: row['data_do_ocorrido'],
        dataRegistro: row['data_do_registro'],
      })
    }
  }

  console.log('Macro grupos:', Array.from(macros))
  console.log('Tipos de ocorrência:', Array.from(tipos))
  console.log('Funcionários únicos:', nomesPlanilha.size)
  console.log('Ocorrências com datas inválidas:', datasInvalidas.length)
  if (datasInvalidas.length > 0) {
    console.log('Exemplos:', datasInvalidas.slice(0, 5))
  }

  // 3. Busca colaboradores no banco
  console.log('\nBuscando colaboradores no banco...')
  const colaboradores = []
  let pagina = 0
  while (true) {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('id, matricula, nome_completo, empresa_id, status')
      .range(pagina * 1000, (pagina + 1) * 1000 - 1)
    if (error) {
      console.error('Erro ao buscar colaboradores:', error.message)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    colaboradores.push(...data)
    if (data.length < 1000) break
    pagina++
  }
  console.log('Total de colaboradores no banco:', colaboradores.length)

  // 4. Faz matching por nome
  const mapaNomes = new Map()
  for (const c of colaboradores) {
    const nomeNormalizado = normalizar(c.nome_completo)
    if (!mapaNomes.has(nomeNormalizado)) {
      mapaNomes.set(nomeNormalizado, [])
    }
    mapaNomes.get(nomeNormalizado).push(c)
  }

  let encontrados = 0
  let ambiguos = 0
  let naoEncontrados = 0
  const nomesNaoEncontrados = []

  for (const nome of nomesPlanilha) {
    const nomeNormalizado = normalizar(nome)
    const matches = mapaNomes.get(nomeNormalizado)
    if (!matches) {
      naoEncontrados++
      nomesNaoEncontrados.push(nome)
    } else if (matches.length > 1) {
      ambiguos++
      console.log(`Nome ambíguo (${matches.length} colaboradores): ${nome}`)
    } else {
      encontrados++
    }
  }

  console.log('\n=== Resultado do Matching por Nome ===')
  console.log('Funcionários encontrados (único):', encontrados)
  console.log('Funcionários ambíguos:', ambiguos)
  console.log('Funcionários não encontrados:', naoEncontrados)

  if (nomesNaoEncontrados.length > 0) {
    console.log('\nExemplos de nomes não encontrados:')
    for (const nome of nomesNaoEncontrados.slice(0, 30)) {
      console.log('  -', nome)
    }
  }

  // 5. Mapeamento de tipos
  console.log('\n=== Mapeamento de Tipos ===')
  const tiposSistema = [
    'Advertência Verbal',
    'Advertência Escrita',
    'Suspensão 1 (1ª ocorrência)',
    'Suspensão 2 (reincidência)',
    'Suspensão 3 (3ª ocorrência)',
  ]
  for (const tipoPlanilha of Array.from(tipos)) {
    const match = tiposSistema.find(t => normalizar(t) === normalizar(tipoPlanilha))
    console.log(`  "${tipoPlanilha}" -> ${match || 'NÃO ENCONTRADO'}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
