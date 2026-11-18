import { describe, expect, it } from 'vitest'
import { calcularDia, calcularSentido } from '@/lib/vt/motor'
import type { FatosCartaoMotor, ModalPerna, PernaMotor, ResultadoDiaMotor } from '@/lib/vt/motor'

const DATA = '2026-11-17'
const ATIVO: FatosCartaoMotor = { situacaoBu: 'Ativado', consultadoEm: '2026-10-28' }
const SUSPENSO: FatosCartaoMotor = { situacaoBu: 'Suspenso Setrans', consultadoEm: '2026-10-28' }
const SEM_BU: FatosCartaoMotor = { situacaoBu: 'Não possui BU', consultadoEm: '2026-10-28' }
const SEM_CONSULTA: FatosCartaoMotor = { situacaoBu: null }

function hora(minutos: number): string {
  const total = 6 * 60 + minutos
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `2026-11-17T${hh}:${mm}:00-03:00`
}

function perna(modal: ModalPerna, linha: string | null, min = 0, secao?: number): PernaMotor {
  return { modal, linha, embarqueEm: hora(min), secao: secao ?? null }
}

function dia(pernas: PernaMotor[], cartao: FatosCartaoMotor, data = DATA): ResultadoDiaMotor {
  return calcularDia({ itinerario: { ida: pernas, volta: pernas }, cartao, dataServico: data })
}

function cita(r: ResultadoDiaMotor, trecho: string): boolean {
  return r.explicacao.some((p) => p.regra.includes(trecho))
}

describe('exemplos da Proposta VT §5', () => {
  it('a) 1 ônibus municipal de Niterói por sentido', () => {
    const r = dia([perna('onibus_municipal_niteroi', '35')], ATIVO)
    expect(r.ida.valorCentavos).toBe(560)
    expect(r.valorCentavos).toBe(1120)
    expect(r.status).toBe('confirmado')
    expect(cita(r, '§3')).toBe(true)
  })

  it('b) 2 ônibus de Niterói, linhas diferentes, até 1 h, BUN ativo: 1 tarifa', () => {
    const r = dia([perna('onibus_municipal_niteroi', '35', 0), perna('onibus_municipal_niteroi', '39A', 30)], ATIVO)
    expect(r.ida.valorCentavos).toBe(560)
    expect(r.valorCentavos).toBe(1120)
    expect(r.status).toBe('confirmado')
    expect(cita(r, 'BUN')).toBe(true)
  })

  it('c) igual a (b) com BUN não confirmado: soma integral e pendência', () => {
    const r = dia([perna('onibus_municipal_niteroi', '35', 0), perna('onibus_municipal_niteroi', '39A', 30)], SEM_CONSULTA)
    expect(r.ida.valorCentavos).toBe(1120)
    expect(r.valorCentavos).toBe(2240)
    expect(r.status).toBe('pendente')
    const p = r.pendencias.find((x) => x.codigo === 'BUN_NAO_COMPROVADO')
    expect(p?.mensagem).toContain('R$ 5,60')
    expect(p?.regra).toContain('§3')
  })

  it('d) linha direta 484M', () => {
    const r = dia([perna('onibus_intermunicipal', '484M')], ATIVO)
    expect(r.ida.valorCentavos).toBe(710)
    expect(r.valorCentavos).toBe(1420)
    expect(r.status).toBe('confirmado')
    expect(cita(r, '§6')).toBe(true)
  })

  it('e) linha direta 483M', () => {
    const r = dia([perna('onibus_intermunicipal', '483M')], ATIVO)
    expect(r.valorCentavos).toBe(1820)
    expect(r.status).toBe('confirmado')
  })

  it('f) linha direta acima de 940 (100D): integral + pendência BUI direto', () => {
    const r = dia([perna('onibus_intermunicipal', '100D')], ATIVO)
    expect(r.ida.valorCentavos).toBe(1040)
    expect(r.valorCentavos).toBe(2080)
    expect(r.status).toBe('pendente')
    const p = r.pendencias.find((x) => x.codigo === 'BUI_DIRETO_PENDENTE')
    expect(p?.regra).toContain('§2')
    expect(p?.regra).toContain('§10')
  })

  it('g) intermunicipal (910) + municipal SG, BUI elegível: 940 < 910 + 555', () => {
    const r = dia([perna('onibus_intermunicipal', '483M', 0), perna('onibus_municipal_sao_goncalo', '10', 40)], ATIVO)
    expect(910 + 555).toBeGreaterThan(940)
    expect(r.ida.valorCentavos).toBe(940)
    expect(r.valorCentavos).toBe(1880)
    expect(r.status).toBe('confirmado')
    expect(cita(r, '§4')).toBe(true)
  })

  it('h) 536R + municipal de Niterói 35: BUI não cobre Niterói', () => {
    const r = dia([perna('onibus_intermunicipal', '536R', 0), perna('onibus_municipal_niteroi', '35', 40)], ATIVO)
    expect(r.ida.valorCentavos).toBe(1470)
    expect(r.valorCentavos).toBe(2940)
    expect(r.status).toBe('confirmado')
    expect(cita(r, 'exceção de Niterói')).toBe(true)
  })

  it('i) igual a (g) com BUI suspenso: soma integral, pendente (SG a conferir)', () => {
    const r = dia([perna('onibus_intermunicipal', '483M', 0), perna('onibus_municipal_sao_goncalo', '10', 40)], SUSPENSO)
    expect(r.ida.valorCentavos).toBe(1465)
    expect(r.valorCentavos).toBe(2930)
    expect(r.status).toBe('pendente')
    const codigos = r.pendencias.map((p) => p.codigo)
    expect(codigos).toContain('BUI_SUSPENSO')
    expect(codigos).toContain('TARIFA_A_CONFERIR')
  })

  it('j) só trem', () => {
    const r = dia([perna('trem', null)], ATIVO)
    expect(r.ida.valorCentavos).toBe(760)
    expect(r.valorCentavos).toBe(1520)
    expect(r.status).toBe('confirmado')
    expect(cita(r, '§7')).toBe(true)
  })

  it('k1) trem + metrô com BUI elegível: 940', () => {
    const r = dia([perna('trem', null, 0), perna('metro', null, 30)], ATIVO)
    expect(r.ida.valorCentavos).toBe(940)
    expect(r.valorCentavos).toBe(1880)
    expect(r.status).toBe('confirmado')
  })

  it('k2) trem + metrô sem BUI: 760 + 790', () => {
    const r = dia([perna('trem', null, 0), perna('metro', null, 30)], SEM_BU)
    expect(r.ida.valorCentavos).toBe(1550)
    expect(r.valorCentavos).toBe(3100)
    expect(r.status).toBe('confirmado')
    expect(cita(r, '§7')).toBe(true)
  })

  it('l) três conduções com BUI: duas pela integração, a terceira à parte (pendente)', () => {
    const r = dia(
      [
        perna('onibus_intermunicipal', '483M', 0),
        perna('onibus_municipal_sao_goncalo', '10', 40),
        perna('onibus_municipal_rio', 'X1', 80),
      ],
      ATIVO,
    )
    expect(r.ida.valorCentavos).toBe(940 + 500)
    expect(r.valorCentavos).toBe(2 * 1440)
    expect(r.status).toBe('pendente')
    expect(r.pendencias.some((p) => p.codigo === 'TARIFA_A_CONFERIR')).toBe(true)
  })

  it('m) só ônibus municipal do Rio (Jaé): 500 a conferir', () => {
    const r = dia([perna('onibus_municipal_rio', '474')], ATIVO)
    expect(r.ida.valorCentavos).toBe(500)
    expect(r.valorCentavos).toBe(1000)
    expect(r.status).toBe('pendente')
    expect(r.pendencias[0].mensagem).toContain('a conferir')
  })
})

describe('BUN — elegibilidade e limites', () => {
  const duas = (min2: number, linha2 = '39A') => [
    perna('onibus_municipal_niteroi', '35', 0),
    perna('onibus_municipal_niteroi', linha2, min2),
  ]

  it('Suspenso Setrans: provável, não comprovado — cobra integral e pendência', () => {
    const r = dia(duas(30), SUSPENSO)
    expect(r.valorCentavos).toBe(2240)
    expect(r.status).toBe('pendente')
    expect(r.pendencias.some((p) => p.codigo === 'BUN_PROVAVEL_NAO_COMPROVADO')).toBe(true)
  })

  it('Suspenso Setrans com confirmação no Portal: integra', () => {
    const r = dia(duas(30), { ...SUSPENSO, bunConfirmadoNoPortal: true })
    expect(r.valorCentavos).toBe(1120)
    expect(r.status).toBe('confirmado')
  })

  it('mesma linha: não integra', () => {
    const r = dia(duas(30, '35'), ATIVO)
    expect(r.valorCentavos).toBe(2240)
    expect(r.status).toBe('confirmado')
    expect(cita(r, '§3')).toBe(true)
  })

  it('61 minutos: não integra; 60 minutos: integra', () => {
    expect(dia(duas(61), ATIVO).valorCentavos).toBe(2240)
    expect(dia(duas(60), ATIVO).valorCentavos).toBe(1120)
  })

  it('sem horário de embarque não prova a janela: não integra e pendência', () => {
    const sem: PernaMotor[] = [
      { modal: 'onibus_municipal_niteroi', linha: '35' },
      { modal: 'onibus_municipal_niteroi', linha: '39A' },
    ]
    const r = dia(sem, ATIVO)
    expect(r.valorCentavos).toBe(2240)
    expect(r.status).toBe('pendente')
  })
})

describe('BUI — elegibilidade, teto e simetria', () => {
  it('BUI suspenso: soma das integrais', () => {
    const r = dia([perna('trem', null, 0), perna('metro', null, 30)], SUSPENSO)
    expect(r.ida.valorCentavos).toBe(1550)
    expect(r.status).toBe('pendente')
  })

  it('BUI não é escolhido quando a soma comum é menor ou igual (ordem das pernas indiferente)', () => {
    // 484M (710) + Rio (500) = 1210 > 940 → BUI; já 2 municipais pequenos não compensariam.
    const ida = dia([perna('onibus_intermunicipal', '484M', 0), perna('onibus_municipal_rio', 'X', 30)], ATIVO)
    const inversa = dia([perna('onibus_municipal_rio', 'X', 0), perna('onibus_intermunicipal', '484M', 30)], ATIVO)
    expect(ida.ida.valorCentavos).toBe(940)
    expect(inversa.ida.valorCentavos).toBe(940)
  })

  it('janela do metrô é 120 min', () => {
    const r = dia([perna('trem', null, 0), perna('metro', null, 130)], ATIVO)
    expect(r.ida.valorCentavos).toBe(1550)
    const ok = dia([perna('trem', null, 0), perna('metro', null, 120)], ATIVO)
    expect(ok.ida.valorCentavos).toBe(940)
  })

  it('janela geral é 180 min', () => {
    const fora = dia([perna('onibus_intermunicipal', '483M', 0), perna('onibus_municipal_sao_goncalo', '10', 181)], ATIVO)
    expect(fora.ida.valorCentavos).toBe(1465)
    const dentro = dia([perna('onibus_intermunicipal', '483M', 0), perna('onibus_municipal_sao_goncalo', '10', 180)], ATIVO)
    expect(dentro.ida.valorCentavos).toBe(940)
  })

  it('três conduções: SG municipal + intermunicipal (BUI) + Niterói municipal à parte', () => {
    const r = dia(
      [
        perna('onibus_municipal_sao_goncalo', '10', 0),
        perna('onibus_intermunicipal', '483M', 30),
        perna('onibus_municipal_niteroi', '35', 70),
      ],
      ATIVO,
    )
    expect(r.ida.valorCentavos).toBe(940 + 560)
    expect(r.valorCentavos).toBe(3000)
    expect(r.status).toBe('confirmado')
  })

  it('Metrô + BRT/van não é presumido: indeterminado', () => {
    const r = dia([perna('metro', null, 0), perna('brt', 'T1', 30)], ATIVO)
    expect(r.valorCentavos).toBeNull()
    expect(r.status).toBe('indeterminado')
  })

  it('combinação não descrita entre modais com tarifa gera pendência e não integra', () => {
    const r = dia([perna('metro', null, 0), perna('onibus_municipal_rio', 'X', 30)], ATIVO)
    expect(r.ida.valorCentavos).toBe(1290)
    expect(r.status).toBe('pendente')
    expect(r.pendencias.some((p) => p.codigo === 'COMBINACAO_NAO_DESCRITA')).toBe(true)
  })

  it('barca nunca é automatizada', () => {
    const r = dia([perna('barca', null)], ATIVO)
    expect(r.status).toBe('indeterminado')
    expect(r.pendencias[0].codigo).toBe('BARCA_TARIFA_PROPRIA')
  })
})

describe('tarifas DETRO por linha', () => {
  it('5721D = 3370 e 721D = 1595 vêm da tabela', () => {
    expect(calcularSentido({ pernas: [perna('onibus_intermunicipal', '5721D')], cartao: ATIVO, dataServico: DATA }).valorCentavos).toBe(3370)
    expect(calcularSentido({ pernas: [perna('onibus_intermunicipal', '721D')], cartao: ATIVO, dataServico: DATA }).valorCentavos).toBe(1595)
  })

  it('linha inexistente: pendência e valor null', () => {
    const r = dia([perna('onibus_intermunicipal', '9999Z')], ATIVO)
    expect(r.valorCentavos).toBeNull()
    expect(r.status).toBe('indeterminado')
    expect(r.pendencias[0].mensagem).toContain('9999Z')
  })

  it('seção ambígua (416M sem seção): lista as opções; informada, resolve', () => {
    const amb = calcularSentido({ pernas: [perna('onibus_intermunicipal', '416M')], cartao: ATIVO, dataServico: DATA })
    expect(amb.valorCentavos).toBeNull()
    expect(amb.pendencias[0].mensagem).toContain('seção 0')
    expect(amb.pendencias[0].mensagem).toContain('seção 1')
    const info = calcularSentido({ pernas: [perna('onibus_intermunicipal', '416M', 0, 1)], cartao: ATIVO, dataServico: DATA })
    expect(info.valorCentavos).toBe(710)
    const total = calcularSentido({ pernas: [perna('onibus_intermunicipal', '416M', 0, 0)], cartao: ATIVO, dataServico: DATA })
    expect(total.valorCentavos).toBe(1510)
  })

  it('data anterior à vigência (2026-02-15): indeterminado', () => {
    const r = dia([perna('onibus_intermunicipal', '484M')], ATIVO, '2026-02-14')
    expect(r.status).toBe('indeterminado')
    expect(r.valorCentavos).toBeNull()
    expect(dia([perna('onibus_intermunicipal', '484M')], ATIVO, '2026-02-15').valorCentavos).toBe(1420)
  })
})

describe('dia com ida e volta diferentes', () => {
  it('a volta nunca é presumida igual à ida', () => {
    const r = calcularDia({
      itinerario: {
        ida: [perna('onibus_intermunicipal', '484M')],
        volta: [perna('onibus_intermunicipal', '483M')],
      },
      cartao: ATIVO,
      dataServico: DATA,
    })
    expect(r.ida.valorCentavos).toBe(710)
    expect(r.volta.valorCentavos).toBe(910)
    expect(r.valorCentavos).toBe(1620)
  })

  it('um sentido indeterminado torna o dia indeterminado', () => {
    const r = calcularDia({
      itinerario: { ida: [perna('onibus_intermunicipal', '484M')], volta: [perna('onibus_intermunicipal', '9999Z')] },
      cartao: ATIVO,
      dataServico: DATA,
    })
    expect(r.valorCentavos).toBeNull()
    expect(r.status).toBe('indeterminado')
    expect(r.ida.valorCentavos).toBe(710)
  })

  it('sentido sem pernas é indeterminado', () => {
    const r = calcularDia({
      itinerario: { ida: [perna('trem', null)], volta: [] },
      cartao: ATIVO,
      dataServico: DATA,
    })
    expect(r.status).toBe('indeterminado')
  })
})

describe('caso Alcemir (Regras §11)', () => {
  it('536R + 35 = 1470 por sentido', () => {
    const r = calcularSentido({
      pernas: [perna('onibus_intermunicipal', '536R', 0), perna('onibus_municipal_niteroi', '35', 40)],
      cartao: SUSPENSO,
      dataServico: DATA,
    })
    expect(r.valorCentavos).toBe(1470)
    expect(r.status).toBe('confirmado')
  })

  it('62 + 39A = 1120 por sentido sem BUN e 560 com BUN', () => {
    const pernas = [perna('onibus_municipal_niteroi', '62', 0), perna('onibus_municipal_niteroi', '39A', 18)]
    const sem = calcularSentido({ pernas, cartao: SUSPENSO, dataServico: DATA })
    expect(sem.valorCentavos).toBe(1120)
    expect(sem.status).toBe('pendente')
    const com = calcularSentido({ pernas, cartao: { ...SUSPENSO, bunConfirmadoNoPortal: true }, dataServico: DATA })
    expect(com.valorCentavos).toBe(560)
    expect(com.status).toBe('confirmado')
    expect(com.explicacao.some((p) => p.regra.includes('§3'))).toBe(true)
  })
})
