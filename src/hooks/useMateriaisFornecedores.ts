import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { estruturaAusente, mensagemErroMateriais } from '@/lib/materiais/erros'
import { escritaMateriaisOk } from './useMateriaisCatalogo'
import type { Fornecedor } from '@/types/database'

// Cadastro único de fornecedores (tabela `fornecedores`, usada também pelo
// CEU). As colunas contato/observacao/ativo vêm da migration 121: sem ela a
// consulta falha por coluna inexistente e a tela mostra o aviso de preparação.

const COLUNAS = 'id, nome, cnpj, telefone, email, contato, observacao, ativo, created_at'

export type FornecedorInput = Pick<Fornecedor, 'nome' | 'cnpj' | 'telefone' | 'email' | 'contato' | 'observacao' | 'ativo'>

export function useMateriaisFornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('fornecedores').select(COLUNAS).order('nome')
    if (error) {
      if (estruturaAusente(error, true)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(error, 'carregar os fornecedores'))
    } else {
      setEstruturaPendente(false)
      setFornecedores((data as Fornecedor[]) ?? [])
    }
    setLoading(false)
  }, [])

  const salvar = useCallback(async (dados: FornecedorInput, id?: string | null) => {
    const resultado = id
      ? await supabase.from('fornecedores').update(dados).eq('id', id).select('id')
      : await supabase.from('fornecedores').insert(dados).select('id')
    if (!escritaMateriaisOk(resultado, id ? 'atualizar o fornecedor' : 'cadastrar o fornecedor')) return false
    toast.success(id ? 'Fornecedor atualizado' : 'Fornecedor cadastrado')
    return true
  }, [])

  return { fornecedores, loading, estruturaPendente, carregar, salvar }
}
