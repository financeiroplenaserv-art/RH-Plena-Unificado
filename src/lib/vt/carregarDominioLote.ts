import { supabase } from '@/lib/supabase'
import {
  ajusteDeLinha,
  componenteDeLinha,
  decisaoDeLinha,
  versaoPrecoDeLinha,
} from '@/lib/vt/adaptadoresSql'

type TabelaDominio = 'vt_trajeto_decisoes' | 'vt_trajeto_decisao_componentes' | 'vt_pacote_precos' | 'vt_beneficio_ajustes'

const LOTE = 1000

/**
 * Lê a tabela inteira em lotes de 1.000, ordenada por id: o PostgREST corta em 1.000 linhas
 * e, sem paginar, a revisão mais nova de um trajeto podia ficar de fora e a carga usar uma
 * revisão antiga (auditoria de 21/11/2026; mesmo bug já corrigido em listarCalendario).
 */
async function lerTudo(tabela: TabelaDominio) {
  const linhas: Record<string, unknown>[] = []
  for (let inicio = 0; ; inicio += LOTE) {
    const { data, error } = await supabase.from(tabela).select('*').order('id').range(inicio, inicio + LOTE - 1)
    if (error) throw error
    linhas.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < LOTE) return linhas
  }
}

export async function carregarDominioLote() {
  const [decisoes, componentes, precoPacotes, ajustes] = await Promise.all([
    lerTudo('vt_trajeto_decisoes'),
    lerTudo('vt_trajeto_decisao_componentes'),
    lerTudo('vt_pacote_precos'),
    lerTudo('vt_beneficio_ajustes'),
  ])

  return {
    decisoes: decisoes.map((l) => decisaoDeLinha(l as never)),
    componentes: componentes.map((l) => componenteDeLinha(l as never)),
    versoesPreco: precoPacotes.map((l) => versaoPrecoDeLinha(l as never)),
    ajustesBeneficio: ajustes.map((l) => ajusteDeLinha(l as never)),
  }
}
