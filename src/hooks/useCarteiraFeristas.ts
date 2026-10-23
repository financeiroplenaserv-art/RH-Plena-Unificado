import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { resolverFuncao } from '@/lib/ferias/funcoesFerias'
import type { FeriasFuncao } from '@/types/ferias'

// Etiqueta "Ferista" nas abas do VT (decisão da gestora, 23/10/2026): a FONTE
// ÚNICA de "quem é ferista" é a carteira ferias_feristas (migration 112) — o
// VT só LÊ a carteira (RLS: SELECT autenticado) e exibe o selo; nenhuma flag
// paralela em colaboradores. O fluxo se autocorrige: ao registrar cobertura
// com alguém fora da carteira, a tela avisa e oferece "Adicionar à carteira"
// em 1 clique (função resolvida do cargo; sem match = só aviso, sem palpite).

export function useCarteiraFeristas() {
  const [carteira, setCarteira] = useState<Set<string>>(new Set())
  const [funcoes, setFuncoes] = useState<FeriasFuncao[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (): Promise<void> => {
    setLoading(true)
    const [{ data: feristas, error: erroFeristas }, { data: fns, error: erroFuncoes }] = await Promise.all([
      supabase.from('ferias_feristas').select('colaborador_id').eq('ativo', true),
      supabase.from('ferias_funcoes').select('*'),
    ])
    setLoading(false)
    if (erroFeristas) {
      console.error('Erro ao carregar a carteira de feristas:', erroFeristas.message)
      return
    }
    setCarteira(new Set((feristas ?? []).map((r) => r.colaborador_id as string)))
    if (!erroFuncoes) setFuncoes((fns ?? []) as FeriasFuncao[])
  }, [])

  const ehFerista = useCallback(
    (colaboradorId: string | null | undefined) => !!colaboradorId && carteira.has(colaboradorId),
    [carteira]
  )

  /**
   * Adiciona à carteira em 1 clique: função resolvida do cargo e limites
   * padrão da operação (30 dias consecutivos, 2 coberturas/mês — os mesmos do
   * dialog da aba Feristas). Se já existir na carteira inativo, reativa.
   */
  const adicionar = useCallback(
    async (colaborador: { id: string; cargo: string | null }): Promise<boolean> => {
      const funcao = resolverFuncao(colaborador.cargo, funcoes)
      if (!funcao) {
        toast.error(
          'Não consegui identificar a função pelo cargo dele — complete o cadastro na aba Feristas do módulo Férias'
        )
        return false
      }
      const { data, error } = await supabase
        .from('ferias_feristas')
        .insert({
          colaborador_id: colaborador.id,
          funcao_id: funcao.id,
          max_dias_consecutivos: 30,
          max_coberturas_mes: 2,
          observacao: 'Adicionado pela tela do VT',
        })
        .select('id')
      if (error) {
        if (error.code === '23505') {
          // Já está na carteira (inativo) — reativar.
          const { data: reativado, error: erroReativacao } = await supabase
            .from('ferias_feristas')
            .update({ ativo: true })
            .eq('colaborador_id', colaborador.id)
            .select('id')
          if (erroReativacao || !reativado || reativado.length === 0) {
            toast.error('Ele já estava na carteira e não consegui reativar (permissão)')
            return false
          }
          setCarteira((atual) => new Set(atual).add(colaborador.id))
          toast.success('Ferista reativado na carteira.')
          return true
        }
        toast.error('Erro ao adicionar à carteira: ' + error.message)
        return false
      }
      if (!data || data.length === 0) {
        toast.error('Sem permissão para adicionar à carteira de feristas')
        return false
      }
      setCarteira((atual) => new Set(atual).add(colaborador.id))
      toast.success('Adicionado à carteira de feristas.')
      return true
    },
    [funcoes]
  )

  return { carteira, loading, listar, ehFerista, adicionar }
}
