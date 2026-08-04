import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FiltrosAtivosBadge } from './FiltrosAtivosBadge'

describe('FiltrosAtivosBadge', () => {
  it('não renderiza nada com 0 filtros ativos', () => {
    const { container } = render(<FiltrosAtivosBadge total={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra a contagem no singular com 1 filtro', () => {
    render(<FiltrosAtivosBadge total={1} />)
    expect(screen.getByText('1 filtro ativo')).toBeInTheDocument()
  })

  it('mostra a contagem no plural com vários filtros', () => {
    render(<FiltrosAtivosBadge total={3} />)
    expect(screen.getByText('3 filtros ativos')).toBeInTheDocument()
  })

  it('não exibe o botão Limpar sem onLimpar', () => {
    render(<FiltrosAtivosBadge total={2} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('chama onLimpar ao clicar em Limpar', () => {
    const onLimpar = vi.fn()
    render(<FiltrosAtivosBadge total={2} onLimpar={onLimpar} />)
    fireEvent.click(screen.getByRole('button', { name: /limpar/i }))
    expect(onLimpar).toHaveBeenCalledTimes(1)
  })
})
