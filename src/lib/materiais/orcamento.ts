import { arredondar, compararComLimite } from './precos'

// Orçamento de uniforme / EPI / crachá do contrato (decisão da gestora,
// 21/10/2026, migration 153). Cada contrato tem DOIS orçamentos mensais fixos:
//  1. Material  -> mat_contratos.limite_mensal (migration 138; regra em precos.ts).
//  2. Uniforme, EPI e crachá -> mat_contratos.limite_mensal_ceu (NULL = sem limite).
// O gasto de uniforme/EPI/crachá do mês é a soma das linhas de ceu_pedido_itens
// dos pedidos do contrato na competência × preço da peça. É só AVISO: passar do
// limite destaca em vermelho no Painel do gestor e NUNCA bloqueia nada.
//
// Regras:
//  - Quantidade: a ATENDIDA (a Beth entregou) > a CONFERIDA (conferência da
//    mesa) > a PEDIDA. Linha 'cancelado' vale 0 (não existe status "recusada").
//  - Preço: vigente de ceu_itens_precos_vigentes (migration 134), em CENTAVOS;
//    o `itens.valor` entra como reserva. Aqui tudo vira reais.
//  - Crachá (decisão da gestora, 21/10/2026): R$ 6,00 sem cordinha e R$ 8,00 com cordinha.
//    A linha escolhe pelo campo cracha_cordao (true = com; false/NULL = sem). Valores em
//    materiais_config (custo_cracha_sem_cordinha / custo_cracha_com_cordinha, padrão 6 e 8). Valor ausente: não soma e a tela avisa "custo do crachá não definido".
//  - Peça sem preço: não soma; a tela mostra "N peças sem preço".
//  - Pedido de IMPLANTAÇÃO de contrato (migration 151): valor à parte, fora do
//    limite (mesma lógica do material).

export interface LinhaCeuOrcamento {
  pedido_id: string
  tipo: 'uniforme' | 'epi' | 'cracha'
  item_id: string | null
  status: string
  qtd_pedida: number | string
  qtd_conferida?: number | string | null
  qtd_atendida?: number | string | null
  /** Crachá: true = com cordinha (R$ 8), false/NULL = sem (R$ 6). */
  cracha_cordao?: boolean | null
}

/** Custo do crachá em R$ (materiais_config). null = não definido. */
export interface CustoCracha {
  semCordinha: number | null
  comCordinha: number | null
}

/** Padrão da gestora (21/10/2026): usado quando a configuração não tem a chave. */
export const CUSTO_CRACHA_PADRAO: CustoCracha = { semCordinha: 6, comCordinha: 8 }

export interface ResumoCeuOrcamento {
  /** Valor do mês (R$), SEM os pedidos de implantação. */
  valor: number
  /** Valor dos pedidos de implantação (fora do limite). */
  valorImplantacao: number
  /** Peças (linhas) sem preço — ficam fora do valor. */
  semPreco: number
  /** Linhas de crachá que não entraram porque o custo do crachá não está definido. */
  crachasSemCusto: number
}

export interface EntradaOrcamentoCeu {
  linhas: LinhaCeuOrcamento[]
  /** item_id -> preço vigente em CENTAVOS. */
  precosCentavos: Map<string, number> | Record<string, number>
  /** Custo do crachá em REAIS; undefined = padrão (6 / 8). */
  custoCracha?: CustoCracha
  /** Pedidos de implantação (valor à parte). */
  implantacaoIds?: Set<string>
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Quantidade que vale: atendida > conferida > pedida; cancelada = 0. */
export function quantidadeCeu(l: Pick<LinhaCeuOrcamento, 'status' | 'qtd_pedida' | 'qtd_conferida' | 'qtd_atendida'>): number {
  if (l.status === 'cancelado') return 0
  return Math.max(0, num(l.qtd_atendida) ?? num(l.qtd_conferida) ?? num(l.qtd_pedida) ?? 0)
}

function precoDoItem(precos: EntradaOrcamentoCeu['precosCentavos'], id: string): number | null {
  const v = precos instanceof Map ? precos.get(id) : precos[id]
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v)
}

/** Custo de crachá aceito: número >= 0; qualquer outra coisa = não definido. */
export function lerCustoCracha(bruto: unknown): number | null {
  const n = num(bruto)
  return n != null && n >= 0 ? arredondar(n) : null
}

/** Lê as duas chaves da config; chave AUSENTE usa o padrão, presente-mas-inválida (null) = não definido. */
export function lerCustosCracha(cfg: { custo_cracha_sem_cordinha?: unknown; custo_cracha_com_cordinha?: unknown } | null | undefined): CustoCracha {
  const um = (k: 'custo_cracha_sem_cordinha' | 'custo_cracha_com_cordinha', padrao: number) =>
    cfg && k in cfg && cfg[k] !== undefined ? lerCustoCracha(cfg[k]) : padrao
  return {
    semCordinha: um('custo_cracha_sem_cordinha', CUSTO_CRACHA_PADRAO.semCordinha!),
    comCordinha: um('custo_cracha_com_cordinha', CUSTO_CRACHA_PADRAO.comCordinha!),
  }
}

export function resumirOrcamentoCeu(e: EntradaOrcamentoCeu): ResumoCeuOrcamento {
  let valor = 0
  let valorImplantacao = 0
  let semPreco = 0
  let crachasSemCusto = 0
  for (const l of e.linhas) {
    const q = quantidadeCeu(l)
    if (q <= 0) continue
    let unitario: number | null = null
    const centavos = l.item_id ? precoDoItem(e.precosCentavos, l.item_id) : null
    if (centavos != null && centavos > 0) unitario = centavos / 100
    else if (l.tipo === 'cracha') {
      const custos = e.custoCracha ?? CUSTO_CRACHA_PADRAO
      const c = l.cracha_cordao === true ? custos.comCordinha : custos.semCordinha
      if (c == null) {
        crachasSemCusto++
        continue
      }
      unitario = c
    }
    if (unitario == null) {
      semPreco++
      continue
    }
    if (e.implantacaoIds?.has(l.pedido_id)) valorImplantacao += q * unitario
    else valor += q * unitario
  }
  return { valor: arredondar(valor), valorImplantacao: arredondar(valorImplantacao), semPreco, crachasSemCusto }
}

export interface ComparacaoOrcamentoCeu {
  /** Limite definido pelo gestor (NULL no banco = sem limite). */
  limite: number | null
  /** Passou do limite: só aviso (vermelho), nunca bloqueia. */
  excedeu: boolean
  diferenca: number
  percentual: number | null
}

/** Compara o valor com o limite do CEU; sem limite (null) ou 0 nunca "passa". */
export function compararOrcamentoCeu(valor: number, limiteBruto: number | string | null | undefined): ComparacaoOrcamentoCeu {
  const n = num(limiteBruto)
  const limite = n != null && n >= 0 ? arredondar(n) : null
  if (limite == null) return { limite: null, excedeu: false, diferenca: 0, percentual: null }
  const c = compararComLimite(valor, limite)
  return { limite, excedeu: limite > 0 && c.excedeu, diferenca: c.diferenca, percentual: c.percentual }
}

/** Texto curto dos avisos do bloco (peças sem preço / custo do crachá). */
export function avisosOrcamentoCeu(r: Pick<ResumoCeuOrcamento, 'semPreco' | 'crachasSemCusto'>): string[] {
  const out: string[] = []
  if (r.semPreco > 0) out.push(`${r.semPreco} peça${r.semPreco === 1 ? '' : 's'} sem preço`)
  if (r.crachasSemCusto > 0) out.push('custo do crachá não definido')
  return out
}
