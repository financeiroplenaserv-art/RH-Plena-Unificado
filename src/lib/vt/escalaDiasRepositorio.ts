// Leitura e gravação de vt_escala_dias (migration 178): as marcas do relatório
// "Gestão de escalas" do Flit por colaborador × competência, para o pop-up da
// escala na Carga do VT abrir em QUALQUER computador (pedido da gestora,
// 28/11/2026). Toda escrita termina em `.select('id')` e confere a contagem
// (RLS bloqueada devolve 0 linhas sem erro).

import { supabase } from '@/lib/supabase'
import { estruturaAusente } from '@/lib/materiais/erros'
import { lerDiasEscala, type DiasEscalaVt } from '@/lib/vt/calendarioEscala'

export const MENSAGEM_178_AUSENTE = 'Falta aplicar a migration 178 (escala do relatório no banco).'
const LOTE = 100

export interface GravacaoEscalaDias {
  gravadas: number
  removidas: number
}

/**
 * Substitui as marcas da competência: upsert de quem está no relatório e apaga
 * as linhas de quem saiu dele. Lança erro (com mensagem para a tela) se algo
 * não foi gravado — quem chama decide mostrar como aviso.
 */
export async function gravarEscalaDiasCompetencia(params: {
  competencia: string
  nomeArquivo: string | null
  usuarioId: string
  porColaborador: ReadonlyMap<string, DiasEscalaVt>
}): Promise<GravacaoEscalaDias> {
  const { competencia, nomeArquivo, usuarioId, porColaborador } = params
  const agora = new Date().toISOString()
  const linhas = [...porColaborador].map(([colaborador_id, dias]) => ({
    colaborador_id,
    competencia,
    dias,
    nome_arquivo: nomeArquivo,
    importado_em: agora,
    importado_por: usuarioId,
  }))

  let gravadas = 0
  for (let i = 0; i < linhas.length; i += LOTE) {
    const parte = linhas.slice(i, i + LOTE)
    const { data, error } = await supabase
      .from('vt_escala_dias')
      .upsert(parte, { onConflict: 'colaborador_id,competencia' })
      .select('id')
    if (error) throw new Error(estruturaAusente(error) ? MENSAGEM_178_AUSENTE : error.message)
    gravadas += data?.length ?? 0
  }
  if (gravadas !== linhas.length) {
    throw new Error(`Só ${gravadas} de ${linhas.length} escalas foram gravadas (permissão?).`)
  }

  // Quem saiu do relatório: as marcas antigas da competência são apagadas.
  const existentes: string[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from('vt_escala_dias')
      .select('colaborador_id')
      .eq('competencia', competencia)
      .range(de, de + 999)
    if (error) throw new Error(estruturaAusente(error) ? MENSAGEM_178_AUSENTE : error.message)
    const pagina = (data ?? []) as { colaborador_id: string }[]
    existentes.push(...pagina.map((l) => l.colaborador_id))
    if (pagina.length < 1000) break
  }
  const sobras = existentes.filter((id) => !porColaborador.has(id))
  let removidas = 0
  for (let i = 0; i < sobras.length; i += LOTE) {
    const parte = sobras.slice(i, i + LOTE)
    const { data, error } = await supabase
      .from('vt_escala_dias')
      .delete()
      .eq('competencia', competencia)
      .in('colaborador_id', parte)
      .select('id')
    if (error) throw new Error(error.message)
    removidas += data?.length ?? 0
  }
  if (removidas !== sobras.length) {
    throw new Error(`Só ${removidas} de ${sobras.length} escalas antigas foram apagadas (permissão?).`)
  }
  return { gravadas, removidas }
}

export type LeituraEscalaDias =
  | { situacao: 'ok'; dias: DiasEscalaVt; nomeArquivo: string | null; importadoEm: string | null }
  | { situacao: 'vazia' }
  | { situacao: 'ausente' }
  | { situacao: 'erro'; mensagem: string }

export async function lerEscalaDias(colaboradorId: string, competencia: string): Promise<LeituraEscalaDias> {
  const { data, error } = await supabase
    .from('vt_escala_dias')
    .select('dias, nome_arquivo, importado_em')
    .eq('colaborador_id', colaboradorId)
    .eq('competencia', competencia)
    .maybeSingle()
  if (error) {
    if (estruturaAusente(error)) return { situacao: 'ausente' }
    return { situacao: 'erro', mensagem: error.message }
  }
  if (!data) return { situacao: 'vazia' }
  const linha = data as { dias: unknown; nome_arquivo: string | null; importado_em: string | null }
  const dias = lerDiasEscala(linha.dias)
  if (!dias) return { situacao: 'vazia' }
  return { situacao: 'ok', dias, nomeArquivo: linha.nome_arquivo, importadoEm: linha.importado_em }
}
