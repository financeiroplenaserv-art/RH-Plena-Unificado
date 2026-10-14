import { describe, expect, it } from 'vitest'
import { buscarItens, distanciaEdicao, normalizarBusca, similaridadeTrigramas } from './buscaItens'

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

  it('termo curto não busca (nunca "lista tudo") e o resultado tem no máximo 5', () => {
    expect(ids('ca')).toEqual([])
    expect(ids('  ')).toEqual([])
    expect(buscarItens('a', ITENS, 50)).toEqual([])
    expect(buscarItens('vassoura cabo detergente', ITENS, 50).length).toBeLessThanOrEqual(5)
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
