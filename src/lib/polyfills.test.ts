import { describe, it, expect } from 'vitest'
import './polyfills'

interface Uint8ComHex extends Uint8Array {
  toHex(): string
  toBase64(): string
}

const Uint8ComFromBase64 = Uint8Array as unknown as { fromBase64(s: string): Uint8Array }

describe('polyfills de Uint8Array (pdfjs em navegadores antigos)', () => {
  it('toHex disponível e correto', () => {
    const bytes = new Uint8Array([0, 15, 171, 255]) as Uint8ComHex
    expect(bytes.toHex()).toBe('000fabff')
  })

  it('toBase64 e fromBase64 disponíveis e consistentes', () => {
    const bytes = new Uint8Array([1, 2, 3, 250]) as Uint8ComHex
    const decodificado = Uint8ComFromBase64.fromBase64(bytes.toBase64())
    expect(Array.from(decodificado)).toEqual([1, 2, 3, 250])
  })
})
