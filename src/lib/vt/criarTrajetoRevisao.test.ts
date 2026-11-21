import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { criarTrajetoParaRevisao, MigracaoTrajetoSemBilhetePendente } from './criarTrajetoRevisao'

type Linha = Record<string, unknown>

interface Opcoes {
  trajetos?: Linha[]
  decisoes?: Linha[]
  /** Erro devolvido pelo INSERT em vt_trajetos. */
  erroInsertTrajeto?: { code: string; message: string }
  /** O INSERT em vt_trajetos "perde" a corrida: um colega cria o trajeto no meio. */
  corridaTrajeto?: boolean
}

function bancoFalso(opcoes: Opcoes = {}) {
  const tabelas: Record<string, Linha[]> = {
    vt_trajetos: [...(opcoes.trajetos ?? [])],
    vt_trajeto_decisoes: [...(opcoes.decisoes ?? [])],
  }
  const inserts: { tabela: string; payload: Linha }[] = []
  let seq = 0

  function consulta(nome: string) {
    let modo: 'select' | 'insert' = 'select'
    let payload: Linha = {}
    const filtros: [string, unknown][] = []
    let ordem: [string, boolean] | null = null
    let limite = Infinity
    const resolver = () => {
      if (modo === 'insert') {
        inserts.push({ tabela: nome, payload })
        if (nome === 'vt_trajetos' && opcoes.erroInsertTrajeto) return { data: null, error: opcoes.erroInsertTrajeto }
        if (nome === 'vt_trajetos' && opcoes.corridaTrajeto) {
          tabelas.vt_trajetos.push({ id: 'trajeto-do-colega', ...payload })
          return { data: null, error: { code: '23505', message: 'duplicate key' } }
        }
        const linha = { id: `${nome}-${++seq}`, ...payload }
        tabelas[nome].push(linha)
        return { data: [{ id: linha.id }], error: null }
      }
      let linhas = tabelas[nome].filter((l) => filtros.every(([c, v]) => l[c] === v))
      if (ordem) {
        const [campo, asc] = ordem
        linhas = [...linhas].sort((a, b) => (Number(a[campo]) - Number(b[campo])) * (asc ? 1 : -1))
      }
      return { data: linhas.slice(0, limite), error: null }
    }
    const api: Record<string, unknown> = {
      select: () => api,
      insert: (p: Linha) => {
        modo = 'insert'
        payload = p
        return api
      },
      eq: (c: string, v: unknown) => {
        filtros.push([c, v])
        return api
      },
      order: (c: string, o: { ascending: boolean }) => {
        ordem = [c, o.ascending]
        return api
      },
      limit: (n: number) => {
        limite = n
        return api
      },
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resolver()).then(ok, ko),
    }
    return api
  }

  const cliente = { from: (nome: string) => consulta(nome) } as unknown as SupabaseClient<Database>
  return { cliente, inserts, tabelas }
}

const ENTRADA = {
  colaboradorId: 'col-1',
  departamentoId: 'dep-1',
  cidadeCasa: 'São Gonçalo',
  enderecoCasa: 'RUA X, 10, CENTRO',
  cidadePosto: 'Niterói',
  hoje: '2026-11-21',
}

describe('criarTrajetoParaRevisao', () => {
  it('cria o trajeto sugerido SEM bilhete e a decisão sugerida na revisão 1', async () => {
    const { cliente, inserts } = bancoFalso()
    const r = await criarTrajetoParaRevisao(ENTRADA, cliente)
    expect(r.trajetoCriado).toBe(true)
    const trajeto = inserts.find((i) => i.tabela === 'vt_trajetos')!.payload
    expect(trajeto).toMatchObject({
      colaborador_id: 'col-1',
      departamento_id: 'dep-1',
      bilhete_id: null,
      bilhete_2_id: null,
      status: 'sugerido',
      origem: 'manual',
      escopo: 'intermunicipal',
      precisao_origem: 'exato',
    })
    const decisao = inserts.find((i) => i.tabela === 'vt_trajeto_decisoes')!.payload
    expect(decisao).toMatchObject({
      trajeto_legado_id: r.trajetoId,
      revisao: 1,
      status: 'sugerida',
      origem: 'manual',
      vigente_desde: '2026-11-21',
      custo_diario_centavos: null,
      itinerario_id: null,
      confirmado_por: null,
    })
  })

  it('recupera o trajeto e a decisão que já existem, sem duplicar', async () => {
    const { cliente, inserts } = bancoFalso({
      trajetos: [{ id: 't-1', colaborador_id: 'col-1', departamento_id: 'dep-1' }],
      decisoes: [{ id: 'd-1', trajeto_legado_id: 't-1', colaborador_id: 'col-1', departamento_id: 'dep-1', revisao: 1 }],
    })
    const r = await criarTrajetoParaRevisao(ENTRADA, cliente)
    expect(r).toEqual({ trajetoId: 't-1', decisaoId: 'd-1', trajetoCriado: false })
    expect(inserts).toHaveLength(0)
  })

  it('trajeto existente sem decisão ganha só a decisão, na revisão seguinte à órfã', async () => {
    const { cliente, inserts } = bancoFalso({
      trajetos: [{ id: 't-1', colaborador_id: 'col-1', departamento_id: 'dep-1' }],
      decisoes: [{ id: 'd-velha', trajeto_legado_id: null, colaborador_id: 'col-1', departamento_id: 'dep-1', revisao: 2 }],
    })
    const r = await criarTrajetoParaRevisao(ENTRADA, cliente)
    expect(r.trajetoCriado).toBe(false)
    expect(inserts.map((i) => i.tabela)).toEqual(['vt_trajeto_decisoes'])
    expect(inserts[0].payload.revisao).toBe(3)
  })

  it('conflito de unicidade (colega criou agora) recupera o existente', async () => {
    const { cliente } = bancoFalso({ corridaTrajeto: true })
    const r = await criarTrajetoParaRevisao(ENTRADA, cliente)
    expect(r.trajetoId).toBe('trajeto-do-colega')
    expect(r.trajetoCriado).toBe(false)
  })

  it('bilhete_id NOT NULL no banco (migration 175 pendente) vira erro próprio, sem inventar bilhete', async () => {
    const { cliente, inserts } = bancoFalso({
      erroInsertTrajeto: { code: '23502', message: 'null value in column "bilhete_id"' },
    })
    await expect(criarTrajetoParaRevisao(ENTRADA, cliente)).rejects.toBeInstanceOf(MigracaoTrajetoSemBilhetePendente)
    expect(inserts.every((i) => i.payload.bilhete_id === null)).toBe(true)
  })
})
