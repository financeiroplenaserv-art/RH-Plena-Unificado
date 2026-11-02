// Lógica pura do módulo VT — motor de classificação de bilhete a partir da
// ROTA REAL (pernas da rota: modal × município × cruza divisa), não mais da
// comparação cidade×cidade (que errou Joyce/Thiago/José Orlando — 02/11/2026).
//
// Regras tarifárias oficiais pesquisadas em 02/11/2026 (docs/VT_REGRAS_TARIFARIAS.md):
// - BUN Niterói: R$ 5,60/perna (VT empresa), integração de 2 conduções em 1h.
// - BUI: R$ 9,40/perna, até 2 modais em 3h com pelo menos 1 intermunicipal;
//   EXIGE cartão com integração ativada (fato da Riocard — migration 167) e
//   tem teto de renda (o "Suspenso Setrans" vem daí).
// - Jaé: OBRIGATÓRIO nos modais municipais do Rio (ônibus/BRT/VLT) desde
//   ago/2025 — quem pisa no Rio em modal municipal precisa de Jaé.
// - Passagem SG (R$ 7,10/perna): linha direta SG↔Niterói, sem integração.
// - Trem/Metrô: R$ 7,90/perna (sem reajuste em 2026).
//
// A entrada é NEUTRA (PernaRota) — a mesma classificação serve para as pernas
// vindas da Google Routes API (POC/Fase seguinte) e para testes manuais. O
// motor SUGERE com explicação e nível de confiança; nada é gravado sem
// confirmação humana (regra do projeto).

import { removerAcentos } from '@/lib/utils'

export type ModalRota = 'onibus' | 'brt' | 'vlt' | 'trem' | 'metro' | 'barca'

export interface PernaRota {
  modal: ModalRota
  /** Município onde a linha opera (ônibus municipal = a cidade da linha; intermunicipal = município de origem). */
  municipio: string
  /** true quando a perna cruza a divisa de municípios (ônibus intermunicipal). */
  intermunicipal: boolean
}

export interface ContextoClassificacao {
  /** Fato da Riocard (migration 167): true = integração ativada; false = suspenso/sem BU; null = não consultado. */
  buAtivado: boolean | null
  /** Texto cru do site da Riocard (ex.: "Suspenso Setrans") — enriquece o aviso. */
  buSituacao?: string | null
}

export interface ClassificacaoRota {
  /** Nomes dos bilhetes do catálogo `vt_bilhetes` (1 ou 2). */
  bilhetes: string[]
  explicacao: string
  confianca: 'alta' | 'media' | 'baixa'
  avisos: string[]
}

export const BILHETE = {
  centroRj: 'CENTRO RJ',
  buNiteroi: 'BU NITERÓI',
  jaeRj: 'CARTÃO JAE RJ',
  passagemSg: 'PASSAGEM SÃO GONÇALO',
  trem: 'TREM',
  onibusVlt: 'ÔNIBUS E VLT - INTEGRAÇÃO RJ',
  bui: 'BILHETE ÚNICO INTERMUNICIPAL',
  onibusTremMetro: 'ÔNIBUS, TREM E METRÔ',
  semIntegracao: 'SEM INTEGRAÇÃO BU',
} as const

function norm(municipio: string): string {
  return removerAcentos(municipio.trim()).toUpperCase()
}

function ehNiteroi(m: string): boolean {
  return norm(m) === 'NITEROI'
}

function ehRio(m: string): boolean {
  const n = norm(m)
  return n === 'RIO DE JANEIRO' || n === 'RJ'
}

function ehSaoGoncalo(m: string): boolean {
  return norm(m) === 'SAO GONCALO'
}

/**
 * Classifica o bilhete do trajeto a partir das pernas de IDA (a volta é
 * considerada espelhada — o valor diário do catálogo já é ida+volta).
 */
export function classificarRota(pernas: PernaRota[], ctx: ContextoClassificacao): ClassificacaoRota {
  const avisos: string[] = []
  const sem: ClassificacaoRota = { bilhetes: [], explicacao: '', confianca: 'baixa', avisos }
  if (pernas.length === 0) {
    return { ...sem, explicacao: 'Sem pernas de transporte público na rota.' }
  }

  const inter = pernas.filter((p) => p.intermunicipal)
  const municipais = pernas.filter((p) => !p.intermunicipal)
  const nit = municipais.filter((p) => p.modal === 'onibus' && ehNiteroi(p.municipio))
  const rio = municipais.filter(
    (p) => (p.modal === 'onibus' || p.modal === 'brt' || p.modal === 'vlt') && ehRio(p.municipio)
  )
  const temVlt = pernas.some((p) => p.modal === 'vlt')
  const temBarca = pernas.some((p) => p.modal === 'barca')
  const temTrem = pernas.some((p) => p.modal === 'trem')
  const temMetro = pernas.some((p) => p.modal === 'metro')
  const temTrilho = temTrem || temMetro

  // Trilhos (trem/metrô) mandam: R$ 7,90/perna, sem integração com ônibus fora
  // das regras específicas — o catálogo tem os dois bilhetes da operação.
  if (temTrilho) {
    const foraDoTrilho = pernas.some((p) => p.modal !== 'trem' && p.modal !== 'metro')
    if ((temTrem && temMetro) || foraDoTrilho) {
      return {
        bilhetes: [BILHETE.onibusTremMetro],
        explicacao: 'A rota combina ônibus com trem/metrô — sem integração tarifária entre eles.',
        confianca: 'media',
        avisos,
      }
    }
    return {
      bilhetes: [BILHETE.trem],
      explicacao: 'A rota é só de trem/metrô (R$ 7,90 por perna).',
      confianca: 'media',
      avisos,
    }
  }

  // Barca Niterói ↔ Centro do RJ.
  if (temBarca) {
    return {
      bilhetes: [BILHETE.centroRj],
      explicacao: 'A rota usa a barca Niterói ↔ Centro do Rio.',
      confianca: 'media',
      avisos: ['Confirme se o trajeto é de fato pela barca (o Google às vezes prefere ônibus pela ponte).'],
    }
  }

  // VLT no Rio: integração ônibus × VLT exige Jaé.
  if (temVlt) {
    if (inter.length > 0) {
      return {
        bilhetes: [BILHETE.bui, BILHETE.onibusVlt],
        explicacao:
          'Travessia intermunicipal (BUI) + VLT no Rio (Jaé — o Riocard não valida no VLT desde ago/2025).',
        confianca: 'media',
        avisos: ['A pessoa precisa ter os DOIS cartões: Riocard (BUI) e Jaé.'],
      }
    }
    return {
      bilhetes: [BILHETE.onibusVlt],
      explicacao: 'Ônibus + VLT no Rio com integração (exige Jaé).',
      confianca: 'media',
      avisos,
    }
  }

  // Travessia intermunicipal de ônibus.
  if (inter.length > 0) {
    // Linha direta São Gonçalo → Niterói, 1 perna por sentido e nada mais:
    // a passagem direta (R$ 7,10) sai mais barata que o BUI (R$ 9,40) — mas
    // NÃO tem integração: precisou de 2ª condução, o BUI ganha.
    const soSgNit = pernas.length === 1 && inter.length === 1 && ehSaoGoncalo(inter[0].municipio)
    if (soSgNit) {
      return {
        bilhetes: [BILHETE.passagemSg],
        explicacao: 'Linha direta São Gonçalo → Niterói, sem integração (R$ 7,10 por perna).',
        confianca: 'alta',
        avisos: ['Se a pessoa precisar de uma 2ª condução, o BUI (com integração em 3h) sai mais em conta.'],
      }
    }
    if (ctx.buAtivado === false) {
      avisos.push(
        `O Bilhete Único dela NÃO está ativado na Riocard${ctx.buSituacao ? ` (${ctx.buSituacao})` : ''} — sem cartão validado a integração não vale e cada perna cobra cheio. Reativando na Setrans, o valor cai para o BUI.`
      )
      return {
        bilhetes: [BILHETE.semIntegracao],
        explicacao: 'Intermunicipal sem o BU validado: cada condução cobra a tarifa cheia.',
        confianca: 'media',
        avisos,
      }
    }
    if (ctx.buAtivado === null) {
      avisos.push('Situação do Bilhete Único não consultada na Riocard — o BUI exige a integração ativada.')
    }
    // Trabalha no Rio e usa modal municipal lá: Jaé é OBRIGATÓRIO desde
    // ago/2025 (o Riocard não valida nos modais municipais do Rio) — regra da
    // gestora, 02/11/2026: Riocard (BUI) + Jaé.
    if (rio.length > 0) {
      return {
        bilhetes: [BILHETE.bui, BILHETE.jaeRj],
        explicacao:
          'Travessia intermunicipal (BUI) + modal municipal do Rio (Jaé — o Riocard não é mais aceito nos ônibus/BRT municipais do Rio).',
        confianca: 'media',
        avisos: [...avisos, 'A pessoa precisa ter os DOIS cartões: Riocard (BUI) e Jaé.'],
      }
    }
    if (pernas.length > 4) {
      avisos.push('Mais de 2 conduções por sentido: a integração do BUI cobre 2 modais em 3h — o excedente cobra tarifa cheia.')
    }
    return {
      bilhetes: [BILHETE.bui],
      explicacao: 'Travessia intermunicipal de ônibus com integração (R$ 9,40 por perna, 2 modais em 3h).',
      confianca: avisos.length > 0 ? 'media' : 'alta',
      avisos,
    }
  }

  // Só municipal de Niterói.
  if (nit.length > 0 && nit.length === pernas.length) {
    if (pernas.length > 2) {
      avisos.push('Mais de 2 ônibus por sentido: a integração de Niterói cobre 2 conduções em 1h — o excedente cobra R$ 5,60 por perna (lançar como valor extra).')
    }
    return {
      bilhetes: [BILHETE.buNiteroi],
      explicacao: 'Rota municipal de Niterói (R$ 5,60 por perna, 2 conduções em 1h com integração).',
      confianca: avisos.length > 0 ? 'media' : 'alta',
      avisos,
    }
  }

  // Só municipal do Rio.
  if (rio.length > 0 && rio.length === pernas.length) {
    return {
      bilhetes: [BILHETE.jaeRj],
      explicacao: 'Rota municipal do Rio — o Jaé é obrigatório nos modais municipais desde ago/2025.',
      confianca: 'alta',
      avisos: ['A pessoa precisa ter o cartão Jaé (o Riocard não é mais aceito nos modais municipais do Rio).'],
    }
  }

  // Municipal de outra cidade (São Gonçalo, Maricá...): o catálogo não tem
  // bilhete municipal específico — não inventar valor.
  return {
    ...sem,
    explicacao: 'Rota municipal fora de Niterói/Rio — o catálogo não tem bilhete para esse caso; confirmar o valor com a operação.',
    avisos: ['Sem regra tarifária cadastrada para este trajeto — confirmar manualmente.'],
  }
}
