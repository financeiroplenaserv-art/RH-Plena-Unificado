// Tipos do módulo BI PerformanceLab (tabelas bi_* — migration 102).
// As colunas de data são timestamptz e chegam como ISO 8601
// (ex.: "2026-08-19T13:00:00+00:00"); datas inválidas vêm como null.

export interface BiChecklist {
  id: number
  numero: number | null
  ano: number | null
  checklist_id: number | null
  checklist_nome: string | null
  local_id: number | null
  site_nome: string | null
  responsavel_id: number | null
  responsavel_nome: string | null
  data_planejada: string | null
  data_inicio: string | null
  data_termino: string | null
  conclusao_nome: string | null
  url: string | null
}

export interface BiQa {
  grupo_perguntas: string | null
  pergunta: string | null
  respostas: string | null
  observacoes: string | null
}

/** Mapa id_pergunta -> resposta, como gravado no jsonb `qas` */
export type BiQas = Record<string, BiQa>

export interface BiChecklistQa {
  /** Mesmo id do checklist respondido */
  id: number
  qas: BiQas | null
}

export interface BiColeta {
  id: number
  local_id: number | null
  funcionario: string | null
  usuario_id: number | null
  data_local: string | null
  data_termino: string | null
  area: string | null
  site_nome: string | null
  site_cidade: string | null
  site_uf: string | null
  motivo_visita: string | null
  observacao: string | null
  tipo_coleta: string | null
  tempo_minutos: number | null
}

export interface BiEvento {
  id: number
  numero: number | null
  ano: number | null
  local_id: number | null
  evento_id: number | null
  evento_nome: string | null
  subtipo_nome: string | null
  site_nome: string | null
  site_cidade: string | null
  site_uf: string | null
  /** Quem abriu o evento */
  usuario_nome: string | null
  /** Responsável atual (quem está tratando) */
  usuario_ultimo_nome: string | null
  data_evento: string | null
  data_finalizacao: string | null
  status_texto: string | null
  /** SLA oficial do PerformanceLab: 'DENTRO' | 'FORA' */
  sla: string | null
  observacao: string | null
  acoes_realizadas: string | null
  acoes_realizadas_finalizacao: string | null
}

export interface BiAnalise {
  id: number
  evento_id: number | null
  responsavel_nome: string | null
  tipo_analise_nome: string | null
  descricao: string | null
  data_analise: string | null
}

/** Registro de uma execução do sync (tabela bi_sync_log — migration 103) */
export interface BiSyncLog {
  id: number
  executado_em: string
  ok: boolean
  locais: number | null
  checklists: number | null
  coletas: number | null
  eventos: number | null
  analises: number | null
  erro: string | null
}
