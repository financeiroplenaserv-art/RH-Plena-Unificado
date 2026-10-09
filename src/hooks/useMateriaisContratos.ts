import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { estruturaAusente, mensagemErroMateriais } from '@/lib/materiais/erros'
import { selecionarTudo } from '@/lib/materiais/paginar'
import { escritaMateriaisOk } from './useMateriaisCatalogo'
import type { DepartamentoFuzzy } from '@/lib/departamentos'
import type { MatContrato, RotaMaterial } from '@/types/materiais'

// Contratos de pedido (mat_contratos, migration 121). Um departamento pode ter
// vários contratos (caso Telex: 4). O departamento só serve para exibir o
// posto (sempre pelo nome_curto) e resolver a equipe.

const COLUNAS = 'id, departamento_id, nome, rota, recebe_limpeza, ativo, observacao, created_at'

export type ContratoInput = Pick<MatContrato, 'departamento_id' | 'nome' | 'rota' | 'recebe_limpeza' | 'ativo' | 'observacao'>

export function useMateriaisContratos() {
  const [contratos, setContratos] = useState<MatContrato[]>([])
  /** contrato_id → nº de linhas no Kit Mensal */
  const [itensNoKit, setItensNoKit] = useState<Record<string, number>>({})
  /** Lista de resolução (sem filtro de nome_curto — regra do AGENTS.md §11). */
  const [departamentos, setDepartamentos] = useState<DepartamentoFuzzy[]>([])
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const [rc, rk, rd] = await Promise.all([
      supabase.from('mat_contratos').select(COLUNAS).order('nome'),
      selecionarTudo<{ contrato_id: string }>((de, ate) =>
        supabase.from('mat_kit_itens').select('contrato_id').order('id').range(de, ate)
      ),
      supabase.from('departamentos').select('id, nome, nome_curto, empresa_id, status'),
    ])
    const erro = rc.error ?? rk.error
    if (erro) {
      if (estruturaAusente(erro)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(erro, 'carregar os contratos'))
    } else {
      setEstruturaPendente(false)
      setContratos((rc.data as MatContrato[]) ?? [])
      const contagem: Record<string, number> = {}
      for (const k of rk.data ?? []) contagem[k.contrato_id] = (contagem[k.contrato_id] ?? 0) + 1
      setItensNoKit(contagem)
    }
    if (!rd.error) setDepartamentos((rd.data as DepartamentoFuzzy[]) ?? [])
    setLoading(false)
  }, [])

  const salvar = useCallback(async (dados: ContratoInput, id?: string | null) => {
    const resultado = id
      ? await supabase.from('mat_contratos').update(dados).eq('id', id).select('id')
      : await supabase.from('mat_contratos').insert(dados).select('id')
    if (!escritaMateriaisOk(resultado, id ? 'atualizar o contrato' : 'cadastrar o contrato')) return false
    toast.success(id ? 'Contrato atualizado' : 'Contrato cadastrado')
    return true
  }, [])

  /** Só a rota padrão (mesa): RPC que confere o perfil no banco. */
  const definirRota = useCallback(async (contratoId: string, rota: RotaMaterial | null) => {
    const { error } = await supabase.rpc('definir_rota_contrato', { p_contrato: contratoId, p_rota: rota })
    if (error) {
      toast.error(mensagemErroMateriais(error, 'alterar a rota'))
      return false
    }
    toast.success('Rota atualizada')
    return true
  }, [])

  return { contratos, itensNoKit, departamentos, loading, estruturaPendente, carregar, salvar, definirRota }
}
