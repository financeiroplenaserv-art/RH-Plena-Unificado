import fs from 'fs'
import path from 'path'
import XLSX from '@e965/xlsx'
import { parseWorkbookBinary, agruparBatidasPorDia } from '../src/lib/escalas/importarFlit'
import { inferirLocalTrabalho } from '../src/lib/escalas/inferirLocalTrabalho'

interface Mapeamento {
  id: string
  local_trabalho_id: string
  tipo_match: 'dispositivo' | 'perimetro' | 'turno_departamento'
  valor_flit: string
  prioridade: number
  ativo: boolean
}

async function analisar() {
  const arquivoPath = path.resolve('public/Marcacoes 01_06_2026 - 05_06_2026 (2).xlsx')
  const locaisPath = path.resolve('scripts/locais_trabalho.json')
  const mapeamentosPath = path.resolve('scripts/mapeamentos_atuais.json')

  const buffer = fs.readFileSync(arquivoPath)
  const dias = agruparBatidasPorDia(await parseWorkbookBinary(buffer))

  let locais: Array<{ id: string; nome: string; nome_curto: string }> = []
  let mapeamentos: Mapeamento[] = []

  if (fs.existsSync(locaisPath)) {
    locais = JSON.parse(fs.readFileSync(locaisPath, 'utf-8'))
  }

  if (fs.existsSync(mapeamentosPath)) {
    mapeamentos = JSON.parse(fs.readFileSync(mapeamentosPath, 'utf-8'))
  }

  const naoIdentificados: Array<{
    data: string
    nome: string
    matricula: string
    dispositivo: string
    nomeDispositivo: string
    departamento: string
    turno: string
  }> = []

  for (const dia of dias) {
    const inferido = inferirLocalTrabalho(mapeamentos, {
      tipoDispositivo: dia.tipoDispositivo,
      nomeDispositivo: dia.nomeDispositivo,
      perimetro: dia.perimetro,
      departamento: dia.departamento,
      turno: dia.turno,
    })

    if (!inferido) {
      naoIdentificados.push({
        data: dia.data,
        nome: dia.nomeColaborador,
        matricula: dia.matricula,
        dispositivo: dia.tipoDispositivo,
        nomeDispositivo: dia.nomeDispositivo,
        departamento: dia.departamento,
        turno: dia.turno,
      })
    }
  }

  console.log(`Total de dias não identificados: ${naoIdentificados.length}`)

  // Agrupa por dispositivo/departamento/turno para ver padrões
  const porDispositivo = new Map<string, number>()
  const porDepartamento = new Map<string, number>()
  const porCombinacao = new Map<string, { count: number; exemplos: typeof naoIdentificados }>()

  for (const item of naoIdentificados) {
    const chaveDisp = item.nomeDispositivo || '(sem nome de dispositivo)'
    porDispositivo.set(chaveDisp, (porDispositivo.get(chaveDisp) || 0) + 1)

    const chaveDept = item.departamento || '(sem departamento)'
    porDepartamento.set(chaveDept, (porDepartamento.get(chaveDept) || 0) + 1)

    const chaveCombo = `${item.dispositivo} | ${item.nomeDispositivo || '-'} | ${item.departamento || '-'} | ${item.turno || '-'}`
    if (!porCombinacao.has(chaveCombo)) {
      porCombinacao.set(chaveCombo, { count: 0, exemplos: [] })
    }
    const entry = porCombinacao.get(chaveCombo)!
    entry.count++
    if (entry.exemplos.length < 3) entry.exemplos.push(item)
  }

  console.log('\n=== Dispositivos não identificados ===')
  Array.from(porDispositivo.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([disp, count]) => console.log(`  ${count}x | ${disp}`))

  console.log('\n=== Departamentos não identificados ===')
  Array.from(porDepartamento.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([dept, count]) => console.log(`  ${count}x | ${dept}`))

  console.log('\n=== Principais combinações não identificadas ===')
  Array.from(porCombinacao.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .forEach(([combo, { count, exemplos }]) => {
      console.log(`\n  ${count}x | ${combo}`)
      exemplos.forEach((e) => console.log(`      - ${e.nome} (${e.data})`))
    })
}

analisar().catch(console.error)
