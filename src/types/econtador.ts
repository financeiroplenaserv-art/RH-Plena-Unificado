export interface EContadorEmpresa {
  id: string
  nome: string
  codigo: string
}

export interface EContadorFuncionario {
  id: string
  codigo: string
  nome: string
  cpf: string
  pis: string | null
  identidade: string | null
  carteiradetrabalho: string | null
  status: string
  demissao: string | null
  afastamentodescricao: string | null
  admissao: string | null
  nomefuncao: string | null
  telefone: string | null
  telefonecelular: string | null
  email: string | null
  cep: string | null
  cidade: string | null
  nascimento: string | null
  dataAtualizacao: string | null
  rua: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  estado: string | null
  afastamento: string | null
  retorno: string | null
  departamento: string | null
}

export interface HistoricoImportacao {
  id?: string
  usuario_id?: string | null
  empresa_id?: string | null
  empresa_nome?: string | null
  quantidade: number
  importados: number
  atualizados: number
  erros: number
  detalhes_erros?: { nome: string; erro: string }[]
  created_at?: string
}
