import { calcularLimiteConcessivo } from './calculoFerias'
import { resolverRegraTeto } from './tetoSimultaneo'
import { parseDataLocal, formatarData, hojeBrasil } from '@/lib/utils'
import type { Colaborador } from '@/types/database'
import type { FeriasRegra, FeriasSolicitacao } from '@/types/ferias'

// ============================================================
// Plano automático de férias (decisão da gestão, 25/09/2026)
// ------------------------------------------------------------
// A maioria dos colaboradores não diz quando quer tirar férias.
// Para esses, o sistema propõe a programação do período na ordem
// que é melhor para a empresa:
//   1. URGÊNCIA CLT — quem tem o limite concessivo mais antigo
//      (já vencido ou mais próximo de vencer) sai primeiro;
//   2. ENCADEAMENTO — dentro do mesmo contrato+função, uma férias
//      começa quando a anterior termina (respeita o teto RN-01 e
//      casa com a sequência do ferista, RN-07);
//   3. QUEM PEDIU NÃO É MEXIDO — solicitação existente no período
//      (incl. pedido_colaborador) tira o colaborador do plano.
// Duração padrão: 30 dias (CLT). Vaga com início dentro do período
// é proposta mesmo que o fim estoure alguns dias para fora dele.
// ============================================================

const DIA_MS = 24 * 60 * 60 * 1000

function somarDiasISO(iso: string, dias: number): string {
  const d = new Date(parseDataLocal(iso).getTime() + dias * DIA_MS)
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function periodosSeSobrepoem(inicioA: string, fimA: string, inicioB: string, fimB: string): boolean {
  return inicioA <= fimB && fimA >= inicioB
}

export interface ColaboradorPlano
  extends Pick<Colaborador, 'id' | 'nome_completo' | 'data_admissao' | 'departamento_id' | 'cargo' | 'status'> {
  /** funcao_id já resolvido (resolverFuncao) — define o grupo do encadeamento */
  funcao_id?: string | null
}

export interface PropostaPlano {
  colaborador: ColaboradorPlano
  data_inicio: string
  data_fim: string
  /** Justificativa legível (urgência CLT) — vai para a observação da previsão */
  motivo: string
}

export interface ResumoPlano {
  avaliados: number
  /** Já tinham solicitação no período (incl. pedidos do colaborador) */
  jaComPlano: number
  /** Limite concessivo depois do fim do período — não precisam sair agora */
  semNecessidade: number
  /** Sem data de admissão — não dá para calcular o limite */
  semAdmissao: number
}

export interface ResultadoPlano {
  propostas: PropostaPlano[]
  /** Candidatos que não couberam no período dentro do grupo contrato+função */
  naoCouberam: { colaborador: ColaboradorPlano; motivo: string }[]
  resumo: ResumoPlano
}

export interface EntradaPlano {
  colaboradores: ColaboradorPlano[]
  solicitacoes: FeriasSolicitacao[]
  regras: FeriasRegra[]
  periodoInicio: string
  periodoFim: string
  /** Data de referência para "vencido" — padrão hoje (Brasil) */
  hoje?: string
  /** Dias de gozo de cada proposta (padrão 30, CLT) */
  diasDuracao?: number
}

export function gerarPlanoAutomatico({
  colaboradores,
  solicitacoes,
  regras,
  periodoInicio,
  periodoFim,
  hoje = hojeBrasil(),
  diasDuracao = 30,
}: EntradaPlano): ResultadoPlano {
  const resumo: ResumoPlano = { avaliados: 0, jaComPlano: 0, semNecessidade: 0, semAdmissao: 0 }

  interface Candidato {
    colaborador: ColaboradorPlano
    limite: string
  }
  const candidatos: Candidato[] = []

  for (const colaborador of colaboradores) {
    if (colaborador.status !== 'Ativo') continue
    resumo.avaliados++

    // Já tem qualquer solicitação (não cancelada) no período — inclui o
    // pedido do próprio colaborador, que fica na data que ele pediu
    const jaTem = solicitacoes.some(
      (s) =>
        s.colaborador_id === colaborador.id &&
        s.status !== 'cancelada' &&
        periodosSeSobrepoem(s.data_inicio, s.data_fim, periodoInicio, periodoFim)
    )
    if (jaTem) {
      resumo.jaComPlano++
      continue
    }

    if (!colaborador.data_admissao) {
      resumo.semAdmissao++
      continue
    }

    const ultimoGozoFim = solicitacoes
      .filter((s) => s.colaborador_id === colaborador.id && s.tipo === 'gozo' && s.status !== 'cancelada')
      .map((s) => s.data_fim)
      .sort()
      .pop() ?? null

    const limite = calcularLimiteConcessivo(colaborador.data_admissao, ultimoGozoFim)
    if (!limite) {
      resumo.semAdmissao++
      continue
    }
    if (limite > periodoFim) {
      resumo.semNecessidade++
      continue
    }

    candidatos.push({ colaborador, limite })
  }

  // Melhor para a empresa: limite concessivo mais antigo primeiro
  candidatos.sort((a, b) => a.limite.localeCompare(b.limite))

  // Encadeamento por grupo (contrato+função): cada grupo tem N cadeias
  // paralelas, N = teto de simultâneos da regra (RN-01)
  const proximaDataLivrePorGrupo = new Map<string, string[]>()

  const propostas: PropostaPlano[] = []
  const naoCouberam: ResultadoPlano['naoCouberam'] = []

  for (const { colaborador, limite } of candidatos) {
    const chaveGrupo = `${colaborador.departamento_id ?? 'sem-contrato'}|${colaborador.funcao_id ?? 'sem-funcao'}`
    let cadeias = proximaDataLivrePorGrupo.get(chaveGrupo)
    if (!cadeias) {
      const regra = resolverRegraTeto(regras, colaborador.departamento_id ?? null, colaborador.funcao_id ?? null)
      const paralelas = Math.max(1, regra?.max_simultaneos ?? 1)
      cadeias = Array.from({ length: paralelas }, () => periodoInicio)
      proximaDataLivrePorGrupo.set(chaveGrupo, cadeias)
    }

    // Cadeia que libera mais cedo
    let indice = 0
    for (let i = 1; i < cadeias.length; i++) {
      if (cadeias[i] < cadeias[indice]) indice = i
    }
    const inicio = cadeias[indice]

    if (inicio > periodoFim) {
      naoCouberam.push({
        colaborador,
        motivo: `não coube no período dentro do grupo (limite concessivo em ${formatarData(limite)})`,
      })
      continue
    }

    const fim = somarDiasISO(inicio, diasDuracao - 1)
    cadeias[indice] = somarDiasISO(fim, 1)

    propostas.push({
      colaborador,
      data_inicio: inicio,
      data_fim: fim,
      motivo: limite < hoje ? `limite concessivo vencido desde ${formatarData(limite)}` : `limite concessivo em ${formatarData(limite)}`,
    })
  }

  return { propostas, naoCouberam, resumo }
}
