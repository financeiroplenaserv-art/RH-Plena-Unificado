import { describe, it, expect } from 'vitest'
import {
  parsePaginasEspelho,
  casarColaborador,
  planejarOcorrencias,
  classificarRealizado,
  normalizarCPF,
  normalizarNome,
  extrairDiasDeclarados,
  marcarDuplicadas,
  montarPayloadInsert,
  type PaginaPDF,
  type EspelhoColaborador,
  type ColaboradorResumo,
  type ItemTextoPDF,
} from './importacaoPonto'

// ===================== Helpers de montagem de página sintética =====================

interface DiaSintetico {
  data: string // dd/mm/aa
  realizado: string
  justificativa?: string
}

function montarPagina(numero: number, nome: string, cpf: string, dias: DiaSintetico[]): PaginaPDF {
  const itens: ItemTextoPDF[] = []
  // Cabeçalho: linha do nome + período (y=800) e linha do CPF (y=780)
  itens.push({ x: 50, y: 800, texto: 'Colaborador:' })
  itens.push({ x: 110, y: 800, texto: nome })
  itens.push({ x: 420, y: 800, texto: 'Período:' })
  itens.push({ x: 470, y: 800, texto: '20/06/2026 - 19/07/2026' })
  itens.push({ x: 50, y: 780, texto: 'Colaborador CPF:' })
  itens.push({ x: 160, y: 780, texto: cpf })

  dias.forEach((dia, i) => {
    const y = 750 - i * 15
    itens.push({ x: 40, y, texto: `${dia.data} - Sáb` })
    itens.push({ x: 300, y, texto: dia.realizado })
    if (dia.justificativa) itens.push({ x: 650, y, texto: dia.justificativa })
  })

  return { numero, itens }
}

function montarEspelho(dias: DiaSintetico[], overrides?: Partial<EspelhoColaborador>): EspelhoColaborador {
  const pagina = montarPagina(1, overrides?.nomePdf ?? 'JOÃO DA SILVA', overrides?.cpfPdf ?? '123.456.789-00', dias)
  const [espelho] = parsePaginasEspelho([pagina])
  return { ...espelho, ...overrides }
}

const COLAB_JOAO: ColaboradorResumo = {
  id: 'colab-1',
  nome_completo: 'João da Silva Souza',
  cpf: '123.456.789-00',
  empresa_id: 'emp-1',
  status: 'Ativo',
}

// Dias de referência (julho/2026): 01=Qui, 02=Sex, 03=Sáb, 04=Dom, 05=Seg
const DIA = (dia: number, realizado: string, justificativa?: string): DiaSintetico => ({
  data: `${String(dia).padStart(2, '0')}/07/26`,
  realizado,
  justificativa,
})

const TRABALHADO = '06:51 12:00 (M) 13:00 19:05 (A)'

// ===================== Parse =====================

describe('parsePaginasEspelho', () => {
  it('extrai nome, CPF, período e dias do espelho', () => {
    const espelho = montarEspelho([DIA(1, TRABALHADO), DIA(2, 'Folga')])
    expect(espelho.nomePdf).toBe('JOÃO DA SILVA')
    expect(espelho.cpfPdf).toBe('123.456.789-00')
    expect(espelho.periodoInicio).toBe('20/06/2026')
    expect(espelho.periodoFim).toBe('19/07/2026')
    expect(espelho.dias).toHaveLength(2)
    expect(espelho.dias[0].data).toBe('2026-07-01')
    expect(espelho.dias[0].classificacao).toBe('trabalhado')
    expect(espelho.dias[1].classificacao).toBe('nao_trabalhado')
  })
})

// ===================== Classificação =====================

describe('classificarRealizado', () => {
  it('usa longest-match: "Falta BH" não é "Falta"', () => {
    expect(classificarRealizado('Falta BH')).toEqual({ categoria: 'Falta BH', classificacao: 'outro' })
    expect(classificarRealizado('Falta')).toEqual({ categoria: 'Falta', classificacao: 'falta' })
  })

  it('classifica demais categorias', () => {
    expect(classificarRealizado('Atestado').classificacao).toBe('atestado')
    expect(classificarRealizado('Folga').classificacao).toBe('nao_trabalhado')
    expect(classificarRealizado('Feriado').classificacao).toBe('nao_trabalhado')
    expect(classificarRealizado('Férias').classificacao).toBe('nao_trabalhado')
    expect(classificarRealizado('Afastado').classificacao).toBe('outro')
    expect(classificarRealizado('Suspensão').classificacao).toBe('outro')
    expect(classificarRealizado(TRABALHADO).classificacao).toBe('trabalhado')
  })
})

// ===================== Normalização e matching =====================

describe('normalização', () => {
  it('normaliza CPF removendo pontuação e completando zeros à esquerda', () => {
    expect(normalizarCPF('123.456.789-00')).toBe('12345678900')
    expect(normalizarCPF('123456789')).toBe('00123456789')
    expect(normalizarCPF(null)).toBe('00000000000')
  })

  it('normaliza nome: maiúsculas, sem acento, sem reticências', () => {
    expect(normalizarNome('João da Silv…')).toBe('JOAO DA SILV')
    expect(normalizarNome('  maria   josé ')).toBe('MARIA JOSE')
  })
})

describe('casarColaborador', () => {
  it('casa por CPF normalizado e valida nome (OK)', () => {
    // Nome do PDF truncado: o nome do CORH começa com o do PDF
    const { colaborador, match } = casarColaborador(
      { cpfPdf: '12345678900', nomePdf: 'JOÃO DA SILV…' },
      [COLAB_JOAO]
    )
    expect(match).toBe('OK')
    expect(colaborador?.id).toBe('colab-1')
  })

  it('marca NOME_DIVERGE quando os nomes não se contêm', () => {
    const { match } = casarColaborador(
      { cpfPdf: '123.456.789-00', nomePdf: 'CARLOS ALBERTO' },
      [COLAB_JOAO]
    )
    expect(match).toBe('NOME_DIVERGE')
  })

  it('marca NAO_ENCONTRADO quando não há CPF no cadastro', () => {
    const { colaborador, match } = casarColaborador(
      { cpfPdf: '999.999.999-99', nomePdf: 'MESA OPERACIONAL' },
      [COLAB_JOAO]
    )
    expect(match).toBe('NAO_ENCONTRADO')
    expect(colaborador).toBeNull()
  })

  it('prefere colaborador Ativo em CPF duplicado', () => {
    const inativo: ColaboradorResumo = { ...COLAB_JOAO, id: 'colab-2', status: 'Desligado' }
    const { colaborador } = casarColaborador(
      { cpfPdf: '123.456.789-00', nomePdf: 'JOÃO DA SILVA' },
      [inativo, COLAB_JOAO]
    )
    expect(colaborador?.id).toBe('colab-1')
  })
})

// ===================== Agrupamento de faltas =====================

describe('faltas', () => {
  it('agrupa faltas estritamente consecutivas em uma ocorrência', () => {
    const espelho = montarEspelho([DIA(2, 'Falta'), DIA(3, 'Falta'), DIA(4, 'Falta')])
    const planejadas = planejarOcorrencias(espelho, COLAB_JOAO, 'OK')
    expect(planejadas).toHaveLength(1)
    expect(planejadas[0].tipo).toBe('Falta Injustificada')
    expect(planejadas[0].dias).toBe(3)
    expect(planejadas[0].titulo).toBe('Falta injustificada — 3 dias (02/07/2026 a 04/07/2026)')
    expect(planejadas[0].status).toBe('Ativa') // Falta Injustificada não exige anexo
    expect(planejadas[0].macroGrupo).toBe('1. Jornada e Ponto')
  })

  it('falta nos dias 3 e 5 com folga no dia 4 gera 2 ocorrências separadas', () => {
    const espelho = montarEspelho([DIA(3, 'Falta'), DIA(4, 'Folga'), DIA(5, 'Falta')])
    const planejadas = planejarOcorrencias(espelho, COLAB_JOAO, 'OK')
    expect(planejadas).toHaveLength(2)
    expect(planejadas[0].titulo).toBe('Falta injustificada em 03/07/2026')
    expect(planejadas[1].titulo).toBe('Falta injustificada em 05/07/2026')
  })
})

// ===================== Agrupamento de atestados =====================

describe('atestados', () => {
  it('funde atestados dos dias 3 e 5 com folga no dia 4 em UMA ocorrência de 3 dias', () => {
    const espelho = montarEspelho([DIA(3, 'Atestado'), DIA(4, 'Folga'), DIA(5, 'Atestado')])
    const planejadas = planejarOcorrencias(espelho, COLAB_JOAO, 'OK')
    expect(planejadas).toHaveLength(1)
    expect(planejadas[0].tipo).toBe('Falta Justificada (atestado)')
    expect(planejadas[0].dataInicio).toBe('2026-07-03')
    expect(planejadas[0].dataFim).toBe('2026-07-05')
    expect(planejadas[0].dias).toBe(3) // dias corridos
    expect(planejadas[0].titulo).toBe('Atestado de 3 dias')
    expect(planejadas[0].status).toBe('Pendente') // exige anexo
  })

  it('quebra o período quando há dia trabalhado no meio', () => {
    const espelho = montarEspelho([DIA(3, 'Atestado'), DIA(4, TRABALHADO), DIA(5, 'Atestado')])
    const planejadas = planejarOcorrencias(espelho, COLAB_JOAO, 'OK')
    expect(planejadas).toHaveLength(2)
    expect(planejadas[0].titulo).toBe('Atestado de 1 dia')
    expect(planejadas[1].titulo).toBe('Atestado de 1 dia')
  })

  it('quebra o período quando há falta no meio (e gera a ocorrência de falta)', () => {
    const espelho = montarEspelho([DIA(3, 'Atestado'), DIA(4, 'Falta'), DIA(5, 'Atestado')])
    const planejadas = planejarOcorrencias(espelho, COLAB_JOAO, 'OK')
    const atestados = planejadas.filter((p) => p.tipo !== 'Falta Injustificada')
    const faltas = planejadas.filter((p) => p.tipo === 'Falta Injustificada')
    expect(atestados).toHaveLength(2)
    expect(faltas).toHaveLength(1)
  })

  it('funde pulando feriado e férias, mas não Falta BH', () => {
    const espelho = montarEspelho([DIA(3, 'Atestado'), DIA(4, 'Feriado'), DIA(5, 'Atestado')])
    expect(planejarOcorrencias(espelho, COLAB_JOAO, 'OK')).toHaveLength(1)

    const espelhoBH = montarEspelho([DIA(3, 'Atestado'), DIA(4, 'Falta BH'), DIA(5, 'Atestado')])
    expect(planejarOcorrencias(espelhoBH, COLAB_JOAO, 'OK')).toHaveLength(2)
  })
})

// ===================== Fronteiras de duração =====================

describe('classificação por duração', () => {
  function espelhoComAtestados(diaInicio: number, diaFim: number): EspelhoColaborador {
    const dias: DiaSintetico[] = []
    for (let d = diaInicio; d <= diaFim; d++) dias.push(DIA(d, 'Atestado'))
    return montarEspelho(dias)
  }

  it('8 dias → Falta Justificada (atestado)', () => {
    const [p] = planejarOcorrencias(espelhoComAtestados(1, 8), COLAB_JOAO, 'OK')
    expect(p.dias).toBe(8)
    expect(p.tipo).toBe('Falta Justificada (atestado)')
    expect(p.titulo).toBe('Atestado de 8 dias')
  })

  it('9 dias → Licença Médica (até 15 dias)', () => {
    const [p] = planejarOcorrencias(espelhoComAtestados(1, 9), COLAB_JOAO, 'OK')
    expect(p.tipo).toBe('Licença Médica (até 15 dias)')
    expect(p.titulo).toBe('Licença médica de 9 dias')
    expect(p.macroGrupo).toBe('4. Afastamentos e Licenças')
    expect(p.status).toBe('Pendente')
  })

  it('16 dias → Licença Médica (acima 15 dias — INSS)', () => {
    const [p] = planejarOcorrencias(espelhoComAtestados(1, 16), COLAB_JOAO, 'OK')
    expect(p.tipo).toBe('Licença Médica (acima 15 dias — INSS)')
    expect(p.titulo).toBe('Licença médica de 16 dias')
  })

  it('1 dia usa singular', () => {
    const [p] = planejarOcorrencias(espelhoComAtestados(3, 3), COLAB_JOAO, 'OK')
    expect(p.titulo).toBe('Atestado de 1 dia')
  })
})

// ===================== Aviso de divergência na justificativa =====================

describe('aviso de duração divergente', () => {
  it('extrai dias declarados da justificativa', () => {
    expect(extrairDiasDeclarados('Atestado 5 dias')).toBe(5)
    expect(extrairDiasDeclarados('Atestado 1 dia')).toBe(1)
    expect(extrairDiasDeclarados('Dispensado')).toBeNull()
  })

  it('marca aviso quando a justificativa diverge da duração calculada', () => {
    const espelho = montarEspelho([
      DIA(3, 'Atestado', 'Atestado 5 dias'),
      DIA(4, 'Folga'),
      DIA(5, 'Atestado'),
    ])
    const [p] = planejarOcorrencias(espelho, COLAB_JOAO, 'OK')
    expect(p.dias).toBe(3)
    expect(p.avisos).toHaveLength(1)
    expect(p.avisos[0]).toContain('5 dias')
    expect(p.avisos[0]).toContain('3 dias')
  })

  it('não marca aviso quando a justificativa confere', () => {
    const espelho = montarEspelho([
      DIA(3, 'Atestado', 'Atestado 3 dias'),
      DIA(4, 'Folga'),
      DIA(5, 'Atestado'),
    ])
    const [p] = planejarOcorrencias(espelho, COLAB_JOAO, 'OK')
    expect(p.avisos).toHaveLength(0)
  })
})

// ===================== Deduplicação =====================

describe('marcarDuplicadas', () => {
  it('marca ocorrências já existentes (colaborador + data + tipo)', () => {
    const espelho = montarEspelho([DIA(3, 'Falta'), DIA(5, 'Falta')])
    const planejadas = planejarOcorrencias(espelho, COLAB_JOAO, 'OK')
    const total = marcarDuplicadas(planejadas, [
      { colaborador_id: 'colab-1', data_ocorrencia: '2026-07-03', tipo_ocorrencia: 'Falta Injustificada' },
    ])
    expect(total).toBe(1)
    expect(planejadas[0].duplicada).toBe(true)
    expect(planejadas[1].duplicada).toBe(false)
  })
})

// ===================== Payload =====================

describe('montarPayloadInsert', () => {
  it('monta payload coerente com o formulário de ocorrências', () => {
    const espelho = montarEspelho([DIA(3, 'Falta')])
    const [p] = planejarOcorrencias(espelho, COLAB_JOAO, 'OK')
    const payload = montarPayloadInsert(p, 'user-1')

    expect(payload).toMatchObject({
      colaborador_id: 'colab-1',
      empresa_id: 'emp-1',
      colaborador_nome: 'João da Silva Souza',
      tipo_ocorrencia: 'Falta Injustificada',
      tipo_penalidade: 'Falta Injustificada',
      macro_grupo: '1. Jornada e Ponto',
      titulo: 'Falta injustificada em 03/07/2026',
      data_ocorrencia: '2026-07-03',
      data_hora_ocorrido: '2026-07-03',
      status: 'Ativa',
      gravidade: 'Moderada',
      defesa_funcionario: 'Não informada — importação do espelho de ponto.',
      medida_corretiva: 'Não informada — importação do espelho de ponto.',
      usuario_id: 'user-1',
    })
    expect(payload.base_legal).toContain('Art. 473')
    expect(payload.descricao).toContain('Dia 03/07/2026.')
    expect(payload.descricao).toContain('Importado do espelho de ponto 20/06/2026 a 19/07/2026 (página 1 do PDF).')
  })
})
