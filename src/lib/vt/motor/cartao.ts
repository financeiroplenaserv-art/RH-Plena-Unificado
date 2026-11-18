import type { FatosCartaoMotor } from '@/lib/vt/motor/tipos'

/**
 * Elegibilidade de integração a partir dos fatos do cartão.
 * - sim: comprovada.
 * - provavel: indício forte, mas não comprovado (BUN com "Suspenso Setrans").
 * - nao_comprovado: sem prova (sem consulta, "Não possui BU", etc.).
 * - nao: afirmativamente não elegível (ex.: BUI suspenso; portal diz que o BUN não está habilitado).
 * Só "sim" aplica a integração; qualquer outro nível cobra a tarifa integral
 * de cada perna e, se a integração reduziria o valor, gera pendência.
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
}

function descreverSituacao(c: FatosCartaoMotor): string {
  if (!c.situacaoBu) return 'sem consulta à Riocard'
  const data = c.consultadoEm ? ` em ${c.consultadoEm}` : ''
  return `situação do BU "${c.situacaoBu}"${data}`
}

/** Regras §3 e "Habilitação automática do BUN". */
export function elegibilidadeBun(c: FatosCartaoMotor): ElegibilidadeCartao {
  if (c.bunConfirmadoNoPortal === true) {
    return { nivel: 'sim', motivo: 'BUN confirmado no Portal da empresa', pendenciaSeReduziria: false }
  }
  if (c.bunConfirmadoNoPortal === false) {
    return { nivel: 'nao', motivo: 'Portal da empresa informa BUN não habilitado', pendenciaSeReduziria: false }
  }
  if (c.situacaoBu === 'Ativado') {
    return { nivel: 'sim', motivo: `BU ativado: cartão habilitado ao BUI e, automaticamente, ao BUN (${descreverSituacao(c)})`, pendenciaSeReduziria: false }
  }
  if (c.situacaoBu === 'Suspenso Setrans') {
    return {
      nivel: 'provavel',
      motivo: `BUN provável, mas não comprovado (${descreverSituacao(c)}); conferir no Portal da empresa → Usuários → Gerenciar Bilhete Único`,
      pendenciaSeReduziria: true,
    }
  }
  return { nivel: 'nao_comprovado', motivo: `BUN não comprovado (${descreverSituacao(c)})`, pendenciaSeReduziria: true }
}

/** Regras §4: BUI só com situação "Ativado" (Personalizado Usuário já implícito). */
export function elegibilidadeBui(c: FatosCartaoMotor): ElegibilidadeCartao {
  if (c.situacaoBu === 'Ativado') {
    return { nivel: 'sim', motivo: `BUI ativo (${descreverSituacao(c)})`, pendenciaSeReduziria: false }
  }
  if (c.situacaoBu === 'Suspenso Setrans') {
    return { nivel: 'nao', motivo: `BUI suspenso (${descreverSituacao(c)}); o benefício não vale enquanto suspenso`, pendenciaSeReduziria: true }
  }
  if (c.situacaoBu === 'Não possui BU' || c.situacaoBu === 'Desativado') {
    return { nivel: 'nao', motivo: `sem BUI (${descreverSituacao(c)})`, pendenciaSeReduziria: false }
  }
  return { nivel: 'nao_comprovado', motivo: `BUI não comprovado (${descreverSituacao(c)})`, pendenciaSeReduziria: true }
}
