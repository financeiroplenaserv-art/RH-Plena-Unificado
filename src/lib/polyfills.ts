// ============================================================
// Polyfills de APIs ES2025 usadas pelo pdfjs-dist 5.x.
//
// Uint8Array.prototype.toHex/toBase64 e Uint8Array.fromBase64 só existem
// nativamente a partir do Chrome/Edge 140 (2025). Em navegadores mais
// antigos, processar qualquer PDF (importação de ponto em Adicionais,
// VR, ocorrências) falhava com "a.toHex is not a function" no cálculo
// do fingerprint do documento.
// ============================================================

const uint8Proto = Uint8Array.prototype as Uint8Array & {
  toHex?: () => string
  toBase64?: () => string
}

if (typeof uint8Proto.toHex !== 'function') {
  uint8Proto.toHex = function (this: Uint8Array): string {
    let hex = ''
    for (let i = 0; i < this.length; i++) {
      hex += this[i].toString(16).padStart(2, '0')
    }
    return hex
  }
}

if (typeof uint8Proto.toBase64 !== 'function') {
  uint8Proto.toBase64 = function (this: Uint8Array): string {
    let bin = ''
    for (let i = 0; i < this.length; i++) {
      bin += String.fromCharCode(this[i])
    }
    return btoa(bin)
  }
}

const uint8Ctor = Uint8Array as unknown as { fromBase64?: (base64: string) => Uint8Array }
if (typeof uint8Ctor.fromBase64 !== 'function') {
  uint8Ctor.fromBase64 = (base64: string): Uint8Array => {
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i)
    }
    return bytes
  }
}
