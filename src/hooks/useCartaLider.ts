import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { competenciaDe } from '@/lib/materiais/datas'
import { mensagemErroMateriais } from '@/lib/materiais/erros'
import { selecionarTudo } from '@/lib/materiais/paginar'
import { nomeExibicaoItem } from '@/lib/materiais/buscaItens'
import { nomesCurtos, separarTamanhoDoNome } from '@/lib/materiais/pecasCeu'
import { linhasCartaCeu, linhasCartaProdutos, montarCarta, type CartaLider } from '@/lib/materiais/cartaLider'
import { buscarPorIds, COLUNAS_CEU_PEDIDO, COLUNAS_ENVIO, COLUNAS_ITEM_PEDIDO, COLUNAS_PEDIDO, numerarItem } from './useMateriaisPedidos'
import { carregarCamposFase2 } from './useMateriaisCompras'
import type { CeuPedidoItem, MatPedido, MatPedidoEnvio, MatPedidoItem } from '@/types/materiais'

// Monta as cartas ao líder de uma competência (todas, ou de um contrato).
// Só leitura. Pessoas só como "Primeiro N." (nomesCurtos), marca oculta para o
// líder não aparece, sem preço/CPF/matrícula. Um contrato com pedido mensal e
// pedido(s) extra no mês recebe UMA carta com tudo.

type ItemNome = { id: string; nome: string; unidade_pedido: string | null; nome_lider: string | null }
type VarNome = { id: string; rotulo: string; oculta_lider: boolean | null }

export function useCartaLider() {
  const [gerando, setGerando] = useState(false)

  const montar = useCallback(async (competencia: string, contratoId?: string | null): Promise<CartaLider[] | null> => {
    setGerando(true)
    try {
      const comp = competenciaDe(competencia)
      let q = supabase
        .from('mat_pedidos')
        .select(COLUNAS_PEDIDO)
        .eq('competencia', comp)
        .not('status_produtos', 'in', '(cancelado,rascunho)')
        .order('created_at')
        .limit(1000)
      if (contratoId) q = q.eq('contrato_id', contratoId)
      const rp = await q
      if (rp.error) throw rp.error
      const pedidos = (rp.data as MatPedido[]) ?? []
      if (pedidos.length === 0) return []
      const ids = pedidos.map((p) => p.id)

      const [ri, re, rc, fase2, rit, rv, rct] = await Promise.all([
        buscarPorIds<MatPedidoItem>(ids, (lote, de, ate) =>
          supabase.from('mat_pedido_itens').select(COLUNAS_ITEM_PEDIDO).in('pedido_id', lote).order('created_at').order('id').range(de, ate)
        ),
        buscarPorIds<MatPedidoEnvio>(ids, (lote, de, ate) =>
          supabase.from('mat_pedido_envios').select(COLUNAS_ENVIO).in('pedido_id', lote).order('id').range(de, ate)
        ),
        buscarPorIds<CeuPedidoItem>(ids, (lote, de, ate) =>
          supabase
            .from('ceu_pedido_itens')
            .select(`${COLUNAS_CEU_PEDIDO}, qtd_atendida, motivo_atendimento`)
            .in('pedido_id', lote)
            .order('id')
            .range(de, ate)
        ),
        carregarCamposFase2(ids),
        selecionarTudo<ItemNome>((de, ate) => supabase.from('mat_itens').select('id, nome, unidade_pedido, nome_lider').order('id').range(de, ate)),
        selecionarTudo<VarNome>((de, ate) => supabase.from('mat_item_variacoes').select('id, rotulo, oculta_lider').order('id').range(de, ate)),
        supabase.from('mat_contratos').select('id, nome').in('id', [...new Set(pedidos.map((p) => p.contrato_id))]),
      ])
      const erro = ri.error ?? re.error ?? rc.error ?? rit.error ?? rv.error ?? rct.error
      if (erro) throw erro

      const itemPorId = new Map((rit.data ?? []).map((i) => [i.id, i]))
      const varPorId = new Map((rv.data ?? []).map((v) => [v.id, v]))
      const contratoNome = new Map(((rct.data as { id: string; nome: string }[]) ?? []).map((c) => [c.id, c.nome]))
      const linhas = ri.data.map((l) => ({ ...numerarItem(l), ...(fase2.get(l.id) ?? {}) }))
      const ceu = rc.data

      // Nomes das peças do CEU e das pessoas.
      const ceuItemIds = [...new Set(ceu.map((l) => l.item_id).filter((x): x is string => !!x))]
      const colabIds = [...new Set(ceu.map((l) => l.colaborador_id).filter((x): x is string => !!x))]
      const [rpecas, rcol] = await Promise.all([
        buscarPorIds<{ id: string; nome: string }>(ceuItemIds, (lote, de, ate) =>
          supabase.from('itens').select('id, nome').in('id', lote).order('id').range(de, ate)
        ),
        buscarPorIds<{ id: string; nome_completo: string }>(colabIds, (lote, de, ate) =>
          supabase.from('colaboradores').select('id, nome_completo').in('id', lote).order('id').range(de, ate)
        ),
      ])
      const pecaNome = new Map(rpecas.data.map((p) => [p.id, p.nome]))
      const colabNome = new Map(rcol.data.map((c) => [c.id, c.nome_completo]))

      const descricao = (itemId: string | null, variacaoId: string | null) => {
        const it = itemId ? itemPorId.get(itemId) : null
        if (!it) return 'Item'
        const v = variacaoId ? varPorId.get(variacaoId) : null
        return nomeExibicaoItem(it.nome_lider || it.nome, v && !v.oculta_lider ? v.rotulo : null)
      }

      const porContrato = new Map<string, MatPedido[]>()
      for (const p of pedidos) porContrato.set(p.contrato_id, [...(porContrato.get(p.contrato_id) ?? []), p])

      const cartas: CartaLider[] = []
      for (const [cid, peds] of porContrato) {
        const pids = new Set(peds.map((p) => p.id))
        const doContrato = linhas.filter((l) => pids.has(l.pedido_id))
        const ceuDoContrato = ceu.filter((l) => pids.has(l.pedido_id))
        if (doContrato.length === 0 && ceuDoContrato.length === 0) continue
        const envios = re.data.filter((e) => pids.has(e.pedido_id)).sort((a, b) => a.enviado_em.localeCompare(b.enviado_em))
        const responsavelBruto = envios[envios.length - 1]?.seu_nome ?? peds[0].responsavel_nome ?? null

        // Pessoas: "Primeiro N." com desambiguação na lista do contrato (o líder entra junto).
        const nomesCompletos = [...new Set(ceuDoContrato.map((l) => (l.colaborador_id && colabNome.get(l.colaborador_id)) || l.nome_digitado || 'Colaborador'))]
        const lista = responsavelBruto ? [...nomesCompletos, responsavelBruto] : nomesCompletos
        const curtos = nomesCurtos(lista)
        const curtoDe = new Map(lista.map((n, i) => [n, curtos[i]]))

        cartas.push(
          montarCarta({
            contratoId: cid,
            contratoNome: contratoNome.get(cid) ?? 'Contrato',
            competencia: comp,
            responsavel: responsavelBruto ? (curtoDe.get(responsavelBruto) ?? null) : null,
            produtos: linhasCartaProdutos(doContrato, {
              descricao: (l) => descricao(l.item_id, l.variacao_id),
              unidade: (l) => (l.item_id ? (itemPorId.get(l.item_id)?.unidade_pedido ?? null) : null),
              original: (l) => (l.item_original_id ? descricao(l.item_original_id, l.variacao_original_id ?? null) : null),
            }),
            ceu: linhasCartaCeu(ceuDoContrato, {
              peca: (l) => (l.item_id && pecaNome.get(l.item_id) ? separarTamanhoDoNome(pecaNome.get(l.item_id)!).base : 'Peça'),
              pessoa: (l) => curtoDe.get((l.colaborador_id && colabNome.get(l.colaborador_id)) || l.nome_digitado || 'Colaborador') ?? 'Colaborador',
            }),
          })
        )
      }
      return cartas.sort((a, b) => a.contratoNome.localeCompare(b.contratoNome, 'pt-BR'))
    } catch (e) {
      toast.error(mensagemErroMateriais(e as { code?: string; message?: string }, 'montar as cartas ao líder'))
      return null
    } finally {
      setGerando(false)
    }
  }, [])

  return { gerando, montar }
}
