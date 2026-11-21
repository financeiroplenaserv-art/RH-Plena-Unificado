import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { competenciaSeguinte } from '@/lib/vt/carga'
import { RepositorioItinerarioSupabase } from '@/lib/vt/repositorioItinerarioSupabase'
import {
  exigenciasDeCargas,
  exigenciasDeCoberturas,
  type CargaParaExigencia,
  type CoberturaParaExigencia,
  type ExigenciaPosto,
} from '@/lib/vt/rotasAConfirmar'
import type { Database } from '@/types/database'

/**
 * Dados de apoio da fila "Rotas a confirmar" (21/11/2026): o que o mês exige
 * (coberturas/treinamentos por vir + postos do detalhe das cargas da competência
 * atual e da seguinte) e o endereço de casa guardado na evidência das rotas já
 * confirmadas. Só leitura.
 */

const PAGINA = 1000

/** Lê tudo em páginas de 1.000 (o PostgREST corta em 1.000 linhas por consulta). */
async function lerPaginado<T>(
  consultar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const todas: T[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consultar(de, de + PAGINA - 1)
    if (error) throw error
    todas.push(...(data ?? []))
    if (!data || data.length < PAGINA) return todas
  }
}

export interface ApoioRotasAConfirmar {
  exigencias: ExigenciaPosto[]
  /** Endereço de casa da evidência da rota confirmada, por id do trajeto (null = não guardado). */
  origemConfirmada: Map<string, string | null>
}

export async function carregarApoioRotasAConfirmar(
  entrada: {
    hoje: string
    nomePosto: (departamentoId: string) => string
    /** Ids dos trajetos (legados) com decisão confirmada — os que podem "voltar" por endereço. */
    trajetoIdsConfirmados: readonly string[]
  },
  cliente: SupabaseClient<Database> = supabase,
): Promise<ApoioRotasAConfirmar> {
  const { hoje, nomePosto, trajetoIdsConfirmados } = entrada
  const competencias = [hoje.slice(0, 7), competenciaSeguinte(hoje)]

  const [coberturas, cargas, evidencias] = await Promise.all([
    lerPaginado<CoberturaParaExigencia>((de, ate) =>
      cliente
        .from('vt_coberturas')
        .select('colaborador_id, departamento_id, data_inicio, data_fim, tipo')
        .gte('data_fim', hoje)
        .order('id')
        .range(de, ate) as unknown as PromiseLike<{ data: CoberturaParaExigencia[] | null; error: { message: string } | null }>,
    ),
    lerPaginado<CargaParaExigencia>((de, ate) =>
      cliente
        .from('vt_cargas')
        .select('colaborador_id, competencia, detalhe')
        .in('competencia', competencias)
        .order('id')
        .range(de, ate) as unknown as PromiseLike<{ data: CargaParaExigencia[] | null; error: { message: string } | null }>,
    ),
    new RepositorioItinerarioSupabase(cliente).buscarEvidenciasPorTrajetos(trajetoIdsConfirmados),
  ])

  const origemConfirmada = new Map<string, string | null>()
  for (const id of trajetoIdsConfirmados) {
    const texto = evidencias.get(id)?.itinerario?.calculoMotor?.enderecoCasa
    origemConfirmada.set(id, typeof texto === 'string' && texto.trim() ? texto : null)
  }

  return {
    exigencias: [...exigenciasDeCoberturas(coberturas, nomePosto, hoje), ...exigenciasDeCargas(cargas)],
    origemConfirmada,
  }
}
