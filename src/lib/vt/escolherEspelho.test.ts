import { describe, expect, it } from 'vitest'
import {
  coberturaDoConjunto,
  diasCobertosPeloArquivo,
  escolherConjuntoDoPeriodo,
  escolherMelhorArquivoDoPeriodo,
  ordenarParaMescla,
} from '@/lib/vt/escolherEspelho'

const arq = (id: string, ini: string | null, fim: string | null, criado: string, ate: string | null = fim) => ({
  id,
  periodo_inicio: ini,
  periodo_fim: fim,
  ponto_ate: ate,
  created_at: criado,
})

describe('escolherMelhorArquivoDoPeriodo (espelho sugerido no fechamento do VT)', () => {
  it('cobertura maior vence o mais recente (caso real de outubro/2026)', () => {
    const completo = arq('completo', '2026-09-20', '2026-10-19', '2026-10-20T10:00:00Z')
    const parcial = arq('parcial', '2026-10-12', '2026-10-19', '2026-10-21T10:00:00Z')
    expect(escolherMelhorArquivoDoPeriodo([parcial, completo], '2026-09-20', '2026-10-19')?.id).toBe('completo')
  })

  it('empate de cobertura → o mais recente', () => {
    const a = arq('a', '2026-09-20', '2026-10-19', '2026-10-20T10:00:00Z')
    const b = arq('b', '2026-09-20', '2026-10-19', '2026-10-20T11:00:00Z')
    expect(escolherMelhorArquivoDoPeriodo([a, b], '2026-09-20', '2026-10-19')?.id).toBe('b')
  })

  it('conta só até ponto_ate e ignora arquivo sem metadados ou fora do período', () => {
    const ate = arq('ate', '2026-09-20', '2026-10-19', '2026-10-20T10:00:00Z', '2026-10-07')
    expect(diasCobertosPeloArquivo(ate, '2026-09-20', '2026-10-19')).toBe(18)
    expect(diasCobertosPeloArquivo(arq('x', null, null, 'z'), '2026-09-20', '2026-10-19')).toBe(0)
    expect(diasCobertosPeloArquivo(arq('y', '2026-11-01', '2026-11-10', 'z'), '2026-09-20', '2026-10-19')).toBe(0)
    expect(escolherMelhorArquivoDoPeriodo([], '2026-09-20', '2026-10-19')).toBeNull()
  })
})

describe('vários espelhos por período (ponto em pedaços)', () => {
  // Caso real de outubro/2026: 20/09–07/10, 07–13/10, 12–19/10.
  const p1 = arq('p1', '2026-09-20', '2026-10-07', '2026-10-08T10:00:00Z')
  const p2 = arq('p2', '2026-10-07', '2026-10-13', '2026-10-14T10:00:00Z')
  const p3 = arq('p3', '2026-10-12', '2026-10-19', '2026-10-20T10:00:00Z')

  it('sugestão pré-seleciona o conjunto que cobre o período', () => {
    const escolhidos = escolherConjuntoDoPeriodo([p3, p2, p1], '2026-09-20', '2026-10-19')
    expect(escolhidos.map((a) => a.id).sort()).toEqual(['p1', 'p2', 'p3'])
    expect(coberturaDoConjunto(escolhidos, '2026-09-20', '2026-10-19')).toEqual({
      diasCobertos: 30,
      diasDoPeriodo: 30,
      completo: true,
      faltando: [],
    })
  })

  it('arquivo completo dispensa os pedaços', () => {
    const completo = arq('completo', '2026-09-20', '2026-10-19', '2026-10-20T09:00:00Z')
    expect(escolherConjuntoDoPeriodo([p1, p2, p3, completo], '2026-09-20', '2026-10-19').map((a) => a.id)).toEqual([
      'completo',
    ])
  })

  it('cobertura aponta os trechos que faltam', () => {
    const c = coberturaDoConjunto([p1, p3], '2026-09-20', '2026-10-19')
    expect(c.completo).toBe(false)
    expect(c.faltando).toEqual([{ de: '2026-10-08', ate: '2026-10-11' }])
    expect(coberturaDoConjunto([], '2026-10-20', '2026-11-19').faltando).toEqual([
      { de: '2026-10-20', ate: '2026-11-19' },
    ])
  })

  it('dia repetido: ordem de mescla põe o enviado mais recentemente por último (ele vence)', () => {
    expect(ordenarParaMescla([p3, p1, p2]).map((a) => a.id)).toEqual(['p1', 'p2', 'p3'])
  })
})
