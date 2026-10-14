import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { MatItem } from '@/types/materiais'

const substituir = vi.fn().mockResolvedValue({
  contratos: 2,
  linhas_trocadas: 2,
  linhas_somadas: 1,
  contratos_com_soma: 1,
  alteracoes_pendentes: 0,
  inativado: true,
  historico_vinculado: true,
})

const carregarPrevia = vi.fn().mockResolvedValue({
  kit: [
    { id: 'k1', contrato_id: 'c1', item_id: 'X', variacao_id: null, quantidade: 2, periodicidade_meses: 1 },
    { id: 'k2', contrato_id: 'c1', item_id: 'Y', variacao_id: null, quantidade: 3, periodicidade_meses: 1 },
    { id: 'k3', contrato_id: 'c2', item_id: 'X', variacao_id: null, quantidade: 4, periodicidade_meses: 2 },
  ],
  contratos: [
    { id: 'c1', nome: 'Alfa', ativo: true },
    { id: 'c2', nome: 'Beta', ativo: false },
  ],
  vinculos: [],
})

vi.mock('@/hooks/useMateriaisSubstituicao', () => ({
  useMateriaisSubstituicao: () => ({ carregando: false, salvando: false, carregarPrevia, substituir }),
}))

import { SubstituirItemDialog } from './SubstituirItemDialog'

const item = (id: string, nome: string): MatItem => ({
  id,
  nome,
  categoria: 'limpeza',
  unidade_pedido: 'bombona 5L',
  fornecedor_id: null,
  validade_meses: null,
  tem_variacao: false,
  ativo: true,
  ordem: null,
})

describe('SubstituirItemDialog', () => {
  it('mostra a prévia com soma destacada e chama a RPC com as opções', async () => {
    const onConcluido = vi.fn()
    render(
      <SubstituirItemDialog
        item={item('X', 'Detergente X')}
        itens={[item('X', 'Detergente X'), item('Y', 'Detergente Y')]}
        variacoes={[]}
        onFechar={vi.fn()}
        onConcluido={onConcluido}
      />
    )
    fireEvent.change(screen.getByLabelText('Item de destino *'), { target: { value: 'Y' } })

    expect(await screen.findByText('Alfa')).toBeInTheDocument()
    expect(screen.getByText('Soma')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument() // 2 + 3
    expect(screen.getByText('Inativo')).toBeInTheDocument() // contrato inativo também entra

    fireEvent.click(screen.getByRole('button', { name: /Substituir$/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Substituir' }))
    await waitFor(() =>
      expect(substituir).toHaveBeenCalledWith(
        { deItemId: 'X', deVariacaoId: null, paraItemId: 'Y', paraVariacaoId: null },
        true,
        true
      )
    )
    await waitFor(() => expect(onConcluido).toHaveBeenCalled())
  })
})
