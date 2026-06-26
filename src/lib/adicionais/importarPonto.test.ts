import { describe, it, expect } from 'vitest'
import { jsPDF } from 'jspdf'
import { parsePontoPDF, normalizarMatricula } from './importarPonto'
import { diaIntrajornada } from './calculoAdicionais'
import type { ContratoAdicional, VinculoAdicional, DiaCalendarioAdicional } from '@/types/adicionais'
import type { Colaborador, Departamento } from '@/types/database'

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

  return doc.output('arraybuffer')
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
    status: 'Ativo',
    tipo_contrato: null,
    empresa_id: null,
    afastamento_motivo: null,
    afastamento_data_inicio: null,
    afastamento_data_fim: null,
    dados_completos: {},
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
      regime_trabalho: '12x36',
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
      regime_trabalho: '12x36',
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
      regime_trabalho: '12x36',
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

  return { departamento, colaboradores, contratos, vinculos }
}

function calcularRelatorio(
  mes: number,
  ano: number,
  contratos: ContratoAdicional[],
  vinculos: VinculoAdicional[],
  calendario: DiaCalendarioAdicional[],
  colaboradores: Colaborador[]
) {
  const mesStr = `${ano}-${String(mes).padStart(2, '0')}`
  const inicioMes = `${mesStr}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fimMes = `${mesStr}-${String(ultimoDia).padStart(2, '0')}`

  const vinculosAtivos = vinculos.filter(v => v.data_inicio <= fimMes && v.data_fim >= inicioMes)
  const calendarioNoMes = calendario.filter(d => d.data >= inicioMes && d.data <= fimMes)

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

describe('Importar ponto de PDF', () => {
  it('parseia PDF e calcula relatório de adicionais corretamente', async () => {
    const buf = gerarPDF()
    const { colaboradores, contratos, vinculos } = criarDadosTeste()

    const blob = new Blob([buf], { type: 'application/pdf' })
    const file = new File([blob], 'teste-ponto.pdf', { type: 'application/pdf' })
    const dados = await parsePontoPDF(file)

    expect(dados).toHaveLength(3)

    const calendario: DiaCalendarioAdicional[] = []
    dados.forEach(col => {
      const matriculaNormalizada = normalizarMatricula(col.matricula)
      const vinculo = vinculos.find(v => {
        const c = colaboradores.find(x => x.id === v.colaborador_id)
        return normalizarMatricula(c?.matricula) === matriculaNormalizada
      })
      expect(vinculo).toBeDefined()
      col.dias.forEach(d => {
        calendario.push({
          vinculo_id: vinculo!.id,
          data: d.data,
          status: d.status,
          intrajornada: false,
        })
      })
    })

    const relatorio = calcularRelatorio(6, 2026, contratos, vinculos, calendario, colaboradores)

    const joao = relatorio.find(r => r.colaborador === 'JOAO TESTE')
    const maria = relatorio.find(r => r.colaborador === 'MARIA TESTE')
    const pedro = relatorio.find(r => r.colaborador === 'PEDRO TESTE')

    expect(joao?.adicional).toBe('insalubridade')
    expect(maria?.adicional).toBe('noturno')
    expect(pedro?.adicional).toBe('intrajornada')

    expect(joao?.trabalhados).toBe(6)
    expect(maria?.trabalhados).toBe(6)
    expect(pedro?.trabalhados).toBe(6)
    expect(pedro?.intrajornada).toBe(2)
  })
})
