import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adaptarRotasGoogle } from '@/lib/vt/googleRoutes'
import { RESPOSTA_ACACIO } from '@/lib/vt/googleRoutesFixture'
import type { EscolhaItinerarioVT, NovaEvidenciaItinerario } from '@/lib/vt/itinerarioEvidencia'
import { RepositorioItinerarioSupabase } from '@/lib/vt/repositorioItinerarioSupabase'
import type { Database } from '@/types/database'
import type { VtItinerario, VtTrajetoDecisao } from '@/types/vt'

const IDS = {
  decisao: '10000000-0000-4000-8000-000000000001',
  pessoa: '10000000-0000-4000-8000-000000000002',
  posto: '10000000-0000-4000-8000-000000000003',
  usuario: '10000000-0000-4000-8000-000000000004',
  itinerario: '10000000-0000-4000-8000-000000000005',
}

function entrada(): EscolhaItinerarioVT {
  return {
    decisaoId: IDS.decisao,
    colaboradorId: IDS.pessoa,
    departamentoId: IDS.posto,
    usuarioId: IDS.usuario,
    alternativa: adaptarRotasGoogle(RESPOSTA_ACACIO, {
      consultadoEm: '2026-11-16T12:00:00Z',
      precisao: 'exata',
      sentido: 'ida',
      municipioOrigem: 'Niterói',
      municipioDestino: 'Niterói',
    })[0],
  }
}

function clienteFalso() {
  const estado = {
    decisao: {
      id: IDS.decisao,
      colaborador_id: IDS.pessoa,
      departamento_id: IDS.posto,
      status: 'sugerida',
      itinerario_id: null,
    } as Pick<VtTrajetoDecisao, 'id' | 'colaborador_id' | 'departamento_id' | 'status' | 'itinerario_id'>,
    evidencia: null as VtItinerario | null,
    insercoes: 0,
    atualizacoes: 0,
    falharProximaAtualizacao: false,
  }

  const cliente = {
    from: vi.fn((tabela: string) => {
      if (tabela === 'vt_trajeto_decisoes') {
        const selecao = {
          eq: vi.fn(() => selecao),
          order: vi.fn(() => selecao),
          limit: vi.fn(() => selecao),
          maybeSingle: vi.fn(async () => ({ data: { ...estado.decisao }, error: null })),
        }
        const atualizacao = {
          eq: vi.fn(() => atualizacao),
          select: vi.fn(() => atualizacao),
          maybeSingle: vi.fn(async () => {
            if (estado.falharProximaAtualizacao) {
              estado.falharProximaAtualizacao = false
              return { data: null, error: { code: 'XX000', message: 'Falha simulada na ligação' } }
            }
            estado.decisao.itinerario_id = estado.evidencia!.id
            return {
              data: { id: estado.decisao.id, itinerario_id: estado.decisao.itinerario_id },
              error: null,
            }
          }),
        }
        return {
          select: vi.fn(() => selecao),
          update: vi.fn(() => {
            estado.atualizacoes += 1
            return atualizacao
          }),
        }
      }

      let modo: 'insert' | 'select' | null = null
      let nova: NovaEvidenciaItinerario | null = null
      const consulta = {
        insert: vi.fn((registro: NovaEvidenciaItinerario) => {
          modo = 'insert'
          nova = registro
          estado.insercoes += 1
          return consulta
        }),
        select: vi.fn(() => {
          if (modo !== 'insert') modo = 'select'
          return consulta
        }),
        eq: vi.fn(() => consulta),
        single: vi.fn(async () => {
          if (modo === 'insert') {
            if (estado.evidencia) {
              return { data: null, error: { code: '23505', message: 'Chave duplicada' } }
            }
            estado.evidencia = {
              ...nova!,
              id: IDS.itinerario,
              created_at: '2026-11-17T12:00:00Z',
            }
            return { data: estado.evidencia, error: null }
          }
          return { data: estado.evidencia, error: null }
        }),
        maybeSingle: vi.fn(async () => ({ data: estado.evidencia, error: null })),
      }
      return consulta
    }),
  } as unknown as SupabaseClient<Database>

  return { cliente, estado }
}

describe('RepositorioItinerarioSupabase', () => {
  it('busca a decisão mais recente pelo trajeto legado', async () => {
    const { cliente } = clienteFalso()
    const repositorio = new RepositorioItinerarioSupabase(cliente)

    await expect(repositorio.buscarDecisaoPorTrajeto('trajeto-real-id')).resolves.toMatchObject({
      id: IDS.decisao,
      status: 'sugerida',
    })
  })

  it('grava a evidência e liga a decisão sugerida', async () => {
    const { cliente, estado } = clienteFalso()
    const repositorio = new RepositorioItinerarioSupabase(cliente)

    const resultado = await repositorio.salvarEscolha(entrada())

    expect(resultado.repetido).toBe(false)
    expect(resultado.evidencia.id).toBe(IDS.itinerario)
    expect(estado.decisao.itinerario_id).toBe(IDS.itinerario)
    expect(estado.insercoes).toBe(1)
    expect(estado.atualizacoes).toBe(1)
    await expect(repositorio.buscarItinerarioPorId(IDS.itinerario)).resolves.toEqual(estado.evidencia)
  })

  it('reenvio da mesma escolha não duplica evidência nem atualização', async () => {
    const { cliente, estado } = clienteFalso()
    const repositorio = new RepositorioItinerarioSupabase(cliente)
    await repositorio.salvarEscolha(entrada())

    const repetido = await repositorio.salvarEscolha(entrada())

    expect(repetido.repetido).toBe(true)
    expect(estado.insercoes).toBe(2)
    expect(estado.atualizacoes).toBe(1)
    expect(estado.evidencia!.id).toBe(IDS.itinerario)
  })

  it('nova tentativa após falha na ligação reutiliza a evidência e conclui a operação', async () => {
    const { cliente, estado } = clienteFalso()
    const repositorio = new RepositorioItinerarioSupabase(cliente)
    estado.falharProximaAtualizacao = true
    await expect(repositorio.salvarEscolha(entrada())).rejects.toThrow('Falha simulada')
    expect(estado.evidencia).not.toBeNull()

    const resultado = await repositorio.salvarEscolha(entrada())

    expect(resultado.repetido).toBe(false)
    expect(estado.insercoes).toBe(2)
    expect(estado.atualizacoes).toBe(2)
    expect(estado.decisao.itinerario_id).toBe(IDS.itinerario)
  })

  it('não troca a evidência de uma decisão confirmada', async () => {
    const { cliente, estado } = clienteFalso()
    estado.decisao.status = 'confirmada'
    estado.decisao.itinerario_id = '10000000-0000-4000-8000-000000000099'
    const repositorio = new RepositorioItinerarioSupabase(cliente)

    await expect(repositorio.salvarEscolha(entrada())).rejects.toThrow('nova revisão')
    expect(estado.atualizacoes).toBe(0)
  })

  it('recusa ligar evidência a outro colaborador antes de gravar', async () => {
    const { cliente, estado } = clienteFalso()
    estado.decisao.colaborador_id = IDS.usuario
    const repositorio = new RepositorioItinerarioSupabase(cliente)

    await expect(repositorio.salvarEscolha(entrada())).rejects.toThrow('não pertence')
    expect(estado.insercoes).toBe(0)
    expect(estado.atualizacoes).toBe(0)
  })
})
