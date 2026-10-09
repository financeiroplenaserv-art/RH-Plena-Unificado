import { describe, it, expect } from 'vitest'
import { mesmoTexto, normalizarTexto } from './normalizar'
import { calcularExcecoes, justificativaValida, qtdNoKit } from './excecoes'
import {
  descreverDestino,
  destinoEnvio,
  statusCeuAposMescla,
  statusInicialProdutos,
  statusProdutosAposMescla,
} from './mescla'
import { aplicarDecisaoRepeticao, repeticaoCeu, repeticaoProdutos } from './repeticao'
import { converterQuantidade, resolverAlias } from './aliases'
import { rotaEfetiva, tamanhosDivergem } from './pedidos'

describe('normalização de texto', () => {
  it('remove acentos, pontuação e espaços repetidos', () => {
    expect(normalizarTexto('  Ação  Única-1 ')).toBe('acao unica 1')
    expect(normalizarTexto(null)).toBe('')
  })
  it('mesmoTexto ignora caixa e acento e nunca iguala vazios', () => {
    expect(mesmoTexto('José da Silva', 'JOSE DA  SILVA')).toBe(true)
    expect(mesmoTexto('', '')).toBe(false)
  })
})

describe('exceções da linha de produto', () => {
  const kit = [{ item_id: 'A', variacao_id: null, quantidade: 2 }]
  const base = { kit, validadeMeses: null, ultimaEntrega: null, hoje: '2026-10-09' }

  it('dentro do kit não tem exceção', () => {
    const r = calcularExcecoes({ ...base, linha: { item_id: 'A', variacao_id: null, quantidade: 2 } })
    expect(r).toMatchObject({ acimaKit: false, foraKit: false, validade: false, exigeJustificativa: false, qtdKit: 2 })
  })

  it('acima do kit', () => {
    const r = calcularExcecoes({ ...base, linha: { item_id: 'A', variacao_id: null, quantidade: 3 } })
    expect(r.acimaKit).toBe(true)
    expect(r.exigeJustificativa).toBe(true)
  })

  it('item fora do kit e "outros materiais" (sem item) são exceção', () => {
    expect(calcularExcecoes({ ...base, linha: { item_id: 'B', variacao_id: null, quantidade: 1 } }).foraKit).toBe(true)
    expect(calcularExcecoes({ ...base, linha: { item_id: null, variacao_id: null, quantidade: 1 } }).foraKit).toBe(true)
  })

  it('quantidade zero não gera exceção', () => {
    expect(calcularExcecoes({ ...base, linha: { item_id: 'B', variacao_id: null, quantidade: 0 } }).exigeJustificativa).toBe(false)
  })

  it('validade: balde de 6 meses pedido antes de vencer', () => {
    const linha = { item_id: 'A', variacao_id: null, quantidade: 1 }
    expect(calcularExcecoes({ ...base, linha, validadeMeses: 6, ultimaEntrega: '2026-06-15' }).validade).toBe(true)
    expect(calcularExcecoes({ ...base, linha, validadeMeses: 6, ultimaEntrega: '2026-03-01' }).validade).toBe(false)
    // vence exatamente hoje: já pode pedir
    expect(calcularExcecoes({ ...base, linha, validadeMeses: 6, ultimaEntrega: '2026-04-09' }).validade).toBe(false)
    // sem controle de validade ou sem entrega anterior
    expect(calcularExcecoes({ ...base, linha, validadeMeses: null, ultimaEntrega: '2026-09-01' }).validade).toBe(false)
    expect(calcularExcecoes({ ...base, linha, validadeMeses: 6, ultimaEntrega: null }).validade).toBe(false)
  })

  it('variação sem linha própria no kit cai no kit do item', () => {
    expect(qtdNoKit(kit, 'A', 'v1')).toBe(2)
    expect(qtdNoKit([{ item_id: 'A', variacao_id: 'v1', quantidade: 5 }], 'A', 'v2')).toBeNull()
  })

  it('justificativa vazia ou só espaços é inválida', () => {
    expect(justificativaValida('  ')).toBe(false)
    expect(justificativaValida(null)).toBe(false)
    expect(justificativaValida('obra no hall')).toBe(true)
  })
})

describe('mescla de envios com trava', () => {
  const ped = (p: string, c: string) => ({ status_produtos: p, status_ceu: c }) as Parameters<typeof destinoEnvio>[0]

  it('sem pedido no mês, as filas presentes criam o pedido', () => {
    expect(destinoEnvio(null, true, false)).toEqual({ produtos: 'novo', ceu: 'nenhuma' })
    expect(destinoEnvio(null, true, true)).toEqual({ produtos: 'novo', ceu: 'novo' })
  })

  it('produtos mesclam até a aprovação e depois viram pedido extra', () => {
    for (const s of ['em_validacao', 'validado', 'nao_se_aplica']) {
      expect(destinoEnvio(ped(s, 'enviado'), true, false).produtos).toBe('mesclar')
    }
    expect(destinoEnvio(ped('aprovado', 'enviado'), true, false).produtos).toBe('extra')
  })

  it('uniforme/EPI/crachá mesclam até a conferência e depois viram extra', () => {
    for (const s of ['nao_se_aplica', 'enviado', 'em_identificacao']) {
      expect(destinoEnvio(ped('validado', s), false, true).ceu).toBe('mesclar')
    }
    for (const s of ['conferido', 'em_atendimento', 'atendido']) {
      expect(destinoEnvio(ped('validado', s), false, true).ceu).toBe('extra')
    }
  })

  it('cada fila decide sozinha (produtos aprovados, CEU ainda aberto)', () => {
    expect(destinoEnvio(ped('aprovado', 'enviado'), true, true)).toEqual({ produtos: 'extra', ceu: 'mesclar' })
  })

  it('status de produtos após o complemento', () => {
    expect(statusInicialProdutos(false, false)).toBe('nao_se_aplica')
    expect(statusInicialProdutos(true, false)).toBe('validado')
    expect(statusInicialProdutos(true, true)).toBe('em_validacao')
    expect(statusProdutosAposMescla('validado', true)).toBe('em_validacao')
    expect(statusProdutosAposMescla('validado', false)).toBe('validado')
    expect(statusProdutosAposMescla('nao_se_aplica', false)).toBe('validado')
    expect(statusProdutosAposMescla('em_validacao', false)).toBe('em_validacao')
    expect(statusCeuAposMescla('nao_se_aplica')).toBe('enviado')
    expect(statusCeuAposMescla('em_identificacao')).toBe('em_identificacao')
  })

  it('descreve o destino para a tela pública', () => {
    expect(descreverDestino({ produtos: 'mesclar', ceu: 'nenhuma' })).toBe('Os produtos serão somados ao pedido do mês.')
    expect(descreverDestino({ produtos: 'extra', ceu: 'nenhuma' })).toContain('pedido extra')
    expect(descreverDestino({ produtos: 'novo', ceu: 'novo' })).toBe('')
  })
})

describe('aviso de repetição (só aviso)', () => {
  it('produtos: mesmo item e variação em outro envio', () => {
    const r = repeticaoProdutos(
      [
        { item_id: 'A', variacao_id: 'v1' },
        { item_id: 'A', variacao_id: 'v2' },
        { item_id: null, variacao_id: null },
      ],
      [{ id: 'x1', item_id: 'A', variacao_id: 'v1' }]
    )
    expect(r.map((x) => x.possivelRepeticao)).toEqual([true, false, false])
    expect(r[0].repeteId).toBe('x1')
  })

  const camisa = { tipo: 'uniforme' as const, item_id: 'camisa', tamanho: 'G' }

  it('uniforme/EPI: só com nome + peça + tamanho iguais (ignora acento e caixa)', () => {
    const existentes = [{ ...camisa, nome_digitado: 'José Silva' }]
    const r = repeticaoCeu(
      [
        { ...camisa, nome_digitado: 'JOSE  silva' }, // repete
        { ...camisa, tamanho: 'M', nome_digitado: 'Jose Silva' }, // outro tamanho
        { ...camisa, nome_digitado: 'Maria Souza' }, // mesma peça, outra pessoa
        { ...camisa, item_id: 'calca', nome_digitado: 'Jose Silva' }, // outra peça
      ],
      existentes
    )
    expect(r.map((x) => x.possivelRepeticao)).toEqual([true, false, false, false])
  })

  it('crachá: mesma pessoa no mês, independente de tamanho', () => {
    const cr = (nome: string) => ({ tipo: 'cracha' as const, item_id: null, tamanho: null, nome_digitado: nome })
    const r = repeticaoCeu([cr('ana paula'), cr('Bruno')], [cr('Ana  Paula')])
    expect(r.map((x) => x.possivelRepeticao)).toEqual([true, false])
  })

  it('crachá não se confunde com uniforme do mesmo nome', () => {
    const r = repeticaoCeu(
      [{ tipo: 'cracha', item_id: null, tamanho: null, nome_digitado: 'Ana' }],
      [{ tipo: 'uniforme', item_id: 'camisa', tamanho: 'G', nome_digitado: 'Ana' }]
    )
    expect(r[0].possivelRepeticao).toBe(false)
  })

  it('descartar zera com motivo padrão; somar/ignorar mantêm a quantidade', () => {
    expect(aplicarDecisaoRepeticao(4, 'descartar')).toEqual({ qtdValidada: 0, motivoPadrao: 'repetição' })
    expect(aplicarDecisaoRepeticao(4, 'somar')).toEqual({ qtdValidada: 4, motivoPadrao: null })
    expect(aplicarDecisaoRepeticao(4, null)).toEqual({ qtdValidada: 4, motivoPadrao: null })
  })
})

describe('aliases, rota e tamanhos', () => {
  const aliases = [{ nome_legado: 'cloro 1l', item_id: 'bombona', variacao_id: null, fator: 0.2 }]

  it('resolve o nome antigo pela forma normalizada e converte a unidade', () => {
    const a = resolverAlias('Cloro 1L ', aliases)
    expect(a?.item_id).toBe('bombona')
    expect(converterQuantidade(10, a!.fator)).toBe(2)
    expect(resolverAlias('desconhecido', aliases)).toBeNull()
    expect(resolverAlias('   ', aliases)).toBeNull()
  })

  it('rota efetiva = override do pedido ou padrão do contrato', () => {
    expect(rotaEfetiva({ rota_override: 3 }, { rota: 1 })).toBe(3)
    expect(rotaEfetiva({ rota_override: null }, { rota: 2 })).toBe(2)
    expect(rotaEfetiva({ rota_override: null }, { rota: null })).toBeNull()
  })

  it('tamanho só diverge quando os dois existem e são diferentes', () => {
    expect(tamanhosDivergem('g', 'G')).toBe(false)
    expect(tamanhosDivergem('G', 'GG')).toBe(true)
    expect(tamanhosDivergem('42', ' 42 ')).toBe(false)
    expect(tamanhosDivergem(null, 'G')).toBe(false)
    expect(tamanhosDivergem('G', '')).toBe(false)
  })
})
