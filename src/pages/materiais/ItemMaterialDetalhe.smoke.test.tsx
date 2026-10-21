import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { useMateriaisCatalogo } from '@/hooks/useMateriaisCatalogo'
import type { MatItem } from '@/types/materiais'
import { ItemMaterialDetalhe } from './ItemMaterialDetalhe'

// Smoke da seção "Compra ao fornecedor" do item (migration 152). Hook mockado.

const salvarMultiploCompra = vi.fn(async () => true)
const catalogo = {
  variacoes: [],
  precos: [],
  contratos: [],
  carregar: vi.fn(),
  salvarVariacao: vi.fn(),
  alternarVariacao: vi.fn(),
  registrarPreco: vi.fn(),
  salvarVisaoLider: vi.fn(),
  alternarOcultaLider: vi.fn(),
  salvarMultiploCompra,
} as unknown as ReturnType<typeof useMateriaisCatalogo>

const item: MatItem = {
  id: 'fl',
  nome: 'Flanela branca de algodão',
  categoria: 'limpeza',
  unidade_pedido: 'unidade',
  fornecedor_id: null,
  validade_meses: null,
  tem_variacao: false,
  ativo: true,
  ordem: 1,
  fator_compra: 1,
  unidade_compra: null,
  fracionado_escritorio: false,
}

describe('ItemMaterialDetalhe — compra ao fornecedor (152)', () => {
  it('valida, mostra o exemplo e salva unidade, fator e fracionado', async () => {
    render(<ItemMaterialDetalhe item={item} onFechar={vi.fn()} podeEditar catalogo={catalogo} fornecedores={[]} />)
    const botao = screen.getByText('Salvar compra do item').closest('button')!
    expect(botao.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Quantas unidades do pedido/), { target: { value: '100' } })
    expect(screen.getByText(/Diga como o fornecedor vende/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Como o fornecedor vende'), { target: { value: 'kit' } })
    expect(screen.getByText(/compra 1 kit c\/ 100, 97 para o estoque/)).toBeTruthy()
    fireEvent.click(screen.getByText('Salvar compra do item'))
    await vi.waitFor(() => expect(salvarMultiploCompra).toHaveBeenCalledTimes(1))
    expect(salvarMultiploCompra).toHaveBeenCalledWith('fl', { unidade_compra: 'kit', fator_compra: 100, fracionado_escritorio: false })
  })

  it('quem não edita só lê', () => {
    render(
      <ItemMaterialDetalhe
        item={{ ...item, fator_compra: 4, unidade_compra: 'caixa', fracionado_escritorio: true }}
        onFechar={vi.fn()}
        podeEditar={false}
        catalogo={catalogo}
        fornecedores={[]}
      />
    )
    expect(screen.getByText(/Comprado em caixa com 4 unidades/)).toBeTruthy()
    expect(screen.queryByText('Salvar compra do item')).toBeNull()
  })
})
