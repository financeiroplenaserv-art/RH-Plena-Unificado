import { jsPDF } from 'jspdf'
import fs from 'fs'
import { parsePontoPDF, normalizarMatricula } from '../src/lib/adicionais/importarPonto'
import { diaIntrajornada } from '../src/lib/adicionais/calculoAdicionais'
import type { ContratoAdicional, VinculoAdicional, DiaCalendarioAdicional } from '../src/types/adicionais'
import type { Colaborador, Departamento } from '../src/types/database'

// Mock localStorage
class LocalStorageMock {
  private store: Record<string, string> = {}
  getItem(key: string) {
    return this.store[key] ?? null
  }
  setItem(key: string, value: string) {
    this.store[key] = value
  }
  removeItem(key: string) {
    delete this.store[key]
  }
  clear() {
    this.store = {}
  }
}
;(globalThis as unknown as { localStorage: Storage }).localStorage = new LocalStorageMock() as unknown as Storage

const COLABORADORES = [
  { id: 'col-j', nome: 'JOAO TESTE', matricula: '999001', contratoId: 'cont-a' },
  { id: 'col-m', nome: 'MARIA TESTE', matricula: '999002', contratoId: 'cont-b' },
  { id: 'col-p', nome: 'PEDRO TESTE', matricula: '999003', contratoId: 'cont-c' },
]

function gerarPDF(): ArrayBuffer {
  const doc = new jsPDF()
  const dataInicio = new Date(2026, 5, 20) // 20/06/2026
  const dias: Date[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(dataInicio)
    d.setDate(dataInicio.getDate() + i)
    dias.push(d)
  }

  COLABORADORES.forEach((col, idx) => {
    if (idx > 0) doc.addPage()
    doc.setFontSize(12)
    doc.text('Colaborador:', 10, 20)
    doc.text(col.nome, 50, 20)
    doc.text('Matrícula:', 10, 30)
    doc.text(col.matricula, 50, 30)
    doc.text('Período: 20/06/2026 a 19/07/2026', 10, 40)

    let y = 60
    doc.text('Data', 10, y)
    doc.text('Realizado', 40, y)
    doc.text('H. trab.', 120, y)
    y += 8

    dias.forEach((d, i) => {
      const dataStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      const trabalhou = i % 2 === 0
      const realizado = trabalhou ? '07:00 12:00 13:00 17:00' : 'Folga'
      const hTrab = trabalhou ? '08:00' : '00:00'
      doc.text(dataStr, 10, y)
      doc.text(realizado, 40, y)
      doc.text(hTrab, 120, y)
      y += 6
      if (y > 280) {
        doc.addPage()
        y = 20
      }
    })
  })

  const buf = doc.output('arraybuffer')
  fs.writeFileSync('dados-locais/teste-ponto.pdf', Buffer.from(buf))
  console.log('[Teste] PDF gerado em dados-locais/teste-ponto.pdf')
  return buf
}

function criarDadosTeste() {
  const departamento: Departamento = {
    id: 'dept-teste',
    nome: 'Departamento Teste',
    nome_curto: 'Teste',
    contato_portaria: null,
    empresa_id: null,
    endereco: null,
    bairro: null,
    cidade: null,
    estado: null,
    cep: null,
    nome_contato: null,
    telefone_contato: null,
    email_contato: null,
    nome_contato_2: null,
    telefone_contato_2: null,
    email_contato_2: null,
    status: 'Ativo',
    created_at: new Date().toISOString(),
  }

  const colaboradores: Colaborador[] = COLABORADORES.map(c => ({
    id: c.id,
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
    status: 'Ativo' as const,
    tipo_contrato: null,
    empresa_id: null,
    afastamento_motivo: null,
    afastamento_data_inicio: null,
    afastamento_data_fim: null,
    dados_completos: {},
    foto_url: null,
    tamanho_camisa: null,
    tamanho_calca: null,
    tamanho_calcado: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  const contratos: ContratoAdicional[] = [
    {
      id: 'cont-a',
      nome: 'Limpeza Teste',
      departamento_id: 'dept-teste',
      quantidade_colaboradores: 1,
      adicionais: { insalubridade: true, noturno: false, periculosidade: false, feriado: false, intrajornada: false },
      dias_intrajornada: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cont-b',
      nome: 'Portaria Teste',
      departamento_id: 'dept-teste',
      quantidade_colaboradores: 1,
      adicionais: { insalubridade: false, noturno: true, periculosidade: false, feriado: false, intrajornada: false },
      dias_intrajornada: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cont-c',
      nome: 'Portaria FDS Teste',
      departamento_id: 'dept-teste',
      quantidade_colaboradores: 1,
      adicionais: { insalubridade: false, noturno: false, periculosidade: false, feriado: false, intrajornada: true },
      dias_intrajornada: [0, 6], // Domingo, Sábado
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]

  const vinculos: VinculoAdicional[] = COLABORADORES.map(c => ({
    id: `vinc-${c.id}`,
    contrato_id: c.contratoId,
    colaborador_id: c.id,
    data_inicio: '2026-06-20',
    data_fim: '2026-07-19',
    created_at: new Date().toISOString(),
  }))

  localStorage.setItem('mock_departamentos', JSON.stringify([departamento]))
  localStorage.setItem('mock_colaboradores', JSON.stringify(colaboradores))
  localStorage.setItem('mock_contratos_adicionais', JSON.stringify(contratos))
  localStorage.setItem('mock_vinculos_adicionais', JSON.stringify(vinculos))

  console.log('[Teste] Dados de teste criados')
}

function salvarCalendario(dadosImportados: Awaited<ReturnType<typeof parsePontoPDF>>) {
  const vinculos: VinculoAdicional[] = JSON.parse(localStorage.getItem('mock_vinculos_adicionais') || '[]')
  const colaboradores: Colaborador[] = JSON.parse(localStorage.getItem('mock_colaboradores') || '[]')

  const calendario: DiaCalendarioAdicional[] = []
  dadosImportados.forEach(col => {
    const matriculaNormalizada = normalizarMatricula(col.matricula)
    const vinculo = vinculos.find(v => {
      const c = colaboradores.find(x => x.id === v.colaborador_id)
      return normalizarMatricula(c?.matricula) === matriculaNormalizada
    })
    if (!vinculo) {
      throw new Error(`Vínculo não encontrado para ${col.nome}`)
    }
    col.dias.forEach(d => {
      calendario.push({
        vinculo_id: vinculo.id,
        data: d.data,
        status: d.status,
        intrajornada: false,
      })
    })
  })

  localStorage.setItem('mock_calendario_adicionais', JSON.stringify(calendario))
  console.log('[Teste] Calendário salvo com', calendario.length, 'registros')
  return calendario
}

function calcularRelatorio(mes: number, ano: number) {
  const contratos: ContratoAdicional[] = JSON.parse(localStorage.getItem('mock_contratos_adicionais') || '[]')
  const vinculos: VinculoAdicional[] = JSON.parse(localStorage.getItem('mock_vinculos_adicionais') || '[]')
  const calendario: DiaCalendarioAdicional[] = JSON.parse(localStorage.getItem('mock_calendario_adicionais') || '[]')
  const colaboradores: Colaborador[] = JSON.parse(localStorage.getItem('mock_colaboradores') || '[]')

  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`
  const inicioMes = `${mesStr}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fimMes = `${mesStr}-${String(ultimoDia).padStart(2, '0')}`

  const vinculosAtivos = vinculos.filter(v => v.data_inicio <= fimMes && v.data_fim >= inicioMes)
  const calendarioNoMes = calendario.filter(d => d.data >= inicioMes && d.data <= fimMes)

  console.log(`[Relatório] Período: ${inicioMes} a ${fimMes}`)
  console.log(`[Relatório] Vínculos ativos: ${vinculosAtivos.length}`)
  console.log(`[Relatório] Registros de calendário no período: ${calendarioNoMes.length}`)

  const resultados: Array<{
    colaborador: string
    contrato: string
    adicional: string
    trabalhados: number
    intrajornada: number
    folgas: number
    faltas: number
  }> = []

  vinculosAtivos.forEach(v => {
    const contrato = contratos.find(c => c.id === v.contrato_id)
    const col = colaboradores.find(c => c.id === v.colaborador_id)
    if (!contrato || !col) return

    const diasVinculo = calendarioNoMes.filter(d => d.vinculo_id === v.id)
    const trabalhou = diasVinculo.filter(d => d.status === 'trabalhou')
    const folgas = diasVinculo.filter(d => d.status === 'folga' || d.status === 'folga_substituicao').length
    const faltas = diasVinculo.filter(d => d.status === 'falta').length

    Object.entries(contrato.adicionais)
      .filter(([, ativo]) => ativo)
      .forEach(([key]) => {
        const adicional = key
        let intrajornada = 0
        if (adicional === 'intrajornada') {
          trabalhou.forEach(d => {
            if (diaIntrajornada(contrato, d.data)) {
              intrajornada++
            }
          })
        }

        resultados.push({
          colaborador: col.nome_completo,
          contrato: contrato.nome,
          adicional,
          trabalhados: trabalhou.length,
          intrajornada,
          folgas,
          faltas,
        })
      })
  })

  return resultados
}

async function executarTeste() {
  console.log('\n========== TESTE ADICIONAIS CONTRATUAIS ==========\n')

  const buf = gerarPDF()
  criarDadosTeste()

  const blob = new Blob([buf], { type: 'application/pdf' })
  const file = new File([blob], 'teste-ponto.pdf', { type: 'application/pdf' })
  const dados = await parsePontoPDF(file)

  console.log('\n[Parser] Resultado:')
  dados.forEach(d => {
    const trabalhou = d.dias.filter(x => x.status === 'trabalhou').length
    const folga = d.dias.filter(x => x.status === 'folga').length
    const falta = d.dias.filter(x => x.status === 'falta').length
    const ferias = d.dias.filter(x => x.status === 'ferias').length
    const afastado = d.dias.filter(x => x.status === 'afastado').length
    const revisao = d.dias.filter(x => x.revisao).length
    console.log(`  ${d.nome} (matrícula ${d.matricula}): ${d.dias.length} dias | trabalhou=${trabalhou}, folga=${folga}, falta=${falta}, férias=${ferias}, afastado=${afastado}, revisão=${revisao}`)
  })

  if (dados.length !== 3) {
    throw new Error(`Esperado 3 colaboradores, encontrado ${dados.length}`)
  }

  const calendario = salvarCalendario(dados)
  console.log('\n[Calendário] Primeiros 5 registros:')
  calendario.slice(0, 5).forEach(d => console.log(`  ${d.data} | vinculo=${d.vinculo_id} | status=${d.status}`))

  const relatorio = calcularRelatorio(6, 2026)
  console.log('\n[Relatório] Resultados:')
  relatorio.forEach(r => {
    console.log(`  ${r.colaborador} | ${r.contrato} | ${r.adicional}: trabalhados=${r.trabalhados}, intrajornada=${r.intrajornada}, folgas=${r.folgas}, faltas=${r.faltas}`)
  })

  // Verificações
  console.log('\n[Asserções]')
  const joao = relatorio.find(r => r.colaborador === 'JOAO TESTE')
  const maria = relatorio.find(r => r.colaborador === 'MARIA TESTE')
  const pedro = relatorio.find(r => r.colaborador === 'PEDRO TESTE')

  if (!joao || joao.adicional !== 'insalubridade') throw new Error('João não encontrado no relatório')
  if (!maria || maria.adicional !== 'noturno') throw new Error('Maria não encontrada no relatório')
  if (!pedro || pedro.adicional !== 'intrajornada') throw new Error('Pedro não encontrado no relatório')

  // Período 20/06 a 30/06 = 11 dias no mês de junho (índices pares = trabalhou: 20,22,24,26,28,30 = 6 dias)
  if (joao.trabalhados !== 6) throw new Error(`João deveria ter 6 dias trabalhados em junho, tem ${joao.trabalhados}`)
  if (maria.trabalhados !== 6) throw new Error(`Maria deveria ter 6 dias trabalhados em junho, tem ${maria.trabalhados}`)

  // Pedro trabalhou 6 dias em junho, mas intrajornada só sábados e domingos
  // 20/06=sábado(trab), 22/06=seg, 24/06=qua, 26/06=sex, 28/06=dom(trab), 30/06=ter
  // Intrajornada: 20/06 (sáb) e 28/06 (dom) = 2 dias
  if (pedro.trabalhados !== 6) throw new Error(`Pedro deveria ter 6 dias trabalhados em junho, tem ${pedro.trabalhados}`)
  if (pedro.intrajornada !== 2) throw new Error(`Pedro deveria ter 2 dias de intrajornada em junho, tem ${pedro.intrajornada}`)

  console.log('✅ TODOS OS TESTES PASSARAM')
}

executarTeste().catch(err => {
  console.error('\n❌ TESTE FALHOU:', err.message)
  console.error(err)
  process.exit(1)
})
