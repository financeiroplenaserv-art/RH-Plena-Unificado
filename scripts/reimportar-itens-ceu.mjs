import { createClient } from '@supabase/supabase-js'
import XLSX from '@e965/xlsx'
import fs from 'fs'
import path from 'path'
import { inferirSubgrupo } from './lib/subgrupos-itens.mjs'

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
  console.error('Variáveis VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_ANON_KEY) são obrigatórias')
  process.exit(1)
}

const supabase = createClient(url, key)

function formatarCA(valor) {
  if (valor === null || valor === undefined) return null
  const str = String(valor).replace(/\./g, '').replace(/,/g, '.')
  const num = parseFloat(str)
  if (Number.isNaN(num)) return null
  return String(Math.round(num))
}

function formatarData(valor) {
  if (valor === null || valor === undefined) return null
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    return valor.toISOString().split('T')[0]
  }
  if (typeof valor === 'number' && !Number.isNaN(valor) && valor > 60) {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const data = new Date(epoch.getTime() + valor * 24 * 60 * 60 * 1000)
    return data.toISOString().split('T')[0]
  }
  const str = String(valor).trim()
  if (!str) return null
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

function formatarValorCentavos(valor) {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') {
    if (Number.isNaN(valor)) return null
    return Math.round(valor * 100)
  }
  const str = String(valor).trim()
  if (!str) return null
  const temVirgula = str.includes(',')
  const partesPorPonto = str.split('.')
  let normalizado
  if (temVirgula) {
    normalizado = str.replace(/\./g, '').replace(',', '.')
  } else if (partesPorPonto.length === 2 && partesPorPonto[1].length <= 2) {
    normalizado = str
  } else {
    normalizado = str.replace(/\./g, '')
  }
  const num = parseFloat(normalizado)
  if (Number.isNaN(num)) return null
  return Math.round(num * 100)
}

function formatarPrazoDias(vidaUtil, periodo) {
  if (vidaUtil === null || vidaUtil === undefined) return null
  const str = String(vidaUtil).replace(/,/g, '.')
  const num = parseFloat(str)
  if (Number.isNaN(num)) return null
  const unidade = String(periodo || 'meses').toLowerCase()
  if (unidade.includes('mes') || unidade.includes('mês')) return Math.round(num * 30)
  if (unidade.includes('ano')) return Math.round(num * 365)
  if (unidade.includes('dia')) return Math.round(num)
  return Math.round(num * 30)
}

function limparString(valor) {
  if (valor === null || valor === undefined) return null
  const str = String(valor).trim()
  return str || null
}

function montarNome(descricao, tamanho) {
  const nome = String(descricao || '').trim()
  const tam = String(tamanho || '').trim()
  if (!tam || tam.toUpperCase() === 'U') return nome
  return `${nome} - Tam. ${tam}`
}

function processarLinha(row, tipo) {
  const codigo = String(row['Código'] || row['Codigo'] || '').trim()
  const nome = montarNome(row['Descrição'] || row['Descricao'], row['Tam.'])
  const ca = tipo === 'EPI' ? formatarCA(row['C.A.']) : null
  const unidade = limparString(row['Un.'])
  const ultima_compra = formatarData(row['Última Compra'] || row['Ultima Compra'])
  const valor_centavos = formatarValorCentavos(row['Custo da Última'] || row['Custo da Ultima'])
  const prazo_uso_dias = formatarPrazoDias(row['Vida Útil'] || row['Vida Util'], row['Período'] || row['Periodo'])
  const situacao = limparString(row['Sit.']) || 'A'
  const subgrupo = inferirSubgrupo(tipo, nome)

  return {
    codigo,
    nome,
    tipo,
    ca,
    unidade,
    ultima_compra,
    valor_centavos,
    prazo_uso_dias,
    situacao,
    subgrupo,
  }
}

async function reimportar() {
  const arquivo = path.resolve(process.cwd(), 'public/EPIS e Uniformes para CORH.xlsx')
  if (!fs.existsSync(arquivo)) {
    console.error('Arquivo não encontrado:', arquivo)
    process.exit(1)
  }

  console.log('Lendo planilha...')
  const workbook = XLSX.read(fs.readFileSync(arquivo), {
    type: 'buffer',
    cellFormula: false,
    cellNF: false,
    cellStyles: false,
  })

  const abas = []
  for (const nome of ['EPI', 'Uniforme']) {
    const sheet = workbook.Sheets[nome]
    if (sheet) abas.push({ nome, sheet })
  }

  if (abas.length === 0) {
    console.error('Nenhuma aba EPI ou Uniforme encontrada no arquivo')
    process.exit(1)
  }

  const todasLinhas = []
  for (const { nome, sheet } of abas) {
    const rows = XLSX.utils.sheet_to_json(sheet)
    for (const row of rows) {
      try {
        const linha = processarLinha(row, nome)
        if (!linha.codigo) {
          console.warn(`Linha ignorada em ${nome}: código vazio`, row)
          continue
        }
        if (!linha.nome) {
          console.warn(`Linha ignorada em ${nome}: nome vazio`, row)
          continue
        }
        todasLinhas.push(linha)
      } catch (err) {
        console.error('Erro ao processar linha:', row, err)
      }
    }
  }

  console.log(`Total de linhas processadas: ${todasLinhas.length}`)

  console.log('Apagando entregas antigas do banco...')
  const { error: erroDeleteEntregas } = await supabase.from('entregas').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (erroDeleteEntregas) {
    console.error('Erro ao apagar entregas:', erroDeleteEntregas.message)
    process.exit(1)
  }
  console.log('Entregas antigas apagadas.')

  console.log('Apagando itens antigos do banco...')
  const { error: erroDelete } = await supabase.from('itens').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (erroDelete) {
    console.error('Erro ao apagar itens:', erroDelete.message)
    process.exit(1)
  }
  console.log('Itens antigos apagados.')

  let criados = 0
  let erros = 0

  console.log('Importando itens da planilha...')
  for (const linha of todasLinhas) {
    const payload = {
      codigo: linha.codigo,
      nome: linha.nome,
      tipo: linha.tipo,
      ca: linha.ca,
      unidade: linha.unidade,
      ultima_compra: linha.ultima_compra,
      valor: linha.valor_centavos,
      prazo_uso_dias: linha.prazo_uso_dias,
      situacao: linha.situacao,
      estoque: 0,
      estoque_minimo: 0,
      fornecedor_id: null,
      validade: null,
      subgrupo: linha.subgrupo,
    }

    try {
      const { error } = await supabase.from('itens').insert(payload)
      if (error) throw error
      criados++
      console.log(`Criado [${linha.codigo}] ${linha.nome}`)
    } catch (err) {
      erros++
      console.error(`Erro ao salvar [${linha.codigo}] ${linha.nome}:`, err)
    }
  }

  console.log('\n=== Resumo da reimportação ===')
  console.log(`Criados: ${criados}`)
  console.log(`Erros: ${erros}`)
  console.log(`Total processado: ${todasLinhas.length}`)
}

reimportar().catch((err) => {
  console.error(err)
  process.exit(1)
})
