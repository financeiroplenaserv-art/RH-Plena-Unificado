import { supabase } from '@/lib/supabase'
import type { CeuTamanhos } from '@/types/database'
import { resumoTamanhos, tamanhoParaItem, tamanhoDoNomeItem } from './tamanhosPuro'

// Reexporta as funções puras para quem importa de '@/lib/ceu/tamanhos'
export { resumoTamanhos, tamanhoParaItem, tamanhoDoNomeItem }

/**
 * Medidas de uniforme/EPI (módulo CEU) — tabela `ceu_tamanhos` (migration 096).
 * Vivem fora do cadastro do colaborador por decisão da gestão: são dado
 * operacional do CEU e não precisam ser visíveis a todos os perfis.
 */

/** Carrega todas as medidas em um mapa por colaborador_id (tabela pequena). */
export async function listarTamanhos(): Promise<Map<string, CeuTamanhos>> {
  const { data, error } = await supabase.from('ceu_tamanhos').select('*')
  if (error) throw error
  const mapa = new Map<string, CeuTamanhos>()
  for (const t of (data || []) as CeuTamanhos[]) mapa.set(t.colaborador_id, t)
  return mapa
}

export interface TamanhosInput {
  tamanho_camisa: string
  tamanho_calca: string
  tamanho_calcado: string
  tamanho_luva: string
}

/** Upsert das medidas do colaborador (campos vazios viram null). */
export async function salvarTamanhos(colaboradorId: string, input: TamanhosInput, userId: string): Promise<void> {
  const vazioParaNull = (v: string) => (v.trim() === '' ? null : v.trim())
  const { error } = await supabase.from('ceu_tamanhos').upsert(
    {
      colaborador_id: colaboradorId,
      tamanho_camisa: vazioParaNull(input.tamanho_camisa),
      tamanho_calca: vazioParaNull(input.tamanho_calca),
      tamanho_calcado: vazioParaNull(input.tamanho_calcado),
      tamanho_luva: vazioParaNull(input.tamanho_luva),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'colaborador_id' }
  )
  if (error) throw error
}
