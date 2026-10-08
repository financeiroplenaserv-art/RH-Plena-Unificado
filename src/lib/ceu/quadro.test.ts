import { describe, expect, it } from 'vitest'
import {
  FOCO_PADRAO,
  cssFocoFoto,
  dividirEmPaginas,
  grupoDoCargo,
  montarDocumentoFerista,
  montarDocumentoQuadro,
  normalizarFoco,
  regimeBonito,
  extrairHorarioDoTurno,
  focoAfastado,
  textoHorarioEscala,
  type ColaboradorQuadro,
} from './quadro'

function colab(parcial: Partial<ColaboradorQuadro> = {}): ColaboradorQuadro {
  return {
    id: parcial.id ?? Math.random().toString(36).slice(2),
    nome: 'FULANO DE TAL',
    funcao: 'Porteiro(a)',
    fotoDataUrl: 'data:image/jpeg;base64,AAA',
    foco: null,
    horario: null,
    turno: null,
    regime: null,
    ferista: false,
    ...parcial,
  }
}

describe('grupoDoCargo', () => {
  it.each([
    ['PORTEIRO (a)', 'Porteiros'],
    ['Porteiro — Ferista/Faltista', 'Porteiros'],
    ['ENCARREGADA', 'Encarregados'],
    ['Encarregado Pleno', 'Encarregados'],
    ['AUXILIAR DE SERV GERAIS (LIMPEZA)', 'Limpeza'],
    ['Aux. de Serviços Gerais', 'Limpeza'],
    ['AUXILIAR DE JARDINAGEM', 'Jardinagem'],
    ['AUXILIARDE JARDINAGEM', 'Jardinagem'], // grafia real do legado (sem espaço)
    ['Jardineiro', 'Jardinagem'],
    ['Vigia', 'Outros'],
    [null, 'Outros'],
  ])('%s → %s', (cargo, grupo) => {
    expect(grupoDoCargo(cargo)).toBe(grupo)
  })
})

describe('textoHorarioEscala', () => {
  it('usa o horário salvo quando existe', () => {
    expect(textoHorarioEscala({ horario: '19h às 07h · 12×36', turno: '7h às 19h CBO', regime: '12x36' })).toBe('19h às 07h · 12×36')
  })
  it('sem horário salvo, extrai do turno da escala e junta o regime', () => {
    expect(textoHorarioEscala({ horario: null, turno: '19 às 7h CBO MACAÉ VIGIA N. PAR', regime: '12x36' })).toBe('19h às 07h · 12×36')
  })
  it('turno sem horário cai no regime', () => {
    expect(textoHorarioEscala({ horario: null, turno: 'Faltista ASG', regime: '6x1' })).toBe('6×1')
  })
  it('turno com horário e sem regime mostra só o horário', () => {
    expect(textoHorarioEscala({ horario: null, turno: '8h às 17h CASCAIS', regime: null })).toBe('08h às 17h')
  })
  it('sem nada, mostra "conforme escala"', () => {
    expect(textoHorarioEscala({ horario: '', turno: null, regime: null })).toBe('conforme escala')
  })
})

describe('extrairHorarioDoTurno', () => {
  it.each([
    ['8h às 17h CASCAIS', '08h às 17h'],
    ['7h às 15:20h CASCAIS ASG 2', '07h às 15h20'],
    ['19 às 7h CBO MACAÉ VIGIA N. PAR', '19h às 07h'],
    ['7h às 19h CBO', '07h às 19h'],
  ])('extrai de %s', (turno, esperado) => {
    expect(extrairHorarioDoTurno(turno)).toBe(esperado)
  })
  it.each([['Faltista ASG'], ['Inspetor Diurno'], [''], [null]])('sem horário em %s devolve null', (turno) => {
    expect(extrairHorarioDoTurno(turno)).toBeNull()
  })
})

describe('regimeBonito', () => {
  it('formata os regimes conhecidos', () => {
    expect(regimeBonito('12x36')).toBe('12×36')
    expect(regimeBonito('5x2')).toBe('5×2')
    expect(regimeBonito(null)).toBeNull()
  })
})

describe('normalizarFoco', () => {
  it('rejeita valores inválidos', () => {
    expect(normalizarFoco(null)).toBeNull()
    expect(normalizarFoco('x')).toBeNull()
    expect(normalizarFoco({ zoom: 'a' })).toBeNull()
  })
  it('clampa zoom 0,5–2,5 e posição 0–100', () => {
    expect(normalizarFoco({ zoom: 9, px: -5, py: 140 })).toEqual({ zoom: 2.5, px: 0, py: 100 })
    expect(normalizarFoco({ zoom: 0.1, px: 50, py: 50 })).toEqual({ zoom: 0.5, px: 50, py: 50 })
  })
})

describe('cssFocoFoto', () => {
  it('padrão sem foco salvo: 50%/20% sem zoom', () => {
    expect(cssFocoFoto(null)).toBe('object-position: 50% 20%;')
  })
  it('zoom 1 não emite transform', () => {
    expect(cssFocoFoto({ zoom: 1, px: 40, py: 30 })).toBe('object-position: 40% 30%;')
  })
  it('zoom > 1 emite scale com origem no ponto focal', () => {
    expect(cssFocoFoto({ zoom: 1.5, px: 60, py: 25 })).toBe(
      'object-position: 60% 25%; transform: scale(1.5); transform-origin: 60% 25%;',
    )
  })
  it('zoom < 1 (afastar) também emite scale e pede a camada de fundo', () => {
    expect(cssFocoFoto({ zoom: 0.8, px: 50, py: 50 })).toContain('scale(0.8)')
    expect(focoAfastado({ zoom: 0.8, px: 50, py: 50 })).toBe(true)
    expect(focoAfastado({ zoom: 1, px: 50, py: 50 })).toBe(false)
    expect(focoAfastado(null)).toBe(false)
  })
  it('constante FOCO_PADRAO é o mesmo enquadramento do fallback', () => {
    expect(cssFocoFoto(FOCO_PADRAO)).toBe(cssFocoFoto(null))
  })
})

describe('dividirEmPaginas', () => {
  it('até 10 pessoas: uma página com as seções empilhadas, sem grade cheia', () => {
    const itens = [
      ...Array.from({ length: 3 }, () => colab({ funcao: 'Porteiro(a)' })),
      ...Array.from({ length: 2 }, () => colab({ funcao: 'Encarregada' })),
    ]
    const paginas = dividirEmPaginas(itens)
    expect(paginas).toHaveLength(1)
    expect(paginas[0].map((s) => s.grupo)).toEqual(['Porteiros', 'Encarregados'])
    expect(paginas[0].every((s) => !s.preencher)).toBe(true)
  })

  it('acima de 10: maior grupo sozinho (grade cheia) e demais na página seguinte', () => {
    const itens = [
      ...Array.from({ length: 13 }, () => colab({ funcao: 'Porteiro(a)' })),
      ...Array.from({ length: 2 }, () => colab({ funcao: 'Encarregado' })),
      ...Array.from({ length: 4 }, () => colab({ funcao: 'Auxiliar de Serv Gerais' })),
      ...Array.from({ length: 2 }, () => colab({ funcao: 'Auxiliar de Jardinagem' })),
    ]
    const paginas = dividirEmPaginas(itens)
    expect(paginas).toHaveLength(2)
    expect(paginas[0]).toHaveLength(1)
    expect(paginas[0][0].grupo).toBe('Porteiros')
    expect(paginas[0][0].itens).toHaveLength(13)
    expect(paginas[0][0].preencher).toBe(true)
    expect(paginas[1].map((s) => s.grupo)).toEqual(['Encarregados', 'Limpeza', 'Jardinagem'])
  })

  it('grupo maior que 15 é fatiado em folhas de 15', () => {
    const itens = [
      ...Array.from({ length: 17 }, () => colab({ funcao: 'Porteiro(a)' })),
      colab({ funcao: 'Encarregado' }),
    ]
    const paginas = dividirEmPaginas(itens)
    expect(paginas).toHaveLength(3)
    expect(paginas[0][0].itens).toHaveLength(15)
    expect(paginas[1][0].itens).toHaveLength(2)
    expect(paginas[2][0].grupo).toBe('Encarregados')
  })

  it('lista vazia não gera páginas', () => {
    expect(dividirEmPaginas([])).toEqual([])
  })

  it('grupo único com mais de 10 fica sozinho na página (sem página de "restantes" vazia)', () => {
    const itens = Array.from({ length: 11 }, () => colab())
    const paginas = dividirEmPaginas(itens)
    expect(paginas).toHaveLength(1)
    expect(paginas[0][0].preencher).toBe(true)
  })
})

describe('montarDocumentoQuadro', () => {
  it('monta documento com cabeçalho, seções e rodapé, escapando HTML', () => {
    const paginas = dividirEmPaginas([colab({ nome: 'A<B> "ASPAS"', funcao: 'Porteiro(a)' })])
    const html = montarDocumentoQuadro({ cliente: 'Condomínio <X>', logoDataUrl: 'data:image/jpeg;base64,LOGO', paginas })
    expect(html).toContain('Condomínio &lt;X&gt;')
    expect(html).toContain('A&lt;B&gt;')
    expect(html).toContain('>Porteiros <span') // seção renderizada
    expect(html).toContain('Plena Facilities')
    expect(html).toContain('@page { size: A4 portrait')
  })

  it('seção nunca quebra no meio (título separado dos cartões) — caso Jardinagem', () => {
    const paginas = dividirEmPaginas([colab({ funcao: 'Auxiliarde Jardinagem' })])
    const html = montarDocumentoQuadro({ cliente: 'X', logoDataUrl: 'data:,', paginas })
    expect(html).toContain('.secao { margin-bottom: 5mm; break-inside: avoid')
  })

  it('não referencia URL externa (só data URLs)', () => {
    const paginas = dividirEmPaginas([colab()])
    const html = montarDocumentoQuadro({ cliente: 'X', logoDataUrl: 'data:image/jpeg;base64,L', paginas })
    expect(html).not.toMatch(/https?:\/\//)
    expect(html).not.toContain('src="/')
  })

  it('colaborador sem foto usa o placeholder de silhueta', () => {
    const paginas = dividirEmPaginas([colab({ fotoDataUrl: null })])
    const html = montarDocumentoQuadro({ cliente: 'X', logoDataUrl: 'data:,', paginas })
    expect(html).toContain('sem-foto')
  })

  it('zoom afastado adiciona a camada de fundo desfocada no cartão', () => {
    const paginas = dividirEmPaginas([colab({ foco: { zoom: 0.7, px: 50, py: 50 } })])
    const html = montarDocumentoQuadro({ cliente: 'X', logoDataUrl: 'data:,', paginas })
    expect(html).toContain('foto fundo')
    // zoom normal: sem camada de fundo
    const paginas2 = dividirEmPaginas([colab({ foco: { zoom: 1.2, px: 50, py: 50 } })])
    expect(montarDocumentoQuadro({ cliente: 'X', logoDataUrl: 'data:,', paginas: paginas2 })).not.toContain('foto fundo')
  })
})

describe('montarDocumentoFerista', () => {
  it('gera folha única com nota explicativa', () => {
    const html = montarDocumentoFerista('Condomínio X', 'data:,', [colab({ nome: 'LOHAN ADONAI RIOS BRAGA', ferista: true })])
    expect(html).toContain('Ferista / Faltista')
    expect(html).toContain('LOHAN ADONAI RIOS BRAGA')
    expect(html).toContain('cobre férias e ausências')
    expect(html.match(/class="pagina"/g)).toHaveLength(1)
  })
})
