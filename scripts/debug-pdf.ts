import fs from 'fs'
import { extrairPaginasPDF } from '../src/lib/vr/pdfExtractor'

const buf = fs.readFileSync('dados-locais/teste-ponto.pdf')
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

extrairPaginasPDF(arrayBuffer)
  .then((paginas) => {
    console.log('=== PÁGINA 1 ===')
    console.log(paginas[0])
    console.log('=== FIM ===')
  })
  .catch((err) => {
    console.error('ERRO:', err)
  })
