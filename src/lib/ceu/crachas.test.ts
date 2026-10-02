import { describe, it, expect } from 'vitest'
import {
  CRACHAS_POR_FOLHA,
  FUNDO_CRACHA_PADRAO,
  cargoInicialCracha,
  contarFolhas,
  corHexValida,
  cssFundoCracha,
  fundoDaEmpresa,
  normalizarFundoCracha,
  payloadSalvarTextosCracha,
  crachaSemCargo,
  cssCracha,
  cssFolhas,
  dataUrlImagemValida,
  dividirEmFolhas,
  escaparHtml,
  logoDaEmpresa,
  montarCracha,
  montarDocumentoCrachas,
  montarFolhas,
  nomeInicialCracha,
  normalizarConfigCracha,
  payloadSalvarNomeCracha,
  type DadosCracha,
} from './crachas'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const JPG = 'data:image/jpeg;base64,/9j/4AAQ'

function gerar(n: number): DadosCracha[] {
  return Array.from({ length: n }, (_, i) => ({ nome: `Pessoa ${i + 1}`, cargo: 'Porteiro' }))
}

function contar(html: string, trecho: string): number {
  return html.split(trecho).length - 1
}

describe('crachás por folha', () => {
  it('9 por folha: 1, 9, 10 e 19 crachás geram 1, 1, 2 e 3 folhas', () => {
    expect(CRACHAS_POR_FOLHA).toBe(9)
    expect([1, 9, 10, 19].map(contarFolhas)).toEqual([1, 1, 2, 3])
    expect(contarFolhas(0)).toBe(0)
  })

  it('dividirEmFolhas não corta um crachá no meio', () => {
    expect(dividirEmFolhas(gerar(19)).map((f) => f.length)).toEqual([9, 9, 1])
    expect(dividirEmFolhas([])).toEqual([])
  })

  it('o HTML tem uma .folha por 9 crachás e uma .celula por crachá', () => {
    const html = montarFolhas(gerar(10))
    expect(contar(html, '<div class="folha">')).toBe(2)
    expect(contar(html, '<div class="celula">')).toBe(10)
  })
})

describe('nome do crachá x cadastro', () => {
  it('pré-preenche com nome_cracha quando existe, senão com nome_completo', () => {
    expect(nomeInicialCracha({ nome_completo: 'Maria Aparecida da Silva', nome_cracha: 'Maria Silva' })).toBe('Maria Silva')
    expect(nomeInicialCracha({ nome_completo: 'Maria Aparecida da Silva', nome_cracha: null })).toBe('Maria Aparecida da Silva')
    expect(nomeInicialCracha({ nome_completo: 'Maria Aparecida da Silva', nome_cracha: '  ' })).toBe('Maria Aparecida da Silva')
  })

  it('payload de salvamento grava só nome_cracha e NUNCA inclui nome_completo', () => {
    const p = payloadSalvarNomeCracha('abc', 'Maria Silva', 'Maria Aparecida da Silva')
    expect(p).toEqual({ p_colaborador_id: 'abc', p_nome_cracha: 'Maria Silva', p_atualizar_nome: true })
    expect(JSON.stringify(p)).not.toContain('nome_completo')
    expect(Object.keys(p)).not.toContain('nome_completo')
  })

  it('voltar ao nome do cadastro (igual ou vazio) limpa nome_cracha', () => {
    expect(payloadSalvarNomeCracha('abc', 'Maria Aparecida da Silva', 'Maria Aparecida da Silva').p_nome_cracha).toBeNull()
    expect(payloadSalvarNomeCracha('abc', '   ', 'Maria Aparecida da Silva').p_nome_cracha).toBeNull()
  })

  it('o crachá exibe o nome editado, não o do cadastro', () => {
    const html = montarCracha({ nome: 'Maria Silva', cargo: 'Copeira' })
    expect(html).toContain('<div class="nome">Maria Silva</div>')
    expect(html).not.toContain('Aparecida')
  })
})

describe('escape HTML e entradas', () => {
  it('escapa nome e cargo', () => {
    const html = montarCracha({ nome: '<img src=x onerror=alert(1)> & "Zé"', cargo: "<b>Vigia</b>'" })
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<b>Vigia')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Zé&quot;')
    expect(escaparHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })

  it('só aceita data URL de imagem (nada de URL remota)', () => {
    expect(dataUrlImagemValida(PNG)).toBe(true)
    expect(dataUrlImagemValida('https://exemplo.com/foto.jpg')).toBe(false)
    expect(dataUrlImagemValida('javascript:alert(1)')).toBe(false)
    expect(dataUrlImagemValida(null)).toBe(false)
    const html = montarCracha({ nome: 'A', cargo: 'B', fotoDataUrl: 'https://exemplo.com/foto.jpg', logoDataUrl: 'https://exemplo.com/l.png' })
    expect(html).not.toContain('https://exemplo.com')
    expect(html).toContain('class="marca"') // caiu no logo padrão
  })
})

describe('cartão normal', () => {
  const html = montarCracha({ nome: 'João', cargo: 'Encarregado', fotoDataUrl: JPG, logoDataUrl: PNG })

  it('usa foto e logo enviados', () => {
    expect(html).toContain(`<img class="foto" alt="Foto de João" src="${JPG}">`)
    expect(html).toContain(`<img src="${PNG}" alt="Logo da empresa">`)
    expect(html).not.toContain('class="marca"')
  })

  it('sem foto: moldura cinza vazia; sem logo: desenho padrão plena/facilities', () => {
    const vazio = montarCracha({ nome: 'João', cargo: 'X' })
    expect(vazio).toContain('class="foto"')
    expect(vazio).toContain('<span class="plena">plena</span><span class="facilities">facilities</span>')
    expect(vazio).toContain('<svg')
  })

  it('CSS: medidas do cartão e posições iguais às do cracha.html', () => {
    const css = cssCracha('normal')
    expect(css).toContain('width: 54mm; height: 85.6mm')
    expect(css).toContain('border-radius: 3mm')
    expect(css).toContain('linear-gradient(to bottom, var(--azul-topo) 0%, #fff 62%, #fff 100%)')
    expect(css).toContain('.logo { position: absolute; top: 8.6mm')
    expect(css).toContain('top: 36.8mm')
    expect(css).toContain('width: 22mm; height: 29.33mm; border: .25mm solid #000')
    expect(css).toContain('object-fit: cover')
    expect(css).toContain('top: 67.8mm')
    expect(css).toContain('top: 75.4mm')
    expect(css).toContain('print-color-adjust: exact')
    expect(css).toMatch(/\.nome \{[^}]*font-weight: 700[^}]*text-transform: uppercase/)
    expect(css).toMatch(/\.cargo \{[^}]*font-weight: 400[^}]*text-transform: uppercase/)
    expect(css).toContain('font-family: Arial, Helvetica, sans-serif')
  })
})

describe('documento / folha A4', () => {
  const doc = montarDocumentoCrachas(gerar(3))

  it('A4 em pé, margem 10mm, grade 3x3, vão de 8mm num único valor e quebra por folha', () => {
    expect(doc).toContain('@page { size: A4 portrait; margin: 10mm; }')
    expect(doc).toContain('--vao-corte: 8mm')
    expect(doc).toContain('grid-template-columns: repeat(3, 54mm)')
    expect(doc).toContain('grid-auto-rows: 85.6mm')
    expect(doc).toContain('gap: var(--vao-corte)')
    expect(doc).toContain('break-after: page')
    expect(doc).toContain('break-inside: avoid')
    expect(contar(doc, '8mm')).toBeGreaterThan(0)
  })

  it('tem marcas de corte nos 4 cantos (8 traços) e orientação de impressão', () => {
    expect(contar(cssFolhas('normal'), 'linear-gradient(var(--c),var(--c))')).toBe(8)
    expect(doc).toContain('Tamanho real')
  })

  it('não carrega nada da internet', () => {
    expect(doc).not.toMatch(/https?:\/\//)
    expect(doc).not.toContain('@import')
    expect(doc).not.toContain('<link')
    expect(doc).not.toContain('<script')
  })

  it('modo normal não tem régua nem faixa de teste', () => {
    expect(doc).not.toContain('faixa-teste">MODELO')
    expect(doc).not.toContain('content: "40 mm"')
  })
})

describe('modo teste sem cor', () => {
  const dados: DadosCracha[] = [{ nome: 'João', cargo: 'Porteiro', fotoDataUrl: JPG, logoDataUrl: PNG }]
  const html = montarCracha(dados[0], 'teste')
  const doc = montarDocumentoCrachas(dados, 'teste')

  it('foto não é impressa (só moldura 3x4) e logo vira retângulo tracejado', () => {
    expect(html).toContain('<div class="foto">3x4</div>')
    expect(html).not.toContain(JPG)
    expect(html).toContain('<div class="logo-ph">LOGO</div>')
    expect(html).not.toContain(PNG)
  })

  it('fundo branco, contorno preto de 0,2mm, nome e cargo em cinza, mesmas medidas', () => {
    const css = cssCracha('teste')
    expect(css).toContain('width: 54mm; height: 85.6mm')
    expect(css).toContain('background: #fff;')
    expect(css).not.toContain('linear-gradient(to bottom')
    expect(css).toContain('.cracha::after { content: ""; position: absolute; inset: 0; border: .2mm solid #000')
    expect(css).toMatch(/\.nome \{[^}]*color: #888/)
    expect(css).toMatch(/\.cargo \{[^}]*color: #888/)
    expect(css).toContain('top: 36.8mm')
    expect(css).toContain('top: 67.8mm')
    expect(css).toContain('top: 75.4mm')
  })

  it('régua de 40 mm só na 1ª folha, marcas de corte mantidas e faixa de aviso', () => {
    expect(doc).toContain('.folha:first-child::after { content: "40 mm"')
    expect(doc).toContain('left: 75mm; top: 273.8mm; width: 40mm')
    expect(contar(cssFolhas('teste'), 'linear-gradient(var(--c),var(--c))')).toBe(8 + 3)
    expect(doc).toContain('MODELO DE TESTE')
  })

  it('logo padrão em contorno (sem azul)', () => {
    const semLogo = montarCracha({ nome: 'A', cargo: 'B' }, 'teste')
    expect(semLogo).toContain('fill="none"')
    expect(semLogo).not.toContain('#1a9be0')
  })
})

describe('casos de borda', () => {
  it('colaborador sem cargo: crachá sai com o campo vazio e é sinalizado', () => {
    expect(crachaSemCargo({ cargo: null })).toBe(true)
    expect(crachaSemCargo({ cargo: '   ' })).toBe(true)
    expect(crachaSemCargo({ cargo: 'Vigia' })).toBe(false)
    expect(montarCracha({ nome: 'A', cargo: null })).toContain('<div class="cargo"></div>')
  })

  it('seleção vazia não gera folhas', () => {
    expect(montarFolhas([])).toBe('')
    expect(contarFolhas(0)).toBe(0)
  })

  it('muitos crachás: 100 viram 12 folhas', () => {
    expect(contarFolhas(100)).toBe(12)
    expect(contar(montarFolhas(gerar(100)), '<div class="folha">')).toBe(12)
  })
})

describe('logo por empresa (configuracoes.cracha_config)', () => {
  it('normaliza JSON salvo e descarta logos inválidos', () => {
    const cfg = normalizarConfigCracha(JSON.stringify({ logos: { e1: PNG, e2: 'https://x.com/l.png', e3: 5 } }))
    expect(cfg.logos).toEqual({ e1: PNG })
    expect(normalizarConfigCracha('lixo').logos).toEqual({})
    expect(normalizarConfigCracha(null).logos).toEqual({})
  })

  it('empresa sem logo ou colaborador sem empresa → undefined (logo padrão)', () => {
    const cfg = { logos: { e1: PNG }, fundos: {} }
    expect(logoDaEmpresa(cfg, 'e1')).toBe(PNG)
    expect(logoDaEmpresa(cfg, 'e2')).toBeUndefined()
    expect(logoDaEmpresa(cfg, null)).toBeUndefined()
  })
})

describe('função (cargo) do crachá x cadastro', () => {
  it('pré-preenche com cargo_cracha quando existe, senão com cargo', () => {
    expect(cargoInicialCracha({ cargo: 'ASG', cargo_cracha: 'Auxiliar de Serviços Gerais' })).toBe('Auxiliar de Serviços Gerais')
    expect(cargoInicialCracha({ cargo: 'ASG', cargo_cracha: null })).toBe('ASG')
    expect(cargoInicialCracha({ cargo: null, cargo_cracha: ' ' })).toBe('')
  })

  it('payload nunca inclui nome_completo nem cargo; igual ao cadastro → NULL', () => {
    const p = payloadSalvarTextosCracha('abc', {
      nome: { editado: 'Maria Silva', cadastro: 'Maria Aparecida da Silva' },
      cargo: { editado: 'Líder de Equipe', cadastro: 'ASG' },
    })
    expect(p).toEqual({
      p_colaborador_id: 'abc',
      p_nome_cracha: 'Maria Silva',
      p_atualizar_nome: true,
      p_cargo_cracha: 'Líder de Equipe',
      p_atualizar_cargo: true,
    })
    expect(Object.keys(p)).not.toContain('nome_completo')
    expect(Object.keys(p)).not.toContain('cargo')
    const igual = payloadSalvarTextosCracha('abc', { cargo: { editado: 'ASG', cadastro: 'ASG' } })
    expect(igual).toEqual({ p_colaborador_id: 'abc', p_cargo_cracha: null, p_atualizar_cargo: true })
    expect(payloadSalvarTextosCracha('abc', { cargo: { editado: '  ', cadastro: 'ASG' } }).p_cargo_cracha).toBeNull()
  })

  it('só inclui os campos pedidos', () => {
    const p = payloadSalvarTextosCracha('abc', { nome: { editado: 'X', cadastro: 'Y' } })
    expect('p_atualizar_cargo' in p).toBe(false)
  })
})

describe('fundo do crachá', () => {
  it('padrão: degradê #0aa0e2 até branco em 62%', () => {
    expect(FUNDO_CRACHA_PADRAO).toMatchObject({ tipo: 'degrade', corTopo: '#0aa0e2', ponto: 62, corTexto: '#000000' })
    expect(cssFundoCracha(null)).toBe('background:linear-gradient(to bottom, #0aa0e2 0%, #fff 62%, #fff 100%);')
  })

  it('valida cores hex e limita o ponto entre 0 e 100', () => {
    expect(corHexValida('#ABC')).toBe('#aabbcc')
    expect(corHexValida('#12345')).toBeNull()
    expect(corHexValida('red; background:url(http://x)')).toBeNull()
    const f = normalizarFundoCracha({ tipo: 'degrade', corTopo: 'azul', ponto: 250, corTexto: '#fff' })
    expect(f.corTopo).toBe('#0aa0e2')
    expect(f.ponto).toBe(100)
    expect(f.corTexto).toBe('#ffffff')
    expect(normalizarFundoCracha({ ponto: -5 }).ponto).toBe(0)
    expect(normalizarFundoCracha({ ponto: 'x' }).ponto).toBe(62)
    expect(normalizarFundoCracha('lixo')).toEqual(FUNDO_CRACHA_PADRAO)
  })

  it('imagem sem data URL válida volta ao degradê', () => {
    expect(normalizarFundoCracha({ tipo: 'imagem', imagem: 'https://x.com/a.jpg' }).tipo).toBe('degrade')
    expect(normalizarFundoCracha({ tipo: 'imagem', imagem: JPG }).tipo).toBe('imagem')
  })

  it('cor sólida, imagem (cover) e cor do texto saem no HTML do crachá normal', () => {
    const solido = montarCracha({ nome: 'A', cargo: 'B', fundo: normalizarFundoCracha({ tipo: 'solido', cor: '#112233', corTexto: '#ffffff' }) })
    expect(solido).toContain('style="background:#112233;"')
    expect(solido).toContain('<div class="nome" style="color:#ffffff">A</div>')
    const img = montarCracha({ nome: 'A', cargo: 'B', fundo: normalizarFundoCracha({ tipo: 'imagem', imagem: JPG }) })
    expect(img).toContain('cover no-repeat')
    expect(img).toContain(JPG)
    expect(img).not.toMatch(/https?:\/\//)
    const grad = montarCracha({ nome: 'A', cargo: 'B', fundo: normalizarFundoCracha({ tipo: 'degrade', corTopo: '#ff0000', ponto: 40 }) })
    expect(grad).toContain('linear-gradient(to bottom, #ff0000 0%, #fff 40%, #fff 100%)')
  })

  it('sem fundo configurado o HTML não ganha estilo inline (usa o CSS de referência)', () => {
    expect(montarCracha({ nome: 'A', cargo: 'B' })).toContain('<div class="cracha"><div class="logo">')
  })

  it('modo teste ignora fundo e cor do texto (sempre branco)', () => {
    const html = montarCracha(
      { nome: 'A', cargo: 'B', fundo: normalizarFundoCracha({ tipo: 'solido', cor: '#112233', corTexto: '#ffffff' }) },
      'teste'
    )
    expect(html).not.toContain('#112233')
    expect(html).not.toContain('style=')
  })

  it('documento com fundo configurado continua sem nada da internet', () => {
    const doc = montarDocumentoCrachas([
      { nome: 'A', cargo: 'B', fundo: normalizarFundoCracha({ tipo: 'imagem', imagem: JPG }) },
    ])
    expect(doc).not.toMatch(/https?:\/\//)
  })

  it('config normaliza fundos por empresa; empresa sem fundo → undefined', () => {
    const cfg = normalizarConfigCracha({ logos: {}, fundos: { e1: { tipo: 'solido', cor: '#abc' } } })
    expect(fundoDaEmpresa(cfg, 'e1')?.cor).toBe('#aabbcc')
    expect(fundoDaEmpresa(cfg, 'e2')).toBeUndefined()
    expect(fundoDaEmpresa(cfg, null)).toBeUndefined()
  })
})
