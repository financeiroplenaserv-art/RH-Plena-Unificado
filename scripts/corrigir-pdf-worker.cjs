// Copia o worker do pdfjs de node_modules para public/ e injeta os
// polyfills ES2025 (Uint8Array.toHex/toBase64/fromBase64) no início.
//
// Motivo: o pdfjs 5.x chama hash.toHex() no cálculo do fingerprint do
// documento DENTRO do Web Worker (build/pdf.worker.mjs, "fingerprints").
// O worker roda num contexto separado do navegador — o polyfill da thread
// principal (src/lib/polyfills.ts) não existe lá. Em navegadores
// < Chrome/Edge 140, a importação de ponto falhava com
// "a.toHex is not a function" (bug do perfil mesa, 30/07/2026).
//
// Roda automaticamente no postinstall; rode manualmente após atualizar o
// pdfjs-dist: npm run pdf:worker

const fs = require('node:fs')
const path = require('node:path')

const origem = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const destino = path.join(__dirname, '..', 'public', 'pdf.worker.min.mjs')

// Mesma lógica de src/lib/polyfills.ts, minificada para o topo do worker.
const polyfill = `// Polyfills ES2025 injetados por scripts/corrigir-pdf-worker.cjs — nao editar manualmente
if(typeof Uint8Array.prototype.toHex!=='function'){Uint8Array.prototype.toHex=function(){let t='';for(let e=0;e<this.length;e++)t+=this[e].toString(16).padStart(2,'0');return t}}
if(typeof Uint8Array.prototype.toBase64!=='function'){Uint8Array.prototype.toBase64=function(){let t='';for(let e=0;e<this.length;e++)t+=String.fromCharCode(this[e]);return btoa(t)}}
if(typeof Uint8Array.fromBase64!=='function'){Uint8Array.fromBase64=function(t){const e=atob(t),r=new Uint8Array(e.length);for(let n=0;n<e.length;n++)r[n]=e.charCodeAt(n);return r}};
`

if (!fs.existsSync(origem)) {
  console.error('Worker do pdfjs não encontrado em node_modules — rode npm install primeiro.')
  process.exit(1)
}

const worker = fs.readFileSync(origem, 'utf-8')
fs.writeFileSync(destino, polyfill + worker)
console.log('public/pdf.worker.min.mjs atualizado com polyfills ES2025.')
