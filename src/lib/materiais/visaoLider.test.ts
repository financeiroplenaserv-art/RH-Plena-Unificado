import { describe, expect, it } from 'vitest'
import { buscarItens, exclusivoDeOutroContrato, nomeLiderItem } from './buscaItens'
import { validarEnvioPedido, visaoDoLider, type ContextoPedido, type ItemCatalogoServidor, type KitPublico } from './pedidoLider'
import { nomeDaLinhaProduto } from '@/components/materiais/pedido/formPedido'

// Recorte do catálogo real (16/10/2026) com as marcações da migration 136.
const CNOOC = 'cf6db919-c5fd-4021-96c2-c0582a9d5be9'
const OUTRO = 'abaete'
const item = (id: string, nome: string, extra: Partial<ItemCatalogoServidor> = {}): ItemCatalogoServidor => ({
  id,
  nome,
  categoria: 'limpeza',
  unidade: 'unidade',
  validade_meses: null,
  variacoes: [],
  ...extra,
})
const CATALOGO: ItemCatalogoServidor[] = [
  item('dupla', 'Esponja dupla face UN'),
  item('scotch', 'Esponja Scotch Brite', { contratos_exclusivos: [CNOOC] }),
  item('veja', 'Veja Multiuso 500mL', { contratos_exclusivos: [CNOOC] }),
  item('mopg', 'Mop Cabeleira Grande UN', { variacoes: [{ id: 'verde', rotulo: 'verde' }] }),
  item('mopp', 'Mop Cabeleira Pequena UN', {
    variacoes: [
      { id: 'maxteck', rotulo: 'Max Teck', oculta_lider: true },
      { id: 'starclean', rotulo: 'Starclean', oculta_lider: true },
    ],
  }),
  item('magico', 'Removedor desengraxante Mágico Start 5L', { nome_lider: 'Removedor desengraxante 5L' }),
  item('removic', 'Removedor desengraxante Removic 5L', { nome_lider: 'Removedor desengraxante 5L' }),
  item('cera', 'Removedor de cera'),
  item('pronto', 'Removedor Use Pronto 5L'),
]
const kitLinha = (item_id: string, variacao_id: string | null, quantidade = 2): KitPublico => ({
  item_id,
  variacao_id,
  quantidade,
  periodicidade_meses: 1,
})

/** Busca como a Edge Function faz: visão do líder → buscarItens. */
function buscar(termo: string, contrato: string, kit: KitPublico[] = []) {
  const visao = visaoDoLider(CATALOGO, kit, contrato)
  const kitItem = new Set(visao.kit.filter((k) => !k.variacao_id).map((k) => k.item_id))
  return buscarItens(
    termo,
    visao.catalogo.map((c) => ({ ...c, noKit: kitItem.has(c.id) }))
  )
}

describe('visão do líder — marca oculta (Mop Cabeleira Pequena)', () => {
  it('busca mostra o mop sem marca, uma vez só, sem variação', () => {
    const r = buscar('mop cabeleira pequena', OUTRO).filter((x) => x.item.id === 'mopp')
    expect(r).toHaveLength(1)
    expect(r[0].nome).toBe('Mop Cabeleira Pequena')
    expect(r[0].variacao).toBeNull()
    expect(r[0].item.variacoes).toEqual([])
  })

  it('linha do kit com a marca vira linha do item (variacao_id null); duas marcas somam', () => {
    const v = visaoDoLider(CATALOGO, [kitLinha('mopp', 'starclean', 6), kitLinha('mopp', 'maxteck', 2), kitLinha('mopg', 'verde', 1)], OUTRO)
    expect(v.kit).toEqual([
      { item_id: 'mopp', variacao_id: null, quantidade: 8, periodicidade_meses: 1 },
      { item_id: 'mopg', variacao_id: 'verde', quantidade: 1, periodicidade_meses: 1 },
    ])
    // variação que NÃO é marca segue visível
    expect(v.catalogo.find((c) => c.id === 'mopg')?.variacoes).toEqual([{ id: 'verde', rotulo: 'verde' }])
  })

  it('envio do kit grava o mop com variacao_id null', () => {
    const v = visaoDoLider(CATALOGO, [kitLinha('mopp', 'starclean', 6)], OUTRO)
    const ctx: ContextoPedido = { hoje: '2026-10-16', recebeLimpeza: true, catalogo: v.catalogo, kit: v.kit, itensCeu: [], ultimasEntregas: {}, indisponiveis: v.indisponiveis }
    const r = validarEnvioPedido(
      { seu_nome: 'Ana', termos: { materiais: true }, produtos: [{ item_id: 'mopp', variacao_id: null, quantidade: 6, parte: 'kit' }] },
      ctx
    )
    expect(r.ok).toBe(true)
    expect(r.produtos).toEqual([expect.objectContaining({ item_id: 'mopp', variacao_id: null, parte: 'kit', qtd_pedida: 6 })])
  })
})

describe('visão do líder — nome para o líder (Removedor desengraxante)', () => {
  const desengraxantes = (termo: string, kit: KitPublico[] = []) =>
    buscar(termo, OUTRO, kit).filter((x) => x.item.id === 'magico' || x.item.id === 'removic')

  it('"removedor desengraxante": os dois itens viram UM resultado, em 1º, com o nome do líder', () => {
    const r = buscar('removedor desengraxante', OUTRO)
    expect(r[0].nome).toBe('Removedor desengraxante 5L')
    expect(desengraxantes('removedor desengraxante')).toHaveLength(1)
    expect(r[0].item.id).toBe('magico') // sem kit: o primeiro na ordem do catálogo
  })

  it('"removedor" traz o desengraxante uma vez só (os outros removedores seguem)', () => {
    const nomes = buscar('removedor', OUTRO).map((x) => x.nome)
    expect(nomes.filter((n) => n === 'Removedor desengraxante 5L')).toHaveLength(1)
    expect(nomes).toEqual(expect.arrayContaining(['Removedor de cera', 'Removedor Use Pronto 5L']))
  })

  it('prefere o item que está no kit do contrato', () => {
    const r = desengraxantes('removedor desengraxante', [kitLinha('removic', null)])
    expect(r).toHaveLength(1)
    expect(r[0].item.id).toBe('removic')
  })

  it('a marca digitada ainda acha o desengraxante, sem mostrar a marca ("removic")', () => {
    const r = desengraxantes('removic')
    expect(r).toHaveLength(1)
    expect(r[0].nome).toBe('Removedor desengraxante 5L')
  })

  it('kit e revisão usam o nome do líder', () => {
    expect(nomeLiderItem({ nome: 'Removedor desengraxante Removic 5L', nome_lider: 'Removedor desengraxante 5L' })).toBe('Removedor desengraxante 5L')
    expect(nomeLiderItem({ nome: 'Pedra Sanitária UN', nome_lider: null })).toBe('Pedra Sanitária')
    expect(
      nomeDaLinhaProduto(
        { item_id: 'removic', variacao_id: null, descricao_livre: '' },
        { nome: 'Removedor desengraxante Removic 5L', nome_lider: 'Removedor desengraxante 5L', variacoes: [] }
      )
    ).toBe('Removedor desengraxante 5L')
  })
})

describe('visão do líder — itens exclusivos de contrato (CNOOC)', () => {
  it('exclusivoDeOutroContrato: vazio = todos; lista sem o contrato = exclusivo de outro', () => {
    expect(exclusivoDeOutroContrato({ contratos_exclusivos: null }, OUTRO)).toBe(false)
    expect(exclusivoDeOutroContrato({ contratos_exclusivos: [] }, OUTRO)).toBe(false)
    expect(exclusivoDeOutroContrato({ contratos_exclusivos: [CNOOC] }, CNOOC)).toBe(false)
    expect(exclusivoDeOutroContrato({ contratos_exclusivos: [CNOOC] }, OUTRO)).toBe(true)
  })

  it('"esponja" na CNOOC traz as duas; nos outros contratos só a dupla face', () => {
    expect(buscar('esponja', CNOOC).map((x) => x.item.id).sort()).toEqual(['dupla', 'scotch'])
    expect(buscar('esponja', OUTRO).map((x) => x.item.id)).toEqual(['dupla'])
  })

  it('"veja" fora da CNOOC não tem resultado', () => {
    expect(buscar('veja', OUTRO)).toEqual([])
    expect(buscar('veja', CNOOC).map((x) => x.item.id)).toEqual(['veja'])
  })

  it('o enviar recusa item exclusivo de outro contrato (não vira texto livre)', () => {
    const v = visaoDoLider(CATALOGO, [], OUTRO)
    expect(v.indisponiveis.sort()).toEqual(['scotch', 'veja'])
    const ctx: ContextoPedido = { hoje: '2026-10-16', recebeLimpeza: true, catalogo: v.catalogo, kit: v.kit, itensCeu: [], ultimasEntregas: {}, indisponiveis: v.indisponiveis }
    const r = validarEnvioPedido(
      { seu_nome: 'Ana', termos: { materiais: true }, produtos: [{ chave: 'a', item_id: 'veja', variacao_id: null, quantidade: 1, parte: 'extra' }] },
      ctx
    )
    expect(r.ok).toBe(false)
    expect(r.errosCampo).toContainEqual(expect.objectContaining({ chave: "a", mensagem: expect.stringMatching(/não está disponível para este posto/) }))
    expect(r.produtos).toEqual([])
  })

  it('item exclusivo que o gestor pôs no kit de outro contrato vale para aquele contrato', () => {
    const v = visaoDoLider(CATALOGO, [kitLinha('scotch', null)], OUTRO)
    expect(v.indisponiveis).toEqual(['veja'])
    expect(v.catalogo.some((c) => c.id === 'scotch')).toBe(true)
  })

  it('o catálogo devolvido ao link não leva a lista de contratos nem a marcação de variação', () => {
    const v = visaoDoLider(CATALOGO, [], CNOOC)
    for (const c of v.catalogo) {
      expect(c).not.toHaveProperty('contratos_exclusivos')
      for (const x of c.variacoes) expect(x).not.toHaveProperty('oculta_lider')
    }
  })
})
