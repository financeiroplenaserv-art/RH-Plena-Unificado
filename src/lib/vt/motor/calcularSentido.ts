import {
  avisoRegularizarCartao,
  elegibilidadeBui,
  elegibilidadeBun,
  politicaDoCartao,
  type ElegibilidadeCartao,
} from '@/lib/vt/motor/cartao'
import { precificarPerna, type PernaPrecificada } from '@/lib/vt/motor/precificarPerna'
import {
  ehLinhaCategoriaAC,
  normalizarLinha,
  reais,
  TARIFA_INTEGRACAO_BUI,
  TARIFA_NITEROI_BUN,
  vigenteNaData,
} from '@/lib/vt/motor/tarifas'
import type {
  AvisoMotor,
  EntradaSentidoMotor,
  PassoExplicacao,
  PendenciaMotor,
  PernaMotor,
  PoliticaIntegracao,
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

  // Ônibus municipal gratuito (Itaboraí/Maricá): não há o que integrar; paga-se só a outra condução.
  if (a.modal === 'onibus_municipal_gratuito' || b.modal === 'onibus_municipal_gratuito') {
    return {
      tipo: 'nao_integra',
      passo: { regra: 'Regras §6', texto: `${nomePar}: o ônibus municipal gratuito custa R$ 0,00, então não há integração a aplicar. Paga-se só a outra condução.` },
    }
  }

  // Linhas da categoria AC: BUI não presumido (Regras §6, §10).
  if (ehLinhaCategoriaAC(a.linha) || ehLinhaCategoriaAC(b.linha)) {
    return {
      tipo: 'pendencia',
      pendencia: {
        codigo: 'BUI_LINHA_AC_NAO_CONFIRMADA',
        mensagem: `${nomePar}: uma das linhas é de categoria AC (ar-condicionado/rodoviária) e não está confirmado que o Bilhete Único Intermunicipal vale nela. Cobrado o valor cheio de cada uma; a conferir.`,
        regra: 'Regras §6, §10',
      },
    }
  }

  // BUN: dois ônibus municipais de Niterói (Regras §3).
  if (niteroiA && niteroiB) {
    if (mesmaLinha(a, b)) {
      return {
        tipo: 'nao_integra',
        passo: { regra: 'Regras §3', texto: `${nomePar}: é a mesma linha, então não conta como integração. Paga-se cada ônibus.` },
      }
    }
    if (!normalizarLinha(a.linha) || !normalizarLinha(b.linha)) {
      return {
        tipo: 'pendencia',
        pendencia: {
          codigo: 'BUN_LINHA_NAO_INFORMADA',
          mensagem: `${nomePar}: falta o número da linha, então não dá para saber se são linhas diferentes. Cobrado o valor cheio de cada ônibus; a conferir.`,
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
          mensagem: `${nomePar}: ${iv.tipo === 'faltando' ? 'falta o horário de embarque' : 'os horários de embarque estão fora de ordem'}, então não dá para provar que a troca foi dentro de 1 hora. Cobrado o valor cheio de cada ônibus; a conferir.`,
          regra: 'Regras §3',
        },
      }
    }
    if (iv.minutos > JANELA_BUN_MIN) {
      return {
        tipo: 'nao_integra',
        passo: { regra: 'Regras §3', texto: `${nomePar}: passaram ${Math.round(iv.minutos)} min entre um ônibus e o outro (o limite é ${JANELA_BUN_MIN} min), então não há integração. Paga-se cada ônibus.` },
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
      passo: { regra: 'Regras §4 — exceção de Niterói', texto: `${nomePar}: o Bilhete Único Intermunicipal não vale no ônibus municipal de Niterói (lá só há integração entre dois ônibus de Niterói). O ônibus de Niterói é pago à parte.` },
    }
  }

  // BUI (Regras §4, §5).
  if (!parBuiDescrito(a.modal, b.modal)) {
    return {
      tipo: 'pendencia',
      pendencia: {
        codigo: 'COMBINACAO_NAO_DESCRITA',
        mensagem: `${nomePar}: não sabemos se essa combinação tem integração (ex.: metrô com BRT ou van é só pelo Jaé). Cobrado o valor cheio de cada um; a conferir.`,
        regra: 'Regras §5',
      },
    }
  }
  if (a.modal === 'onibus_intermunicipal' && b.modal === 'onibus_intermunicipal' && mesmaLinha(a, b)) {
    return {
      tipo: 'nao_integra',
      passo: { regra: 'Regras §4', texto: `${nomePar}: é a mesma linha, então não conta como integração.` },
    }
  }
  if (!vigenteNaData(TARIFA_INTEGRACAO_BUI.vigenteDesde, TARIFA_INTEGRACAO_BUI.vigenteAte, c.dataServico)) {
    return {
      tipo: 'pendencia',
      pendencia: {
        codigo: 'BUI_FORA_DA_VIGENCIA',
        mensagem: `${nomePar}: o valor do Bilhete Único Intermunicipal só está cadastrado a partir de ${TARIFA_INTEGRACAO_BUI.vigenteDesde}, então a integração não foi aplicada.`,
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
        mensagem: `${nomePar}: ${iv.tipo === 'faltando' ? 'falta o horário de embarque' : 'os horários de embarque estão fora de ordem'}, então não dá para provar que a troca foi dentro de ${janela / 60} h. Cobrado o valor cheio de cada um; a conferir.`,
        regra: janela === JANELA_BUI_METRO_MIN ? 'Regras §5' : 'Regras §4',
      },
    }
  }
  if (iv.minutos > janela) {
    return {
      tipo: 'nao_integra',
      passo: { regra: janela === JANELA_BUI_METRO_MIN ? 'Regras §5' : 'Regras §4', texto: `${nomePar}: passaram ${Math.round(iv.minutos)} min entre um e outro (o limite é ${janela} min), então não há integração.` },
    }
  }
  const valorIntegrado = TARIFA_INTEGRACAO_BUI.valorCentavos
  if (soma <= valorIntegrado) {
    return {
      tipo: 'nao_integra',
      passo: { regra: 'Regras §4', texto: `${nomePar}: pagando cada um separado dá ${reais(soma)}, que não passa do valor da integração (${reais(valorIntegrado)}). Fica o valor separado, que é o mais barato.` },
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

interface InfoPolitica {
  politicaIntegracao: PoliticaIntegracao
  regularizarCartao: boolean
  avisos: AvisoMotor[]
}

function infoPolitica(entrada: EntradaSentidoMotor): InfoPolitica {
  const aviso = avisoRegularizarCartao(entrada.cartao)
  return {
    politicaIntegracao: politicaDoCartao(entrada.cartao),
    regularizarCartao: aviso !== null,
    avisos: aviso ? [aviso] : [],
  }
}

function resultadoIndeterminado(
  pendencias: PendenciaMotor[],
  explicacao: PassoExplicacao[],
  politica: InfoPolitica,
  viagensNiteroiPagas = 0,
): ResultadoSentidoMotor {
  return {
    valorCentavos: null,
    status: 'indeterminado',
    pendencias: juntarPendencias(pendencias),
    explicacao,
    viagensNiteroiPagas,
    ...politica,
  }
}

/** "Ônibus 62 + 39A" (grupo de ônibus) ou o rótulo da perna avulsa. */
function rotuloUnidade(precificadas: readonly PernaPrecificada[], u: { i: number; tamanho: 1 | 2 }): string {
  if (u.tamanho === 1) return precificadas[u.i].rotulo
  const linhas = [precificadas[u.i], precificadas[u.i + 1]].map((p) => normalizarLinha(p.perna.linha))
  return linhas.every((l) => l !== '') ? `Ônibus ${linhas.join(' + ')}` : `${precificadas[u.i].rotulo} + ${precificadas[u.i + 1].rotulo}`
}

/** Uma cobrança do sentido: uma perna avulsa ou um grupo integrado (BUN/BUI). */
interface Unidade {
  /** Índice da primeira perna da unidade. */
  i: number
  /** Quantas pernas a unidade cobre (1 ou 2). */
  tamanho: 1 | 2
  /** Valor integral, sem o limite diário do BUN. */
  valorCentavos: number
  /** Valor se passar do limite diário do BUN (tarifa cheia de Niterói). */
  valorCheiaCentavos: number
  /** É uma viagem paga em ônibus municipal de Niterói com o valor do BUN? */
  viagemBun: boolean
  grupo: Candidato | null
}

function montarUnidades(precificadas: readonly PernaPrecificada[], escolhidos: readonly Candidato[]): Unidade[] {
  const unidades: Unidade[] = []
  for (let i = 0; i < precificadas.length; i++) {
    const grupo = escolhidos.find((c) => c.i === i) ?? null
    if (grupo) {
      const bun = grupo.produto === 'BUN'
      unidades.push({
        i,
        tamanho: 2,
        valorCentavos: grupo.valorIntegradoCentavos,
        valorCheiaCentavos: bun
          ? Math.max(precificadas[i].valorCheiaCentavos ?? 0, precificadas[i + 1].valorCheiaCentavos ?? 0)
          : grupo.valorIntegradoCentavos,
        viagemBun: bun,
        grupo,
      })
      i++
    } else {
      const p = precificadas[i]
      unidades.push({
        i,
        tamanho: 1,
        valorCentavos: p.valorCentavos ?? 0,
        valorCheiaCentavos: p.valorCheiaCentavos ?? p.valorCentavos ?? 0,
        viagemBun: p.comValorBun,
        grupo: null,
      })
    }
  }
  return unidades
}

/**
 * Calcula o valor de UM sentido (ida ou volta). A volta nunca é presumida igual à ida.
 * Base = tarifa integral de cada perna (Regras §2, §3); integrações BUN/BUI aplicadas
 * quando as condições da regra se cumprem (janela, linhas, combinação descrita).
 * Política da empresa (19/11/2026): a situação do cartão na Riocard não bloqueia a
 * integração (presumida); a exceção 'tarifa_cheia' desliga toda integração.
 */
export function calcularSentido(entrada: EntradaSentidoMotor): ResultadoSentidoMotor {
  const { pernas } = entrada
  const prefixo = entrada.rotulo ? `${entrada.rotulo}: ` : ''
  const politica = infoPolitica(entrada)
  const tarifaCheia = politica.politicaIntegracao === 'tarifa_cheia'
  if (pernas.length === 0) {
    return resultadoIndeterminado(
      [{ codigo: 'SEM_PERNAS', mensagem: 'Nenhuma condução foi informada neste sentido.', regra: 'Regras §8' }],
      [{ regra: 'Regras §8', texto: `${prefixo}nenhuma condução informada, então não há valor.` }],
      politica,
    )
  }

  const precificadas = pernas.map((p) => precificarPerna(p, entrada.dataServico, politica.politicaIntegracao))
  const passosPerna: PassoExplicacao[] = precificadas.map((p) => ({ ...p.passo, texto: prefixo + p.passo.texto }))
  const explicacao: PassoExplicacao[] = []

  if (precificadas.some((p) => p.valorCentavos === null)) {
    const parcial = [...passosPerna, { regra: 'Regras §8', texto: `${prefixo}falta o valor de pelo menos uma condução, então não dá para calcular este sentido.` }]
    return resultadoIndeterminado(
      precificadas.flatMap((p) => p.pendenciasIndeterminado),
      parcial,
      politica,
      precificadas.filter((p) => p.perna.modal === 'onibus_municipal_niteroi').length,
    )
  }

  const pendencias: PendenciaMotor[] = []
  const somaIntegral = precificadas.reduce((s, p) => s + (p.valorCentavos ?? 0), 0)

  if (tarifaCheia) {
    const motivo = entrada.cartao.motivoTarifaCheia?.trim()
    explicacao.push({
      regra: 'Política da empresa — exceção tarifa cheia',
      texto: `${prefixo}a empresa decidiu pagar a tarifa cheia para esta pessoa${motivo ? ` (motivo: ${motivo})` : ''}: cada condução é paga pelo valor integral, sem integração.`,
    })
  }

  // Avalia cada par adjacente (na exceção tarifa cheia, nenhuma integração é avaliada).
  const candidatos: Candidato[] = []
  for (let i = 0; !tarifaCheia && i < precificadas.length - 1; i++) {
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
  const economiaPendencia = somaIntegral - real.economia

  // Valor de cada cobrança, com o limite diário do BUN (Regras §3 — Valores).
  const unidades = montarUnidades(precificadas, real.escolhidos)
  let restanteComDesconto = Math.max(
    0,
    TARIFA_NITEROI_BUN.limiteViagensPorDia - (entrada.viagensNiteroiJaPagasNoDia ?? 0),
  )
  let viagensNiteroiPagas = 0
  let totalReal = 0
  let alemDoLimite = false
  const passosGrupo: PassoExplicacao[] = []
  for (const u of unidades) {
    let valor = u.valorCentavos
    let alemDoLimiteDestaViagem = false
    if (u.viagemBun) {
      viagensNiteroiPagas++
      if (restanteComDesconto > 0) {
        restanteComDesconto--
      } else {
        valor = u.valorCheiaCentavos
        alemDoLimite = true
        alemDoLimiteDestaViagem = true
        const texto = `${prefixo}${rotuloUnidade(precificadas, u)}: ${reais(valor)} (tarifa cheia), porque o valor do Bilhete Único de Niterói (${reais(TARIFA_NITEROI_BUN.valorCentavos)}) vale só para as ${TARIFA_NITEROI_BUN.limiteViagensPorDia} primeiras viagens pagas por dia em ônibus de Niterói.`
        passosPerna[u.i] = { regra: TARIFA_NITEROI_BUN.regra, texto }
        if (u.tamanho === 2) passosPerna[u.i + 1] = { regra: TARIFA_NITEROI_BUN.regra, texto: '' }
      }
    }
    totalReal += valor
    if (u.grupo && u.grupo.produto === 'BUN' && !alemDoLimiteDestaViagem) {
      passosGrupo.push({
        regra: 'Regras §3 — integração ônibus-ônibus (BUN)',
        texto: `${prefixo}${rotuloUnidade(precificadas, u)}: ${reais(valor)} no total, porque o segundo ônibus foi pego em até ${JANELA_BUN_MIN / 60} hora.`,
      })
    }
  }
  const passosPernaFinais = passosPerna.filter((p) => p.texto !== '')
  explicacao.unshift(...passosPernaFinais)

  for (const c of otimista.escolhidos) {
    if (real.escolhidos.some((r) => r.produto === c.produto && r.i === c.i)) continue
    const par = `${precificadas[c.i].rotulo} + ${precificadas[c.i + 1].rotulo}`
    const codigo =
      c.produto === 'BUN'
        ? c.elegibilidade.nivel === 'provavel' ? 'BUN_PROVAVEL_NAO_COMPROVADO' : 'BUN_NAO_COMPROVADO'
        : c.elegibilidade.nivel === 'nao' ? 'BUI_SUSPENSO' : 'BUI_NAO_COMPROVADO'
    const mensagem = `${par}: a integração com o ${c.produto === 'BUN' ? 'Bilhete Único de Niterói (BUN)' : 'Bilhete Único Intermunicipal (BUI)'} não foi aplicada porque ${c.elegibilidade.motivo}. Está cobrado o valor cheio de cada um; com a integração, este sentido ficaria ${reais(economiaPendencia - c.economiaCentavos)} em vez de ${reais(economiaPendencia)}. Conferir ${c.produto}.`
    const regra = c.produto === 'BUN' ? 'Regras §3 — habilitação automática do BUN' : 'Regras §4'
    pendencias.push({ codigo, mensagem, regra })
    explicacao.push({ regra, texto: prefixo + mensagem })
  }

  // Passos das integrações aplicadas.
  const cobertas = new Set<number>()
  for (const c of real.escolhidos) {
    cobertas.add(c.i)
    cobertas.add(c.i + 1)
    if (c.produto === 'BUI') {
      const par = `${precificadas[c.i].rotulo} + ${precificadas[c.i + 1].rotulo}`
      const soma = (precificadas[c.i].valorCentavos ?? 0) + (precificadas[c.i + 1].valorCentavos ?? 0)
      explicacao.push({ regra: 'Regras §4, §5 — integração BUI', texto: `${prefixo}${par}: ${c.elegibilidade.motivo}, então as duas conduções saem por ${reais(c.valorIntegradoCentavos)} dentro do prazo, em vez de ${reais(soma)}.` })
    }
  }
  explicacao.push(...passosGrupo)

  // Pernas cobradas à parte: pendências "se cobrada" e BUI direto (Regras §2, §10).
  precificadas.forEach((p, idx) => {
    if (cobertas.has(idx)) return
    pendencias.push(...p.pendenciasSeCobrada)
    if (
      !tarifaCheia &&
      p.perna.modal === 'onibus_intermunicipal' &&
      p.valorCentavos !== null &&
      p.valorCentavos > TARIFA_INTEGRACAO_BUI.valorCentavos
    ) {
      const mensagem = `${p.rotulo}: é um ônibus direto de ${reais(p.valorCentavos)}, mais caro que a integração (${reais(TARIFA_INTEGRACAO_BUI.valorCentavos)}). Está cobrado o valor cheio; se pode cobrar menos nesse caso ainda precisa ser decidido pelo DP.`
      pendencias.push({ codigo: 'BUI_DIRETO_PENDENTE', mensagem, regra: 'Regras §2, §10' })
      explicacao.push({ regra: 'Regras §2, §10', texto: prefixo + mensagem })
    }
  })

  explicacao.push({
    regra: 'Regras §2, §3',
    texto: `${prefixo}total: ${reais(totalReal)}${alemDoLimite ? ` (inclui tarifa cheia nas viagens além das ${TARIFA_NITEROI_BUN.limiteViagensPorDia} do dia com o Bilhete Único de Niterói)` : real.escolhidos.length ? ` (${reais(somaIntegral)} se pagasse cada condução, menos ${reais(real.economia)} da integração)` : ' (soma do valor de cada condução)'}.`,
  })

  const pendenciasFinais = juntarPendencias(pendencias)
  return {
    valorCentavos: totalReal,
    status: pendenciasFinais.length > 0 ? 'pendente' : 'confirmado',
    pendencias: pendenciasFinais,
    explicacao,
    viagensNiteroiPagas,
    ...politica,
  }
}
