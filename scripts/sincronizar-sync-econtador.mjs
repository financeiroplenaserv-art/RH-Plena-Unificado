// Copia as fatias demarcadas da lógica pura de src para dentro da Edge
// Function supabase/functions/sync-econtador/index.ts (o deploy é de arquivo
// único). Uso: node scripts/sincronizar-sync-econtador.mjs
// O teste src/lib/econtador.test.ts ("cópia na Edge Function sync-econtador")
// falha se as cópias divergirem.
//
// No SRC, cada fatia vai entre os marcadores
//   // >>> SYNC-ECONTADOR: INÍCIO
//   // <<< SYNC-ECONTADOR: FIM
// Na FUNCTION, o destino é
//   // >>> LÓGICA PURA: <arquivo> (cópia — não editar aqui)
//   // <<< FIM: <arquivo>
// As fatias não contêm imports: usam só removerAcentos/distanciaLevenshtein,
// que a function define no próprio bloco de infra (mesmo padrão do
// pedido-materiais).
import { readFileSync, writeFileSync } from 'node:fs'

export const FONTES = ['src/lib/departamentos.ts', 'src/lib/econtador.ts']
export const DESTINO = 'supabase/functions/sync-econtador/index.ts'

export const SRC_INI = '// >>> SYNC-ECONTADOR: INÍCIO'
export const SRC_FIM = '// <<< SYNC-ECONTADOR: FIM'
export const destinoIni = (arq) => `// >>> LÓGICA PURA: ${arq} (cópia — não editar aqui)`
export const destinoFim = (arq) => `// <<< FIM: ${arq}`

/** Fatia do src entre os marcadores SYNC-ECONTADOR (LF, sem os marcadores). */
export function fatiaOrigem(textoArquivo) {
  const linhas = textoArquivo.replace(/\r\n/g, '\n').split('\n')
  const i = linhas.findIndex((l) => l.startsWith(SRC_INI))
  const j = linhas.findIndex((l) => l.startsWith(SRC_FIM))
  if (i < 0 || j < i) throw new Error(`Marcadores SYNC-ECONTADOR não encontrados no src`)
  return linhas.slice(i + 1, j).join('\n').trimEnd()
}

function sincronizar() {
  let destino = readFileSync(DESTINO, 'utf8').replace(/\r\n/g, '\n')
  for (const arq of FONTES) {
    const ini = destinoIni(arq)
    const fim = destinoFim(arq)
    const i = destino.indexOf(ini)
    const j = destino.indexOf(fim)
    if (i < 0 || j < i) throw new Error(`Marcadores de ${arq} não encontrados em ${DESTINO}`)
    const fatia = fatiaOrigem(readFileSync(arq, 'utf8'))
    destino = destino.slice(0, i + ini.length) + '\n' + fatia + '\n' + destino.slice(j)
  }
  writeFileSync(DESTINO, destino)
  console.log('Lógica pura copiada para', DESTINO, '—', FONTES.length, 'arquivos')
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/sincronizar-sync-econtador.mjs')) sincronizar()
