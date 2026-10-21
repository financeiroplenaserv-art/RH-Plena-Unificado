// Tipos do módulo Materiais (migrations 121 a 123 — docs/PLANO_MATERIAIS_FASE1.md)

export type CategoriaMaterial = 'limpeza' | 'portaria' | 'descartaveis' | 'acessorios' | 'piscina'
/** Rota de entrega (dia de entrega). 4 rotas desde a migration 145 (17/10/2026) — a 4 é só CBO MACAÉ. */
export type RotaMaterial = 1 | 2 | 3 | 4

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
  /** Migration 128: item que substituiu este em todos os kits (a média dele soma o histórico deste). */
  substituido_por_id?: string | null
  substituido_por_variacao_id?: string | null
  substituido_em?: string | null
  /** Migration 136: nome no link do líder (NULL = nome do cadastro sem a unidade). */
  nome_lider?: string | null
  /** Migration 136: contratos de pedido (mat_contratos) que podem pedir pelo link. NULL/vazio = todos. */
  contratos_exclusivos?: string[] | null
  /** Migration 137: contratos para os quais o item fica ESCONDIDO no link (ex.: esponja dupla face na CNOOC). */
  contratos_ocultos?: string[] | null
  /** Migration 146: item preparado no escritório (nunca vai ao fornecedor). */
  preparo_escritorio?: boolean
  /** Migration 152: como o fornecedor vende (kit, caixa, bombona 5L). NULL com fator 1 = na unidade do pedido. */
  unidade_compra?: string | null
  /** Migration 152: unidades do pedido que vêm na unidade de compra (padrão 1). A compra arredonda para cima. */
  fator_compra?: number
  /** Migration 152: o fornecedor entrega no escritório e a mesa separa para os postos (ex.: Lustro). */
  fracionado_escritorio?: boolean
}

export interface MatItemVariacao {
  id: string
  item_id: string
  rotulo: string
  ativo: boolean
  ordem: number | null
  created_at?: string
  /** Migration 128: item que substituiu SÓ esta variação. */
  substituido_por_id?: string | null
  substituido_por_variacao_id?: string | null
  substituido_em?: string | null
  /** Migration 136: variação escondida no link do líder (é marca; a compra decide). */
  oculta_lider?: boolean
}

/** Retorno da RPC mat_substituir_item_kits (migration 128). */
export interface ResultadoSubstituicaoItem {
  contratos: number
  linhas_trocadas: number
  linhas_somadas: number
  contratos_com_soma: number
  alteracoes_pendentes: number
  inativado: boolean
  historico_vinculado: boolean
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
  /** Departamentos cuja equipe também entra no link do líder (migration 129; caso Telex × DuoConnect). */
  departamentos_equipe_extra?: string[]
  /** Migration 138: limite mensal em R$ definido pelo gestor. NULL = calculado pelo kit. */
  limite_mensal?: number | null
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

/** Peça de uniforme/EPI do contrato (migration 129) — uma linha por peça, apontando para um item de qualquer tamanho. */
export interface MatContratoCeuItem {
  id: string
  contrato_id: string
  item_id: string
  rotulo: string | null
  funcoes: string[]
  ordem: number | null
  ativo: boolean
  origem: 'form' | 'ceu' | 'form_ceu' | 'manual'
  observacao: string | null
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
  // Fase 2 (migration 147): depois da compra enviada
  | 'em_compra'
  | 'entregue'
  | 'entregue_parcial'

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
  /** Migration 140: o posto respondeu pelo link que não precisa de nada este mês (envio vazio). */
  sem_necessidade?: boolean
  /**
   * Migration 151: pedido extra de IMPLANTAÇÃO de contrato (enxoval inicial do
   * posto que vai começar). Fluxo normal; fora da média de consumo e do limite.
   */
  implantacao?: boolean
  /** Data prevista de início do contrato (opcional). */
  implantacao_inicio?: string | null
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
  /**
   * Migration 135 (16/10/2026): 'kit' = Kit Mensal confirmado pelo líder (o
   * que o posto vai receber); 'extra' = além do kit. Opcional para funcionar
   * antes da migration (ausente = tratado como extra).
   */
  parte?: 'kit' | 'extra'
  /** Linha do kit aprovada na gravação (materiais_config.kit_aprovacao_automatica). */
  aprovado_automatico?: boolean
  /** Item pedido originalmente, quando o inspetor/gestor trocou o item da linha do kit. */
  item_original_id?: string | null
  variacao_original_id?: string | null
  /** Migration 139: linha incluída pelo escritório no pedido do líder (quem/quando). */
  incluido_por?: string | null
  incluido_em?: string | null
  /** Migration 139: texto livre ligado ao catálogo (descricao_livre guarda o texto original). */
  ligado_por?: string | null
  ligado_em?: string | null
  // ---- Fase 2 (migration 147): destino na compra e entrega. Opcionais: lidos à parte,
  // de forma tolerante, para a tela funcionar antes da migration.
  atendimento?: AtendimentoLinha | null
  qtd_estoque?: number | null
  qtd_compra?: number | null
  compra_item_id?: string | null
  motivo_nao_atendido?: string | null
  qtd_entregue_estoque?: number | null
  qtd_recebida_fornecedor?: number | null
  motivo_entrega?: string | null
  entregue_em?: string | null
  // ---- Migration 151: parte levada de OUTRO posto (posto → posto, sem estoque nem compra).
  qtd_remanejada?: number | null
  remanejado_de_contrato_id?: string | null
  remanejamento_obs?: string | null
  /** Confirmada como levada ("remanejamento feito", tela Chegadas). */
  qtd_entregue_remanejada?: number | null
  remanejado_confirmado_em?: string | null
}

/** Destino da linha aprovada na compra (migration 147; 'remanejado' desde a 151). */
export type AtendimentoLinha = 'fornecedor' | 'estoque' | 'escritorio' | 'nao_atendido' | 'remanejado'

export type TipoCompraMaterial = 'mensal' | 'avulsa' | 'reposicao_estoque'
export type StatusCompraMaterial = 'rascunho' | 'enviada' | 'recebida_parcial' | 'recebida' | 'cancelada'

/** Pedido a um fornecedor ("o Excel que vai para a Antolimp") — migration 147. */
export interface MatCompra {
  id: string
  competencia: string
  fornecedor_id: string
  numero: string
  tipo: TipoCompraMaterial
  status: StatusCompraMaterial
  antes_da_janela: boolean
  data_corte: string
  entrega_prevista: string | null
  enviada_em: string | null
  enviada_por: string | null
  cancelada_em: string | null
  cancelada_motivo: string | null
  observacao: string | null
  criado_por: string | null
  created_at: string
  /** Migration 150: gerações (lote_compra) de que a compra participou. */
  lotes?: string[]
}

/** Célula da compra: item × variação × contrato (NULL = reposição do estoque). Snapshots de nome/rota. */
export interface MatCompraItem {
  id: string
  compra_id: string
  item_id: string
  variacao_id: string | null
  contrato_id: string | null
  item_nome: string
  variacao_rotulo: string | null
  unidade: string | null
  categoria: string | null
  contrato_nome: string | null
  rota: RotaMaterial | null
  quantidade: number
  preco_unitario: number | null
  qtd_recebida: number | null
  motivo_recebimento: string | null
  recebido_em: string | null
  entrega_local: 'posto' | 'escritorio'
  /** Migration 152 (snapshot): unidade e fator de compra do item na geração. */
  unidade_compra?: string | null
  fator_compra?: number
  /** Migration 152: na célula de estoque, parte que é sobra do arredondamento ao múltiplo. */
  qtd_arredondamento?: number
  /** Migration 152: na célula de estoque, parte que é a necessidade dos postos de item fracionado. */
  qtd_fracionar?: number
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
  /** Migration 124: quanto a Beth entregou e por que menos que o conferido. */
  qtd_atendida?: number | null
  motivo_atendimento?: string | null
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
  /**
   * Linhas do kit confirmadas pelo líder saem aprovadas (só os extras passam
   * pelo inspetor e pelo gestor). Padrão: ligada (decisão de 16/10/2026,
   * migration 135).
   */
  kit_aprovacao_automatica: boolean
  /** Fase 2 (calendário — avisos, não travas): inspetor até 17, gestor até 20, compra 20 a 25. */
  dia_limite_validacao?: number
  dia_limite_aprovacao?: number
  dia_inicio_compra?: number
  dia_fim_compra?: number
}
