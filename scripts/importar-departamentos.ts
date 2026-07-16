import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { resolve } from 'path'
import { readFileSync } from 'fs'

function carregarEnv(caminho: string): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    const conteudo = readFileSync(caminho, 'utf-8')
    conteudo.split('\n').forEach((linha) => {
      const [chave, ...valor] = linha.split('=')
      if (chave && valor.length > 0) {
        env[chave.trim()] = valor.join('=').trim().replace(/^["']|["']$/g, '')
      }
    })
  } catch {
    // ignorar
  }
  return env
}

const env = { ...process.env, ...carregarEnv(resolve(process.cwd(), '.env')) }
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface LinhaDepartamento {
  nome: string
  nome_curto: string | null
  endereco: string | null
  cidade: string | null
  cep: string | null
  bairro: string | null
  email_contato: string | null
  nome_contato: string | null
  telefone_contato: string | null
  contato_portaria: string | null
}

function limparTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  const texto = String(valor).trim()
  return texto === '' || texto.toUpperCase() === 'NAN' ? null : texto
}

function limparCEP(valor: unknown): string | null {
  const texto = limparTexto(valor)
  if (!texto) return null
  const numeros = texto.replace(/\D/g, '')
  if (numeros.length !== 8) return texto
  return numeros.replace(/(\d{5})(\d{3})/, '$1-$2')
}

async function importar() {
  const caminho = resolve(process.cwd(), 'public', 'Departamentos.xlsx')
  const buffer = readFileSync(caminho)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const dados = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

  const linhas = dados.slice(1)

  const registros: LinhaDepartamento[] = []

  for (const linha of linhas) {
    const nome = limparTexto(linha[0])
    if (!nome) continue

    registros.push({
      nome,
      nome_curto: limparTexto(linha[1]) || limparTexto(linha[13]),
      endereco: limparTexto(linha[2]),
      cidade: limparTexto(linha[3]),
      cep: limparCEP(linha[4]),
      bairro: limparTexto(linha[5]),
      email_contato: limparTexto(linha[6]),
      nome_contato: limparTexto(linha[7]),
      telefone_contato: limparTexto(linha[8]),
      contato_portaria: limparTexto(linha[9]),
    })
  }

  console.log(`Total de departamentos lidos: ${registros.length}`)

  // Verificar se já existem departamentos
  const { count, error: countError } = await supabase
    .from('departamentos')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('Erro ao verificar departamentos existentes:', countError.message)
    return
  }

  if (count && count > 0) {
    console.log(`Já existem ${count} departamentos no banco. Importação abortada para evitar duplicatas.`)
    return
  }

  // Testar schema
  const registroTeste = {
    nome: 'TESTE_SCHEMA',
    nome_curto: 'TESTE',
    endereco: null,
    cidade: null,
    cep: null,
    bairro: null,
    email_contato: null,
    nome_contato: null,
    telefone_contato: null,
    contato_portaria: null,
    status: 'Ativo',
  }

  const { error: erroTeste } = await supabase.from('departamentos').insert(registroTeste).select()
  if (erroTeste) {
    console.error('\nErro: o schema da tabela departamentos não está completo.')
    console.error(erroTeste.message)
    console.log('\nExecute primeiro o arquivo scripts/aplicar-schema-departamentos.sql no SQL Editor do Supabase.')
    return
  }

  await supabase.from('departamentos').delete().eq('nome', 'TESTE_SCHEMA')
  console.log('Schema OK. Iniciando importação...\n')

  // Inserir em lotes
  const lotes = []
  for (let i = 0; i < registros.length; i += 50) {
    lotes.push(registros.slice(i, i + 50))
  }

  let inseridos = 0
  for (const lote of lotes) {
    const { error } = await supabase.from('departamentos').insert(
      lote.map((r) => ({
        nome: r.nome,
        nome_curto: r.nome_curto,
        endereco: r.endereco,
        cidade: r.cidade,
        cep: r.cep,
        bairro: r.bairro,
        email_contato: r.email_contato,
        nome_contato: r.nome_contato,
        telefone_contato: r.telefone_contato,
        contato_portaria: r.contato_portaria,
        status: 'Ativo',
      }))
    )

    if (error) {
      console.error('Erro ao inserir lote:', error.message)
      return
    }
    inseridos += lote.length
    console.log(`Inseridos ${inseridos} de ${registros.length}`)
  }

  console.log(`\nImportação concluída! ${inseridos} departamentos inseridos.`)
}

importar().catch((err) => {
  console.error('Erro na importação:', err)
  process.exit(1)
})
