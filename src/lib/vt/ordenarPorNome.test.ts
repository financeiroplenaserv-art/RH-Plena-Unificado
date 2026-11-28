import { describe, expect, it } from 'vitest'
import { filtrarTrajetos, ordenarPorNome, postosDistintos, proximoSentidoNome } from './ordenarPorNome'

describe('ordenarPorNome', () => {
  const l = [{ n: 'Zé' }, { n: 'álvaro' }, { n: 'Ana' }, { n: 'Alvaro' }]
  it('A→Z sem peso de acento, estável', () => {
    expect(ordenarPorNome(l, (x) => x.n, 'asc').map((x) => x.n)).toEqual(['álvaro', 'Alvaro', 'Ana', 'Zé'])
  })
  it('Z→A e ordem original', () => {
    expect(ordenarPorNome(l, (x) => x.n, 'desc')[0].n).toBe('Zé')
    expect(ordenarPorNome(l, (x) => x.n, null)).toEqual(l)
  })
  it('ciclo', () => {
    expect(proximoSentidoNome(null)).toBe('asc')
    expect(proximoSentidoNome('asc')).toBe('desc')
    expect(proximoSentidoNome('desc')).toBeNull()
  })
})

describe('filtrarTrajetos', () => {
  const l = [
    { nomeColaborador: 'João Álvares', nomePosto: 'CBO' },
    { nomeColaborador: 'Maria', nomePosto: 'ITAGUAÍ' },
    { nomeColaborador: 'Joana', nomePosto: 'CBO' },
  ]
  it('nome sem acento/caixa e posto', () => {
    expect(filtrarTrajetos(l, { nome: 'alvares', posto: '' })).toHaveLength(1)
    expect(filtrarTrajetos(l, { nome: 'joa', posto: 'CBO' })).toHaveLength(2)
    expect(filtrarTrajetos(l, { nome: '', posto: 'ITAGUAÍ' })).toHaveLength(1)
  })
  it('postos distintos', () => {
    expect(postosDistintos(l)).toEqual(['CBO', 'ITAGUAÍ'])
  })
})
