import { describe, it, expect } from 'vitest'
import { estruturaAusente } from './erros'
import { historicoPrecos, jaNoKit, lerNumero, montarLinhasKit, nomeDuplicado, validarNovoPreco } from './cadastro'

describe('estruturaAusente', () => {
  it('reconhece tabela inexistente (Postgres e PostgREST)', () => {
    expect(estruturaAusente({ code: '42P01', message: 'relation "public.mat_itens" does not exist' })).toBe(true)
    expect(estruturaAusente({ code: 'PGRST205', message: "Could not find the table 'public.mat_itens' in the schema cache" })).toBe(true)
    expect(estruturaAusente({ code: 'PGRST202', message: 'Could not find the function public.decidir_alteracao_kit' })).toBe(true)
    expect(estruturaAusente({ message: 'relation "mat_contratos" does not exist' })).toBe(true)
  })

  it('coluna inexistente só conta quando pedido (fornecedores ampliado pela 121)', () => {
    const erro = { code: '42703', message: 'column fornecedores.ativo does not exist' }
    expect(estruturaAusente(erro)).toBe(false)
    expect(estruturaAusente(erro, true)).toBe(true)
  })

  it('não confunde erro de permissão ou nulo', () => {
    expect(estruturaAusente(null)).toBe(false)
    expect(estruturaAusente({ code: '42501', message: 'permission denied for table mat_itens' })).toBe(false)
  })
})

describe('preços', () => {
  const precos = [
    { item_id: 'a', variacao_id: null, preco: 10, vigente_desde: '2026-01-01', created_at: '1' },
    { item_id: 'a', variacao_id: null, preco: 12, vigente_desde: '2026-06-01', created_at: '2' },
    { item_id: 'a', variacao_id: 'v1', preco: 15, vigente_desde: '2026-03-01', created_at: '3' },
    { item_id: 'b', variacao_id: null, preco: 1, vigente_desde: '2026-02-01', created_at: '4' },
  ]

  it('histórico do item vem do mais recente ao mais antigo, separado da variação', () => {
    expect(historicoPrecos(precos, 'a', null).map((p) => p.preco)).toEqual([12, 10])
    expect(historicoPrecos(precos, 'a', 'v1').map((p) => p.preco)).toEqual([15])
  })

  it('valida novo preço', () => {
    expect(validarNovoPreco(null, '2026-10-01')).toMatch(/Informe o preço/)
    expect(validarNovoPreco(-1, '2026-10-01')).toMatch(/negativo/)
    expect(validarNovoPreco(5, '')).toMatch(/vigência/)
    expect(validarNovoPreco(0, '2026-10-01')).toBeNull()
  })

  it('lê números no formato brasileiro', () => {
    expect(lerNumero('12,50')).toBe(12.5)
    expect(lerNumero('R$ 1.234,56')).toBe(1234.56)
    expect(lerNumero('3')).toBe(3)
    expect(lerNumero('')).toBeNull()
    expect(lerNumero('abc')).toBeNull()
  })
})

describe('nomeDuplicado', () => {
  const lista = [{ id: '1', nome: 'Água sanitária 5L' }, { id: '2', nome: 'Balde' }]
  it('ignora acento, caixa e o próprio registro', () => {
    expect(nomeDuplicado('agua SANITARIA 5l', lista)).toBe(true)
    expect(nomeDuplicado('Balde', lista, '2')).toBe(false)
    expect(nomeDuplicado('Vassoura', lista)).toBe(false)
  })
})

describe('Kit Mensal', () => {
  const itens = [
    { id: 'i1', nome: 'Detergente', unidade_pedido: 'bombona 5L' },
    { id: 'i2', nome: 'Balde', unidade_pedido: 'unidade' },
  ]
  const variacoes = [{ id: 'v1', rotulo: '350 mm' }]
  const precos = [
    { item_id: 'i1', variacao_id: null, preco: 20, vigente_desde: '2026-01-01' },
    { item_id: 'i1', variacao_id: 'v1', preco: 25, vigente_desde: '2026-01-01' },
  ]
  const kit = [
    { id: 'k1', item_id: 'i1', variacao_id: null, quantidade: 2, periodicidade_meses: 1, observacao: null },
    { id: 'k2', item_id: 'i1', variacao_id: 'v1', quantidade: 1, periodicidade_meses: 1, observacao: null },
    { id: 'k3', item_id: 'i2', variacao_id: null, quantidade: 3, periodicidade_meses: 6, observacao: null },
  ]

  it('calcula preço vigente, subtotal e ordena por nome', () => {
    const linhas = montarLinhasKit(kit, itens, variacoes, precos, '2026-10-09')
    expect(linhas.map((l) => l.itemNome)).toEqual(['Balde', 'Detergente', 'Detergente'])
    expect(linhas[0].subtotal).toBeNull() // Balde sem preço
    expect(linhas[1].subtotal).toBe(40)
    expect(linhas[2].variacaoRotulo).toBe('350 mm')
    expect(linhas[2].subtotal).toBe(25) // preço da variação prevalece
    expect(linhas[1].media6).toBeNull() // sem histórico carregado
  })

  it('média de 6 meses fechados: mês sem consumo conta zero', () => {
    const consumos = [
      { competencia: '2026-09-01', item_id: 'i1', variacao_id: null, quantidade: 6 },
      { competencia: '2026-10-01', item_id: 'i1', variacao_id: null, quantidade: 100 }, // mês corrente: fora
    ]
    const linhas = montarLinhasKit(kit, itens, variacoes, precos, '2026-10-09', consumos)
    expect(linhas.find((l) => l.kit.id === 'k1')?.media6).toBe(1)
    expect(linhas.find((l) => l.kit.id === 'k3')?.media6).toBe(0)
  })

  it('detecta item/variação já no kit', () => {
    expect(jaNoKit(kit, 'i1', null)).toBe(true)
    expect(jaNoKit(kit, 'i1', null, 'k1')).toBe(false)
    expect(jaNoKit(kit, 'i2', 'v1')).toBe(false)
  })
})

describe('mensagemErroMateriais', () => {
  it('traduz os erros mais comuns', async () => {
    const { mensagemErroMateriais } = await import('./erros')
    expect(mensagemErroMateriais({ code: '23505', message: 'dup' }, 'salvar o item')).toMatch(/já existe/)
    expect(mensagemErroMateriais({ code: '42501', message: 'x' }, 'salvar o item')).toBe('Sem permissão para salvar o item.')
    expect(mensagemErroMateriais({ code: 'PGRST205', message: 'x' }, 'salvar')).toMatch(/Módulo em preparação/)
    expect(mensagemErroMateriais({ code: 'X', message: 'falhou' }, 'salvar')).toBe('Erro ao salvar: falhou')
  })
})

describe('selecionarTudo', () => {
  it('lê em lotes até o último incompleto e propaga erro', async () => {
    const { selecionarTudo } = await import('./paginar')
    const dados = Array.from({ length: 5 }, (_, i) => i)
    const chamadas: [number, number][] = []
    const r = await selecionarTudo<number>(async (de, ate) => {
      chamadas.push([de, ate])
      return { data: dados.slice(de, ate + 1), error: null }
    }, 2)
    expect(r.data).toEqual([0, 1, 2, 3, 4])
    expect(chamadas).toEqual([[0, 1], [2, 3], [4, 5]])
    const comErro = await selecionarTudo<number>(async () => ({ data: null, error: { code: 'PGRST205' } }))
    expect(comErro.error?.code).toBe('PGRST205')
  })
})
