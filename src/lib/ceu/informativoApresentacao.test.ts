import { describe, expect, it } from 'vitest'
import {
  montarDocumentoInformativo,
  primeiroNomeSobrenome,
  textoInformativoParaHtml,
  textoPadraoApresentacao,
  SLOGAN_PLENA,
  type DadosInformativoApresentacao,
} from './informativoApresentacao'

describe('primeiroNomeSobrenome', () => {
  it('pega o 1º nome e o 1º sobrenome, pulando preposições', () => {
    expect(primeiroNomeSobrenome('Flaviano da Silva Vicente')).toBe('Flaviano Silva')
    expect(primeiroNomeSobrenome('José dos Santos')).toBe('José Santos')
    expect(primeiroNomeSobrenome('Maria de Lourdes')).toBe('Maria Lourdes')
  })

  it('devolve o que houver quando não há sobrenome além da preposição', () => {
    expect(primeiroNomeSobrenome('Maria Souza')).toBe('Maria Souza')
    expect(primeiroNomeSobrenome('Joana')).toBe('Joana')
    expect(primeiroNomeSobrenome('Ana de')).toBe('Ana')
  })

  it('tolera espaços sobrando', () => {
    expect(primeiroNomeSobrenome('  Flaviano   da   Silva Vicente ')).toBe('Flaviano Silva')
  })
})

describe('textoPadraoApresentacao', () => {
  it('inclui função, nome completo, cliente e nome curto', () => {
    const texto = textoPadraoApresentacao({
      funcao: 'Porteiro',
      nomeCompleto: 'Flaviano da Silva Vicente',
      cliente: 'Condomínio Grand Valley',
    })
    expect(texto).toContain('**Porteiro Flaviano da Silva Vicente**')
    expect(texto).toContain('no **Condomínio Grand Valley**')
    expect(texto).toContain('Desejamos a **Flaviano Silva** sucesso')
  })

  it('funciona sem função e sem cliente', () => {
    const texto = textoPadraoApresentacao({ funcao: '', nomeCompleto: 'Ana Souza', cliente: ' ' })
    expect(texto).toContain('**Ana Souza**.')
    expect(texto).not.toContain('no **')
    expect(texto).not.toContain('  ')
  })
})

describe('textoInformativoParaHtml', () => {
  it('escapa HTML do texto digitado', () => {
    expect(textoInformativoParaHtml('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    )
  })

  it('converte **negrito** e separa parágrafos por linha em branco', () => {
    const html = textoInformativoParaHtml('Olá **mundo**\nlinha 2\n\nSegundo parágrafo')
    expect(html).toBe('<p>Olá <strong>mundo</strong><br>linha 2</p>\n<p>Segundo parágrafo</p>')
  })

  it('ignora parágrafos vazios', () => {
    expect(textoInformativoParaHtml('\n\n  \n\n')).toBe('')
  })
})

describe('montarDocumentoInformativo', () => {
  const base: DadosInformativoApresentacao = {
    nomeExibicao: 'Flaviano Silva',
    funcao: 'Porteiro',
    cliente: 'Condomínio Grand Valley',
    texto: textoPadraoApresentacao({
      funcao: 'Porteiro',
      nomeCompleto: 'Flaviano da Silva Vicente',
      cliente: 'Condomínio Grand Valley',
    }),
    fotoDataUrl: 'data:image/jpeg;base64,FOTO',
    foco: null,
    logoDataUrl: 'data:image/jpeg;base64,LOGO',
    pFotosDataUrl: 'data:image/jpeg;base64,P',
    logo30DataUrl: 'data:image/png;base64,L30',
  }

  it('monta a página com foto, nome, função, texto, slogan e rodapé', () => {
    const html = montarDocumentoInformativo(base)
    expect(html).toContain('data:image/jpeg;base64,FOTO')
    expect(html).toContain('data:image/jpeg;base64,P')
    expect(html).toContain('data:image/png;base64,L30')
    expect(html).toContain('Flaviano Silva')
    expect(html).toContain('<div class="funcao-exib">Porteiro</div>')
    expect(html).toContain('<strong>Porteiro Flaviano da Silva Vicente</strong>')
    expect(html).toContain('no <strong>Condomínio Grand Valley</strong>')
    expect(html).toContain(SLOGAN_PLENA)
    expect(html).toContain('www.plenafacilities.com.br')
    expect(html).toContain('@page { size: A4 portrait')
  })

  it('escapa nome e texto com HTML', () => {
    const html = montarDocumentoInformativo({ ...base, nomeExibicao: '<b>X</b>', texto: '<img src=x>' })
    expect(html).not.toContain('<b>X</b>')
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;')
    expect(html).toContain('&lt;img src=x&gt;')
  })

  it('funciona sem foto, sem função e sem selo 30 anos', () => {
    const html = montarDocumentoInformativo({ ...base, fotoDataUrl: null, funcao: '', logo30DataUrl: null })
    expect(html).toContain('sem-foto')
    expect(html).not.toContain('<div class="funcao-exib">')
    expect(html).not.toContain('<img class="logo30"')
  })

  it('usa a camada de fundo desfocada quando o foco afasta (zoom < 1)', () => {
    const html = montarDocumentoInformativo({ ...base, foco: { zoom: 0.8, px: 50, py: 20 } })
    expect(html).toContain('class="foto fundo"')
  })
})
