export interface AvisoTransferencia {
  colaboradorNome: string
  matricula: string
  postoOrigem: string
  postoDestino: string
  /** Já formatada para exibição (dd/mm/aaaa). */
  dataTransferencia: string
  gravidade: string
  descricao: string
  atualizouCadastro: boolean
  ocorrenciaId: string
}

export const TETO_CAMPO_AVISO = 200
export const TETO_DESCRICAO_AVISO = 4000

function limpar(texto: string | null | undefined, teto: number): string {
  return (texto || '').trim().slice(0, teto)
}

export function montarPayloadAviso(aviso: AvisoTransferencia): AvisoTransferencia {
  return {
    colaboradorNome: limpar(aviso.colaboradorNome, TETO_CAMPO_AVISO),
    matricula: limpar(aviso.matricula, 20),
    postoOrigem: limpar(aviso.postoOrigem, TETO_CAMPO_AVISO),
    postoDestino: limpar(aviso.postoDestino, TETO_CAMPO_AVISO),
    dataTransferencia: limpar(aviso.dataTransferencia, 20),
    gravidade: limpar(aviso.gravidade, 20),
    descricao: limpar(aviso.descricao, TETO_DESCRICAO_AVISO),
    atualizouCadastro: aviso.atualizouCadastro === true,
    ocorrenciaId: limpar(aviso.ocorrenciaId, 40),
  }
}

export function montarAssuntoAviso(aviso: Pick<AvisoTransferencia, 'colaboradorNome'>): string {
  const nome = limpar(aviso.colaboradorNome, TETO_CAMPO_AVISO) || 'colaborador'
  return `[CORH] Transferência emitida — ${nome}`
}
