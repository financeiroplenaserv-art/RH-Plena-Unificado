import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { estruturaAusente } from '@/lib/materiais/erros'
import type { VtExtraMensal } from '@/types/vt'

/**
 * "Extra no mês (R$)" da competência (migration 176). Toda escrita termina em `.select('id')`
 * e confere a linha afetada (RLS bloqueada devolve 0 linhas sem erro). Sem a tabela, `ausente`
 * fica true e o resto da Carga continua funcionando.
 */
export function useVtExtrasMensais(competencia: string, usuarioId: string) {
  const [extras, setExtras] = useState<VtExtraMensal[]>([])
  const [ausente, setAusente] = useState(false)
  const [erroLeitura, setErroLeitura] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // true depois da PRIMEIRA leitura (com ou sem erro) da competência atual — o rascunho automático
  // da Carga espera por isso para nunca calcular antes de saber se há extras.
  const [carregadoDe, setCarregadoDe] = useState<string | null>(null)

  const recarregar = useCallback(async (): Promise<VtExtraMensal[]> => {
    const { data, error } = await supabase
      .from('vt_extras_mensais')
      .select('*')
      .eq('competencia', competencia)
    if (error) {
      if (estruturaAusente(error)) {
        setAusente(true)
        setErroLeitura(null)
        setExtras([])
        setCarregadoDe(competencia)
        return []
      }
      setErroLeitura(`Não foi possível ler os extras do mês: ${error.message}`)
      setCarregadoDe(competencia)
      return []
    }
    const lista = (data ?? []) as VtExtraMensal[]
    setAusente(false)
    setErroLeitura(null)
    setExtras(lista)
    setCarregadoDe(competencia)
    return lista
  }, [competencia])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  /** Grava (cria ou atualiza) o extra da pessoa. Lança erro se a linha não foi afetada. */
  const salvar = useCallback(async (colaboradorId: string, valorCentavos: number, motivo: string): Promise<VtExtraMensal[]> => {
    setSalvando(true)
    try {
      const existente = extras.find((e) => e.colaborador_id === colaboradorId)
      const agora = new Date().toISOString()
      const resposta = existente
        ? await supabase
          .from('vt_extras_mensais')
          .update({ valor_centavos: valorCentavos, motivo, atualizado_por: usuarioId, atualizado_em: agora })
          .eq('id', existente.id)
          .select('id')
        : await supabase
          .from('vt_extras_mensais')
          .insert({ colaborador_id: colaboradorId, competencia, valor_centavos: valorCentavos, motivo, criado_por: usuarioId, atualizado_por: usuarioId })
          .select('id')
      if (resposta.error) {
        if (estruturaAusente(resposta.error)) {
          setAusente(true)
          throw new Error('Falta aplicar a migration 176 (extras do mês).')
        }
        throw new Error(resposta.error.message)
      }
      if (!resposta.data || resposta.data.length !== 1) {
        throw new Error('O extra não foi gravado (sem permissão?). Nada foi alterado.')
      }
      return await recarregar()
    } finally {
      setSalvando(false)
    }
  }, [extras, competencia, usuarioId, recarregar])

  const remover = useCallback(async (extraId: string): Promise<VtExtraMensal[]> => {
    setSalvando(true)
    try {
      const { data, error } = await supabase.from('vt_extras_mensais').delete().eq('id', extraId).select('id')
      if (error) throw new Error(error.message)
      if (!data || data.length !== 1) throw new Error('O extra não foi removido (sem permissão?).')
      return await recarregar()
    } finally {
      setSalvando(false)
    }
  }, [recarregar])

  return { extras, ausente, erroLeitura, salvando, salvar, remover, recarregar, carregado: carregadoDe === competencia }
}
