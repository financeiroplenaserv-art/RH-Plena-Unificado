// Valida a lógica de importação (src/lib/ocorrencias/importacaoPonto.ts) contra o PDF real
// dados-locais/unificado.pdf, SEM gravar nada no banco. Uso: npx tsx scripts/validar-importacao-ponto.ts
import fs from 'node:fs'
import {
  parsePaginasEspelho,
  planejarOcorrencias,
  casarColaborador,
  marcarDuplicadas,
  type PaginaPDF,
  type ColaboradorResumo,
  type OcorrenciaExistente,
} from '../src/lib/ocorrencias/importacaoPonto'

function carregarEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const linha of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

async function buscarTudo<T>(url: string, key: string, tabela: string, select: string, extra = ''): Promise<T[]> {
  const todos: T[] = []
  const passo = 1000
  for (let offset = 0; ; offset += passo) {
    const resp = await fetch(`${url}/rest/v1/${tabela}?select=${select}${extra}&offset=${offset}&limit=${passo}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!resp.ok) throw new Error(`Erro ${resp.status} em ${tabela}: ${await resp.text()}`)
    const lote = (await resp.json()) as T[]
    todos.push(...lote)
    if (lote.length < passo) break
  }
  return todos
}

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(fs.readFileSync('dados-locais/unificado.pdf'))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise

  const paginas: PaginaPDF[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    paginas.push({
      numero: p,
      itens: content.items
        .filter((i) => 'str' in i)
        .map((i) => ({ x: i.transform[4], y: i.transform[5], texto: (i as { str: string }).str })),
    })
  }

  const espelhos = parsePaginasEspelho(paginas)
  console.log(`Espelhos parseados: ${espelhos.length}`)

  const env = carregarEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY
  const colaboradores = await buscarTudo<ColaboradorResumo>(
    url,
    key,
    'colaboradores',
    'id,nome_completo,cpf,empresa_id,status'
  )
  console.log(`Colaboradores no banco: ${colaboradores.length}`)

  const plano = espelhos.flatMap((e) => {
    const { colaborador, match } = casarColaborador(e, colaboradores)
    return planejarOcorrencias(e, colaborador, match)
  })

  // Deduplicação: busca ocorrências existentes no período do espelho (somente leitura)
  const ids = [...new Set(plano.filter((p) => p.colaborador).map((p) => p.colaborador!.id))]
  let existentes: OcorrenciaExistente[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const lote = ids.slice(i, i + 50).join(',')
    existentes = existentes.concat(
      await buscarTudo<OcorrenciaExistente>(
        url,
        key,
        'ocorrencias',
        'colaborador_id,data_ocorrencia,tipo_ocorrencia',
        `&colaborador_id=in.(${lote})&data_ocorrencia=gte.2026-06-20&data_ocorrencia=lte.2026-07-19`
      )
    )
  }
  const duplicadas = marcarDuplicadas(plano, existentes)

  const porTipo = new Map<string, number>()
  for (const o of plano) porTipo.set(o.tipo, (porTipo.get(o.tipo) || 0) + 1)
  const naoOk = plano.filter((p) => p.match !== 'OK').length
  console.log(`\nOcorrências planejadas: ${plano.length} | duplicadas: ${duplicadas} | match != OK: ${naoOk}`)
  for (const [tipo, qtd] of [...porTipo.entries()].sort()) console.log(`  ${tipo}: ${qtd}`)

  console.log('\n===== PLANO DETALHADO =====')
  for (const o of plano) {
    const aviso = o.avisos.length ? `  ⚠ ${o.avisos.join(' | ')}` : ''
    const dup = o.duplicada ? ' [DUPLICADA]' : ''
    const m = o.match !== 'OK' ? ` [${o.match}]` : ''
    console.log(
      `${o.nomePdf.padEnd(45)} ${o.cpfPdf}  ${o.tipo.padEnd(38)} ${o.dataInicio} → ${o.dataFim}  ${String(o.dias).padStart(2)}d  "${o.titulo}"${dup}${m}${aviso}`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
