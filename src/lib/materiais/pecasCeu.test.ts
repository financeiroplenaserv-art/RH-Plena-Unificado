import { describe, expect, it } from 'vitest'
import { tamanhoDoNomeItem } from '@/lib/ceu/tamanhosPuro'
import {
  agruparItensEmPecas,
  chavePeca,
  funcaoDoCargo,
  idsEquipeDoContrato,
  itensDaMesmaPeca,
  tamanhoCadastroParaItem,
  tamanhosDivergemPeca,
  ultimaEntregaDaPeca,
  funcoesDoTexto,
  montarEquipePublica,
  nomeAmigavelPeca,
  nomesCurtos,
  opcoesDoGrupo,
  pecasDoContrato,
  pecasParaFuncao,
  ITENS_CEU_OCULTOS_LINK,
  separarTamanhoDoNome,
  type ItemCeuCadastro,
} from './pecasCeu'

// Nomes reais do cadastro `itens` (CEU) em 14/10/2026.
const NOMES_REAIS = [
  'BOTA PVC CANO CURTO 34 - Tam. 34',
  'BOTA PVC CANO CURTO 46 - Tam. 46',
  'BOTINA COM ELÁSTICO 40 - Tam. 40',
  'CAPA DE CHUVA G - Tam. G',
  'JALECO AZUL TECH GG - Tam. GG',
  'LUVA LÁTEX AMARELA G - Tam. G',
  'LUVA LÁTEX EG - Tam. EG',
  'LUVA LÁTEX M - Tam. M',
  'LUVA NITRÍLICA EXTRA EG - Tam. EG',
  'LUVA NITRÍLICA G - Tam. G',
  'LUVA TÉRMICA - Tam. 11',
  'LUVA VAQUETA 39 - Tam. 39',
  'CALÇA BRIM AZUL - Tam. GG',
  'CALÇA EM BRIM AZUL - Tam. G',
  'JALECO EM BRIM AZUL MANGA CURTA - Tam. GG',
  'JALECO MANGA CURTA EM BRIM AZUL - Tam. G',
  'CAMISA MALHA POLO AZUL CLARA - ASG',
  'CAMISA SOCIAL BRANCA',
  'MÁSCARA DESCARTÁVEL',
  'LUVA PVC',
]

const item = (id: string, nome: string, tipo: 'uniforme' | 'epi' = 'epi', ativo = true): ItemCeuCadastro => ({ id, nome, tipo, ativo })

describe('separarTamanhoDoNome', () => {
  it('tem o mesmo tamanho de tamanhoDoNomeItem (CEU) em todos os nomes reais', () => {
    for (const n of NOMES_REAIS) expect(separarTamanhoDoNome(n).tamanho).toBe(tamanhoDoNomeItem(n))
  })

  it('tira o tamanho do nome base', () => {
    expect(separarTamanhoDoNome('BOTA PVC CANO CURTO 38 - Tam. 38')).toEqual({ base: 'BOTA PVC CANO CURTO', tamanho: '38' })
    expect(separarTamanhoDoNome('LUVA LÁTEX M - Tam. M')).toEqual({ base: 'LUVA LÁTEX', tamanho: 'M' })
    expect(separarTamanhoDoNome('LUVA NITRÍLICA EXTRA EG - Tam. EG')).toEqual({ base: 'LUVA NITRÍLICA', tamanho: 'EG' })
    expect(separarTamanhoDoNome('CAMISA SOCIAL BRANCA')).toEqual({ base: 'CAMISA SOCIAL BRANCA', tamanho: null })
  })

  it('a chave ignora ordem das palavras e "em"/"de"', () => {
    expect(chavePeca('JALECO EM BRIM AZUL MANGA CURTA', 'uniforme')).toBe(chavePeca('JALECO MANGA CURTA EM BRIM AZUL', 'uniforme'))
    expect(chavePeca('CALÇA EM BRIM AZUL', 'uniforme')).toBe(chavePeca('CALÇA BRIM AZUL', 'uniforme'))
  })
})

describe('agrupamento em peças', () => {
  const itens = [
    item('b38', 'BOTA PVC CANO CURTO 38 - Tam. 38'),
    item('b40', 'BOTA PVC CANO CURTO 40 - Tam. 40'),
    item('b39', 'BOTA PVC CANO CURTO 39 - Tam. 39', 'epi', false),
    item('lm', 'LUVA LÁTEX M - Tam. M'),
    item('lp', 'LUVA LÁTEX P - Tam. P'),
    item('cam', 'CAMISA MALHA POLO AZUL CLARA - ASG', 'uniforme'),
    item('soc', 'CAMISA SOCIAL BRANCA', 'uniforme'),
    item('mas', 'MÁSCARA DESCARTÁVEL'),
  ]

  it('um item por tamanho vira uma peça com os tamanhos ATIVOS em ordem', () => {
    const grupos = agruparItensEmPecas(itens)
    const bota = [...grupos.values()].find((g) => g.base === 'BOTA PVC CANO CURTO')!
    expect(opcoesDoGrupo(bota)).toEqual([
      { tamanho: '38', item_id: 'b38' },
      { tamanho: '40', item_id: 'b40' },
    ])
    const luva = [...grupos.values()].find((g) => g.base === 'LUVA LÁTEX')!
    expect(opcoesDoGrupo(luva).map((o) => o.tamanho)).toEqual(['P', 'M'])
  })

  it('peça sem tamanho no cadastro: roupa ganha P a XXGG; EPI comum é tamanho único', () => {
    const grupos = [...agruparItensEmPecas(itens).values()]
    expect(opcoesDoGrupo(grupos.find((g) => g.base.startsWith('CAMISA MALHA'))!).map((o) => o.tamanho)).toEqual(['P', 'M', 'G', 'GG', 'XGG', 'XXGG'])
    expect(opcoesDoGrupo(grupos.find((g) => g.base.startsWith('MÁSCARA'))!)).toEqual([{ tamanho: '', item_id: 'mas' }])
  })

  it('kit do contrato: só as peças configuradas, com função e rótulo', () => {
    const { pecas, semKitUniforme } = pecasDoContrato(
      [
        { item_id: 'cam', rotulo: null, funcoes: ['asg'], ordem: 1, ativo: true },
        { item_id: 'b40', rotulo: 'Bota PVC cano curto', funcoes: [], ordem: 2, ativo: true },
        { item_id: 'b38', rotulo: null, funcoes: ['asg'], ordem: 3, ativo: true }, // mesma peça: une
        { item_id: 'soc', rotulo: null, funcoes: ['portaria'], ordem: 4, ativo: false },
      ],
      itens
    )
    expect(semKitUniforme).toBe(false)
    expect(pecas.map((p) => p.rotulo)).toEqual(['Camisa malha polo azul clara — ASG', 'Bota PVC cano curto'])
    expect(pecas[1].funcoes).toEqual([]) // vazio = todas
    expect(pecas[1].opcoes.map((o) => o.tamanho)).toEqual(['38', '40'])
  })

  it('sem kit de uniforme: todas as peças ativas (fallback avisado)', () => {
    const { pecas, semKitUniforme } = pecasDoContrato([], itens)
    expect(semKitUniforme).toBe(true)
    expect(pecas.length).toBe(5)
  })

  it('peças da função da pessoa; na dúvida, todas', () => {
    const { pecas } = pecasDoContrato(
      [
        { item_id: 'cam', rotulo: null, funcoes: ['asg'], ordem: 1, ativo: true },
        { item_id: 'soc', rotulo: null, funcoes: ['portaria'], ordem: 2, ativo: true },
        { item_id: 'mas', rotulo: null, funcoes: [], ordem: 3, ativo: true },
      ],
      itens
    )
    expect(pecasParaFuncao(pecas, 'asg').map((p) => p.opcoes[0].item_id)).toEqual(['cam', 'mas'])
    expect(pecasParaFuncao(pecas, 'portaria').map((p) => p.opcoes[0].item_id)).toEqual(['soc', 'mas'])
    expect(pecasParaFuncao(pecas, null)).toHaveLength(3)
    expect(pecasParaFuncao(pecas.slice(0, 2), 'jardinagem')).toHaveLength(2)
  })
})

describe('funções', () => {
  it('cargos reais do cadastro', () => {
    expect(funcaoDoCargo('AUXILIAR DE SERV GERAIS (LIMPEZA)')).toBe('asg')
    expect(funcaoDoCargo('PORTEIRO (a)')).toBe('portaria')
    expect(funcaoDoCargo('Vigia')).toBe('portaria')
    expect(funcaoDoCargo('ENCARREGADO JUNIOR')).toBe('encarregado')
    expect(funcaoDoCargo('ZELADOR')).toBe('encarregado')
    expect(funcaoDoCargo('AUXILIARDE JARDINAGEM')).toBe('jardinagem')
    expect(funcaoDoCargo('AUXILIAR DE MANUTENÇAO ')).toBe('manutencao')
    expect(funcaoDoCargo('OPERADOR DE MONITORAMENTO')).toBe('monitoramento')
    expect(funcaoDoCargo('RECEPCIONISTA')).toBe('recepcao')
    expect(funcaoDoCargo('SUPERVISOR ADMINISTRATIVO')).toBe('administrativo')
    expect(funcaoDoCargo('')).toBeNull()
  })

  it('texto dos Google Forms ("UTILIZADA POR ...")', () => {
    expect(funcoesDoTexto('TODOS OS AUXILIARES DE SERVIÇOS GERAIS')).toEqual(['asg'])
    expect(funcoesDoTexto('AUXILIARES DE SERVIÇOS GERAIS / LÍDERES / AUXILARES DE MANUTENÇÃO')).toEqual(['asg', 'encarregado', 'manutencao'])
    expect(funcoesDoTexto('  PORTEIRO / VIGIA ')).toEqual(['portaria'])
    expect(funcoesDoTexto('ENCARREGADO / ZELADOR / AUXILIAR DE MANUTENÇÃO')).toEqual(['encarregado', 'manutencao'])
  })
})

describe('equipe (primeiro nome + inicial)', () => {
  it('"Michelle A."; homônimos ganham mais letras', () => {
    expect(nomesCurtos(['MICHELLE ALVES DA SILVA', 'João de Souza'])).toEqual(['Michelle A.', 'João S.'])
    expect(nomesCurtos(['Michelle Alves', 'Michelle Antunes'])).toEqual(['Michelle Al.', 'Michelle An.'])
    expect(nomesCurtos(['Ana Silva Costa', 'Ana Silva Pereira'])).toEqual(['Ana S. C.', 'Ana S. P.'])
    expect(nomesCurtos(['Ana Silva', 'Ana Silva'])).toEqual(['Ana S.', 'Ana S. (2)'])
    expect(nomesCurtos(['Pedro'])).toEqual(['Pedro'])
  })

  it('a lista pública só tem ref, nome curto e função — nunca o nome completo', () => {
    const lista = montarEquipePublica([
      { ref: 'r1', nome_completo: 'Michelle Alves da Silva', cargo: 'AUXILIAR DE SERV GERAIS (LIMPEZA)' },
      { ref: 'r2', nome_completo: 'Bruno Costa', cargo: 'PORTEIRO (a)' },
    ])
    expect(lista).toEqual([
      { ref: 'r2', nome: 'Bruno C.', funcao: 'portaria' },
      { ref: 'r1', nome: 'Michelle A.', funcao: 'asg' },
    ])
    expect(JSON.stringify(lista)).not.toMatch(/Alves|Silva|Costa/)
  })

  it('nome amigável da peça', () => {
    expect(nomeAmigavelPeca('CAMISA MALHA POLO AZUL CLARA - ASG')).toBe('Camisa malha polo azul clara — ASG')
    expect(nomeAmigavelPeca('BOTA PVC CANO CURTO')).toBe('Bota PVC cano curto')
  })
})

describe('snapshots da linha identificada', () => {
  const itens = [
    item('b38', 'BOTA PVC CANO CURTO 38 - Tam. 38'),
    item('b39', 'BOTA PVC CANO CURTO 39 - Tam. 39'),
    item('bt40', 'BOTINA COM ELÁSTICO 40 - Tam. 40'),
    item('lm', 'LUVA LÁTEX M - Tam. M'),
  ]

  it('última entrega considera a PEÇA (pediu a 39, recebeu a 38)', () => {
    const ids = itensDaMesmaPeca(itens, 'b39')
    expect([...ids].sort()).toEqual(['b38', 'b39'])
    expect(
      ultimaEntregaDaPeca(
        [
          { item_id: 'b38', data_entrega: '2026-03-01' },
          { item_id: 'b38', data_entrega: '2025-09-01' },
          { item_id: 'bt40', data_entrega: '2026-08-01' },
        ],
        ids
      )
    ).toEqual({ data: '2026-03-01', item_id: 'b38' })
    expect(ultimaEntregaDaPeca([], ids)).toBeNull()
  })

  it('medida do cadastro e divergência têm a mesma regra do CEU', async () => {
    const { tamanhoParaItem } = await import('@/lib/ceu/tamanhosPuro')
    const { tamanhosDivergem } = await import('./pedidos')
    const t = { colaborador_id: 'x', tamanho_camisa: 'M', tamanho_calca: '42', tamanho_calcado: '38', tamanho_luva: 'G' }
    for (const n of NOMES_REAIS) expect(tamanhoCadastroParaItem(n, t)).toBe(tamanhoParaItem(n, t as never))
    for (const [a, b] of [['38', '38'], ['39', '38'], ['g', 'G'], ['', 'M'], [null, 'M']] as const) {
      expect(tamanhosDivergemPeca(a, b)).toBe(tamanhosDivergem(a, b))
    }
  })
})

describe('equipe do contrato com departamentos extras (Telex × DuoConnect)', () => {
  const deps = [
    { id: 'telex', nome: 'CENTRO AUDITIVO TELEX CENTRO RJ I', nome_curto: 'CENTRO AUDITIVO TELEX', status: 'Ativo' },
    { id: 'duo', nome: 'DUOCONNECT SOLUCOES AUDITIVAS LTDA', nome_curto: 'DUOCONNECT', status: 'Ativo' },
    { id: 'outro', nome: 'CBO', nome_curto: 'CBO', status: 'Ativo' },
  ]
  const colabs = [
    { id: 'a', departamento_id: null, departamento: 'CENTRO AUDITIVO TELEX CENTRO RJ I' },
    { id: 'b', departamento_id: 'duo', departamento: null },
    { id: 'c', departamento_id: null, departamento: 'DUOCONNECT SOLUCOES AUDITIVAS LTDA' },
    { id: 'd', departamento_id: 'outro', departamento: null },
  ]
  it('une o departamento principal com os extras, sem repetir', () => {
    expect([...idsEquipeDoContrato(deps, colabs, ['telex'])]).toEqual(['a'])
    expect([...idsEquipeDoContrato(deps, colabs, ['telex', 'duo', 'duo'])].sort()).toEqual(['a', 'b', 'c'])
    expect(idsEquipeDoContrato(deps, colabs, ['inexistente']).size).toBe(0)
  })
})

describe('itens ocultos do link do líder (camisa 331, 15/10/2026)', () => {
  const ID_331 = '0e528c08-54ff-45f4-a1af-12fc54d4b106'
  const itens = [
    item(ID_331, 'CAMISA MALHA POLO AZUL CLARA - ASG', 'uniforme'),
    item('c312', 'CAMISA MALHA POLO - AZUL - ASG', 'uniforme'),
    item('mas', 'MÁSCARA DESCARTÁVEL'),
  ]

  it('a 331 está na lista de ocultos', () => {
    expect(ITENS_CEU_OCULTOS_LINK.has(ID_331)).toBe(true)
  })

  it('fallback sem kit: a 331 some e a 312 continua', () => {
    const { pecas, semKitUniforme } = pecasDoContrato([], itens)
    expect(semKitUniforme).toBe(true)
    const ids = pecas.flatMap((p) => p.opcoes.map((o) => o.item_id))
    expect(ids).not.toContain(ID_331)
    expect(ids).toContain('c312')
    expect(ids).toContain('mas')
  })

  it('kit configurado com a 331: ela é ignorada e a 312 continua', () => {
    const { pecas, semKitUniforme } = pecasDoContrato(
      [
        { item_id: ID_331, rotulo: null, funcoes: ['asg'], ordem: 1, ativo: true },
        { item_id: 'c312', rotulo: null, funcoes: ['asg'], ordem: 2, ativo: true },
      ],
      itens
    )
    expect(semKitUniforme).toBe(false)
    const ids = pecas.flatMap((p) => p.opcoes.map((o) => o.item_id))
    expect(ids).not.toContain(ID_331)
    expect(ids).toContain('c312')
  })

  it('kit só com a 331: nenhuma peça (sem cair no fallback)', () => {
    const { pecas, semKitUniforme } = pecasDoContrato([{ item_id: ID_331, rotulo: null, funcoes: [], ordem: 1, ativo: true }], itens)
    expect(semKitUniforme).toBe(false)
    expect(pecas).toHaveLength(0)
  })
})
