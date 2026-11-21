import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { ConsultaRiocardAcoes } from './ConsultaRiocardAcoes'
import { copiarCpf, cpfSoDigitos, URL_CONSULTA_RIOCARD } from '@/lib/vt/riocardConsulta'

describe('ConsultaRiocardAcoes', () => {
  const escrever = vi.fn().mockResolvedValue(undefined)
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, { clipboard: { writeText: escrever } })
  })

  it('abre a consulta em nova aba sem CPF na URL e copia só os dígitos', async () => {
    render(<ConsultaRiocardAcoes cpf="123.456.789-09" nome="Ana" />)
    const link = screen.getByRole('link', { name: /Consultar na Riocard/ })
    expect(link).toHaveAttribute('href', URL_CONSULTA_RIOCARD)
    expect(link.getAttribute('href')).not.toMatch(/12345678909/)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    fireEvent.click(screen.getByRole('button', { name: /Copiar CPF/ }))
    await waitFor(() => expect(escrever).toHaveBeenCalledWith('12345678909'))
    expect(toast.success).toHaveBeenCalled()
  })

  it('sem CPF cadastrado avisa e não copia', async () => {
    expect(cpfSoDigitos(' ')).toBeNull()
    expect(await copiarCpf(null)).toBe(false)
    expect(escrever).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })
})
