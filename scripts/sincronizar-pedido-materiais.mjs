// Copia src/lib/materiais/pedidoLider.ts para dentro da Edge Function
// supabase/functions/pedido-materiais/index.ts (o deploy é de arquivo único).
// Uso: node scripts/sincronizar-pedido-materiais.mjs
// O teste src/lib/materiais/pedidoLider.test.ts falha se as cópias divergirem.
import { readFileSync, writeFileSync } from 'node:fs'

const ORIGEM = 'src/lib/materiais/pedidoLider.ts'
const DESTINO = 'supabase/functions/pedido-materiais/index.ts'
const INICIO = '// >>> LÓGICA PURA (cópia de src/lib/materiais/pedidoLider.ts — não editar aqui)'
const FIM = '// <<< FIM DA LÓGICA PURA'

const origem = readFileSync(ORIGEM, 'utf8').replace(/\r\n/g, '\n').trimEnd()
const destino = readFileSync(DESTINO, 'utf8').replace(/\r\n/g, '\n')
const i = destino.indexOf(INICIO)
const f = destino.indexOf(FIM)
if (i < 0 || f < i) throw new Error('Marcadores não encontrados em ' + DESTINO)
const novo = destino.slice(0, i + INICIO.length) + '\n' + origem + '\n' + destino.slice(f)
writeFileSync(DESTINO, novo)
console.log('Lógica pura copiada para', DESTINO)
