import { parseWorkbookBinary, agruparBatidasPorDia } from '../src/lib/escalas/importarFlit'
import fs from 'fs'
import path from 'path'

async function testar() {
  const arquivoPath = path.resolve('dados-locais/Marcacoes 01_06_2026 - 05_06_2026 (2).xlsx')
  const buffer = fs.readFileSync(arquivoPath)

  try {
    console.log('Iniciando parse do arquivo real...')
    const batidas = await parseWorkbookBinary(buffer)
    console.log('Total de batidas:', batidas.length)

    if (batidas.length === 0) {
      console.log('⚠️ Nenhuma batida foi parseada. O arquivo pode não estar sendo reconhecido.')
      return
    }

    const datasVazias = batidas.filter((b) => !b.data).length
    const horasVazias = batidas.filter((b) => !b.hora || b.hora === '00:00').length
    const semNome = batidas.filter((b) => !b.nomeColaborador).length

    console.log('\nValidação básica:')
    console.log('  Batidas com data vazia:', datasVazias)
    console.log('  Batidas com hora vazia:', horasVazias)
    console.log('  Batidas sem nome:', semNome)

    console.log('\nPrimeiras 5 batidas:')
    batidas.slice(0, 5).forEach((b, i) => {
      console.log(`\nBatida ${i + 1}:`)
      console.log('  Nome:', b.nomeColaborador)
      console.log('  Matrícula:', b.matricula)
      console.log('  Data:', b.data)
      console.log('  Hora:', b.hora)
      console.log('  Dispositivo:', b.tipoDispositivo)
      console.log('  Nome do dispositivo:', b.nomeDispositivo)
      console.log('  Perímetro:', b.perimetro || '(vazio)')
      console.log('  Departamento:', b.departamento)
      console.log('  Turno:', b.turno)
    })

    const dias = agruparBatidasPorDia(batidas)
    console.log('\nTotal de dias/colaborador agrupados:', dias.length)

    if (dias.length > 0) {
      console.log('\nPrimeiros 3 dias agrupados:')
      dias.slice(0, 3).forEach((d, i) => {
        console.log(`\nDia ${i + 1}:`)
        console.log('  Nome:', d.nomeColaborador)
        console.log('  Data:', d.data)
        console.log('  Dispositivo:', d.tipoDispositivo)
        console.log('  Nome do dispositivo:', d.nomeDispositivo)
        console.log('  Perímetro:', d.perimetro || '(vazio)')
        console.log('  Departamento:', d.departamento)
        console.log('  Turno:', d.turno)
        console.log('  Batidas:', d.batidas.map((b) => b.hora).join(', '))
      })
    }
  } catch (error) {
    console.error('Erro ao processar:', error)
  }
}

testar()
