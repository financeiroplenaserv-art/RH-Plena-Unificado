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

function tokens(str) {
  return normalizar(str).split(' ').filter(t => t.length > 0)
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

function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + custo)
    }
  }
  return dp[m][n]
}

function similaridade(a, b) {
  const dist = levenshtein(a, b)
  return 1 - dist / Math.max(a.length, b.length)
}

function encontrarColaborador(nomePlanilha, colaboradores) {
  const nomeNorm = normalizar(nomePlanilha)
  const tokPlanilha = tokens(nomePlanilha)

  // 1. Match exato
  const exatos = colaboradores.filter(c => normalizar(c.nome_completo) === nomeNorm)
  if (exatos.length === 1) return { colaborador: exatos[0], metodo: 'exato' }
  if (exatos.length > 1) return { colaborador: exatos[0], metodo: 'exato_multiplo', todos: exatos }

  // 2. Todos os tokens da planilha estão no nome do colaborador
  const contemTodos = colaboradores.filter(c => {
    const tokColab = tokens(c.nome_completo)
    return tokPlanilha.every(t => tokColab.includes(t))
  })
  if (contemTodos.length === 1) return { colaborador: contemTodos[0], metodo: 'tokens_planilha_em_colaborador' }
  if (contemTodos.length > 1) {
    // Escolhe o que tem menos tokens extras
    contemTodos.sort((a, b) => tokens(a.nome_completo).length - tokens(b.nome_completo).length)
    return { colaborador: contemTodos[0], metodo: 'tokens_planilha_em_colaborador_multiplo', todos: contemTodos }
  }

  // 3. Todos os tokens do colaborador estão no nome da planilha (nome curto no banco)
  const contemTodosInvertido = colaboradores.filter(c => {
    const tokColab = tokens(c.nome_completo)
    return tokColab.length > 0 && tokColab.every(t => tokPlanilha.includes(t))
  })
  if (contemTodosInvertido.length === 1) return { colaborador: contemTodosInvertido[0], metodo: 'tokens_colaborador_em_planilha' }
  if (contemTodosInvertido.length > 1) {
    contemTodosInvertido.sort((a, b) => tokens(a.nome_completo).length - tokens(b.nome_completo).length)
    return { colaborador: contemTodosInvertido[0], metodo: 'tokens_colaborador_em_planilha_multiplo', todos: contemTodosInvertido }
  }

  // 4. Similaridade de Levenshtein para nomes curtos (<= 4 tokens)
  if (tokPlanilha.length <= 4) {
    let melhor = null
    let melhorScore = 0
    for (const c of colaboradores) {
      const score = similaridade(nomeNorm, normalizar(c.nome_completo))
      if (score > melhorScore) {
        melhorScore = score
        melhor = c
      }
    }
    if (melhor && melhorScore >= 0.85) {
      return { colaborador: melhor, metodo: 'levenshtein', score: melhorScore }
    }
  }

  return null
}

async function main() {
  console.log('=== Análise Fuzzy de Ocorrências Antigas ===\n')

  const arquivo = path.resolve(process.cwd(), 'public/ocorrencias_antigas.csv')
  const rows = parseCSV(arquivo)
  console.log('Total de ocorrências na planilha:', rows.length)

  const nomesPlanilha = new Set()
  for (const row of rows) {
    nomesPlanilha.add(String(row['funcionario'] || '').trim())
  }
  console.log('Funcionários únicos:', nomesPlanilha.size)

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

  const metodos = new Map()
  let encontrados = 0
  let naoEncontrados = 0
  const naoEncontradosLista = []
  const multiplosLista = []

  for (const nome of nomesPlanilha) {
    const resultado = encontrarColaborador(nome, colaboradores)
    if (!resultado) {
      naoEncontrados++
      naoEncontradosLista.push(nome)
    } else {
      encontrados++
      const metodo = resultado.metodo
      metodos.set(metodo, (metodos.get(metodo) || 0) + 1)
      if (resultado.todos) {
        multiplosLista.push({ nome, metodo, matches: resultado.todos.map(c => c.nome_completo) })
      }
    }
  }

  console.log('\n=== Resultado do Matching Fuzzy ===')
  console.log('Funcionários encontrados:', encontrados)
  console.log('Funcionários não encontrados:', naoEncontrados)
  console.log('\nMétodos de matching:')
  for (const [metodo, qtd] of metodos.entries()) {
    console.log(`  ${metodo}: ${qtd}`)
  }

  if (multiplosLista.length > 0) {
    console.log('\nNomes com múltiplos matches (escolhido o primeiro):')
    for (const item of multiplosLista) {
      console.log(`  ${item.nome} (${item.metodo}):`, item.matches.join(' | '))
    }
  }

  if (naoEncontradosLista.length > 0) {
    console.log('\nExemplos de nomes não encontrados:')
    for (const nome of naoEncontradosLista.slice(0, 40)) {
      console.log('  -', nome)
    }
  }

  // Conta quantas ocorrências seriam importadas
  let importaveis = 0
  let naoImportaveis = 0
  for (const row of rows) {
    const nome = String(row['funcionario'] || '').trim()
    const resultado = encontrarColaborador(nome, colaboradores)
    if (resultado && !resultado.todos) {
      importaveis++
    } else if (resultado && resultado.todos) {
      importaveis++
    } else {
      naoImportaveis++
    }
  }
  console.log('\n=== Estimativa de Importação ===')
  console.log('Ocorrências importáveis:', importaveis)
  console.log('Ocorrências não importáveis:', naoImportaveis)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
