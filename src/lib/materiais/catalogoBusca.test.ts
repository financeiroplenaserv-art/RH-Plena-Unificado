import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buscarItens } from './buscaItens'
import { catalogoBuscavelDoLider, type ItemCatalogoServidor, type KitPublico } from './pedidoLider'

// Catálogo buscável que vai para o celular (16/10/2026): só nomes.
const CNOOC = 'cnooc'
const item = (id: string, nome: string, extra: Partial<ItemCatalogoServidor> = {}): ItemCatalogoServidor => ({
  id,
  nome,
  categoria: 'limpeza',
  unidade: 'unidade',
  validade_meses: null,
  variacoes: [],
  ...extra,
})
// Campos que o banco/servidor poderia ter e NUNCA podem sair (o item abaixo os carrega de propósito).
const SUJO = { preco: 12.5, fornecedor_id: 'forn-secreto', fornecedor: 'Fornecedor X', preco_unitario: 9.9 }
const CATALOGO: ItemCatalogoServidor[] = [
  item('vass', 'Vassoura Especial UN', {
    variacoes: [
      { id: 'pia', rotulo: 'Piaçava' },
      { id: 'novi', rotulo: 'Noviça' },
    ],
    ...(SUJO as object),
  }),
  item('disco', 'Disco branco UN', { variacoes: [{ id: 'd350', rotulo: '350 mm' }, { id: 'd410', rotulo: '410 mm' }] }),
  item('scotch', 'Esponja Scotch Brite', { contratos_exclusivos: [CNOOC] }),
  item('mop', 'Mop Cabeleira Pequena UN', {
    variacoes: [
      { id: 'maxteck', rotulo: 'Max Teck', oculta_lider: true },
      { id: 'star', rotulo: 'Starclean', oculta_lider: true },
    ],
  }),
  item('porta', 'Cadeado portaria', { categoria: 'portaria' }),
]
const ALIASES = [
  { nome_legado: 'vassoura de piacava velha', item_id: 'vass', variacao_id: 'pia' },
  { nome_legado: 'vassoura pelo', item_id: 'vass', variacao_id: null },
  { nome_legado: 'mop starclean antigo', item_id: 'mop', variacao_id: 'star' },
  { nome_legado: 'esponja de aço', item_id: 'scotch', variacao_id: null },
]
const kit: KitPublico[] = [{ item_id: 'disco', variacao_id: 'd350', quantidade: 2, periodicidade_meses: 1 }]

describe('catalogoBuscavelDoLider (catálogo público para a busca no aparelho)', () => {
  it('forma pública: só id, nomes, categoria, unidade, validade, variações visíveis e termos de busca', () => {
    const cat = catalogoBuscavelDoLider(CATALOGO, kit, ALIASES, 'abaete', true)
    const vass = cat.find((c) => c.id === 'vass')!
    expect(Object.keys(vass).sort()).toEqual(
      ['aliases', 'aliasesPorVariacao', 'categoria', 'id', 'nome', 'noKit', 'unidade', 'validade_meses', 'variacoes', 'variacoesNoKit'].sort()
    )
    expect(vass.variacoes).toEqual([
      { id: 'pia', rotulo: 'Piaçava' },
      { id: 'novi', rotulo: 'Noviça' },
    ])
    expect(vass.aliases).toEqual(['vassoura pelo'])
    expect(vass.aliasesPorVariacao).toEqual({ pia: ['vassoura de piacava velha'] })
    expect(cat.find((c) => c.id === 'disco')).toMatchObject({ noKit: false, variacoesNoKit: ['d350'] })
  })

  it('nenhum campo de preço, fornecedor ou contratos exclusivos sai na resposta', () => {
    const json = JSON.stringify(catalogoBuscavelDoLider(CATALOGO, kit, ALIASES, 'abaete', true))
    for (const proibido of ['preco', 'fornecedor', 'forn-secreto', 'contratos_exclusivos', 'oculta_lider', '12.5', '9.9']) {
      expect(json).not.toContain(proibido)
    }
  })

  it('exclusivo de outro contrato some; no contrato dono ele aparece', () => {
    expect(catalogoBuscavelDoLider(CATALOGO, kit, ALIASES, 'abaete', true).some((c) => c.id === 'scotch')).toBe(false)
    expect(catalogoBuscavelDoLider(CATALOGO, kit, ALIASES, CNOOC, true).some((c) => c.id === 'scotch')).toBe(true)
  })

  it('marca oculta: a variação some, mas o rótulo e os apelidos viram termo de busca do item', () => {
    const mop = catalogoBuscavelDoLider(CATALOGO, [], ALIASES, 'abaete', true).find((c) => c.id === 'mop')!
    expect(mop.variacoes).toEqual([])
    expect(mop.aliases).toEqual(expect.arrayContaining(['Max Teck', 'Starclean']))
    const achados = buscarItens('starclean', [mop], 8)
    expect(achados.map((a) => a.item.id)).toEqual(['mop'])
    expect(JSON.stringify(mop)).not.toContain('oculta')
  })

  it('contrato sem limpeza recebe só portaria', () => {
    expect(catalogoBuscavelDoLider(CATALOGO, [], ALIASES, 'abaete', false).map((c) => c.id)).toEqual(['porta'])
  })

  it('a busca local acha "piaçava" e "disco 350"', () => {
    const cat = catalogoBuscavelDoLider(CATALOGO, kit, ALIASES, 'abaete', true)
    expect(buscarItens('piaçava', cat, 8)[0].nome).toBe('Vassoura Piaçava')
    expect(buscarItens('disco 350', cat, 8)[0].nome).toBe('Disco branco 350 mm')
  })

  it('a Edge Function devolve catalogo_busca no carregar e mantém buscar_item', () => {
    const fn = readFileSync('supabase/functions/pedido-materiais/index.ts', 'utf8')
    expect(fn).toMatch(/catalogo_busca: catalogoBuscavelDoLider\(/)
    expect(fn).toMatch(/case 'buscar_item'/)
  })
})
