export * from './database'
export * from './econtador'
export * from './vr'
export * from './adicionais'
export * from './extras'

export interface Paginacao {
  pagina: number
  tamanho: number
}

export interface ResultadoPaginado<T> {
  dados: T[]
  total: number
  pagina: number
  tamanho: number
  totalPaginas: number
}
