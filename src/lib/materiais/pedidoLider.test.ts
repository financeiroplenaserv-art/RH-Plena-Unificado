import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  janelaPublica,
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

  it('aceita o kit sem justificativa e devolve as linhas para a RPC', () => {
    const r = validarEnvioPedido({ ...base, produtos: [{ item_id: 'cloro', quantidade: 3 }] }, ctx)
    expect(r.ok).toBe(true)
    expect(r.produtos[0]).toMatchObject({ item_id: 'cloro', qtd_kit: 3, qtd_pedida: 3, excecao_acima_kit: false })
  })

  it('acima do kit, antes da validade e fora do kit exigem justificativa (o servidor recalcula)', () => {
    const r = validarEnvioPedido(
      {
        ...base,
        produtos: [
          { item_id: 'cloro', quantidade: 5, excecao_acima_kit: false },
          { item_id: 'balde', quantidade: 1 },
          { descricao_livre: 'Pá de lixo', quantidade: 1 },
        ],
      },
      ctx
    )
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toMatch(/Cloro: justifique \(acima do kit \(3\)\)/)
    expect(r.erros.join(' ')).toMatch(/Balde 8L: justifique \(antes da validade/)
    expect(r.erros.join(' ')).toMatch(/Pá de lixo: justifique/)
    const ok = validarEnvioPedido(
      {
        ...base,
        produtos: [
          { item_id: 'cloro', quantidade: 5, justificativa: 'Obra no prédio' },
          { item_id: 'balde', quantidade: 1, justificativa: 'Quebrou' },
          { descricao_livre: 'Pá de lixo', quantidade: 1, justificativa: 'Não temos' },
        ],
      },
      ctx
    )
    expect(ok.ok).toBe(true)
    expect(ok.produtos.find((p) => p.item_id === 'cloro')?.excecao_acima_kit).toBe(true)
    expect(ok.produtos.find((p) => p.item_id === 'balde')).toMatchObject({ excecao_validade: true, ultima_entrega_em: '2026-07-01' })
    expect(ok.produtos.find((p) => p.descricao_livre === 'Pá de lixo')?.excecao_fora_kit).toBe(true)
  })

  it('soma linhas repetidas do mesmo item/variação, ignora quantidade 0 e aplica o teto', () => {
    const r = validarEnvioPedido(
      {
        ...base,
        produtos: [
          { item_id: 'cloro', quantidade: 2 },
          { item_id: 'cloro', quantidade: 1 },
          { item_id: 'balde', quantidade: 0 },
        ],
      },
      ctx
    )
    expect(r.ok).toBe(true)
    expect(r.produtos).toHaveLength(1)
    expect(r.produtos[0].qtd_pedida).toBe(3)
    const teto = validarEnvioPedido({ ...base, produtos: [{ item_id: 'cloro', quantidade: 31, justificativa: 'x' }] }, ctx)
    expect(teto.erros.join(' ')).toMatch(/acima do permitido \(30\)/)
  })

  it('item com variação exige escolher a opção; variação de outro item é recusada', () => {
    const ctxSemBase = { ...ctx, kit: ctx.kit.filter((k) => k.item_id !== 'rodo') }
    expect(validarEnvioPedido({ ...base, produtos: [{ item_id: 'rodo', quantidade: 1, justificativa: 'x' }] }, ctxSemBase).erros[0]).toMatch(
      /escolha a variação/
    )
    expect(validarEnvioPedido({ ...base, produtos: [{ item_id: 'rodo', variacao_id: 'zzz', quantidade: 1 }] }, ctx).ok).toBe(false)
  })

  it('contrato sem limpeza ignora produtos que não são de portaria', () => {
    const r = validarEnvioPedido(
      {
        ...base,
        produtos: [
          { item_id: 'cloro', quantidade: 3 },
          { descricao_livre: 'Algo', quantidade: 1 },
          { item_id: 'livro', quantidade: 1 },
        ],
      },
      { ...ctx, recebeLimpeza: false }
    )
    expect(r.ok).toBe(true)
    expect(r.produtos.map((p) => p.item_id)).toEqual(['livro'])
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
    expect(erros).toMatch(/Uniforme\/EPI 3: informe o nome/)
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
  it('supabase/functions/pedido-materiais/index.ts contém a lógica pura idêntica (rode scripts/sincronizar-pedido-materiais.mjs)', () => {
    const raiz = resolve(__dirname, '../../..')
    const lib = readFileSync(resolve(raiz, 'src/lib/materiais/pedidoLider.ts'), 'utf8').replace(/\r\n/g, '\n').trimEnd()
    const fn = readFileSync(resolve(raiz, 'supabase/functions/pedido-materiais/index.ts'), 'utf8').replace(/\r\n/g, '\n')
    expect(fn.includes(lib)).toBe(true)
  })
})
