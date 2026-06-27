import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Departamento } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatarCPF(cpf: string | number | null | undefined): string {
  if (cpf === null || cpf === undefined || cpf === '') return ''
  const texto = String(cpf)
  const limpo = texto.replace(/\D/g, '')
  if (limpo.length !== 11) return texto
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function mascararCPF(cpf: string | null | undefined): string {
  if (!cpf) return ''
  const formatado = formatarCPF(cpf)
  if (formatado.length !== 14) return formatado
  // 123.456.789-00 → ***.456.789-**
  return `***${formatado.slice(3, 12)}**`
}

export function validarCPF(cpf: string | number | null | undefined): boolean {
  if (cpf === null || cpf === undefined || cpf === '') return false
  const limpo = String(cpf).replace(/\D/g, '')

  if (limpo.length !== 11) return false
  if (/^(\d)\1{10}$/.test(limpo)) return false

  let soma = 0
  let resto

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(limpo.substring(i - 1, i), 10) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(limpo.substring(9, 10), 10)) return false

  soma = 0
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(limpo.substring(i - 1, i), 10) * (12 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(limpo.substring(10, 11), 10)) return false

  return true
}

export function formatarCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return ''
  const limpo = cnpj.replace(/\D/g, '')
  if (limpo.length !== 14) return cnpj
  return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export function formatarData(data: string | null | undefined): string {
  if (!data) return ''
  const d = new Date(data + 'T00:00:00')
  if (isNaN(d.getTime())) return data
  return d.toLocaleDateString('pt-BR')
}

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function nomeDepartamento(departamento: Departamento | null | undefined): string {
  if (!departamento) return '—'
  return departamento.nome_curto?.trim() || departamento.nome
}

export function nomeCurtoColaborador(colaborador: { nome_completo: string } | null | undefined): string {
  if (!colaborador?.nome_completo) return ''
  const partes = colaborador.nome_completo.trim().split(/\s+/)
  if (partes.length <= 2) return colaborador.nome_completo.trim()
  return `${partes[0]} ${partes[partes.length - 1]}`
}

export function nomeCurtoLocal(local: { nome: string; nome_curto?: string | null } | null | undefined): string {
  if (!local) return ''
  return local.nome_curto?.trim() || local.nome
}

export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + custo
      )
    }
  }
  return dp[m][n]
}

export function nomesSimilares(a: string, b: string, threshold = 2): boolean {
  const normalizar = (s: string) => removerAcentos(s).toUpperCase().replace(/[^A-Z0-9]/g, '')
  const na = normalizar(a)
  const nb = normalizar(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true

  const dist = distanciaLevenshtein(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  return dist <= threshold && dist / maxLen < 0.2
}

export function mascaraMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor)) return 'R$ 0,00'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function mascaraMoedaInput(valor: string): string {
  const digitos = valor.replace(/\D/g, '')
  const numero = parseInt(digitos || '0', 10) / 100
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function parseMoeda(valor: string | null | undefined): number {
  if (!valor) return 0
  const digitos = valor.replace(/\D/g, '')
  const numero = parseInt(digitos || '0', 10) / 100
  return isNaN(numero) ? 0 : numero
}

/**
 * Aplica máscara de telefone/celular brasileiro:
 * - Fixo: (00) 0000-0000
 * - Celular: (00) 00000-0000
 */
export function mascaraTelefone(valor: string | null | undefined): string {
  if (!valor) return ''
  const limpo = valor.replace(/\D/g, '').slice(0, 11)
  if (limpo.length <= 10) {
    return limpo.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, (_, ddd, prefixo, sufixo) => {
      if (sufixo) return `(${ddd}) ${prefixo}-${sufixo}`
      if (prefixo) return `(${ddd}) ${prefixo}`
      if (ddd) return `(${ddd}`
      return ''
    })
  }
  return limpo.replace(/(\d{0,2})(\d{0,5})(\d{0,4})/, (_, ddd, prefixo, sufixo) => {
    if (sufixo) return `(${ddd}) ${prefixo}-${sufixo}`
    if (prefixo) return `(${ddd}) ${prefixo}`
    if (ddd) return `(${ddd}`
    return ''
  })
}

export function mascaraCEP(valor: string | null | undefined): string {
  if (!valor) return ''
  const limpo = valor.replace(/\D/g, '').slice(0, 8)
  return limpo.replace(/(\d{0,5})(\d{0,3})/, (_, prefixo, sufixo) => {
    if (sufixo) return `${prefixo}-${sufixo}`
    return prefixo
  })
}

/**
 * Escapa caracteres especiais de HTML para prevenir XSS.
 * Converte <, >, &, " e ' em suas entidades HTML seguras.
 */
export function escapeHtml(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return ''
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
