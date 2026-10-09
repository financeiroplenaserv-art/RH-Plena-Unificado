// Tipos do módulo Materiais (migrations 121 a 123 — docs/PLANO_MATERIAIS_FASE1.md)

export type CategoriaMaterial = 'limpeza' | 'portaria' | 'outros'
export type RotaMaterial = 1 | 2 | 3

export interface MatItem {
  id: string
  nome: string
  categoria: CategoriaMaterial
  unidade_pedido: string
  fornecedor_id: string | null
  validade_meses: number | null
  tem_variacao: boolean
  ativo: boolean
  ordem: number | null
  created_at?: string
}

export interface MatItemVariacao {
  id: string
  item_id: string
  rotulo: string
  ativo: boolean
  ordem: number | null
  created_at?: string
}

/** Histórico de preços: nunca se altera o valor, entra uma linha nova. */
export interface MatPreco {
  id: string
  item_id: string
  variacao_id: string | null
  fornecedor_id: string | null
  preco: number
  vigente_desde: string
  criado_por?: string | null
  created_at?: string
}

export interface MatAlias {
  id: string
  nome_legado: string
  item_id: string
  variacao_id: string | null
  fator: number
  created_at?: string
}

/** Contrato de pedido (≠ departamento: um departamento pode ter vários). */
export interface MatContrato {
  id: string
  departamento_id: string
  nome: string
  rota: RotaMaterial | null
  recebe_limpeza: boolean
  ativo: boolean
  observacao: string | null
  created_at?: string
}

/** Segredo do link — só a Edge Function (service_role) acessa. */
export interface MatContratoAcesso {
  contrato_id: string
  token_hash: string
  token_cifrado: string | null
  versao: number
  gerado_em: string
  gerado_por: string | null
  ativo: boolean
}

/** Retorno da RPC mat_status_links (nunca traz token nem hash). */
export interface MatStatusLink {
  contrato_id: string
  gerado_em: string
  gerado_por: string | null
  versao: number
  ativo: boolean
}

export type EventoAcessoMaterial = 'carregar' | 'envio' | 'envio_recusado' | 'limite_ip' | 'link_gerado'

export interface MatAcessoLog {
  id: string
  contrato_id: string | null
  evento: EventoAcessoMaterial
  ip: string | null
  user_agent: string | null
  created_at: string
}

export interface MatKitItem {
  id: string
  contrato_id: string
  item_id: string
  variacao_id: string | null
  quantidade: number
  periodicidade_meses: number
  observacao: string | null
  atualizado_por?: string | null
  updated_at?: string
}

export type StatusAlteracaoKit = 'pendente' | 'aprovada' | 'rejeitada'

export interface MatKitAlteracao {
  id: string
  contrato_id: string
  item_id: string
  variacao_id: string | null
  quantidade_nova: number
  motivo: string
  solicitado_por?: string | null
  solicitado_em?: string
  status: StatusAlteracaoKit
  decidido_por: string | null
  decidido_em: string | null
  comentario_decisao: string | null
}

export interface MatHistoricoConsumo {
  id: string
  contrato_id: string
  item_id: string
  variacao_id: string | null
  /** 1º dia do mês */
  competencia: string
  quantidade: number
  valor: number | null
  nome_legado: string | null
  fonte: string
}

export type TipoPedidoMaterial = 'mensal' | 'extra'
export type OrigemPedidoMaterial = 'lider' | 'escritorio' | 'operacional'

export type StatusProdutos =
  | 'nao_se_aplica'
  | 'rascunho'
  | 'enviado'
  | 'em_validacao'
  | 'validado'
  | 'aprovado'
  | 'cancelado'

export type StatusCeuPedido =
  | 'nao_se_aplica'
  | 'enviado'
  | 'em_identificacao'
  | 'conferido'
  | 'em_atendimento'
  | 'atendido'
  | 'cancelado'

export interface MatPedido {
  id: string
  contrato_id: string
  /** 1º dia do mês */
  competencia: string
  tipo: TipoPedidoMaterial
  origem: OrigemPedidoMaterial
  preenchido_pelo_escritorio: boolean
  rota_override: RotaMaterial | null
  rota_override_motivo: string | null
  rota_override_por: string | null
  responsavel_nome: string | null
  observacao: string | null
  termos_aceitos: Record<string, boolean> | null
  status_produtos: StatusProdutos
  status_ceu: StatusCeuPedido
  enviado_em: string | null
  reaberto_por: string | null
  reaberto_em: string | null
  criado_por: string | null
  created_at?: string
}

export interface MatPedidoEnvio {
  id: string
  pedido_id: string
  sequencia: number
  origem: 'original' | 'complemento'
  seu_nome: string
  enviado_em: string
  ip: string | null
  user_agent: string | null
}

export interface MatPedidoItem {
  id: string
  pedido_id: string
  envio_id: string | null
  possivel_repeticao: boolean
  repete_linha_id: string | null
  decisao_repeticao: 'somar' | 'descartar' | null
  item_id: string | null
  variacao_id: string | null
  descricao_livre: string | null
  qtd_kit: number | null
  qtd_pedida: number
  qtd_validada: number | null
  qtd_aprovada: number | null
  qtd_entregue: number | null
  preco_unitario: number | null
  justificativa: string | null
  excecao_acima_kit: boolean
  excecao_validade: boolean
  excecao_fora_kit: boolean
  ultima_entrega_em: string | null
  motivo_ajuste: string | null
  ajustado_por: string | null
  ajustado_em: string | null
  created_at?: string
}

export type TipoLinhaCeuPedido = 'uniforme' | 'epi' | 'cracha'
export type StatusLinhaCeuPedido =
  | 'a_identificar'
  | 'pendente'
  | 'conferido'
  | 'ajustado'
  | 'atendido'
  | 'cancelado'

export interface CeuPedidoItem {
  id: string
  pedido_id: string
  envio_id: string | null
  possivel_repeticao: boolean
  nome_digitado: string
  colaborador_id: string | null
  identificado_por: string | null
  identificado_em: string | null
  fora_da_equipe: boolean
  tipo: TipoLinhaCeuPedido
  item_id: string | null
  tamanho: string | null
  tamanho_cadastro: string | null
  qtd_pedida: number
  qtd_conferida: number | null
  alerta_tamanho: boolean
  ultima_entrega_em: string | null
  cracha_nome: string | null
  cracha_motivo: string | null
  cracha_cordao: boolean | null
  status: StatusLinhaCeuPedido
  conferido_por: string | null
  conferido_em: string | null
  atendido_por: string | null
  atendido_em: string | null
  motivo_ajuste: string | null
  created_at?: string
}

export interface MatComentario {
  id: string
  pedido_id: string
  linha_tabela: 'mat_pedido_itens' | 'ceu_pedido_itens' | null
  linha_id: string | null
  autor_id: string
  autor_nome: string | null
  texto: string
  created_at: string
}

export interface MatReabertura {
  id: string
  contrato_id: string
  competencia: string
  ate: string
  motivo: string
  reaberto_por?: string | null
  reaberto_em?: string
}

/** Configuração em `configuracoes` (chave `materiais_config`). */
export interface MateriaisConfig {
  dia_limite: number
  dia_aviso: number
  aviso_recibo: string
}
