import { describe, it, expect } from 'vitest'
import {
  aplicarSubstituicoes,
  criariaCiclo,
  montarPreviaSubstituicao,
  resolverSubstituto,
  mapaSubstituicoes,
  validarSubstituicao,
  type LinhaKitSubst,
  type VinculoSubstituicao,
} from './substituicao'
import { mediaConsumo } from './media'
import { montarPainel } from './painel'

const itens = [
  { id: 'X', ativo: true },
  { id: 'Y', ativo: true },
  { id: 'W', ativo: true },
  { id: 'Z', ativo: false },
  { id: 'S', ativo: true }, // saco de lixo com variações
]
const variacoes = [
  { id: 's-preto', item_id: 'S', ativo: true },
  { id: 's-azul', item_id: 'S', ativo: true },
  { id: 's-velha', item_id: 'S', ativo: false },
]
const contratos = [
  { id: 'c1', nome: 'Alfa', ativo: true },
  { id: 'c2', nome: 'Beta', ativo: true },
  { id: 'c3', nome: 'Gama', ativo: false },
  { id: 'c4', nome: 'Delta', ativo: true },
]
const linha = (id: string, contrato_id: string, item_id: string, quantidade: number, periodicidade_meses = 1, variacao_id: string | null = null): LinhaKitSubst => ({
  id,
  contrato_id,
  item_id,
  variacao_id,
  quantidade,
  periodicidade_meses,
})

describe('validarSubstituicao', () => {
  const p = { deItemId: 'X', deVariacaoId: null, paraItemId: 'Y', paraVariacaoId: null }

  it('aceita o caso simples', () => {
    expect(validarSubstituicao(p, itens, variacoes)).toBeNull()
  })

  it('bloqueia origem = destino', () => {
    expect(validarSubstituicao({ ...p, paraItemId: 'X' }, itens, variacoes)).toMatch(/mesmo item/)
    expect(
      validarSubstituicao({ deItemId: 'S', deVariacaoId: 's-preto', paraItemId: 'S', paraVariacaoId: 's-preto' }, itens, variacoes)
    ).toMatch(/mesmo item/)
  })

  it('permite trocar só a variação dentro do mesmo item', () => {
    expect(
      validarSubstituicao({ deItemId: 'S', deVariacaoId: 's-preto', paraItemId: 'S', paraVariacaoId: 's-azul' }, itens, variacoes)
    ).toBeNull()
  })

  it('destino inativo é recusado', () => {
    expect(validarSubstituicao({ ...p, paraItemId: 'Z' }, itens, variacoes)).toMatch(/inativo/)
  })

  it('destino com variações exige a variação (ativa)', () => {
    expect(validarSubstituicao({ ...p, paraItemId: 'S' }, itens, variacoes)).toMatch(/escolha a variação/)
    expect(validarSubstituicao({ ...p, paraItemId: 'S', paraVariacaoId: 's-velha' }, itens, variacoes)).toMatch(/inativa/)
    expect(validarSubstituicao({ ...p, paraItemId: 'S', paraVariacaoId: 's-azul' }, itens, variacoes)).toBeNull()
  })

  it('variação de origem precisa ser do item de origem', () => {
    expect(validarSubstituicao({ ...p, deVariacaoId: 's-preto' }, itens, variacoes)).toMatch(/não pertence/)
  })
})

describe('montarPreviaSubstituicao', () => {
  const p = { deItemId: 'X', deVariacaoId: null, paraItemId: 'Y', paraVariacaoId: null }

  it('troca mantendo quantidade e periodicidade; contrato sem o item fica fora', () => {
    const kit = [linha('k1', 'c1', 'X', 2, 2), linha('k2', 'c4', 'W', 5)]
    const r = montarPreviaSubstituicao(p, kit, contratos)
    expect(r.contratos).toBe(1)
    expect(r.linhas[0]).toMatchObject({
      contratoId: 'c1',
      quantidadeOrigem: 2,
      destinoExistente: null,
      quantidadeNova: 2,
      periodicidadeMeses: 2,
      soma: false,
    })
  })

  it('SOMA quando o contrato já tem o destino (vale a periodicidade da linha que fica) e destaca', () => {
    const kit = [linha('k1', 'c2', 'X', 2, 1), linha('k2', 'c2', 'Y', 3, 2), linha('k3', 'c1', 'X', 1)]
    const r = montarPreviaSubstituicao(p, kit, contratos)
    expect(r.contratos).toBe(2)
    expect(r.linhasSomadas).toBe(1)
    // linhas com soma vêm primeiro
    expect(r.linhas[0]).toMatchObject({
      contratoId: 'c2',
      quantidadeNova: 5,
      soma: true,
      periodicidadeMeses: 2,
      periodicidadeDivergente: true,
    })
    expect(r.linhas[1]).toMatchObject({ contratoId: 'c1', quantidadeNova: 1, soma: false })
  })

  it('contrato inativo também é trocado', () => {
    const r = montarPreviaSubstituicao(p, [linha('k1', 'c3', 'X', 4)], contratos)
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0]).toMatchObject({ contratoId: 'c3', contratoAtivo: false, quantidadeNova: 4 })
  })

  it('variação: todas as variações da origem vão para a mesma linha do destino (somam)', () => {
    const kit = [linha('k1', 'c1', 'S', 2, 1, 's-preto'), linha('k2', 'c1', 'S', 3, 1, 's-azul')]
    const r = montarPreviaSubstituicao({ deItemId: 'S', deVariacaoId: null, paraItemId: 'Y', paraVariacaoId: null }, kit, contratos)
    expect(r.linhas[0]).toMatchObject({ quantidadeOrigem: 5, quantidadeNova: 5, soma: true })
  })

  it('variação: só a variação escolhida sai; a linha de destino não conta como origem', () => {
    const kit = [linha('k1', 'c1', 'S', 2, 1, 's-preto'), linha('k2', 'c1', 'S', 3, 1, 's-azul'), linha('k3', 'c2', 'S', 1, 1, 's-azul')]
    const r = montarPreviaSubstituicao({ deItemId: 'S', deVariacaoId: 's-preto', paraItemId: 'S', paraVariacaoId: 's-azul' }, kit, contratos)
    expect(r.contratos).toBe(1)
    expect(r.linhas[0]).toMatchObject({ contratoId: 'c1', quantidadeOrigem: 2, quantidadeNova: 5, soma: true })
  })
})

describe('cadeia de substituição', () => {
  const vinculos: VinculoSubstituicao[] = [
    { item_id: 'X', variacao_id: null, substituido_por_id: 'Y', substituido_por_variacao_id: null },
    { item_id: 'Y', variacao_id: null, substituido_por_id: 'W', substituido_por_variacao_id: null },
  ]

  it('resolve X→Y→W', () => {
    const mapa = mapaSubstituicoes(vinculos)
    expect(resolverSubstituto('X', null, mapa)).toEqual({ item_id: 'W', variacao_id: null })
    expect(resolverSubstituto('W', null, mapa)).toEqual({ item_id: 'W', variacao_id: null })
  })

  it('ciclo gravado por engano não trava (para no último elo novo)', () => {
    const mapa = mapaSubstituicoes([
      { item_id: 'X', variacao_id: null, substituido_por_id: 'Y', substituido_por_variacao_id: null },
      { item_id: 'Y', variacao_id: null, substituido_por_id: 'X', substituido_por_variacao_id: null },
    ])
    expect(resolverSubstituto('X', null, mapa)).toEqual({ item_id: 'Y', variacao_id: null })
  })

  it('vínculo da variação vale antes do vínculo do item; item inteiro leva para a variação do destino', () => {
    const mapa = mapaSubstituicoes([
      { item_id: 'S', variacao_id: 's-preto', substituido_por_id: 'S', substituido_por_variacao_id: 's-azul' },
      { item_id: 'X', variacao_id: null, substituido_por_id: 'S', substituido_por_variacao_id: 's-preto' },
    ])
    // X → S:preto → S:azul
    expect(resolverSubstituto('X', null, mapa)).toEqual({ item_id: 'S', variacao_id: 's-azul' })
    // outra variação de S não foi substituída
    expect(resolverSubstituto('S', 's-velha', mapa)).toEqual({ item_id: 'S', variacao_id: 's-velha' })
  })

  it('criariaCiclo detecta destino que já leva à origem', () => {
    expect(criariaCiclo({ deItemId: 'W', deVariacaoId: null, paraItemId: 'X', paraVariacaoId: null }, vinculos)).toBe(true)
    expect(criariaCiclo({ deItemId: 'X', deVariacaoId: null, paraItemId: 'W', paraVariacaoId: null }, vinculos)).toBe(false)
  })

  it('a média do item novo soma o histórico dos itens que ele substituiu (sem mexer no original)', () => {
    const consumos = [
      { competencia: '2026-07-01', item_id: 'X', variacao_id: null, quantidade: 6 },
      { competencia: '2026-08-01', item_id: 'Y', variacao_id: null, quantidade: 6 },
      { competencia: '2026-09-01', item_id: 'W', variacao_id: null, quantidade: 6 },
    ]
    const remapeado = aplicarSubstituicoes(consumos, vinculos)
    expect(consumos[0].item_id).toBe('X') // original intacto
    const media = mediaConsumo(remapeado, [], '2026-10-14', 6).quantidadePorItem
    expect(media['W|']).toBe(3) // 18 / 6 meses
    expect(media['X|']).toBeUndefined()
    // sem vínculo (opção "levar histórico" desmarcada): nada muda
    expect(aplicarSubstituicoes(consumos, [])).toBe(consumos)
  })

  it('painel: média em R$ do contrato usa o histórico do item antigo ao preço do novo', () => {
    const base = {
      contratos: [{ id: 'c1', nome: 'Alfa', ativo: true }],
      pedidosDoMes: [],
      itensDoMes: [],
      kits: [{ contrato_id: 'c1', item_id: 'Y', variacao_id: null, quantidade: 1 }],
      precos: [{ item_id: 'Y', variacao_id: null, preco: 10, vigente_desde: '2026-01-01', created_at: '1' }],
      historico: [{ contrato_id: 'c1', competencia: '2026-09-01', item_id: 'X', variacao_id: null, quantidade: 6 }],
      pedidosAnteriores: [],
      itensAnteriores: [],
      hoje: '2026-10-14',
    }
    expect(montarPainel(base)[0].media6).toBe(0) // X sem preço: fora do valor
    expect(montarPainel({ ...base, substituicoes: vinculos.slice(0, 1) })[0].media6).toBe(10) // 6 × 10 / 6
  })
})
