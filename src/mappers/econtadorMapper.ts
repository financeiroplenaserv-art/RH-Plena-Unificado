import type { EContadorFuncionario } from '@/types/econtador'

interface IncludedItem {
  type?: string
  id?: string
  attributes?: Record<string, unknown>
}

export function extrairDepartamento(item: Record<string, unknown>, included: unknown[]): string | null {
  const attributes = (item.attributes || {}) as Record<string, unknown>
  const relationships = (item.relationships || {}) as Record<string, unknown>

  if (attributes.departamento && typeof attributes.departamento === 'string') {
    return attributes.departamento
  }

  const relDept = (relationships.departamento as { data?: { id: string } })?.data
  if (relDept && included?.length) {
    const dept = included.find((inc) => {
      const incItem = inc as IncludedItem
      return incItem.type === 'departamentos' && incItem.id === relDept.id
    }) as IncludedItem | undefined
    if (dept?.attributes?.nome) return String(dept.attributes.nome)
    if (dept?.attributes?.descricao) return String(dept.attributes.descricao)
  }

  const nomefuncao = attributes.nomefuncao as string | undefined
  if (nomefuncao && nomefuncao.includes(' - ')) {
    const parte = nomefuncao.split(' - ')[0]?.trim()
    if (parte && isNaN(Number(parte))) return parte
  }

  return null
}

export function mapearFuncionario(item: Record<string, unknown>, included: unknown[]): EContadorFuncionario {
  const a = (item.attributes || {}) as Record<string, unknown>
  return {
    id: String(item.id || ''),
    codigo: String(a.codigo || ''),
    nome: String(a.nome || ''),
    cpf: a.cpf ? String(a.cpf) : '',
    pis: a.pis ? String(a.pis) : null,
    identidade: a.identidade ? String(a.identidade) : null,
    carteiradetrabalho: a.carteiradetrabalho ? String(a.carteiradetrabalho) : null,
    status: String(a.status || 'Ativo'),
    demissao: a.demissao ? String(a.demissao) : null,
    afastamentodescricao: a.afastamentodescricao ? String(a.afastamentodescricao) : null,
    admissao: a.admissao ? String(a.admissao) : null,
    nomefuncao: a.nomefuncao ? String(a.nomefuncao) : null,
    telefone: a.telefone ? String(a.telefone) : null,
    telefonecelular: a.telefonecelular ? String(a.telefonecelular) : null,
    email: a.email ? String(a.email) : null,
    cep: a.cep ? String(a.cep) : null,
    cidade: a.cidade ? String(a.cidade) : null,
    nascimento: a.nascimento ? String(a.nascimento) : null,
    dataAtualizacao: a.dataAtualizacao ? String(a.dataAtualizacao) : null,
    rua: a.rua ? String(a.rua) : null,
    numero: a.numero ? String(a.numero) : null,
    complemento: a.complemento ? String(a.complemento) : null,
    bairro: a.bairro ? String(a.bairro) : null,
    estado: a.estado ? String(a.estado) : null,
    afastamento: a.afastamento ? String(a.afastamento) : null,
    retorno: a.retorno ? String(a.retorno) : null,
    departamento: extrairDepartamento(item, included),
  }
}
