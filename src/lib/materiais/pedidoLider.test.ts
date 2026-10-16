import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  excecoesLinhaPedido,
  janelaPublica,
  linhaCeuVazia,
  perguntaMotivo,
  qtdKitDoMes,
  linhasIniciaisDoKit,
  montarResumoMes,
  secoesUsadas,
  textoDestino,
  tituloResumo,
  validarEnvioPedido,
  type ContextoPedido,
} from './pedidoLider'
import { htmlCartazQr, svgQrPedido } from './qrPedido'

const ctx: ContextoPedido = {
  hoje: '2026-10-09',
  recebeLimpeza: true,
  catalogo: [
    { id: 'cloro', nome: 'Cloro', categoria: 'limpeza', unidade: 'bombona 5L', validade_meses: null, variacoes: [] },
    { id: 'balde', nome: 'Balde 8L', categoria: 'limpeza', unidade: 'unidade', validade_meses: 6, variacoes: [] },
    {
      id: 'rodo',
      nome: 'Rodo',
      categoria: 'limpeza',
      unidade: 'unidade',
      validade_meses: null,
      variacoes: [
        { id: 'r45', rotulo: '45 cm' },
        { id: 'r55', rotulo: '55 cm' },
      ],
    },
    { id: 'livro', nome: 'Livro de Ocorrências', categoria: 'portaria', unidade: 'unidade', validade_meses: null, variacoes: [] },
  ],
  kit: [
    { item_id: 'cloro', variacao_id: null, quantidade: 3, periodicidade_meses: 1 },
    { item_id: 'balde', variacao_id: null, quantidade: 1, periodicidade_meses: 1 },
    { item_id: 'rodo', variacao_id: 'r45', quantidade: 2, periodicidade_meses: 1 },
    { item_id: 'livro', variacao_id: null, quantidade: 1, periodicidade_meses: 2 },
  ],
  itensCeu: [
    { id: 'camisa', nome: 'Camisa polo azul', tipo: 'uniforme' },
    { id: 'luva', nome: 'Luva látex amarela', tipo: 'epi' },
  ],
  ultimasEntregas: { balde: '2026-07-01', livro: '2026-09-01' },
}

const termosTodos = { materiais: true, uniforme: true, epi: true, cracha: true, portaria: true }

describe('janelaPublica', () => {
  it('aberta do dia 1 ao dia limite; fora disso só com reabertura vigente', () => {
    expect(janelaPublica('2026-10-15').aberta).toBe(true)
    expect(janelaPublica('2026-10-16').aberta).toBe(false)
    expect(janelaPublica('2026-10-16', 15, '2026-10-20')).toMatchObject({ aberta: true, reaberta: true })
    expect(janelaPublica('2026-10-21', 15, '2026-10-20').aberta).toBe(false)
    expect(janelaPublica('2026-10-09').prazo).toBe('2026-10-15')
  })
})

describe('linhasIniciaisDoKit', () => {
  it('abre com o kit; item a cada 2 meses entregue no mês anterior começa em 0', () => {
    const linhas = linhasIniciaisDoKit(ctx)
    expect(linhas.find((l) => l.item_id === 'cloro')?.quantidade).toBe(3)
    expect(linhas.find((l) => l.item_id === 'livro')?.quantidade).toBe(0)
    expect(linhas.find((l) => l.item_id === 'rodo')?.variacao_id).toBe('r45')
  })

  it('contrato sem limpeza só recebe o kit portaria', () => {
    const linhas = linhasIniciaisDoKit({ ...ctx, recebeLimpeza: false })
    expect(linhas.map((l) => l.item_id)).toEqual(['livro'])
  })
})

describe('validarEnvioPedido', () => {
  const base = { seu_nome: 'Ana Souza', termos: termosTodos }

  it('aceita o kit sem motivo e devolve as linhas para a RPC marcadas como kit', () => {
    const r = validarEnvioPedido({ ...base, produtos: [{ item_id: 'cloro', quantidade: 3, parte: 'kit' }] }, ctx)
    expect(r.ok).toBe(true)
    expect(r.produtos[0]).toMatchObject({ parte: 'kit', item_id: 'cloro', qtd_kit: 3, qtd_pedida: 3, excecao_acima_kit: false })
  })

  it('kit só diminui: o que passar do kit do mês vira linha EXTRA separada (cliente antigo, sem parte, idem)', () => {
    for (const parte of ['kit', undefined]) {
      const r = validarEnvioPedido({ ...base, produtos: [{ item_id: 'cloro', quantidade: 5, parte }] }, ctx)
      expect(r.ok).toBe(true)
      expect(r.produtos).toEqual([
        expect.objectContaining({ parte: 'kit', item_id: 'cloro', qtd_pedida: 3, qtd_kit: 3, excecao_acima_kit: false }),
        expect.objectContaining({ parte: 'extra', item_id: 'cloro', qtd_pedida: 2, qtd_kit: 3, excecao_acima_kit: true }),
      ])
    }
  })

  it('pedido extra: motivo OPCIONAL (decisão de 16/10/2026); validade vira só aviso interno', () => {
    const r = validarEnvioPedido(
      {
        ...base,
        produtos: [
          { item_id: 'cloro', quantidade: 3, parte: 'kit' },
          { item_id: 'cloro', quantidade: 2, parte: 'extra' },
          { item_id: 'balde', quantidade: 1, parte: 'kit' },
          { descricao_livre: 'Pá de lixo', quantidade: 1, parte: 'extra' },
        ],
      },
      ctx
    )
    expect(r.ok).toBe(true)
    expect(r.produtos.find((p) => p.item_id === 'cloro' && p.parte === 'extra')).toMatchObject({
      qtd_pedida: 2,
      excecao_acima_kit: true,
      justificativa: null,
    })
    // Balde no kit e ainda na validade: segue como KIT, só com o aviso interno.
    expect(r.produtos.find((p) => p.item_id === 'balde')).toMatchObject({ parte: 'kit', excecao_validade: true, ultima_entrega_em: '2026-07-01' })
    expect(r.produtos.find((p) => p.descricao_livre === 'Pá de lixo')).toMatchObject({ parte: 'extra', excecao_fora_kit: true, justificativa: null })
    const comMotivo = validarEnvioPedido(
      { ...base, produtos: [{ item_id: 'cloro', quantidade: 2, parte: 'extra', justificativa: 'Obra no prédio' }] },
      ctx
    )
    expect(comMotivo.produtos[0]).toMatchObject({ parte: 'extra', justificativa: 'Obra no prédio' })
  })

  it('"Não preciso este mês": linha do kit com 0 é registrada; kit inteiro zerado é envio válido e não pede declaração', () => {
    const r = validarEnvioPedido(
      {
        seu_nome: 'Ana',
        termos: {},
        produtos: [
          { item_id: 'cloro', quantidade: 0, parte: 'kit' },
          { item_id: 'balde', quantidade: 0, parte: 'kit' },
        ],
      },
      ctx
    )
    expect(r.ok).toBe(true)
    expect(r.produtos).toEqual([
      expect.objectContaining({ parte: 'kit', item_id: 'cloro', qtd_pedida: 0, qtd_kit: 3 }),
      expect.objectContaining({ parte: 'kit', item_id: 'balde', qtd_pedida: 0, qtd_kit: 1, excecao_validade: false }),
    ])
    expect(secoesUsadas(r.produtos, [], ctx.catalogo)).toEqual([])
    // Extra com 0 é ignorado.
    expect(validarEnvioPedido({ ...base, produtos: [{ item_id: 'cloro', quantidade: 0, parte: 'extra' }] }, ctx).erros.join(' ')).toMatch(/vazio/)
  })

  it('kit já confirmado no mês: tudo vira extra; item que não vem este mês (periodicidade) também', () => {
    const r = validarEnvioPedido({ ...base, produtos: [{ item_id: 'cloro', quantidade: 3, parte: 'kit' }] }, { ...ctx, kitConfirmado: true })
    expect(r.produtos).toEqual([expect.objectContaining({ parte: 'extra', qtd_pedida: 3, qtd_kit: 3, excecao_acima_kit: true })])
    expect(qtdKitDoMes(ctx, 'livro', null)).toBe(0)
    const livro = validarEnvioPedido({ ...base, produtos: [{ item_id: 'livro', quantidade: 1, parte: 'kit' }] }, ctx)
    expect(livro.produtos).toEqual([
      expect.objectContaining({ parte: 'extra', item_id: 'livro', qtd_pedida: 1, qtd_kit: 0, excecao_acima_kit: true }),
    ])
  })

  it('soma linhas repetidas do mesmo item/variação e aplica o teto (kit + extra)', () => {
    const r = validarEnvioPedido(
      {
        ...base,
        produtos: [
          { item_id: 'cloro', quantidade: 2, parte: 'kit' },
          { item_id: 'cloro', quantidade: 1, parte: 'kit' },
        ],
      },
      ctx
    )
    expect(r.ok).toBe(true)
    expect(r.produtos).toHaveLength(1)
    expect(r.produtos[0].qtd_pedida).toBe(3)
    const teto = validarEnvioPedido(
      {
        ...base,
        produtos: [
          { item_id: 'cloro', quantidade: 3, parte: 'kit' },
          { item_id: 'cloro', quantidade: 28, parte: 'extra' },
        ],
      },
      ctx
    )
    expect(teto.erros.join(' ')).toMatch(/acima do permitido \(30\)/)
  })

  it('item com variação exige escolher a opção; variação de outro item é recusada', () => {
    const ctxSemBase = { ...ctx, kit: ctx.kit.filter((k) => k.item_id !== 'rodo') }
    expect(validarEnvioPedido({ ...base, produtos: [{ item_id: 'rodo', quantidade: 1, justificativa: 'x' }] }, ctxSemBase).erros[0]).toMatch(
      /escolha a opção/
    )
    expect(validarEnvioPedido({ ...base, produtos: [{ item_id: 'rodo', variacao_id: 'zzz', quantidade: 1 }] }, ctx).ok).toBe(false)
  })

  it('contrato sem limpeza: produto de limpeza vira ERRO na linha e não é enviado (texto livre vale como portaria)', () => {
    const entrada = {
      ...base,
      produtos: [
        { chave: 'l1', item_id: 'cloro', quantidade: 3 },
        { chave: 'l2', descricao_livre: 'Algo', quantidade: 1, parte: 'extra' },
        { chave: 'l3', item_id: 'livro', quantidade: 1 },
      ],
    }
    const r = validarEnvioPedido(entrada, { ...ctx, recebeLimpeza: false })
    // O cloro NÃO some em silêncio: erro de campo na linha e a linha não vai no envio.
    expect(r.ok).toBe(false)
    expect(r.produtos.map((p) => p.item_id)).toEqual(['livro', null])
    expect(r.errosCampo).toEqual([
      { chave: 'l1', campo: 'geral', mensagem: 'Cloro: este posto recebe apenas material de portaria.' },
    ])
    // Em contrato que recebe limpeza, a mesma linha passa.
    const comLimpeza = validarEnvioPedido(entrada, ctx)
    expect(comLimpeza.ok).toBe(true)
    expect(comLimpeza.produtos.map((p) => p.item_id)).toEqual(['cloro', 'livro', null])
  })

  it('exige seu nome, a declaração de cada seção usada e pedido não vazio', () => {
    expect(validarEnvioPedido({ termos: termosTodos, produtos: [{ item_id: 'cloro', quantidade: 3 }] }, ctx).erros).toContain(
      'Informe o seu nome.'
    )
    expect(validarEnvioPedido({ ...base, produtos: [] }, ctx).erros.join(' ')).toMatch(/vazio/)
    const semTermo = validarEnvioPedido(
      { seu_nome: 'Ana', termos: { materiais: true }, produtos: [{ item_id: 'cloro', quantidade: 3 }], ceu: [{ tipo: 'cracha', cracha_nome: 'Ana S', cracha_motivo: 'Perda' }] },
      ctx
    )
    expect(semTermo.erros.join(' ')).toMatch(/declaração/)
    // Seção não usada não exige declaração.
    expect(validarEnvioPedido({ seu_nome: 'Ana', termos: { materiais: true }, produtos: [{ item_id: 'cloro', quantidade: 3 }] }, ctx).ok).toBe(true)
  })

  it('uniforme/EPI: nome, peça do tipo certo e quantidade 1–20; crachá com motivo da lista', () => {
    const r = validarEnvioPedido(
      {
        ...base,
        ceu: [
          { tipo: 'uniforme', nome_digitado: 'Maria', item_id: 'camisa', tamanho: 'M', quantidade: 2 },
          { tipo: 'epi', nome_digitado: 'João', item_id: 'camisa', quantidade: 1 },
          { tipo: 'uniforme', nome_digitado: '', item_id: 'camisa', quantidade: 30 },
          { tipo: 'cracha', cracha_nome: 'Maria Silva', cracha_motivo: 'Perda', cracha_cordao: true },
          { tipo: 'cracha', cracha_nome: 'José', cracha_motivo: 'Inventado' },
        ],
      },
      ctx
    )
    expect(r.ok).toBe(false)
    const erros = r.erros.join(' | ')
    expect(erros).toMatch(/Uniforme\/EPI 2: escolha a peça/)
    expect(erros).toMatch(/Uniforme\/EPI 3: escolha para quem é/)
    expect(erros).toMatch(/Uniforme\/EPI 3: quantidade deve ser de 1 a 20/)
    expect(erros).toMatch(/Crachá 5: escolha o motivo/)
    expect(r.ceu[0]).toMatchObject({ tipo: 'uniforme', item_id: 'camisa', tamanho: 'M', qtd_pedida: 2 })
    // Crachá: o nome do crachá também é o nome digitado (identificação interna).
    expect(r.ceu[3]).toMatchObject({ nome_digitado: 'Maria Silva', cracha_nome: 'Maria Silva', cracha_cordao: true, item_id: null })
  })
})

describe('secoesUsadas', () => {
  it('separa materiais de portaria e lista as seções do CEU', () => {
    expect(
      secoesUsadas([{ item_id: 'cloro' }, { item_id: 'livro' }, { item_id: null }], [{ tipo: 'cracha' }, { tipo: 'epi' }], ctx.catalogo)
    ).toEqual(['materiais', 'epi', 'cracha', 'portaria'])
  })
})

describe('resumo do mês', () => {
  const resumo = montarResumoMes(
    [
      { tipo_pedido: 'mensal', origem: 'complemento', seu_nome: 'Bia', enviado_em: '2026-10-05T15:00:00Z' },
      { tipo_pedido: 'mensal', origem: 'original', seu_nome: 'Ana', enviado_em: '2026-10-03T02:30:00Z' },
    ],
    [
      { item_id: 'cloro', variacao_id: null, descricao_livre: null, qtd_pedida: 3 },
      { item_id: 'cloro', variacao_id: null, descricao_livre: null, qtd_pedida: 1 },
      { item_id: 'rodo', variacao_id: 'r45', descricao_livre: null, qtd_pedida: 2 },
    ],
    [{ tipo: 'uniforme' }, { tipo: 'epi' }, { tipo: 'cracha' }],
    { itens: { cloro: { nome: 'Cloro', unidade: 'bombona 5L' }, rodo: { nome: 'Rodo', unidade: 'unidade' } }, variacoes: { r45: '45 cm' } }
  )

  it('soma os produtos e só CONTA uniforme/EPI/crachá (sem nomes)', () => {
    expect(resumo.produtos).toEqual([
      { descricao: 'Cloro', unidade: 'bombona 5L', quantidade: 4 },
      { descricao: 'Rodo (45 cm)', unidade: 'unidade', quantidade: 2 },
    ])
    expect(resumo.contagem).toEqual({ uniforme_epi: 2, cracha: 1 })
    expect(JSON.stringify(resumo)).not.toMatch(/nome_digitado|tamanho/)
  })

  it('título usa o 1º envio no horário de Brasília', () => {
    // 03/10 02:30 UTC = 02/10 23:30 em Brasília
    expect(tituloResumo(resumo, '2026-10-01')).toBe('Pedido de outubro enviado em 02/10 por Ana')
    expect(tituloResumo({ envios: [], produtos: [], contagem: { uniforme_epi: 0, cracha: 0 } }, '2026-10-01')).toBeNull()
  })

  it('aviso do destino do próximo envio', () => {
    expect(textoDestino({ produtos: 'novo', ceu: 'novo' })).toBeNull()
    expect(textoDestino({ produtos: 'mesclar', ceu: 'mesclar' })).toMatch(/somado/)
    expect(textoDestino({ produtos: 'extra', ceu: 'mesclar' })).toMatch(/produtos viram pedido extra/)
  })
})

describe('QR do link', () => {
  it('gera SVG e escapa o nome do contrato no cartaz', () => {
    expect(svgQrPedido('https://plena-corh.netlify.app/pedido/abc')).toMatch(/^<svg/)
    const html = htmlCartazQr('Posto <A & B>', 'https://x/pedido/abc')
    expect(html).toContain('Posto &lt;A &amp; B&gt;')
    expect(html).not.toContain('<A & B>')
  })
})

describe('cópia na Edge Function', () => {
  const raiz = resolve(__dirname, '../../..')
  const fn = readFileSync(resolve(raiz, 'supabase/functions/pedido-materiais/index.ts'), 'utf8').replace(/\r\n/g, '\n')
  // Mesmo tratamento de scripts/sincronizar-pedido-materiais.mjs (sem as linhas de import).
  const copiado = (arq: string) =>
    readFileSync(resolve(raiz, arq), 'utf8')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((l) => !/^import\s.*\sfrom\s+['"][^'"]+['"]\s*;?\s*$/.test(l))
      .join('\n')
      .trimEnd()
  it.each(['src/lib/materiais/pecasCeu.ts', 'src/lib/materiais/buscaItens.ts', 'src/lib/materiais/pedidoLider.ts', 'src/lib/departamentos.ts'])(
    'a function contém %s idêntico (rode node scripts/sincronizar-pedido-materiais.mjs)',
    (arq) => {
      expect(fn.includes(`// >>> LÓGICA PURA: ${arq} (cópia — não editar aqui)\n` + copiado(arq) + `\n// <<< FIM: ${arq}`)).toBe(true)
    }
  )
  it('carregar não devolve o catálogo inteiro nem dados pessoais além do nome curto', () => {
    const carregar = fn.slice(fn.indexOf('async function acaoCarregar'), fn.indexOf('async function acaoBuscarItem'))
    expect(carregar).toMatch(/catalogo: itensDoKit/)
    expect(carregar).not.toMatch(/nome_completo|cpf|matricula|foto_path|tamanho_/)
    expect(fn).toMatch(/case 'buscar_item'/)
  })
})

describe('linhas de uniforme/EPI/crachá vazias e equipe', () => {
  const pecas = [
    {
      id: 'uniforme:camisa',
      rotulo: 'Camisa polo azul',
      tipo: 'uniforme' as const,
      funcoes: [],
      opcoes: [
        { tamanho: 'P', item_id: 'camisa' },
        { tamanho: 'M', item_id: 'camisa' },
      ],
    },
    { id: 'epi:luva', rotulo: 'Luva látex', tipo: 'epi' as const, funcoes: [], opcoes: [{ tamanho: 'M', item_id: 'luva' }] },
  ]
  const ctxEquipe: ContextoPedido = {
    ...ctx,
    pecas,
    equipe: [
      { ref: 'refAAAAAAAAA', nome: 'Michelle A.', funcao: 'asg' },
      { ref: 'refBBBBBBBBB', nome: 'João S.', funcao: 'portaria' },
    ],
  }
  const base = { seu_nome: 'Ana Souza', termos: termosTodos }

  it('linhas de colaboradores 3 e 4 sem peça/tamanho são ignoradas (nem erro, nem pendência)', () => {
    const r = validarEnvioPedido(
      {
        ...base,
        ceu: [
          { chave: 'c1', tipo: 'uniforme', colaborador_ref: 'refAAAAAAAAA', item_id: 'camisa', tamanho: 'M', quantidade: 1 },
          { chave: 'c2', tipo: 'epi', colaborador_ref: 'refBBBBBBBBB', item_id: 'luva', tamanho: 'M', quantidade: 2 },
          { chave: 'c3', tipo: 'uniforme', nome_digitado: '', item_id: '', tamanho: '', quantidade: '1' },
          { chave: 'c4', tipo: 'epi', colaborador_ref: 'refAAAAAAAAA', item_id: '', tamanho: '', quantidade: '1' },
          { chave: 'c5', tipo: 'cracha', nome_digitado: '', cracha_nome: '', cracha_motivo: '', quantidade: 1 },
        ],
      },
      ctxEquipe
    )
    expect(r.erros).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.ceu).toHaveLength(2)
    expect(linhaCeuVazia({ tipo: 'uniforme', item_id: '', tamanho: '' })).toBe(true)
    expect(linhaCeuVazia({ tipo: 'uniforme', item_id: 'camisa' })).toBe(false)
  })

  it('pessoa da equipe vira nome curto + ref; ref desconhecido pede recarga; tamanho fora da peça é recusado', () => {
    const r = validarEnvioPedido(
      {
        ...base,
        ceu: [
          { chave: 'a', tipo: 'uniforme', colaborador_ref: 'refAAAAAAAAA', nome_digitado: 'Tentativa de outro nome', item_id: 'camisa', tamanho: 'M' },
          { chave: 'b', tipo: 'uniforme', colaborador_ref: 'refZZZZZZZZZ', item_id: 'camisa', tamanho: 'M' },
          { chave: 'c', tipo: 'uniforme', nome_digitado: 'Carla (ferista)', item_id: 'camisa', tamanho: 'GG' },
          { chave: 'd', tipo: 'uniforme', nome_digitado: 'Carla (ferista)', item_id: 'camisa', tamanho: '' },
        ],
      },
      ctxEquipe
    )
    expect(r.ceu[0]).toMatchObject({ colaborador_ref: 'refAAAAAAAAA', nome_digitado: 'Michelle A.' })
    expect(r.errosCampo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ chave: 'b', campo: 'pessoa' }),
        expect.objectContaining({ chave: 'c', campo: 'tamanho' }),
        expect.objectContaining({ chave: 'd', campo: 'tamanho', mensagem: expect.stringMatching(/escolha o tamanho/) }),
      ])
    )
  })

  it('crachá de pessoa da equipe pode ir sem o nome do crachá; de outra pessoa usa o nome digitado', () => {
    const r = validarEnvioPedido(
      {
        ...base,
        ceu: [
          { tipo: 'cracha', colaborador_ref: 'refAAAAAAAAA', cracha_motivo: 'Perda', cracha_cordao: true },
          { tipo: 'cracha', nome_digitado: 'Carla Souza', cracha_motivo: 'Desgaste natural' },
        ],
      },
      ctxEquipe
    )
    expect(r.ok).toBe(true)
    expect(r.ceu[0]).toMatchObject({ colaborador_ref: 'refAAAAAAAAA', nome_digitado: 'Michelle A.', cracha_nome: null })
    expect(r.ceu[1]).toMatchObject({ colaborador_ref: null, nome_digitado: 'Carla Souza', cracha_nome: 'Carla Souza' })
  })

  it('erros ficam ligados à chave da linha (a tela apaga o aviso assim que o campo é corrigido)', () => {
    const errado = validarEnvioPedido({ ...base, produtos: [{ chave: 'p1', descricao_livre: '', quantidade: 2, parte: 'extra' }] }, ctx)
    expect(errado.errosCampo.filter((x) => x.chave === 'p1')).toEqual([expect.objectContaining({ chave: 'p1', campo: 'descricao' })])
    const certo = validarEnvioPedido({ ...base, produtos: [{ chave: 'p1', descricao_livre: 'Pá', quantidade: 2, parte: 'extra' }] }, ctx)
    expect(certo.errosCampo).toEqual([])
  })

  it('convite amigável (opcional) para o motivo do extra', () => {
    const acima = excecoesLinhaPedido(ctx, 'cloro', null, 3, 'extra')
    expect(acima).toMatchObject({ acimaKit: true, pedeMotivo: true })
    expect(perguntaMotivo(acima, 3)).toBe('Você está pedindo 3 a mais do que o kit. Se puder, conte para a gente o motivo.')
    expect(perguntaMotivo(excecoesLinhaPedido(ctx, 'livro-nao', null, 1, 'extra'), 1)).toMatch(/não está no kit/)
    const kit = excecoesLinhaPedido(ctx, 'cloro', null, 3, 'kit')
    expect(kit).toMatchObject({ pedeMotivo: false, acimaKit: false, qtdKit: 3 })
    expect(perguntaMotivo(kit, 3)).toBe('')
  })
})
