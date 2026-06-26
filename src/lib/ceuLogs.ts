export interface LogExclusaoCEU {
  id: string
  tipo: string
  descricao: string
  data: string
  usuario: string
}

const STORAGE_KEY = 'ceu_logs_exclusao'

export function listarLogsExclusao(): LogExclusaoCEU[] {
  if (typeof window === 'undefined') return []
  const salvo = localStorage.getItem(STORAGE_KEY)
  if (!salvo) return []
  try {
    return JSON.parse(salvo)
  } catch (err) {
    console.error('Erro ao parsear logs de exclusão CEU:', err)
    return []
  }
}

export function registrarLogExclusao(tipo: string, descricao: string, usuario = 'usuário atual') {
  if (typeof window === 'undefined') return
  const logs = listarLogsExclusao()
  logs.unshift({
    id: crypto.randomUUID(),
    tipo,
    descricao,
    data: new Date().toISOString(),
    usuario,
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, 500)))
}
