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

const PLACEHOLDER_MATRICULA = '999999'
const PLACEHOLDER_NOME = 'OCORRENCIAS HISTORICAS - NAO IDENTIFICADO'

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

function corrigirTexto(str) {
  if (!str) return ''
  let s = String(str)

  // Heurística para separar palavras grudadas com palavras comuns de 1 sílaba
  // Ex: "insubordinaçãocom" -> "insubordinação com"
  const palavrasComuns = [
    'com', 'sem', 'por', 'para', 'de', 'do', 'da', 'dos', 'das',
    'em', 'no', 'na', 'nos', 'nas', 'se', 'sob', 'sobre', 'que', 'como',
    'pelo', 'pela', 'pelos', 'pelas', 'num', 'numa', 'nuns', 'numas',
  ]
  const regexGrudado = new RegExp(`([aeiouãõáéíóúâêôàüsS])(${palavrasComuns.join('|')})(?![a-záéíóúãõâêôàü])`, 'gi')
  for (let i = 0; i < 5; i++) {
    const novo = s.replace(regexGrudado, '$1 $2')
    if (novo === s) break
    s = novo
  }

  s = s
    .replace(/([a-zA-Z\u00C0-\u00FF])(\.|,|;|:|\?|!)([a-zA-Z\u00C0-\u00FF])/g, '$1$2 $3')
    .replace(/\s+/g, ' ')
    .trim()

  // Capitaliza primeira letra
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1)
  }
  return s
}

function limparLocal(local) {
  if (!local) return null
  const blacklist = [
    'LIMPEZA', 'LIMPE', 'LIMP', 'ZA',
    'ENCARREGADO', 'ENCARREGADA', 'ENCARREG',
    'PORTARIA',
    'VIGIA', 'VIGIAS',
    'GUARDIAO', 'GUARDIOES', 'GUARDIÕES', 'GUARDIA',
    'JARDINAGEM',
    'INSALUBRIDADE', 'INSALUB', 'INSALUBR',
    'PERICULOSIDADE', 'PERICUL', 'PERIC',
    'DESAT',
    'AUX', 'MANUT', 'MANUTENCAO', 'MANUTENÇÃO',
    'ADMINISTRAT', 'ADMINISTRATIVO', 'ADMINSTRATIVO',
    'ESCRITORIO',
    'ASG',
    'COM', 'SEM',
    'PLENO', 'JR', 'JUNIOR', 'JÚNIOR',
    'ZELADOR',
    'I', 'II', 'III', 'IV', 'V',
    '1', '2', '3', '4', '5', '6', '12X36', '5X2', '6X1',
  ]
  const stopwordsInicioFim = ['DE', 'DO', 'DA', 'DOS', 'DAS', 'E']

  let s = String(local)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  try {
    s = Buffer.from(s, 'latin1').toString('utf-8')
  } catch {}
  s = s.toUpperCase()
  s = s.replace(/[\-/]/g, ' ')
  s = s.replace(/[^A-Z0-9\s]/g, ' ')
  const tokens = s.split(/\s+/).filter(t => t)
  const tokensLimpos = tokens.filter(t => !blacklist.includes(t))

  while (tokensLimpos.length > 0 && stopwordsInicioFim.includes(tokensLimpos[0])) tokensLimpos.shift()
  while (tokensLimpos.length > 0 && stopwordsInicioFim.includes(tokensLimpos[tokensLimpos.length - 1])) tokensLimpos.pop()

  const resultado = tokensLimpos.join(' ').trim()
  return resultado || null
}

function parseDate(valor) {
  if (!valor) return null
  const str = String(valor).trim()
  const partes = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!partes) return null
  const [_, dia, mes, ano] = partes
  const data = new Date(Date.UTC(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10)))
  if (Number.isNaN(data.getTime())) return null
  return data.toISOString().split('T')[0]
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

  const exatos = colaboradores.filter(c => normalizar(c.nome_completo) === nomeNorm)
  if (exatos.length === 1) return { colaborador: exatos[0], metodo: 'exato' }
  if (exatos.length > 1) {
    exatos.sort((a, b) => (a.status === 'Ativo' ? -1 : 1) - (b.status === 'Ativo' ? -1 : 1))
    return { colaborador: exatos[0], metodo: 'exato_multiplo', todos: exatos }
  }

  const contemTodos = colaboradores.filter(c => {
    const tokColab = tokens(c.nome_completo)
    return tokPlanilha.every(t => tokColab.includes(t))
  })
  if (contemTodos.length === 1) return { colaborador: contemTodos[0], metodo: 'tokens_planilha_em_colaborador' }
  if (contemTodos.length > 1) {
    contemTodos.sort((a, b) => {
      const diffTokens = tokens(a.nome_completo).length - tokens(b.nome_completo).length
      if (diffTokens !== 0) return diffTokens
      return (a.status === 'Ativo' ? -1 : 1) - (b.status === 'Ativo' ? -1 : 1)
    })
    return { colaborador: contemTodos[0], metodo: 'tokens_planilha_em_colaborador_multiplo', todos: contemTodos }
  }

  const contemTodosInvertido = colaboradores.filter(c => {
    const tokColab = tokens(c.nome_completo)
    return tokColab.length > 0 && tokColab.every(t => tokPlanilha.includes(t))
  })
  if (contemTodosInvertido.length === 1) return { colaborador: contemTodosInvertido[0], metodo: 'tokens_colaborador_em_planilha' }
  if (contemTodosInvertido.length > 1) {
    contemTodosInvertido.sort((a, b) => {
      const diffTokens = tokens(a.nome_completo).length - tokens(b.nome_completo).length
      if (diffTokens !== 0) return diffTokens
      return (a.status === 'Ativo' ? -1 : 1) - (b.status === 'Ativo' ? -1 : 1)
    })
    return { colaborador: contemTodosInvertido[0], metodo: 'tokens_colaborador_em_planilha_multiplo', todos: contemTodosInvertido }
  }

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

async function buscarOuCriarPlaceholder(empresaId) {
  const { data: existente, error: erroExistente } = await supabase
    .from('colaboradores')
    .select('id')
    .eq('matricula', PLACEHOLDER_MATRICULA)
    .limit(1)

  if (erroExistente) {
    console.error('Erro ao buscar placeholder:', erroExistente.message)
    process.exit(1)
  }

  if (existente && existente.length > 0) {
    console.log('Placeholder já existe:', existente[0].id)
    return existente[0].id
  }

  const { data: novo, error: erroInsert } = await supabase.from('colaboradores').insert({
    nome_completo: PLACEHOLDER_NOME,
    matricula: PLACEHOLDER_MATRICULA,
    status: 'Inativo',
    empresa_id: empresaId,
    dados_completos: { origem: 'placeholder_importacao_ocorrencias' },
  }).select().single()

  if (erroInsert) {
    console.error('Erro ao criar placeholder:', erroInsert.message)
    process.exit(1)
  }

  console.log('Placeholder criado:', novo.id)
  return novo.id
}

async function buscarUsuarioAdmin() {
  const { data, error } = await supabase.from('perfis').select('id').eq('nivel_acesso', 'adm').limit(1)
  if (error || !data || data.length === 0) {
    console.error('Não foi possível encontrar um usuário administrador.')
    process.exit(1)
  }
  return data[0].id
}

async function buscarEmpresaPadrao() {
  const { data, error } = await supabase.from('empresas').select('id, nome').limit(1)
  if (error || !data || data.length === 0) {
    console.error('Não foi possível encontrar uma empresa padrão.')
    process.exit(1)
  }
  return data[0]
}

function mapearTipo(tipoPlanilha) {
  const mapa = {
    'Advertência Escrita': 'Advertência Escrita',
    'Advertência Verbal': 'Advertência Verbal',
    'Suspensão 1 (1ª ocorrência)': 'Suspensão 1 (1ª ocorrência)',
    'Suspensão 2 (reincidência)': 'Suspensão 2 (reincidência)',
    'Suspensão 3 (3ª ocorrência)': 'Suspensão 3 (3ª ocorrência)',
  }
  return mapa[String(tipoPlanilha).trim()] || 'Outros'
}

function mapearMacroGrupo(macroPlanilha) {
  const macro = String(macroPlanilha || '').trim()
  if (macro === 'Conduta e Disciplina') return '2. Conduta e Disciplina'
  return '2. Conduta e Disciplina'
}

function obterGravidadeETexto(tipoOcorrencia) {
  const mapa = {
    'Advertência Verbal': { gravidade: 'Leve', baseLegal: 'Art. 482, alínea "e" CLT — desídia. Primeira notificação.' },
    'Advertência Escrita': { gravidade: 'Moderada', baseLegal: 'Art. 482, alínea "e" CLT — desídia. Reincidência.' },
    'Suspensão 1 (1ª ocorrência)': { gravidade: 'Grave', baseLegal: 'Art. 474 CLT — suspensão por 1 a 30 dias.' },
    'Suspensão 2 (reincidência)': { gravidade: 'Grave', baseLegal: 'Art. 474 CLT — suspensão disciplinar. Segunda ocorrência.' },
    'Suspensão 3 (3ª ocorrência)': { gravidade: 'Grave', baseLegal: 'Art. 474 + Art. 482 CLT — terceira suspensão, configura justa causa.' },
  }
  return mapa[tipoOcorrencia] || { gravidade: 'Moderada', baseLegal: 'Não informado — importação histórica do sistema anterior.' }
}

async function main() {
  const limite = process.argv.includes('--limite') ? parseInt(process.argv[process.argv.indexOf('--limite') + 1], 10) : null
  const dryRun = process.argv.includes('--dry-run')

  console.log('=== Importação de Ocorrências Antigas ===')
  console.log('Modo:', dryRun ? 'DRY-RUN (não salva)' : 'REAL')
  if (limite) console.log('Limite de teste:', limite, 'ocorrências\n')
  else console.log('Importação completa\n')

  const arquivo = path.resolve(process.cwd(), 'public/ocorrencias_antigas.csv')
  const rows = parseCSV(arquivo)
  console.log('Total de ocorrências na planilha:', rows.length)

  console.log('Buscando colaboradores no banco...')
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
  console.log('Colaboradores no banco:', colaboradores.length)

  const empresaPadrao = await buscarEmpresaPadrao()
  console.log('Empresa padrão:', empresaPadrao.nome, empresaPadrao.id)

  const placeholderId = await buscarOuCriarPlaceholder(empresaPadrao.id)
  const usuarioId = await buscarUsuarioAdmin()
  console.log('Usuário admin:', usuarioId)

  const rowsParaImportar = limite ? rows.slice(0, limite) : rows
  console.log('Ocorrências a importar:', rowsParaImportar.length)

  const ocorrenciasParaInserir = []
  const resumo = {
    identificados: 0,
    naoIdentificados: 0,
    multiplos: 0,
    erros: 0,
  }

  for (const row of rowsParaImportar) {
    const numeroOcorrencia = String(row['#_da_ocorrencia'] || '').trim()
    const nomePlanilha = String(row['funcionario'] || '').trim()
    const macroGrupo = mapearMacroGrupo(row['macro'])
    const tituloPlanilha = String(row['titulo_da_ocorrencia'] || '').trim()
    const tipoOcorrencia = mapearTipo(row['tipo'])
    const dataOcorrido = parseDate(row['data_do_ocorrido'])
    const dataRegistro = parseDate(row['data_do_registro'])
    const local = String(row['local'] || '').trim()
    const descricaoPlanilha = String(row['6._descricao_do_fato'] || '').trim()

    const match = encontrarColaborador(nomePlanilha, colaboradores)

    let colaboradorId = placeholderId
    let colaboradorNome = nomePlanilha
    let empresaId = empresaPadrao.id
    let identificado = false

    if (match) {
      colaboradorId = match.colaborador.id
      colaboradorNome = match.colaborador.nome_completo
      empresaId = match.colaborador.empresa_id || empresaPadrao.id
      identificado = true
      resumo.identificados++
      if (match.todos && match.todos.length > 1) {
        resumo.multiplos++
        console.log(`[MULTIPLO] Ocorrência ${numeroOcorrencia} - ${nomePlanilha} -> ${match.colaborador.nome_completo} (${match.metodo})`)
      }
    } else {
      resumo.naoIdentificados++
      console.log(`[NAO IDENTIFICADO] Ocorrência ${numeroOcorrencia} - ${nomePlanilha}`)
    }

    const { gravidade, baseLegal } = obterGravidadeETexto(tipoOcorrencia)

    const titulo = `[${numeroOcorrencia}] ${corrigirTexto(tituloPlanilha) || tipoOcorrencia}`
    const descricao = `Ocorrência nº ${numeroOcorrencia} do sistema anterior.\n\nColaborador na planilha: ${nomePlanilha}\n\nDescrição do fato:\n${corrigirTexto(descricaoPlanilha) || 'Não informada.'}`
    const localLimpo = limparLocal(local)

    ocorrenciasParaInserir.push({
      colaborador_id: colaboradorId,
      empresa_id: empresaId,
      colaborador_nome: colaboradorNome,
      tipo_ocorrencia: tipoOcorrencia,
      macro_grupo: macroGrupo,
      titulo: titulo,
      data_ocorrencia: dataRegistro || dataOcorrido,
      descricao: descricao,
      status: 'Ativa',
      tipo_penalidade: tipoOcorrencia,
      base_legal: baseLegal,
      gravidade: gravidade,
      data_hora_ocorrido: dataOcorrido,
      local_ocorrido: localLimpo || null,
      defesa_funcionario: 'Não informada — importação histórica do sistema anterior.',
      medida_corretiva: 'Não informada — importação histórica do sistema anterior.',
      prazo_acompanhamento: null,
      testemunha_1_nome: null,
      testemunha_1_cargo: null,
      testemunha_2_nome: null,
      testemunha_2_cargo: null,
      usuario_id: usuarioId,
    })
  }

  console.log('\n=== Resumo antes da inserção ===')
  console.log('Identificados:', resumo.identificados)
  console.log('Não identificados:', resumo.naoIdentificados)
  console.log('Múltiplos matches:', resumo.multiplos)

  if (dryRun) {
    console.log('\nDRY-RUN: não foi inserido nenhum registro.')
    console.log('Primeiras ocorrências preparadas:')
    for (const o of ocorrenciasParaInserir.slice(0, 3)) {
      console.log('  -', o.titulo, '->', o.colaborador_nome)
    }
    return
  }

  if (ocorrenciasParaInserir.length === 0) {
    console.log('Nenhuma ocorrência para importar.')
    return
  }

  console.log('\nInserindo ocorrências...')
  const { data: inseridos, error: erroInsert } = await supabase
    .from('ocorrencias')
    .insert(ocorrenciasParaInserir)
    .select('id, titulo, colaborador_nome, status')

  if (erroInsert) {
    console.error('Erro ao inserir ocorrências:', erroInsert.message)
    process.exit(1)
  }

  console.log('\n=== Resultado ===')
  console.log('Ocorrências inseridas:', inseridos?.length || 0)
  for (const o of inseridos || []) {
    console.log('  -', o.id, o.titulo, '|', o.colaborador_nome, '|', o.status)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
