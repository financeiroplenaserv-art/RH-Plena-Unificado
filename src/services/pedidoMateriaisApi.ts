import { supabase } from '@/lib/supabase'
import type {
  DestinoFilaPublico,
  ItemCeuPublico,
  ItemPublico,
  JanelaPublica,
  KitPublico,
  ResumoMes,
} from '@/lib/materiais/pedidoLider'

// Cliente da Edge Function pedido-materiais (docs/PLANO_MATERIAIS_FASE1.md §4).
// A tela pública (/pedido/:token) usa SÓ fetch — nunca o cliente Supabase
// autenticado. As ações de link (gerar/ver/revogar) mandam o JWT da sessão;
// a function confere o perfil (admin/adm/gestor).

const TIMEOUT_MS = 30_000

export type CodigoErroPedido =
  | 'token_invalido'
  | 'fora_janela'
  | 'limite'
  | 'validacao'
  | 'sem_link'
  | 'sem_permissao'
  | 'nao_autorizado'
  | 'requisicao'
  | 'interno'
  | 'rede'

export class ErroPedidoApi extends Error {
  codigo: CodigoErroPedido
  status: number
  detalhes: string[]
  constructor(message: string, codigo: CodigoErroPedido, status: number, detalhes: string[] = []) {
    super(message)
    this.name = 'ErroPedidoApi'
    this.codigo = codigo
    this.status = status
    this.detalhes = detalhes
  }
}

export interface DadosPedidoPublico {
  contrato: { nome: string; recebe_limpeza: boolean }
  hoje: string
  janela: JanelaPublica
  catalogo: ItemPublico[]
  kit: KitPublico[]
  itens_ceu: ItemCeuPublico[]
  ultimas_entregas: Record<string, string>
  resumo: ResumoMes
  destino: { produtos: DestinoFilaPublico; ceu: DestinoFilaPublico }
}

export interface ResultadoEnvioPedido {
  ok: boolean
  protocolo: string
  mesclado_produtos: boolean
  mesclado_ceu: boolean
  virou_extra_produtos: boolean
  virou_extra_ceu: boolean
}

export interface LinkPedido {
  token: string
  versao: number
  gerado_em: string
}

async function chamar<T>(corpo: Record<string, unknown>, jwt?: string): Promise<T> {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (!url) throw new ErroPedidoApi('VITE_SUPABASE_URL não configurada', 'interno', 0)
  const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (chave) headers.apikey = chave
  if (jwt) headers.Authorization = `Bearer ${jwt}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let resposta: Response
  try {
    resposta = await fetch(`${url}/functions/v1/pedido-materiais`, {
      method: 'POST',
      headers,
      body: JSON.stringify(corpo),
      signal: controller.signal,
      referrerPolicy: 'no-referrer',
    })
  } catch {
    throw new ErroPedidoApi('Sem conexão com o servidor. Confira a internet e tente de novo.', 'rede', 0)
  } finally {
    clearTimeout(timeout)
  }
  const dados = (await resposta.json().catch(() => ({}))) as Record<string, unknown>
  if (!resposta.ok) {
    throw new ErroPedidoApi(
      typeof dados.error === 'string' ? dados.error : 'Erro ao falar com o servidor',
      (dados.codigo as CodigoErroPedido) || 'interno',
      resposta.status,
      Array.isArray(dados.detalhes) ? (dados.detalhes as string[]) : []
    )
  }
  return dados as T
}

export function carregarPedidoPublico(token: string): Promise<DadosPedidoPublico> {
  return chamar({ acao: 'carregar', token })
}

export function enviarPedidoPublico(token: string, pedido: Record<string, unknown>): Promise<ResultadoEnvioPedido> {
  return chamar({ acao: 'enviar', token, pedido })
}

async function jwtDaSessao(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new ErroPedidoApi('Usuário não autenticado', 'nao_autorizado', 401)
  return data.session.access_token
}

/** Gera um link novo (o anterior deixa de valer na hora). */
export async function gerarLinkPedido(contratoId: string): Promise<LinkPedido> {
  return chamar({ acao: 'gerar_link', contrato_id: contratoId }, await jwtDaSessao())
}

/** Reexibe o link ativo (token decifrado no servidor) para reimprimir o QR. */
export async function verLinkPedido(contratoId: string): Promise<LinkPedido> {
  return chamar({ acao: 'ver_link', contrato_id: contratoId }, await jwtDaSessao())
}

export async function revogarLinkPedido(contratoId: string): Promise<void> {
  await chamar({ acao: 'revogar_link', contrato_id: contratoId }, await jwtDaSessao())
}

/** URL pública do pedido (vai no QR code). */
export function urlPedido(token: string, origem: string = window.location.origin): string {
  return `${origem.replace(/\/$/, '')}/pedido/${token}`
}
