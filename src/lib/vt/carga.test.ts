import { describe, expect, it } from 'vitest'
import {
  agruparDiasPorPosto,
  aplicarCoberturas,
  calcularCargaMes,
  competenciaSeguinte,
  destinoFerias,
  rotuloCompetencia,
  situacaoCoberturaRelatorio,
  situacaoGravacaoCarga,
  prontaParaGravar,
  resolverPostoDoRelatorio,
  valorDaCarga,
  type FeriasBloco,
} from '@/lib/vt/carga'
import type { VtBilhete, VtCobertura, VtTrajeto } from '@/types/vt'

const BU_NITEROI: VtBilhete = {
  id: 'b2',
  nome: 'BU NITERÓI',
  valor_diario_centavos: 1120,
  vigente_desde: '2026-10-21',
  ativo: true,
  cartao_necessario: 'bun',
  usa_integracao: true,
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
    status: 'confirmado',
    valor_extra_centavos: 0,
    observacao: null,
    confirmado_por: null,
    confirmado_em: null,
    ...parcial,
  }
}

describe('competenciaSeguinte / rotuloCompetencia', () => {
  it('mês seguinte no mesmo ano', () => {
    expect(competenciaSeguinte('2026-10-21')).toBe('2026-11')
    expect(competenciaSeguinte('2026-01-31')).toBe('2026-02')
  })

  it('virada de ano: dezembro → janeiro do ano seguinte', () => {
    expect(competenciaSeguinte('2026-12-15')).toBe('2027-01')
  })

  it('rótulo pt-BR', () => {
    expect(rotuloCompetencia('2026-11')).toBe('novembro/2026')
    expect(rotuloCompetencia('2027-01')).toBe('janeiro/2027')
  })
})

describe('agruparDiasPorPosto', () => {
  const resolver = (nome: string) =>
    nome === 'ITAGUAÍ' ? { id: 'd1', rotulo: 'ITAGUAÍ' } : nome === 'CBO' ? { id: 'd2', rotulo: 'CBO' } : null

  it('conta dias distintos por posto; dia repetido no mesmo posto conta 1', () => {
    const { porColaborador, naoIdentificados } = agruparDiasPorPosto(
      [
        { colaborador_id: 'c1', data: '2026-11-03', local_nome: 'X', local_nome_curto: 'ITAGUAÍ' },
        { colaborador_id: 'c1', data: '2026-11-03', local_nome: 'X', local_nome_curto: 'ITAGUAÍ' },
        { colaborador_id: 'c1', data: '2026-11-04', local_nome: 'X', local_nome_curto: 'ITAGUAÍ' },
        { colaborador_id: 'c1', data: '2026-11-05', local_nome: 'Y', local_nome_curto: 'CBO' },
      ],
      resolver
    )
    expect(porColaborador.get('c1')?.get('d1')).toEqual({ dias: 2, rotulo: 'ITAGUAÍ', diasCobertura: 0, diasTreinamento: 0, datas: ['2026-11-03', '2026-11-04'] })
    expect(porColaborador.get('c1')?.get('d2')).toEqual({ dias: 1, rotulo: 'CBO', diasCobertura: 0, diasTreinamento: 0, datas: ['2026-11-05'] })
    expect(naoIdentificados.size).toBe(0)
  })

  it('local sem match acumula em naoIdentificados com o nome cru e os dias', () => {
    const { porColaborador, naoIdentificados } = agruparDiasPorPosto(
      [
        { colaborador_id: 'c1', data: '2026-11-03', local_nome: 'POSTO DESCONHECIDO', local_nome_curto: null },
        { colaborador_id: 'c1', data: '2026-11-04', local_nome: 'POSTO DESCONHECIDO', local_nome_curto: null },
        { colaborador_id: 'c2', data: '2026-11-04', local_nome: null, local_nome_curto: null },
      ],
      resolver
    )
    expect(porColaborador.size).toBe(0)
    expect(naoIdentificados.get('c1')?.get('POSTO DESCONHECIDO')).toBe(2)
    expect(naoIdentificados.get('c2')?.get('(sem local)')).toBe(1)
  })
})

describe('calcularCargaMes', () => {
  const bilhetes = [BU_NITEROI, BUI]

  it('1 posto: dias × custo do dia', () => {
    const r = calcularCargaMes(
      [{ departamento_id: 'd1', rotulo: 'ITAGUAÍ', dias: 12 }],
      [trajeto({})],
      bilhetes,
      '2026-10-21'
    )
    expect(r.detalhe).toEqual([
      {
        departamento_id: 'd1',
        posto: 'ITAGUAÍ',
        dias: 12,
        custo_dia_centavos: 1120,
        subtotal_centavos: 13440,
        valor_extra_centavos: 0,
        dias_cobertura: 0,
        dias_treinamento: 0,
        datas: [],
      },
    ])
    expect(r.necessidade_centavos).toBe(13440)
    expect(r.pendentes).toEqual([])
  })

  it('valor extra manual do trajeto entra no custo do dia e fica visível no detalhe (migration 166)', () => {
    const r = calcularCargaMes(
      [{ departamento_id: 'd1', rotulo: 'ITAGUAÍ', dias: 12 }],
      [trajeto({ valor_extra_centavos: 200 })],
      bilhetes,
      '2026-10-21'
    )
    expect(r.detalhe[0].custo_dia_centavos).toBe(1320)
    expect(r.detalhe[0].valor_extra_centavos).toBe(200)
    expect(r.detalhe[0].subtotal_centavos).toBe(12 * 1320)
    expect(r.necessidade_centavos).toBe(12 * 1320)
  })

  it('2 postos (transferência no meio do mês): soma os dois custos', () => {
    const r = calcularCargaMes(
      [
        { departamento_id: 'd1', rotulo: 'ITAGUAÍ', dias: 12 },
        { departamento_id: 'd2', rotulo: 'CBO', dias: 8 },
      ],
      [trajeto({}), trajeto({ id: 'tr2', departamento_id: 'd2', bilhete_id: BUI.id, escopo: 'intermunicipal' })],
      bilhetes,
      '2026-10-21'
    )
    expect(r.necessidade_centavos).toBe(12 * 1120 + 8 * 1880)
    expect(r.pendentes).toEqual([])
  })

  it('posto sem trajeto confirmado vai para pendentes e NÃO soma', () => {
    const r = calcularCargaMes(
      [
        { departamento_id: 'd1', rotulo: 'ITAGUAÍ', dias: 12 },
        { departamento_id: 'd2', rotulo: 'CBO', dias: 8 },
      ],
      [trajeto({}), trajeto({ id: 'tr2', departamento_id: 'd2', status: 'sugerido' })],
      bilhetes,
      '2026-10-21'
    )
    expect(r.necessidade_centavos).toBe(12 * 1120)
    expect(r.pendentes).toEqual([{ departamento_id: 'd2', rotulo: 'CBO', dias: 8 }])
  })
})

describe('valorDaCarga', () => {
  it('soma necessidade + ajuste', () => {
    expect(valorDaCarga(13440, 500)).toEqual({ valor_centavos: 13940, ajusteMaiorQueNecessidade: false })
    expect(valorDaCarga(13440, -500)).toEqual({ valor_centavos: 12940, ajusteMaiorQueNecessidade: false })
  })

  it('ajuste negativo maior que a necessidade trunca no piso 0 e avisa', () => {
    expect(valorDaCarga(1000, -1500)).toEqual({ valor_centavos: 0, ajusteMaiorQueNecessidade: true })
  })
})

describe('situacaoCoberturaRelatorio (completude de todos — 23/10/2026)', () => {
  it('dia sem posto identificado é o problema que aparece primeiro', () => {
    expect(
      situacaoCoberturaRelatorio({ diasTrabalhoIdentificados: 10, diasTrabalhoSemPosto: 2, diasAusencia: 0 })
    ).toBe('dias_sem_posto')
  })

  it('todo dia de trabalho com posto = escalado', () => {
    expect(
      situacaoCoberturaRelatorio({ diasTrabalhoIdentificados: 12, diasTrabalhoSemPosto: 0, diasAusencia: 0 })
    ).toBe('escalado')
  })

  it('mês inteiro de férias/afastado sem dia trabalhado = só ausências', () => {
    expect(
      situacaoCoberturaRelatorio({ diasTrabalhoIdentificados: 0, diasTrabalhoSemPosto: 0, diasAusencia: 30 })
    ).toBe('so_ausencias')
  })

  it('sem trabalho e sem ausência (só folga/vazio) = sem registro', () => {
    expect(
      situacaoCoberturaRelatorio({ diasTrabalhoIdentificados: 0, diasTrabalhoSemPosto: 0, diasAusencia: 0 })
    ).toBe('sem_registro')
  })
})

describe('aplicarCoberturas (ferista cobre férias — cobertura vence escala)', () => {
  const rotulo = (id: string) => (id === 'd9' ? 'FOREVER' : id)
  const cobertura = (parcial: Partial<VtCobertura>): VtCobertura => ({
    id: 'cb1',
    colaborador_id: 'c1',
    departamento_id: 'd9',
    data_inicio: '2026-11-10',
    data_fim: '2026-11-20',
    observacao: null,
    registrado_por: null,
    created_at: '2026-10-21T10:00:00Z',
    ...parcial,
  })
  const dia = (data: string, colaborador = 'c1') => ({
    colaborador_id: colaborador,
    data,
    local_nome: 'POSTO DA ESCALA',
    local_nome_curto: 'ITAGUAÍ',
  })
  // Resolver propositalmente não conhece FOREVER: se a cobertura passasse pelo
  // resolver, cairia como não identificado — o override pula o fuzzy.
  const resolver = () => null

  it('dia dentro da cobertura troca o posto e marca diasCobertura', () => {
    const linhas = aplicarCoberturas([dia('2026-11-10')], [cobertura({})], rotulo)
    const { porColaborador } = agruparDiasPorPosto(linhas, resolver)
    expect(porColaborador.get('c1')?.get('d9')).toEqual({ dias: 1, rotulo: 'FOREVER', diasCobertura: 1, diasTreinamento: 0, datas: ['2026-11-10'] })
    expect(porColaborador.get('c1')?.has('d1')).toBe(false)
  })

  it('dia fora do período segue a escala', () => {
    const linhas = aplicarCoberturas([dia('2026-11-21')], [cobertura({})], rotulo)
    expect(linhas[0].cobertura).toBeUndefined()
  })

  it('cobertura parcial: só os dias cobertos mudam de posto', () => {
    const linhas = aplicarCoberturas(
      [dia('2026-11-03'), dia('2026-11-10'), dia('2026-11-11'), dia('2026-11-25')],
      [cobertura({})],
      rotulo
    )
    expect(linhas.map((l) => l.cobertura?.departamento_id ?? null)).toEqual([null, 'd9', 'd9', null])
    const { porColaborador } = agruparDiasPorPosto(linhas, resolver)
    expect(porColaborador.get('c1')?.get('d9')).toEqual({ dias: 2, rotulo: 'FOREVER', diasCobertura: 2, diasTreinamento: 0, datas: ['2026-11-10', '2026-11-11'] })
  })

  it('sobreposição no mesmo dia: vale a cobertura mais recentemente criada', () => {
    const antiga = cobertura({ id: 'cb1', departamento_id: 'd8', created_at: '2026-10-20T10:00:00Z' })
    const recente = cobertura({ id: 'cb2', departamento_id: 'd9', created_at: '2026-10-21T10:00:00Z' })
    const linhas = aplicarCoberturas([dia('2026-11-10')], [antiga, recente], rotulo)
    expect(linhas[0].cobertura?.departamento_id).toBe('d9')
  })

  it('cobertura de OUTRO colaborador não interfere', () => {
    const linhas = aplicarCoberturas([dia('2026-11-10')], [cobertura({ colaborador_id: 'c2' })], rotulo)
    expect(linhas[0].cobertura).toBeUndefined()
  })

  it('sem coberturas devolve as linhas como estão', () => {
    const entrada = [dia('2026-11-10')]
    expect(aplicarCoberturas(entrada, [], rotulo)).toBe(entrada)
  })
})


describe('aplicarCoberturas — síntese de dias do ferista (relatório não mostra o destino)', () => {
  const rotulo = () => 'FOREVER'
  const cobertura = (parcial: Partial<VtCobertura>): VtCobertura => ({
    id: 'cb1',
    colaborador_id: 'c1',
    departamento_id: 'd9',
    data_inicio: '2026-11-10',
    data_fim: '2026-11-12',
    observacao: null,
    registrado_por: null,
    created_at: '2026-10-21T10:00:00Z',
    ...parcial,
  })
  const diaTrabalha = (data: string, colaborador = 'c1') => ({
    colaborador_id: colaborador,
    data,
    local_nome: 'POSTO BASE',
    local_nome_curto: 'ITAGUAÍ',
  })
  const marcas = (mapa: Record<string, string>) => new Map([['c1', new Map(Object.entries(mapa))]])

  it('folga do ferista no período da cobertura vira dia de trabalho no posto coberto', () => {
    const linhas = aplicarCoberturas(
      [],
      [cobertura({})],
      rotulo,
      marcas({ '2026-11-10': 'folga', '2026-11-11': 'vazio' })
    )
    // 10 (folga) e 11 (vazio) entram; 12 sem marca no relatório também entra
    // (ferista fora do relatório no dia = trabalha na cobertura).
    expect(linhas.map((l) => l.data)).toEqual(['2026-11-10', '2026-11-11', '2026-11-12'])
    expect(linhas.every((l) => l.cobertura?.departamento_id === 'd9')).toBe(true)
  })

  it('férias/afastado/atestado do ferista NUNCA viram trabalho, mesmo com cobertura', () => {
    const linhas = aplicarCoberturas(
      [],
      [cobertura({})],
      rotulo,
      marcas({ '2026-11-10': 'ferias', '2026-11-11': 'afastado', '2026-11-12': 'atestado' })
    )
    expect(linhas).toEqual([])
  })

  it('dia [T] no posto base no mesmo dia: a cobertura vence (troca o posto, não duplica)', () => {
    const linhas = aplicarCoberturas(
      [diaTrabalha('2026-11-10')],
      [cobertura({ data_inicio: '2026-11-10', data_fim: '2026-11-10' })],
      rotulo,
      marcas({})
    )
    expect(linhas).toHaveLength(1)
    expect(linhas[0].cobertura?.departamento_id).toBe('d9')
  })

  it('sem marcasPorDia (fluxo antigo), nada é sintetizado', () => {
    const linhas = aplicarCoberturas([], [cobertura({})], rotulo)
    expect(linhas).toEqual([])
  })

  it('declaração "sem cobertura" (ferista NULL) nunca cria nem altera dia', () => {
    const linhas = aplicarCoberturas(
      [diaTrabalha('2026-11-10')],
      [cobertura({ colaborador_id: null, ferias_colaborador_id: 'c2' })],
      rotulo,
      marcas({})
    )
    expect(linhas[0].cobertura).toBeUndefined()
  })
})

describe('destinoFerias', () => {
  const ferias: FeriasBloco = {
    colaborador_id: 'c1',
    data_inicio: '2026-11-01',
    data_fim: '2026-11-15',
  }
  const cobertura = (parcial: Partial<VtCobertura>): VtCobertura => ({
    id: 'cb1',
    colaborador_id: 'c9',
    ferias_colaborador_id: 'c1',
    departamento_id: 'd1',
    data_inicio: '2026-11-01',
    data_fim: '2026-11-15',
    observacao: null,
    registrado_por: null,
    created_at: '2026-10-21T10:00:00Z',
    ...parcial,
  })

  it('pendente quando nenhuma cobertura aponta para as férias', () => {
    expect(destinoFerias(ferias, [])).toEqual({ tipo: 'pendente' })
    expect(destinoFerias(ferias, [cobertura({ ferias_colaborador_id: 'c2' })])).toEqual({ tipo: 'pendente' })
  })

  it('coberta quando a cobertura tem ferista', () => {
    expect(destinoFerias(ferias, [cobertura({})]).tipo).toBe('coberta')
  })

  it('sem_cobertura quando a cobertura tem ferista NULL (declaração)', () => {
    expect(destinoFerias(ferias, [cobertura({ colaborador_id: null })]).tipo).toBe('sem_cobertura')
  })

  it('cobertura de outro período (sem sobreposição) não conta', () => {
    const d = destinoFerias(ferias, [cobertura({ data_inicio: '2026-12-01', data_fim: '2026-12-15' })])
    expect(d.tipo).toBe('pendente')
  })

  it('treinamento (migration 160) NÃO é destino de férias — segue pendente', () => {
    expect(destinoFerias(ferias, [cobertura({ tipo: 'treinamento' })])).toEqual({ tipo: 'pendente' })
  })

  it('treinamento não tira o lugar da cobertura de férias no destino', () => {
    const d = destinoFerias(ferias, [
      cobertura({ id: 'cb1', tipo: 'treinamento' }),
      cobertura({ id: 'cb2' }),
    ])
    expect(d.tipo).toBe('coberta')
    expect(d.tipo === 'coberta' && d.cobertura.id).toBe('cb2')
  })
})

describe('treinamento com VT (migration 160 — ferista antes de cobrir / admitido em posto novo)', () => {
  const rotulo = () => 'FOREVER'
  const treinamento = (parcial: Partial<VtCobertura>): VtCobertura => ({
    id: 'tr1',
    tipo: 'treinamento',
    colaborador_id: 'c1',
    departamento_id: 'd9',
    data_inicio: '2026-11-08',
    data_fim: '2026-11-09',
    observacao: null,
    registrado_por: null,
    created_at: '2026-10-21T10:00:00Z',
    ...parcial,
  })
  const marcas = (mapa: Record<string, string>) => new Map([['c1', new Map(Object.entries(mapa))]])
  const resolver = () => null

  it('sintetiza dias de trabalho no posto do treinamento (folga e fora do relatório)', () => {
    const linhas = aplicarCoberturas(
      [],
      [treinamento({})],
      rotulo,
      marcas({ '2026-11-08': 'folga' })
    )
    expect(linhas.map((l) => l.data)).toEqual(['2026-11-08', '2026-11-09'])
    expect(linhas.every((l) => l.cobertura?.tipo === 'treinamento')).toBe(true)
    const { porColaborador } = agruparDiasPorPosto(linhas, resolver)
    expect(porColaborador.get('c1')?.get('d9')).toEqual({
      dias: 2,
      rotulo: 'FOREVER',
      diasCobertura: 0,
      diasTreinamento: 2,
      datas: ['2026-11-08', '2026-11-09'],
    })
  })

  it('férias/afastado/atestado NUNCA viram treinamento', () => {
    const linhas = aplicarCoberturas(
      [],
      [treinamento({})],
      rotulo,
      marcas({ '2026-11-08': 'ferias', '2026-11-09': 'atestado' })
    )
    expect(linhas).toEqual([])
  })

  it('cobertura sem tipo (linha antiga) conta como cobertura de férias, não treinamento', () => {
    const linhas = aplicarCoberturas(
      [{ colaborador_id: 'c1', data: '2026-11-08', local_nome: 'X', local_nome_curto: 'Y' }],
      [treinamento({ tipo: undefined })],
      rotulo
    )
    expect(linhas[0].cobertura?.tipo).toBe('ferias')
    const { porColaborador } = agruparDiasPorPosto(linhas, resolver)
    expect(porColaborador.get('c1')?.get('d9')).toEqual({
      dias: 1,
      rotulo: 'FOREVER',
      diasCobertura: 1,
      diasTreinamento: 0,
      datas: ['2026-11-08'],
    })
  })

  it('dias de treinamento somam na carga com o custo do posto (recebem VT)', () => {
    const r = calcularCargaMes(
      [{ departamento_id: 'd1', rotulo: 'ITAGUAÍ', dias: 12, diasCobertura: 0, diasTreinamento: 2 }],
      [trajeto({})],
      [BU_NITEROI],
      '2026-10-21'
    )
    expect(r.necessidade_centavos).toBe(12 * 1120)
    expect(r.detalhe[0].dias_treinamento).toBe(2)
    expect(r.detalhe[0].dias_cobertura).toBe(0)
  })
})

describe('resolverPostoDoRelatorio (texto antigo do Flit → linha ATIVA)', () => {
  const dep = (id: string, nome: string, nome_curto: string | null, status: string) => ({
    id,
    nome,
    nome_curto,
    status,
    empresa_id: null,
  })
  const deps = [
    dep('87027244', 'CNOCC PETROLEUM BRASIL LTDA', 'CNOOC', 'Inativo'),
    dep('b6a07cb5', 'CNOOC PETROLEUM BRASIL LTDA', 'CNOOC', 'Ativo'),
    dep('97806df1-396b-4a05-97f5-9ddb8c49582f', 'CONDOMINIO DO EDIFICIO RESIDENCIAL DALIAS', 'DALIAS', 'Inativo'),
    dep('8eb83a32-e1f7-454f-9e53-3134bf887a26', 'CONDOMINIO DO EDIFICIO RESIDENCIAL ROSAS', 'ITAGUAÍ', 'Ativo'),
    dep('so-inativa', 'CONTRATO ENCERRADO LTDA', 'ENCERRADO', 'Inativo'),
  ]

  it('texto que casa exato com a linha inativa segue o redirect/irmã ativa', () => {
    expect(resolverPostoDoRelatorio(deps, 'CNOCC PETROLEUM BRASIL LTDA')?.id).toBe('b6a07cb5')
    expect(resolverPostoDoRelatorio(deps, 'CONDOMINIO DO EDIFICIO RESIDENCIAL DALIAS')?.id).toBe(
      '8eb83a32-e1f7-454f-9e53-3134bf887a26',
    )
  })

  it('inativa sem destino ativo é mantida (pendência visível, não some)', () => {
    expect(resolverPostoDoRelatorio(deps, 'CONTRATO ENCERRADO LTDA')?.id).toBe('so-inativa')
  })

  it('sem match devolve null', () => {
    expect(resolverPostoDoRelatorio(deps, 'POSTO QUE NAO EXISTE XYZ')).toBeNull()
  })
})

describe('situacaoGravacaoCarga (banner "a carga está gravada?" — incidente de 25/10/2026)', () => {
  it('nada no banco = não gravada, mesmo com cálculo pronto', () => {
    expect(situacaoGravacaoCarga([], ['a', 'b'])).toBe('nao_gravada')
    expect(situacaoGravacaoCarga([], [])).toBe('nao_gravada')
  })

  it('mesmo conjunto de colaboradores = gravada (ordem não importa)', () => {
    expect(situacaoGravacaoCarga(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe('gravada')
  })

  it('conjuntos diferentes = parcial, mesmo com a MESMA contagem', () => {
    expect(situacaoGravacaoCarga(['a', 'b'], ['a', 'c'])).toBe('parcial')
    expect(situacaoGravacaoCarga(['a'], ['a', 'b'])).toBe('parcial')
    expect(situacaoGravacaoCarga(['a', 'b'], ['a'])).toBe('parcial')
  })
})

describe('prontaParaGravar (filtro único do gravarCargas, da tela e do Excel)', () => {
  const base = { pendentes: [] as unknown[], diasSemPostoIdentificado: 0, semEscala: false }

  it('sem pendência, sem dia sem posto e no relatório = pronto', () => {
    expect(prontaParaGravar(base)).toBe(true)
  })

  it('trajeto pendente ou dia sem posto ou fora do relatório = não pronto', () => {
    expect(prontaParaGravar({ ...base, pendentes: [{ departamento_id: 'x' }] })).toBe(false)
    expect(prontaParaGravar({ ...base, diasSemPostoIdentificado: 2 })).toBe(false)
    expect(prontaParaGravar({ ...base, semEscala: true })).toBe(false)
  })
})
