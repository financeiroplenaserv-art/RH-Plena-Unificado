import { supabase } from '@/lib/supabase'
import type { ContratoAdicional, VinculoAdicional, DiaCalendarioAdicional } from '@/types/adicionais'
import type { Colaborador, Departamento } from '@/types/database'

const PDF_COLABORADORES = [
  { nome: 'Acacio', matricula: '772' },
  { nome: 'Adailton', matricula: '845' },
  { nome: 'Adalto', matricula: '846' },
  { nome: 'Adriana', matricula: '813' },
  { nome: 'Adriano', matricula: '814' },
]

interface DadosCorrecao {
  departamentos: Departamento[]
  colaboradores: Colaborador[]
  contratos: ContratoAdicional[]
  vinculos: VinculoAdicional[]
  calendario: DiaCalendarioAdicional[]
}

interface ResumoCorrecao {
  ok: boolean
  mensagem: string
  detalhes: string[]
}

export function mockKey(tabela: string) {
  return `mock_${tabela}_adicionais`
}

function lerMock<T>(tabela: string): T[] {
  try {
    const raw = localStorage.getItem(mockKey(tabela))
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function salvarMock<T>(tabela: string, dados: T[]) {
  localStorage.setItem(mockKey(tabela), JSON.stringify(dados))
}

function gerarId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function normalizarMatricula(m: string | null | undefined) {
  return String(m || '').replace(/\D/g, '').replace(/^0+/, '') || '0'
}

function encontrarColaborador(colaboradores: Colaborador[], matricula: string) {
  return colaboradores.find(c => normalizarMatricula(c.matricula) === normalizarMatricula(matricula))
}

function encontrarVinculo(vinculos: VinculoAdicional[], colaboradorId: string, contratoId: string) {
  return vinculos.find(v => v.colaborador_id === colaboradorId && v.contrato_id === contratoId)
}

function listarVinculosAtivos(vinculos: VinculoAdicional[], colaboradores: Colaborador[], contratos: ContratoAdicional[], inicio: string, fim: string) {
  console.log(`\n=== Vinculos ativos de ${inicio} a ${fim} ===`)
  const ativos = vinculos.filter(v => v.data_inicio <= fim && v.data_fim >= inicio)
  if (ativos.length === 0) {
    console.log('  Nenhum vinculo ativo no periodo.')
    return
  }
  ativos.forEach(v => {
    const col = colaboradores.find(c => c.id === v.colaborador_id)
    const contrato = contratos.find(c => c.id === v.contrato_id)
    const adicionais = contrato
      ? Object.entries(contrato.adicionais)
          .filter(([, ativo]) => ativo)
          .map(([k]) => k)
          .join(', ')
      : '-'
    console.log(`  ${col?.nome_completo || '-'} | ${contrato?.nome || '-'} | adicionais: [${adicionais}] | ${v.data_inicio} a ${v.data_fim}`)
  })
}

function verificarColaboradoresPDF(colaboradores: Colaborador[], contratos: ContratoAdicional[], vinculos: VinculoAdicional[]) {
  console.log('\n=== Colaboradores do PDF ===')
  PDF_COLABORADORES.forEach(p => {
    const col = encontrarColaborador(colaboradores, p.matricula)
    if (!col) {
      console.log(`  ${p.nome} (${p.matricula}): NAO CADASTRADO`)
      return
    }
    const vincs = vinculos.filter(v => v.colaborador_id === col.id)
    if (vincs.length === 0) {
      console.log(`  ${col.nome_completo} (${col.matricula}): CADASTRADO, mas SEM VINCULO`)
      return
    }
    vincs.forEach(v => {
      const contrato = contratos.find(c => c.id === v.contrato_id)
      console.log(`  ${col.nome_completo} (${col.matricula}): vinculado a "${contrato?.nome}" de ${v.data_inicio} a ${v.data_fim}`)
    })
  })
}

function corrigirIntrajornadaAdailton(dados: DadosCorrecao) {
  console.log('\n=== Correcao Intrajornada Adailton ===')
  const col = encontrarColaborador(dados.colaboradores, '845')
  if (!col) {
    console.log('  Adailton nao encontrado.')
    return
  }
  const vincs = dados.vinculos.filter(v => v.colaborador_id === col.id)
  if (vincs.length === 0) {
    console.log('  Adailton nao tem vinculo.')
    return
  }
  vincs.forEach(v => {
    const contrato = dados.contratos.find(c => c.id === v.contrato_id)
    if (!contrato) return
    console.log(`  Contrato atual: ${contrato.nome}`)
    console.log(`  Intrajornada ativa: ${contrato.adicionais.intrajornada}`)
    console.log(`  Dias intrajornada: [${contrato.dias_intrajornada.join(', ')}]`)

    if (!contrato.adicionais.intrajornada) {
      contrato.adicionais.intrajornada = true
      contrato.dias_intrajornada = [1, 2, 3, 4, 5]
      console.log('  -> Intrajornada ativada para Seg a Sex')
    }

    if (contrato.adicionais.intrajornada && contrato.dias_intrajornada.length === 0) {
      contrato.dias_intrajornada = [1, 2, 3, 4, 5]
      console.log('  -> Dias de intrajornada configurados para Seg a Sex')
    }
  })
}

function garantirVinculosPDF(dados: DadosCorrecao) {
  console.log('\n=== Garantir vinculos dos colaboradores do PDF ===')

  const contratoInsalubridade = dados.contratos.find(c => c.adicionais.insalubridade) || dados.contratos[0]
  const contratoNoturno = dados.contratos.find(c => c.adicionais.noturno) || dados.contratos[0]
  const contratoIntrajornada = dados.contratos.find(c => c.adicionais.intrajornada) || dados.contratos[0]

  if (!contratoInsalubridade || !contratoNoturno || !contratoIntrajornada) {
    console.log('  Nao ha contratos suficientes para criar os vinculos.')
    return
  }

  const mapaVinculosEsperados = [
    { matricula: '772', contrato: contratoNoturno },
    { matricula: '845', contrato: contratoIntrajornada },
    { matricula: '846', contrato: contratoNoturno },
    { matricula: '813', contrato: contratoInsalubridade },
    { matricula: '814', contrato: contratoInsalubridade },
  ]

  mapaVinculosEsperados.forEach(item => {
    const col = encontrarColaborador(dados.colaboradores, item.matricula)
    if (!col) {
      console.log(`  Matricula ${item.matricula}: colaborador nao cadastrado`)
      return
    }
    const vinculo = encontrarVinculo(dados.vinculos, col.id, item.contrato.id)
    if (vinculo) {
      console.log(`  ${col.nome_completo}: ja vinculado a "${item.contrato.nome}"`)
    } else {
      const novo: VinculoAdicional = {
        id: gerarId(),
        contrato_id: item.contrato.id,
        colaborador_id: col.id,
        data_inicio: '2026-05-20',
        data_fim: '2026-07-19',
        created_at: new Date().toISOString(),
      }
      dados.vinculos.push(novo)
      console.log(`  ${col.nome_completo}: CRIADO vinculo com "${item.contrato.nome}"`)
    }
  })
}

function removerAdilsonMuniz(dados: DadosCorrecao) {
  console.log('\n=== Remover Adilson Muniz ===')
  const idx = dados.colaboradores.findIndex(c => c.nome_completo.toLowerCase().includes('adilson'))
  if (idx < 0) {
    console.log('  Adilson Muniz nao encontrado.')
    return
  }
  const col = dados.colaboradores[idx]
  dados.colaboradores.splice(idx, 1)
  const vinculosAntes = dados.vinculos.length
  dados.vinculos = dados.vinculos.filter(v => v.colaborador_id !== col.id)
  const vinculosRemovidos = vinculosAntes - dados.vinculos.length
  dados.calendario = dados.calendario.filter(d => !dados.vinculos.some(v => v.id === d.vinculo_id && v.colaborador_id === col.id))
  console.log(`  Adilson Muniz removido. Vinculos removidos: ${vinculosRemovidos}`)
}

function calcularRelatorio(dados: DadosCorrecao, mes: number, ano: number) {
  console.log(`\n=== Relatorio ${mes}/${ano} ===`)
  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`
  const inicioMes = `${mesStr}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fimMes = `${mesStr}-${String(ultimoDia).padStart(2, '0')}`

  const vinculosAtivos = dados.vinculos.filter(v => v.data_inicio <= fimMes && v.data_fim >= inicioMes)

  vinculosAtivos.forEach(v => {
    const col = dados.colaboradores.find(c => c.id === v.colaborador_id)
    const contrato = dados.contratos.find(c => c.id === v.contrato_id)
    if (!col || !contrato) return

    const dias = dados.calendario.filter(d => d.vinculo_id === v.id && d.data >= inicioMes && d.data <= fimMes)
    const trabalhou = dias.filter(d => d.status === 'trabalhou').length
    const folga = dias.filter(d => d.status === 'folga' || d.status === 'folga_substituicao').length
    const falta = dias.filter(d => d.status === 'falta').length
    const ferias = dias.filter(d => d.status === 'ferias').length
    const afastado = dias.filter(d => d.status === 'afastado').length

    Object.entries(contrato.adicionais)
      .filter(([, ativo]) => ativo)
      .forEach(([adicional]) => {
        let intrajornada = 0
        if (adicional === 'intrajornada') {
          dias.filter(d => d.status === 'trabalhou').forEach(d => {
            const diaSemana = new Date(d.data + 'T00:00:00').getDay()
            if (contrato.dias_intrajornada.includes(diaSemana)) intrajornada++
          })
        }
        console.log(`  ${col.nome_completo} | ${contrato.nome} | ${adicional}: trabalhados=${trabalhou}, folgas=${folga}, faltas=${falta}, ferias=${ferias}, afastados=${afastado}, intrajornada=${intrajornada}`)
      })
  })
}

export function aplicarCorrecao(dados: DadosCorrecao): ResumoCorrecao {
  const detalhes: string[] = []

  console.log('Dados carregados:')
  console.log(`  Colaboradores: ${dados.colaboradores.length}`)
  console.log(`  Contratos: ${dados.contratos.length}`)
  console.log(`  Vinculos: ${dados.vinculos.length}`)
  console.log(`  Calendario: ${dados.calendario.length}`)

  listarVinculosAtivos(dados.vinculos, dados.colaboradores, dados.contratos, '2026-05-20', '2026-06-19')
  verificarColaboradoresPDF(dados.colaboradores, dados.contratos, dados.vinculos)
  corrigirIntrajornadaAdailton(dados)
  garantirVinculosPDF(dados)
  removerAdilsonMuniz(dados)

  calcularRelatorio(dados, 6, 2026)

  detalhes.push('Vinculos ativos listados no console')
  detalhes.push('Colaboradores do PDF verificados')
  detalhes.push('Intrajornada de Adailton corrigida')
  detalhes.push('Vinculos dos colaboradores do PDF garantidos')
  detalhes.push('Adilson Muniz removido')

  return {
    ok: true,
    mensagem: 'Correcao aplicada. Recarregando...',
    detalhes,
  }
}

async function carregarColaboradoresSupabase(): Promise<Colaborador[]> {
  try {
    const { data, error } = await supabase.from('colaboradores').select('*').order('nome_completo')
    if (error) {
      console.error('[Correção] Erro ao buscar colaboradores do Supabase:', error)
      return []
    }
    return (data || []) as Colaborador[]
  } catch (err) {
    console.error('[Correção] Erro inesperado ao buscar colaboradores:', err)
    return []
  }
}

export async function executarCorrecaoLocalStorage(): Promise<ResumoCorrecao> {
  const colaboradores = await carregarColaboradoresSupabase()
  const dados: DadosCorrecao = {
    departamentos: lerMock<Departamento>('departamentos'),
    colaboradores,
    contratos: lerMock<ContratoAdicional>('contratos'),
    vinculos: lerMock<VinculoAdicional>('vinculos'),
    calendario: lerMock<DiaCalendarioAdicional>('calendario'),
  }

  const resumo = aplicarCorrecao(dados)
  if (!resumo.ok) return resumo

  salvarMock('departamentos', dados.departamentos)
  salvarMock('contratos', dados.contratos)
  salvarMock('vinculos', dados.vinculos)
  salvarMock('calendario', dados.calendario)

  console.log('\nDados salvos no localStorage.')

  return resumo
}
