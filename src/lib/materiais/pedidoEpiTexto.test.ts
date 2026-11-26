import { describe, expect, it } from 'vitest'
import { lerParteEpi, lerPedidoEpi, limparNomePlanilha } from './pedidoEpiTexto'

function partes(texto: string) {
  const r = lerPedidoEpi(texto)
  if (r.tipo !== 'pedido') throw new Error(`não é pedido: ${texto}`)
  return r.partes
}

describe('lerPedidoEpi — texto do pedido de EPI da planilha', () => {
  it('ignora demitido, não precisa, sem pedido, rescindido, abandono e vazio', () => {
    for (const t of ['DEMITIDO', 'DEMITIDA', 'Não Precisa', 'Não Precisa (Estágio Aux. Portaria)', 'Não Teve Pedido', 'Contrato Rescindido', 'ABANDONO', '', null, '  ']) {
      expect(lerPedidoEpi(t).tipo).toBe('ignorar')
    }
  })

  it('"02 Luvas látex G" → látex G, quantidade 2', () => {
    const [p] = partes('02 Luvas látex G')
    expect(p).toMatchObject({ peca: 'luva_latex', quantidade: 2, tamanho: 'G', pendencia: null, quantidadeExplicita: true })
  })

  it('"01 Bota 40+02 luvas látex M" → duas partes', () => {
    const ps = partes('01 Bota 40+02 luvas látex M')
    expect(ps).toHaveLength(2)
    expect(ps[0]).toMatchObject({ peca: 'bota', quantidade: 1, tamanho: '40', pendencia: null })
    expect(ps[1]).toMatchObject({ peca: 'luva_latex', quantidade: 2, tamanho: 'M' })
  })

  it('nitrílica 8 → M e 9 → G (de-para confirmado), inclusive o erro "nitrília"', () => {
    expect(partes('02 Luvas nitrílicas 8')[0]).toMatchObject({ peca: 'luva_nitrilica', tamanho: 'M', quantidade: 2, dePara: 'nitrílica 8 → M' })
    expect(partes('01 Luva nitrília 9')[0]).toMatchObject({ peca: 'luva_nitrilica', tamanho: 'G', pendencia: null })
    expect(partes('01 Luva nitrílica 8')[0]).toMatchObject({ tamanho: 'M' })
  })

  it('"extra G" → EG (látex e nitrílica)', () => {
    expect(partes('02 Luvas látex extra G+02 máscaras')[0]).toMatchObject({ peca: 'luva_latex', tamanho: 'EG', dePara: 'extra G → EG' })
    expect(partes('01 Luva nitrílica extra G')[0]).toMatchObject({ peca: 'luva_nitrilica', tamanho: 'EG' })
  })

  it('botina + luva PVC + máscaras', () => {
    const ps = partes('01 Botina 42+01 luva PVC+02 máscaras')
    expect(ps.map((p) => p.peca)).toEqual(['botina', 'luva_pvc', 'mascara'])
    expect(ps[0].tamanho).toBe('42')
    expect(ps[1]).toMatchObject({ tamanho: null, pendencia: null, quantidade: 1 })
    expect(ps[2]).toMatchObject({ quantidade: 2, pendencia: null })
  })

  it('máscara e óculos sem número valem 1', () => {
    const ps = partes('01 Luva látex P+01 máscara+óculos')
    expect(ps[2]).toMatchObject({ peca: 'oculos', quantidade: 1, quantidadeExplicita: false, pendencia: null })
  })

  it('avental, luva térmica, manguito e pigmentada têm de-para', () => {
    const ps = partes('Avental+01 luvas térmicas G')
    expect(ps[0]).toMatchObject({ peca: 'avental', quantidade: 1, pendencia: null })
    expect(ps[1]).toMatchObject({ peca: 'luva_termica', tamanho: null, pendencia: null })
    expect(ps[1].dePara).toMatch(/Tam\. 11/)
    expect(partes('01 manguito')[0]).toMatchObject({ peca: 'manguito', pendencia: null })
    expect(partes('02 Luvas pigmentadas')[0]).toMatchObject({ peca: 'luva_pigmentada', quantidade: 2, pendencia: null })
  })

  it('bota/botina sem número e látex sem tamanho viram pendência', () => {
    expect(lerParteEpi('01 Botina').pendencia).toMatch(/número de calçado/)
    expect(lerParteEpi('01 Bota').pendencia).toMatch(/número de calçado/)
    expect(lerParteEpi('02 Luvas látex').pendencia).toMatch(/sem tamanho/)
  })

  it('texto desconhecido ou com sobra vira pendência, nunca palpite', () => {
    expect(lerParteEpi('01 capacete').pendencia).toMatch(/não reconhecida/)
    expect(lerParteEpi('01 Luva látex G azul').pendencia).toMatch(/não reconhecido/)
    expect(lerParteEpi('01 Luva látex 10').pendencia).toMatch(/não é P\/M\/G\/EG/)
  })

  it('óculos e máscara com tamanho no texto viram pendência', () => {
    expect(lerParteEpi('01 máscara G').pendencia).toMatch(/não tem tamanho/)
  })
})

describe('limparNomePlanilha', () => {
  it('tira (I), observações entre parênteses e espaço no fim', () => {
    expect(limparNomePlanilha('LUIZ FERNANDO DA SILVA (I)')).toBe('LUIZ FERNANDO DA SILVA')
    expect(limparNomePlanilha('DENIS WILLIAN ARAÚJO BASTOS ')).toBe('DENIS WILLIAN ARAÚJO BASTOS')
    expect(limparNomePlanilha('ANDRESSA CRISTINA ASSUMPÇÃO MARQUES (I) (não recebe insalubidade. ver)')).toBe('ANDRESSA CRISTINA ASSUMPÇÃO MARQUES')
    expect(limparNomePlanilha('MARCELO RAMOS RUFINO(recebe insalubridade esporadicamente)')).toBe('MARCELO RAMOS RUFINO')
    expect(limparNomePlanilha(null)).toBe('')
  })
})
