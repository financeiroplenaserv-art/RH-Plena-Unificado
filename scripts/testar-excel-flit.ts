import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseWorkbookBinary, agruparBatidasPorDia } from '../src/lib/escalas/importarFlit.js'

const arquivo = resolve(process.cwd(), 'public/Marcacoes 01_06_2026 - 05_06_2026 (2).xlsx')
console.log('Lendo:', arquivo)

const buffer = readFileSync(arquivo)
console.log('Bytes lidos:', buffer.length)

parseWorkbookBinary(buffer)
  .then((batidas) => {
    console.log('Total de batidas:', batidas.length)
    console.log('Primeiras 3 batidas:')
    console.log(JSON.stringify(batidas.slice(0, 3), null, 2))

    const dias = agruparBatidasPorDia(batidas)
    console.log('Total de dias/colaborador:', dias.length)

    const comPerimetro = dias.filter((d) => d.perimetro && d.perimetro !== '--')
    console.log('Dias com perímetro:', comPerimetro.length)
    console.log('Exemplos de perímetro:')
    console.log(JSON.stringify(comPerimetro.slice(0, 5).map((d) => ({ nome: d.nomeColaborador, data: d.data, perimetro: d.perimetro })), null, 2))

    // Distribuição por tipo de dispositivo
    const dispositivos = new Map<string, number>()
    for (const d of dias) {
      const tipo = d.tipoDispositivo || 'vazio'
      dispositivos.set(tipo, (dispositivos.get(tipo) || 0) + 1)
    }
    console.log('Distribuição por tipo de dispositivo:', Object.fromEntries(dispositivos))
  })
  .catch((err) => {
    console.error('Erro ao parsear:', err)
    process.exit(1)
  })
