import { describe, it, expect } from 'vitest'
import {
  TIPOS_OCORRENCIA,
  TIPOS_COM_DOCUMENTO_OBRIGATORIO,
  TIPOS_SEM_ASSINATURA_OBRIGATORIA,
  TIPO_TRANSFERENCIA,
  exigeDocumento,
  exigeDocumentoAssinado,
  permiteEscolherGravidade,
  preencherOrigemDestino,
} from './tiposOcorrencia'

describe('exigeDocumentoAssinado', () => {
  it('atestado e licenças médicas NÃO exigem documento assinado (decisão da gestão, 06/08/2026)', () => {
    expect(exigeDocumentoAssinado('Falta Justificada (atestado)')).toBe(false)
    expect(exigeDocumentoAssinado('Licença Médica (até 15 dias)')).toBe(false)
    expect(exigeDocumentoAssinado('Licença Médica (acima 15 dias — INSS)')).toBe(false)
  })

  it('esses tipos continuam exigindo o documento comprobatório', () => {
    for (const tipo of TIPOS_SEM_ASSINATURA_OBRIGATORIA) {
      expect(exigeDocumento(tipo)).toBe(true)
      expect(TIPOS_COM_DOCUMENTO_OBRIGATORIO).toContain(tipo)
    }
  })

  it('demais tipos com anexo obrigatório seguem exigindo documento assinado', () => {
    expect(exigeDocumentoAssinado('Falta Abonada')).toBe(true)
  })

  it('tipos sem anexo obrigatório não exigem documento assinado', () => {
    expect(exigeDocumentoAssinado('Falta Injustificada')).toBe(false)
    expect(exigeDocumentoAssinado('Outros')).toBe(false)
  })

  it('tipo desconhecido não exige documento assinado', () => {
    expect(exigeDocumentoAssinado('')).toBe(false)
    expect(exigeDocumentoAssinado('Tipo Inexistente')).toBe(false)
  })

  it('Conclusão de Curso / Treinamento NÃO exige anexo comprobatório (decisão da gestão, 16/09/2026)', () => {
    expect(exigeDocumento('Conclusão de Curso / Treinamento')).toBe(false)
    expect(exigeDocumentoAssinado('Conclusão de Curso / Treinamento')).toBe(false)
    expect(TIPOS_COM_DOCUMENTO_OBRIGATORIO).not.toContain('Conclusão de Curso / Treinamento')
  })
})

describe('Transferência de Setor', () => {
  it('existe no catálogo, sem anexo obrigatório — nasce Ativa, fora do fluxo de validação', () => {
    const tipo = TIPOS_OCORRENCIA.find((t) => t.tipo === TIPO_TRANSFERENCIA)
    expect(tipo).toBeDefined()
    expect(tipo?.macroGrupo).toBe('8. Administrativas')
    expect(tipo?.exigeAnexo).toBe(false)
    expect(exigeDocumento(TIPO_TRANSFERENCIA)).toBe(false)
    expect(exigeDocumentoAssinado(TIPO_TRANSFERENCIA)).toBe(false)
    expect(TIPOS_COM_DOCUMENTO_OBRIGATORIO).not.toContain(TIPO_TRANSFERENCIA)
  })

  it('texto-modelo pede os dados da transferência, um por linha', () => {
    const tipo = TIPOS_OCORRENCIA.find((t) => t.tipo === TIPO_TRANSFERENCIA)
    expect(tipo?.texto).toContain('[SETOR ORIGEM]')
    expect(tipo?.texto).toContain('[SETOR DESTINO]')
    expect(tipo?.texto).toContain('Data da transferência:')
    expect(tipo?.texto).toContain('Motivo:')
    expect(tipo?.texto).toContain('Novo horário de trabalho:')
    expect(tipo?.texto).toContain('A quem procurar no novo posto:')
  })

  it('só a transferência permite escolher a gravidade no lançamento', () => {
    expect(permiteEscolherGravidade(TIPO_TRANSFERENCIA)).toBe(true)
    expect(permiteEscolherGravidade('Advertência Escrita')).toBe(false)
    expect(permiteEscolherGravidade('Promoção')).toBe(false)
    expect(permiteEscolherGravidade('')).toBe(false)
  })
})

describe('preencherOrigemDestino', () => {
  it('substitui origem e destino, inclusive quando repetidos', () => {
    expect(
      preencherOrigemDestino('de [SETOR ORIGEM] para [SETOR DESTINO] (sai de [SETOR ORIGEM])', 'ABAETÉ', 'CBO')
    ).toBe('de ABAETÉ para CBO (sai de ABAETÉ)')
  })

  it('não altera texto sem placeholder', () => {
    expect(preencherOrigemDestino('texto livre qualquer', 'ABAETÉ', 'CBO')).toBe(
      'texto livre qualquer'
    )
  })

  it('mantém o placeholder quando o nome está vazio', () => {
    expect(preencherOrigemDestino('de [SETOR ORIGEM] para [SETOR DESTINO]', '', 'CBO')).toBe(
      'de [SETOR ORIGEM] para CBO'
    )
    expect(preencherOrigemDestino('de [SETOR ORIGEM] para [SETOR DESTINO]', 'ABAETÉ', '')).toBe(
      'de ABAETÉ para [SETOR DESTINO]'
    )
  })
})
