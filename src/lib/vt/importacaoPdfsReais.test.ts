// Teste LOCAL: confere o parser contra os PDFs reais e o resultado do
// processamento manual de 21/11/2026. dados-locais/ não é versionado, então o
// teste é pulado quando os arquivos não existem (CI/outras máquinas).
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getPdfjsLib } from '@/lib/pdfPosicional'
import type { PaginaPDF } from '@/lib/ocorrencias/importacaoPonto'
import { extrairRelatorioAlterdata } from '@/lib/vt/importacaoAlterdata'
import { extrairRiocard } from '@/lib/vt/importacaoRiocard'

const ALT = 'dados-locais/alterdata_optantes_vt_2026-11-21/'
const RIO = 'dados-locais/riocard_2026-11-21/'
const existem = [ALT + 'desconta_vt.pdf', ALT + 'nao_desconta_vt.pdf', ALT + 'listas.json', RIO + 'cadastro_funcionarios_riocard.pdf', RIO + 'riocard_linhas.json'].every(existsSync)

async function paginas(caminho: string): Promise<PaginaPDF[]> {
  const lib = await getPdfjsLib()
  const pdf = await lib.getDocument({ data: new Uint8Array(readFileSync(caminho)) }).promise
  const out: PaginaPDF[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const c = await (await pdf.getPage(p)).getTextContent()
    out.push({
      numero: p,
      itens: c.items
        .filter((x) => 'str' in x)
        .map((x) => ({ x: (x as { transform: number[] }).transform[4], y: (x as { transform: number[] }).transform[5], texto: (x as { str: string }).str })),
    })
  }
  return out
}

describe.skipIf(!existem)('parsers contra os PDFs reais de 21/11/2026', () => {
  const listas = existem ? JSON.parse(readFileSync(ALT + 'listas.json', 'utf8')) : {}

  it('desconta VT = 238 linhas iguais às do processamento manual', async () => {
    const r = extrairRelatorioAlterdata(await paginas(ALT + 'desconta_vt.pdf'))
    expect(r.tipo).toBe('desconta')
    expect(r.registros).toHaveLength(listas.desconta.length)
    r.registros.forEach((x: { cpf: string | null; nome: string; empresa: string }, i: number) => {
      expect([x.cpf, x.nome, x.empresa]).toEqual([listas.desconta[i].cpf, listas.desconta[i].nome, listas.desconta[i].empresa])
    })
  }, 60000)

  it('não beneficiário = 61 linhas iguais às do processamento manual', async () => {
    const r = extrairRelatorioAlterdata(await paginas(ALT + 'nao_desconta_vt.pdf'))
    expect(r.tipo).toBe('nao_beneficiario')
    expect(r.registros).toHaveLength(listas.nao_desconta.length)
    r.registros.forEach((x: { cpf: string | null; nome: string; empresa: string }, i: number) => {
      expect([x.cpf, x.nome, x.empresa]).toEqual([listas.nao_desconta[i].cpf, listas.nao_desconta[i].nome, listas.nao_desconta[i].empresa])
    })
  }, 60000)

  it('Riocard = 930 linhas iguais às do processamento manual', async () => {
    const man = JSON.parse(readFileSync(RIO + 'riocard_linhas.json', 'utf8'))
    const r = extrairRiocard(await paginas(RIO + 'cadastro_funcionarios_riocard.pdf'))
    expect(r.emitidoEm).toBe('2026-11-21')
    expect(r.linhas).toHaveLength(man.length)
    r.linhas.forEach((x, i) => {
      const m = man[i]
      expect([x.matricula, x.cpf ?? '', x.status, x.cartao, x.situacao]).toEqual([
        m.matricula,
        m.cpfDig,
        m.status,
        m.cartao,
        m.bu === 'Solicitada Ativação' ? 'Ativação Solicitada' : m.bu,
      ])
    })
  }, 60000)
})
