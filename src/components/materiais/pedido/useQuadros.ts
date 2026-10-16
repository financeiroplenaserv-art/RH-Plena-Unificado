import { useState } from 'react'
import type { ErroCampo } from '@/lib/materiais/pedidoLider'
import { errosDe } from './formPedido'

/**
 * Quadros que recolhem em uma linha resumida depois do "Pronto" (16/10/2026).
 * Linha com erro (pela validação completa) fica SEMPRE aberta; linha válida só
 * fica aberta enquanto está em `abertas`. Rascunho recém-aberto: nada em
 * `abertas`, então as válidas aparecem recolhidas e as inválidas abertas.
 */
export function useQuadros(errosTodos: ErroCampo[], visiveis: ErroCampo[]) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  /** Linhas em que o líder tocou "Pronto" com pendência: mostram os erros na hora. */
  const [mostrar, setMostrar] = useState<Set<string>>(new Set())

  const invalida = (chave: string, extra = false) => extra || errosDe(errosTodos, chave).length > 0
  const estaAberta = (chave: string, extra = false) => abertas.has(chave) || invalida(chave, extra)
  const errosDaLinha = (chave: string) => errosDe(mostrar.has(chave) ? errosTodos : visiveis, chave)

  /** Abre só esta; as outras válidas recolhem, as inválidas seguem abertas e passam a mostrar o erro. */
  const abrirSo = (chave: string) => {
    setAbertas(new Set([chave]))
    setMostrar((m) => {
      const n = new Set(m)
      for (const e of errosTodos) if (e.chave && e.chave !== chave) n.add(e.chave)
      return n
    })
  }
  const recolherValidas = () => setAbertas(new Set())
  /** "Pronto": recolhe se válida; senão mostra o erro e mantém aberta. Devolve se recolheu. */
  const pronto = (chave: string, valida: boolean): boolean => {
    if (!valida) {
      setMostrar((m) => new Set(m).add(chave))
      return false
    }
    setAbertas((s) => {
      const n = new Set(s)
      n.delete(chave)
      return n
    })
    return true
  }
  const mostrarErro = (chave: string) => mostrar.has(chave)

  return { estaAberta, errosDaLinha, abrirSo, recolherValidas, pronto, invalida, mostrarErro }
}

/** Foco + rolagem até um elemento (depois do render que recolhe o quadro). */
export function focarDepois(id: string) {
  setTimeout(() => {
    const el = document.getElementById(id)
    el?.focus()
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, 0)
}
