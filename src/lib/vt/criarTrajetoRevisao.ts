import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { escopoSugerido } from '@/lib/vt/trajetos'
import { precisaoDoEndereco } from '@/lib/vt/enderecos'
import type { Database } from '@/types/database'

/**
 * Cria, pela fila "Rotas a confirmar" (21/11/2026), o trajeto de quem está "Sem
 * rota cadastrada" e a decisão aberta que o painel VtRevisaoRota precisa.
 *
 * - O trajeto nasce 'sugerido'/'manual' SEM bilhete legado (migration 175: o
 *   bilhete da planilha NÃO é inventado — o preço vem do motor novo quando a
 *   revisão é confirmada). 'sugerido' nunca é pago: o portão legado só paga
 *   trajeto 'confirmado' com bilhete resolvido e o lote novo só usa decisão
 *   confirmada.
 * - A decisão nasce 'sugerida' (sem itinerário nem preço) na próxima revisão livre.
 * - Idempotente: trajeto/decisão que já existem (ou que um colega criou no mesmo
 *   instante — 23505) são recuperados, nunca duplicados.
 * - Toda escrita termina em .select('id') e confere o retorno (anti-falso-sucesso).
 */

/** A migration 175 ainda não foi aplicada: bilhete_id é NOT NULL no banco. */
export class MigracaoTrajetoSemBilhetePendente extends Error {
  constructor() {
    super('Criar o trajeto pela fila depende da migration 175 (ainda não aplicada no banco).')
    this.name = 'MigracaoTrajetoSemBilhetePendente'
  }
}

export interface EntradaCriarTrajetoRevisao {
  colaboradorId: string
  departamentoId: string
  cidadeCasa: string | null
  enderecoCasa: string | null
  cidadePosto: string | null
  /** Data de Brasília (AAAA-MM-DD) usada como início de vigência da decisão. */
  hoje: string
}

export interface TrajetoPreparadoParaRevisao {
  trajetoId: string
  decisaoId: string
  /** true quando o trajeto foi criado agora (e não apenas recuperado). */
  trajetoCriado: boolean
}

export async function criarTrajetoParaRevisao(
  entrada: EntradaCriarTrajetoRevisao,
  cliente: SupabaseClient<Database> = supabase,
): Promise<TrajetoPreparadoParaRevisao> {
  const { colaboradorId, departamentoId } = entrada

  const buscarTrajeto = async (): Promise<string | null> => {
    const { data, error } = await cliente
      .from('vt_trajetos')
      .select('id')
      .eq('colaborador_id', colaboradorId)
      .eq('departamento_id', departamentoId)
      .limit(1)
    if (error) throw error
    return data?.[0]?.id ?? null
  }

  let trajetoId = await buscarTrajeto()
  let trajetoCriado = false
  if (!trajetoId) {
    const { data, error } = await cliente
      .from('vt_trajetos')
      .insert({
        colaborador_id: colaboradorId,
        departamento_id: departamentoId,
        bilhete_id: null,
        bilhete_2_id: null,
        escopo: escopoSugerido(entrada.cidadeCasa, entrada.cidadePosto),
        precisao_origem: precisaoDoEndereco(entrada.enderecoCasa),
        origem: 'manual',
        status: 'sugerido',
        valor_extra_centavos: 0,
        observacao: 'Criado pela fila Rotas a confirmar; o preço vem da revisão da rota.',
      })
      .select('id')
    if (error) {
      if (error.code === '23502') throw new MigracaoTrajetoSemBilhetePendente()
      if (error.code !== '23505') throw error
      // Conflito colaborador × posto: outro operador criou agora — recupera.
      trajetoId = await buscarTrajeto()
      if (!trajetoId) throw error
    } else {
      if (!data || data.length === 0) {
        throw new Error('Não foi possível criar o trajeto: nada foi gravado (permissão).')
      }
      trajetoId = data[0].id
      trajetoCriado = true
    }
  }

  const decisaoId = await garantirDecisao(cliente, trajetoId, entrada)
  return { trajetoId, decisaoId, trajetoCriado }
}

async function garantirDecisao(
  cliente: SupabaseClient<Database>,
  trajetoId: string,
  entrada: EntradaCriarTrajetoRevisao,
): Promise<string> {
  const existente = async (): Promise<string | null> => {
    const { data, error } = await cliente
      .from('vt_trajeto_decisoes')
      .select('id')
      .eq('trajeto_legado_id', trajetoId)
      .limit(1)
    if (error) throw error
    return data?.[0]?.id ?? null
  }
  const jaTem = await existente()
  if (jaTem) return jaTem

  // A decisão de um trajeto apagado fica órfã (trajeto_legado_id nulo) mas mantém a
  // revisão do par colaborador × posto (UNIQUE): a nova entra na revisão seguinte.
  const { data: revisoes, error: erroRevisao } = await cliente
    .from('vt_trajeto_decisoes')
    .select('revisao')
    .eq('colaborador_id', entrada.colaboradorId)
    .eq('departamento_id', entrada.departamentoId)
    .order('revisao', { ascending: false })
    .limit(1)
  if (erroRevisao) throw erroRevisao
  const revisao = (revisoes?.[0]?.revisao ?? 0) + 1

  const { data, error } = await cliente
    .from('vt_trajeto_decisoes')
    .insert({
      trajeto_legado_id: trajetoId,
      colaborador_id: entrada.colaboradorId,
      departamento_id: entrada.departamentoId,
      revisao,
      cotacao_id: null,
      custo_diario_centavos: null,
      status: 'sugerida',
      confirmado_por: null,
      confirmado_em: null,
      vigente_desde: entrada.hoje,
      vigente_ate: null,
      origem: 'manual',
      referencias_legadas_nao_resolvidas: [],
      itinerario_id: null,
    })
    .select('id')
  if (error) {
    if (error.code !== '23505') throw error
    const concorrente = await existente()
    if (!concorrente) throw error
    return concorrente
  }
  if (!data || data.length === 0) {
    throw new Error('Não foi possível criar a revisão da rota: nada foi gravado (permissão).')
  }
  return data[0].id
}
