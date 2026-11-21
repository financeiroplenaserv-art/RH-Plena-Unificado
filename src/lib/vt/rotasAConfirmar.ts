import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { precisaoDoEndereco } from '@/lib/vt/enderecos'
import type { VtColaborador, VtDepartamento } from '@/hooks/useVt'
import type { VtTrajeto } from '@/types/vt'

/**
 * Fila "Rotas a confirmar" (21/11/2026): optantes ativos cujo trajeto vigente
 * ainda NÃO tem revisão confirmada pelo motor novo (itinerário + custo do dia
 * gravados e decisão confirmada). Lógica pura — a tela só desenha e carrega.
 * Nada aqui confirma ou grava rota: a gestora revisa uma a uma.
 */

export type MotivoRotaAConfirmar = 'sugerida' | 'antiga' | 'sem_rota'

export const ROTULO_MOTIVO_ROTA: Record<MotivoRotaAConfirmar, string> = {
  sugerida: 'Rota sugerida — falta confirmar',
  antiga: 'Rota antiga (bilhete da planilha) — revisar',
  sem_rota: 'Sem rota cadastrada',
}

/** Decisão mais recente do trajeto (vt_trajeto_decisoes, maior revisão). */
export interface DecisaoRotaResumo {
  status: 'sugerida' | 'confirmada' | 'indeterminada'
  itinerarioId: string | null
  custoDiarioCentavos: number | null
}

export interface ItemRotaAConfirmar {
  chave: string
  colaboradorId: string
  nome: string
  departamentoId: string
  nomePosto: string
  /** null = optante sem trajeto gravado (a rota precisa ser cadastrada antes de revisar). */
  trajetoId: string | null
  motivo: MotivoRotaAConfirmar
  rotulo: string
  /** Avisos que atrapalham a revisão: "Endereço incompleto", "Posto sem cidade". */
  avisos: string[]
}

const ORDEM_MOTIVO: Record<MotivoRotaAConfirmar, number> = { sugerida: 0, antiga: 1, sem_rota: 2 }

export function revisaoConfirmada(decisao: DecisaoRotaResumo | undefined): boolean {
  return (
    !!decisao &&
    decisao.status === 'confirmada' &&
    !!decisao.itinerarioId &&
    decisao.custoDiarioCentavos != null &&
    decisao.custoDiarioCentavos > 0
  )
}

function motivoDoTrajeto(decisao: DecisaoRotaResumo | undefined): MotivoRotaAConfirmar {
  // Tem itinerário salvo (rota escolhida com o Google): só falta confirmar/precificar.
  return decisao?.itinerarioId ? 'sugerida' : 'antiga'
}

export interface EntradaRotasAConfirmar {
  colaboradores: VtColaborador[]
  departamentos: VtDepartamento[]
  trajetos: Pick<VtTrajeto, 'id' | 'colaborador_id' | 'departamento_id' | 'precisao_origem'>[]
  /** Decisão mais recente por id do trajeto legado. */
  decisoes: ReadonlyMap<string, DecisaoRotaResumo>
}

/**
 * Optantes ativos com posto definido, cuja rota do posto ATUAL ainda não foi
 * confirmada. Ordem: sugerida → antiga → sem rota; dentro disso, nome (pt-BR).
 */
export function montarRotasAConfirmar(entrada: EntradaRotasAConfirmar): ItemRotaAConfirmar[] {
  const { colaboradores, departamentos, trajetos, decisoes } = entrada
  const itens: ItemRotaAConfirmar[] = []
  for (const c of colaboradores) {
    if (!c.vt_optante || !c.departamento_id) continue
    const trajeto = trajetos.find((t) => t.colaborador_id === c.id && t.departamento_id === c.departamento_id) ?? null
    const decisao = trajeto ? decisoes.get(trajeto.id) : undefined
    if (trajeto && revisaoConfirmada(decisao)) continue

    const motivo: MotivoRotaAConfirmar = trajeto ? motivoDoTrajeto(decisao) : 'sem_rota'
    const dep = departamentos.find((d) => d.id === c.departamento_id) ?? null
    const avisos: string[] = []
    const precisao = trajeto?.precisao_origem ?? precisaoDoEndereco(c.endereco)
    if (precisao === 'bairro') avisos.push('Endereço incompleto')
    if (!dep?.cidade?.trim()) avisos.push('Posto sem cidade')
    itens.push({
      chave: `${c.id}|${c.departamento_id}`,
      colaboradorId: c.id,
      nome: c.nome_completo,
      departamentoId: c.departamento_id,
      nomePosto: nomeCurtoDepartamentoFuzzy(departamentos, c.departamento_id, c.departamento) || '—',
      trajetoId: trajeto?.id ?? null,
      motivo,
      rotulo: ROTULO_MOTIVO_ROTA[motivo],
      avisos,
    })
  }
  return itens.sort(
    (a, b) => ORDEM_MOTIVO[a.motivo] - ORDEM_MOTIVO[b.motivo] || a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export const TODOS_OS_POSTOS = '__todos__'

/** Filtro por nome (sem acento, "contém") e por posto. */
export function filtrarRotasAConfirmar(
  itens: readonly ItemRotaAConfirmar[],
  filtro: { busca: string; postoId: string },
): ItemRotaAConfirmar[] {
  const termo = normalizar(filtro.busca)
  return itens.filter(
    (i) =>
      (filtro.postoId === TODOS_OS_POSTOS || i.departamentoId === filtro.postoId) &&
      (!termo || normalizar(i.nome).includes(termo)),
  )
}

/** Posição de uma rota entre as revisáveis (com trajeto gravado); -1 se não está na fila. */
export function indiceRevisavel(itens: readonly ItemRotaAConfirmar[], chave: string): number {
  return itens.filter((i) => i.trajetoId).findIndex((i) => i.chave === chave)
}

/**
 * Próxima rota REVISÁVEL. Se a atual ainda está na fila, é a seguinte a ela; se já
 * saiu (acabou de ser confirmada), é a que ocupa agora a posição que ela tinha
 * (`indiceAnterior`). Null quando não há mais nenhuma depois.
 */
export function proximaRotaRevisavel(
  itens: readonly ItemRotaAConfirmar[],
  atualChave: string | null,
  indiceAnterior = 0,
): ItemRotaAConfirmar | null {
  const revisaveis = itens.filter((i) => i.trajetoId)
  if (revisaveis.length === 0) return null
  const indiceAtual = atualChave ? revisaveis.findIndex((i) => i.chave === atualChave) : -1
  if (indiceAtual !== -1) return revisaveis[indiceAtual + 1] ?? null
  return revisaveis[indiceAnterior] ?? null
}
