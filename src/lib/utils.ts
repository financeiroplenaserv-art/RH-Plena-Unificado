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
