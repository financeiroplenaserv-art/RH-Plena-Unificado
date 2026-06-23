import type { Colaborador } from '@/types/database'

async function getXLSX() {
  return import('xlsx')
}

function getString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null) return String(value)
  }
  return ''
}

async function getDate(row: Record<string, unknown>, ...keys: string[]): Promise<string | null> {
  const XLSX = await getXLSX()
  for (const key of keys) {
    const value = row[key]
    if (value === undefined || value === null) continue
    if (value instanceof Date) return value.toISOString().split('T')[0]
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value)
      return date ? `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}` : null
    }
    const date = new Date(String(value))
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0]
  }
  return null
}

export async function parseExcelColaboradores(file: File): Promise<Partial<Colaborador>[]> {
  const XLSX = await getXLSX()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)

        const colaboradores: Partial<Colaborador>[] = await Promise.all(jsonData.map(async (row) => ({
          matricula: getString(row, 'matricula', 'Matricula', 'MATRICULA', 'Funcionário'),
          nome_completo: getString(row, 'nome_completo', 'Nome Completo', 'Nome do Funcionário', 'NOME'),
          cpf: getString(row, 'cpf', 'CPF'),
          rg: getString(row, 'rg', 'RG', 'Identidade'),
          ctps: getString(row, 'ctps', 'CTPS', 'Carteira de Trabalho'),
          pis_pasep: getString(row, 'pis_pasep', 'PIS/PASEP', 'PIS'),
          data_nascimento: await getDate(row, 'data_nascimento', 'Data Nascimento', 'Nascimento'),
          email: getString(row, 'email', 'Email'),
          telefone: getString(row, 'telefone', 'Telefone'),
          celular: getString(row, 'celular', 'Celular'),
          endereco: getString(row, 'endereco', 'Endereco', 'Endereço'),
          cidade: getString(row, 'cidade', 'Cidade'),
          estado: getString(row, 'estado', 'UF', 'Estado'),
          cep: getString(row, 'cep', 'CEP'),
          data_admissao: await getDate(row, 'data_admissao', 'Data Admissão', 'Admissão'),
          data_demissao: await getDate(row, 'data_demissao', 'Data Demissão', 'Demissão'),
          tipo_contrato: getString(row, 'tipo_contrato', 'Tipo Contrato', 'Vínculo') || 'CLT',
          cargo: getString(row, 'cargo', 'Cargo', 'Função'),
          departamento: getString(row, 'departamento', 'Departamento'),
          status: row.data_demissao || row.Demissão ? 'Inativo' : 'Ativo',
        })))

        resolve(colaboradores)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsBinaryString(file)
  })
}
