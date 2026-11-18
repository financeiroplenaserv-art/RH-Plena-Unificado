import { elegibilidadeBui, elegibilidadeBun, type ElegibilidadeCartao } from '@/lib/vt/motor/cartao'
import { precificarPerna, type PernaPrecificada } from '@/lib/vt/motor/precificarPerna'
import { normalizarLinha, reais, TARIFA_INTEGRACAO_BUI, vigenteNaData } from '@/lib/vt/motor/tarifas'
import type {
  EntradaSentidoMotor,
  PassoExplicacao,
  PendenciaMotor,
  PernaMotor,
  ResultadoSentidoMotor,
} from '@/lib/vt/motor/tipos'

/** Janela entre validações (em minutos): BUN §3; BUI §4; MetrôRio §5. */
const JANELA_BUN_MIN = 60
const JANELA_BUI_MIN = 180
const JANELA_BUI_METRO_MIN = 120

type Produto = 'BUN' | 'BUI'

interface Candidato {
  produto: Produto
  /** Índice da primeira perna do par (par = i, i+1). */
  i: number
  valorIntegradoCentavos: number
  economiaCentavos: number
  elegibilidade: ElegibilidadeCartao
}

type AvaliacaoPar =
  | { tipo: 'candidato'; candidato: Candidato }
  | { tipo: 'nao_integra'; passo: PassoExplicacao }
  | { tipo: 'pendencia'; pendencia: PendenciaMotor }
  | { tipo: 'nada' }

type Intervalo = { tipo: 'ok'; minutos: number } | { tipo: 'faltando' } | { tipo: 'desordenado' }

function intervaloEntre(a: PernaMotor, b: PernaMotor): Intervalo {
  if (!a.embarqueEm || !b.embarqueEm) return { tipo: 'faltando' }
  const t1 = Date.parse(a.embarqueEm)
  const t2 = Date.parse(b.embarqueEm)
  if (Number.isNaN(t1) || Number.isNaN(t2)) return { tipo: 'faltando' }
  if (t2 < t1) return { tipo: 'desordenado' }
  return { tipo: 'ok', minutos: (t2 - t1) / 60000 }
}

const MUNICIPAIS_RM = new Set<PernaMotor['modal']>(['onibus_municipal_sao_goncalo', 'onibus_municipal_rio'])

/** Pares que a tabela de Regras §4/§5 descreve como integráveis pelo BUI. */
function parBuiDescrito(a: PernaMotor['modal'], b: PernaMotor['modal']): boolean {
  const tem = (m: PernaMotor['modal']) => a === m || b === m
  const outro = (m: PernaMotor['modal']) => (a === m ? b : a)
  if (a === 'onibus_intermunicipal' && b === 'onibus_intermunicipal') return true
  if (tem('onibus_intermunicipal')) {
    const o = outro('onibus_intermunicipal')
    return MUNICIPAIS_RM.has(o) || o === 'barca' || o === 'trem' || o === 'metro' || o === 'vlt'
  }
  if (tem('trem')) {
    const o = outro('trem')
    return o === 'metro' || MUNICIPAIS_RM.has(o)
  }
  if (tem('vlt')) return outro('vlt') === 'barca'
  return false
}

function mesmaLinha(a: PernaMotor, b: PernaMotor): boolean {
  const la = normalizarLinha(a.linha)
  const lb = normalizarLinha(b.linha)
  return la !== '' && la === lb
}

function avaliarPar(
  pa: PernaPrecificada,
  pb: PernaPrecificada,
  i: number,
  c: EntradaSentidoMotor,
): AvaliacaoPar {
  const a = pa.perna
  const b = pb.perna
  const soma = (pa.valorCentavos ?? 0) + (pb.valorCentavos ?? 0)
  const nomePar = `${pa.rotulo} + ${pb.rotulo}`
  const niteroiA = a.modal === 'onibus_municipal_niteroi'
  const niteroiB = b.modal === 'onibus_municipal_niteroi'

  // BUN: dois ônibus municipais de Niterói (Regras §3).
  if (niteroiA && niteroiB) {
    if (mesmaLinha(a, b)) {
      return {
        tipo: 'nao_integra',
        passo: { regra: 'Regras §3', texto: `${nomePar}: mesma linha — não caracteriza integração BUN; cobra-se a tarifa de cada perna.` },
      }
    }
    if (!normalizarLinha(a.linha) || !normalizarLinha(b.linha)) {
      return {
        tipo: 'pendencia',
        pendencia: {
          codigo: 'BUN_LINHA_NAO_INFORMADA',
          mensagem: `${nomePar}: linha não informada; não é possível provar que são linhas diferentes (integração BUN não aplicada).`,
          regra: 'Regras §3',
        },
      }
    }
    const iv = intervaloEntre(a, b)
    if (iv.tipo === 'faltando' || iv.tipo === 'desordenado') {
      return {
        tipo: 'pendencia',
        pendencia: {
          codigo: 'BUN_HORARIO_NAO_COMPROVADO',
          mensagem: `${nomePar}: ${iv.tipo === 'faltando' ? 'horário de embarque não informado' : 'horários de embarque fora de ordem'}; não é possível provar o limite de 1 hora (integração BUN não aplicada).`,
          regra: 'Regras §3',
        },
      }
    }
    if (iv.minutos > JANELA_BUN_MIN) {
      return {
        tipo: 'nao_integra',
        passo: { regra: 'Regras §3', texto: `${nomePar}: ${Math.round(iv.minutos)} min entre validações (limite ${JANELA_BUN_MIN} min) — sem integração BUN; cobra-se a tarifa de cada perna.` },
      }
    }
    const valorIntegrado = Math.max(pa.valorCentavos ?? 0, pb.valorCentavos ?? 0)
    return {
      tipo: 'candidato',
      candidato: {
        produto: 'BUN',
        i,
        valorIntegradoCentavos: valorIntegrado,
        economiaCentavos: soma - valorIntegrado,
        elegibilidade: elegibilidadeBun(c.cartao),
      },
    }
  }

  // Exceção de Niterói: o BUI nunca cobre ônibus municipal de Niterói (Regras §4).
  if (niteroiA || niteroiB) {
    return {
      tipo: 'nao_integra',
      passo: { regra: 'Regras §4 — exceção de Niterói', texto: `${nomePar}: o BUI não cobre ônibus municipal de Niterói (integração só pelo BUN, que exige duas pernas de Niterói); a perna de Niterói é cobrada à parte.` },
    }
  }

  // BUI (Regras §4, §5).
  if (!parBuiDescrito(a.modal, b.modal)) {
    return {
      tipo: 'pendencia',
      pendencia: {
        codigo: 'COMBINACAO_NAO_DESCRITA',
        mensagem: `${nomePar}: combinação não descrita nas regras de integração (ex.: Metrô+BRT/van é só Jaé); integração não aplicada, conferir.`,
        regra: 'Regras §5',
      },
    }
  }
  if (a.modal === 'onibus_intermunicipal' && b.modal === 'onibus_intermunicipal' && mesmaLinha(a, b)) {
    return {
      tipo: 'nao_integra',
      passo: { regra: 'Regras §4', texto: `${nomePar}: mesma linha — não caracteriza integração BUI.` },
    }
  }
  if (!vigenteNaData(TARIFA_INTEGRACAO_BUI.vigenteDesde, TARIFA_INTEGRACAO_BUI.vigenteAte, c.dataServico)) {
    return {
      tipo: 'pendencia',
      pendencia: {
        codigo: 'BUI_FORA_DA_VIGENCIA',
        mensagem: `${nomePar}: valor da integração BUI só cadastrado a partir de ${TARIFA_INTEGRACAO_BUI.vigenteDesde}; integração não aplicada.`,
        regra: 'Regras §4',
      },
    }
  }
  const janela = a.modal === 'metro' || b.modal === 'metro' ? JANELA_BUI_METRO_MIN : JANELA_BUI_MIN
  const iv = intervaloEntre(a, b)
  if (iv.tipo === 'faltando' || iv.tipo === 'desordenado') {
    return {
      tipo: 'pendencia',
      pendencia: {
        codigo: 'BUI_HORARIO_NAO_COMPROVADO',
        mensagem: `${nomePar}: ${iv.tipo === 'faltando' ? 'horário de embarque não informado' : 'horários de embarque fora de ordem'}; não é possível provar o limite de ${janela / 60} h (integração BUI não aplicada).`,
        regra: janela === JANELA_BUI_METRO_MIN ? 'Regras §5' : 'Regras §4',
      },
    }
  }
  if (iv.minutos > janela) {
    return {
      tipo: 'nao_integra',
      passo: { regra: janela === JANELA_BUI_METRO_MIN ? 'Regras §5' : 'Regras §4', texto: `${nomePar}: ${Math.round(iv.minutos)} min entre validações (limite ${janela} min) — sem integração BUI.` },
    }
  }
  const valorIntegrado = TARIFA_INTEGRACAO_BUI.valorCentavos
  if (soma <= valorIntegrado) {
    return {
      tipo: 'nao_integra',
      passo: { regra: 'Regras §4', texto: `${nomePar}: soma das tarifas integrais (${reais(soma)}) não supera a integração BUI (${reais(valorIntegrado)}) — BUI não escolhido (alternativa comum mais barata).` },
    }
  }
  return {
    tipo: 'candidato',
    candidato: {
      produto: 'BUI',
      i,
      valorIntegradoCentavos: valorIntegrado,
      economiaCentavos: soma - valorIntegrado,
      elegibilidade: elegibilidadeBui(c.cartao),
    },
  }
}

interface Selecao {
  escolhidos: Candidato[]
  economia: number
}

/** No máximo um grupo BUN e um BUI por sentido, sem sobreposição de pernas. */
function melhorSelecao(candidatos: readonly Candidato[]): Selecao {
  const buns: (Candidato | null)[] = [null, ...candidatos.filter((x) => x.produto === 'BUN')]
  const buis: (Candidato | null)[] = [null, ...candidatos.filter((x) => x.produto === 'BUI')]
  let melhor: Selecao = { escolhidos: [], economia: 0 }
  for (const bun of buns) {
    for (const bui of buis) {
      if (bun && bui && Math.abs(bun.i - bui.i) < 2) continue
      const escolhidos = [bun, bui].filter((x): x is Candidato => x !== null)
      const economia = escolhidos.reduce((s, x) => s + x.economiaCentavos, 0)
      if (
        economia > melhor.economia ||
        (economia === melhor.economia && escolhidos.length < melhor.escolhidos.length)
      ) {
        melhor = { escolhidos, economia }
      }
    }
  }
  return melhor
}

function juntarPendencias(lista: PendenciaMotor[]): PendenciaMotor[] {
  const vistos = new Set<string>()
  return lista.filter((p) => {
    const k = `${p.codigo}|${p.mensagem}`
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  })
}

function resultadoIndeterminado(
  pendencias: PendenciaMotor[],
  explicacao: PassoExplicacao[],
): ResultadoSentidoMotor {
  return { valorCentavos: null, status: 'indeterminado', pendencias: juntarPendencias(pendencias), explicacao }
}

/**
 * Calcula o valor de UM sentido (ida ou volta). A volta nunca é presumida igual à ida.
 * Base = tarifa integral de cada perna (Regras §2, §3); integrações BUN/BUI só quando
 * a elegibilidade do cartão está comprovada (Regras §3, §4).
 */
export function calcularSentido(entrada: EntradaSentidoMotor): ResultadoSentidoMotor {
  const { pernas } = entrada
  const prefixo = entrada.rotulo ? `${entrada.rotulo}: ` : ''
  if (pernas.length === 0) {
    return resultadoIndeterminado(
      [{ codigo: 'SEM_PERNAS', mensagem: 'Sentido sem conduções informadas.', regra: 'Regras §8' }],
      [{ regra: 'Regras §8', texto: `${prefixo}sem conduções informadas: indeterminado.` }],
    )
  }

  const precificadas = pernas.map((p, i) => precificarPerna(p, i, entrada.dataServico))
  const explicacao: PassoExplicacao[] = precificadas.map((p) => ({ ...p.passo, texto: prefixo + p.passo.texto }))

  if (precificadas.some((p) => p.valorCentavos === null)) {
    explicacao.push({ regra: 'Regras §8', texto: `${prefixo}há perna sem tarifa determinada: valor do sentido indeterminado.` })
    return resultadoIndeterminado(precificadas.flatMap((p) => p.pendenciasIndeterminado), explicacao)
  }

  const pendencias: PendenciaMotor[] = []
  const somaIntegral = precificadas.reduce((s, p) => s + (p.valorCentavos ?? 0), 0)

  // Avalia cada par adjacente.
  const candidatos: Candidato[] = []
  for (let i = 0; i < precificadas.length - 1; i++) {
    const av = avaliarPar(precificadas[i], precificadas[i + 1], i, entrada)
    if (av.tipo === 'candidato') candidatos.push(av.candidato)
    else if (av.tipo === 'nao_integra') explicacao.push({ ...av.passo, texto: prefixo + av.passo.texto })
    else if (av.tipo === 'pendencia') {
      pendencias.push(av.pendencia)
      explicacao.push({ regra: av.pendencia.regra, texto: `${prefixo}${av.pendencia.mensagem}` })
    }
  }

  // Seleção real: só integrações com elegibilidade comprovada.
  const real = melhorSelecao(candidatos.filter((c) => c.elegibilidade.nivel === 'sim'))
  // Seleção otimista: o que valeria se a elegibilidade fosse provada (gera pendência).
  const otimista = melhorSelecao(candidatos.filter((c) => c.elegibilidade.nivel === 'sim' || c.elegibilidade.pendenciaSeReduziria))
  const totalReal = somaIntegral - real.economia

  for (const c of otimista.escolhidos) {
    if (real.escolhidos.some((r) => r.produto === c.produto && r.i === c.i)) continue
    const par = `${precificadas[c.i].rotulo} + ${precificadas[c.i + 1].rotulo}`
    const codigo =
      c.produto === 'BUN'
        ? c.elegibilidade.nivel === 'provavel' ? 'BUN_PROVAVEL_NAO_COMPROVADO' : 'BUN_NAO_COMPROVADO'
        : c.elegibilidade.nivel === 'nao' ? 'BUI_SUSPENSO' : 'BUI_NAO_COMPROVADO'
    const mensagem = `${par}: integração ${c.produto} não aplicada — ${c.elegibilidade.motivo}. Cobrada a tarifa integral de cada perna; com a integração o sentido ficaria ${reais(somaIntegral - real.economia - c.economiaCentavos)} (em vez de ${reais(totalReal)}). Conferir ${c.produto}.`
    const regra = c.produto === 'BUN' ? 'Regras §3 — habilitação automática do BUN' : 'Regras §4'
    pendencias.push({ codigo, mensagem, regra })
    explicacao.push({ regra, texto: prefixo + mensagem })
  }

  // Passos das integrações aplicadas.
  const cobertas = new Set<number>()
  for (const c of real.escolhidos) {
    cobertas.add(c.i)
    cobertas.add(c.i + 1)
    const par = `${precificadas[c.i].rotulo} + ${precificadas[c.i + 1].rotulo}`
    const soma = (precificadas[c.i].valorCentavos ?? 0) + (precificadas[c.i + 1].valorCentavos ?? 0)
    explicacao.push(
      c.produto === 'BUN'
        ? { regra: 'Regras §3 — integração ônibus-ônibus (BUN)', texto: `${prefixo}${par}: linhas diferentes, até ${JANELA_BUN_MIN} min entre validações e BUN comprovado (${c.elegibilidade.motivo}) — paga-se uma tarifa integral, ${reais(c.valorIntegradoCentavos)}, em vez de ${reais(soma)}.` }
        : { regra: 'Regras §4, §5 — integração BUI', texto: `${prefixo}${par}: BUI comprovado (${c.elegibilidade.motivo}), até 2 meios e dentro da janela — ${reais(c.valorIntegradoCentavos)} por viagem integrada, em vez de ${reais(soma)}.` },
    )
  }

  // Pernas cobradas à parte: pendências "se cobrada" e BUI direto (Regras §2, §10).
  precificadas.forEach((p, idx) => {
    if (cobertas.has(idx)) return
    pendencias.push(...p.pendenciasSeCobrada)
    if (
      p.perna.modal === 'onibus_intermunicipal' &&
      p.valorCentavos !== null &&
      p.valorCentavos > TARIFA_INTEGRACAO_BUI.valorCentavos
    ) {
      const mensagem = `${p.rotulo}: linha intermunicipal única de ${reais(p.valorCentavos)} (acima do BUI de ${reais(TARIFA_INTEGRACAO_BUI.valorCentavos)}) sem baldeação — cobrada a tarifa integral; a redução pelo BUI direto depende de decisão do DP/jurídico.`
      pendencias.push({ codigo: 'BUI_DIRETO_PENDENTE', mensagem, regra: 'Regras §2, §10' })
      explicacao.push({ regra: 'Regras §2, §10', texto: prefixo + mensagem })
    }
  })

  explicacao.push({
    regra: 'Regras §2, §3',
    texto: `${prefixo}valor do sentido: ${reais(totalReal)}${real.escolhidos.length ? ` (soma integral ${reais(somaIntegral)} menos economia de integração ${reais(real.economia)})` : ' (soma das tarifas integrais)'}.`,
  })

  const pendenciasFinais = juntarPendencias(pendencias)
  return {
    valorCentavos: totalReal,
    status: pendenciasFinais.length > 0 ? 'pendente' : 'confirmado',
    pendencias: pendenciasFinais,
    explicacao,
  }
}
