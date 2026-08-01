import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFiltroPersistente } from './useFiltroPersistente'

describe('useFiltroPersistente', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('usa o valor inicial quando não há nada salvo', () => {
    const { result } = renderHook(() => useFiltroPersistente('tela.campo', 'todos'))
    expect(result.current[0]).toBe('todos')
  })

  it('persiste a alteração no sessionStorage com o prefixo corh:filtros:', () => {
    const { result } = renderHook(() => useFiltroPersistente('tela.campo', 'todos'))
    act(() => result.current[1]('financeiro'))
    expect(sessionStorage.getItem('corh:filtros:tela.campo')).toBe('"financeiro"')
  })

  it('uma nova montagem (voltar à tela) restaura o valor salvo', () => {
    const primeiro = renderHook(() => useFiltroPersistente('tela.campo', 'todos'))
    act(() => primeiro.result.current[1]('mesa'))
    primeiro.unmount()

    const segundo = renderHook(() => useFiltroPersistente('tela.campo', 'todos'))
    expect(segundo.result.current[0]).toBe('mesa')
  })

  it('persiste arrays e objetos simples (filtros com chips)', () => {
    const { result } = renderHook(() => useFiltroPersistente<string[]>('tela.tipos', []))
    act(() => result.current[1](['Falta', 'Atestado']))
    expect(result.current[0]).toEqual(['Falta', 'Atestado'])

    const remontado = renderHook(() => useFiltroPersistente<string[]>('tela.tipos', []))
    expect(remontado.result.current[0]).toEqual(['Falta', 'Atestado'])
  })

  it('limpar o filtro (voltar ao inicial) também é persistido', () => {
    const { result } = renderHook(() => useFiltroPersistente('tela.campo', 'todos'))
    act(() => result.current[1]('dp1'))
    act(() => result.current[1]('todos'))

    const remontado = renderHook(() => useFiltroPersistente('tela.campo', 'dp1'))
    expect(remontado.result.current[0]).toBe('todos')
  })

  it('JSON inválido no storage é ignorado e cai no valor inicial', () => {
    sessionStorage.setItem('corh:filtros:tela.campo', '{quebrado')
    const { result } = renderHook(() => useFiltroPersistente('tela.campo', 'todos'))
    expect(result.current[0]).toBe('todos')
  })

  it('aceita valor inicial lazy (função)', () => {
    const { result } = renderHook(() => useFiltroPersistente('tela.ano', () => 2026))
    expect(result.current[0]).toBe(2026)
  })

  it('chaves diferentes não se misturam', () => {
    const a = renderHook(() => useFiltroPersistente('telaA.campo', 'x'))
    const b = renderHook(() => useFiltroPersistente('telaB.campo', 'y'))
    act(() => a.result.current[1]('mudou'))
    expect(b.result.current[0]).toBe('y')
  })
})
