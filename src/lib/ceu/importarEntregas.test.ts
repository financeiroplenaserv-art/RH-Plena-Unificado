import { describe, it, expect } from 'vitest'
import {
  analisarLinhas,
  chaveDuplicidade,
  limparNomeColaborador,
  mapearLinhasArquivo,
  normalizarTamanho,
  pareceEntregas,
  parseCsvEntregas,
  resolverColaborador,
  resolverItem,
  tamanhoDoNomeItem,
} from './importarEntregas'
import type { Colaborador, ItemCEU } from '@/types/database'

function colab(nome: string, status = 'Ativo'): Colaborador {
  return { id: `id-${nome}`, nome_completo: nome, matricula: '000001', status } as Colaborador
}

function item(nome: string, ca = '1.000'): ItemCEU {
  return { id: `item-${nome}`, nome, tipo: 'EPI', ca, situacao: 'A' } as ItemCEU
}

const CATALOGO: ItemCEU[] = [
  item('LUVA LÁTEX P - Tam. P', '45.629'),
  item('LUVA LÁTEX M - Tam. M', '45.629'),
  item('LUVA LÁTEX G - Tam. G', '45.629'),
  item('LUVA LÁTEX EG - Tam. EG', '45.629'),
  item('LUVA NITRÍLICA M - Tam. M', '16.314'),
  item('LUVA NITRÍLICA G - Tam. G', '16.314'),
  item('LUVA NITRÍLICA EXTRA EG - Tam. EG', '16.314'),
  item('LUVA NITRÍLICA TIPO GLADIADOR', '20719'),
  item('LUVA PVC', '46.837'),
  item('LUVA PARA ELETRICISTA (LUVA PU)', '15272'),
  item('BOTA PVC CANO CURTO 42 - Tam. 42', '40872'),
  item('BOTA PVC CANO CURTO 44 - Tam. 44', '37456'),
  item('BOTINA COM ELÁSTICO 38 - Tam. 38', '38362'),
  item('MÁSCARA RESPIRADOR COM VÁLVULA', '38.944'),
  item('MÁSCARA DESCARTÁVEL'),
  item('MÁSCARA RESPIRADOR', '28018'),
  item('ÓCULOS LENTE INCOLOR', '28018'),
  item('ÓCULOS LENTE FUMÊ', '30115'),
  item('AVENTAL', '38.302'),
  item('AVENTAL TRANSPARENTE', '38316'),
  item('PROTETOR AURICULAR', '18189'),
  item('PROTETOR FACIAL', '32033'),
]

describe('resolverItem', () => {
  it('resolve luva látex por tamanho', () => {
    expect(resolverItem('Luvas látex', 'G', CATALOGO).item?.nome).toBe('LUVA LÁTEX G - Tam. G')
    expect(resolverItem('Luvas lãtex', 'M', CATALOGO).item?.nome).toBe('LUVA LÁTEX M - Tam. M') // typo do arquivo
  })

  it('converte "extra G" para EG', () => {
    expect(resolverItem('Luvas látex', 'extra G', CATALOGO).item?.nome).toBe('LUVA LÁTEX EG - Tam. EG')
  })

  it('ignora a cor entre parênteses no tamanho', () => {
    expect(resolverItem('Luvas látex', 'G(verde)', CATALOGO).item?.nome).toBe('LUVA LÁTEX G - Tam. G')
  })

  it('nitrílica numérica: 8 → M, 9 → G', () => {
    expect(resolverItem('Luvas nitrílicas', '8', CATALOGO).item?.nome).toBe('LUVA NITRÍLICA M - Tam. M')
    expect(resolverItem('luva nitrílica', '9', CATALOGO).item?.nome).toBe('LUVA NITRÍLICA G - Tam. G')
  })

  it('tamanho grudado no nome ("luva nitrílica9")', () => {
    expect(resolverItem('luva nitrílica9', '', CATALOGO).item?.nome).toBe('LUVA NITRÍLICA G - Tam. G')
  })

  it('máscara genérica vai para a respirador com válvula (item em uso)', () => {
    expect(resolverItem('máscaras', '', CATALOGO).item?.nome).toBe('MÁSCARA RESPIRADOR COM VÁLVULA')
  })

  it('óculos genérico vai para lente incolor', () => {
    expect(resolverItem('óculos', '', CATALOGO).item?.nome).toBe('ÓCULOS LENTE INCOLOR')
  })

  it('avental para copa vai para o AVENTAL liso', () => {
    expect(resolverItem('Avental para copa', '', CATALOGO).item?.nome).toBe('AVENTAL')
  })

  it('protetores auriculares vai para o auricular (não o facial)', () => {
    expect(resolverItem('protetores auriculares', '', CATALOGO).item?.nome).toBe('PROTETOR AURICULAR')
  })

  it('luva PVC não casa com as botas de PVC', () => {
    expect(resolverItem('luva PVC', '', CATALOGO).item?.nome).toBe('LUVA PVC')
  })

  it('bota não casa com botina', () => {
    expect(resolverItem('Bota', '42', CATALOGO).item?.nome).toBe('BOTA PVC CANO CURTO 42 - Tam. 42')
    expect(resolverItem('Botina', '38', CATALOGO).item?.nome).toBe('BOTINA COM ELÁSTICO 38 - Tam. 38')
  })

  it('luva PU vai para a luva de eletricista', () => {
    expect(resolverItem('Luvas PU(preta)', '', CATALOGO).item?.nome).toBe('LUVA PARA ELETRICISTA (LUVA PU)')
  })

  it('retorna null com candidatos quando não resolve', () => {
    const r = resolverItem('Cadeado', '', CATALOGO)
    expect(r.item).toBeNull()
    expect(r.candidatos).toHaveLength(0)
  })
})

describe('resolverColaborador', () => {
  const colaboradores = [
    colab('DAGNO DA SILVA ALVES'),
    colab('MARCOS VINÍCIUS STELLET MONTEIRO'),
    colab('GISELE SOARES AUGUSTO', 'Afastado'),
  ]

  it('casa ignorando acentos e caixa', () => {
    expect(resolverColaborador('Dágno da Silva Alves', colaboradores).colaborador?.id).toBe('id-DAGNO DA SILVA ALVES')
  })

  it('ignora observação entre parênteses', () => {
    expect(resolverColaborador('GISELE SOARES AUGUSTO (qualquer nota)', colaboradores).colaborador?.id).toBe('id-GISELE SOARES AUGUSTO')
  })

  it('casa por prefixo quando o nome veio truncado', () => {
    const r = resolverColaborador('MARCOS VINÍCIUS STELLET MONT', colaboradores)
    expect(r.colaborador?.id).toBe('id-MARCOS VINÍCIUS STELLET MONTEIRO')
    expect(r.aproximado).toBe(true)
  })

  it('retorna null quando não existe', () => {
    expect(resolverColaborador('FULANO INEXISTENTE', colaboradores).colaborador).toBeNull()
  })
})

describe('analisarLinhas', () => {
  const colaboradores = [colab('DAGNO DA SILVA ALVES'), colab('GISELE SOARES AUGUSTO', 'Inativo')]

  it('linha válida fica ok e incluída', () => {
    const [l] = analisarLinhas(
      [{ colaborador: 'DAGNO DA SILVA ALVES', quantidade: 2, item: 'Luvas látex', tamanho: 'G', descricaoOriginal: '02 Luvas látex G' }],
      colaboradores,
      CATALOGO
    )
    expect(l.status).toBe('ok')
    expect(l.incluir).toBe(true)
    expect(l.item?.nome).toBe('LUVA LÁTEX G - Tam. G')
  })

  it('colaborador inativo fica aviso e desmarcado', () => {
    const [l] = analisarLinhas(
      [{ colaborador: 'GISELE SOARES AUGUSTO', quantidade: 2, item: 'Luvas látex', tamanho: 'G', descricaoOriginal: '' }],
      colaboradores,
      CATALOGO
    )
    expect(l.status).toBe('aviso')
    expect(l.incluir).toBe(false)
  })

  it('colaborador não encontrado fica erro', () => {
    const [l] = analisarLinhas(
      [{ colaborador: 'NINGUÉM', quantidade: 1, item: 'Luvas látex', tamanho: 'G', descricaoOriginal: '' }],
      colaboradores,
      CATALOGO
    )
    expect(l.status).toBe('erro')
    expect(l.incluir).toBe(false)
  })

  it('entrega duplicada na data fica aviso e desmarcada', () => {
    const existentes = new Set([chaveDuplicidade('id-DAGNO DA SILVA ALVES', 'item-LUVA LÁTEX G - Tam. G', 2)])
    const [l] = analisarLinhas(
      [{ colaborador: 'DAGNO DA SILVA ALVES', quantidade: 2, item: 'Luvas látex', tamanho: 'G', descricaoOriginal: '' }],
      colaboradores,
      CATALOGO,
      existentes
    )
    expect(l.status).toBe('aviso')
    expect(l.incluir).toBe(false)
    expect(l.mensagens.join(' ')).toMatch(/duplicar/i)
  })
})

describe('parseCsvEntregas + mapearLinhasArquivo', () => {
  it('detecta separador ponto-e-vírgula e mapeia cabeçalhos', () => {
    const texto = 'colaborador;quantidade;item;tamanho;descricao_original\nDAGNO DA SILVA ALVES;2;Luvas látex;G;02 Luvas látex G'
    const linhas = mapearLinhasArquivo(parseCsvEntregas(texto))
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({ colaborador: 'DAGNO DA SILVA ALVES', quantidade: 2, item: 'Luvas látex', tamanho: 'G' })
  })

  it('monta a descrição quando a coluna não existe', () => {
    const linhas = mapearLinhasArquivo([{ Nome: 'DAGNO', Qtd: 3, Produto: 'Bota', Tam: 42 }])
    expect(linhas[0].descricaoOriginal).toBe('03 Bota 42')
  })

  it('ignora linhas vazias', () => {
    const linhas = mapearLinhasArquivo([{ colaborador: '', item: '' }, { colaborador: 'DAGNO', item: 'Bota' }])
    expect(linhas).toHaveLength(1)
  })

  it('pareceEntregas reconhece o arquivo de entregas e não confunde com itens/fornecedores', () => {
    expect(pareceEntregas(parseCsvEntregas('colaborador;quantidade;item;tamanho\nDAGNO;2;Luvas látex;G'))).toBe(true)
    // arquivo de itens tem "nome" (vira colaborador) mas não tem "item"
    expect(pareceEntregas([{ nome: 'LUVA LÁTEX G', tipo: 'EPI', valor: '3,70' }])).toBe(false)
    // arquivo de fornecedores idem
    expect(pareceEntregas([{ nome: 'FORNECEDOR X', cnpj: '00.000.000/0001-00' }])).toBe(false)
    expect(pareceEntregas([])).toBe(false)
  })
})

describe('tamanhoDoNomeItem / normalizarTamanho', () => {
  it('extrai tamanho do padrão "- Tam. X"', () => {
    expect(tamanhoDoNomeItem('LUVA LÁTEX EG - Tam. EG')).toBe('eg')
    expect(tamanhoDoNomeItem('BOTA PVC CANO CURTO 42 - Tam. 42')).toBe('42')
  })

  it('item sem tamanho retorna null', () => {
    expect(tamanhoDoNomeItem('LUVA NITRÍLICA TIPO GLADIADOR')).toBeNull()
    expect(tamanhoDoNomeItem('MÁSCARA RESPIRADOR COM VÁLVULA')).toBeNull()
  })

  it('normaliza variações', () => {
    expect(normalizarTamanho('extra G')).toBe('eg')
    expect(normalizarTamanho('G(verde)')).toBe('g')
    expect(normalizarTamanho('M(verde)')).toBe('m')
  })

  it('limparNomeColaborador remove parênteses', () => {
    expect(limparNomeColaborador('RICARDO FREITAS MARINS (periculosidade)')).toBe('RICARDO FREITAS MARINS')
  })
})
