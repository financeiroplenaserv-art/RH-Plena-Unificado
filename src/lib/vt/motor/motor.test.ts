import { describe, expect, it } from 'vitest'
import { calcularDia, calcularSentido } from '@/lib/vt/motor'
import type { FatosCartaoMotor, ModalPerna, PernaMotor, ResultadoDiaMotor } from '@/lib/vt/motor'

const DATA = '2026-11-17'
const ATIVO: FatosCartaoMotor = { situacaoBu: 'Ativado', consultadoEm: '2026-10-28' }
const SUSPENSO: FatosCartaoMotor = { situacaoBu: 'Suspenso Setrans', consultadoEm: '2026-10-28' }
const SEM_BU: FatosCartaoMotor = { situacaoBu: 'Não possui BU', consultadoEm: '2026-10-28' }
const SEM_CONSULTA: FatosCartaoMotor = { situacaoBu: null }
/** Exceção da empresa: tarifa cheia (desliga a integração). */
const cheia = (c: FatosCartaoMotor): FatosCartaoMotor => ({ ...c, politicaIntegracao: 'tarifa_cheia', motivoTarifaCheia: 'teste' })

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
    expect(r.ida.valorCentavos).toBe(445)
    expect(r.valorCentavos).toBe(890)
    expect(r.status).toBe('confirmado')
    expect(cita(r, '§3')).toBe(true)
  })

  it('b) 2 ônibus de Niterói, linhas diferentes, até 1 h, BUN ativo: 1 tarifa', () => {
    const r = dia([perna('onibus_municipal_niteroi', '35', 0), perna('onibus_municipal_niteroi', '39A', 30)], ATIVO)
    expect(r.ida.valorCentavos).toBe(445)
    expect(r.valorCentavos).toBe(890)
    expect(r.status).toBe('confirmado')
    expect(cita(r, 'BUN')).toBe(true)
  })

  it('c) igual a (b) sem consulta: integra (política presumida) e avisa para regularizar', () => {
    const r = dia([perna('onibus_municipal_niteroi', '35', 0), perna('onibus_municipal_niteroi', '39A', 30)], SEM_CONSULTA)
    expect(r.ida.valorCentavos).toBe(445)
    expect(r.valorCentavos).toBe(890)
    expect(r.status).toBe('confirmado')
    expect(r.pendencias).toEqual([])
    expect(r.regularizarCartao).toBe(true)
    expect(r.avisos[0].mensagem).toContain('não foi consultado')
  })

  it('c2) igual a (b) com exceção tarifa cheia: soma integral, sem pendência de cartão', () => {
    const r = dia([perna('onibus_municipal_niteroi', '35', 0), perna('onibus_municipal_niteroi', '39A', 30)], cheia(ATIVO))
    expect(r.ida.valorCentavos).toBe(1120)
    expect(r.valorCentavos).toBe(2240)
    expect(r.status).toBe('confirmado')
    expect(r.politicaIntegracao).toBe('tarifa_cheia')
    expect(r.regularizarCartao).toBe(false)
    expect(cita(r, 'tarifa cheia')).toBe(true)
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

  it('h) 536R + municipal de Niterói 35: integra pelo BUI (extratos Riocard, 24/11/2026)', () => {
    const r = dia([perna('onibus_intermunicipal', '536R', 0), perna('onibus_municipal_niteroi', '35', 40)], ATIVO)
    expect(r.ida.valorCentavos).toBe(940)
    expect(r.valorCentavos).toBe(1880)
    expect(r.status).toBe('confirmado')
    expect(cita(r, '§4')).toBe(true)
  })

  it('i) igual a (g) com BUI suspenso: integra (presumida) e avisa para regularizar', () => {
    const r = dia([perna('onibus_intermunicipal', '483M', 0), perna('onibus_municipal_sao_goncalo', '10', 40)], SUSPENSO)
    expect(r.ida.valorCentavos).toBe(940)
    expect(r.valorCentavos).toBe(1880)
    expect(r.status).toBe('confirmado')
    expect(r.regularizarCartao).toBe(true)
    expect(r.avisos[0].mensagem).toContain('Suspenso Setrans')
  })

  it('i2) igual a (g) com exceção tarifa cheia: soma integral (SG a conferir)', () => {
    const r = dia([perna('onibus_intermunicipal', '483M', 0), perna('onibus_municipal_sao_goncalo', '10', 40)], cheia(SUSPENSO))
    expect(r.ida.valorCentavos).toBe(1465)
    expect(r.valorCentavos).toBe(2930)
    expect(r.status).toBe('pendente')
    const codigos = r.pendencias.map((p) => p.codigo)
    expect(codigos).not.toContain('BUI_SUSPENSO')
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

  it('k2) trem + metrô com "Não possui BU": integra (presumida) — 940', () => {
    const r = dia([perna('trem', null, 0), perna('metro', null, 30)], SEM_BU)
    expect(r.ida.valorCentavos).toBe(940)
    expect(r.status).toBe('confirmado')
    expect(r.regularizarCartao).toBe(true)
  })

  it('k3) trem + metrô com exceção tarifa cheia: 760 + 790', () => {
    const r = dia([perna('trem', null, 0), perna('metro', null, 30)], cheia(SEM_BU))
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
    // Segue pendente pelas 3 conduções; o ônibus do Rio (R$ 5,00 no Jaé) deixou
    // de ser "a conferir" em 28/11/2026 — o SG municipal entra no par do BUI.
    expect(r.status).toBe('pendente')
    expect(r.pendencias.some((p) => p.codigo === 'TARIFA_A_CONFERIR')).toBe(false)
  })

  it('m) só ônibus municipal do Rio (Jaé): R$ 5,00 confirmado pela gestora (28/11/2026)', () => {
    const r = dia([perna('onibus_municipal_rio', '474')], ATIVO)
    expect(r.ida.valorCentavos).toBe(500)
    expect(r.valorCentavos).toBe(1000)
    expect(r.status).toBe('confirmado')
    expect(r.pendencias.some((p) => p.codigo === 'TARIFA_A_CONFERIR')).toBe(false)
  })
})

describe('BUN — elegibilidade e limites', () => {
  const duas = (min2: number, linha2 = '39A') => [
    perna('onibus_municipal_niteroi', '35', 0),
    perna('onibus_municipal_niteroi', linha2, min2),
  ]

  it('Suspenso Setrans: integra (presumida), R$ 5,60 no trecho, com aviso de regularizar', () => {
    const r = dia(duas(30), SUSPENSO)
    expect(r.ida.valorCentavos).toBe(445)
    expect(r.valorCentavos).toBe(890)
    expect(r.status).toBe('confirmado')
    expect(r.pendencias).toEqual([])
    expect(r.regularizarCartao).toBe(true)
    expect(r.avisos).toEqual([
      {
        codigo: 'REGULARIZAR_CARTAO',
        mensagem: 'Seu Bilhete Único consta como Suspenso Setrans na Riocard. O VT é calculado com a integração; regularize seu cartão para não pagar a diferença.',
      },
    ])
  })

  it('Não possui BU: integra (presumida), R$ 5,60 no trecho, com aviso de regularizar', () => {
    const r = dia(duas(30), SEM_BU)
    expect(r.ida.valorCentavos).toBe(445)
    expect(r.status).toBe('confirmado')
    expect(r.regularizarCartao).toBe(true)
    expect(r.avisos[0].mensagem).toContain('Não possui BU')
  })

  it('Portal diz BUN não habilitado: ainda presume (política da empresa)', () => {
    const r = dia(duas(30), { ...ATIVO, bunConfirmadoNoPortal: false })
    expect(r.ida.valorCentavos).toBe(445)
    expect(r.status).toBe('confirmado')
  })

  it('Ativado: sem aviso de regularizar', () => {
    const r = dia(duas(30), ATIVO)
    expect(r.regularizarCartao).toBe(false)
    expect(r.avisos).toEqual([])
    expect(r.politicaIntegracao).toBe('presumida')
  })

  it('presumida não dispensa as outras condições: 61 min continua sem integração', () => {
    expect(dia(duas(61), SUSPENSO).valorCentavos).toBe(2010)
  })

  it('exceção tarifa cheia: cobra cada ônibus mesmo com BU ativo', () => {
    const r = dia(duas(30), cheia(ATIVO))
    expect(r.valorCentavos).toBe(2240)
    expect(r.status).toBe('confirmado')
  })

  it('Suspenso Setrans com confirmação no Portal: integra', () => {
    const r = dia(duas(30), { ...SUSPENSO, bunConfirmadoNoPortal: true })
    expect(r.valorCentavos).toBe(890)
    expect(r.status).toBe('confirmado')
  })

  it('mesma linha: não integra', () => {
    const r = dia(duas(30, '35'), ATIVO)
    expect(r.valorCentavos).toBe(2010)
    expect(r.status).toBe('confirmado')
    expect(cita(r, '§3')).toBe(true)
  })

  it('61 minutos: não integra; 60 minutos: integra', () => {
    expect(dia(duas(61), ATIVO).valorCentavos).toBe(2010)
    expect(dia(duas(60), ATIVO).valorCentavos).toBe(890)
  })

  it('sem horário de embarque não prova a janela: não integra e pendência', () => {
    const sem: PernaMotor[] = [
      { modal: 'onibus_municipal_niteroi', linha: '35' },
      { modal: 'onibus_municipal_niteroi', linha: '39A' },
    ]
    const r = dia(sem, ATIVO)
    expect(r.valorCentavos).toBe(2010)
    expect(r.status).toBe('pendente')
  })
})

describe('BUI — elegibilidade, teto e simetria', () => {
  it('BUI suspenso: integra (presumida); com a exceção, soma das integrais', () => {
    const r = dia([perna('trem', null, 0), perna('metro', null, 30)], SUSPENSO)
    expect(r.ida.valorCentavos).toBe(940)
    expect(r.status).toBe('confirmado')
    const c = dia([perna('trem', null, 0), perna('metro', null, 30)], cheia(SUSPENSO))
    expect(c.ida.valorCentavos).toBe(1550)
    expect(c.status).toBe('confirmado')
  })

  it('intermunicipal + municipal do Rio com Suspenso: integra pelo BUI (presumida)', () => {
    const r = dia([perna('onibus_intermunicipal', '484M', 0), perna('onibus_municipal_rio', 'X', 30)], SUSPENSO)
    expect(r.ida.valorCentavos).toBe(940)
    expect(r.regularizarCartao).toBe(true)
    expect(cita(r, 'BUI')).toBe(true)
    const c = dia([perna('onibus_intermunicipal', '484M', 0), perna('onibus_municipal_rio', 'X', 30)], cheia(SUSPENSO))
    expect(c.ida.valorCentavos).toBe(710 + 500)
  })

  it('intermunicipal + municipal de Niterói entra no BUI (presumido, qualquer situação do cartão)', () => {
    for (const cartao of [SUSPENSO, SEM_BU, SEM_CONSULTA]) {
      const r = dia([perna('onibus_intermunicipal', '536R', 0), perna('onibus_municipal_niteroi', '35', 40)], cartao)
      expect(r.ida.valorCentavos).toBe(940)
    }
    // exceção tarifa cheia: soma integral
    const c = dia([perna('onibus_intermunicipal', '536R', 0), perna('onibus_municipal_niteroi', '35', 40)], cheia(ATIVO))
    expect(c.ida.valorCentavos).toBe(1470)
  })

  it('casos reais dos extratos Riocard (nov/2026): intermunicipal + Niterói = 9,40 nos dois sentidos', () => {
    // 515M (7,10) -> 30 (Niterói): 7,10 + 2,30
    expect(dia([perna('onibus_intermunicipal', '515M', 0), perna('onibus_municipal_niteroi', '30', 110)], ATIVO).ida.valorCentavos).toBe(940)
    // 30 (Niterói) -> 515M: 4,45 + 4,95, ordem invertida
    expect(dia([perna('onibus_municipal_niteroi', '30', 0), perna('onibus_intermunicipal', '515M', 140)], ATIVO).ida.valorCentavos).toBe(940)
    // 33 -> 532M
    expect(dia([perna('onibus_municipal_niteroi', '33', 0), perna('onibus_intermunicipal', '532M', 33)], ATIVO).ida.valorCentavos).toBe(940)
    // 491M -> 33 (caso Thiago Lontra: antes 13,55)
    expect(dia([perna('onibus_intermunicipal', '491M', 0), perna('onibus_municipal_niteroi', '33', 40)], ATIVO).ida.valorCentavos).toBe(940)
  })

  it('Niterói + modal sem evidência (SG municipal) segue sem integração', () => {
    const r = dia([perna('onibus_municipal_sao_goncalo', '10', 0), perna('onibus_municipal_niteroi', '35', 40)], ATIVO)
    expect(cita(r, 'Niterói só integra com intermunicipal')).toBe(true)
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
    expect(r.ida.valorCentavos).toBe(940 + 445)
    expect(r.valorCentavos).toBe(2770)
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
    expect(amb.pendencias[0].codigo).toBe('DETRO_SECAO_ESCOLHER')
    expect(amb.pendencias[0].mensagem).toContain('Escolher o trecho (seção) da linha 416M')
    expect(amb.pendencias[0].mensagem).toContain('Percurso inteiro')
    expect(amb.pendencias[0].mensagem).toContain('Alcântara - Niterói')
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
  it('536R + 35 = 940 por sentido (BUI integra com Niterói; antes 1355)', () => {
    const r = calcularSentido({
      pernas: [perna('onibus_intermunicipal', '536R', 0), perna('onibus_municipal_niteroi', '35', 40)],
      cartao: SUSPENSO,
      dataServico: DATA,
    })
    expect(r.valorCentavos).toBe(940)
    expect(r.status).toBe('confirmado')
  })

  it('62 + 39A = 445 por sentido (presumida ou BUN no Portal) e 1120 com a exceção', () => {
    const pernas = [perna('onibus_municipal_niteroi', '62', 0), perna('onibus_municipal_niteroi', '39A', 18)]
    const presumida = calcularSentido({ pernas, cartao: SUSPENSO, dataServico: DATA })
    expect(presumida.valorCentavos).toBe(445)
    expect(presumida.status).toBe('confirmado')
    expect(presumida.regularizarCartao).toBe(true)
    const sem = calcularSentido({ pernas, cartao: cheia(SUSPENSO), dataServico: DATA })
    expect(sem.valorCentavos).toBe(1120)
    expect(sem.status).toBe('confirmado')
    const com = calcularSentido({ pernas, cartao: { ...SUSPENSO, bunConfirmadoNoPortal: true }, dataServico: DATA })
    expect(com.valorCentavos).toBe(445)
    expect(com.status).toBe('confirmado')
    expect(com.explicacao.some((p) => p.regra.includes('§3'))).toBe(true)
  })
})


describe('Niterói com BUN: R$ 4,45 e limite de 2 viagens com desconto por dia (decisão de 19/11/2026)', () => {
  const textos = (r: ResultadoDiaMotor) => r.explicacao.map((p) => p.texto)

  it('1 ônibus em cada sentido = R$ 8,90 por dia, com a linha e o valor explicados', () => {
    const r = dia([perna('onibus_municipal_niteroi', '39A')], ATIVO)
    expect(r.valorCentavos).toBe(890)
    expect(textos(r)).toContain('Ida: Ônibus 39A (municipal de Niterói): R$ 4,45 com o Bilhete Único de Niterói.')
  })

  it('2 ônibus integrados em cada sentido = R$ 8,90 por dia', () => {
    const r = dia([perna('onibus_municipal_niteroi', '62', 0), perna('onibus_municipal_niteroi', '39A', 30)], ATIVO)
    expect(r.ida.valorCentavos).toBe(445)
    expect(r.volta.valorCentavos).toBe(445)
    expect(r.valorCentavos).toBe(890)
    expect(textos(r)).toContain('Ida: Ônibus 62 + 39A: R$ 4,45 no total, porque o segundo ônibus foi pego em até 1 hora.')
  })

  it('3ª viagem paga no dia = R$ 5,60 (ida com 2 ônibus sem integração, volta com 1)', () => {
    const r = calcularDia({
      itinerario: {
        ida: [perna('onibus_municipal_niteroi', '35', 0), perna('onibus_municipal_niteroi', '39A', 90)],
        volta: [perna('onibus_municipal_niteroi', '39A', 0)],
      },
      cartao: ATIVO,
      dataServico: DATA,
    })
    expect(r.ida.valorCentavos).toBe(890)
    expect(r.ida.viagensNiteroiPagas).toBe(2)
    expect(r.volta.valorCentavos).toBe(560)
    expect(r.valorCentavos).toBe(1450)
    expect(r.status).toBe('confirmado')
    expect(textos(r).some((t) => t.includes('R$ 5,60') && t.includes('2 primeiras viagens'))).toBe(true)
  })

  it('integração que cai além do limite também sai a R$ 5,60', () => {
    const r = calcularDia({
      itinerario: {
        ida: [perna('onibus_municipal_niteroi', '35', 0), perna('onibus_municipal_niteroi', '39A', 90)],
        volta: [perna('onibus_municipal_niteroi', '62', 0), perna('onibus_municipal_niteroi', '39A', 30)],
      },
      cartao: ATIVO,
      dataServico: DATA,
    })
    expect(r.volta.valorCentavos).toBe(560)
    expect(r.valorCentavos).toBe(890 + 560)
  })

  it('exceção tarifa cheia: R$ 5,60 por ônibus, R$ 11,20 por dia com 1 ônibus em cada sentido', () => {
    const r = dia([perna('onibus_municipal_niteroi', '39A')], cheia(ATIVO))
    expect(r.valorCentavos).toBe(1120)
    expect(textos(r)).toContain('Ida: Ônibus 39A (municipal de Niterói): R$ 5,60.')
  })

  it('barca não mudou: continua sem valor calculado (pendência própria)', () => {
    const r = dia([perna('onibus_municipal_niteroi', '39A', 0), perna('barca', null, 30)], ATIVO)
    expect(r.valorCentavos).toBeNull()
    expect(r.status).toBe('indeterminado')
    expect(r.pendencias.some((p) => p.codigo === 'BARCA_TARIFA_PROPRIA')).toBe(true)
  })
})
