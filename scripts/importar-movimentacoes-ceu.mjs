import { createClient } from '@supabase/supabase-js'
import XLSX from '@e965/xlsx'
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

function limparMatricula(valor) {
  return String(valor || '').replace(/\D/g, '').replace(/^0+/, '')
}

function corrigirEncoding(str) {
  const s = String(str || '')
  try {
    return Buffer.from(s, 'latin1').toString('utf-8')
  } catch {
    return s
  }
}

function normalizar(str) {
  return corrigirEncoding(String(str || ''))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function formatarData(valor) {
  if (valor === null || valor === undefined) return null
  let data = null
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    data = valor
  } else if (typeof valor === 'number' && !Number.isNaN(valor) && valor > 60 && valor < 100000) {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    data = new Date(epoch.getTime() + valor * 24 * 60 * 60 * 1000)
  } else {
    const str = String(valor).trim()
    if (!str) return null
    const partesBR = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (partesBR) {
      const [_, dia, mes, ano] = partesBR
      data = new Date(Date.UTC(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10)))
    } else {
      data = new Date(str)
    }
  }

  if (!data || Number.isNaN(data.getTime())) return null
  const ano = data.getFullYear()
  if (ano < 2000 || ano > 2099) {
    console.warn(`Data ignorada (fora do range 2000-2099): ${valor} -> ${data.toISOString()}`)
    return null
  }
  return data.toISOString().split('T')[0]
}

async function carregarColaboradores(matriculas) {
  const mapa = new Map()
  for (let i = 0; i < matriculas.length; i += 50) {
    const lote = matriculas.slice(i, i + 50).map(m => String(m).padStart(6, '0'))
    const { data, error } = await supabase.from('colaboradores').select('id, matricula, nome_completo').in('matricula', lote)
    if (error) {
      console.error('Erro ao buscar colaboradores:', error.message)
      continue
    }
    for (const c of data || []) {
      const matriculaLimpa = limparMatricula(c.matricula)
      mapa.set(matriculaLimpa, c.id)
    }
  }
  return mapa
}

async function carregarItens() {
  const { data, error } = await supabase.from('itens').select('id, codigo, nome, tipo, ca, validade, unidade, valor')
  if (error) {
    console.error('Erro ao buscar itens:', error.message)
    process.exit(1)
  }
  return (data || []).map(i => ({ ...i, nomeNormalizado: normalizar(i.nome) }))
}

function tokens(str) {
  return normalizar(str).split(' ').filter(t => t.length > 1)
}

const MAPEAMENTO_ITENS = {
  'MASCARA DESCARTAVEL': '624',
  'CRACHA COMPLETO': '1001',
  'CRACHA COM CORDINHA': '1002',
  'CRACHA SEM CORDINHA': '1003',
}

function encontrarItem(nomeItem, itens) {
  // Mapeamentos manuais primeiro
  const nomeNormalizado = normalizar(nomeItem)
  if (MAPEAMENTO_ITENS[nomeNormalizado]) {
    const codigo = MAPEAMENTO_ITENS[nomeNormalizado]
    const item = itens.find(i => i.codigo === codigo)
    if (item) return item
  }

  // Mapeamento por palavras-chave
  const nomeUpper = String(nomeItem || '').trim().toUpperCase()
  if (nomeUpper.includes('MASCARA') && nomeUpper.includes('DESCARTAVEL')) {
    const item = itens.find(i => i.codigo === '624')
    if (item) return item
  }

  const nomeTokens = tokens(nomeItem)

  // Estratégia 1: contém exato
  let melhor = null
  let melhorTamanho = Infinity
  for (const item of itens) {
    if (item.nomeNormalizado.includes(nomeNormalizado) || nomeNormalizado.includes(item.nomeNormalizado)) {
      const diff = Math.abs(item.nomeNormalizado.length - nomeNormalizado.length)
      if (diff < melhorTamanho) {
        melhorTamanho = diff
        melhor = item
      }
    }
  }
  if (melhor) return melhor

  // Estratégia 2: maior quantidade de tokens em comum
  let melhorScore = 0
  for (const item of itens) {
    const itemTokens = tokens(item.nome)
    const comuns = nomeTokens.filter(t => itemTokens.includes(t)).length
    if (comuns > melhorScore) {
      melhorScore = comuns
      melhor = item
    }
  }
  return melhor
}

async function buscarUsuarioAdmin() {
  const { data, error } = await supabase.from('perfis').select('id').eq('nivel_acesso', 'adm').limit(1)
  if (error || !data || data.length === 0) {
    console.error('Não foi possível encontrar um usuário administrador para registrar as entregas.')
    process.exit(1)
  }
  return data[0].id
}

async function importar() {
  const usuarioId = await buscarUsuarioAdmin()
  console.log('Usuário admin para importação:', usuarioId)

  console.log('Apagando entregas antigas...')
  const { error: erroDelete } = await supabase.from('entregas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (erroDelete) {
    console.error('Erro ao apagar entregas:', erroDelete.message)
    process.exit(1)
  }
  console.log('Entregas antigas apagadas.')

  const arquivo = 'public/relatorio_por_colaborador que estava no CEU - colabs ativos.xls'
  if (!fs.existsSync(arquivo)) {
    console.error('Arquivo não encontrado:', arquivo)
    process.exit(1)
  }

  console.log('Lendo planilha de movimentações...')
  const workbook = XLSX.read(fs.readFileSync(arquivo), {
    type: 'buffer',
    cellFormula: false,
    cellNF: false,
    cellStyles: false,
  })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
  console.log(`Total de movimentações: ${rows.length}`)

  const matriculasUnicas = new Set()
  for (const row of rows) {
    const matricula = limparMatricula(row['MatrÃ­cula'])
    if (matricula) matriculasUnicas.add(matricula)
  }
  console.log(`Colaboradores únicos: ${matriculasUnicas.size}`)

  console.log('Carregando colaboradores...')
  const colaboradoresMap = await carregarColaboradores(Array.from(matriculasUnicas))
  console.log(`Colaboradores encontrados: ${colaboradoresMap.size}`)

  console.log('Carregando itens...')
  const itens = await carregarItens()
  console.log(`Itens carregados: ${itens.length}`)

  console.log('Preparando movimentações...')
  const movimentacoes = []
  const itensNaoEncontrados = new Map()
  const colaboradoresNaoEncontrados = new Map()
  let datasInvalidas = 0

  for (const row of rows) {
    const matricula = limparMatricula(row['MatrÃ­cula'])
    const nomeColaborador = corrigirEncoding(row['Colaborador'] || '').trim()
    const nomeItem = corrigirEncoding(row['Item'] || '').trim()
    const quantidade = parseInt(String(row['Quantidade'] || '0').trim(), 10)
    const dataEntrega = formatarData(row['Data de Entrega'])
    if (!dataEntrega) {
      datasInvalidas++
      continue
    }

    const colaboradorId = colaboradoresMap.get(matricula)
    if (!colaboradorId) {
      if (!colaboradoresNaoEncontrados.has(matricula)) {
        colaboradoresNaoEncontrados.set(matricula, nomeColaborador)
      }
      continue
    }

    const item = encontrarItem(nomeItem, itens)
    if (!item) {
      if (!itensNaoEncontrados.has(nomeItem)) {
        itensNaoEncontrados.set(nomeItem, 0)
      }
      itensNaoEncontrados.set(nomeItem, itensNaoEncontrados.get(nomeItem) + 1)
      continue
    }

    movimentacoes.push({
      colaborador_id: colaboradorId,
      item_id: item.id,
      data_entrega: dataEntrega,
      data_devolucao: null,
      quantidade: Number.isNaN(quantidade) ? 1 : quantidade,
      observacao: `Importado de planilha. Item: ${nomeItem}`,
      usuario_id: usuarioId,
      snapshot_item: {
        id: item.id,
        codigo: item.codigo,
        nome: item.nome,
        tipo: item.tipo,
        ca: item.ca,
        validade: item.validade,
        unidade: item.unidade,
        valor: item.valor,
      },
      recibo_emitido: false,
    })
  }

  console.log(`Movimentações válidas: ${movimentacoes.length}`)
  console.log(`Datas inválidas ignoradas: ${datasInvalidas}`)
  console.log(`Colaboradores não encontrados: ${colaboradoresNaoEncontrados.size}`)
  console.log(`Itens não encontrados: ${itensNaoEncontrados.size}`)

  if (itensNaoEncontrados.size > 0) {
    console.log('\nExemplos de itens não encontrados:')
    for (const [nome, qtd] of Array.from(itensNaoEncontrados.entries()).slice(0, 20)) {
      console.log(`  - ${nome} (${qtd}x)`)
    }
  }

  if (movimentacoes.length === 0) {
    console.log('Nenhuma movimentação para importar.')
    return
  }

  console.log('\nImportando em lotes...')
  let inseridos = 0
  let erros = 0
  const loteTamanho = 300

  for (let i = 0; i < movimentacoes.length; i += loteTamanho) {
    const lote = movimentacoes.slice(i, i + loteTamanho)
    try {
      const { error } = await supabase.from('entregas').insert(lote)
      if (error) throw error
      inseridos += lote.length
      console.log(`  Inseridos ${inseridos}/${movimentacoes.length}`)
    } catch (err) {
      erros += lote.length
      console.error(`Erro ao inserir lote ${i}:`, err)
    }
  }

  console.log('\n=== Resumo da importação ===')
  console.log(`Movimentações válidas: ${movimentacoes.length}`)
  console.log(`Inseridos: ${inseridos}`)
  console.log(`Erros: ${erros}`)
}

importar().catch((err) => {
  console.error(err)
  process.exit(1)
})
