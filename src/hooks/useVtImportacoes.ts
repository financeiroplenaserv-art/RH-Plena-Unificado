import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ColaboradorOptante, MudancaOptante } from '@/lib/vt/importacaoAlterdata'
import type { ColaboradorRiocard, MudancaBU } from '@/lib/vt/importacaoRiocard'

// Acesso ao banco da aba VT → Importações do mês. Só colaboradores Ativos e
// Afastados entram na prévia. Toda escrita termina em .select('id') e confere a
// contagem (escrita barrada por RLS volta 0 linhas SEM erro — AGENTS.md §12).
// O trigger de auditoria de `colaboradores` (migration 061) registra cada UPDATE.

const TAMANHO_PAGINA = 1000
const LOTE_IDS = 100
const PARALELO = 8

export interface ResultadoGravacao {
  esperadas: number
  gravadas: number
  erros: string[]
}

type LinhaColab = ColaboradorOptante & Omit<ColaboradorRiocard, 'id' | 'nome_completo' | 'cpf' | 'status' | 'vt_optante'>

export function useVtImportacoes() {
  /** Lê todos os ativos/afastados (paginado: o PostgREST corta em 1.000). */
  const carregarColaboradores = useCallback(async (): Promise<LinhaColab[]> => {
    const todos: LinhaColab[] = []
    for (let de = 0; ; de += TAMANHO_PAGINA) {
      const { data, error } = await supabase
        .from('colaboradores')
        .select(
          'id, nome_completo, cpf, matricula, status, vt_optante, vt_bu_ativado, vt_bu_situacao, vt_bu_consultado_em, vt_riocard_numero_cartao',
        )
        .in('status', ['Ativo', 'Afastado'])
        .order('id')
        .range(de, de + TAMANHO_PAGINA - 1)
      if (error) throw new Error(`Não consegui ler os colaboradores: ${error.message}`)
      const lote = (data ?? []) as unknown as LinhaColab[]
      todos.push(...lote)
      if (lote.length < TAMANHO_PAGINA) break
    }
    return todos
  }, [])

  const gravarOptantes = useCallback(async (mudancas: MudancaOptante[]): Promise<ResultadoGravacao> => {
    const res: ResultadoGravacao = { esperadas: mudancas.length, gravadas: 0, erros: [] }
    for (const valor of [true, false]) {
      const ids = mudancas.filter((m) => m.para === valor).map((m) => m.colaborador.id)
      for (let i = 0; i < ids.length; i += LOTE_IDS) {
        const lote = ids.slice(i, i + LOTE_IDS)
        const { data, error } = await supabase
          .from('colaboradores')
          .update({ vt_optante: valor } as never)
          .in('id', lote)
          .select('id')
        if (error) res.erros.push(`Lote de ${lote.length}: ${error.message}`)
        else {
          res.gravadas += data?.length ?? 0
          if ((data?.length ?? 0) !== lote.length) {
            res.erros.push(`Esperava gravar ${lote.length} e gravou ${data?.length ?? 0} (permissão?)`)
          }
        }
      }
    }
    return res
  }, [])

  const gravarBU = useCallback(async (mudancas: MudancaBU[]): Promise<ResultadoGravacao> => {
    const res: ResultadoGravacao = { esperadas: mudancas.length, gravadas: 0, erros: [] }
    for (let i = 0; i < mudancas.length; i += PARALELO) {
      const fatia = mudancas.slice(i, i + PARALELO)
      const retornos = await Promise.all(
        fatia.map((m) =>
          supabase
            .from('colaboradores')
            .update(m.depois as never)
            .eq('id', m.colaborador.id)
            .select('id'),
        ),
      )
      retornos.forEach((r, idx) => {
        if (r.error) res.erros.push(`${fatia[idx].colaborador.nome_completo}: ${r.error.message}`)
        else if (!r.data?.length) res.erros.push(`${fatia[idx].colaborador.nome_completo}: nenhuma linha gravada (permissão?)`)
        else res.gravadas += r.data.length
      })
    }
    return res
  }, [])

  return { carregarColaboradores, gravarOptantes, gravarBU }
}
