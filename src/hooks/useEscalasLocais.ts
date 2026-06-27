import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { nomesSimilares } from '@/lib/utils'
import type { LocalTrabalho } from '@/types/database'

export function useEscalasLocais() {
  const [locais, setLocais] = useState<LocalTrabalho[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('locais_trabalho')
        .select('*')
        .eq('status', 'Ativo')
        .order('nome')
      if (error) throw error
      setLocais((data || []) as LocalTrabalho[])
      return (data || []) as LocalTrabalho[]
    } catch (err: unknown) {
      console.error('Erro ao carregar locais de trabalho:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar locais de trabalho')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const criar = useCallback(async (local: Omit<LocalTrabalho, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('locais_trabalho')
        .insert(local as Partial<LocalTrabalho>)
        .select()
        .single()
      if (error) throw error
      toast.success('Local de trabalho criado')
      await listar()
      return data as LocalTrabalho
    } catch (err: unknown) {
      console.error('Erro ao criar local de trabalho:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao criar local de trabalho')
      return null
    }
  }, [listar])

  const atualizar = useCallback(async (id: string, local: Partial<Omit<LocalTrabalho, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { error } = await supabase
        .from('locais_trabalho')
        .update(local as Partial<LocalTrabalho>)
        .eq('id', id)
      if (error) throw error
      toast.success('Local de trabalho atualizado')
      await listar()
      return true
    } catch (err: unknown) {
      console.error('Erro ao atualizar local de trabalho:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar local de trabalho')
      return false
    }
  }, [listar])

  const remover = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('locais_trabalho')
        .delete()
        .eq('id', id)
      if (error) throw error
      toast.success('Local de trabalho removido')
      await listar()
      return true
    } catch (err: unknown) {
      console.error('Erro ao remover local de trabalho:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao remover local de trabalho')
      return false
    }
  }, [listar])

  const importarDeDepartamentos = useCallback(async () => {
    try {
      const { data: departamentos, error } = await supabase
        .from('departamentos')
        .select('id, nome, nome_curto')
        .eq('status', 'Ativo')
        .not('nome_curto', 'is', null)
        .neq('nome_curto', '')
      if (error) throw error

      const existentes = await listar()

      const novos: { nome: string; nome_curto: string; status: 'Ativo'; observacao: string }[] = []
      let ignorados = 0

      for (const d of departamentos || []) {
        const nomeCurto = (d.nome_curto || d.nome).trim()
        if (!nomeCurto) continue

        const jaExiste = existentes.some((l) =>
          nomesSimilares(l.nome, nomeCurto) ||
          nomesSimilares(l.nome_curto || l.nome, nomeCurto)
        )

        if (jaExiste) {
          ignorados++
          continue
        }

        novos.push({
          nome: nomeCurto,
          nome_curto: nomeCurto,
          status: 'Ativo' as const,
          observacao: `Importado do departamento ${d.nome}`,
        })
      }

      if (novos.length === 0) {
        toast.info(
          ignorados > 0
            ? `Nenhum novo local. ${ignorados} departamento(s) ignorado(s) por similaridade com locais existentes.`
            : 'Todos os departamentos já estão cadastrados como locais de trabalho'
        )
        return 0
      }

      const { error: insertError } = await supabase
        .from('locais_trabalho')
        .insert(novos as Partial<LocalTrabalho>[])
      if (insertError) throw insertError

      toast.success(
        `${novos.length} local(is) importado(s) de departamentos.` +
          (ignorados > 0 ? ` ${ignorados} ignorado(s) por similaridade.` : '')
      )
      await listar()
      return novos.length
    } catch (err: unknown) {
      console.error('Erro ao importar locais de departamentos:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao importar locais de departamentos')
      return 0
    }
  }, [listar])

  return { locais, loading, listar, criar, atualizar, remover, importarDeDepartamentos }
}
