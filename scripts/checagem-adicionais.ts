import fs from 'fs'
import type { ContratoAdicional, VinculoAdicional, DiaCalendarioAdicional } from '../src/types/adicionais'
import type { Colaborador, Departamento } from '../src/types/database'
import { normalizarMatricula } from '../src/lib/adicionais/importarPonto'

// Mock localStorage
class LocalStorageMock {
  private store: Record<string, string> = {}
  getItem(key: string) { return this.store[key] ?? null }
  setItem(key: string, value: string) { this.store[key] = value }
  removeItem(key: string) { delete this.store[key] }
}
;(globalThis as unknown as { localStorage: Storage }).localStorage = new LocalStorageMock() as unknown as Storage

const PDF_COLABORADORES = [
  { nome: 'Acacio', matricula: '772' },
  { nome: 'Adailton', matricula: '845' },
  { nome: 'Adalto', matricula: '846' },
  { nome: 'Adriana', matricula: '813' },
  { nome: 'Adriano', matricula: '814' },
]

function carregarMock() {
  const departamentos: Departamento[] = JSON.parse(localStorage.getItem('mock_departamentos') || '[]')
  const colaboradores: Colaborador[] = JSON.parse(localStorage.getItem('mock_colaboradores') || '[]')
  const contratos: ContratoAdicional[] = JSON.parse(localStorage.getItem('mock_contratos_adicionais') || '[]')
  const vinculos: VinculoAdicional[] = JSON.parse(localStorage.getItem('mock_vinculos_adicionais') || '[]')
  const calendario: DiaCalendarioAdicional[] = JSON.parse(localStorage.getItem('mock_calendario_adicionais') || '[]')
  return { departamentos, colaboradores, contratos, vinculos, calendario }
}

function nomeColaborador(colaboradores: Colaborador[], id: string) {
  return colaboradores.find(c => c.id === id)?.nome_completo || '—'
}

function nomeContrato(contratos: ContratoAdicional[], id: string) {
  return contratos.find(c => c.id === id)
}

function main() {
  const { colaboradores, contratos, vinculos, calendario } = carregarMock()

  console.log('\n========== CHECAGEM MÓDULO ADICIONAIS ==========\n')

  console.log(`Total colaboradores no mock: ${colaboradores.length}`)
  console.log(`Total contratos no mock: ${contratos.length}`)
  console.log(`Total vínculos no mock: ${vinculos.length}`)
  console.log(`Total registros de calendário no mock: ${calendario.length}`)

  console.log('\n--- Colaboradores no mock ---')
  colaboradores.forEach(c => {
    console.log(`  ${c.nome_completo} | matrícula: ${c.matricula} | id: ${c.id}`)
  })

  console.log('\n--- Contratos no mock ---')
  contratos.forEach(c => {
    const adicionais = Object.entries(c.adicionais).filter(([, ativo]) => ativo).map(([k]) => k).join(', ')
    console.log(`  ${c.nome} | departamento: ${c.departamento_id} | adicionais: [${adicionais}] | dias_intrajornada: [${c.dias_intrajornada.join(', ')}]`)
  })

  console.log('\n--- Vínculos no mock ---')
  vinculos.forEach(v => {
    const col = colaboradores.find(c => c.id === v.colaborador_id)
    const contrato = contratos.find(c => c.id === v.contrato_id)
    const adicionais = contrato ? Object.entries(contrato.adicionais).filter(([, ativo]) => ativo).map(([k]) => k).join(', ') : '—'
    console.log(`  ${col?.nome_completo || '—'} | ${contrato?.nome || '—'} | adicionais: [${adicionais}] | ${v.data_inicio} a ${v.data_fim}`)
  })

  const inicio = '2026-05-20'
  const fim = '2026-06-19'
  const vinculosAtivos = vinculos.filter(v => v.data_inicio <= fim && v.data_fim >= inicio)
  console.log(`\n--- Vínculos ativos de ${inicio} a ${fim} ---`)
  vinculosAtivos.forEach(v => {
    const col = colaboradores.find(c => c.id === v.colaborador_id)
    const contrato = contratos.find(c => c.id === v.contrato_id)
    const adicionais = contrato ? Object.entries(contrato.adicionais).filter(([, ativo]) => ativo).map(([k]) => k).join(', ') : '—'
    console.log(`  ${col?.nome_completo || '—'} | ${contrato?.nome || '—'} | adicionais: [${adicionais}] | ${v.data_inicio} a ${v.data_fim}`)
  })

  console.log('\n--- Colaboradores do PDF no mock ---')
  PDF_COLABORADORES.forEach(p => {
    const cols = colaboradores.filter(c => normalizarMatricula(c.matricula) === normalizarMatricula(p.matricula))
    const vincs = cols.flatMap(c => vinculos.filter(v => v.colaborador_id === c.id))
    console.log(`  ${p.nome} (matrícula ${p.matricula}): ${cols.length > 0 ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`)
    vincs.forEach(v => {
      const contrato = contratos.find(c => c.id === v.contrato_id)
      console.log(`    → vinculado a ${contrato?.nome || '—'} de ${v.data_inicio} a ${v.data_fim}`)
    })
  })

  console.log('\n--- Adailton: configuração de intrajornada ---')
  const adailton = colaboradores.find(c => normalizarMatricula(c.matricula) === normalizarMatricula('845'))
  if (adailton) {
    const vincs = vinculos.filter(v => v.colaborador_id === adailton.id)
    vincs.forEach(v => {
      const contrato = contratos.find(c => c.id === v.contrato_id)
      console.log(`  Contrato: ${contrato?.nome}`)
      console.log(`  Intrajornada ativa: ${contrato?.adicionais.intrajornada}`)
      console.log(`  Dias intrajornada: [${contrato?.dias_intrajornada.join(', ')}]`)
    })
  }

  console.log('\n--- Verificar Adilson Muniz ---')
  const adilson = colaboradores.find(c => c.nome_completo.toLowerCase().includes('adilson'))
  console.log(`  ${adilson ? `ENCONTRADO: ${adilson.nome_completo} (${adilson.matricula})` : 'NÃO ENCONTRADO'}`)
}

main()
