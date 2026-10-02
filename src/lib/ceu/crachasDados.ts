import { supabase } from '@/lib/supabase'
import { getSignedUrl } from '@/lib/storage'
import { safeJsonParse } from '@/lib/utils'
import {
  CONFIG_CRACHA_PADRAO,
  normalizarConfigCracha,
  type ConfigCracha,
} from './crachas'
import { dataUrlParaBlob, lerArquivoComoDataUrl } from './crachasImagem'

/** Bucket privado das fotos 3x4 (migration 117). Leitura só por URL assinada. */
export const BUCKET_FOTOS = 'colaborador-fotos'

const CHAVE_CONFIG = 'cracha_config'

/** Caminho fixo da foto de um colaborador (reenvio sobrescreve — upsert). */
export function caminhoFoto(colaboradorId: string): string {
  return `${colaboradorId}.jpg`
}

// ----------------------------------------------------------------
// Configuração (logos por empresa) — configuracoes.cracha_config
// ----------------------------------------------------------------

export async function carregarConfigCracha(): Promise<ConfigCracha> {
  const { data, error } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', CHAVE_CONFIG)
    .maybeSingle()
  if (error) throw new Error('Erro ao carregar o logo dos crachás: ' + error.message)
  if (!data?.valor) return CONFIG_CRACHA_PADRAO
  const bruto = typeof data.valor === 'string' ? safeJsonParse<unknown>(data.valor, null) : data.valor
  return normalizarConfigCracha(bruto)
}

/** Grava o logo por empresa. Só editores (RLS de configuracoes): confere linhas afetadas. */
export async function salvarConfigCracha(config: ConfigCracha): Promise<void> {
  const { data, error } = await supabase
    .from('configuracoes')
    .upsert(
      {
        chave: CHAVE_CONFIG,
        valor: JSON.stringify(config),
        descricao: 'Logo por empresa usado na emissão de crachás (data URL PNG por empresa_id)',
      },
      { onConflict: 'chave' }
    )
    .select('chave')
  if (error) throw new Error('Erro ao salvar o logo: ' + error.message)
  if (!data || data.length === 0) throw new Error('Sem permissão para salvar o logo (perfil sem edição)')
}

// ----------------------------------------------------------------
// RPC salvar_dados_cracha — única via de escrita do dp3 (só nome_cracha/cargo_cracha/foto_path)
// ----------------------------------------------------------------

export interface PayloadSalvarDadosCracha {
  p_colaborador_id: string
  p_nome_cracha?: string | null
  p_foto_path?: string | null
  p_atualizar_nome?: boolean
  p_atualizar_foto?: boolean
  p_cargo_cracha?: string | null
  p_atualizar_cargo?: boolean
}

/** Chama a RPC e exige retorno true (colaborador encontrado) — nunca finge sucesso. */
export async function salvarDadosCracha(payload: PayloadSalvarDadosCracha): Promise<void> {
  const { data, error } = await supabase.rpc('salvar_dados_cracha', payload)
  if (error) throw new Error(error.message)
  if (data !== true) throw new Error('Colaborador não encontrado ou sem alteração para salvar')
}

// ----------------------------------------------------------------
// Fotos
// ----------------------------------------------------------------

/** Envia a foto já reduzida (data URL JPEG) e grava o caminho no cadastro via RPC. Devolve o path. */
export async function enviarFotoColaborador(colaboradorId: string, fotoDataUrl: string): Promise<string> {
  const path = caminhoFoto(colaboradorId)
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(path, dataUrlParaBlob(fotoDataUrl), { upsert: true, contentType: 'image/jpeg' })
  if (error) throw new Error('Erro ao enviar a foto: ' + error.message)

  await salvarDadosCracha({
    p_colaborador_id: colaboradorId,
    p_foto_path: path,
    p_atualizar_foto: true,
  })
  return path
}

/** Remove a foto do cadastro (limpa o caminho; o arquivo só pode ser apagado por admin e fica inócuo no bucket privado). */
export async function removerFotoColaborador(colaboradorId: string): Promise<void> {
  await salvarDadosCracha({
    p_colaborador_id: colaboradorId,
    p_foto_path: null,
    p_atualizar_foto: true,
  })
}

/** Baixa a foto pela URL assinada e devolve como data URL (a folha não depende de rede nem de expiração). */
export async function carregarFotoDataUrl(path: string): Promise<string | null> {
  try {
    const url = await getSignedUrl(BUCKET_FOTOS, path, 60 * 5)
    const resposta = await fetch(url)
    if (!resposta.ok) return null
    return await lerArquivoComoDataUrl(await resposta.blob())
  } catch (err) {
    console.error('Erro ao carregar foto do crachá:', err)
    return null
  }
}
