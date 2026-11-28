import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { VtArquivoRiocardDialog } from '@/pages/vt/VtArquivoRiocardDialog'
import { hojeBrasil } from '@/lib/utils'
import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import type { RelatorioRiocard } from '@/lib/vt/importacaoRiocard'

const CNPJ_EA = '11111111000111'
const CNPJ_TECH = '22222222000122'

function linha(matricula: string, nome: string, cpf: string, conta: string) {
  return { matricula, nome, cpf, status: 'Ativo', cartao: '1', situacao: 'Ativado', compra: '', conta }
}

const RELATORIOS: Record<string, RelatorioRiocard> = {
  'ea.pdf': { empresa: 'PLENA EA', cnpj: '11.111.111/0001-11', emitidoEm: hojeBrasil(), linhas: [linha('0772', 'Ana', '11111111111', 'PLENA EA')] },
  'tech.pdf': { empresa: 'PLENA TECH', cnpj: '22.222.222/0001-22', emitidoEm: '2020-01-01', linhas: [linha('01027Q', 'Bia', '22222222222', 'PLENA TECH')] },
}

vi.mock('@/lib/pdfPosicional', () => ({ extrairPaginasPosicionais: vi.fn(async (f: File) => f.name) }))
vi.mock('@/lib/vt/importacaoRiocard', () => ({ extrairRiocard: vi.fn((p: string) => RELATORIOS[p]) }))
vi.mock('@/lib/supabase', () => {
  const dados = [
    { id: 'p1', cpf: '111.111.111-11', status: 'Ativo', nome_completo: 'Ana' },
    { id: 'p2', cpf: '22222222222', status: 'Ativo', nome_completo: 'Bia' },
    { id: 'p3', cpf: '33333333333', status: 'Ativo', nome_completo: 'Caio Sem Riocard' },
    { id: 'p4', cpf: '44444444444', status: 'Ativo', nome_completo: 'Duda Zerada' },
  ]
  const consulta = () => {
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.in = () => q
    q.then = (ok: (v: unknown) => void) => ok({ data: dados, error: null })
    return q
  }
  return { supabase: { from: consulta } }
})
const baixados = vi.hoisted(() => [] as { nome: string; conteudo: string }[])
vi.mock('@/lib/vt/conferenciaPedidoRiocard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vt/conferenciaPedidoRiocard')>()),
  baixarTextoPuro: (nome: string, conteudo: string) => baixados.push({ nome, conteudo }),
}))

function lote(totais: Record<string, number | null>): LoteCargaVT {
  return {
    competencia: '2026-12',
    totaisPorColaborador: Object.entries(totais).map(([colaboradorId, valorCentavos]) => ({ colaboradorId, valorCentavos })),
  } as unknown as LoteCargaVT
}

function anexar(...nomes: string[]) {
  const input = screen.getByLabelText(/PDFs da Riocard/)
  fireEvent.change(input, { target: { files: nomes.map((n) => new File(['x'], n, { type: 'application/pdf' })) } })
}

describe('VtArquivoRiocardDialog', () => {
  beforeEach(() => { baixados.length = 0 })

  it('lê dois relatórios, mostra uma linha por CNPJ, avisa relatório antigo e lista quem fica fora', async () => {
    render(<VtArquivoRiocardDialog open onOpenChange={() => {}} lote={lote({ p1: 1000, p2: 2500, p3: 800, p4: 0 })} nomes={new Map()} />)
    anexar('ea.pdf', 'tech.pdf')

    const linhas = await screen.findAllByTestId('linha-arquivo')
    expect(linhas).toHaveLength(2)
    expect(within(linhas[0]).getByText('11.111.111/0001-11')).toBeInTheDocument()
    expect(within(linhas[0]).getByText('R$ 10,00')).toBeInTheDocument()
    expect(within(linhas[1]).getByText('22.222.222/0001-22')).toBeInTheDocument()
    expect(within(linhas[1]).getByText('R$ 25,00')).toBeInTheDocument()
    // só o relatório de 2020 tem o aviso de mais de 7 dias
    expect(screen.getAllByText(/mais de 7 dias/)).toHaveLength(1)

    const fora = screen.getByTestId('fora-do-arquivo')
    expect(within(fora).getByText(/Ficam fora do arquivo \(2\)/)).toBeInTheDocument()
    expect(within(fora).getByText('Caio Sem Riocard')).toBeInTheDocument()
    expect(within(fora).getByText('Duda Zerada')).toBeInTheDocument()
  })

  it('exige conferir a lista de quem fica fora quando há valor a receber', async () => {
    render(<VtArquivoRiocardDialog open onOpenChange={() => {}} lote={lote({ p1: 1000, p2: 2500, p3: 800 })} nomes={new Map()} />)
    anexar('ea.pdf', 'tech.pdf')
    await screen.findAllByTestId('linha-arquivo')

    const botao = screen.getByRole('button', { name: /Baixar arquivo\(s\)/ })
    expect(botao).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/Conferi a lista de quem fica fora/))
    expect(botao).toBeEnabled()
  })

  it('baixa um TXT por CNPJ com o nome oficial e o layout 01.00', async () => {
    render(<VtArquivoRiocardDialog open onOpenChange={() => {}} lote={lote({ p1: 1000, p2: 2500 })} nomes={new Map()} />)
    anexar('ea.pdf', 'tech.pdf')
    await screen.findAllByTestId('linha-arquivo')

    const botao = screen.getByRole('button', { name: /Baixar arquivo\(s\)/ })
    await waitFor(() => expect(botao).toBeEnabled())
    fireEvent.click(botao)

    expect(baixados).toHaveLength(2)
    expect(baixados[0].nome).toMatch(new RegExp(`^PEDIDO_0100_${CNPJ_EA}_\\d{8}_\\d{4}\\.txt$`))
    expect(baixados[1].nome).toMatch(new RegExp(`^PEDIDO_0100_${CNPJ_TECH}_\\d{8}_\\d{4}\\.txt$`))
    const linhasEa = baixados[0].conteudo.split('\r\n')
    expect(linhasEa[0]).toBe(`0000101PEDIDO01.00${CNPJ_EA}`)
    expect(linhasEa[1]).toBe('0000202' + '0772'.padEnd(15, ' ') + '00001000')
    expect(linhasEa[2]).toBe('0000399' + '0000001000')
  })

  it('recusa PDF que não é da Riocard', async () => {
    render(<VtArquivoRiocardDialog open onOpenChange={() => {}} lote={lote({ p1: 1000 })} nomes={new Map()} />)
    anexar('outro.pdf')
    // extrairRiocard mockado devolve undefined para arquivo desconhecido -> erro de leitura
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Baixar arquivo\(s\)/ })).toBeDisabled()
  })
})
