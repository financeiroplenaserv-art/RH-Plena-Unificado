import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adaptarRotasGoogle } from '@/lib/vt/googleRoutes'
import { RESPOSTA_ACACIO } from '@/lib/vt/googleRoutesFixture'
import type { EscolhaItinerarioVT } from '@/lib/vt/itinerarioEvidencia'
import { RepositorioItinerarioSupabase } from '@/lib/vt/repositorioItinerarioSupabase'
import type { Database } from '@/types/database'
import type { VtTrajetoDecisao } from '@/types/vt'

type Linha = Record<string, unknown>

const IDS = {
  decisao: '10000000-0000-4000-8000-000000000001',
  trajeto: '10000000-0000-4000-8000-000000000002',
  pessoa: '10000000-0000-4000-8000-000000000003',
  posto: '10000000-0000-4000-8000-000000000004',
  usuario: '10000000-0000-4000-8000-000000000005',
  pacote: '10000000-0000-4000-8000-000000000006',
  componente: '10000000-0000-4000-8000-000000000007',
  ajuste: '10000000-0000-4000-8000-000000000008',
}

function decisaoConfirmada(): VtTrajetoDecisao {
  return {
    id: IDS.decisao,
    trajeto_legado_id: IDS.trajeto,
    colaborador_id: IDS.pessoa,
    departamento_id: IDS.posto,
    revisao: 1,
    cotacao_id: 'cotacao-atual',
    status: 'confirmada',
    confirmado_por: IDS.usuario,
    confirmado_em: '2026-11-01T10:00:00Z',
    vigente_desde: '2026-11-01',
    vigente_ate: null,
    origem: 'legado',
    referencias_legadas_nao_resolvidas: [],
    itinerario_id: null,
  }
}

function entrada(): EscolhaItinerarioVT {
  return {
    decisaoId: IDS.decisao,
    colaboradorId: IDS.pessoa,
    departamentoId: IDS.posto,
    usuarioId: IDS.usuario,
    alternativa: adaptarRotasGoogle(RESPOSTA_ACACIO, {
      consultadoEm: '2026-11-17T12:00:00Z',
      precisao: 'exata',
      sentido: 'ida',
      municipioOrigem: 'Niterói',
      municipioDestino: 'Niterói',
    })[0],
  }
}

function bancoFalso() {
  const tabelas: Record<string, Linha[]> = {
    vt_trajeto_decisoes: [decisaoConfirmada() as unknown as Linha],
    vt_trajeto_decisao_componentes: [{
      id: IDS.componente,
      decisao_trajeto_id: IDS.decisao,
      pacote_id: IDS.pacote,
      ordem: 1,
    }],
    vt_beneficio_ajustes: [{
      id: IDS.ajuste,
      decisao_trajeto_id: IDS.decisao,
      valor_diario_centavos: 200,
      motivo: 'Complemento autorizado',
      autor_id: IDS.usuario,
      vigente_desde: '2026-11-01',
      vigente_ate: null,
      origem: 'manual',
    }],
    vt_itinerarios: [],
  }
  let sequencial = 9

  function consulta(nome: string) {
    const linhas = tabelas[nome]
    let operacao: 'select' | 'insert' | 'update' = 'select'
    let payload: unknown = null
    const filtros: [string, unknown][] = []
    let ordenacao: [string, boolean] | null = null
    let limite: number | null = null

    function filtradas(): Linha[] {
      const dados = linhas.filter((linha) => filtros.every(([campo, valor]) => linha[campo] === valor))
      if (ordenacao) {
        const [campo, ascendente] = ordenacao
        dados.sort((a, b) => {
          const resultado = String(a[campo]).localeCompare(String(b[campo]), 'pt-BR', { numeric: true })
          return ascendente ? resultado : -resultado
        })
      }
      return limite == null ? dados : dados.slice(0, limite)
    }

    function executar(unico: boolean | null) {
      if (operacao === 'select') {
        const dados = filtradas().map((linha) => ({ ...linha }))
        return { data: unico === null ? dados : (dados[0] ?? null), error: null }
      }
      if (operacao === 'update') {
        const dados = filtradas()
        for (const linha of dados) Object.assign(linha, payload as Linha)
        return { data: unico === null ? dados : (dados[0] ?? null), error: null }
      }

      const registros = (Array.isArray(payload) ? payload : [payload]) as Linha[]
      const inseridos: Linha[] = []
      for (const registro of registros) {
        if (nome === 'vt_trajeto_decisoes' && linhas.some((linha) =>
          linha.trajeto_legado_id === registro.trajeto_legado_id && linha.revisao === registro.revisao
        )) {
          return { data: null, error: { code: '23505', message: 'Revisão duplicada' } }
        }
        if (nome === 'vt_itinerarios' && linhas.some((linha) =>
          linha.chave_idempotencia === registro.chave_idempotencia
        )) {
          return { data: null, error: { code: '23505', message: 'Evidência duplicada' } }
        }
        const nova = {
          ...registro,
          id: registro.id ?? `00000000-0000-4000-8000-${String(sequencial++).padStart(12, '0')}`,
        }
        linhas.push(nova)
        inseridos.push(nova)
      }
      return { data: unico === null ? inseridos : (inseridos[0] ?? null), error: null }
    }

    const builder = {
      select: vi.fn(() => builder),
      insert: vi.fn((registro: unknown) => {
        operacao = 'insert'
        payload = registro
        return builder
      }),
      update: vi.fn((registro: unknown) => {
        operacao = 'update'
        payload = registro
        return builder
      }),
      eq: vi.fn((campo: string, valor: unknown) => {
        filtros.push([campo, valor])
        return builder
      }),
      order: vi.fn((campo: string, opcoes?: { ascending?: boolean }) => {
        ordenacao = [campo, opcoes?.ascending !== false]
        return builder
      }),
      limit: vi.fn((valor: number) => {
        limite = valor
        return builder
      }),
      maybeSingle: vi.fn(async () => executar(true)),
      single: vi.fn(async () => executar(true)),
      then: (resolve: (valor: unknown) => unknown, reject: (motivo: unknown) => unknown) =>
        Promise.resolve(executar(null)).then(resolve, reject),
    }
    return builder
  }

  const cliente = { from: vi.fn((nome: string) => consulta(nome)) } as unknown as SupabaseClient<Database>
  return { cliente, tabelas }
}

describe('salvar escolha com nova revisão', () => {
  it('preserva a confirmada, copia a composição e não duplica nada na repetição', async () => {
    const { cliente, tabelas } = bancoFalso()
    const repositorio = new RepositorioItinerarioSupabase(cliente)
    const antes = structuredClone(tabelas.vt_trajeto_decisoes[0])

    const primeiro = await repositorio.salvarEscolhaComRevisao(entrada(), IDS.trajeto, '2026-11-17')

    expect(tabelas.vt_trajeto_decisoes[0]).toEqual(antes)
    expect(tabelas.vt_trajeto_decisoes).toHaveLength(2)
    const revisao = tabelas.vt_trajeto_decisoes[1]
    expect(revisao).toMatchObject({
      id: primeiro.decisaoId,
      revisao: 2,
      status: 'sugerida',
      origem: 'manual',
      vigente_desde: '2026-11-17',
      itinerario_id: primeiro.evidencia.id,
    })
    expect(tabelas.vt_trajeto_decisao_componentes).toHaveLength(2)
    expect(tabelas.vt_trajeto_decisao_componentes.find((linha) =>
      linha.decisao_trajeto_id === primeiro.decisaoId
    )).toMatchObject({ pacote_id: IDS.pacote })
    expect(tabelas.vt_beneficio_ajustes).toHaveLength(2)
    expect(tabelas.vt_beneficio_ajustes.find((linha) =>
      linha.decisao_trajeto_id === primeiro.decisaoId
    )).toMatchObject({ valor_diario_centavos: 200 })

    const segundo = await repositorio.salvarEscolhaComRevisao(entrada(), IDS.trajeto, '2026-11-17')

    expect(segundo.repetido).toBe(true)
    expect(tabelas.vt_trajeto_decisoes).toHaveLength(2)
    expect(tabelas.vt_trajeto_decisao_componentes).toHaveLength(2)
    expect(tabelas.vt_beneficio_ajustes).toHaveLength(2)
    expect(tabelas.vt_itinerarios).toHaveLength(1)

    const confirmada = await repositorio.confirmarDecisaoAberta(
      primeiro.decisaoId,
      IDS.usuario,
      '2026-11-17T12:00:00Z',
    )
    expect(confirmada).toMatchObject({
      id: primeiro.decisaoId,
      status: 'confirmada',
      cotacao_id: 'cotacao-atual',
    })
    expect(tabelas.vt_trajeto_decisoes[0]).toEqual(antes)
  })
})
