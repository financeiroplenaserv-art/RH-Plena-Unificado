import type { NivelAcesso, PermissaoPerfil } from '@/types/database'

// Cache global de permissões carregadas do banco.
// O hook usePermissoes atualiza essa cache após carregar/salvar.
let permissoesCache: PermissaoPerfil[] = []

export function setPermissoesCache(permissoes: PermissaoPerfil[]) {
  permissoesCache = permissoes
}

export function getPermissoesCache(): PermissaoPerfil[] {
  return permissoesCache
}

// Perfis legados são mapeados para os novos equivalentes de poder.
const isAdm = (p: NivelAcesso) => p === 'adm' || p === 'admin'

// ============================================================
// MAPA ÚNICO DE PERMISSÕES PADRÃO (fallbacks)
// ------------------------------------------------------------
// Usado quando NÃO existe linha explícita em permissoes_perfil para a
// combinação (perfil, recurso, acao). A tela Permissões exibe esses mesmos
// valores como estado efetivo — o que o admin vê é o que o sistema aplica.
// admin/adm não aparecem aqui: eles têm acesso total sempre.
// ============================================================

const PERMISSOES_PADRAO: Partial<Record<string, Partial<Record<string, NivelAcesso[]>>>> = {
  empresa: {
    editar: ['gestor', 'dp1', 'dp2', 'financeiro'],
    excluir: [],
  },
  departamento: {
    editar: ['gestor', 'dp1', 'dp2', 'mesa', 'financeiro'],
    excluir: ['gestor', 'financeiro'],
    importar: ['gestor', 'rh', 'dp1', 'dp2', 'mesa'],
  },
  colaborador: {
    editar_basico: ['gestor', 'rh', 'dp1', 'dp2', 'mesa'],
    editar_completo: ['gestor', 'rh', 'dp1', 'dp2'],
    cadastrar: ['rh', 'dp1', 'dp2'],
    excluir: ['dp1', 'dp2'],
    importar: ['dp1', 'dp2'],
    exportar: ['gestor', 'rh', 'dp1', 'dp2', 'mesa'],
  },
  econtador: {
    gerenciar: ['dp1', 'dp2'],
  },
  ocorrencia: {
    editar: ['gestor', 'rh', 'dp1', 'dp2', 'mesa'],
    cancelar: ['gestor', 'rh', 'dp1', 'mesa'],
    criar: ['gestor', 'rh', 'dp1', 'dp2', 'mesa'],
    ver_detalhes: ['gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria'],
    aprovar: ['gestor', 'rh', 'dp1', 'dp2'],
    anexar: ['gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria'],
    adicionar_testemunha: ['gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria'],
    gerar_pdf: ['gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria'],
    gerenciar_modelos: ['gestor', 'rh', 'dp1', 'dp2'],
  },
  extras: {
    editar: ['mesa', 'inspetoria'],
    editar_categoria: ['mesa', 'inspetoria', 'financeiro'],
    excluir_categoria: ['mesa', 'financeiro'],
    gerenciar_recibo: ['mesa', 'dp1', 'financeiro'],
    marcar_pago: ['financeiro'],
    cancelar_recibo: ['financeiro'],
    ver_relatorio: ['mesa', 'financeiro'],
    ver_balanco: [],
    enviar_comunicacao: ['mesa', 'inspetoria'],
  },
  vr: {
    visualizar: ['dp1', 'dp2'],
    gerenciar: ['dp2'],
  },
  adicionais: {
    editar_contrato: ['gestor', 'dp2', 'mesa', 'financeiro'],
    editar_vinculo: ['dp2', 'mesa'],
    editar_calendario: ['dp2', 'mesa'],
    ver_relatorio: ['dp1', 'mesa', 'financeiro'],
  },
  alertas: {
    gerenciar: ['dp1'],
  },
  configuracoes: {
    ver: ['gestor'],
    configurar_token: ['dp2'],
  },
  auditoria: {
    ver: ['gestor'],
  },
  ceu: {
    registrar_entrega: ['gestor', 'dp1', 'dp2', 'mesa', 'inspetoria'],
    devolver: ['gestor', 'dp1', 'dp2', 'mesa', 'inspetoria'],
    excluir_entrega: ['gestor', 'dp1', 'dp2'],
    emitir_recibo: ['gestor', 'dp1', 'dp2', 'mesa', 'inspetoria'],
    editar_itens: ['gestor', 'dp1', 'dp2'],
    excluir_itens: ['gestor', 'dp1', 'dp2'],
    gerenciar_fornecedores: ['gestor', 'dp1', 'dp2'],
    importar: ['gestor', 'dp1', 'dp2'],
    ver_relatorios: ['gestor', 'dp1', 'dp2', 'mesa', 'inspetoria'],
  },
}

function temPermissaoDinamica(perfil: NivelAcesso, recurso: string, acao: string): boolean | null {
  if (perfil === 'admin' || perfil === 'adm') return true

  if (permissoesCache.length === 0) return null

  const permissaoTodos = permissoesCache.find(
    (p) => p.perfil === perfil && p.recurso === 'todos' && p.acao === 'todos'
  )
  if (permissaoTodos?.permitido) return true

  const permissao = permissoesCache.find(
    (p) => p.perfil === perfil && p.recurso === recurso && p.acao === acao
  )

  return permissao ? permissao.permitido : null
}

/**
 * Valor efetivo da permissão: linha explícita do banco quando existe;
 * caso contrário, o padrão do PERMISSOES_PADRAO. É o mesmo valor que a
 * tela Permissões exibe — fonte única de verdade para ações internas.
 */
export function temPermissaoComPadrao(perfil: NivelAcesso, recurso: string, acao: string): boolean {
  const dinamica = temPermissaoDinamica(perfil, recurso, acao)
  if (dinamica !== null) return dinamica
  return PERMISSOES_PADRAO[recurso]?.[acao]?.includes(perfil) ?? false
}

/** Verifica permissão dinâmica de forma definitiva (usada por ProtectedRoute e menus). */
export function verificarPermissao(perfil: NivelAcesso, recurso: string, acao: string): boolean {
  return temPermissaoDinamica(perfil, recurso, acao) ?? false
}

// ================= DADOS MESTRES =================

/** Quem pode cadastrar/editar empresa (1.11) */
export const podeEditarEmpresa = (p: NivelAcesso) => temPermissaoComPadrao(p, 'empresa', 'editar')

/** Quem pode excluir empresa (1.12) */
export const podeExcluirEmpresa = (p: NivelAcesso) => temPermissaoComPadrao(p, 'empresa', 'excluir')

/** Quem pode cadastrar/editar departamento (1.14) */
export const podeEditarDepartamento = (p: NivelAcesso) => temPermissaoComPadrao(p, 'departamento', 'editar')

/** Quem pode excluir departamento (1.15) */
export const podeExcluirDepartamento = (p: NivelAcesso) => temPermissaoComPadrao(p, 'departamento', 'excluir')

/** Quem pode importar departamentos via CSV (1.16) */
export const podeImportarDepartamentos = (p: NivelAcesso) => temPermissaoComPadrao(p, 'departamento', 'importar')

/** Quem pode editar dados básicos do colaborador (1.4) */
export const podeEditarColaboradorBasico = (p: NivelAcesso) => temPermissaoComPadrao(p, 'colaborador', 'editar_basico')

/** Quem pode editar dados completos/sensíveis do colaborador (1.5) */
export const podeEditarColaboradorCompleto = (p: NivelAcesso) => temPermissaoComPadrao(p, 'colaborador', 'editar_completo')

/** Quem pode cadastrar novo colaborador manualmente (1.6) */
export const podeCadastrarColaborador = (p: NivelAcesso) => temPermissaoComPadrao(p, 'colaborador', 'cadastrar')

/** Quem pode excluir colaborador (1.7) */
export const podeExcluirColaborador = (p: NivelAcesso) => temPermissaoComPadrao(p, 'colaborador', 'excluir')

/** Quem pode importar colaboradores do e-Contador (1.8) */
export const podeImportarColaboradores = (p: NivelAcesso) => temPermissaoComPadrao(p, 'colaborador', 'importar')

/** Quem pode exportar dados de colaboradores (1.9) */
export const podeExportarColaboradores = (p: NivelAcesso) => temPermissaoComPadrao(p, 'colaborador', 'exportar')

// ================= E-CONTADOR / INTEGRAÇÃO =================

/** Quem pode configurar token e executar importações do e-Contador (2.1, 2.3) */
export const podeGerenciarEContador = (p: NivelAcesso) => temPermissaoComPadrao(p, 'econtador', 'gerenciar')

// ================= OCORRÊNCIAS =================

/** Quem pode criar/editar ocorrências (3.3, 3.4) */
export const podeEditarOcorrencia = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ocorrencia', 'editar')

/** Quem pode cancelar ocorrência (3.5) */
export const podeCancelarOcorrencia = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ocorrencia', 'cancelar')

/** Quem pode criar nova ocorrência (3.3) */
export const podeCriarOcorrencia = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ocorrencia', 'criar')

/** Quem pode visualizar detalhes da ocorrência (3.2) */
export const podeVerDetalhesOcorrencia = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ocorrencia', 'ver_detalhes')

/** Quem pode aprovar/ativar ocorrência (3.10) */
export const podeAprovarOcorrencia = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ocorrencia', 'aprovar')

/** Quem pode anexar documentos em ocorrência (3.6) */
export const podeAnexarOcorrencia = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ocorrencia', 'anexar')

/** Quem pode adicionar testemunhas em ocorrência (3.7) */
export const podeAdicionarTestemunha = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ocorrencia', 'adicionar_testemunha')

/** Quem pode gerenciar modelos de ocorrência (3.11) */
export const podeGerenciarModelosOcorrencia = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ocorrencia', 'gerenciar_modelos')

/** Quem pode gerar PDF da ocorrência (3.8) */
export const podeGerarPDFOcorrencia = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ocorrencia', 'gerar_pdf')

// ================= EXTRAS =================

/** Quem pode criar/editar/cancelar extras (8.2, 8.3, 8.4) */
export const podeEditarExtra = (p: NivelAcesso) => temPermissaoComPadrao(p, 'extras', 'editar')

/** Quem pode criar/editar categorias de valor (8.7) */
export const podeEditarCategoriaExtra = (p: NivelAcesso) => temPermissaoComPadrao(p, 'extras', 'editar_categoria')

/** Quem pode excluir categoria de valor (8.8) */
export const podeExcluirCategoriaExtra = (p: NivelAcesso) => temPermissaoComPadrao(p, 'extras', 'excluir_categoria')

/** Quem pode gerar/assinar recibos de extras (8.10, 8.11, 8.12) */
export const podeGerenciarReciboExtra = (p: NivelAcesso) => temPermissaoComPadrao(p, 'extras', 'gerenciar_recibo')

/** Quem pode marcar extras como "Pago" (8.13) */
export const podeMarcarExtraComoPago = (p: NivelAcesso) => temPermissaoComPadrao(p, 'extras', 'marcar_pago')

/** Quem pode cancelar/excluir recibo (8.14) */
export const podeCancelarReciboExtra = (p: NivelAcesso) => temPermissaoComPadrao(p, 'extras', 'cancelar_recibo')

/** Quem pode visualizar relatório de extras (8.18) */
export const podeVerRelatorioExtras = (p: NivelAcesso) => temPermissaoComPadrao(p, 'extras', 'ver_relatorio')

/** Quem pode visualizar balanço de extras (8.15) */
export const podeVerBalancoExtras = (p: NivelAcesso) => temPermissaoComPadrao(p, 'extras', 'ver_balanco')

/** Quem pode enviar comunicação de extras (8.16, 8.17) */
export const podeEnviarComunicacaoExtras = (p: NivelAcesso) => temPermissaoComPadrao(p, 'extras', 'enviar_comunicacao')

// ================= VR =================

/** Quem pode visualizar projetos VR (6.1) */
export const podeVisualizarVR = (p: NivelAcesso) => temPermissaoComPadrao(p, 'vr', 'visualizar')

/** Quem pode criar/editar/excluir projeto VR e executar todas as ações de cálculo (6.2+) */
export const podeGerenciarVR = (p: NivelAcesso) => temPermissaoComPadrao(p, 'vr', 'gerenciar')

// ================= CEU =================

/** Quem pode registrar entregas (nova entrega / lançamento rápido) */
export const podeRegistrarEntregaCEU = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ceu', 'registrar_entrega')

/** Quem pode registrar devolução de itens */
export const podeDevolverCEU = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ceu', 'devolver')

/** Quem pode excluir entregas */
export const podeExcluirEntregaCEU = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ceu', 'excluir_entrega')

/** Quem pode emitir recibos de entrega */
export const podeEmitirReciboCEU = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ceu', 'emitir_recibo')

/** Quem pode cadastrar/editar itens do CEU */
export const podeEditarItemCEU = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ceu', 'editar_itens')

/** Quem pode excluir itens do CEU */
export const podeExcluirItemCEU = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ceu', 'excluir_itens')

/** Quem pode gerenciar fornecedores */
export const podeGerenciarFornecedoresCEU = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ceu', 'gerenciar_fornecedores')

/** Quem pode importar planilha de itens */
export const podeImportarCEU = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ceu', 'importar')

/** Quem pode visualizar relatórios do CEU */
export const podeVerRelatoriosCEU = (p: NivelAcesso) => temPermissaoComPadrao(p, 'ceu', 'ver_relatorios')

// ================= ADICIONAIS CONTRATUAIS =================

/** Quem pode criar/editar/excluir contratos (7.2, 7.3) */
export const podeEditarContratoAdicional = (p: NivelAcesso) => temPermissaoComPadrao(p, 'adicionais', 'editar_contrato')

/** Quem pode criar/editar/excluir vínculos (7.5, 7.6) */
export const podeEditarVinculoAdicional = (p: NivelAcesso) => temPermissaoComPadrao(p, 'adicionais', 'editar_vinculo')

/** Quem pode preencher/editar calendário e importar ponto (7.8, 7.9) */
export const podeEditarCalendarioAdicional = (p: NivelAcesso) => temPermissaoComPadrao(p, 'adicionais', 'editar_calendario')

/** Quem pode visualizar/exportar relatório de adicionais (7.10, 7.11) */
export const podeVerRelatorioAdicionais = (p: NivelAcesso) => temPermissaoComPadrao(p, 'adicionais', 'ver_relatorio')

// ================= ALERTAS =================

/** Quem pode visualizar e gerenciar alertas (4.1, 4.2, 4.3) */
export const podeGerenciarAlertas = (p: NivelAcesso) => temPermissaoComPadrao(p, 'alertas', 'gerenciar')

// ================= CONFIGURAÇÕES =================

/** Quem pode visualizar configurações (9.1) */
export const podeVerConfiguracoes = (p: NivelAcesso) => temPermissaoComPadrao(p, 'configuracoes', 'ver')

/** Quem pode configurar token do e-Contador (9.2) */
export const podeConfigurarTokenEContador = (p: NivelAcesso) => temPermissaoComPadrao(p, 'configuracoes', 'configurar_token')

// ================= AUDITORIA =================

/** Quem pode visualizar auditoria/logs (9.4) */
export const podeVerAuditoria = (p: NivelAcesso) => temPermissaoComPadrao(p, 'auditoria', 'ver')

// ================= PERMISSÕES (meta) =================

/** Quem pode acessar a tela administrativa de permissões */
export const podeGerenciarPermissoes = (p: NivelAcesso) =>
  isAdm(p)
