import type { AvisoMotor, FatosCartaoMotor, PoliticaIntegracao } from '@/lib/vt/motor/tipos'

/**
 * Elegibilidade de integração a partir dos fatos do cartão.
 * - sim: comprovada (ou presumida pela política da empresa — ver `presumida`).
 * - provavel: indício forte, mas não comprovado (BUN com "Suspenso Setrans").
 * - nao_comprovado: sem prova (sem consulta, "Não possui BU", etc.).
 * - nao: afirmativamente não elegível (ex.: BUI suspenso; portal diz que o BUN não está habilitado).
 * Só "sim" aplica a integração; qualquer outro nível cobra a tarifa integral
 * de cada perna e, se a integração reduziria o valor, gera pendência.
 *
 * Política da empresa (19/11/2026): com `politicaIntegracao` ausente ou
 * 'presumida', a situação na Riocard NÃO bloqueia a integração — o nível vira
 * "sim" com `presumida: true` e a diferença só gera o aviso de regularizar.
 * As demais condições da integração (janela, linhas, combinação descrita,
 * exceção de Niterói) continuam sendo conferidas em calcularSentido.
 */
export type NivelElegibilidade = 'sim' | 'provavel' | 'nao_comprovado' | 'nao'

export interface ElegibilidadeCartao {
  nivel: NivelElegibilidade
  motivo: string
  /**
   * Quando a integração reduziria o valor mas não está comprovada, gera pendência
   * "conferir"? false quando o fato é conhecido e afirmativo (ex.: não possui BU).
   */
  pendenciaSeReduziria: boolean
  /** true quando "sim" vem da política da empresa, não de comprovação do cartão. */
  presumida?: boolean
}

export function politicaDoCartao(c: FatosCartaoMotor): PoliticaIntegracao {
  return c.politicaIntegracao === 'tarifa_cheia' ? 'tarifa_cheia' : 'presumida'
}

function descreverSituacao(c: FatosCartaoMotor): string {
  if (!c.situacaoBu) return 'o cartão não foi consultado na Riocard'
  const data = c.consultadoEm ? ` em ${c.consultadoEm}` : ''
  return `o Bilhete Único consta como "${c.situacaoBu}"${data}`
}

function presumir(produto: 'BUN' | 'BUI', c: FatosCartaoMotor): ElegibilidadeCartao {
  const nome = produto === 'BUN' ? 'Bilhete Único de Niterói' : 'Bilhete Único Intermunicipal'
  return {
    nivel: 'sim',
    presumida: true,
    motivo: `pela política da empresa a integração do ${nome} é presumida (${descreverSituacao(c)})`,
    pendenciaSeReduziria: false,
  }
}

/** Elegibilidade comprovada do BUN, sem a política (Regras §3 e "Habilitação automática do BUN"). */
function elegibilidadeBunComprovada(c: FatosCartaoMotor): ElegibilidadeCartao {
  if (c.bunConfirmadoNoPortal === true) {
    return { nivel: 'sim', motivo: 'o Bilhete Único de Niterói está confirmado no Portal da empresa', pendenciaSeReduziria: false }
  }
  if (c.bunConfirmadoNoPortal === false) {
    return { nivel: 'nao', motivo: 'o Portal da empresa informa que o Bilhete Único de Niterói não está habilitado', pendenciaSeReduziria: false }
  }
  if (c.situacaoBu === 'Ativado') {
    return { nivel: 'sim', motivo: `o Bilhete Único está ativado, o que habilita também a integração em Niterói (${descreverSituacao(c)})`, pendenciaSeReduziria: false }
  }
  if (c.situacaoBu === 'Suspenso Setrans') {
    return {
      nivel: 'provavel',
      motivo: `BUN provável, mas não comprovado (${descreverSituacao(c)}); confira no Portal da empresa, em Usuários > Gerenciar Bilhete Único`,
      pendenciaSeReduziria: true,
    }
  }
  return { nivel: 'nao_comprovado', motivo: `não dá para confirmar a integração em Niterói (${descreverSituacao(c)})`, pendenciaSeReduziria: true }
}

/** Elegibilidade comprovada do BUI, sem a política (Regras §4: só "Ativado"). */
function elegibilidadeBuiComprovada(c: FatosCartaoMotor): ElegibilidadeCartao {
  if (c.situacaoBu === 'Ativado') {
    return { nivel: 'sim', motivo: `o Bilhete Único Intermunicipal está ativo (${descreverSituacao(c)})`, pendenciaSeReduziria: false }
  }
  if (c.situacaoBu === 'Suspenso Setrans') {
    return { nivel: 'nao', motivo: `o Bilhete Único Intermunicipal está suspenso (${descreverSituacao(c)}) e o benefício não vale enquanto estiver assim`, pendenciaSeReduziria: true }
  }
  if (c.situacaoBu === 'Não possui BU' || c.situacaoBu === 'Desativado') {
    return { nivel: 'nao', motivo: `a pessoa não tem o Bilhete Único Intermunicipal (${descreverSituacao(c)})`, pendenciaSeReduziria: false }
  }
  return { nivel: 'nao_comprovado', motivo: `não dá para confirmar o Bilhete Único Intermunicipal (${descreverSituacao(c)})`, pendenciaSeReduziria: true }
}

/**
 * Regras §3. Com a política 'presumida' (padrão), qualquer situação que não
 * comprove o BUN vira integração presumida. Com 'tarifa_cheia', calcularSentido
 * nem avalia integração; aqui devolve "nao" por coerência.
 */
export function elegibilidadeBun(c: FatosCartaoMotor): ElegibilidadeCartao {
  if (politicaDoCartao(c) === 'tarifa_cheia') return elegibilidadeTarifaCheia(c)
  const comprovada = elegibilidadeBunComprovada(c)
  return comprovada.nivel === 'sim' ? comprovada : presumir('BUN', c)
}

/** Regras §4. Mesma lógica da política de elegibilidadeBun. */
export function elegibilidadeBui(c: FatosCartaoMotor): ElegibilidadeCartao {
  if (politicaDoCartao(c) === 'tarifa_cheia') return elegibilidadeTarifaCheia(c)
  const comprovada = elegibilidadeBuiComprovada(c)
  return comprovada.nivel === 'sim' ? comprovada : presumir('BUI', c)
}

function elegibilidadeTarifaCheia(c: FatosCartaoMotor): ElegibilidadeCartao {
  return {
    nivel: 'nao',
    motivo: `a empresa decidiu pagar a tarifa cheia para esta pessoa${c.motivoTarifaCheia ? ` (${c.motivoTarifaCheia})` : ''}`,
    pendenciaSeReduziria: false,
  }
}

/**
 * Aviso de regularizar o cartão: só quando a integração é presumida (política
 * padrão) e a situação na Riocard não é "Ativado". É aviso, nunca pendência.
 */
export function avisoRegularizarCartao(c: FatosCartaoMotor): AvisoMotor | null {
  if (politicaDoCartao(c) === 'tarifa_cheia') return null
  if (c.situacaoBu === 'Ativado') return null
  const situacao = c.situacaoBu
    ? `consta como ${c.situacaoBu} na Riocard`
    : 'ainda não foi consultado na Riocard'
  return {
    codigo: 'REGULARIZAR_CARTAO',
    mensagem: `Seu Bilhete Único ${situacao}. O VT é calculado com a integração; regularize seu cartão para não pagar a diferença.`,
  }
}
