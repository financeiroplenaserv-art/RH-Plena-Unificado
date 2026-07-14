import fs from 'fs'
import path from 'path'
import { parseWorkbookBinary, agruparBatidasPorDia } from '../src/lib/escalas/importarFlit'

async function verificar() {
  const arquivoPath = path.resolve('dados-locais/Marcacoes 01_06_2026 - 05_06_2026 (2).xlsx')
  const buffer = fs.readFileSync(arquivoPath)

  const batidas = await parseWorkbookBinary(buffer)
  const dias = agruparBatidasPorDia(batidas)

  console.log('Total de batidas:', batidas.length)
  console.log('Total de dias agrupados por nome+data:', dias.length)

  // Verifica duplicatas por matricula+data
  const porMatriculaData = new Map<string, number>()
  for (const b of batidas) {
    const chave = `${b.matricula}|${b.data}`
    porMatriculaData.set(chave, (porMatriculaData.get(chave) || 0) + 1)
  }

  // Verifica duplicatas por nome+data
  const porNomeData = new Map<string, number>()
  for (const b of batidas) {
    const chave = `${b.nomeColaborador}|${b.data}`
    porNomeData.set(chave, (porNomeData.get(chave) || 0) + 1)
  }

  // Colaboradores com nome variável para a mesma matrícula
  const nomesPorMatricula = new Map<string, Set<string>>()
  for (const b of batidas) {
    if (!b.matricula) continue
    if (!nomesPorMatricula.has(b.matricula)) {
      nomesPorMatricula.set(b.matricula, new Set())
    }
    nomesPorMatricula.get(b.matricula)!.add(b.nomeColaborador)
  }

  const matriculasComNomesDiferentes = Array.from(nomesPorMatricula.entries()).filter(
    ([, nomes]) => nomes.size > 1
  )

  console.log('\nMatrículas com nomes diferentes no arquivo:', matriculasComNomesDiferentes.length)
  matriculasComNomesDiferentes.slice(0, 10).forEach(([mat, nomes]) => {
    console.log(`  Matrícula ${mat}:`, Array.from(nomes).join(' | '))
  })

  // Mostra nomes com mais de uma matrícula
  const matriculasPorNome = new Map<string, Set<string>>()
  for (const b of batidas) {
    if (!matriculasPorNome.has(b.nomeColaborador)) {
      matriculasPorNome.set(b.nomeColaborador, new Set())
    }
    matriculasPorNome.get(b.nomeColaborador)!.add(b.matricula)
  }

  const nomesComMatriculasDiferentes = Array.from(matriculasPorNome.entries()).filter(
    ([, mats]) => mats.size > 1
  )

  console.log('\nNomes com matrículas diferentes:', nomesComMatriculasDiferentes.length)
  nomesComMatriculasDiferentes.slice(0, 10).forEach(([nome, mats]) => {
    console.log(`  ${nome}:`, Array.from(mats).join(' | '))
  })
}

verificar().catch(console.error)
