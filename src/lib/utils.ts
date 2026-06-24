import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Departamento } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatarCPF(cpf: string | null | undefined): string {
  if (!cpf) return ''
  const limpo = cpf.replace(/\D/g, '')
  if (limpo.length !== 11) return cpf
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
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
