import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

const PREFIXO = 'corh:filtros:'

/**
 * useState que persiste o valor no sessionStorage (por aba) sob a chave
 * `corh:filtros:<chave>`. Pensado para filtros de tela: ao navegar para
 * outra página e voltar, o filtro continua como o usuário deixou.
 *
 * - Escopo por ABA: duas abas abertas mantêm filtros independentes; ao
 *   fechar a aba o valor é descartado (não vira "filtro fantasma" no dia
 *   seguinte).
 * - O botão "Limpar" da tela continua funcionando: ele apenas muda o
 *   estado, e o hook persiste o valor limpo como qualquer outro.
 * - Use apenas com valores serializáveis em JSON (string, number, boolean,
 *   arrays e objetos simples). Estados com Date, Set ou Map NÃO devem usar
 *   este hook.
 */
export function useFiltroPersistente<T>(
  chave: string,
  valorInicial: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [valor, setValor] = useState<T>(() => {
    try {
      const salvo = sessionStorage.getItem(PREFIXO + chave)
      if (salvo !== null) return JSON.parse(salvo) as T
    } catch {
      // sessionStorage indisponível ou JSON inválido: cai no valor inicial
    }
    return typeof valorInicial === 'function' ? (valorInicial as () => T)() : valorInicial
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(PREFIXO + chave, JSON.stringify(valor))
    } catch {
      // sessão cheia ou indisponível: a tela funciona sem persistir
    }
  }, [chave, valor])

  return [valor, setValor]
}
