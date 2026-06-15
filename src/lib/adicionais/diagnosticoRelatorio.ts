import { supabase } from '@/lib/supabase'
import type { ContratoAdicional, VinculoAdicional, DiaCalendarioAdicional } from '@/types/adicionais'
import type { Colaborador, Departamento } from '@/types/database'

interface DadosSistema {
  departamentos: Departamento[]
  colaboradores: Colaborador[]
  contratos: ContratoAdicional[]
  vinculos: VinculoAdicional[]
  calendario: DiaCalendarioAdicional[]
}

function mockKey(tabela: string) {
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

function normalizarMatricula(m: string | null | undefined) {
  return String(m || '').replace(/\D/g, '').replace(/^0+/, '') || '0'
}

function nomeDiaSemana(dataStr: string): string {
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  return dias[new Date(dataStr + 'T00:00:00').getDay()]
}

async function carregarColaboradoresSupabase(): Promise<Colaborador[]> {
  try {
    const { data, error } = await supabase.from('colaboradores').select('*').order('nome_completo')
    if (error) {
      console.error('[Diagnóstico] Erro ao buscar colaboradores do Supabase:', error)
      return []
    }
    return (data || []) as Colaborador[]
  } catch (err) {
    console.error('[Diagnóstico] Erro inesperado ao buscar colaboradores:', err)
    return []
  }
}

export async function carregarDadosSistema(): Promise<DadosSistema> {
  const colaboradores = await carregarColaboradoresSupabase()
  return {
    departamentos: lerMock<Departamento>('departamentos'),
    colaboradores,
    contratos: lerMock<ContratoAdicional>('contratos'),
    vinculos: lerMock<VinculoAdicional>('vinculos'),
    calendario: lerMock<DiaCalendarioAdicional>('calendario'),
  }
}

export function salvarDadosSistema(dados: DadosSistema) {
  salvarMock('departamentos', dados.departamentos)
  salvarMock('colaboradores', dados.colaboradores)
  salvarMock('contratos', dados.contratos)
  salvarMock('vinculos', dados.vinculos)
  salvarMock('calendario', dados.calendario)
}

export async function diagnosticarAdicionais(inicio = '2026-05-20', fim = '2026-06-19') {
  const dados = await carregarDadosSistema()

  console.log('=== DIAGNÓSTICO ADICIONAIS CONTRATUAIS ===')
  console.log(`Período analisado: ${inicio} a ${fim}`)
  console.log(`Colaboradores: ${dados.colaboradores.length}`)
  console.log(`Contratos: ${dados.contratos.length}`)
  console.log(`Vínculos: ${dados.vinculos.length}`)
  console.log(`Calendário: ${dados.calendario.length}`)

  console.log('\n--- Colaboradores no sistema ---')
  dados.colaboradores.forEach(c => {
    console.log(`  ${c.nome_completo} | matrícula: ${c.matricula} | id: ${c.id}`)
  })

  console.log('\n--- Contratos no sistema ---')
  dados.contratos.forEach(c => {
    const adicionaisAtivos = Object.entries(c.adicionais)
      .filter(([, ativo]) => ativo)
      .map(([k]) => k)
      .join(', ')
    console.log(`  ${c.nome} | adicionais: [${adicionaisAtivos}] | dias_intrajornada: [${(c.dias_intrajornada || []).join(', ')}]`)
  })

  console.log('\n--- Vínculos no sistema ---')
  dados.vinculos.forEach(v => {
    const col = dados.colaboradores.find(c => c.id === v.colaborador_id)
    const contrato = dados.contratos.find(c => c.id === v.contrato_id)
    console.log(`  ${col?.nome_completo || '?'} → ${contrato?.nome || '?'} (${v.data_inicio} a ${v.data_fim})`)
  })

  const alvos = ['772', '845', '846', '813', '814']
  console.log('\n--- Detalhamento por colaborador do PDF ---')

  alvos.forEach(matricula => {
    const col = dados.colaboradores.find(c => normalizarMatricula(c.matricula) === normalizarMatricula(matricula))
    if (!col) {
      console.log(`\nMatrícula ${matricula}: NÃO CADASTRADO`)
      return
    }

    const vincs = dados.vinculos.filter(v => v.colaborador_id === col.id)
    console.log(`\n${col.nome_completo} (${matricula})`)
    console.log(`  Vínculos: ${vincs.length}`)

    if (vincs.length === 0) {
      console.log('  → SEM VÍNCULO (não aparece no relatório)')
      return
    }

    vincs.forEach(v => {
      const contrato = dados.contratos.find(c => c.id === v.contrato_id)
      console.log(`  → Contrato: ${contrato?.nome || '?'}`)
      console.log(`    dias_intrajornada: [${(contrato?.dias_intrajornada || []).join(', ')}]`)

      const dias = dados.calendario
        .filter(d => d.vinculo_id === v.id && d.data >= inicio && d.data <= fim)
        .sort((a, b) => a.data.localeCompare(b.data))

      console.log(`    Dias no calendário no período: ${dias.length}`)
      dias.forEach(d => {
        console.log(`      ${d.data} (${nomeDiaSemana(d.data)}) | status: ${d.status}`)
      })

      const trabalhou = dias.filter(d => d.status === 'trabalhou').length
      const folga = dias.filter(d => d.status === 'folga' || d.status === 'folga_substituicao').length
      const falta = dias.filter(d => d.status === 'falta').length
      const ferias = dias.filter(d => d.status === 'ferias').length
      const afastado = dias.filter(d => d.status === 'afastado').length

      console.log(`    Resumo: ${trabalhou} trabalhou, ${folga} folga, ${falta} falta, ${ferias} férias, ${afastado} afastado`)

      if (contrato?.adicionais.intrajornada) {
        const intrajornada = dias.filter(d => {
          if (d.status !== 'trabalhou') return false
          const diaSemana = new Date(d.data + 'T00:00:00').getDay()
          return (contrato.dias_intrajornada || []).includes(diaSemana)
        }).length
        console.log(`    Intrajornada: ${intrajornada}`)
      }
    })
  })

  // Verifica Adilson Muniz
  console.log('\n--- Verificação Adilson Muniz ---')
  const idxAdilson = dados.colaboradores.findIndex(c => c.nome_completo.toLowerCase().includes('adilson'))
  if (idxAdilson >= 0) {
    console.log('  Adilson Muniz ENCONTRADO no sistema')
    const col = dados.colaboradores[idxAdilson]
    const vincsAdilson = dados.vinculos.filter(v => v.colaborador_id === col.id)
    const diasAdilson = dados.calendario.filter(d => vincsAdilson.some(v => v.id === d.vinculo_id))
    console.log(`  Vínculos: ${vincsAdilson.length}, Dias no calendário: ${diasAdilson.length}`)
  } else {
    console.log('  Adilson Muniz NÃO encontrado')
  }

  return dados
}

export async function removerAdilsonMuniz() {
  const dados = await carregarDadosSistema()
  console.log('\n=== Remover Adilson Muniz ===')
  const idx = dados.colaboradores.findIndex(c => c.nome_completo.toLowerCase().includes('adilson'))
  if (idx < 0) {
    console.log('  Adilson Muniz não encontrado.')
    return dados
  }
  const col = dados.colaboradores[idx]
  dados.colaboradores.splice(idx, 1)
  const vinculosAntes = dados.vinculos.length
  dados.vinculos = dados.vinculos.filter(v => v.colaborador_id !== col.id)
  const vinculosRemovidos = vinculosAntes - dados.vinculos.length
  dados.calendario = dados.calendario.filter(d => !dados.vinculos.some(v => v.id === d.vinculo_id && v.colaborador_id === col.id))
  console.log(`  Adilson Muniz removido. Vínculos removidos: ${vinculosRemovidos}`)
  salvarDadosSistema(dados)
  return dados
}

export function exportarDiagnosticoGlobal() {
  if (typeof window !== 'undefined') {
    ;(window as unknown as Record<string, unknown>).diagnosticarAdicionais = diagnosticarAdicionais
    ;(window as unknown as Record<string, unknown>).removerAdilsonMuniz = removerAdilsonMuniz
    console.log('Funções disponíveis no console: diagnosticarAdicionais(), removerAdilsonMuniz()')
  }
}
