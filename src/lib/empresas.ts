import { supabase } from '@/lib/supabase'

// Empresa principal do grupo — usada como fallback quando o registro não
// tem vínculo com empresa (mesma decisão de negócio do PDF de ocorrências,
// ver src/lib/pdf.ts: ~95% dos colaboradores são dela).
export const EMPRESA_PADRAO = {
  nome: 'PLENA EA SERVICOS COMERCIAIS LTDA',
  cnpj: '00.378.476/0001-60',
}

export interface EmpresaDocumento {
  nome: string
  cnpj: string
}

// Busca nome/CNPJ da empresa pelo id; cai no fallback Plena EA quando o
// id é nulo ou a empresa não é encontrada.
export async function buscarEmpresaPorId(id?: string | null): Promise<EmpresaDocumento> {
  if (id) {
    const { data } = await supabase
      .from('empresas')
      .select('nome, cnpj')
      .eq('id', id)
      .maybeSingle()
    if (data?.nome) return { nome: data.nome, cnpj: data.cnpj || '' }
  }
  return EMPRESA_PADRAO
}
