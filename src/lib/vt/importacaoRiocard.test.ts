import { describe, expect, it } from 'vitest'
import type { PaginaPDF } from '@/lib/ocorrencias/importacaoPonto'
import {
  calcularPreviaRiocard,
  extrairRiocard,
  normalizarSituacaoBU,
  type ColaboradorRiocard,
  type LinhaRiocard,
} from '@/lib/vt/importacaoRiocard'

const i = (x: number, y: number, texto: string) => ({ x, y, texto })

// Dados fictícios, no layout real (âncora = matrícula em x < 80; BU quebrado em 2 linhas).
function pagina(): PaginaPDF {
  return {
    numero: 1,
    itens: [
      i(384, 765, 'EMPRESA TESTE LTDA'),
      i(551, 765, '-'),
      i(384, 753, 'CNPJ 11.222.333/0001-44'),
      i(40, 655, '• Emitido em 21/11/2026, às 12:17'),
      i(32, 633, 'Matrícula'),
      i(41, 604, '94410'),
      i(121, 604, 'ABEL TESTE'),
      i(289, 604, '142.048.557-17'),
      i(352, 604, 'Inativo'),
      i(455, 609, 'Não possui'),
      i(469, 600, 'BU'),
      i(504, 604, 'Não Habilitado'),
      i(43, 587, '0772'),
      i(129, 587, 'ACACIO TESTE'),
      i(289, 587, '105.642.214-90'),
      i(356, 587, 'Ativo'),
      i(384, 587, '01.04.12837842-5'),
      i(460, 587, 'Ativado'),
      i(504, 587, 'Não Habilitado'),
      i(41, 570, '01027Q'),
      i(130, 570, 'BIA TESTE'),
      i(289, 570, '999.785.047-53'),
      i(356, 570, 'Ativo'),
      i(458, 574, 'Suspenso'),
      i(461, 565, 'Setrans'),
      i(504, 570, 'Não Habilitado'),
      i(41, 553, '555'),
      i(120, 553, 'CIRO TESTE'),
      i(356, 553, 'Ativo'),
      i(455, 557, 'Solicitada'),
      i(460, 548, 'Ativação'),
      i(504, 553, 'Habilitado'),
    ],
  }
}

describe('extrairRiocard', () => {
  it('lê cabeçalho e linhas, junta BU quebrado e normaliza "Solicitada Ativação"', () => {
    const r = extrairRiocard([pagina()])
    expect(r.empresa).toBe('EMPRESA TESTE LTDA')
    expect(r.cnpj).toBe('11.222.333/0001-44')
    expect(r.emitidoEm).toBe('2026-11-21')
    expect(r.linhas.map((l) => [l.matricula, l.nome, l.cpf, l.status, l.cartao, l.situacao])).toEqual([
      ['94410', 'ABEL TESTE', '14204855717', 'Inativo', '', 'Não possui BU'],
      ['0772', 'ACACIO TESTE', '10564221490', 'Ativo', '01.04.12837842-5', 'Ativado'],
      ['01027Q', 'BIA TESTE', '99978504753', 'Ativo', '', 'Suspenso Setrans'],
      ['555', 'CIRO TESTE', null, 'Ativo', '', 'Ativação Solicitada'],
    ])
    expect(r.linhas[3].compra).toBe('Habilitado')
  })

  it('normalizarSituacaoBU', () => {
    expect(normalizarSituacaoBU('Solicitada Ativação')).toBe('Ativação Solicitada')
    expect(normalizarSituacaoBU('Suspenso   Setrans')).toBe('Suspenso Setrans')
  })
})

const linha = (cpf: string | null, status: string, situacao: string, extra: Partial<LinhaRiocard> = {}): LinhaRiocard => ({
  matricula: '1',
  nome: `Pessoa ${cpf}`,
  cpf,
  status,
  cartao: '01.04.1',
  situacao,
  compra: 'Não Habilitado',
  conta: 'EA',
  ...extra,
})
const colab = (id: string, cpf: string | null, optante: boolean, sit: string | null = null, extra: Partial<ColaboradorRiocard> = {}): ColaboradorRiocard => ({
  id,
  nome_completo: `Pessoa ${id}`,
  cpf,
  status: 'Ativo',
  vt_optante: optante,
  vt_bu_ativado: sit === null ? null : sit === 'Ativado',
  vt_bu_situacao: sit,
  vt_bu_consultado_em: '2026-11-21',
  vt_riocard_numero_cartao: '01.04.1',
  ...extra,
})

describe('calcularPreviaRiocard', () => {
  it('usa sempre o cadastro ATIVO quando o CPF repete com um antigo inativo', () => {
    const linhas = [linha('11111111111', 'Inativo', 'Suspenso Setrans'), linha('11111111111', 'Ativo', 'Ativado')]
    const p = calcularPreviaRiocard(linhas, [colab('a', '11111111111', true, 'Suspenso Setrans')], '2026-11-22')
    expect(p.mudancas).toHaveLength(1)
    expect(p.mudancas[0].depois.vt_bu_situacao).toBe('Ativado')
    expect(p.mudancas[0].depois.vt_bu_ativado).toBe(true)
    expect(p.mudancas[0].depois.vt_bu_consultado_em).toBe('2026-11-22')
  })

  it('classifica as listas de conferência', () => {
    const linhas = [
      linha('11111111111', 'Ativo', 'Ativado'), // igual (só data)
      linha('22222222222', 'Ativo', 'Suspenso Setrans'), // muda
      linha('33333333333', 'Ativo', 'Ativado'), // sem cadastro no CORH
      linha('44444444444', 'Ativo', 'Ativado'), // não optante
      linha('55555555555', 'Inativo', 'Não possui BU'), // só inativo
    ]
    const cs = [
      colab('a', '11111111111', true, 'Ativado'),
      colab('b', '22222222222', true, 'Ativado'),
      colab('c', '44444444444', false, 'Ativado'),
      colab('d', '55555555555', true),
      colab('e', '66666666666', true), // optante sem Riocard
      colab('f', null, true), // optante sem CPF
    ]
    const p = calcularPreviaRiocard(linhas, cs, '2026-11-22')
    expect(p.mudancas.map((m) => m.colaborador.id)).toEqual(['b'])
    expect(p.mudancas[0].depois.vt_bu_ativado).toBe(false)
    expect(p.semMudancaSituacao.map((m) => m.colaborador.id).sort()).toEqual(['a', 'c'])
    expect(p.semCadastroAtivoNoCorh.map((l) => l.cpf)).toEqual(['33333333333'])
    expect(p.ativosNaRiocardNaoOptantes.map((a) => a.colaborador.id)).toEqual(['c'])
    expect(p.soInativoNaRiocard.map((a) => a.colaborador.id)).toEqual(['d'])
    expect(p.optantesSemCadastroNaRiocard.map((c) => c.id).sort()).toEqual(['d', 'e', 'f'])
  })

  it('não chuta: dois ativos do mesmo CPF e situação desconhecida ficam de fora', () => {
    const linhas = [
      linha('11111111111', 'Ativo', 'Ativado', { conta: 'EA' }),
      linha('11111111111', 'Ativo', 'Suspenso Setrans', { conta: 'TECH' }),
      linha('22222222222', 'Ativo', 'Situação Nova'),
    ]
    const p = calcularPreviaRiocard(linhas, [colab('a', '11111111111', true), colab('b', '22222222222', true)], '2026-11-22')
    expect(p.mudancas).toHaveLength(0)
    expect(p.conflitosAtivoDuplicado).toHaveLength(2)
    expect(p.situacoesDesconhecidas).toHaveLength(1)
  })

  it('CPF sem zero à esquerda no CORH casa com o do relatório', () => {
    const p = calcularPreviaRiocard([linha('01889824771', 'Ativo', 'Ativado')], [colab('a', '1889824771', true)], '2026-11-22')
    expect(p.mudancas).toHaveLength(1)
  })

  it('mantém o nº do cartão atual quando o arquivo não traz cartão', () => {
    const p = calcularPreviaRiocard([linha('11111111111', 'Ativo', 'Ativado', { cartao: '' })], [colab('a', '11111111111', true, 'Suspenso Setrans')], '2026-11-22')
    expect(p.mudancas[0].depois.vt_riocard_numero_cartao).toBe('01.04.1')
  })
})
