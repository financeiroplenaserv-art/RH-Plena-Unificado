import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CartaLider, LinhaCarta } from './cartaLider'
import { baixarCartaPdf, baixarCartasMalote, baixarCartasZip } from './cartaLiderPdf'

// Gera os PDFs de verdade (jsPDF no jsdom) e confere páginas e tamanho, sem
// depender de rede (o logo falha e a carta sai sem ele).

const linhaBase: LinhaCarta = { secao: 'kit', descricao: 'Cloro 5L', pediu: '3 bombonas 5L', vamosEnviar: '3 bombonas 5L', observacao: '', situacao: 'atendido' }
const carta = (n: number, nome = 'Vila de Cascais'): CartaLider => ({
  contratoId: nome,
  contratoNome: nome,
  competencia: '2026-10-01',
  responsavel: 'Ana S.',
  emAnalise: false,
  linhas: Array.from({ length: n }, (_, i) => ({ ...linhaBase, descricao: `Item ${i + 1}`, secao: i < n / 2 ? 'kit' : 'extra', observacao: i % 3 ? '' : 'Acima da média do posto nos últimos meses' })),
})

const capturados: { nome: string; blob: Blob }[] = []
function capturar() {
  capturados.length = 0
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    capturados.push({ nome: this.download, blob: (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as Blob })
  })
}

async function paginasDoPdf(blob: Blob): Promise<number> {
  const texto = await blob.text()
  return (texto.match(/\/Type \/Page[^s]/g) ?? []).length
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('PDF da carta ao líder', () => {
  it('carta comum cabe em 1 página A4', async () => {
    capturar()
    await baixarCartaPdf(carta(30))
    expect(capturados[0].nome).toBe('carta-lider_vila-de-cascais_2026-10.pdf')
    expect(await paginasDoPdf(capturados[0].blob)).toBe(1)
  })
  it('carta enorme passa de página e numera "página X de Y"', async () => {
    capturar()
    await baixarCartaPdf(carta(120))
    const texto = await capturados[0].blob.text()
    expect(await paginasDoPdf(capturados[0].blob)).toBeGreaterThan(1)
    expect(texto).toContain('de 2')
  })
  it('zip com um PDF por contrato e malote com todas as páginas', async () => {
    capturar()
    await baixarCartasZip([carta(5, 'Abaeté'), carta(5, 'Telex')], '2026-10-01')
    expect(capturados[0].nome).toBe('cartas-lider_2026-10.zip')
    const zip = new Uint8Array(await capturados[0].blob.arrayBuffer())
    expect(new DataView(zip.buffer).getUint16(zip.length - 22 + 10, true)).toBe(2)
    await baixarCartasMalote([carta(5, 'Abaeté'), carta(5, 'Telex')], '2026-10-01')
    expect(capturados[1].nome).toBe('cartas-lider_2026-10_malote.pdf')
    expect(await paginasDoPdf(capturados[1].blob)).toBe(2)
  })
})
