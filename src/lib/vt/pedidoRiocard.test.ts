import { describe, expect, it } from 'vitest'
import {
  matriculaRiocardValida,
  montarConteudoPedidoRiocard,
  montarPedidoRiocard,
  nomeArquivoPedidoRiocard,
  vinculosRiocardDoRelatorio,
  type VinculoRiocard,
} from '@/lib/vt/pedidoRiocard'
import type { LinhaRiocard, RelatorioRiocard } from '@/lib/vt/importacaoRiocard'

const EA = '11222333000181'
const TECH = '44555666000122'
const AGORA = new Date(2026, 10, 28, 9, 5) // 28/11/2026 09:05 (componentes locais = Brasília)

const v = (matriculaRiocard: string, cnpj = EA): VinculoRiocard => ({ matriculaRiocard, cnpj })
const t = (colaboradorId: string, nome: string, valorCentavos: number | null) => ({ colaboradorId, nome, valorCentavos })

describe('arquivo exato', () => {
  it('2 pessoas, byte a byte (CRLF, alfa à esquerda, num à direita)', () => {
    const txt = montarConteudoPedidoRiocard(EA, [
      { matriculaRiocard: '0772', valorCentavos: 6530 },
      { matriculaRiocard: '01027Q', valorCentavos: 112000 },
    ])
    expect(txt).toBe(
      `0000101PEDIDO01.00${EA}\r\n` +
        '0000202' + '0772           ' + '00006530\r\n' +
        '0000302' + '01027Q         ' + '00112000\r\n' +
        '00004990000118530\r\n',
    )
    for (const l of txt.trimEnd().split('\r\n')) expect([32, 30, 17]).toContain(l.length)
  })

  it('reproduz o exemplo do PDF (header e item)', () => {
    const txt = montarConteudoPedidoRiocard('22333444000155', [{ matriculaRiocard: '55666', valorCentavos: 7500 }])
    expect(txt.split('\r\n')[0]).toBe('0000101PEDIDO01.0022333444000155')
    expect(txt.split('\r\n')[1]).toBe('000020255666          00007500')
  })

  it('recusa CNPJ e valor inválidos', () => {
    expect(() => montarConteudoPedidoRiocard('123', [])).toThrow()
    expect(() => montarConteudoPedidoRiocard(EA, [{ matriculaRiocard: '1', valorCentavos: 0 }])).toThrow()
  })
})

describe('nome do arquivo', () => {
  it('usa data e hora de Brasília', () => {
    expect(nomeArquivoPedidoRiocard(EA, AGORA)).toBe(`PEDIDO_0100_${EA}_20261128_0905.txt`)
  })
})

describe('montarPedidoRiocard', () => {
  const base = { cnpjsPermitidos: ['11.222.333/0001-81', TECH], agora: AGORA }

  it('separa por CNPJ e ordena por matrícula, total = soma', () => {
    const r = montarPedidoRiocard({
      ...base,
      totais: [t('a', 'Ana', 1000), t('b', 'Bia', 2000), t('c', 'Caio', 500)],
      vinculos: new Map([
        ['a', v('0900')],
        ['b', v('0100', TECH)],
        ['c', v('0200')],
      ]),
    })
    expect(r.fora).toEqual([])
    expect(r.arquivos.map((a) => a.cnpj)).toEqual([EA, TECH])
    expect(r.arquivos[0].itens.map((i) => i.matriculaRiocard)).toEqual(['0200', '0900'])
    expect(r.arquivos[0].totalCentavos).toBe(1500)
    expect(r.arquivos[0].conteudo.endsWith('00004990000001500\r\n')).toBe(true)
    expect(r.arquivos[1].totalCentavos).toBe(2000)
  })

  it('todos os motivos de ficar fora', () => {
    const r = montarPedidoRiocard({
      ...base,
      totais: [
        t('zero', 'Zero', 0),
        t('nulo', 'Nulo', null),
        t('sem', 'Sem Matricula', 100),
        t('longa', 'Longa', 100),
        t('inv', 'Invalida', 100),
        t('grande', 'Grande', 100_000_000),
        t('cnpj', 'Cnpj Estranho', 100),
        t('d1', 'Dup Um', 100),
        t('d2', 'Dup Dois', 100),
        t('ok', 'Ok', 100),
      ],
      vinculos: new Map<string, VinculoRiocard>([
        ['longa', v('1234567890123456')],
        ['inv', v('12 34')],
        ['grande', v('7')],
        ['cnpj', v('8', '99999999000199')],
        ['d1', v('55')],
        ['d2', v('55')],
        ['ok', v('0772')],
        ['zero', v('1')],
        ['nulo', v('2')],
      ]),
    })
    const motivo = (id: string) => r.fora.find((f) => f.colaboradorId === id)?.motivo ?? ''
    expect(motivo('zero')).toMatch(/sem valor/)
    expect(motivo('nulo')).toMatch(/indeterminado/)
    expect(motivo('sem')).toMatch(/sem matrícula na Riocard/)
    expect(motivo('longa')).toMatch(/16 caracteres/)
    expect(motivo('inv')).toMatch(/caractere inválido/)
    expect(motivo('grande')).toMatch(/acima do limite/)
    expect(motivo('cnpj')).toMatch(/CNPJ/)
    expect(motivo('d1')).toMatch(/repetida/)
    expect(motivo('d2')).toMatch(/repetida/)
    expect(r.fora).toHaveLength(9)
    expect(r.arquivos).toHaveLength(1)
    expect(r.arquivos[0].itens.map((i) => i.colaboradorId)).toEqual(['ok'])
  })

  it('mesma matrícula em CNPJs diferentes não é duplicidade', () => {
    const r = montarPedidoRiocard({
      ...base,
      totais: [t('a', 'Ana', 100), t('b', 'Bia', 100)],
      vinculos: new Map([
        ['a', v('55')],
        ['b', v('55', TECH)],
      ]),
    })
    expect(r.fora).toEqual([])
    expect(r.arquivos).toHaveLength(2)
  })

  it('usa o motivo específico de conflito quando informado', () => {
    const r = montarPedidoRiocard({
      ...base,
      totais: [t('x', 'Xis', 100)],
      vinculos: new Map(),
      motivosSemVinculo: new Map([['x', 'CPF ativo em duas contas']]),
    })
    expect(r.fora[0].motivo).toBe('CPF ativo em duas contas')
  })

  it('matriculaRiocardValida', () => {
    expect(matriculaRiocardValida('01027Q')).toBe(true)
    expect(matriculaRiocardValida('')).toBe(false)
    expect(matriculaRiocardValida('12-3')).toBe(false)
  })
})

describe('vinculosRiocardDoRelatorio', () => {
  const linha = (matricula: string, cpf: string, status = 'Ativo'): LinhaRiocard => ({
    matricula,
    nome: 'X',
    cpf,
    status,
    cartao: '',
    situacao: 'Ativado',
    compra: '',
    conta: 'c',
  })
  const rel = (cnpj: string, linhas: LinhaRiocard[]): RelatorioRiocard => ({ empresa: 'E', cnpj, emitidoEm: null, linhas })

  it('casa por CPF exato, só ativos, e detecta conflito entre contas', () => {
    const r = vinculosRiocardDoRelatorio(
      [
        rel('11.222.333/0001-81', [linha('0772', '11111111111'), linha('9', '22222222222', 'Inativo'), linha('5', '33333333333')]),
        rel('44.555.666/0001-22', [linha('6', '33333333333'), linha('7', '44444444444')]),
      ],
      [
        { id: 'a', cpf: '111.111.111-11', status: 'Ativo' },
        { id: 'b', cpf: '22222222222', status: 'Ativo' },
        { id: 'c', cpf: '33333333333', status: 'Ativo' },
        { id: 'd', cpf: '44444444444', status: 'Inativo' },
      ],
    )
    expect(r.vinculos.get('a')).toEqual({ matriculaRiocard: '0772', cnpj: '11222333000181' })
    expect(r.vinculos.has('b')).toBe(false) // inativo na Riocard
    expect(r.vinculos.has('c')).toBe(false) // conflito
    expect(r.vinculos.has('d')).toBe(false) // inativo no CORH
    expect(r.conflitos).toHaveLength(1)
    expect(r.conflitos[0]).toMatchObject({ cpf: '33333333333', colaboradorIds: ['c'] })
    expect(r.motivosPorColaborador.get('c')).toMatch(/mais de uma vez/)
  })

  it('CPF repetido no CORH vira conflito', () => {
    const r = vinculosRiocardDoRelatorio(
      [rel('11222333000181', [linha('1', '11111111111')])],
      [
        { id: 'a', cpf: '11111111111', status: 'Ativo' },
        { id: 'b', cpf: '11111111111', status: 'Afastado' },
      ],
    )
    expect(r.vinculos.size).toBe(0)
    expect(r.conflitos[0].colaboradorIds).toEqual(['a', 'b'])
  })
})
