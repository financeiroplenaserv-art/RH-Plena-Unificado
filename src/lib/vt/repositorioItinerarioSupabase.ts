import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  prepararEvidenciaItinerario,
  type EscolhaItinerarioVT,
  type NovaEvidenciaItinerario,
} from '@/lib/vt/itinerarioEvidencia'
import type { Database } from '@/types/database'
import type { VtItinerario, VtTrajetoDecisao } from '@/types/vt'
import {
  ajustesNaoCopiados,
  componentesNaoCopiados,
  novaRevisaoDeDecisao,
} from '@/lib/vt/itinerarioRevisao'

export interface EscolhaItinerarioSalva {
  decisaoId: string
  evidencia: VtItinerario
  repetido: boolean
}

export type DecisaoParaItinerario = Pick<
  Database['public']['Tables']['vt_trajeto_decisoes']['Row'],
  'id' | 'trajeto_legado_id' | 'colaborador_id' | 'departamento_id' | 'revisao' | 'cotacao_id' | 'status' | 'itinerario_id'
>

export class RepositorioItinerarioSupabase {
  private readonly cliente: SupabaseClient<Database>

  constructor(cliente: SupabaseClient<Database> = supabase) {
    this.cliente = cliente
  }

  async buscarDecisaoPorTrajeto(trajetoLegadoId: string): Promise<DecisaoParaItinerario | null> {
    const { data, error } = await this.cliente
      .from('vt_trajeto_decisoes')
      .select('id, trajeto_legado_id, colaborador_id, departamento_id, revisao, cotacao_id, status, itinerario_id')
      .eq('trajeto_legado_id', trajetoLegadoId)
      .order('revisao', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data
  }

  async salvarEscolhaComRevisao(
    entrada: EscolhaItinerarioVT,
    trajetoLegadoId: string,
    vigenteDesde: string,
  ): Promise<EscolhaItinerarioSalva> {
    const decisao = await this.garantirDecisaoAberta(trajetoLegadoId, vigenteDesde)
    return this.salvarEscolha({ ...entrada, decisaoId: decisao.id })
  }

  private async garantirDecisaoAberta(
    trajetoLegadoId: string,
    vigenteDesde: string,
  ): Promise<DecisaoParaItinerario> {
    const atual = await this.buscarDecisaoPorTrajeto(trajetoLegadoId)
    if (!atual) throw new Error('Nenhuma decisão foi encontrada para este trajeto.')

    if (atual.status !== 'confirmada') {
      await this.copiarComposicaoDaAnterior(atual)
      return atual
    }

    const completa = await this.buscarDecisaoCompletaPorRevisao(trajetoLegadoId, atual.revisao)
    const { data: nova, error } = await this.cliente
      .from('vt_trajeto_decisoes')
      .insert(novaRevisaoDeDecisao(completa, vigenteDesde))
      .select('id, trajeto_legado_id, colaborador_id, departamento_id, revisao, cotacao_id, status, itinerario_id')
      .single()
    if (error) {
      if (error.code !== '23505') throw error
      const concorrente = await this.buscarDecisaoPorTrajeto(trajetoLegadoId)
      if (!concorrente || concorrente.status === 'confirmada') throw error
      await this.copiarComposicaoDaAnterior(concorrente)
      return concorrente
    }
    await this.copiarComposicao(completa.id, nova.id)
    return nova
  }

  private async buscarDecisaoCompletaPorRevisao(
    trajetoLegadoId: string,
    revisao: number,
  ): Promise<VtTrajetoDecisao> {
    const { data, error } = await this.cliente
      .from('vt_trajeto_decisoes')
      .select('*')
      .eq('trajeto_legado_id', trajetoLegadoId)
      .eq('revisao', revisao)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('A decisão anterior não foi encontrada para criar a nova revisão.')
    return data
  }

  private async copiarComposicaoDaAnterior(atual: DecisaoParaItinerario): Promise<void> {
    if (!atual.trajeto_legado_id || atual.revisao <= 1) return
    const anterior = await this.buscarDecisaoCompletaPorRevisao(atual.trajeto_legado_id, atual.revisao - 1)
    await this.copiarComposicao(anterior.id, atual.id)
  }

  private async copiarComposicao(decisaoOrigemId: string, decisaoDestinoId: string): Promise<void> {
    const [{ data: componentes, error: erroComponentes }, { data: componentesDestino, error: erroDestino }] =
      await Promise.all([
        this.cliente.from('vt_trajeto_decisao_componentes').select('*').eq('decisao_trajeto_id', decisaoOrigemId),
        this.cliente.from('vt_trajeto_decisao_componentes').select('pacote_id, ordem').eq('decisao_trajeto_id', decisaoDestinoId),
      ])
    if (erroComponentes) throw erroComponentes
    if (erroDestino) throw erroDestino
    const faltantes = componentesNaoCopiados(componentes ?? [], componentesDestino ?? [])
    if (faltantes.length > 0) {
      const { data, error } = await this.cliente
        .from('vt_trajeto_decisao_componentes')
        .insert(faltantes.map((componente) => ({
          decisao_trajeto_id: decisaoDestinoId,
          pacote_id: componente.pacote_id,
          ordem: componente.ordem,
        })))
        .select('id')
      if (error && error.code !== '23505') throw error
      if (!error && data.length !== faltantes.length) {
        throw new Error('Nem todos os componentes foram copiados para a nova revisão.')
      }
    }

    const [{ data: ajustes, error: erroAjustes }, { data: ajustesDestino, error: erroAjustesDestino }] =
      await Promise.all([
        this.cliente.from('vt_beneficio_ajustes').select('*').eq('decisao_trajeto_id', decisaoOrigemId),
        this.cliente.from('vt_beneficio_ajustes')
          .select('valor_diario_centavos, motivo, vigente_desde, vigente_ate, origem')
          .eq('decisao_trajeto_id', decisaoDestinoId),
      ])
    if (erroAjustes) throw erroAjustes
    if (erroAjustesDestino) throw erroAjustesDestino
    const ajustesFaltantes = ajustesNaoCopiados(ajustes ?? [], ajustesDestino ?? [])
    if (ajustesFaltantes.length > 0) {
      const { data, error } = await this.cliente
        .from('vt_beneficio_ajustes')
        .insert(ajustesFaltantes.map((ajuste) => ({
          decisao_trajeto_id: decisaoDestinoId,
          valor_diario_centavos: ajuste.valor_diario_centavos,
          motivo: ajuste.motivo,
          autor_id: ajuste.autor_id,
          vigente_desde: ajuste.vigente_desde,
          vigente_ate: ajuste.vigente_ate,
          origem: ajuste.origem,
        })))
        .select('id')
      if (error && error.code !== '23505') throw error
      if (!error && data.length !== ajustesFaltantes.length) {
        throw new Error('Nem todos os ajustes foram copiados para a nova revisão.')
      }
    }
  }

  async buscarItinerarioPorId(id: string): Promise<VtItinerario | null> {
    const { data, error } = await this.cliente
      .from('vt_itinerarios')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data
  }

  async salvarEscolha(entrada: EscolhaItinerarioVT): Promise<EscolhaItinerarioSalva> {
    const nova = await prepararEvidenciaItinerario(entrada)
    const { data: decisao, error: erroDecisao } = await this.cliente
      .from('vt_trajeto_decisoes')
      .select('id, trajeto_legado_id, colaborador_id, departamento_id, revisao, cotacao_id, status, itinerario_id')
      .eq('id', entrada.decisaoId)
      .maybeSingle()
    if (erroDecisao) throw erroDecisao
    if (!decisao) throw new Error('A decisão do trajeto não foi encontrada.')
    if (decisao.colaborador_id !== nova.colaborador_id || decisao.departamento_id !== nova.departamento_id) {
      throw new Error('A decisão não pertence ao colaborador e ao posto da alternativa escolhida.')
    }

    const evidencia = await this.gravarOuRecuperar(nova)
    if (decisao.status === 'confirmada' && decisao.itinerario_id !== evidencia.id) {
      throw new Error('A decisão confirmada é imutável; crie uma nova revisão para trocar o itinerário.')
    }
    if (decisao.itinerario_id === evidencia.id) {
      return { decisaoId: decisao.id, evidencia, repetido: true }
    }

    const { data: atualizada, error: erroAtualizacao } = await this.cliente
      .from('vt_trajeto_decisoes')
      .update({ itinerario_id: evidencia.id, cotacao_id: entrada.cotacaoId ?? decisao.cotacao_id })
      .eq('id', decisao.id)
      .select('id, itinerario_id')
      .maybeSingle()
    if (erroAtualizacao) throw erroAtualizacao
    if (!atualizada) {
      throw new Error('Nenhuma decisão foi atualizada. A evidência foi preservada para uma nova tentativa.')
    }
    return { decisaoId: decisao.id, evidencia, repetido: false }
  }

  async confirmarDecisaoAberta(
    decisaoId: string,
    usuarioId: string,
    confirmadaEm: string,
  ): Promise<DecisaoParaItinerario> {
    const { data: decisao, error: erroLeitura } = await this.cliente
      .from('vt_trajeto_decisoes')
      .select('id, trajeto_legado_id, colaborador_id, departamento_id, revisao, cotacao_id, status, itinerario_id')
      .eq('id', decisaoId)
      .maybeSingle()
    if (erroLeitura) throw erroLeitura
    if (!decisao) throw new Error('A decisão do trajeto não foi encontrada.')
    if (decisao.status === 'confirmada') return decisao
    if (!decisao.itinerario_id) {
      throw new Error('Salve o itinerário antes de confirmar o trajeto e o preço.')
    }

    const { data: atualizada, error } = await this.cliente
      .from('vt_trajeto_decisoes')
      .update({ status: 'confirmada', confirmado_por: usuarioId, confirmado_em: confirmadaEm })
      .eq('id', decisaoId)
      .select('id, trajeto_legado_id, colaborador_id, departamento_id, revisao, cotacao_id, status, itinerario_id')
      .maybeSingle()
    if (error) throw error
    if (!atualizada) throw new Error('Nenhuma decisão foi confirmada; confira permissões e o estado atual.')
    return atualizada
  }

  private async gravarOuRecuperar(nova: NovaEvidenciaItinerario): Promise<VtItinerario> {
    const { data, error } = await this.cliente
      .from('vt_itinerarios')
      .insert(nova)
      .select('*')
      .single()
    if (!error) return data
    if (error.code !== '23505') throw error

    const { data: existente, error: erroLeitura } = await this.cliente
      .from('vt_itinerarios')
      .select('*')
      .eq('chave_idempotencia', nova.chave_idempotencia)
      .single()
    if (erroLeitura) throw erroLeitura
    if (existente.evidencia_hash !== nova.evidencia_hash) {
      throw new Error('A chave de idempotência aponta para uma evidência diferente.')
    }
    return existente
  }
}
