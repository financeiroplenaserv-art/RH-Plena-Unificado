import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VtColaboradoresTab } from './VtColaboradoresTab'
import type { VtColaborador } from '@/hooks/useVt'

const PESSOA: VtColaborador = {
  id: 'p1',
  nome_completo: 'WILLIAN RIBEIRO',
  departamento: 'CBO',
  departamento_id: null,
  cidade: 'Niterói',
  endereco: null,
  cep: null,
  vt_optante: true,
  vt_tipo_cartao: 'bui',
  vt_bu_ativado: false,
  vt_bu_situacao: 'Suspenso Setrans',
  vt_bu_consultado_em: '2026-10-28',
  cargo: null,
}

describe('VtColaboradoresTab — BU na Riocard somente leitura', () => {
  it('mostra a situação do BU e a data da consulta, sem seletor de tipo de bilhete', () => {
    render(
      <VtColaboradoresTab
        colaboradores={[PESSOA, { ...PESSOA, id: 'p2', nome_completo: 'OUTRA PESSOA', vt_bu_situacao: null, vt_bu_ativado: null }]}
        departamentos={[]}
        trajetos={[]}
        loading={false}
        podeGerenciar
        salvarVtColaborador={vi.fn()}
        ehFerista={() => false}
      />,
    )

    expect(screen.getByText('Suspenso Setrans')).toBeInTheDocument()
    expect(screen.getByText(/consulta de 28\/10\/2026/)).toBeInTheDocument()
    expect(screen.getByText('não consultado')).toBeInTheDocument()
    expect(screen.queryByText('Tipo de bilhete')).not.toBeInTheDocument()
    expect(screen.queryByText('Escolha o bilhete')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Usa VT — WILLIAN RIBEIRO')).toBeEnabled()
  })
})

describe('VtColaboradoresTab — exceção "pagar tarifa cheia"', () => {
  it('marcar exige motivo e grava com o motivo informado', async () => {
    const salvarExcecao = vi.fn().mockResolvedValue(true)
    render(
      <VtColaboradoresTab
        colaboradores={[PESSOA]}
        departamentos={[]}
        trajetos={[]}
        loading={false}
        podeGerenciar
        salvarVtColaborador={vi.fn()}
        salvarExcecaoTarifaCheia={salvarExcecao}
        ehFerista={() => false}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Exceção: pagar tarifa cheia' }))
    const registrar = await screen.findByRole('button', { name: 'Registrar exceção' })
    expect(registrar).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Motivo (obrigatório)'), { target: { value: '  decisão da diretoria  ' } })
    expect(registrar).toBeEnabled()
    fireEvent.click(registrar)
    await waitFor(() => expect(salvarExcecao).toHaveBeenCalledWith('p1', { tarifaCheia: true, motivo: 'decisão da diretoria' }))
  })

  it('mostra o selo com o motivo e pede confirmação para remover', async () => {
    const salvarExcecao = vi.fn().mockResolvedValue(true)
    render(
      <VtColaboradoresTab
        colaboradores={[{ ...PESSOA, vt_tarifa_cheia: true, vt_tarifa_cheia_motivo: 'trajeto sem integração possível' }]}
        departamentos={[]}
        trajetos={[]}
        loading={false}
        podeGerenciar
        salvarVtColaborador={vi.fn()}
        salvarExcecaoTarifaCheia={salvarExcecao}
        ehFerista={() => false}
      />,
    )
    expect(screen.getByText('Tarifa cheia (exceção)').closest('[title]')).toHaveAttribute('title', 'Motivo: trajeto sem integração possível')
    fireEvent.click(screen.getByRole('button', { name: 'Remover exceção' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sim, remover' }))
    await waitFor(() => expect(salvarExcecao).toHaveBeenCalledWith('p1', { tarifaCheia: false, motivo: null }))
  })

  it('sem permissão de gerenciar não oferece a ação', () => {
    render(
      <VtColaboradoresTab
        colaboradores={[PESSOA]}
        departamentos={[]}
        trajetos={[]}
        loading={false}
        podeGerenciar={false}
        salvarVtColaborador={vi.fn()}
        salvarExcecaoTarifaCheia={vi.fn()}
        ehFerista={() => false}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Exceção: pagar tarifa cheia' })).not.toBeInTheDocument()
    expect(screen.getByText('Presumida')).toBeInTheDocument()
  })
})
