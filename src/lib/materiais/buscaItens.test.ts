import { describe, expect, it } from 'vitest'
import { BUSCA_MAX_RESULTADOS, buscarItens, distanciaEdicao, nomeExibicaoItem, normalizarBusca, similaridadeTrigramas } from './buscaItens'

// Recorte do catálogo real (mat_itens + mat_aliases, 14/10/2026) e itens
// hipotéticos do exemplo da gestão ("Cabo de vassoura", "Cabo de alumínio").
const ITENS = [
  { id: 'cv', nome: 'Cabo de vassoura', aliases: ['cabo p vassoura'] },
  { id: 'ca', nome: 'Cabo de alumínio', aliases: [] },
  { id: 'mop', nome: 'Mop Cabo UN', aliases: ['mop cabo grande', 'mop cabo pequeno'] },
  { id: 'dn', nome: 'Detergente Neutro 5L', aliases: ['detergente neutro bombona'] },
  { id: 'dl', nome: 'Detergente Limpol 500mL', aliases: [] },
  { id: 'vc', nome: 'Vassoura Cerlon UN', aliases: ['vassoura cerlon 40 cm'] },
  { id: 've', nome: 'Vassoura Especial UN', aliases: ['vassoura gari', 'vassoura piacava chapa 3'] },
  { id: 'dv', nome: 'Desinfetante Vulcan Lavanda 5L', aliases: [] },
  { id: 'cl', nome: 'Cloro 5L', aliases: ['agua sanitaria 5l'] },
  { id: 'pano', nome: 'Pano de chão 43cm X 68cm UN', aliases: [] },
]

const ids = (termo: string) => buscarItens(termo, ITENS).map((r) => r.item.id)

describe('buscarItens (Preciso de outro item)', () => {
  it('prefixo: "cab" traz os cabos', () => {
    expect(ids('cab').slice(0, 3)).toEqual(expect.arrayContaining(['cv', 'ca']))
  })

  it('erro de digitação: "cabo vasora" → Cabo de vassoura primeiro; "detergete" → detergentes', () => {
    expect(ids('cabo vasora')[0]).toBe('cv')
    expect(ids('detergete')).toEqual(expect.arrayContaining(['dn', 'dl']))
    expect(ids('detergete')).not.toContain('dv')
  })

  it('sem acento e pelo nome antigo (mat_aliases)', () => {
    expect(ids('PANO DE CHAO')[0]).toBe('pano')
    expect(ids('agua sanitaria')[0]).toBe('cl')
    expect(buscarItens('vassoura gari', ITENS)[0]).toMatchObject({ item: { id: 've' }, casouCom: 'vassoura gari' })
  })

  it('termo curto não busca (nunca "lista tudo") e o resultado tem no máximo BUSCA_MAX_RESULTADOS (8)', () => {
    expect(ids('ca')).toEqual([])
    expect(ids('  ')).toEqual([])
    expect(buscarItens('a', ITENS, 50)).toEqual([])
    expect(buscarItens('vassoura cabo detergente', ITENS, 50).length).toBeLessThanOrEqual(BUSCA_MAX_RESULTADOS)
  })

  it('palavra sem relação não casa por acaso', () => {
    expect(ids('luva')).toEqual([])
    expect(ids('xyzw')).toEqual([])
  })
})

describe('utilitários da busca', () => {
  it('normaliza, mede distância com corte e trigramas', () => {
    expect(normalizarBusca('Água  Sanitária!')).toBe('agua sanitaria')
    expect(distanciaEdicao('detergete', 'detergente')).toBe(1)
    expect(distanciaEdicao('abc', 'xyzxyz', 1)).toBe(2)
    expect(similaridadeTrigramas('vassoura', 'vassoura')).toBe(1)
    expect(similaridadeTrigramas('vassoura', 'cloro')).toBeLessThan(0.1)
  })
})

// Recorte REAL do catálogo com variações (mat_itens + mat_item_variacoes +
// mat_aliases com variacao_id, exportado em 16/10/2026).
const v = (id: string, rotulo: string) => ({ id, rotulo })
const COM_VARIACOES = [
  {
    id: 've',
    nome: 'Vassoura Especial UN',
    variacoes: [v('gari', 'Gari'), v('nov', 'Noviça'), v('pia', 'Piaçava Chapa 3')],
    aliasesPorVariacao: { gari: ['vassoura gari'], nov: ['vassoura novica', 'vassoura novica un'], pia: ['vassoura piacava chapa 3'] },
  },
  { id: 'vc', nome: 'Vassoura Cerlon UN', variacoes: [v('vc1', '1 m'), v('vc40', '40 cm'), v('vc60', '60 cm')] },
  { id: 'vp', nome: 'Vassoura Pêlo Natural 40cm UN' },
  { id: 'db', nome: 'Disco branco UN', variacoes: [v('db300', '300 mm'), v('db350', '350 mm'), v('db400', '400 mm')], aliasesPorVariacao: { db350: ['disco branco 350'] } },
  { id: 'dp', nome: 'Disco preto UN', variacoes: [v('dp300', '300 mm'), v('dp350', '350 mm'), v('dp400', '400 mm'), v('dp510', '510 mm')] },
  { id: 'dv', nome: 'Disco verde UN', variacoes: [v('dv300', '300 mm'), v('dv350', '350 mm'), v('dv400', '400 mm'), v('dv510', '510 mm')] },
  {
    id: 'fl',
    nome: 'Flanela Microfibra UN',
    variacoes: [v('fam', 'amarela'), v('faz', 'azul'), v('fve', 'verde'), v('fvm', 'vermelha')],
    aliasesPorVariacao: { fam: ['flanela m fibra amarela'] },
  },
  { id: 'dn', nome: 'Detergente Neutro 5L' },
]
const nomes = (termo: string) => buscarItens(termo, COM_VARIACOES).map((r) => r.nome)

describe('buscarItens com variações (16/10/2026)', () => {
  it('"piaçava"/"piacava" trazem a Vassoura Piaçava primeiro, com a variação', () => {
    for (const t of ['piaçava', 'piacava', 'PIAÇAVA']) {
      const [r] = buscarItens(t, COM_VARIACOES)
      expect(r).toMatchObject({ item: { id: 've' }, variacao: { id: 'pia' }, nome: 'Vassoura Piaçava Chapa 3' })
    }
  })

  it('"noviça" acha a variação Noviça (sem "Especial" nem "UN" no nome)', () => {
    expect(nomes('noviça')[0]).toBe('Vassoura Noviça')
    expect(nomes('novica')[0]).toBe('Vassoura Noviça')
  })

  it('"vassoura": vassouras diferentes antes da 2ª medida do mesmo item; Piaçava aparece (máx. 8)', () => {
    const r = nomes('vassoura')
    expect(r.length).toBeLessThanOrEqual(8)
    expect(r).toContain('Vassoura Piaçava Chapa 3')
    expect(r.slice(0, 3)).toEqual(expect.arrayContaining(['Vassoura Gari', 'Vassoura Cerlon 1 m', 'Vassoura Pêlo Natural 40cm']))
  })

  it('"disco 350" traz os três discos de 350 mm primeiro', () => {
    expect(nomes('disco 350').slice(0, 3).sort()).toEqual(['Disco branco 350 mm', 'Disco preto 350 mm', 'Disco verde 350 mm'])
  })

  it('"disco branco" traz as medidas do disco branco primeiro', () => {
    expect(nomes('disco branco').slice(0, 3).sort()).toEqual(['Disco branco 300 mm', 'Disco branco 350 mm', 'Disco branco 400 mm'])
  })

  it('"flanela amarela" → a amarela primeiro; "flanela" → as 4 cores, cada uma um resultado', () => {
    const [r] = buscarItens('flanela amarela', COM_VARIACOES)
    expect(r).toMatchObject({ variacao: { id: 'fam' }, nome: 'Flanela Microfibra amarela' })
    expect(nomes('flanela').sort()).toEqual([
      'Flanela Microfibra amarela',
      'Flanela Microfibra azul',
      'Flanela Microfibra verde',
      'Flanela Microfibra vermelha',
    ])
  })

  it('item sem variação continua um resultado só, com variacao null', () => {
    expect(buscarItens('detergente', COM_VARIACOES)).toEqual([
      expect.objectContaining({ item: expect.objectContaining({ id: 'dn' }), variacao: null, nome: 'Detergente Neutro 5L' }),
    ])
  })

  it('o kit do contrato desempata (sem passar na frente de resultado melhor)', () => {
    const comKit = COM_VARIACOES.map((i) => (i.id === 'fl' ? { ...i, variacoesNoKit: ['fve'] } : i))
    expect(buscarItens('flanela', comKit)[0].variacao?.id).toBe('fve')
    expect(buscarItens('flanela amarela', comKit)[0].variacao?.id).toBe('fam')
  })
})

describe('nomeExibicaoItem', () => {
  it('monta o nome amigável de forma conservadora', () => {
    expect(nomeExibicaoItem('Vassoura Especial UN', 'Noviça')).toBe('Vassoura Noviça')
    expect(nomeExibicaoItem('Disco branco UN', '350 mm')).toBe('Disco branco 350 mm')
    expect(nomeExibicaoItem('Saco de lixo PCT', '100L')).toBe('Saco de lixo 100L')
    expect(nomeExibicaoItem('Pedra Sanitária UN')).toBe('Pedra Sanitária')
    // "Especial" só sai quando há variação; unidade só no FIM do nome.
    expect(nomeExibicaoItem('Vassoura Especial UN')).toBe('Vassoura Especial')
    expect(nomeExibicaoItem('Copo descartável 200mL PCT c/100')).toBe('Copo descartável 200mL PCT c/100')
    expect(nomeExibicaoItem('UN')).toBe('UN')
    // rótulo que já está no fim do nome não repete
    expect(nomeExibicaoItem('Mop Cabo grande', 'grande')).toBe('Mop Cabo grande')
  })
})
