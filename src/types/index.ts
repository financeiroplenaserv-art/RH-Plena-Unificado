export * from './database'
export * from './econtador'
export * from './vr'
export * from './adicionais'

export interface Modulo {
  id: string
  nome: string
  descricao: string
  icone: string
  path: string
  cor: string
}

export interface MenuItem {
  path: string
  label: string
  icone: string
  nivelMinimo?: import('./database').NivelAcesso
}
