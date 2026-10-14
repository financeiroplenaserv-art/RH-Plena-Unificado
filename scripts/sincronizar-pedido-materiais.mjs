// Copia a lógica pura do pedido do líder para dentro da Edge Function
// supabase/functions/pedido-materiais/index.ts (o deploy é de arquivo único).
// Uso: node scripts/sincronizar-pedido-materiais.mjs
// O teste src/lib/materiais/pedidoLider.test.ts falha se as cópias divergirem.
//
// Cada arquivo vai entre os marcadores
//   // >>> LÓGICA PURA: <arquivo> (cópia — não editar aqui)
//   // <<< FIM: <arquivo>
// As linhas de `import` são removidas (os arquivos só importam uns dos
// outros; departamentos.ts importa removerAcentos/distanciaLevenshtein de
// utils.ts, que a function define no bloco de infra).
import { readFileSync, writeFileSync } from 'node:fs'

export const ARQUIVOS_PUROS = [
  'src/lib/materiais/pecasCeu.ts',
  'src/lib/materiais/buscaItens.ts',
  'src/lib/materiais/pedidoLider.ts',
  'src/lib/departamentos.ts',
]
export const DESTINO = 'supabase/functions/pedido-materiais/index.ts'
export const inicio = (arq) => `// >>> LÓGICA PURA: ${arq} (cópia — não editar aqui)`
export const fim = (arq) => `// <<< FIM: ${arq}`

/** Conteúdo copiado: LF, sem linhas de import, sem espaço sobrando no fim. */
export function conteudoCopiado(textoArquivo) {
  return textoArquivo
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => !/^import\s.*\sfrom\s+['"][^'"]+['"]\s*;?\s*$/.test(l))
    .join('\n')
    .trimEnd()
}

function sincronizar() {
  let destino = readFileSync(DESTINO, 'utf8').replace(/\r\n/g, '\n')
  for (const arq of ARQUIVOS_PUROS) {
    const ini = inicio(arq)
    const f = fim(arq)
    const i = destino.indexOf(ini)
    const j = destino.indexOf(f)
    if (i < 0 || j < i) throw new Error(`Marcadores de ${arq} não encontrados em ${DESTINO}`)
    const origem = conteudoCopiado(readFileSync(arq, 'utf8'))
    destino = destino.slice(0, i + ini.length) + '\n' + origem + '\n' + destino.slice(j)
  }
  writeFileSync(DESTINO, destino)
  console.log('Lógica pura copiada para', DESTINO, '—', ARQUIVOS_PUROS.length, 'arquivos')
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/sincronizar-pedido-materiais.mjs')) sincronizar()
