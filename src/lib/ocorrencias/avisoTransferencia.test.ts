import { describe, it, expect } from 'vitest'
import {
  montarPayloadAviso,
  montarAssuntoAviso,
  TETO_CAMPO_AVISO,
  TETO_DESCRICAO_AVISO,
  type AvisoTransferencia,
} from './avisoTransferencia'

const base: AvisoTransferencia = {
  colaboradorNome: '  Maria Silva  ',
  matricula: ' 000123 ',
  postoOrigem: ' ABAETÉ ',
  postoDestino: ' CBO ',
  dataTransferencia: '21/10/2026',
  gravidade: 'Moderada',
  descricao: '  Texto da carta  ',
  atualizouCadastro: true,
  ocorrenciaId: 'uuid-123',
}

describe('montarPayloadAviso', () => {
  it('apara espaços de todos os campos de texto', () => {
    const payload = montarPayloadAviso(base)
    expect(payload.colaboradorNome).toBe('Maria Silva')
    expect(payload.matricula).toBe('000123')
    expect(payload.postoOrigem).toBe('ABAETÉ')
    expect(payload.postoDestino).toBe('CBO')
    expect(payload.descricao).toBe('Texto da carta')
  })

  it('limita o tamanho dos campos', () => {
    const payload = montarPayloadAviso({
      ...base,
      colaboradorNome: 'x'.repeat(500),
      descricao: 'y'.repeat(6000),
    })
    expect(payload.colaboradorNome).toHaveLength(TETO_CAMPO_AVISO)
    expect(payload.descricao).toHaveLength(TETO_DESCRICAO_AVISO)
  })

  it('força boolean em atualizouCadastro', () => {
    expect(
      montarPayloadAviso({ ...base, atualizouCadastro: undefined as unknown as boolean })
        .atualizouCadastro
    ).toBe(false)
    expect(montarPayloadAviso({ ...base, atualizouCadastro: true }).atualizouCadastro).toBe(true)
  })

  it('campos nulos viram string vazia', () => {
    const payload = montarPayloadAviso({
      ...base,
      matricula: null as unknown as string,
      postoOrigem: null as unknown as string,
    })
    expect(payload.matricula).toBe('')
    expect(payload.postoOrigem).toBe('')
  })
})

describe('montarAssuntoAviso', () => {
  it('monta o assunto com o nome do colaborador', () => {
    expect(montarAssuntoAviso({ colaboradorNome: ' Maria Silva ' })).toBe(
      '[CORH] Transferência emitida — Maria Silva'
    )
  })

  it('usa "colaborador" quando o nome está vazio', () => {
    expect(montarAssuntoAviso({ colaboradorNome: '   ' })).toBe(
      '[CORH] Transferência emitida — colaborador'
    )
  })
})
