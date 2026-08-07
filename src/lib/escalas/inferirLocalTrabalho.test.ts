import { describe, it, expect } from 'vitest'
import { inferirLocalTrabalho } from './inferirLocalTrabalho'
import type { MapeamentoFlitLocalTrabalho } from '@/types/database'

function mapeamento(
  localTrabalhoId: string,
  tipo_match: MapeamentoFlitLocalTrabalho['tipo_match'],
  valor_flit: string
): MapeamentoFlitLocalTrabalho {
  return {
    id: crypto.randomUUID(),
    local_trabalho_id: localTrabalhoId,
    tipo_match,
    valor_flit,
    prioridade: 100,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

describe('inferirLocalTrabalho', () => {
  const mapeamentos = [
    mapeamento('loc-matizes', 'dispositivo', 'MATIZES'),
    mapeamento('loc-cascais', 'perimetro', 'Cascais'),
    mapeamento('loc-cascais', 'turno_departamento', 'Cascais'),
    mapeamento('loc-cbo', 'turno_departamento', 'CBO'),
  ]

  it('encontra local pelo dispositivo fixo (Flit Multi)', () => {
    const resultado = inferirLocalTrabalho(mapeamentos, {
      tipoDispositivo: 'flit multi',
      nomeDispositivo: 'MATIZES',
      perimetro: '',
      departamento: '',
      turno: '',
    })

    expect(resultado).not.toBeNull()
    expect(resultado?.localTrabalhoId).toBe('loc-matizes')
    expect(resultado?.fonte).toBe('dispositivo')
    expect(resultado?.confianca).toBe('alta')
  })

  it('encontra local pelo perímetro', () => {
    const resultado = inferirLocalTrabalho(mapeamentos, {
      tipoDispositivo: 'flit',
      nomeDispositivo: '',
      perimetro: 'Cascais',
      departamento: '',
      turno: '',
    })

    expect(resultado).not.toBeNull()
    expect(resultado?.localTrabalhoId).toBe('loc-cascais')
    expect(resultado?.fonte).toBe('perimetro')
  })

  it('encontra local pelo nome do horário (turno) quando ele contém o valor mapeado', () => {
    const resultado = inferirLocalTrabalho(mapeamentos, {
      tipoDispositivo: 'flit',
      nomeDispositivo: '',
      perimetro: '',
      departamento: 'Cascais Limpeza',
      turno: '8h às 17h CASCAIS',
    })

    expect(resultado).not.toBeNull()
    expect(resultado?.localTrabalhoId).toBe('loc-cascais')
    expect(resultado?.fonte).toBe('turno_departamento')
    expect(resultado?.confianca).toBe('media')
  })

  it('turno tem prioridade sobre departamento: faltista de departamento genérico vai para o posto do horário do dia', () => {
    // Caso real (06/08/2026): faltista com depto "PLENA EA FACILITIES" trabalha
    // em postos diferentes a cada dia — quem diz a verdade do dia é o turno.
    const maps = [...mapeamentos, mapeamento('loc-plena', 'turno_departamento', 'PLENA EA FACILITIES')]
    const resultado = inferirLocalTrabalho(maps, {
      tipoDispositivo: 'flit',
      nomeDispositivo: '',
      perimetro: '',
      departamento: 'PLENA EA FACILITIES',
      turno: '7h às 15:20h CASCAIS ASG 2',
    })

    expect(resultado?.localTrabalhoId).toBe('loc-cascais')
    expect(resultado?.fonte).toBe('turno_departamento')
  })

  it('usa o departamento como double check quando o turno não casa com nada', () => {
    const resultado = inferirLocalTrabalho(mapeamentos, {
      tipoDispositivo: 'flit',
      nomeDispositivo: '',
      perimetro: '',
      departamento: 'Cascais Limpeza',
      turno: '8h às 17h',
    })

    expect(resultado?.localTrabalhoId).toBe('loc-cascais')
    expect(resultado?.fonte).toBe('turno_departamento')
  })

  it('no turno, o valor mais específico vence o genérico (CBO MACAÉ vs CBO)', () => {
    const maps = [
      mapeamento('loc-cbo', 'turno_departamento', 'CBO'),
      mapeamento('loc-cbo-macae', 'turno_departamento', 'CBO MACAÉ'),
    ]
    const resultado = inferirLocalTrabalho(maps, {
      tipoDispositivo: 'flit',
      nomeDispositivo: '',
      perimetro: '',
      departamento: '',
      turno: '19 às 7h CBO MACAÉ VIGIA N. PAR',
    })

    expect(resultado?.localTrabalhoId).toBe('loc-cbo-macae')
  })

  it('prioriza dispositivo fixo sobre perímetro e turno', () => {
    const resultado = inferirLocalTrabalho(mapeamentos, {
      tipoDispositivo: 'flit multi',
      nomeDispositivo: 'MATIZES',
      perimetro: 'Cascais',
      departamento: 'Cascais Limpeza',
      turno: '8h às 17h CASCAIS',
    })

    expect(resultado?.localTrabalhoId).toBe('loc-matizes')
    expect(resultado?.fonte).toBe('dispositivo')
  })

  it('retorna null quando nenhuma regra identifica o local', () => {
    const resultado = inferirLocalTrabalho(mapeamentos, {
      tipoDispositivo: 'flit',
      nomeDispositivo: '',
      perimetro: '',
      departamento: '',
      turno: '',
    })

    expect(resultado).toBeNull()
  })

  it('ignora perímetro vazio ou "--"', () => {
    const resultado = inferirLocalTrabalho(mapeamentos, {
      tipoDispositivo: 'flit',
      nomeDispositivo: '',
      perimetro: '--',
      departamento: 'CBO',
      turno: '7h às 19h CBO',
    })

    expect(resultado?.localTrabalhoId).toBe('loc-cbo')
    expect(resultado?.fonte).toBe('turno_departamento')
  })
})
