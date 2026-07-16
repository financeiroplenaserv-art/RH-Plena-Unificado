import { readFileSync } from 'fs'
import { join } from 'path'
import { parsePontoPDF, normalizarMatricula, resumoPonto } from '../src/lib/adicionais/importarPonto'
import { diaIntrajornada } from '../src/lib/adicionais/calculoAdicionais'
import type { ContratoAdicional, VinculoAdicional, DiaCalendarioAdicional } from '../src/types/adicionais'
import type { Colaborador } from '../src/types/database'

const NOMES_DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function nomeDiaSemana(dataStr: string): string {
  return NOMES_DIA_SEMANA[new Date(dataStr + 'T00:00:00').getDay()]
}

const PDF_PATH = join(process.cwd(), 'public', 'teste para sistema.pdf')

function gerarId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

async function main() {
  console.log('=== TESTE COM PDF REAL ===\n')
  console.log('Arquivo:', PDF_PATH)

  const buffer = readFileSync(PDF_PATH)
  const file = new File([buffer], 'teste para sistema.pdf', { type: 'application/pdf' })

  const colaboradoresPDF = await parsePontoPDF(file)

  console.log('\n--- Resultado do parser ---')
  console.log(`Total de colaboradores parseados: ${colaboradoresPDF.length}`)

  for (const c of colaboradoresPDF) {
    const resumo = resumoPonto(c)
    console.log(`\n${c.nome} (matrícula: ${c.matricula || '-'}): ${c.dias.length} dias`)
    console.log(`  Período: ${c.periodoInicio} a ${c.periodoFim}`)
    console.log(`  Trabalhou: ${resumo.trabalhou}, Folga: ${resumo.folga}, Falta: ${resumo.falta}, Férias: ${resumo.ferias}, Afastado: ${resumo.afastado}, Revisão: ${resumo.revisao}`)
    console.log('  Dias detalhados:')
    for (const d of c.dias) {
      console.log(`    ${d.data} (${nomeDiaSemana(d.data)}) | ${d.status} | ${d.observacao || d.horarios.join(' ') || '-'}${d.revisao ? ' [REVISAR]' : ''}`)
    }
  }

  // Simulação dos dados do sistema conforme descrito pelo usuário
  console.log('\n--- Simulação dos vínculos do sistema ---')

  const contratos: ContratoAdicional[] = [
    {
      id: gerarId(),
      nome: 'Portaria Dia Exclusive',
      departamento_id: null,
      quantidade_colaboradores: 1,
      adicionais: { insalubridade: false, noturno: false, periculosidade: false, feriado: false, intrajornada: true },
      dias_intrajornada: [6, 0, 7], // sábado, domingo, feriado
    },
    {
      id: gerarId(),
      nome: 'Portaria Noite Exclusive',
      departamento_id: null,
      quantidade_colaboradores: 1,
      adicionais: { insalubridade: false, noturno: true, periculosidade: false, feriado: false, intrajornada: false },
      dias_intrajornada: [],
    },
    {
      id: gerarId(),
      nome: 'Limpeza Exclusive',
      departamento_id: null,
      quantidade_colaboradores: 1,
      adicionais: { insalubridade: true, noturno: false, periculosidade: false, feriado: false, intrajornada: false },
      dias_intrajornada: [],
    },
  ]

  const mapaContratos: Record<string, ContratoAdicional> = {
    '845': contratos[0], // Adailton -> Portaria Dia -> Intrajornada
    '846': contratos[1], // Adalto -> Portaria Noite -> Noturno
    '813': contratos[2], // Adriana -> Limpeza -> Insalubridade
  }

  const colaboradoresSistema: Colaborador[] = colaboradoresPDF.map(c => ({
    id: gerarId(),
    matricula: c.matricula,
    nome_completo: c.nome,
    cpf: null,
    rg: null,
    ctps: null,
    pis_pasep: null,
    data_admissao: null,
    data_demissao: null,
    data_nascimento: null,
    cargo: null,
    departamento: null,
    departamento_id: null,
    email: null,
    telefone: null,
    celular: null,
    cidade: null,
    estado: null,
    cep: null,
    endereco: null,
    status: 'Ativo',
    tipo_contrato: null,
    empresa_id: null,
    afastamento_motivo: null,
    afastamento_data_inicio: null,
    afastamento_data_fim: null,
    dados_completos: {},
  }))

  const vinculos: VinculoAdicional[] = []
  const calendario: DiaCalendarioAdicional[] = []

  for (const col of colaboradoresSistema) {
    const contrato = mapaContratos[normalizarMatricula(col.matricula)]
    if (!contrato) {
      console.log(`${col.nome_completo}: NAO VINCULADO (não deve aparecer no relatório)`)
      continue
    }

    const vinculo: VinculoAdicional = {
      id: gerarId(),
      contrato_id: contrato.id,
      colaborador_id: col.id,
      data_inicio: '2026-05-20',
      data_fim: '2026-07-19',
    }
    vinculos.push(vinculo)
    console.log(`${col.nome_completo} vinculado a "${contrato.nome}"`)

    const pdfCol = colaboradoresPDF.find(p => normalizarMatricula(p.matricula) === normalizarMatricula(col.matricula))
    if (!pdfCol) continue

    for (const d of pdfCol.dias) {
      calendario.push({
        vinculo_id: vinculo.id,
        data: d.data,
        status: d.status,
        intrajornada: false,
      })
    }
  }

  // Cálculo do relatório para o período 20/05 a 19/06/2026
  console.log('\n--- Relatório calculado (20/05/2026 a 19/06/2026) ---')

  const inicioMes = '2026-05-20'
  const fimMes = '2026-06-19'

  const vinculosAtivos = vinculos.filter(v => v.data_inicio <= fimMes && v.data_fim >= inicioMes)

  const resultado: Array<{
    colaborador: string
    contrato: string
    adicional: string
    trabalhados: number
    folgas: number
    faltas: number
    ferias: number
    afastados: number
    intrajornada: number
  }> = []

  for (const v of vinculosAtivos) {
    const col = colaboradoresSistema.find(c => c.id === v.colaborador_id)
    const contrato = contratos.find(c => c.id === v.contrato_id)
    if (!col || !contrato) continue

    const dias = calendario.filter(d => d.vinculo_id === v.id && d.data >= inicioMes && d.data <= fimMes)
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
            if (diaIntrajornada(contrato, d.data)) intrajornada++
          })
        }

        resultado.push({
          colaborador: col.nome_completo,
          contrato: contrato.nome,
          adicional,
          trabalhados: trabalhou,
          folgas: folga,
          faltas: falta,
          ferias,
          afastados: afastado,
          intrajornada,
        })

        console.log(`\n${col.nome_completo} | ${contrato.nome} | ${adicional}`)
        console.log(`  Trabalhados: ${trabalhou}`)
        console.log(`  Folgas: ${folga}`)
        console.log(`  Faltas: ${falta}`)
        console.log(`  Férias: ${ferias}`)
        console.log(`  Afastados: ${afastado}`)
        if (adicional === 'intrajornada') {
          console.log(`  Dias intrajornada (seg a sex): ${intrajornada}`)
        }
      })
  }

  console.log('\n--- Resumo final ---')
  console.log('Colaboradores vinculados no relatório:', resultado.length)
  console.log('Acacio e Adriano NAO aparecem (sem vínculo)')

  // Validações manuais
  console.log('\n--- Validações ---')
  const adailton = resultado.find(r => r.colaborador.toLowerCase().includes('adailton'))
  if (adailton) {
    console.log(`Adailton: trabalhados=${adailton.trabalhados}, intrajornada=${adailton.intrajornada}`)
    console.log(`  Esperado: intrajornada <= trabalhados e apenas dias seg a sex`)
  }

  const adalto = resultado.find(r => r.colaborador.toLowerCase().includes('adalto'))
  if (adalto) {
    console.log(`Adalto: trabalhados=${adalto.trabalhados}, ferias=${adalto.ferias}`)
    console.log(`  Esperado: ferias contadas separadamente; trabalhados incluem dias após férias`)
  }

  const adriana = resultado.find(r => r.colaborador.toLowerCase().includes('adriana'))
  if (adriana) {
    console.log(`Adriana: trabalhados=${adriana.trabalhados}, faltas=${adriana.faltas}, folgas=${adriana.folgas}`)
  }
}

main().catch(err => {
  console.error('Erro:', err)
  process.exit(1)
})
