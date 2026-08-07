// Captura screenshots de todas as telas do CORH com dados fictícios.
// Usa Edge headless + interceptação de rede: simula sessão de login e
// responde as chamadas do Supabase (REST/Auth) com dados de exemplo.
// NENHUMA chamada real chega ao banco — tudo é respondido localmente.
//
// Uso: node capturar-telas.cjs [rota1 rota2 ...]   (sem args = todas)

const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
const OUT_DIR = path.join(__dirname, 'prints')
const LOG_FILE = path.join(__dirname, 'requests.log')

const PROJECT_REF = 'jmdjdogskvybsdjtmpmb'
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`
const USER_ID = '00000000-0000-4000-8000-0000000000aa'

// ---------------------------------------------------------------- JWT fake
function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}
const FAKE_JWT = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({
    sub: USER_ID,
    email: 'demo@plenaservicos.com.br',
    role: 'authenticated',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000),
  }),
  'assinatura-falsa',
].join('.')

const FAKE_SESSION = {
  access_token: FAKE_JWT,
  token_type: 'bearer',
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  refresh_token: 'refresh-falso',
  user: {
    id: USER_ID,
    email: 'demo@plenaservicos.com.br',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  },
}

// ---------------------------------------------------------------- dados fictícios
const colaboradores = [
  { id: 'c1', nome: 'Mariana Souza Exemplo', nome_completo: 'Mariana Souza Exemplo', matricula: '000101', cpf: '123.456.789-00', funcao: 'Auxiliar de Limpeza', cargo: 'Auxiliar de Limpeza', status: 'Ativo', empresa_id: 'e1', departamento_id: 'd1', departamento: 'Enseada Park', data_admissao: '2023-02-10', data_demissao: null, telefone: '(21) 99999-0001', email: 'mariana.exemplo@email.com', escala: '12x36', created_at: '2023-02-10T00:00:00Z' },
  { id: 'c2', nome: 'Carlos Pereira Modelo', nome_completo: 'Carlos Pereira Modelo', matricula: '000102', cpf: '987.654.321-00', funcao: 'Porteiro', cargo: 'Porteiro', status: 'Ativo', empresa_id: 'e1', departamento_id: 'd2', departamento: 'Great Place', data_admissao: '2022-05-01', data_demissao: null, telefone: '(21) 99999-0002', email: null, escala: '5x2', created_at: '2022-05-01T00:00:00Z' },
  { id: 'c3', nome: 'Ana Beatriz Fictícia', nome_completo: 'Ana Beatriz Fictícia', matricula: '000103', cpf: '456.789.123-00', funcao: 'Recepcionista', cargo: 'Recepcionista', status: 'Ativo', empresa_id: 'e2', departamento_id: 'd3', departamento: 'CBO Niterói', data_admissao: '2024-01-15', data_demissao: null, telefone: '(21) 99999-0003', email: 'ana.ficticia@email.com', escala: '5x2', created_at: '2024-01-15T00:00:00Z' },
  { id: 'c4', nome: 'João Roberto Amostra', nome_completo: 'João Roberto Amostra', matricula: '000104', cpf: '321.654.987-00', funcao: 'Jardineiro', cargo: 'Jardineiro', status: 'Ativo', empresa_id: 'e1', departamento_id: 'd4', departamento: 'Quintas', data_admissao: '2021-11-20', data_demissao: null, telefone: null, email: null, escala: '6x1', created_at: '2021-11-20T00:00:00Z' },
  { id: 'c5', nome: 'Fernanda Lima Teste', nome_completo: 'Fernanda Lima Teste', matricula: '000105', cpf: '654.987.321-00', funcao: 'Auxiliar de Serviços Gerais', cargo: 'Auxiliar de Serviços Gerais', status: 'Afastado', empresa_id: 'e2', departamento_id: 'd5', departamento: 'Cartório', data_admissao: '2023-08-05', data_demissao: null, telefone: '(21) 99999-0005', email: null, escala: '5x2', created_at: '2023-08-05T00:00:00Z' },
  { id: 'c6', nome: 'Ricardo Alves Simulação', nome_completo: 'Ricardo Alves Simulação', matricula: '000106', cpf: '789.123.456-00', funcao: 'Faltista', cargo: 'Faltista', status: 'Inativo', empresa_id: 'e1', departamento_id: 'd1', departamento: 'Enseada Park', data_admissao: '2020-03-01', data_demissao: '2026-06-30', telefone: null, email: null, escala: null, created_at: '2020-03-01T00:00:00Z' },
]

const empresas = [
  { id: 'e1', nome: 'PLENA EA FACILITIES', cnpj: '12.345.678/0001-90', created_at: '2020-01-01T00:00:00Z' },
  { id: 'e2', nome: 'PLENA TECH SERVIÇOS', cnpj: '98.765.432/0001-10', created_at: '2020-01-01T00:00:00Z' },
]

const departamentos = [
  { id: 'd1', nome: 'CONDOMÍNIO ENSEADA PARK', nome_curto: 'Enseada Park', empresa_id: 'e1', cidade: 'Niterói', estado: 'RJ', status: 'Ativo', contato_portaria: '(21) 3000-0001', data_inicio_contrato: '2022-01-01', created_at: '2022-01-01T00:00:00Z' },
  { id: 'd2', nome: 'EDIFÍCIO GREAT PLACE', nome_curto: 'Great Place', empresa_id: 'e1', cidade: 'Rio de Janeiro', estado: 'RJ', status: 'Ativo', contato_portaria: '(21) 3000-0002', data_inicio_contrato: '2021-06-01', created_at: '2021-06-01T00:00:00Z' },
  { id: 'd3', nome: 'CBO NITERÓI', nome_curto: 'CBO Niterói', empresa_id: 'e2', cidade: 'Niterói', estado: 'RJ', status: 'Ativo', contato_portaria: null, data_inicio_contrato: '2023-03-01', created_at: '2023-03-01T00:00:00Z' },
  { id: 'd4', nome: 'QUINTAS DE ICARAÍ', nome_curto: 'Quintas', empresa_id: 'e1', cidade: 'Niterói', estado: 'RJ', status: 'Ativo', contato_portaria: null, data_inicio_contrato: '2022-09-01', created_at: '2022-09-01T00:00:00Z' },
  { id: 'd5', nome: 'CARTÓRIO 3º OFÍCIO DE NOTAS', nome_curto: 'Cartório', empresa_id: 'e2', cidade: 'Rio de Janeiro', estado: 'RJ', status: 'Ativo', contato_portaria: null, data_inicio_contrato: '2024-01-01', created_at: '2024-01-01T00:00:00Z' },
]

const ocorrencias = [
  { id: 'o1', colaborador_id: 'c1', colaborador_nome: 'Mariana Souza Exemplo', tipo: 'Advertência Verbal', tipo_ocorrencia: 'Advertência Verbal', macro_grupo: 'Disciplinar', titulo: 'Advertência por atraso recorrente', status: 'Ativa', data_ocorrencia: '2026-07-15', descricao: 'Atraso recorrente no início do turno.', gravidade: 'Leve', empresa_id: 'e1', departamento_id: 'd1', motivo: 'Atraso', created_at: '2026-07-15T10:00:00Z' },
  { id: 'o2', colaborador_id: 'c2', colaborador_nome: 'Carlos Pereira Modelo', tipo: 'Falta Injustificada', tipo_ocorrencia: 'Falta Injustificada', macro_grupo: 'Faltas', titulo: 'Falta sem aviso prévio', status: 'Pendente', data_ocorrencia: '2026-07-28', descricao: 'Ausência sem aviso prévio.', gravidade: 'Média', empresa_id: 'e1', departamento_id: 'd2', motivo: 'Falta', created_at: '2026-07-28T10:00:00Z' },
  { id: 'o3', colaborador_id: 'c3', colaborador_nome: 'Ana Beatriz Fictícia', tipo: 'Falta Justificada (atestado)', tipo_ocorrencia: 'Falta Justificada (atestado)', macro_grupo: 'Atestados', titulo: 'Atestado médico de 1 dia', status: 'Ativa', data_ocorrencia: '2026-07-20', descricao: 'Atestado médico de 1 dia entregue.', gravidade: 'Leve', empresa_id: 'e2', departamento_id: 'd3', motivo: 'Atestado', created_at: '2026-07-20T10:00:00Z' },
  { id: 'o4', colaborador_id: 'c4', colaborador_nome: 'João Roberto Amostra', tipo: 'Advertência Escrita', tipo_ocorrencia: 'Advertência Escrita', macro_grupo: 'Disciplinar', titulo: 'Não uso de EPI', status: 'Ativa', data_ocorrencia: '2026-06-10', descricao: 'Não uso de EPI durante a jardinagem.', gravidade: 'Grave', empresa_id: 'e1', departamento_id: 'd4', motivo: 'EPI', created_at: '2026-06-10T10:00:00Z' },
  { id: 'o5', colaborador_id: 'c5', colaborador_nome: 'Fernanda Lima Teste', tipo: 'Licença Médica (até 15 dias)', tipo_ocorrencia: 'Licença Médica (até 15 dias)', macro_grupo: 'Atestados', titulo: 'Licença médica de 10 dias', status: 'Ativa', data_ocorrencia: '2026-07-01', descricao: 'Licença médica de 10 dias.', gravidade: 'Leve', empresa_id: 'e2', departamento_id: 'd5', motivo: 'Saúde', created_at: '2026-07-01T10:00:00Z' },
]

const itensCeu = [
  { id: 'i1', codigo: 'UNI-001', nome: 'Camisa Pólo Azul', categoria: 'Uniforme', tipo: 'Uniforme', subgrupo: 'Camisa', tamanho: 'M', ca: null, estoque: 25, estoque_atual: 25, estoque_minimo: 5, prazo_uso_dias: 180, unidade: 'un', situacao: 'Ativo', fornecedor_id: 'f1', ativo: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'i2', codigo: 'UNI-002', nome: 'Calça Brim Cinza', categoria: 'Uniforme', tipo: 'Uniforme', subgrupo: 'Calça', tamanho: '42', ca: null, estoque: 18, estoque_atual: 18, estoque_minimo: 5, prazo_uso_dias: 180, unidade: 'un', situacao: 'Ativo', fornecedor_id: 'f1', ativo: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'i3', codigo: 'EPI-001', nome: 'Bota de Segurança', categoria: 'EPI', tipo: 'EPI', subgrupo: 'Calçado', tamanho: '41', ca: '12.345', estoque: 10, estoque_atual: 10, estoque_minimo: 3, prazo_uso_dias: 365, unidade: 'par', situacao: 'Ativo', fornecedor_id: 'f2', ativo: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'i4', codigo: 'EPI-002', nome: 'Luva de Vaqueta', categoria: 'EPI', tipo: 'EPI', subgrupo: 'Luva', tamanho: 'G', ca: '23.456', estoque: 30, estoque_atual: 30, estoque_minimo: 10, prazo_uso_dias: 90, unidade: 'par', situacao: 'Ativo', fornecedor_id: 'f2', ativo: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'i5', codigo: 'CRA-001', nome: 'Crachá de Identificação', categoria: 'Crachá', tipo: 'Crachá', subgrupo: null, tamanho: null, ca: null, estoque: 50, estoque_atual: 50, estoque_minimo: 10, prazo_uso_dias: null, unidade: 'un', situacao: 'Ativo', fornecedor_id: 'f3', ativo: true, created_at: '2022-01-01T00:00:00Z' },
]

const fornecedores = [
  { id: 'f1', nome: 'Uniformes Modelo Ltda', cnpj: '11.222.333/0001-44', telefone: '(21) 4000-0001', email: 'contato@uniformesmodelo.com', ativo: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'f2', nome: 'EPI Segurança Total', cnpj: '55.666.777/0001-88', telefone: '(21) 4000-0002', email: 'vendas@episeg.com', ativo: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'f3', nome: 'Gráfica Exemplo', cnpj: null, telefone: '(21) 4000-0003', email: null, ativo: true, created_at: '2023-01-01T00:00:00Z' },
]

function entrega(id, colaboradorId, item, qtd, data, situacao, statusRecibo) {
  return {
    id, colaborador_id: colaboradorId, item_id: item.id,
    quantidade: qtd, data_entrega: data, situacao,
    status_recibo: statusRecibo, status: statusRecibo,
    numero_recibo: statusRecibo === 'Emitido' ? `2026-${id.replace(/\D/g, '').padStart(4, '0')}` : null,
    matricula: colaboradores.find(c => c.id === colaboradorId)?.matricula,
    observacao: null, devolvido: false, data_devolucao: null,
    snapshot_item: { nome: item.nome, categoria: item.categoria, tamanho: item.tamanho, ca: item.ca },
    created_at: `${data}T09:00:00Z`,
  }
}
const entregas = [
  entrega('en1', 'c1', itensCeu[0], 2, '2026-08-01', 'Troca', 'Emitido'),
  entrega('en2', 'c1', itensCeu[2], 1, '2026-08-01', 'Troca', 'Emitido'),
  entrega('en3', 'c2', itensCeu[1], 1, '2026-07-25', 'Novo', 'Pendente'),
  entrega('en4', 'c3', itensCeu[4], 1, '2026-07-20', 'Novo', 'Emitido'),
  entrega('en5', 'c4', itensCeu[3], 2, '2026-07-18', 'Troca', 'Pendente'),
]

const categoriasExtras = [
  { id: 'cat1', nome: 'Operacional', valor_padrao: 130.0, ativa: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'cat2', nome: 'Faltista', valor_padrao: 130.0, ativa: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'cat3', nome: 'Evento', valor_padrao: 180.0, ativa: true, created_at: '2022-01-01T00:00:00Z' },
]

function extra(id, data, substitutoId, ausenteId, categoria, valor, geraExtra, faturado, depto) {
  const ausenteNome = ausenteId ? colaboradores.find(c => c.id === ausenteId)?.nome : null
  return {
    id, data, data_ocorrencia: data, cliente: depto.nome, posto: depto.nome_curto,
    departamento_id: depto.id, departamento_nome: depto.nome, empresa_id: depto.empresa_id,
    funcao: 'Auxiliar de Limpeza', categoria, valor,
    turno: 'Diurno', motivo: ausenteId ? 'Cobertura de falta' : 'Demanda extra',
    status: 'Pendente', pago: false,
    gera_extra: geraExtra, faturado, extra_faturado: faturado,
    substituto_id: substitutoId === 'SEM' ? null : substitutoId, ausente_id: ausenteId,
    colaborador_ausente_id: ausenteId, colaborador_ausente_nome: ausenteNome,
    substituto_nome: substitutoId === 'SEM' ? 'SEM NOME' : (colaboradores.find(c => c.id === substitutoId)?.nome || null),
    ausente_nome: ausenteNome,
    categoria_valor_nome: categoria, observacao: null, observacoes: null,
    created_at: `${data}T08:00:00Z`, updated_at: `${data}T08:00:00Z`,
  }
}
const extras = [
  extra('x1', '2026-08-02', 'c4', 'c1', 'Operacional', 130.0, true, true, departamentos[0]),
  extra('x2', '2026-08-03', 'SEM', 'c2', 'Faltista', 0, false, true, departamentos[1]),
  extra('x3', '2026-08-04', 'c3', null, 'Evento', 180.0, true, true, departamentos[2]),
  extra('x4', '2026-08-05', 'c1', 'c5', 'Operacional', 130.0, true, false, departamentos[3]),
]

const locais = [
  { id: 'l1', nome: 'CONDOMÍNIO ENSEADA PARK', nome_curto: 'Enseada Park', status: 'Ativo', observacao: null, ativo: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'l2', nome: 'EDIFÍCIO GREAT PLACE', nome_curto: 'Great Place', status: 'Ativo', observacao: null, ativo: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'l3', nome: 'CBO NITERÓI', nome_curto: 'CBO Niterói', status: 'Ativo', observacao: null, ativo: true, created_at: '2023-01-01T00:00:00Z' },
  { id: 'l4', nome: 'CARTÓRIO 3º OFÍCIO DE NOTAS', nome_curto: 'Cartório', status: 'Ativo', observacao: null, ativo: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'l5', nome: 'QUINTAS DE ICARAÍ', nome_curto: 'Quintas', status: 'Ativo', observacao: null, ativo: true, created_at: '2022-01-01T00:00:00Z' },
]

const mapeamentos = [
  { id: 'm1', tipo_match: 'dispositivo', valor_flit: 'ENSEADA', local_trabalho_id: 'l1', local_id: 'l1', prioridade: 1, ativo: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'm2', tipo_match: 'perimetro', valor_flit: 'CBO NITERÓI', local_trabalho_id: 'l3', local_id: 'l3', prioridade: 1, ativo: true, created_at: '2023-01-01T00:00:00Z' },
  { id: 'm3', tipo_match: 'turno_departamento', valor_flit: 'CBO -', local_trabalho_id: 'l3', local_id: 'l3', prioridade: 2, ativo: true, created_at: '2023-01-01T00:00:00Z' },
  { id: 'm4', tipo_match: 'turno_departamento', valor_flit: 'CARTÓRIO', local_trabalho_id: 'l4', local_id: 'l4', prioridade: 1, ativo: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'm5', tipo_match: 'departamento', valor_flit: 'GREAT', local_trabalho_id: 'l2', local_id: 'l2', prioridade: 1, ativo: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'm6', tipo_match: 'turno_departamento', valor_flit: 'QUINTAS', local_trabalho_id: 'l5', local_id: 'l5', prioridade: 1, ativo: true, created_at: '2022-01-01T00:00:00Z' },
]

function diaEscala(id, colabId, dia, localId, fonte, turno) {
  return {
    id, colaborador_id: colabId, data: dia,
    local_trabalho_id: localId, local_id: localId,
    fonte, status: localId ? 'identificado' : 'nao_identificado',
    usuario_confirmacao_id: fonte === 'manual' ? USER_ID : null,
    confirmado_em: fonte === 'manual' ? `${dia}T10:00:00Z` : null,
    observacao: null, importacao_ref: 'Marcacoes 01_07_2026.xlsx',
    turno, departamento_flit: 'PLENA EA FACILITIES',
    escala_flit: '12X36', dispositivo_flit: turno, perimetro_flit: null,
    created_at: `${dia}T07:00:00Z`,
  }
}
const escalaDiario = [
  diaEscala('es1', 'c1', '2026-08-20', 'l1', 'turno_departamento', 'ENSEADA 07H'),
  diaEscala('es2', 'c1', '2026-08-21', 'l1', 'manual', 'ENSEADA 07H'),
  diaEscala('es3', 'c2', '2026-08-20', 'l2', 'dispositivo', 'GREAT 08H'),
  diaEscala('es4', 'c3', '2026-08-20', 'l3', 'perimetro', 'CBO - 08H ÀS 17H'),
  diaEscala('es5', 'c4', '2026-08-20', null, 'importacao', 'ASG FRACIONADO 01'),
  diaEscala('es6', 'c4', '2026-08-21', 'l5', 'manual', 'QUINTAS 07H'),
]

const feriasPeriodos = [
  { id: 'fe1', colaborador_id: 'c1', periodo_aquisitivo_inicio: '2025-02-10', periodo_aquisitivo_fim: '2026-02-09', data_inicio: '2026-09-01', data_fim: '2026-09-30', dias: 30, status: 'Agendado', tipo: 'gozo', created_at: '2026-01-01T00:00:00Z' },
  { id: 'fe2', colaborador_id: 'c2', periodo_aquisitivo_inicio: '2024-05-01', periodo_aquisitivo_fim: '2025-04-30', data_inicio: '2026-08-10', data_fim: '2026-08-24', dias: 15, status: 'Gozo', tipo: 'gozo', created_at: '2026-01-01T00:00:00Z' },
  { id: 'fe3', colaborador_id: 'c3', periodo_aquisitivo_inicio: '2025-01-15', periodo_aquisitivo_fim: '2026-01-14', data_inicio: null, data_fim: null, dias: 30, status: 'Previsto', tipo: 'previsto', created_at: '2026-01-01T00:00:00Z' },
]

const contratosAdicionais = [
  { id: 'ct1', nome: 'Contrato Enseada Park', departamento_id: 'd1', quantidade_colaboradores: 4, regime_trabalho: '12x36', adicionais: { insalubridade: true, noturno: false, periculosidade: false, feriado: true, intrajornada: false }, dias_intrajornada: [], ativo: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'ct2', nome: 'Contrato CBO', departamento_id: 'd3', quantidade_colaboradores: 2, regime_trabalho: '5x2', adicionais: { insalubridade: false, noturno: true, periculosidade: true, feriado: false, intrajornada: true }, dias_intrajornada: [1, 3], ativo: true, created_at: '2023-01-01T00:00:00Z' },
]

const vinculosAdicionais = [
  { id: 'v1', colaborador_id: 'c1', contrato_id: 'ct1', escala: '12x36', data_inicio: '2026-01-01', data_fim: null, ativo: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'v2', colaborador_id: 'c3', contrato_id: 'ct2', escala: '5x2', data_inicio: '2026-01-01', data_fim: null, ativo: true, created_at: '2026-01-01T00:00:00Z' },
]

const calendarioAdicionais = [
  { id: 'cal1', colaborador_id: 'c1', data: '2026-08-01', tipo: 'trabalhado', substituto_id: null, origem: 'importacao', created_at: '2026-08-01T00:00:00Z' },
  { id: 'cal2', colaborador_id: 'c1', data: '2026-08-02', tipo: 'folga', substituto_id: null, origem: 'importacao', created_at: '2026-08-02T00:00:00Z' },
  { id: 'cal3', colaborador_id: 'c3', data: '2026-08-01', tipo: 'trabalhado', substituto_id: null, origem: 'importacao', created_at: '2026-08-01T00:00:00Z' },
]

const feriados = [
  { id: 'fh1', data: '2026-01-01', nome: 'Confraternização Universal', created_at: '2026-01-01T00:00:00Z' },
  { id: 'fh2', data: '2026-04-21', nome: 'Tiradentes', created_at: '2026-01-01T00:00:00Z' },
  { id: 'fh3', data: '2026-05-01', nome: 'Dia do Trabalho', created_at: '2026-01-01T00:00:00Z' },
  { id: 'fh4', data: '2026-09-07', nome: 'Independência do Brasil', created_at: '2026-01-01T00:00:00Z' },
  { id: 'fh5', data: '2026-12-25', nome: 'Natal', created_at: '2026-01-01T00:00:00Z' },
]

const vrProjetos = [
  { id: 'vr1', nome: 'VR Agosto/2026', mes_referencia: '2026-08-01', valor_diario: 35.0, status: 'Em andamento', created_at: '2026-08-01T00:00:00Z' },
  { id: 'vr2', nome: 'VR Julho/2026', mes_referencia: '2026-07-01', valor_diario: 35.0, status: 'Concluído', created_at: '2026-07-01T00:00:00Z' },
]

const perfis = [
  { id: USER_ID, email: 'demo@plenaservicos.com.br', nome: 'Usuário Demonstração', nivel_acesso: 'admin', empresa_id: null, consentimento_lgpd: true, consentimento_lgpd_data: '2026-01-01T00:00:00Z', consentimento_lgpd_versao: '1.0', consentimento_lgpd_finalidades: ['gestao_rh'], created_at: '2026-01-01T00:00:00Z' },
  { id: 'p2', email: 'gestor@plenaservicos.com.br', nome: 'Gestor Exemplo', nivel_acesso: 'gestor', empresa_id: 'e1', consentimento_lgpd: true, consentimento_lgpd_data: '2026-01-01T00:00:00Z', consentimento_lgpd_versao: '1.0', consentimento_lgpd_finalidades: ['gestao_rh'], created_at: '2026-01-02T00:00:00Z' },
  { id: 'p3', email: 'mesa@plenaservicos.com.br', nome: 'Mesa Operacional Exemplo', nivel_acesso: 'mesa', empresa_id: null, consentimento_lgpd: true, consentimento_lgpd_data: '2026-01-01T00:00:00Z', consentimento_lgpd_versao: '1.0', consentimento_lgpd_finalidades: ['gestao_rh'], created_at: '2026-01-03T00:00:00Z' },
  { id: 'p4', email: 'inspetor@plenaservicos.com.br', nome: 'Inspetor Exemplo', nivel_acesso: 'inspetoria', empresa_id: null, consentimento_lgpd: true, consentimento_lgpd_data: '2026-01-01T00:00:00Z', consentimento_lgpd_versao: '1.0', consentimento_lgpd_finalidades: ['gestao_rh'], created_at: '2026-01-04T00:00:00Z' },
]

const auditoria = [
  { id: 'a1', tabela: 'ocorrencias', acao: 'INSERT', registro_id: 'o1', usuario_email: 'demo@plenaservicos.com.br', created_at: '2026-08-01T10:00:00Z', dados_novos: { tipo: 'Advertência Verbal' }, dados_antigos: null },
  { id: 'a2', tabela: 'entregas', acao: 'UPDATE', registro_id: 'en1', usuario_email: 'gestor@plenaservicos.com.br', created_at: '2026-08-01T09:00:00Z', dados_novos: { status_recibo: 'Emitido' }, dados_antigos: { status_recibo: 'Pendente' } },
  { id: 'a3', tabela: 'extras', acao: 'INSERT', registro_id: 'x1', usuario_email: 'inspetor@plenaservicos.com.br', created_at: '2026-08-02T08:00:00Z', dados_novos: { valor: 130 }, dados_antigos: null },
  { id: 'a4', tabela: 'colaboradores', acao: 'UPDATE', registro_id: 'c5', usuario_email: 'demo@plenaservicos.com.br', created_at: '2026-07-30T14:00:00Z', dados_novos: { status: 'Afastado' }, dados_antigos: { status: 'Ativo' } },
]

const modelos = [
  { id: 'mo1', nome: 'Advertência por Atraso', tipo: 'Advertência Verbal', conteudo: 'Texto padrão de advertência...', ativo: true, created_at: '2022-01-01T00:00:00Z' },
  { id: 'mo2', nome: 'Advertência por Falta', tipo: 'Falta Injustificada', conteudo: 'Texto padrão...', ativo: true, created_at: '2022-01-01T00:00:00Z' },
]

const recibosExtras = [
  { id: 're1', numero: '2026-0001', colaborador_nome: 'João Roberto Amostra', extras_ids: ['x1'], valor_total: 130.0, status: 'Emitido', data_emissao: '2026-08-05T10:00:00Z', assinatura_base64: null, created_at: '2026-08-05T10:00:00Z' },
  { id: 're2', numero: '2026-0002', colaborador_nome: 'Ana Beatriz Fictícia', extras_ids: ['x3'], valor_total: 180.0, status: 'Pago', data_emissao: '2026-08-06T10:00:00Z', assinatura_base64: 'data:image/png;base64,xxx', created_at: '2026-08-06T10:00:00Z' },
]

const ceuTamanhos = [
  { id: 't1', colaborador_id: 'c1', camisa: 'M', calca: '40', calcado: '37', luva: 'M', created_at: '2026-01-01T00:00:00Z' },
  { id: 't2', colaborador_id: 'c2', camisa: 'G', calca: '44', calcado: '42', luva: 'G', created_at: '2026-01-01T00:00:00Z' },
  { id: 't3', colaborador_id: 'c4', camisa: 'GG', calca: '46', calcado: '43', luva: 'G', created_at: '2026-01-01T00:00:00Z' },
]

const pontoEspelhoArquivos = [
  { id: 'pa1', nome: 'CORH - Adicionais e Ocorrencias 07-2026.pdf', path: 'espelhos/2026-07.pdf', tamanho: 2450000, enviado_por: USER_ID, created_at: '2026-08-01T09:00:00Z' },
]
const escalaArquivos = [
  { id: 'ea1', nome: 'Marcacoes 01_07_2026 - 31_07_2026.xlsx', path: 'escalas/2026-07.xlsx', tamanho: 1850000, enviado_por: USER_ID, created_at: '2026-08-01T09:30:00Z' },
]

const feriasNotificacoes = [
  { id: 'fn1', colaborador_id: 'c1', tipo: 'vencimento_proximo', mensagem: 'Férias de Mariana vencem em 90 dias', lida: false, created_at: '2026-08-01T00:00:00Z' },
  { id: 'fn2', colaborador_id: 'c3', tipo: 'agendamento', mensagem: 'Férias de Ana precisam ser agendadas', lida: true, created_at: '2026-07-28T00:00:00Z' },
]

const DATA = {
  colaboradores, empresas, departamentos, ocorrencias,
  ceu_itens: itensCeu, itens: itensCeu, fornecedores, entregas,
  categorias_extras: categoriasExtras, extras,
  locais_trabalho: locais, mapeamento_flit_local_trabalho: mapeamentos, locais_trabalho_diario: escalaDiario,
  escala_locais: locais, escala_mapeamentos: mapeamentos, escala_diario: escalaDiario,
  ferias_periodos: feriasPeriodos, ferias_notificacoes: feriasNotificacoes,
  contratos_adicionais: contratosAdicionais, vinculos_adicionais: vinculosAdicionais,
  calendario_adicionais: calendarioAdicionais, feriados,
  vr_projetos: vrProjetos, perfis, auditoria, modelos_ocorrencia: modelos, modelos,
  recibos_extras: recibosExtras, ceu_tamanhos: ceuTamanhos,
  ponto_espelho_arquivos: pontoEspelhoArquivos, escala_arquivos: escalaArquivos,
  permissoes_perfil: [], configuracoes: [], alertas: [],
  vr_calculos: [], vr_arquivos: [], testemunhas: [],
  ocorrencia_anexos: [
    { id: 'an1', ocorrencia_id: 'o1', nome_arquivo: 'advertencia.pdf', tipo: 'comprobatorio', tamanho: 153600, created_at: '2026-07-15T11:00:00Z' },
    { id: 'an2', ocorrencia_id: 'o1', nome_arquivo: 'assinado.pdf', tipo: 'assinado', tamanho: 204800, created_at: '2026-07-16T11:00:00Z' },
  ],
  ocorrencia_testemunhas: [], defesas: [], ocorrencia_assinaturas: [],
}

// FKs possíveis para resolver embeds: tabelaEmbutida -> colunas FK candidatas
const FK_MAP = {
  colaboradores: ['colaborador_id', 'substituto_id', 'ausente_id'],
  empresas: ['empresa_id'],
  departamentos: ['departamento_id'],
  ceu_itens: ['item_id'],
  itens: ['item_id'],
  fornecedores: ['fornecedor_id'],
  escala_locais: ['local_id'],
  locais_trabalho: ['local_trabalho_id', 'local_id'],
  contratos_adicionais: ['contrato_id'],
  perfis: ['enviado_por', 'usuario_id'],
}

// ---------------------------------------------------------------- interceptor
function respondJson(request, status, body, extraHeaders = {}) {
  request.respond({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...extraHeaders },
    body: JSON.stringify(body),
  })
}

function aplicarFiltros(rows, url) {
  let out = rows
  for (const [key, value] of url.searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue
    if (key.includes('.')) continue // filtro de tabela embutida (ex.: colaborador.status) — ignora
    if (value.startsWith('eq.')) {
      const v = decodeURIComponent(value.slice(3))
      out = out.filter(r => String(r[key]) === v)
    } else if (value.startsWith('in.')) {
      const vals = value.slice(3).replace(/^\(|\)$/g, '').split(',').map(decodeURIComponent)
      out = out.filter(r => vals.includes(String(r[key])))
    } else if (value.startsWith('neq.') || value.startsWith('not.')) {
      // ignora para prints
    }
  }
  return out
}

// Alias de embed -> tabela (para embeds por coluna FK: colaborador:colaborador_id(...))
const ALIAS_TABLE = {
  colaborador: 'colaboradores', item: 'itens', local: 'escala_locais',
  local_trabalho: 'locais_trabalho',
  empresa: 'empresas', departamento: 'departamentos', fornecedor: 'fornecedores',
  contrato: 'contratos_adicionais', perfil: 'perfis',
}

function resolverEmbeds(row, selectParam) {
  if (!selectParam || !selectParam.includes('(')) return row
  const clone = { ...row }
  const re = /(\w+)(?:!(?:inner|left))?(?::([\w!]+)(?:![\w]+)?)?\(([^()]*)\)/g
  let m
  while ((m = re.exec(selectParam)) !== null) {
    const alias = m[1]
    const fonte = m[2] || m[1]
    const inner = m[3].trim()
    if (inner === 'count') {
      const tabelaCount = DATA[fonte] ? fonte : (ALIAS_TABLE[fonte] || fonte)
      const linhas = DATA[tabelaCount] || []
      const fk = (FK_MAP[tabelaCount] || [])[0] || `${tabelaCount.replace(/s$/, '')}_id`
      clone[alias] = [{ count: linhas.filter(r => r[fk] === row.id).length }]
      continue
    }
    let tabela = fonte
    let fkCol = null
    if (DATA[fonte]) {
      // fonte é o nome da tabela; FK resolvida pelo FK_MAP
    } else if (row[fonte] !== undefined) {
      // fonte é a coluna FK (ex.: colaborador:colaborador_id(...))
      fkCol = fonte
      tabela = ALIAS_TABLE[alias] || `${alias}s`
    } else {
      tabela = ALIAS_TABLE[fonte] || fonte
    }
    const dados = DATA[tabela] || []
    const candidatas = fkCol ? [fkCol] : (FK_MAP[tabela] || [`${tabela.replace(/s$/, '')}_id`])
    let valor = null
    for (const fk of candidatas) {
      if (row[fk] != null) {
        valor = dados.find(r => r.id === row[fk]) || null
        if (valor) break
      }
    }
    clone[alias] = valor
  }
  return clone
}

async function interceptar(request, log) {
  const url = new URL(request.url())
  const line = `${request.method()} ${url.pathname}${url.search}`
  if (!url.pathname.includes('/rest/v1/') && !url.pathname.includes('/auth/v1/') && !url.pathname.includes('/storage/v1/') && !url.pathname.includes('/functions/v1/')) {
    return request.continue()
  }

  // Preflight CORS: o navegador exige resposta válida antes do GET/POST real
  if (request.method() === 'OPTIONS') {
    return request.respond({
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'access-control-allow-headers': request.headers()['access-control-request-headers'] || '*',
        'access-control-max-age': '3600',
      },
      body: '',
    })
  }
  log(line)

  if (url.pathname.includes('/functions/v1/')) {
    // Edge Functions: resposta genérica "configurado" (nunca chama a função real)
    return respondJson(request, 200, { configurado: true })
  }
  if (url.pathname.includes('/auth/v1/')) {
    return respondJson(request, 200, url.pathname.endsWith('/user') ? FAKE_SESSION.user : {})
  }
  if (url.pathname.includes('/storage/v1/')) {
    return respondJson(request, 404, { message: 'not found (mock)' })
  }
  if (url.pathname.includes('/rest/v1/rpc/')) {
    const fn = url.pathname.split('/rest/v1/rpc/')[1]
    if (fn.includes('token')) return respondJson(request, 200, 'token-salvo-na-edge-function')
    return respondJson(request, 200, null)
  }

  const tabela = url.pathname.split('/rest/v1/')[1]?.split('?')[0]
  const rows = DATA[tabela] || []
  const selectParam = url.searchParams.get('select') || ''
  const filtradas = aplicarFiltros(rows, url).map(r => resolverEmbeds(r, selectParam))

  const aceitaObjeto = (request.headers()['accept'] || '').includes('vnd.pgrst.object+json')
  if (aceitaObjeto) {
    if (filtradas.length === 0) {
      return respondJson(request, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })
    }
    return respondJson(request, 200, filtradas[0])
  }
  return respondJson(request, 200, filtradas, {
    'content-range': `0-${Math.max(filtradas.length - 1, 0)}/${filtradas.length}`,
  })
}

// ---------------------------------------------------------------- rotas
const ROTAS = [
  ['dashboard', '/'],
  ['colaboradores', '/colaboradores'],
  ['colaborador-detalhe', '/rh/colaboradores/c1'],
  ['colaborador-form', '/rh/colaboradores/c1/editar'],
  ['departamentos', '/departamentos'],
  ['empresas', '/empresas'],
  ['importar-econtador', '/importar/econtador'],
  ['importar-rh', '/rh/importar'],
  ['ocorrencias', '/rh/ocorrencias'],
  ['ocorrencia-nova', '/rh/ocorrencias/novo'],
  ['ocorrencia-detalhe', '/rh/ocorrencias/o1'],
  ['modelos', '/rh/modelos'],
  ['alertas', '/rh/alertas'],
  ['ceu-itens', '/ceu/itens'],
  ['ceu-item-novo', '/ceu/itens/novo'],
  ['ceu-fornecedores', '/ceu/fornecedores'],
  ['ceu-movimentacoes', '/ceu/movimentacoes'],
  ['ceu-entrega-nova', '/ceu/movimentacoes/novo'],
  ['ceu-lancamento-rapido', '/ceu/lancamento-rapido'],
  ['ceu-tamanhos', '/ceu/tamanhos'],
  ['ceu-relatorios', '/ceu/relatorios'],
  ['ceu-importar', '/ceu/importar'],
  ['vr-projetos', '/vr/projetos'],
  ['vr-projeto-novo', '/vr/projetos/novo'],
  ['vr-projeto-detalhe', '/vr/projetos/vr1'],
  ['adicionais-contratos', '/adicionais/contratos'],
  ['adicionais-vinculos', '/adicionais/vinculos'],
  ['adicionais-calendario', '/adicionais/calendario'],
  ['adicionais-feriados', '/adicionais/feriados'],
  ['adicionais-relatorio', '/adicionais/relatorio'],
  ['adicionais-importar-ponto', '/adicionais/importar-ponto'],
  ['extras-lancamentos', '/extras/lancamentos'],
  ['extras-novo', '/extras/novo'],
  ['extras-balanco', '/extras/balanco'],
  ['extras-relatorio', '/extras/relatorio'],
  ['extras-recibos', '/extras/recibos'],
  ['extras-categorias', '/extras/categorias'],
  ['extras-plantao', '/extras/mobile'],
  ['escalas', '/escalas'],
  ['escalas-importar', '/escalas/importar'],
  ['escalas-locais', '/escalas/locais'],
  ['escalas-mapeamento', '/escalas/mapeamento'],
  ['ferias', '/ferias'],
  ['ferias-importar', '/ferias/importar'],
  ['ferias-notificacoes', '/ferias/notificacoes'],
  ['configuracoes', '/configuracoes'],
  ['auditoria', '/auditoria'],
  ['permissoes', '/permissoes'],
  ['relatorios', '/relatorios'],
]

const ROTAS_MOBILE = [
  ['mobile-falta', '/mobile/falta'],
]

// ---------------------------------------------------------------- main
async function main() {
  const filtro = process.argv.slice(2)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const logStream = fs.createWriteStream(LOG_FILE)
  const log = l => logStream.write(l + '\n')

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  const erros = []

  // 1) Tela de login (sem sessão)
  {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
    page.on('pageerror', e => erros.push(`login: ${e.message}`))
    await page.goto(BASE_URL + '/', { waitUntil: 'load', timeout: 60000 })
    await new Promise(r => setTimeout(r, 3000))
    await page.screenshot({ path: path.join(OUT_DIR, 'login.png') })
    await page.close()
    console.log('ok login')
  }

  // 2) Telas autenticadas (desktop)
  const rotasAlvo = ROTAS.filter(([nome]) => filtro.length === 0 || filtro.includes(nome))
  if (rotasAlvo.length > 0) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
    await page.setRequestInterception(true)
    page.on('request', req => interceptar(req, log).catch(() => req.continue().catch(() => {})))
    let rotaAtual = 'boot'
    page.on('pageerror', e => erros.push(`${rotaAtual}: ${e.message}`))
    await page.evaluateOnNewDocument((key, session) => {
      window.localStorage.setItem(key, JSON.stringify(session))
    }, STORAGE_KEY, FAKE_SESSION)

    for (const [nome, caminho] of rotasAlvo) {
      rotaAtual = nome
      try {
        await page.goto(BASE_URL + caminho, { waitUntil: 'load', timeout: 60000 })
        await new Promise(r => setTimeout(r, 2600))
        await page.screenshot({ path: path.join(OUT_DIR, `${nome}.png`) })
        console.log('ok', nome)
      } catch (e) {
        erros.push(`${nome}: navegacao falhou: ${e.message}`)
        console.log('FALHOU', nome)
      }
    }
    await page.close()
  }

  // 3) Tela mobile
  const rotasMobileAlvo = ROTAS_MOBILE.filter(([nome]) => filtro.length === 0 || filtro.includes(nome))
  if (rotasMobileAlvo.length > 0) {
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await page.setRequestInterception(true)
    page.on('request', req => interceptar(req, log).catch(() => req.continue().catch(() => {})))
    page.on('pageerror', e => erros.push(`mobile: ${e.message}`))
    await page.evaluateOnNewDocument((key, session) => {
      window.localStorage.setItem(key, JSON.stringify(session))
    }, STORAGE_KEY, FAKE_SESSION)
    for (const [nome, caminho] of rotasMobileAlvo) {
      try {
        await page.goto(BASE_URL + caminho, { waitUntil: 'load', timeout: 60000 })
        await new Promise(r => setTimeout(r, 2600))
        await page.screenshot({ path: path.join(OUT_DIR, `${nome}.png`) })
        console.log('ok', nome)
      } catch (e) {
        erros.push(`${nome}: navegacao falhou: ${e.message}`)
      }
    }
    await page.close()
  }

  await browser.close()
  logStream.end()

  if (erros.length > 0) {
    fs.writeFileSync(path.join(__dirname, 'erros.log'), erros.join('\n'))
    console.log(`\n${erros.length} erro(s) de página — ver erros.log`)
  }
  console.log('Pronto. Prints em', OUT_DIR)
}

main().catch(e => { console.error(e); process.exit(1) })
