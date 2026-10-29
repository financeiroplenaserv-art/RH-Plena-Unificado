import { describe, expect, it } from 'vitest'
import {
  custoDiaTrajetoCentavos,
  escopoSugerido,
  paresDaEscala,
  avisoBilheteIncompativel,
  avisoIntegracaoDoTrajeto,
  descricaoCartaoDosBilhetes,
  ROTULO_CARTAO_NECESSARIO,
} from '@/lib/vt/trajetos'
import type { VtBilhete, VtTrajeto } from '@/types/vt'

const BU_NITEROI: VtBilhete = {
  id: 'b2',
  nome: 'BU NITERÓI',
  valor_diario_centavos: 1120,
  vigente_desde: '2026-10-21',
  ativo: true,
  cartao_necessario: 'bun',
  usa_integracao: true,
}

const TREM: VtBilhete = {
  id: 'b5',
  nome: 'TREM',
  valor_diario_centavos: 1580,
  vigente_desde: '2026-10-21',
  ativo: true,
  cartao_necessario: 'comum',
  usa_integracao: false,
}

const BUI: VtBilhete = {
  id: 'b7',
  nome: 'BILHETE ÚNICO INTERMUNICIPAL',
  valor_diario_centavos: 1880,
  vigente_desde: '2026-10-21',
  ativo: true,
  cartao_necessario: 'bui',
  usa_integracao: true,
}

const JAE: VtBilhete = {
  id: 'b3',
  nome: 'CARTÃO JAE RJ',
  valor_diario_centavos: 1400,
  vigente_desde: '2026-10-21',
  ativo: true,
  cartao_necessario: 'jae',
  usa_integracao: true,
}

function trajeto(parcial: Partial<VtTrajeto>): VtTrajeto {
  return {
    id: 'tr1',
    colaborador_id: 'c1',
    departamento_id: 'd1',
    bilhete_id: BU_NITEROI.id,
    bilhete_2_id: null,
    escopo: 'niteroi_municipal',
    precisao_origem: 'bairro',
    origem: 'manual',
    status: 'sugerido',
    valor_extra_centavos: 0,
    observacao: null,
    confirmado_por: null,
    confirmado_em: null,
    ...parcial,
  }
}

describe('custoDiaTrajetoCentavos', () => {
  it('trajeto com 1 bilhete vale o valor diário dele', () => {
    expect(custoDiaTrajetoCentavos(trajeto({}), [BU_NITEROI, TREM], '2026-10-21')).toBe(1120)
  })

  it('trajeto com 2 bilhetes soma os valores diários', () => {
    expect(custoDiaTrajetoCentavos(trajeto({ bilhete_2_id: TREM.id }), [BU_NITEROI, TREM], '2026-10-21')).toBe(2700)
  })

  it('valor extra manual soma ao custo do dia (migration 166)', () => {
    expect(
      custoDiaTrajetoCentavos(trajeto({ valor_extra_centavos: 200 }), [BU_NITEROI], '2026-10-21')
    ).toBe(1320)
    expect(
      custoDiaTrajetoCentavos(
        trajeto({ bilhete_2_id: TREM.id, valor_extra_centavos: 200 }),
        [BU_NITEROI, TREM],
        '2026-10-21'
      )
    ).toBe(2900)
  })

  it('extra 0 (ou coluna ausente em leitura antiga) não muda o custo', () => {
    expect(custoDiaTrajetoCentavos(trajeto({ valor_extra_centavos: 0 }), [BU_NITEROI], '2026-10-21')).toBe(1120)
    const legado = trajeto({}) as Omit<VtTrajeto, 'valor_extra_centavos'> as VtTrajeto
    delete (legado as Partial<VtTrajeto>).valor_extra_centavos
    expect(custoDiaTrajetoCentavos(legado, [BU_NITEROI], '2026-10-21')).toBe(1120)
  })

  it('extra sozinho não salva trajeto sem bilhete vigente (nunca cobrar sem bilhete)', () => {
    expect(
      custoDiaTrajetoCentavos(trajeto({ valor_extra_centavos: 500 }), [BU_NITEROI], '2026-10-20')
    ).toBeNull()
  })

  it('null quando o bilhete não está vigente na data', () => {
    expect(custoDiaTrajetoCentavos(trajeto({}), [BU_NITEROI], '2026-10-20')).toBeNull()
    const inativo: VtBilhete = { ...BU_NITEROI, ativo: false }
    expect(custoDiaTrajetoCentavos(trajeto({}), [inativo], '2026-10-21')).toBeNull()
  })

  it('usa a vigência mais recente do bilhete (mesmo nome, valor novo)', () => {
    const antiga: VtBilhete = { ...BU_NITEROI, id: 'b2a', valor_diario_centavos: 900, vigente_desde: '2026-01-01' }
    expect(custoDiaTrajetoCentavos(trajeto({ bilhete_id: 'b2a' }), [antiga], '2026-06-01')).toBe(900)
  })
})

describe('paresDaEscala', () => {
  it('deduplica colaborador × departamento e ignora departamento null', () => {
    const pares = paresDaEscala([
      { colaborador_id: 'c1', departamento_id: 'd1' },
      { colaborador_id: 'c1', departamento_id: 'd1' },
      { colaborador_id: 'c1', departamento_id: 'd2' },
      { colaborador_id: 'c2', departamento_id: 'd1' },
      { colaborador_id: 'c3', departamento_id: null },
    ])
    expect(pares).toEqual([
      { colaborador_id: 'c1', departamento_id: 'd1' },
      { colaborador_id: 'c1', departamento_id: 'd2' },
      { colaborador_id: 'c2', departamento_id: 'd1' },
    ])
  })

  it('lista vazia retorna vazio', () => {
    expect(paresDaEscala([])).toEqual([])
  })
})

describe('escopoSugerido', () => {
  it('Niterói × Niterói é municipal Niterói, ignorando acento e caixa', () => {
    expect(escopoSugerido('Niterói', 'NITEROI')).toBe('niteroi_municipal')
    expect(escopoSugerido('NITEROI', 'Niterói')).toBe('niteroi_municipal')
    expect(escopoSugerido(' niterói ', 'Niterói')).toBe('niteroi_municipal')
  })

  it('mesma cidade fora de Niterói é municipal de outra cidade', () => {
    expect(escopoSugerido('Macaé', 'MACAE')).toBe('municipal_outra')
    expect(escopoSugerido('São Gonçalo', 'São Gonçalo')).toBe('municipal_outra')
  })

  it('cidades diferentes são intermunicipal', () => {
    expect(escopoSugerido('São Gonçalo', 'Niterói')).toBe('intermunicipal')
    expect(escopoSugerido('Niterói', 'Maricá')).toBe('intermunicipal')
  })

  it('cidade vazia não é "igual": cai em intermunicipal', () => {
    expect(escopoSugerido(null, null)).toBe('intermunicipal')
    expect(escopoSugerido('', 'Niterói')).toBe('intermunicipal')
  })
})

describe('avisoBilheteIncompativel', () => {
  it('mora e trabalha em Niterói com bilhete intermunicipal: avisa (regra de 24/10/2026)', () => {
    expect(
      avisoBilheteIncompativel('Niterói', 'NITEROI', ['BILHETE ÚNICO INTERMUNICIPAL'])
    ).toContain('BU Niterói')
    // mesmo com o BUI só no 2º bilhete
    expect(
      avisoBilheteIncompativel('Niterói', 'Niterói', ['BU NITERÓI', 'BILHETE ÚNICO INTERMUNICIPAL'])
    ).toContain('intermunicipal')
  })

  it('nunca cita valor no texto (o valor muda de vigência)', () => {
    const textos = [
      avisoBilheteIncompativel('Niterói', 'Niterói', ['BILHETE ÚNICO INTERMUNICIPAL']),
      avisoBilheteIncompativel('São Gonçalo', 'Niterói', ['BU NITERÓI']),
      avisoBilheteIncompativel('São Gonçalo', 'São Gonçalo', ['BU NITERÓI']),
      avisoBilheteIncompativel('Niterói', 'Niterói', ['PASSAGEM SÃO GONÇALO']),
    ]
    for (const texto of textos) {
      expect(texto).toBeTruthy()
      expect(texto).not.toContain('R$')
    }
  })

  it('mora e trabalha em Niterói com BU Niterói: sem aviso (valor certo)', () => {
    expect(avisoBilheteIncompativel('Niterói', 'Niterói', ['BU NITERÓI'])).toBeNull()
    expect(avisoBilheteIncompativel('Niterói', 'Niterói', ['BU NITERÓI', 'BU NITERÓI'])).toBeNull()
  })

  it('cidades diferentes com bilhete intermunicipal: sem aviso (correto)', () => {
    expect(
      avisoBilheteIncompativel('São Gonçalo', 'Niterói', ['BILHETE ÚNICO INTERMUNICIPAL'])
    ).toBeNull()
  })

  it('cidades diferentes com bilhete municipal de Niterói: avisa (inverso)', () => {
    expect(avisoBilheteIncompativel('São Gonçalo', 'Niterói', ['BU NITERÓI'])).toContain(
      'cidades diferentes'
    )
  })

  it('casa SG + posto Niterói com BU Niterói como 2º bilhete: sem aviso (trecho municipal legítimo)', () => {
    expect(
      avisoBilheteIncompativel('São Gonçalo', 'Niterói', ['BILHETE ÚNICO INTERMUNICIPAL', 'BU NITERÓI'])
    ).toBeNull()
  })

  it('mesma cidade fora de Niterói com BU Niterói ou BUI: avisa "bilhete de outra cidade"', () => {
    expect(avisoBilheteIncompativel('São Gonçalo', 'São Gonçalo', ['BU NITERÓI'])).toBe(
      'Mora e trabalha em São Gonçalo, mas o bilhete é de outra cidade — confira o trajeto'
    )
    expect(
      avisoBilheteIncompativel('Macaé', 'MACAE', ['BILHETE ÚNICO INTERMUNICIPAL'])
    ).toContain('Mora e trabalha em Macaé')
  })

  it('mora e trabalha em Niterói com bilhete de São Gonçalo: avisa (27/10/2026)', () => {
    expect(avisoBilheteIncompativel('Niterói', 'Niterói', ['PASSAGEM SÃO GONÇALO'])).toBe(
      'Mora e trabalha em Niterói, mas o bilhete é o de São Gonçalo — em geral vale o BU Niterói'
    )
    // mesmo combinado com o BU Niterói
    expect(
      avisoBilheteIncompativel('Niterói', 'Niterói', ['BU NITERÓI', 'PASSAGEM SÃO GONÇALO'])
    ).toContain('São Gonçalo')
  })

  it('bilhete de outra praça (trem, VLT...) sem padrão conhecido não gera aviso', () => {
    expect(avisoBilheteIncompativel('Niterói', 'Niterói', ['TREM'])).toBeNull()
    expect(avisoBilheteIncompativel('São Gonçalo', 'Niterói', ['PASSAGEM SÃO GONÇALO'])).toBeNull()
    expect(avisoBilheteIncompativel('São Gonçalo', 'São Gonçalo', ['TREM'])).toBeNull()
  })

  it('sem cidade dos dois lados ou sem bilhete: sem base para julgar, sem aviso', () => {
    expect(avisoBilheteIncompativel(null, 'Niterói', ['BU NITERÓI'])).toBeNull()
    expect(avisoBilheteIncompativel('Niterói', '', ['BILHETE ÚNICO INTERMUNICIPAL'])).toBeNull()
    expect(avisoBilheteIncompativel('Niterói', 'Niterói', [null, undefined])).toBeNull()
  })
})

describe('ROTULO_CARTAO_NECESSARIO', () => {
  it('cobre os 4 cartões com os rótulos combinados', () => {
    expect(ROTULO_CARTAO_NECESSARIO).toEqual({
      bun: 'BUN (Niterói)',
      bui: 'BUI (intermunicipal)',
      jae: 'JAE (RJ)',
      comum: 'comum',
    })
  })
})

describe('descricaoCartaoDosBilhetes', () => {
  it('1 bilhete classificado com integração', () => {
    expect(descricaoCartaoDosBilhetes([BUI])).toBe('cartão: BUI (intermunicipal) · com integração')
  })

  it('1 bilhete classificado sem integração', () => {
    expect(descricaoCartaoDosBilhetes([TREM])).toBe('cartão: comum')
  })

  it('2 bilhetes juntam com " + "', () => {
    expect(descricaoCartaoDosBilhetes([BUI, BU_NITEROI])).toBe(
      'cartão: BUI (intermunicipal) · com integração + BUN (Niterói) · com integração'
    )
  })

  it('sem classificação (ou sem bilhete): null — catálogo ainda não classificado', () => {
    expect(descricaoCartaoDosBilhetes([{ cartao_necessario: null, usa_integracao: false }])).toBeNull()
    expect(descricaoCartaoDosBilhetes([null, undefined])).toBeNull()
    expect(descricaoCartaoDosBilhetes([])).toBeNull()
  })

  it('mistura classificado + não classificado mostra só o classificado', () => {
    expect(descricaoCartaoDosBilhetes([BU_NITEROI, null])).toBe(
      'cartão: BUN (Niterói) · com integração'
    )
  })
})

describe('avisoIntegracaoDoTrajeto (decisão da gestora, 28/10/2026 — o cartão é o mesmo; o que manda é a integração ativada)', () => {
  it('trajeto sem integração: sem aviso, mesmo sem BU consultado', () => {
    expect(avisoIntegracaoDoTrajeto([TREM], null, null)).toBeNull()
    expect(avisoIntegracaoDoTrajeto([TREM], false, 'Não possui BU')).toBeNull()
    expect(avisoIntegracaoDoTrajeto([], null, null)).toBeNull()
    expect(avisoIntegracaoDoTrajeto([null, undefined], undefined, undefined)).toBeNull()
  })

  it('integração + BU ativado: sem aviso (caso Acacio — trajeto BU Niterói, cadastro BUI, BU ativado)', () => {
    expect(avisoIntegracaoDoTrajeto([BUI], true, 'Ativado')).toBeNull()
    expect(avisoIntegracaoDoTrajeto([BU_NITEROI], true, 'Ativado')).toBeNull()
  })

  it('integração + BU NÃO ativado: aviso com a situação do site', () => {
    expect(avisoIntegracaoDoTrajeto([BUI], false, 'Suspenso Setrans')).toBe(
      "Este trajeto depende de integração (Bilhete Único), mas no site da Riocard o BU dele consta como 'Suspenso Setrans' — sem a ativação, o valor carregado não cobre o trajeto. Providenciar a ativação ou trocar o bilhete."
    )
  })

  it('integração + BU não ativado sem situação: omite o trecho do meio', () => {
    const aviso = avisoIntegracaoDoTrajeto([BUI], false, null)
    expect(aviso).toBe(
      'Este trajeto depende de integração (Bilhete Único) — sem a ativação, o valor carregado não cobre o trajeto. Providenciar a ativação ou trocar o bilhete.'
    )
    expect(avisoIntegracaoDoTrajeto([BUI], false, '  ')).toBe(aviso)
  })

  it('integração + situação não consultada (null/undefined): aviso para conferir antes de gravar', () => {
    expect(avisoIntegracaoDoTrajeto([BUI], null, null)).toBe(
      'Este trajeto depende de integração (Bilhete Único) e a situação do BU dele ainda não foi consultada na Riocard — confira antes de gravar a carga.'
    )
    expect(avisoIntegracaoDoTrajeto([BU_NITEROI], undefined, undefined)).toContain('não foi consultada')
  })

  it('com 2 bilhetes, basta um com integração para a regra valer', () => {
    expect(avisoIntegracaoDoTrajeto([TREM, BUI], false, 'Suspenso Setrans')).toContain("'Suspenso Setrans'")
    expect(avisoIntegracaoDoTrajeto([TREM, JAE], true, 'Ativado')).toBeNull()
  })
})
