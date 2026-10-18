import { describe, expect, it } from 'vitest'
import type { CeuPedidoItem, MatPedidoItem } from '@/types/materiais'
import {
  fonteDaTabela,
  linhasCartaCeu,
  linhasCartaProdutos,
  montarCarta,
  nomeArquivoCarta,
  nomesUnicos,
  quantidadeFinalProduto,
} from './cartaLider'
import { crc32, montarZip } from './zipSimples'

const linha = (p: Partial<MatPedidoItem>): MatPedidoItem => ({
  id: 'l',
  pedido_id: 'p',
  envio_id: null,
  possivel_repeticao: false,
  repete_linha_id: null,
  decisao_repeticao: null,
  item_id: 'i',
  variacao_id: null,
  descricao_livre: null,
  qtd_kit: null,
  qtd_pedida: 3,
  qtd_validada: 3,
  qtd_aprovada: 3,
  qtd_entregue: null,
  preco_unitario: 10,
  justificativa: null,
  excecao_acima_kit: false,
  excecao_validade: false,
  excecao_fora_kit: false,
  ultima_entrega_em: null,
  motivo_ajuste: null,
  ajustado_por: null,
  ajustado_em: null,
  parte: 'extra',
  ...p,
})
const nomes = { descricao: () => 'Cloro 5L', unidade: () => 'bombona 5L', original: () => 'Cloro 1L' }

describe('quantidadeFinalProduto', () => {
  it('pendente, aprovado, compra planejada, entregue e não atendido', () => {
    expect(quantidadeFinalProduto(linha({ qtd_aprovada: null }))).toBeNull()
    expect(quantidadeFinalProduto(linha({}))).toBe(3)
    expect(quantidadeFinalProduto(linha({ atendimento: 'fornecedor', qtd_compra: 2 }))).toBe(2)
    expect(quantidadeFinalProduto(linha({ atendimento: 'fornecedor', qtd_compra: 3, qtd_recebida_fornecedor: 1, qtd_entregue: 1 }))).toBe(1)
    expect(quantidadeFinalProduto(linha({ atendimento: 'escritorio' }))).toBe(3)
    expect(quantidadeFinalProduto(linha({ atendimento: 'nao_atendido', motivo_nao_atendido: 'x' }))).toBe(0)
  })
})

describe('linhasCartaProdutos', () => {
  it('atendido integral sem observação, com unidade no plural', () => {
    const [l] = linhasCartaProdutos([linha({ parte: 'kit' })], nomes)
    expect(l).toMatchObject({ secao: 'kit', descricao: 'Cloro 5L', vamosEnviar: '3 bombonas 5L', observacao: '', situacao: 'atendido' })
  })
  it('corte do inspetor/gestor traz o motivo', () => {
    const [l] = linhasCartaProdutos([linha({ qtd_aprovada: 1, motivo_ajuste: 'Acima da média do posto' })], nomes)
    expect(l).toMatchObject({ situacao: 'parcial', vamosEnviar: '1 bombona 5L', observacao: 'Acima da média do posto' })
  })
  it('não atendido na compra e entrega menor na chegada', () => {
    const [a, b] = linhasCartaProdutos(
      [
        linha({ id: 'a', atendimento: 'nao_atendido', motivo_nao_atendido: 'Fornecedor sem estoque' }),
        linha({ id: 'b', atendimento: 'fornecedor', qtd_compra: 3, qtd_recebida_fornecedor: 2, qtd_entregue: 2, motivo_entrega: 'Faltou no caminhão' }),
      ],
      nomes
    )
    expect(a).toMatchObject({ situacao: 'nao_atendido', vamosEnviar: '0 bombonas 5L', observacao: 'Fornecedor sem estoque' })
    expect(b).toMatchObject({ situacao: 'parcial', observacao: 'Faltou no caminhão' })
  })
  it('em análise, repetição descartada, troca de item e incluído pelo escritório', () => {
    const r = linhasCartaProdutos(
      [
        linha({ id: 'p', qtd_aprovada: null }),
        linha({ id: 'r', qtd_aprovada: 0, decisao_repeticao: 'descartar', motivo_ajuste: 'repetição' }),
        linha({ id: 't', parte: 'kit', item_original_id: 'x', motivo_ajuste: 'Trocado pela marca do contrato' }),
        linha({ id: 'i', qtd_pedida: 2, qtd_aprovada: 2, incluido_em: '2026-10-18T10:00:00Z' }),
      ],
      nomes
    )
    expect(r[0]).toMatchObject({ situacao: 'em_analise', vamosEnviar: '—' })
    expect(r[1]).toMatchObject({ situacao: 'nao_atendido' })
    expect(r[1].observacao).toContain('repetido')
    expect(r[2].observacao).toBe('Trocado de Cloro 1L')
    expect(r[3]).toMatchObject({ pediu: '—', situacao: 'atendido', observacao: 'Incluído pelo escritório' })
  })
  it('linha que o líder tirou do kit não aparece; texto livre usa o texto do líder', () => {
    const r = linhasCartaProdutos(
      [linha({ parte: 'kit', qtd_pedida: 0, qtd_aprovada: 0 }), linha({ id: 'txt', item_id: null, descricao_livre: 'Vassoura gari', qtd_aprovada: null })],
      nomes
    )
    expect(r).toHaveLength(1)
    expect(r[0].descricao).toBe('Vassoura gari')
  })
  it('corte sem motivo gravado mostra "Ajustado pelo escritório"', () => {
    const [l] = linhasCartaProdutos([linha({ qtd_aprovada: 2 })], nomes)
    expect(l.observacao).toBe('Ajustado pelo escritório')
  })
})

const ceu = (p: Partial<CeuPedidoItem>): CeuPedidoItem => ({
  id: 'c',
  pedido_id: 'p',
  envio_id: null,
  possivel_repeticao: false,
  nome_digitado: 'Michelle',
  colaborador_id: 'col',
  identificado_por: null,
  identificado_em: null,
  fora_da_equipe: false,
  tipo: 'uniforme',
  item_id: 'it',
  tamanho: 'G',
  tamanho_cadastro: null,
  qtd_pedida: 2,
  qtd_conferida: null,
  alerta_tamanho: false,
  ultima_entrega_em: null,
  cracha_nome: null,
  cracha_motivo: null,
  cracha_cordao: null,
  status: 'conferido',
  conferido_por: null,
  conferido_em: null,
  atendido_por: null,
  atendido_em: null,
  motivo_ajuste: null,
  ...p,
})
const nomesCeu = { peca: () => 'Camisa polo azul', pessoa: () => 'Michelle A.' }

describe('linhasCartaCeu', () => {
  it('uniforme conferido, atendido em parte, cancelado e a identificar', () => {
    const r = linhasCartaCeu(
      [
        ceu({}),
        ceu({ id: 'b', status: 'atendido', qtd_conferida: 2, qtd_atendida: 1, motivo_atendimento: 'Sem o tamanho G' }),
        ceu({ id: 'c', status: 'cancelado', motivo_ajuste: 'Entregue no mês passado' }),
        ceu({ id: 'd', status: 'a_identificar' }),
      ],
      nomesCeu
    )
    expect(r[0]).toMatchObject({ secao: 'uniforme', descricao: 'Camisa polo azul G — Michelle A.', vamosEnviar: '2', situacao: 'atendido' })
    expect(r[1]).toMatchObject({ situacao: 'parcial', vamosEnviar: '1', observacao: 'Sem o tamanho G' })
    expect(r[2]).toMatchObject({ situacao: 'nao_atendido', observacao: 'Entregue no mês passado' })
    expect(r[3].situacao).toBe('em_analise')
  })
  it('crachá com o motivo e sem nome completo', () => {
    const [l] = linhasCartaCeu([ceu({ tipo: 'cracha', item_id: null, cracha_motivo: 'perda', qtd_pedida: 1 })], nomesCeu)
    expect(l.descricao).toBe('Crachá — Michelle A. (perda)')
  })
})

describe('montarCarta e utilitários', () => {
  it('ordena por seção e marca "em análise"', () => {
    const c = montarCarta({
      contratoId: 'c',
      contratoNome: 'Vila de Cascais',
      competencia: '2026-10-01',
      responsavel: 'Ana S.',
      produtos: linhasCartaProdutos([linha({ id: 'e' }), linha({ id: 'k', parte: 'kit', qtd_aprovada: null })], nomes),
      ceu: linhasCartaCeu([ceu({})], nomesCeu),
    })
    expect(c.linhas.map((l) => l.secao)).toEqual(['kit', 'extra', 'uniforme'])
    expect(c.emAnalise).toBe(true)
  })
  it('nunca leva preço para a carta', () => {
    const r = linhasCartaProdutos([linha({ preco_unitario: 123.45 })], nomes)
    expect(JSON.stringify(r)).not.toContain('123')
  })
  it('nome de arquivo sem acento/espaço e únicos no zip', () => {
    expect(nomeArquivoCarta('Chácara do Itaguaí', '2026-10-01')).toBe('carta-lider_chacara-do-itaguai_2026-10.pdf')
    expect(nomesUnicos(['a.pdf', 'A.pdf', 'b.pdf'])).toEqual(['a.pdf', 'A_2.pdf', 'b.pdf'])
  })
  it('fonte reduz com o número de linhas (cabe em 1 página)', () => {
    expect(fonteDaTabela(10)).toBeGreaterThan(fonteDaTabela(30))
    expect(fonteDaTabela(60)).toBe(6)
  })
})

describe('zipSimples', () => {
  it('CRC32 de referência', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926')
  })
  it('assinaturas do zip e quantidade de arquivos', () => {
    const z = montarZip([
      { nome: 'a.pdf', dados: new Uint8Array([1, 2, 3]) },
      { nome: 'b.pdf', dados: new Uint8Array([4]) },
    ])
    const v = new DataView(z.buffer)
    expect(v.getUint32(0, true)).toBe(0x04034b50)
    const fim = z.length - 22
    expect(v.getUint32(fim, true)).toBe(0x06054b50)
    expect(v.getUint16(fim + 10, true)).toBe(2)
  })
})
