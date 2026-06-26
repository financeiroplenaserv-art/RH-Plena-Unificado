import '@testing-library/jest-dom/vitest'

// Polyfill para pdfjs-dist rodar no ambiente jsdom do Vitest
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    a = 1
    b = 0
    c = 0
    d = 1
    e = 0
    f = 0
    constructor(init?: string | number[]) {
      if (Array.isArray(init)) {
        this.a = init[0] ?? 1
        this.b = init[1] ?? 0
        this.c = init[2] ?? 0
        this.d = init[3] ?? 1
        this.e = init[4] ?? 0
        this.f = init[5] ?? 0
      }
    }
  } as unknown as typeof DOMMatrix
}
