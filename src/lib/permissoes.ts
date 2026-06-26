import type { NivelAcesso } from '@/types/database'

// Perfis legados são mapeados para os novos equivalentes de poder.
const isAdm = (p: NivelAcesso) => p === 'adm' || p === 'admin'

const isDp = (p: NivelAcesso) => ['dp1', 'dp2'].includes(p)

// ================= DADOS MESTRES =================

/** Quem pode cadastrar/editar empresa (1.11) */
export const podeEditarEmpresa = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || isDp(p) || p === 'financeiro'

/** Quem pode excluir empresa (1.12) */
export const podeExcluirEmpresa = (p: NivelAcesso) => isAdm(p)

/** Quem pode cadastrar/editar departamento (1.14) */
export const podeEditarDepartamento = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || isDp(p) || p === 'mesa' || p === 'financeiro'

/** Quem pode excluir departamento (1.15) */
export const podeExcluirDepartamento = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'financeiro'

/** Quem pode importar departamentos via CSV (1.16) */
export const podeImportarDepartamentos = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa'

/** Quem pode editar dados básicos do colaborador (1.4) */
export const podeEditarColaboradorBasico = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa'

/** Quem pode editar dados completos/sensíveis do colaborador (1.5) */
export const podeEditarColaboradorCompleto = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p)

/** Quem pode cadastrar novo colaborador manualmente (1.6) */
export const podeCadastrarColaborador = (p: NivelAcesso) =>
  isAdm(p) || p === 'rh' || isDp(p)

/** Quem pode excluir colaborador (1.7) */
export const podeExcluirColaborador = (p: NivelAcesso) =>
  isAdm(p) || isDp(p)

/** Quem pode importar colaboradores do e-Contador (1.8) */
export const podeImportarColaboradores = (p: NivelAcesso) =>
  isAdm(p) || isDp(p)

/** Quem pode exportar dados de colaboradores (1.9) */
export const podeExportarColaboradores = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa'

// ================= E-CONTADOR / INTEGRAÇÃO =================

/** Quem pode configurar token e executar importações do e-Contador (2.1, 2.3) */
export const podeGerenciarEContador = (p: NivelAcesso) =>
  isAdm(p) || isDp(p)

// ================= OCORRÊNCIAS =================

/** Quem pode criar/editar ocorrências (3.3, 3.4) */
export const podeEditarOcorrencia = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa'

/** Quem pode cancelar ocorrência (3.5) */
export const podeCancelarOcorrencia = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || p === 'dp1' || p === 'mesa'

// ================= EXTRAS =================

/** Quem pode criar/editar/cancelar extras (8.2, 8.3, 8.4) */
export const podeEditarExtra = (p: NivelAcesso) =>
  isAdm(p) || p === 'mesa' || p === 'inspetoria'

/** Quem pode criar/editar categorias de valor (8.7) */
export const podeEditarCategoriaExtra = (p: NivelAcesso) =>
  isAdm(p) || p === 'mesa' || p === 'inspetoria' || p === 'financeiro'

/** Quem pode excluir categoria de valor (8.8) */
export const podeExcluirCategoriaExtra = (p: NivelAcesso) =>
  isAdm(p) || p === 'mesa' || p === 'financeiro'

/** Quem pode gerar/assinar recibos de extras (8.10, 8.11, 8.12) */
export const podeGerenciarReciboExtra = (p: NivelAcesso) =>
  isAdm(p) || p === 'mesa' || p === 'dp1' || p === 'financeiro'

/** Quem pode marcar extras como "Pago" (8.13) */
export const podeMarcarExtraComoPago = (p: NivelAcesso) =>
  isAdm(p) || p === 'financeiro'

/** Quem pode cancelar/excluir recibo (8.14) */
export const podeCancelarReciboExtra = (p: NivelAcesso) =>
  isAdm(p) || p === 'financeiro'

// ================= VR =================

/** Quem pode visualizar projetos VR (6.1) */
export const podeVisualizarVR = (p: NivelAcesso) =>
  isAdm(p) || p === 'dp1' || p === 'dp2'

/** Quem pode criar/editar/excluir projeto VR e executar todas as ações de cálculo (6.2+) */
export const podeGerenciarVR = (p: NivelAcesso) =>
  isAdm(p) || p === 'dp2'

// ================= ADICIONAIS CONTRATUAIS =================

/** Quem pode criar/editar/excluir contratos (7.2, 7.3) */
export const podeEditarContratoAdicional = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'dp2' || p === 'mesa' || p === 'financeiro'

/** Quem pode criar/editar/excluir vínculos (7.5, 7.6) */
export const podeEditarVinculoAdicional = (p: NivelAcesso) =>
  isAdm(p) || p === 'dp2' || p === 'mesa'

/** Quem pode preencher/editar calendário e importar ponto (7.8, 7.9) */
export const podeEditarCalendarioAdicional = (p: NivelAcesso) =>
  isAdm(p) || p === 'dp2' || p === 'mesa'

/** Quem pode visualizar/exportar relatório de adicionais (7.10, 7.11) */
export const podeVerRelatorioAdicionais = (p: NivelAcesso) =>
  isAdm(p) || p === 'dp1' || p === 'mesa' || p === 'financeiro'

// ================= OCORRÊNCIAS =================

/** Quem pode criar nova ocorrência (3.3) */
export const podeCriarOcorrencia = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa'

/** Quem pode visualizar detalhes da ocorrência (3.2) — inclui inspetoria para operação prática */
export const podeVerDetalhesOcorrencia = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa' || p === 'inspetoria'

/** Quem pode aprovar/ativar ocorrência (3.10) */
export const podeAprovarOcorrencia = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p)

/** Quem pode anexar documentos em ocorrência (3.6) */
export const podeAnexarOcorrencia = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa' || p === 'inspetoria'

/** Quem pode adicionar testemunhas em ocorrência (3.7) */
export const podeAdicionarTestemunha = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa' || p === 'inspetoria'

/** Quem pode gerenciar modelos de ocorrência (3.11) */
export const podeGerenciarModelosOcorrencia = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p)

/** Quem pode gerar PDF da ocorrência (3.8) */
export const podeGerarPDFOcorrencia = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa' || p === 'inspetoria'

/** Quem pode visualizar auditoria/logs da ocorrência (9.4) */
export const podeVerAuditoria = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor'

// ================= ALERTAS =================

/** Quem pode visualizar e gerenciar alertas (4.1, 4.2, 4.3) */
export const podeGerenciarAlertas = (p: NivelAcesso) =>
  isAdm(p) || p === 'dp1'

// ================= CONFIGURAÇÕES =================

/** Quem pode visualizar configurações (9.1) */
export const podeVerConfiguracoes = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor'

/** Quem pode configurar token do e-Contador (9.2) */
export const podeConfigurarTokenEContador = (p: NivelAcesso) =>
  isAdm(p) || p === 'dp2'
