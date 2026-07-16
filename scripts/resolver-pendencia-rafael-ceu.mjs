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

const COLABORADOR_ID = 'cd5c6089-7914-4a5a-ae7a-045ff9a35bbc'
const NOVA_MATRICULA = '001107'
const ARQUIVO = 'dados-locais/relatorio_por_colaborador que estava no CEU - colabs ativos.xls'
const NOME_ALVO = 'RAFAEL DE CARVALHO LEMOS'

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
      const [, dia, mes, ano] = partesBR
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
  const nomeNormalizado = normalizar(nomeItem)
  if (MAPEAMENTO_ITENS[nomeNormalizado]) {
    const codigo = MAPEAMENTO_ITENS[nomeNormalizado]
    const item = itens.find(i => i.codigo === codigo)
    if (item) return item
  }

  const nomeUpper = String(nomeItem || '').trim().toUpperCase()
  if (nomeUpper.includes('MASCARA') && nomeUpper.includes('DESCARTAVEL')) {
    const item = itens.find(i => i.codigo === '624')
    if (item) return item
  }

  const nomeTokens = tokens(nomeItem)

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

function lerArquivoMovimentacoes(caminho) {
  const buffer = fs.readFileSync(caminho)
  const amostra = buffer.slice(0, 200).toString('utf-8')
  const pareceTexto = /^[\s\S]*Colaborador[\t\s]/.test(amostra)

  if (pareceTexto) {
    const conteudo = buffer.toString('utf-8')
    const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim())
    if (linhas.length === 0) return []
    const cabecalho = linhas[0].split('\t')
    return linhas.slice(1).map((linha) => {
      const colunas = linha.split('\t')
      const row = {}
      cabecalho.forEach((h, i) => {
        row[h] = colunas[i] !== undefined ? colunas[i] : ''
      })
      return row
    })
  }

  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellFormula: false,
    cellNF: false,
    cellStyles: false,
  })
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
}

async function buscarUsuarioAdmin() {
  const { data, error } = await supabase.from('perfis').select('id').eq('nivel_acesso', 'adm').limit(1)
  if (error || !data || data.length === 0) {
    console.error('Não foi possível encontrar um usuário administrador para registrar as entregas.')
    process.exit(1)
  }
  return data[0].id
}

async function main() {
  console.log('=== Resolvendo pendência do colaborador RAFAEL DE CARVALHO LEMOS ===\n')

  // 1. Atualizar matrícula
  console.log(`Atualizando matrícula do colaborador ${COLABORADOR_ID} para ${NOVA_MATRICULA}...`)
  const { error: erroUpdate } = await supabase
    .from('colaboradores')
    .update({ matricula: NOVA_MATRICULA, updated_at: new Date().toISOString() })
    .eq('id', COLABORADOR_ID)

  if (erroUpdate) {
    console.error('Erro ao atualizar matrícula:', erroUpdate.message)
    process.exit(1)
  }
  console.log('Matrícula atualizada com sucesso.\n')

  // 2. Importar movimentações pendentes
  const usuarioId = await buscarUsuarioAdmin()
  console.log('Usuário admin para importação:', usuarioId)

  if (!fs.existsSync(ARQUIVO)) {
    console.error('Arquivo não encontrado:', ARQUIVO)
    process.exit(1)
  }

  console.log('Lendo planilha de movimentações...')
  const rows = lerArquivoMovimentacoes(ARQUIVO)
  console.log(`Total de movimentações na planilha: ${rows.length}`)

  const pendentes = rows.filter(row => {
    const nome = corrigirEncoding(row['Colaborador'] || '').trim().toUpperCase()
    return nome === NOME_ALVO
  })
  console.log(`Movimentações do ${NOME_ALVO}: ${pendentes.length}`)

  if (pendentes.length === 0) {
    console.log('Nenhuma movimentação pendente encontrada.')
    return
  }

  const itens = await carregarItens()
  console.log(`Itens carregados: ${itens.length}`)

  const movimentacoes = []
  const itensNaoEncontrados = new Map()
  let datasInvalidas = 0

  for (const row of pendentes) {
    const nomeItem = corrigirEncoding(row['Item'] || '').trim()
    const quantidade = parseInt(String(row['Quantidade'] || '0').trim(), 10)
    const dataEntrega = formatarData(row['Data de Entrega'])
    if (!dataEntrega) {
      datasInvalidas++
      continue
    }

    const item = encontrarItem(nomeItem, itens)
    if (!item) {
      itensNaoEncontrados.set(nomeItem, (itensNaoEncontrados.get(nomeItem) || 0) + 1)
      continue
    }

    movimentacoes.push({
      colaborador_id: COLABORADOR_ID,
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
  if (itensNaoEncontrados.size > 0) {
    console.log('Itens não encontrados:')
    for (const [nome, qtd] of itensNaoEncontrados.entries()) {
      console.log(`  - ${nome} (${qtd}x)`)
    }
  }

  if (movimentacoes.length === 0) {
    console.log('Nenhuma movimentação para importar.')
    return
  }

  console.log('\nImportando movimentações pendentes...')
  const { error: erroInsert } = await supabase.from('entregas').insert(movimentacoes)
  if (erroInsert) {
    console.error('Erro ao inserir movimentações:', erroInsert.message)
    process.exit(1)
  }

  console.log(`\n=== Resumo ===`)
  console.log(`Matrícula atualizada: ${NOVA_MATRICULA}`)
  console.log(`Movimentações importadas: ${movimentacoes.length}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
