import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { resolverFuncao } from '@/lib/ferias/funcoesFerias'
import {
  classificarFeristas,
  mesesAtras,
  type ClassificadorFeristas,
} from '@/lib/vt/feristas'
import { hojeBrasil } from '@/lib/utils'
import type { FeriasFuncao } from '@/types/ferias'
import type { VtCobertura } from '@/types/vt'

// Etiqueta "Ferista" nas abas do VT (decisão da gestora, 23/10/2026): o selo
// vem de DOIS fatos, sem nenhuma flag paralela — (1) carteira ferias_feristas
// ativa (a equipe dedicada, os "só ferista"; RLS: SELECT autenticado) e
// (2) cobertura em andamento/agendada em vt_coberturas ("se cita que a pessoa
// vai cobrir férias, naquele momento ela é ferista"). Só linhas tipo 'ferias':
// TREINAMENTO (migration 160) não gera selo nem prioridade. Cobertura
// ENCERRADA não gera selo — só ordena o seletor ("últimos utilizados", janela
// de 6 meses).
// A carteira é mantida pela aba Feristas do módulo Férias e pelo botão
// "Adicionar à carteira" do dialog de cobertura (função resolvida do cargo;
// sem match = só aviso, sem palpite).

const JANELA_RECIENTES_MESES = 6

const VAZIO: ClassificadorFeristas = classificarFeristas({
  carteiraIds: [],
  coberturas: [],
  hoje: hojeBrasil(),
})

export function useCarteiraFeristas() {
  const [classificador, setClassificador] = useState<ClassificadorFeristas>(VAZIO)
  const [funcoes, setFuncoes] = useState<FeriasFuncao[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (): Promise<void> => {
    setLoading(true)
    const hoje = hojeBrasil()
    const limite = mesesAtras(hoje, JANELA_RECIENTES_MESES)
    const [
      { data: feristas, error: erroFeristas },
      { data: fns, error: erroFuncoes },
      { data: cobs, error: erroCoberturas },
    ] = await Promise.all([
      supabase.from('ferias_feristas').select('colaborador_id').eq('ativo', true),
      supabase.from('ferias_funcoes').select('*'),
      supabase
        .from('vt_coberturas')
        .select('colaborador_id, data_fim, tipo')
        .not('colaborador_id', 'is', null)
        .gte('data_fim', limite)
        // Treinamento não é ferista (migration 160) — inclui NULL (linhas antigas).
        .or('tipo.is.null,tipo.eq.ferias'),
    ])
    setLoading(false)
    if (erroFeristas) {
      console.error('Erro ao carregar a carteira de feristas:', erroFeristas.message)
      return
    }
    if (erroCoberturas) {
      console.error('Erro ao carregar as coberturas para a etiqueta de ferista:', erroCoberturas.message)
    }
    setClassificador(
      classificarFeristas({
        carteiraIds: (feristas ?? []).map((r) => r.colaborador_id as string),
        coberturas: (erroCoberturas ? [] : (cobs ?? [])) as Pick<VtCobertura, 'colaborador_id' | 'data_fim' | 'tipo'>[],
        hoje,
      })
    )
    if (!erroFuncoes) setFuncoes((fns ?? []) as FeriasFuncao[])
  }, [])

  const ehFerista = useCallback(
    (colaboradorId: string | null | undefined) => classificador.ehFerista(colaboradorId),
    [classificador]
  )

  const prioridadeFerista = useCallback(
    (colaboradorId: string | null | undefined) => classificador.prioridade(colaboradorId),
    [classificador]
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
          toast.success('Ferista reativado na carteira.')
          await listar()
          return true
        }
        toast.error('Erro ao adicionar à carteira: ' + error.message)
        return false
      }
      if (!data || data.length === 0) {
        toast.error('Sem permissão para adicionar à carteira de feristas')
        return false
      }
      toast.success('Adicionado à carteira de feristas.')
      await listar()
      return true
    },
    [funcoes, listar]
  )

  return { loading, listar, ehFerista, prioridadeFerista, adicionar }
}
