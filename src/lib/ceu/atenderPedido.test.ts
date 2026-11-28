import { describe, expect, it } from 'vitest'
import {
  casParaAtualizar,
  conferirResultadoAtender,
  contratosDestino,
  dataSugeridaEntrega,
  dataValida,
  epiSemCa,
  lerResultadoAtender,
  mensagemAtendimento,
} from './atenderPedido'

describe('dataSugeridaEntrega', () => {
  it('usa o dia 1º do mês do pedido', () => {
    expect(dataSugeridaEntrega('2026-12-01', '2026-11-28')).toBe('2026-12-01')
    expect(dataSugeridaEntrega('2026-12-15', '2026-11-28')).toBe('2026-12-01')
  })
  it('sem competência, cai no 1º do mês de hoje', () => {
    expect(dataSugeridaEntrega(null, '2026-11-28')).toBe('2026-11-01')
  })
})

describe('dataValida', () => {
  it('aceita data real e recusa vazia/impossível', () => {
    expect(dataValida('2026-12-01')).toBe(true)
    expect(dataValida('')).toBe(false)
    expect(dataValida('2026-02-30')).toBe(false)
  })
})

describe('CA na janela', () => {
  const luva = { id: 'l', nome: 'LUVA TÉRMICA - Tam. 11', tipo: 'EPI', ca: '' }
  const bota = { id: 'b', nome: 'BOTA PVC 40', tipo: 'EPI', ca: '12345' }
  const camisa = { id: 'c', nome: 'CAMISA', tipo: 'Uniforme', ca: null }

  it('destaca só EPI sem CA', () => {
    expect(epiSemCa(luva)).toBe(true)
    expect(epiSemCa(bota)).toBe(false)
    expect(epiSemCa(camisa)).toBe(false)
  })

  it('atualiza o CA digitado (uma vez por item) e avisa os que ficaram vazios', () => {
    const r = casParaAtualizar([luva, luva, bota, camisa], { l: ' 45.629 ' })
    expect(r.atualizacoes).toEqual([{ item_id: 'l', ca: '45.629' }])
    expect(r.semCa).toEqual([])
  })

  it('vazio não bloqueia: vira aviso', () => {
    const r = casParaAtualizar([luva], {})
    expect(r.atualizacoes).toEqual([])
    expect(r.semCa).toEqual(['LUVA TÉRMICA - Tam. 11'])
  })

  it('não sobrescreve CA que o item já tem', () => {
    expect(casParaAtualizar([bota], { b: '999' }).atualizacoes).toEqual([])
  })
})

describe('retorno da RPC', () => {
  const data = {
    atendidas: 1,
    entregas_criadas: 1,
    ja_atendidas: 1,
    linhas: [
      { id: 'a', entrega_id: 'e1', ja_atendida: false },
      { id: 'b', entrega_id: 'e0', ja_atendida: true },
    ],
  }
  it('confere que toda linha voltou', () => {
    const r = lerResultadoAtender(data)
    expect(conferirResultadoAtender(r, ['a', 'b'])).toBe(true)
    expect(conferirResultadoAtender(r, ['a', 'b', 'c'])).toBe(false)
    expect(conferirResultadoAtender(lerResultadoAtender(null), ['a'])).toBe(false)
  })
  it('mensagem fala da entrega lançada e das já atendidas', () => {
    expect(mensagemAtendimento(lerResultadoAtender(data)!)).toBe('1 linha atendida · 1 entrega lançada no CEU · 1 já estava atendida')
  })
})

describe('contratosDestino', () => {
  it('só ativos, sem o atual, em ordem', () => {
    const r = contratosDestino(
      [
        { id: '1', nome: 'Telex', ativo: true },
        { id: '2', nome: 'Abaeté', ativo: true },
        { id: '3', nome: 'Antigo', ativo: false },
      ],
      '1'
    )
    expect(r.map((c) => c.id)).toEqual(['2'])
  })
})
