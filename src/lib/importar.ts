import type { Colaborador } from '@/types/database'
import { validarCPF } from '@/lib/utils'

async function getXLSX() {
  return import('@e965/xlsx')
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

export interface RegistroLimpo {
  payload: Record<string, unknown>
  cpfInvalido: boolean
}

const CAMPOS_OPCIONAIS: (keyof Colaborador)[] = [
  'cpf',
  'rg',
  'ctps',
  'pis_pasep',
  'data_nascimento',
  'email',
  'telefone',
  'celular',
  'endereco',
  'cidade',
  'estado',
  'cep',
  'data_admissao',
  'data_demissao',
  'cargo',
  'departamento',
]

/**
 * Monta o payload de upsert sem campos vazios, para não zerar dados já
 * cadastrados quando a planilha não traz a informação. Linhas sem matrícula
 * ou sem nome retornam null (inválidas). CPF com dígitos inválidos não é
 * persistido (sinalizado em cpfInvalido).
 */
export function limparRegistroParaUpsert(registro: Partial<Colaborador>): RegistroLimpo | null {
  const matricula = (registro.matricula || '').trim()
  const nome = (registro.nome_completo || '').trim()
  if (!matricula || !nome) return null

  const payload: Record<string, unknown> = {
    matricula,
    nome_completo: nome,
    status: registro.status || 'Ativo',
    tipo_contrato: registro.tipo_contrato || 'CLT',
  }

  for (const campo of CAMPOS_OPCIONAIS) {
    const valor = registro[campo]
    if (typeof valor === 'string' && valor.trim() !== '') {
      payload[campo] = valor.trim()
    }
  }

  let cpfInvalido = false
  if (typeof payload.cpf === 'string' && !validarCPF(payload.cpf)) {
    delete payload.cpf
    cpfInvalido = true
  }

  return { payload, cpfInvalido }
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
