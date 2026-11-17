import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VtLoteCargaShadow } from './VtLoteCargaShadow'

describe('VtLoteCargaShadow', () => {
  it('executa construir, confirmar, aprovar por pessoa e substituir em memória', async () => {
    render(<VtLoteCargaShadow />)

    fireEvent.click(screen.getByRole('button', { name: 'Construir rascunho' }))
    expect(await screen.findByText('Rascunho salvo somente em memória')).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s*21,20/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar lote' }))
    expect(await screen.findByText('Lote confirmado somente em memória')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Recalcular com novo preço' }))
    expect(await screen.findByText('Divergências em relação a shadow-lote-1')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Aprovar Pessoa exemplo/ })).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Substituir lote confirmado' })).toBeDisabled()

    for (const pessoa of ['A', 'B', 'C']) {
      fireEvent.click(screen.getByRole('button', { name: `Aprovar Pessoa exemplo ${pessoa}` }))
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: `Aprovar Pessoa exemplo ${pessoa}` })).not.toBeInTheDocument()
      })
    }

    const substituir = screen.getByRole('button', { name: 'Substituir lote confirmado' })
    expect(substituir).toBeEnabled()
    fireEvent.click(substituir)

    expect(await screen.findByText('Substituto confirmado somente em memória')).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s*26,00/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Reiniciar cenário/ }))
    expect(screen.getByRole('button', { name: 'Construir rascunho' })).toBeInTheDocument()
  })

  it('mostra pendência de preço e impede a confirmação', async () => {
    render(<VtLoteCargaShadow />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Simular preço ausente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Construir rascunho' }))

    expect(await screen.findByText('Rascunho parcial — pendências impedem confirmar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar lote' })).toBeDisabled()
    expect(screen.getByText(/Pessoa exemplo B: Não há preço do pacote vigente/)).toBeInTheDocument()
    expect(screen.getByText('parcial')).toBeInTheDocument()
  })
})
