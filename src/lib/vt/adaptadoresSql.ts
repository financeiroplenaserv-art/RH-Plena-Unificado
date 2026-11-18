import type {
  AjusteBeneficioVT,
  ComponenteDecisaoTrajetoVT,
  DecisaoTrajetoVT,
  PacoteBeneficioVT,
  VersaoPrecoPacoteVT,
} from '@/lib/vt/contratosTarifarios'
import type {
  VtBeneficioAjuste,
  VtPacote,
  VtPacotePreco,
  VtTrajetoDecisao,
  VtTrajetoDecisaoComponente,
} from '@/types/vt'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function uuid(valor: string, campo: string): string {
  if (!UUID.test(valor)) throw new Error(`${campo} precisa ser um UUID do banco; recebeu "${valor}".`)
  return valor
}

export function pacoteDeLinha(linha: VtPacote): PacoteBeneficioVT {
  return { id: linha.id, nome: linha.nome, ativo: linha.ativo }
}

export function versaoPrecoDeLinha(linha: VtPacotePreco): VersaoPrecoPacoteVT {
  return {
    id: linha.id,
    pacoteId: linha.pacote_id,
    valorDiarioCentavos: linha.valor_diario_centavos,
    vigenteDesde: linha.vigente_desde,
    vigenteAte: linha.vigente_ate,
    bilheteLegadoId: linha.bilhete_legado_id,
  }
}

export function decisaoDeLinha(linha: VtTrajetoDecisao): DecisaoTrajetoVT {
  return {
    id: linha.id,
    trajetoLegadoId: linha.trajeto_legado_id,
    colaboradorId: linha.colaborador_id,
    departamentoId: linha.departamento_id,
    revisao: linha.revisao,
    cotacaoId: linha.cotacao_id,
    custoDiarioCentavos: linha.custo_diario_centavos ?? null,
    status: linha.status,
    confirmadaPor: linha.confirmado_por,
    confirmadaEm: linha.confirmado_em,
    vigenteDesde: linha.vigente_desde,
    vigenteAte: linha.vigente_ate,
    origem: linha.origem,
    referenciasLegadasNaoResolvidas: linha.referencias_legadas_nao_resolvidas,
  }
}

export function componenteDeLinha(linha: VtTrajetoDecisaoComponente): ComponenteDecisaoTrajetoVT {
  return {
    id: linha.id,
    decisaoTrajetoId: linha.decisao_trajeto_id,
    pacoteId: linha.pacote_id,
    ordem: linha.ordem,
  }
}

export function ajusteDeLinha(linha: VtBeneficioAjuste): AjusteBeneficioVT {
  return {
    id: linha.id,
    decisaoTrajetoId: linha.decisao_trajeto_id,
    valorDiarioCentavos: linha.valor_diario_centavos,
    motivo: linha.motivo,
    autorId: linha.autor_id,
    vigenteDesde: linha.vigente_desde,
    vigenteAte: linha.vigente_ate,
    origem: linha.origem,
  }
}

export function versaoPrecoParaLinha(versao: VersaoPrecoPacoteVT): Omit<VtPacotePreco, 'created_at'> {
  return {
    id: uuid(versao.id, 'id do preço'),
    pacote_id: uuid(versao.pacoteId, 'pacoteId'),
    valor_diario_centavos: versao.valorDiarioCentavos,
    vigente_desde: versao.vigenteDesde,
    vigente_ate: versao.vigenteAte,
    bilhete_legado_id: versao.bilheteLegadoId ? uuid(versao.bilheteLegadoId, 'bilheteLegadoId') : null,
  }
}

export function decisaoParaLinha(decisao: DecisaoTrajetoVT): Omit<VtTrajetoDecisao, 'created_at'> {
  return {
    id: uuid(decisao.id, 'id da decisão'),
    trajeto_legado_id: decisao.trajetoLegadoId ? uuid(decisao.trajetoLegadoId, 'trajetoLegadoId') : null,
    colaborador_id: uuid(decisao.colaboradorId, 'colaboradorId'),
    departamento_id: uuid(decisao.departamentoId, 'departamentoId'),
    revisao: decisao.revisao,
    cotacao_id: decisao.cotacaoId,
    custo_diario_centavos: decisao.custoDiarioCentavos ?? null,
    status: decisao.status,
    confirmado_por: decisao.confirmadaPor,
    confirmado_em: decisao.confirmadaEm,
    vigente_desde: decisao.vigenteDesde,
    vigente_ate: decisao.vigenteAte,
    origem: decisao.origem ?? 'manual',
    referencias_legadas_nao_resolvidas: decisao.referenciasLegadasNaoResolvidas.map((id) =>
      uuid(id, 'referência legada não resolvida')
    ),
  }
}

export function componenteParaLinha(
  componente: ComponenteDecisaoTrajetoVT,
): Omit<VtTrajetoDecisaoComponente, 'created_at'> {
  return {
    id: uuid(componente.id, 'id do componente'),
    decisao_trajeto_id: uuid(componente.decisaoTrajetoId, 'decisaoTrajetoId'),
    pacote_id: uuid(componente.pacoteId, 'pacoteId'),
    ordem: componente.ordem,
  }
}

export function ajusteParaLinha(ajuste: AjusteBeneficioVT): Omit<VtBeneficioAjuste, 'created_at'> {
  return {
    id: uuid(ajuste.id, 'id do ajuste'),
    decisao_trajeto_id: uuid(ajuste.decisaoTrajetoId, 'decisaoTrajetoId'),
    valor_diario_centavos: ajuste.valorDiarioCentavos,
    motivo: ajuste.motivo,
    autor_id: ajuste.autorId,
    vigente_desde: ajuste.vigenteDesde,
    vigente_ate: ajuste.vigenteAte,
    origem: ajuste.origem ?? 'manual',
  }
}
