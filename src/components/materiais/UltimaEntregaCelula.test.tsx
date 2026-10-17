import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UltimaEntregaCelula } from './UltimaEntregaCelula'

describe('UltimaEntregaCelula', () => {
  it('sem histórico mostra só o traço', () => {
    render(<UltimaEntregaCelula data={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText(/antes do prazo/)).not.toBeInTheDocument()
  })
  it('data em texto normal, detalhe discreto e selo âmbar quando antes do prazo', () => {
    render(<UltimaEntregaCelula data="2026-08-01" detalhe="3 un" antesDoPrazo />)
    const data = screen.getByText('01/08/2026')
    expect(data.className).not.toMatch(/font-|text-amber|text-red/)
    expect(screen.getByText('3 un').className).toMatch(/text-\[11px\]/)
    expect(screen.getByText('antes do prazo').className).toMatch(/amber/)
  })
  it('tamanho no lugar da quantidade (uniforme) e sem selo fora do prazo', () => {
    render(<UltimaEntregaCelula data="2026-01-10" detalhe="tam. 40" />)
    expect(screen.getByText('tam. 40')).toBeInTheDocument()
    expect(screen.queryByText('antes do prazo')).not.toBeInTheDocument()
  })
})
