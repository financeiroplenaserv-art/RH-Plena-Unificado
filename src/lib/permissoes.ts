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

/** Verifica permissão dinâmica de forma definitiva (usada por ProtectedRoute e menus). */
export function verificarPermissao(perfil: NivelAcesso, recurso: string, acao: string): boolean {
  return temPermissaoDinamica(perfil, recurso, acao) ?? false
}

// Perfis legados são mapeados para os novos equivalentes de poder.
const isAdm = (p: NivelAcesso) => p === 'adm' || p === 'admin'

const isDp = (p: NivelAcesso) => ['dp1', 'dp2'].includes(p)

// ================= DADOS MESTRES =================

/** Quem pode cadastrar/editar empresa (1.11) */
export const podeEditarEmpresa = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'empresa', 'editar') ??
  (isAdm(p) || p === 'gestor' || isDp(p) || p === 'financeiro')

/** Quem pode excluir empresa (1.12) */
export const podeExcluirEmpresa = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'empresa', 'excluir') ?? isAdm(p)

/** Quem pode cadastrar/editar departamento (1.14) */
export const podeEditarDepartamento = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'departamento', 'editar') ??
  (isAdm(p) || p === 'gestor' || isDp(p) || p === 'mesa' || p === 'financeiro')

/** Quem pode excluir departamento (1.15) */
export const podeExcluirDepartamento = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'departamento', 'excluir') ??
  (isAdm(p) || p === 'gestor' || p === 'financeiro')

/** Quem pode importar departamentos via CSV (1.16) */
export const podeImportarDepartamentos = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'departamento', 'importar') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa')

/** Quem pode editar dados básicos do colaborador (1.4) */
export const podeEditarColaboradorBasico = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'colaborador', 'editar_basico') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa')

/** Quem pode editar dados completos/sensíveis do colaborador (1.5) */
export const podeEditarColaboradorCompleto = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'colaborador', 'editar_completo') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p))

/** Quem pode cadastrar novo colaborador manualmente (1.6) */
export const podeCadastrarColaborador = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'colaborador', 'cadastrar') ??
  (isAdm(p) || p === 'rh' || isDp(p))

/** Quem pode excluir colaborador (1.7) */
export const podeExcluirColaborador = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'colaborador', 'excluir') ??
  (isAdm(p) || isDp(p))

/** Quem pode importar colaboradores do e-Contador (1.8) */
export const podeImportarColaboradores = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'colaborador', 'importar') ??
  (isAdm(p) || isDp(p))

/** Quem pode exportar dados de colaboradores (1.9) */
export const podeExportarColaboradores = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'colaborador', 'exportar') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa')

// ================= E-CONTADOR / INTEGRAÇÃO =================

/** Quem pode configurar token e executar importações do e-Contador (2.1, 2.3) */
export const podeGerenciarEContador = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'econtador', 'gerenciar') ??
  (isAdm(p) || isDp(p))

// ================= OCORRÊNCIAS =================

/** Quem pode criar/editar ocorrências (3.3, 3.4) */
export const podeEditarOcorrencia = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'ocorrencia', 'editar') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa')

/** Quem pode cancelar ocorrência (3.5) */
export const podeCancelarOcorrencia = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'ocorrencia', 'cancelar') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || p === 'dp1' || p === 'mesa')

/** Quem pode criar nova ocorrência (3.3) */
export const podeCriarOcorrencia = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'ocorrencia', 'criar') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa')

/** Quem pode visualizar detalhes da ocorrência (3.2) */
export const podeVerDetalhesOcorrencia = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'ocorrencia', 'ver_detalhes') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa' || p === 'inspetoria')

/** Quem pode aprovar/ativar ocorrência (3.10) */
export const podeAprovarOcorrencia = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'ocorrencia', 'aprovar') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p))

/** Quem pode anexar documentos em ocorrência (3.6) */
export const podeAnexarOcorrencia = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'ocorrencia', 'anexar') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa' || p === 'inspetoria')

/** Quem pode adicionar testemunhas em ocorrência (3.7) */
export const podeAdicionarTestemunha = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'ocorrencia', 'adicionar_testemunha') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa' || p === 'inspetoria')

/** Quem pode gerenciar modelos de ocorrência (3.11) */
export const podeGerenciarModelosOcorrencia = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'ocorrencia', 'gerenciar_modelos') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p))

/** Quem pode gerar PDF da ocorrência (3.8) */
export const podeGerarPDFOcorrencia = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'ocorrencia', 'gerar_pdf') ??
  (isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa' || p === 'inspetoria')

// ================= EXTRAS =================

/** Quem pode criar/editar/cancelar extras (8.2, 8.3, 8.4) */
export const podeEditarExtra = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'extras', 'editar') ??
  (isAdm(p) || p === 'mesa' || p === 'inspetoria')

/** Quem pode criar/editar categorias de valor (8.7) */
export const podeEditarCategoriaExtra = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'extras', 'editar_categoria') ??
  (isAdm(p) || p === 'mesa' || p === 'inspetoria' || p === 'financeiro')

/** Quem pode excluir categoria de valor (8.8) */
export const podeExcluirCategoriaExtra = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'extras', 'excluir_categoria') ??
  (isAdm(p) || p === 'mesa' || p === 'financeiro')

/** Quem pode gerar/assinar recibos de extras (8.10, 8.11, 8.12) */
export const podeGerenciarReciboExtra = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'extras', 'gerenciar_recibo') ??
  (isAdm(p) || p === 'mesa' || p === 'dp1' || p === 'financeiro')

/** Quem pode marcar extras como "Pago" (8.13) */
export const podeMarcarExtraComoPago = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'extras', 'marcar_pago') ??
  (isAdm(p) || p === 'financeiro')

/** Quem pode cancelar/excluir recibo (8.14) */
export const podeCancelarReciboExtra = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'extras', 'cancelar_recibo') ??
  (isAdm(p) || p === 'financeiro')

/** Quem pode visualizar relatório de extras (8.18) */
export const podeVerRelatorioExtras = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'extras', 'ver_relatorio') ??
  (isAdm(p) || p === 'mesa' || p === 'financeiro')

/** Quem pode visualizar balanço de extras (8.15) */
export const podeVerBalancoExtras = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'extras', 'ver_balanco') ?? true

/** Quem pode enviar comunicação de extras (8.16, 8.17) */
export const podeEnviarComunicacaoExtras = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'extras', 'enviar_comunicacao') ??
  (isAdm(p) || p === 'mesa' || p === 'inspetoria')

// ================= VR =================

/** Quem pode visualizar projetos VR (6.1) */
export const podeVisualizarVR = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'vr', 'visualizar') ??
  (isAdm(p) || p === 'dp1' || p === 'dp2')

/** Quem pode criar/editar/excluir projeto VR e executar todas as ações de cálculo (6.2+) */
export const podeGerenciarVR = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'vr', 'gerenciar') ??
  (isAdm(p) || p === 'dp2')

// ================= ADICIONAIS CONTRATUAIS =================

/** Quem pode criar/editar/excluir contratos (7.2, 7.3) */
export const podeEditarContratoAdicional = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'adicionais', 'editar_contrato') ??
  (isAdm(p) || p === 'gestor' || p === 'dp2' || p === 'mesa' || p === 'financeiro')

/** Quem pode criar/editar/excluir vínculos (7.5, 7.6) */
export const podeEditarVinculoAdicional = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'adicionais', 'editar_vinculo') ??
  (isAdm(p) || p === 'dp2' || p === 'mesa')

/** Quem pode preencher/editar calendário e importar ponto (7.8, 7.9) */
export const podeEditarCalendarioAdicional = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'adicionais', 'editar_calendario') ??
  (isAdm(p) || p === 'dp2' || p === 'mesa')

/** Quem pode visualizar/exportar relatório de adicionais (7.10, 7.11) */
export const podeVerRelatorioAdicionais = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'adicionais', 'ver_relatorio') ??
  (isAdm(p) || p === 'dp1' || p === 'mesa' || p === 'financeiro')

// ================= ALERTAS =================

/** Quem pode visualizar e gerenciar alertas (4.1, 4.2, 4.3) */
export const podeGerenciarAlertas = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'alertas', 'gerenciar') ??
  (isAdm(p) || p === 'dp1')

// ================= CONFIGURAÇÕES =================

/** Quem pode visualizar configurações (9.1) */
export const podeVerConfiguracoes = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'configuracoes', 'ver') ??
  (isAdm(p) || p === 'gestor')

/** Quem pode configurar token do e-Contador (9.2) */
export const podeConfigurarTokenEContador = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'configuracoes', 'configurar_token') ??
  (isAdm(p) || p === 'dp2')

// ================= AUDITORIA =================

/** Quem pode visualizar auditoria/logs (9.4) */
export const podeVerAuditoria = (p: NivelAcesso) =>
  temPermissaoDinamica(p, 'auditoria', 'ver') ??
  (isAdm(p) || p === 'gestor')

// ================= PERMISSÕES (meta) =================

/** Quem pode acessar a tela administrativa de permissões */
export const podeGerenciarPermissoes = (p: NivelAcesso) =>
  isAdm(p)
