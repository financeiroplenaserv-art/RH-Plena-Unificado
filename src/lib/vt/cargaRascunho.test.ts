import { describe, expect, it } from 'vitest'
import { montarRascunhoCarga, validarRascunhoCarga } from '@/lib/vt/cargaRascunho'
import type { PessoaRelatorio } from '@/lib/vt/gestaoEscalasFlit'

const PESSOAS: PessoaRelatorio[] = [
  {
    nome: 'ALEXSANDRO SILVA',
    departamentoTexto: 'CONDOMINIO RESIDENCIAL ROSAS',
    cargo: 'PORTEIRO',
    horario: '08h às 17h',
    dias: [
      { data: '2026-11-02', marca: 'trabalha', texto: '[T] 08h às 17h' },
      { data: '2026-11-03', marca: 'folga', texto: '[F]' },
      { data: '2026-11-10', marca: 'ferias', texto: '[FR]' },
    ],
  },
]

describe('montarRascunhoCarga / validarRascunhoCarga', () => {
  it('monta e valida o próprio rascunho (ida e volta)', () => {
    const r = montarRascunhoCarga(PESSOAS, 'escalas_nov.xlsx', '2026-11', '2026-10-27T12:00:00Z')
    expect(validarRascunhoCarga(r)).toEqual(r)
    expect(validarRascunhoCarga(JSON.parse(JSON.stringify(r)))).toEqual(r)
  })

  it('aceita nomeArquivo null', () => {
    const r = montarRascunhoCarga(PESSOAS, null, '2026-11', '2026-10-27T12:00:00Z')
    expect(validarRascunhoCarga(r)?.nomeArquivo).toBeNull()
  })

  it('recusa versão diferente', () => {
    const r = { ...montarRascunhoCarga(PESSOAS, 'a.xlsx', '2026-11', '2026-10-27T12:00:00Z'), versao: 2 }
    expect(validarRascunhoCarga(r)).toBeNull()
  })

  it('recusa competência fora do formato AAAA-MM', () => {
    const r = montarRascunhoCarga(PESSOAS, 'a.xlsx', '11/2026', '2026-10-27T12:00:00Z')
    expect(validarRascunhoCarga(r)).toBeNull()
  })

  it('recusa pessoa sem nome e dia com marca desconhecida', () => {
    const semNome = montarRascunhoCarga([{ ...PESSOAS[0], nome: '' }], 'a.xlsx', '2026-11', '2026-10-27T12:00:00Z')
    expect(validarRascunhoCarga(semNome)).toBeNull()
    const marcaRuim = montarRascunhoCarga(
      [{ ...PESSOAS[0], dias: [{ data: '2026-11-02', marca: 'feriado' as never, texto: 'x' }] }],
      'a.xlsx',
      '2026-11',
      '2026-10-27T12:00:00Z'
    )
    expect(validarRascunhoCarga(marcaRuim)).toBeNull()
  })

  it('recusa lixo (null, string, objeto sem campos)', () => {
    expect(validarRascunhoCarga(null)).toBeNull()
    expect(validarRascunhoCarga('rascunho')).toBeNull()
    expect(validarRascunhoCarga({})).toBeNull()
    expect(validarRascunhoCarga({ versao: 1 })).toBeNull()
  })
})
