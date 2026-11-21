import { nomeCurtoDepartamentoFuzzy } from '@/lib/departamentos'
import { precisaoDoEndereco, textoOrigemCasa } from '@/lib/vt/enderecos'
import type { VtColaborador, VtDepartamento } from '@/hooks/useVt'
import type { VtTrajeto } from '@/types/vt'

/**
 * Fila "Rotas a confirmar" (21/11/2026): optantes ativos × postos cuja rota ainda
 * NÃO tem revisão confirmada pelo motor novo (itinerário + custo do dia gravados e
 * decisão confirmada). Além do posto principal, entram os postos que a escala do
 * mês exige (coberturas, treinamentos e postos do detalhe das cargas) e as rotas
 * confirmadas cujo endereço de casa mudou. Lógica pura — a tela só desenha e carrega.
 * Nada aqui confirma, desconfirma ou grava rota: a gestora revisa uma a uma.
 */

export type MotivoRotaAConfirmar = 'sugerida' | 'endereco_mudou' | 'antiga' | 'sem_rota'

export const ROTULO_MOTIVO_ROTA: Record<MotivoRotaAConfirmar, string> = {
  sugerida: 'Rota sugerida — falta confirmar',
  endereco_mudou: 'Endereço mudou — revisar a rota',
  antiga: 'Rota antiga (bilhete da planilha) — revisar',
  sem_rota: 'Sem rota cadastrada',
}

/** Decisão mais recente do trajeto (vt_trajeto_decisoes, maior revisão). */
export interface DecisaoRotaResumo {
  status: 'sugerida' | 'confirmada' | 'indeterminada'
  itinerarioId: string | null
  custoDiarioCentavos: number | null
}

/**
 * Combinação pessoa × posto que o mês vai exigir (cobertura/treinamento em
 * vt_coberturas ou posto que aparece no detalhe das cargas). Montada por
 * `exigenciasDeCoberturas` / `exigenciasDeCargas`.
 */
export interface ExigenciaPosto {
  colaboradorId: string
  departamentoId: string
  /** Texto para a tela: "Cobertura de férias em PALAZZO a partir de 01/12". */
  motivo: string
}

export interface ItemRotaAConfirmar {
  chave: string
  colaboradorId: string
  nome: string
  departamentoId: string
  nomePosto: string
  /** null = ainda não há trajeto gravado (a tela cria o trajeto ao clicar em Revisar). */
  trajetoId: string | null
  motivo: MotivoRotaAConfirmar
  rotulo: string
  /** Precisão do endereço de casa (do trajeto, ou do cadastro quando ainda não há trajeto). */
  precisaoOrigem: 'exato' | 'bairro'
  /** Avisos que atrapalham a revisão: "Endereço incompleto", "Posto sem cidade". */
  avisos: string[]
  /** Por que esta combinação está na fila ("Posto principal", cobertura, escala do mês...). */
  motivos: string[]
  /** A carga do mês (escala/coberturas) exige esta rota — vai para o topo da fila. */
  precisaCarga: boolean
  /** Só em `endereco_mudou`: endereço usado na rota confirmada × endereço atual do cadastro. */
  enderecoAntes?: string
  enderecoAgora?: string
}

const ORDEM_MOTIVO: Record<MotivoRotaAConfirmar, number> = {
  sugerida: 0,
  endereco_mudou: 1,
  antiga: 2,
  sem_rota: 3,
}

export const MOTIVO_POSTO_PRINCIPAL = 'Posto principal'

export function revisaoConfirmada(decisao: DecisaoRotaResumo | undefined): boolean {
  return (
    !!decisao &&
    decisao.status === 'confirmada' &&
    !!decisao.itinerarioId &&
    decisao.custoDiarioCentavos != null &&
    decisao.custoDiarioCentavos > 0
  )
}

function motivoDoTrajeto(
  decisao: DecisaoRotaResumo | undefined,
  trajeto: { bilhete_id?: string | null },
): MotivoRotaAConfirmar {
  // Tem itinerário salvo (rota escolhida com o Google): só falta confirmar/precificar.
  if (decisao?.itinerarioId) return 'sugerida'
  // Trajeto criado pela fila (migration 175) não tem bilhete legado: é "sem rota" de fato.
  if (trajeto.bilhete_id === null) return 'sem_rota'
  return 'antiga'
}

/**
 * Normaliza o texto do endereço para comparar (21/11/2026): minúsculas, sem
 * acentos, pontuação e espaços repetidos, e sem o hífen do CEP.
 */
export function normalizarEnderecoParaComparar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\d)-(\d)/g, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Compara o endereço de casa usado na rota confirmada com o atual. Critério
 * conservador: ignora só diferença de FORMA (ver `normalizarEnderecoParaComparar`).
 * O texto comparado é o de `textoOrigemCasa` (rua, número, bairro, cidade - UF,
 * CEP), que já descarta o complemento; mudou qualquer um desses campos, conta
 * como mudança. Sem endereço salvo (rotas confirmadas antes de a evidência
 * guardá-lo) ou sem endereço atual, NÃO acusa.
 */
export function enderecoMudou(salvo: string | null | undefined, atual: string | null | undefined): boolean {
  const a = normalizarEnderecoParaComparar(salvo ?? '')
  const b = normalizarEnderecoParaComparar(atual ?? '')
  if (!a || !b) return false
  return a !== b
}

type TrajetoDaFila = Pick<VtTrajeto, 'id' | 'colaborador_id' | 'departamento_id' | 'precisao_origem'> & {
  bilhete_id?: string | null
}

export interface EntradaRotasAConfirmar {
  colaboradores: VtColaborador[]
  departamentos: VtDepartamento[]
  trajetos: TrajetoDaFila[]
  /** Decisão mais recente por id do trajeto legado. */
  decisoes: ReadonlyMap<string, DecisaoRotaResumo>
  /** Combinações pessoa × posto exigidas pela escala/coberturas do mês. */
  exigencias?: readonly ExigenciaPosto[]
  /**
   * Endereço de casa guardado na evidência do itinerário confirmado, por id do
   * trajeto (null/ausente = a evidência não guardou — não dá para comparar).
   */
  origemConfirmada?: ReadonlyMap<string, string | null>
}

/**
 * Optantes ativos × postos cuja rota ainda não está confirmada: o posto
 * principal + os postos que a carga do mês exige. Confirmada com endereço de
 * casa diferente volta para a fila. Ordem: o que a carga do mês precisa
 * primeiro; depois sugerida → endereço mudou → rota antiga → sem rota; dentro
 * disso, nome (pt-BR).
 */
export function montarRotasAConfirmar(entrada: EntradaRotasAConfirmar): ItemRotaAConfirmar[] {
  const { colaboradores, departamentos, trajetos, decisoes } = entrada
  const exigencias = entrada.exigencias ?? []
  const origemConfirmada = entrada.origemConfirmada

  const optantes = new Map(colaboradores.filter((c) => c.vt_optante).map((c) => [c.id, c]))
  const trajetoDoPar = new Map<string, TrajetoDaFila>()
  for (const t of trajetos) {
    const chave = `${t.colaborador_id}|${t.departamento_id}`
    if (!trajetoDoPar.has(chave)) trajetoDoPar.set(chave, t)
  }

  // Pares pessoa × posto com os motivos de cada um (deduplicados).
  const pares = new Map<
    string,
    { colab: VtColaborador; departamentoId: string; motivos: string[]; precisaCarga: boolean }
  >()
  const registrar = (colab: VtColaborador, departamentoId: string, motivo: string, precisaCarga: boolean) => {
    const chave = `${colab.id}|${departamentoId}`
    const par = pares.get(chave) ?? { colab, departamentoId, motivos: [], precisaCarga: false }
    if (!par.motivos.includes(motivo)) par.motivos.push(motivo)
    par.precisaCarga = par.precisaCarga || precisaCarga
    pares.set(chave, par)
  }
  for (const c of optantes.values()) {
    if (c.departamento_id) registrar(c, c.departamento_id, MOTIVO_POSTO_PRINCIPAL, false)
  }
  for (const e of exigencias) {
    const colab = optantes.get(e.colaboradorId)
    if (colab && e.departamentoId) registrar(colab, e.departamentoId, e.motivo, true)
  }

  const itens: ItemRotaAConfirmar[] = []
  for (const [chave, par] of pares) {
    const { colab: c, departamentoId } = par
    const trajeto = trajetoDoPar.get(chave) ?? null
    const decisao = trajeto ? decisoes.get(trajeto.id) : undefined
    const atual = textoOrigemCasa(c.endereco, c.cidade, c.cep ?? null)

    let motivo: MotivoRotaAConfirmar
    let enderecoAntes: string | undefined
    if (trajeto && revisaoConfirmada(decisao)) {
      const salvo = origemConfirmada?.get(trajeto.id) ?? null
      if (!enderecoMudou(salvo, atual)) continue
      motivo = 'endereco_mudou'
      enderecoAntes = salvo ?? undefined
    } else {
      motivo = trajeto ? motivoDoTrajeto(decisao, trajeto) : 'sem_rota'
    }

    const dep = departamentos.find((d) => d.id === departamentoId) ?? null
    const avisos: string[] = []
    const precisaoOrigem = trajeto?.precisao_origem ?? precisaoDoEndereco(c.endereco)
    if (precisaoOrigem === 'bairro') avisos.push('Endereço incompleto')
    if (!dep?.cidade?.trim()) avisos.push('Posto sem cidade')
    itens.push({
      chave,
      colaboradorId: c.id,
      nome: c.nome_completo,
      departamentoId,
      nomePosto: nomeCurtoDepartamentoFuzzy(departamentos, departamentoId, '') || dep?.nome || '—',
      trajetoId: trajeto?.id ?? null,
      motivo,
      rotulo: ROTULO_MOTIVO_ROTA[motivo],
      precisaoOrigem,
      avisos,
      motivos: par.motivos,
      precisaCarga: par.precisaCarga,
      ...(motivo === 'endereco_mudou' ? { enderecoAntes, enderecoAgora: atual } : {}),
    })
  }
  return itens.sort(
    (a, b) =>
      Number(b.precisaCarga) - Number(a.precisaCarga) ||
      ORDEM_MOTIVO[a.motivo] - ORDEM_MOTIVO[b.motivo] ||
      a.nome.localeCompare(b.nome, 'pt-BR') ||
      a.nomePosto.localeCompare(b.nomePosto, 'pt-BR'),
  )
}

// ---------------------------------------------------------------------------
// Exigências do mês (coberturas e cargas)
// ---------------------------------------------------------------------------

/** 'AAAA-MM-DD' → 'dd/mm'. */
export function dataCurta(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const MESES_NOME = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** 'AAAA-MM' → 'dezembro'. */
export function nomeDoMes(competencia: string): string {
  return MESES_NOME[Number(competencia.split('-')[1]) - 1] ?? competencia
}

export interface CoberturaParaExigencia {
  colaborador_id: string | null
  departamento_id: string
  data_inicio: string
  data_fim: string
  tipo?: 'ferias' | 'treinamento'
}

/**
 * Coberturas/treinamentos ainda por vir ou em andamento (data_fim >= hoje):
 * o ferista vai trabalhar naquele posto e a carga precisa da rota. Registro
 * "sem cobertura" (colaborador_id nulo) não exige nada.
 */
export function exigenciasDeCoberturas(
  coberturas: readonly CoberturaParaExigencia[],
  nomePosto: (departamentoId: string) => string,
  hoje: string,
): ExigenciaPosto[] {
  const saida: ExigenciaPosto[] = []
  for (const c of coberturas) {
    if (!c.colaborador_id || c.data_fim < hoje) continue
    const posto = nomePosto(c.departamento_id)
    const tipo = c.tipo === 'treinamento' ? 'Treinamento' : 'Cobertura de férias'
    const quando =
      c.data_inicio > hoje ? `a partir de ${dataCurta(c.data_inicio)}` : `em andamento até ${dataCurta(c.data_fim)}`
    saida.push({
      colaboradorId: c.colaborador_id,
      departamentoId: c.departamento_id,
      motivo: `${tipo} em ${posto} ${quando}`,
    })
  }
  return saida
}

export interface CargaParaExigencia {
  colaborador_id: string
  competencia: string
  detalhe: { departamento_id: string; posto?: string; dias: number }[] | null
}

/** Postos do detalhe das cargas (rascunho ou gravada): "Escala de dezembro: 8 dias em ÉVORA". */
export function exigenciasDeCargas(cargas: readonly CargaParaExigencia[]): ExigenciaPosto[] {
  const saida: ExigenciaPosto[] = []
  for (const carga of cargas) {
    for (const d of carga.detalhe ?? []) {
      if (!d.departamento_id || !(d.dias > 0)) continue
      saida.push({
        colaboradorId: carga.colaborador_id,
        departamentoId: d.departamento_id,
        motivo: `Escala de ${nomeDoMes(carga.competencia)}: ${d.dias} ${d.dias === 1 ? 'dia' : 'dias'} em ${d.posto || 'posto'}`,
      })
    }
  }
  return saida
}

// ---------------------------------------------------------------------------
// Filtros e navegação
// ---------------------------------------------------------------------------

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export const TODOS_OS_POSTOS = '__todos__'

/** Filtro por nome (sem acento, "contém"), por posto e "só o que a carga do mês precisa". */
export function filtrarRotasAConfirmar(
  itens: readonly ItemRotaAConfirmar[],
  filtro: { busca: string; postoId: string; soCarga?: boolean },
): ItemRotaAConfirmar[] {
  const termo = normalizar(filtro.busca)
  return itens.filter(
    (i) =>
      (filtro.postoId === TODOS_OS_POSTOS || i.departamentoId === filtro.postoId) &&
      (!filtro.soCarga || i.precisaCarga) &&
      (!termo || normalizar(i.nome).includes(termo)),
  )
}

/** Posição de uma rota na fila (toda rota é revisável: a sem trajeto é criada ao abrir); -1 se não está. */
export function indiceRevisavel(itens: readonly ItemRotaAConfirmar[], chave: string): number {
  return itens.findIndex((i) => i.chave === chave)
}

/**
 * Próxima rota da fila. Se a atual ainda está nela, é a seguinte; se já saiu
 * (acabou de ser confirmada), é a que ocupa agora a posição que ela tinha
 * (`indiceAnterior`). Null quando não há mais nenhuma depois.
 */
export function proximaRotaRevisavel(
  itens: readonly ItemRotaAConfirmar[],
  atualChave: string | null,
  indiceAnterior = 0,
): ItemRotaAConfirmar | null {
  if (itens.length === 0) return null
  const indiceAtual = atualChave ? itens.findIndex((i) => i.chave === atualChave) : -1
  if (indiceAtual !== -1) return itens[indiceAtual + 1] ?? null
  return itens[indiceAnterior] ?? null
}
