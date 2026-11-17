import { supabase } from '@/lib/supabase'
import {
  ajusteDeLinha,
  componenteDeLinha,
  decisaoDeLinha,
  versaoPrecoDeLinha,
} from '@/lib/vt/adaptadoresSql'

export async function carregarDominioLote() {
  const [decisoes, componentes, precoPacotes, ajustes] = await Promise.all([
    supabase.from('vt_trajeto_decisoes').select('*'),
    supabase.from('vt_trajeto_decisao_componentes').select('*'),
    supabase.from('vt_pacote_precos').select('*'),
    supabase.from('vt_beneficio_ajustes').select('*'),
  ])
  if (decisoes.error) throw decisoes.error
  if (componentes.error) throw componentes.error
  if (precoPacotes.error) throw precoPacotes.error
  if (ajustes.error) throw ajustes.error

  return {
    decisoes: (decisoes.data ?? []).map(decisaoDeLinha),
    componentes: (componentes.data ?? []).map(componenteDeLinha),
    versoesPreco: (precoPacotes.data ?? []).map(versaoPrecoDeLinha),
    ajustesBeneficio: (ajustes.data ?? []).map(ajusteDeLinha),
  }
}
