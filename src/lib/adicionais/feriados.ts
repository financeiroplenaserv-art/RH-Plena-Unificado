import { supabase } from '@/lib/supabase'

export interface Feriado {
  id: string
  data: string // yyyy-mm-dd
  nome: string
  created_at?: string
}

/** Lista todos os feriados cadastrados (ordenados por data). */
export async function listarFeriados(): Promise<Feriado[]> {
  const { data, error } = await supabase
    .from('feriados')
    .select('id, data, nome, created_at')
    .order('data', { ascending: true })
  if (error) throw error
  return (data || []) as Feriado[]
}

/** Cadastra um feriado (data única — duplicada retorna erro amigável). */
export async function criarFeriado(data: string, nome: string): Promise<void> {
  const { error } = await supabase.from('feriados').insert({ data, nome })
  if (error) {
    if (error.message.includes('duplicate') || error.code === '23505') {
      throw new Error('Já existe um feriado cadastrado nesta data')
    }
    throw error
  }
}

/** Remove um feriado (apenas admin — RLS). */
export async function removerFeriado(id: string): Promise<void> {
  const { data, error } = await supabase.from('feriados').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Sem permissão para excluir este feriado')
}
