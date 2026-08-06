import { describe, it, expect } from 'vitest'
import {
  TIPOS_COM_DOCUMENTO_OBRIGATORIO,
  TIPOS_SEM_ASSINATURA_OBRIGATORIA,
  exigeDocumento,
  exigeDocumentoAssinado,
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
})
