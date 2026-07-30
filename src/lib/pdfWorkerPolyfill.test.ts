import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

// O pdfjs 5.x chama Uint8Array.toHex() no cálculo do fingerprint DENTRO do
// Web Worker (contexto separado da thread principal). Se alguém recopiar o
// worker de node_modules sem rodar scripts/corrigir-pdf-worker.cjs, a
// importação de ponto volta a quebrar em navegadores antigos
// ("a.toHex is not a function" — bug do perfil mesa, 30/07/2026).
describe('worker do pdfjs em public/', () => {
  it('contém os polyfills ES2025 injetados no topo', () => {
    const worker = readFileSync(path.join(projectRoot, 'public', 'pdf.worker.min.mjs'), 'utf-8')
    expect(worker.startsWith('// Polyfills ES2025 injetados por scripts/corrigir-pdf-worker.cjs')).toBe(true)
    expect(worker).toContain("Uint8Array.prototype.toHex=function")
    expect(worker).toContain("Uint8Array.prototype.toBase64=function")
    expect(worker).toContain("Uint8Array.fromBase64=function")
  })
})
