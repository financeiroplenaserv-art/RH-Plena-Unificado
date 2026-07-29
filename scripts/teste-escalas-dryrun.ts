// Dry-run do parser de importação de escala (src/lib/escalas/importarFlit.ts)
// Executado pelo scripts/teste-integracao-api.mjs via `npx tsx`.
//
// O que faz:
//   1. Roda o parser contra um arquivo real de dados-locais/ e reporta o
//      resultado (formato detectado ou erro de colunas).
//   2. Como nenhum arquivo local tem o formato de escala Flit, monta um
//      arquivo TEMPORÁRIO no formato Flit a partir de dados reais da aba
//      "faltas" (Funcionário + Código Funcionário + Data Lançamento), roda o
//      parser e o matching (encontrarColaborador) contra a tabela
//      colaboradores (somente leitura). O temporário é removido ao final.
//
// Nada é gravado no banco. A saída é um JSON entre marcadores @@JSON@@/@@FIM@@.

import { createClient } from '@supabase/supabase-js'
import XLSX from '@e965/xlsx'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseWorkbookBinary, encontrarColaborador } from '../src/lib/escalas/importarFlit'
import { normalizarMatricula } from '../src/lib/escalas/normalizarTexto'
import type { Colaborador } from '../src/types/database'

function carregarEnv(caminho: string) {
  if (!fs.existsSync(caminho)) return
  const conteudo = fs.readFileSync(caminho, 'utf-8')
  for (const linha of conteudo.split('\n')) {
    const trimmed = linha.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
  }
}
carregarEnv(path.resolve(process.cwd(), '.env'))

const ARQUIVO_REAL = 'dados-locais/OCC todas 180726 (tratado).xlsx'
const LIMITE_AMOSTRA = 1000 // linhas reais usadas no arquivo derivado

interface Saida {
  arquivoReal: {
    caminho: string
    parseou: boolean
    erro?: string
    dias?: number
  }
  derivado: {
    linhasEntrada: number
    diasParseados: number
    colaboradoresUnicos: number
    casaram: number
    naoCasaram: number
    amostraMatriculasSemMatch: string[]
  }
  totalColaboradoresBanco: number
}

async function main() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  )

  // 1. Parser contra o arquivo real, sem alterar nada
  const bufferReal = fs.readFileSync(ARQUIVO_REAL)
  const arrayBuffer = bufferReal.buffer.slice(bufferReal.byteOffset, bufferReal.byteOffset + bufferReal.byteLength)
  const arquivoReal: Saida['arquivoReal'] = { caminho: ARQUIVO_REAL, parseou: false }
  try {
    const dias = await parseWorkbookBinary(arrayBuffer as ArrayBuffer)
    arquivoReal.parseou = true
    arquivoReal.dias = dias.length
  } catch (err) {
    arquivoReal.erro = err instanceof Error ? err.message : String(err)
  }

  // 2. Monta arquivo temporário no formato Flit a partir de dados reais
  const workbook = XLSX.read(bufferReal, { type: 'buffer' })
  const aba = workbook.Sheets['faltas'] ?? workbook.Sheets[workbook.SheetNames[0]]
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(aba)

  const dadosFlit: unknown[][] = [
    ['Colaborador', 'Matricula', 'Data', 'Hora', 'Dispositivo', 'Departamento'],
  ]
  let usadas = 0
  for (const linha of linhas) {
    if (usadas >= LIMITE_AMOSTRA) break
    const funcionario = String(linha['Funcionário'] ?? '').trim()
    const codigo = String(linha['Código Funcionário'] ?? '').trim()
    const dataLancamento = linha['Data Lançamento']
    if (!funcionario || !codigo || dataLancamento === undefined) continue
    dadosFlit.push([funcionario, codigo, dataLancamento, '08:00', 'flit', String(linha['Local'] ?? '')])
    usadas++
  }

  const wsDerivado = XLSX.utils.aoa_to_sheet(dadosFlit)
  const wbDerivado = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wbDerivado, wsDerivado, 'Marcações')
  const caminhoTmp = path.join(os.tmpdir(), `corh-escala-dryrun-${Date.now()}.xlsx`)
  fs.writeFileSync(caminhoTmp, XLSX.write(wbDerivado, { type: 'buffer', bookType: 'xlsx' }))

  let dias
  try {
    const bufTmp = fs.readFileSync(caminhoTmp)
    const abTmp = bufTmp.buffer.slice(bufTmp.byteOffset, bufTmp.byteOffset + bufTmp.byteLength)
    dias = await parseWorkbookBinary(abTmp as ArrayBuffer)
  } finally {
    fs.rmSync(caminhoTmp, { force: true })
  }

  // 3. Colaboradores do banco (somente leitura; sem CPF)
  const colaboradores: Colaborador[] = []
  const PAGINA = 1000
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('id, matricula, nome_completo')
      .range(inicio, inicio + PAGINA - 1)
    if (error) throw new Error(`Falha ao ler colaboradores: ${error.message}`)
    colaboradores.push(...(data as Colaborador[]))
    if (data.length < PAGINA) break
  }

  // 4. Matching por colaborador único (matrícula normalizada ou nome)
  const vistos = new Map<string, { nome: string; matricula: string }>()
  for (const dia of dias) {
    const chave = dia.matricula ? `m:${normalizarMatricula(dia.matricula)}` : `n:${dia.nomeColaborador}`
    if (!vistos.has(chave)) vistos.set(chave, { nome: dia.nomeColaborador, matricula: dia.matricula })
  }

  let casaram = 0
  const semMatch: string[] = []
  for (const { nome, matricula } of vistos.values()) {
    const encontrado = encontrarColaborador(nome, matricula, colaboradores)
    if (encontrado) {
      casaram++
    } else if (semMatch.length < 10) {
      semMatch.push(matricula || '(sem matrícula)')
    }
  }

  const saida: Saida = {
    arquivoReal,
    derivado: {
      linhasEntrada: usadas,
      diasParseados: dias.length,
      colaboradoresUnicos: vistos.size,
      casaram,
      naoCasaram: vistos.size - casaram,
      amostraMatriculasSemMatch: semMatch,
    },
    totalColaboradoresBanco: colaboradores.length,
  }

  console.log('@@JSON@@')
  console.log(JSON.stringify(saida))
  console.log('@@FIM@@')
}

main().catch((err) => {
  console.error('ERRO no dry-run de escalas:', err instanceof Error ? err.message : err)
  process.exit(1)
})
