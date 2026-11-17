import type {
  VtBeneficioAjuste,
  VtTrajetoDecisao,
  VtTrajetoDecisaoComponente,
} from '@/types/vt'

export function novaRevisaoDeDecisao(
  atual: VtTrajetoDecisao,
  vigenteDesde: string,
): Omit<VtTrajetoDecisao, 'id' | 'created_at'> {
  return {
    trajeto_legado_id: atual.trajeto_legado_id,
    colaborador_id: atual.colaborador_id,
    departamento_id: atual.departamento_id,
    revisao: atual.revisao + 1,
    cotacao_id: atual.cotacao_id,
    status: 'sugerida',
    confirmado_por: null,
    confirmado_em: null,
    vigente_desde: vigenteDesde,
    vigente_ate: null,
    origem: 'manual',
    referencias_legadas_nao_resolvidas: [...atual.referencias_legadas_nao_resolvidas],
    itinerario_id: null,
  }
}

export function componentesNaoCopiados(
  origem: readonly VtTrajetoDecisaoComponente[],
  destino: readonly Pick<VtTrajetoDecisaoComponente, 'pacote_id' | 'ordem'>[],
): VtTrajetoDecisaoComponente[] {
  return origem.filter((componente) => !destino.some((copiado) =>
    copiado.pacote_id === componente.pacote_id || copiado.ordem === componente.ordem
  ))
}

function mesmaVigenciaAjuste(
  ajuste: Pick<VtBeneficioAjuste, 'valor_diario_centavos' | 'motivo' | 'vigente_desde' | 'vigente_ate' | 'origem'>,
  outro: Pick<VtBeneficioAjuste, 'valor_diario_centavos' | 'motivo' | 'vigente_desde' | 'vigente_ate' | 'origem'>,
): boolean {
  return ajuste.valor_diario_centavos === outro.valor_diario_centavos &&
    ajuste.motivo === outro.motivo &&
    ajuste.vigente_desde === outro.vigente_desde &&
    ajuste.vigente_ate === outro.vigente_ate &&
    ajuste.origem === outro.origem
}

export function ajustesNaoCopiados(
  origem: readonly VtBeneficioAjuste[],
  destino: readonly Pick<VtBeneficioAjuste, 'valor_diario_centavos' | 'motivo' | 'vigente_desde' | 'vigente_ate' | 'origem'>[],
): VtBeneficioAjuste[] {
  return origem.filter((ajuste) => !destino.some((copiado) => mesmaVigenciaAjuste(ajuste, copiado)))
}
