import fs from 'fs'
import path from 'path'
import XLSX from '@e965/xlsx'

interface LocalTrabalho {
  id: string
  nome: string
  nome_curto: string
}

interface Mapeamento {
  local_trabalho_id: string
  tipo_match: 'dispositivo' | 'turno_departamento'
  valor_flit: string
  prioridade: number
  ativo: boolean
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizar(texto: string): string[] {
  return normalizar(texto).split(' ').filter((t) => t.length >= 2)
}

function encontrarMelhorMatch(valorFlit: string, locais: LocalTrabalho[]): LocalTrabalho | null {
  const normValor = normalizar(valorFlit)
  const tokensValor = tokenizar(valorFlit)

  let melhor: LocalTrabalho | null = null
  let melhorScore = 0

  for (const local of locais) {
    const normNome = normalizar(local.nome)
    const normCurto = normalizar(local.nome_curto)
    const tokensNome = tokenizar(local.nome)
    const tokensCurto = tokenizar(local.nome_curto)

    // Match exato ou contém
    if (normNome === normValor || normCurto === normValor) {
      return local
    }

    if (normNome.includes(normValor) || normValor.includes(normNome)) {
      return local
    }

    if (normCurto.includes(normValor) || normValor.includes(normCurto)) {
      return local
    }

    // Score por tokens em comum
    const scoreNome = tokensValor.filter((t) => tokensNome.includes(t)).length
    const scoreCurto = tokensValor.filter((t) => tokensCurto.includes(t)).length
    const score = Math.max(scoreNome, scoreCurto)

    if (score > melhorScore) {
      melhorScore = score
      melhor = local
    }
  }

  // Só aceita se tiver pelo menos metade dos tokens em comum
  const minScore = Math.max(1, Math.ceil(tokensValor.length / 2))
  return melhorScore >= minScore ? melhor : null
}

async function gerar() {
  const excelPath = path.resolve('dados-locais/Marcacoes 01_06_2026 - 05_06_2026 (2).xlsx')
  const locaisPath = path.resolve('scripts/locais_trabalho.json')

  const locais: LocalTrabalho[] = JSON.parse(fs.readFileSync(locaisPath, 'utf-8'))

  const buffer = fs.readFileSync(excelPath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

  const dispositivosUnicos = new Set<string>()
  const departamentosUnicos = new Set<string>()

  for (const row of rows) {
    const nomeDispositivo = String(row['Nome do dispositivo'] || '').trim()
    const departamento = String(row['Departamento'] || '').trim()

    if (nomeDispositivo) {
      dispositivosUnicos.add(nomeDispositivo)
    }

    if (departamento) {
      departamentosUnicos.add(departamento)
    }
  }

  const mapeamentos: Mapeamento[] = []
  const semMatchDispositivo: string[] = []
  const semMatchDepartamento: string[] = []

  for (const dispositivo of Array.from(dispositivosUnicos).sort()) {
    const local = encontrarMelhorMatch(dispositivo, locais)
    if (local) {
      mapeamentos.push({
        local_trabalho_id: local.id,
        tipo_match: 'dispositivo',
        valor_flit: dispositivo,
        prioridade: 100,
        ativo: true,
      })
    } else {
      semMatchDispositivo.push(dispositivo)
    }
  }

  for (const departamento of Array.from(departamentosUnicos).sort()) {
    const local = encontrarMelhorMatch(departamento, locais)
    if (local) {
      // Evita duplicar se já existe mapeamento de dispositivo para o mesmo local
      const jaExiste = mapeamentos.some(
        (m) => m.local_trabalho_id === local.id && m.tipo_match === 'turno_departamento'
      )
      if (!jaExiste) {
        mapeamentos.push({
          local_trabalho_id: local.id,
          tipo_match: 'turno_departamento',
          valor_flit: departamento,
          prioridade: 50,
          ativo: true,
        })
      }
    } else {
      semMatchDepartamento.push(departamento)
    }
  }

  if (mapeamentos.length === 0) {
    console.log('Nenhum mapeamento automático encontrado.')
    return
  }

  const sql = [
    '-- Mapeamentos gerados automaticamente a partir do arquivo Flit',
    `-- Total: ${mapeamentos.length} mapeamentos`,
    '',
    'INSERT INTO mapeamento_flit_local_trabalho (local_trabalho_id, tipo_match, valor_flit, prioridade, ativo)',
    'VALUES',
    mapeamentos
      .map(
        (m) =>
          `  ('${m.local_trabalho_id}', '${m.tipo_match}', '${m.valor_flit.replace(/'/g, "''")}', ${m.prioridade}, ${m.ativo})`
      )
      .join(',\n'),
    'ON CONFLICT (tipo_match, valor_flit) DO UPDATE SET',
    '  local_trabalho_id = EXCLUDED.local_trabalho_id,',
    '  prioridade = EXCLUDED.prioridade,',
    '  ativo = EXCLUDED.ativo;',
    '',
  ]

  if (semMatchDispositivo.length > 0) {
    sql.push('-- Dispositivos sem match automático:')
    semMatchDispositivo.forEach((d) => sql.push(`--   - ${d}`))
    sql.push('')
  }

  if (semMatchDepartamento.length > 0) {
    sql.push('-- Departamentos sem match automático:')
    semMatchDepartamento.forEach((d) => sql.push(`--   - ${d}`))
    sql.push('')
  }

  const sqlPath = path.resolve('scripts/mapeamentos_flit_gerados.sql')
  fs.writeFileSync(sqlPath, sql.join('\n'))

  console.log(`✅ ${mapeamentos.length} mapeamentos gerados.`)
  console.log(`   SQL salvo em: ${sqlPath}`)
  console.log('')
  console.log('Mapeamentos encontrados:')
  for (const m of mapeamentos) {
    const local = locais.find((l) => l.id === m.local_trabalho_id)
    console.log(`   ${m.tipo_match.padEnd(20)} | ${m.valor_flit.padEnd(35)} → ${local?.nome_curto || local?.nome}`)
  }

  if (semMatchDispositivo.length > 0) {
    console.log('\nDispositivos sem match:')
    semMatchDispositivo.forEach((d) => console.log(`   - ${d}`))
  }

  if (semMatchDepartamento.length > 0) {
    console.log('\nDepartamentos sem match:')
    semMatchDepartamento.forEach((d) => console.log(`   - ${d}`))
  }
}

gerar().catch((err) => {
  console.error('Erro:', err)
  process.exit(1)
})
