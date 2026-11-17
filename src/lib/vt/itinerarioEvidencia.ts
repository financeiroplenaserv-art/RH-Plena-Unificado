import type { AlternativaRotaGoogleVT } from '@/lib/vt/googleRoutes'
import { jsonCanonico, sha256Hex } from '@/lib/vt/loteConteudo'
import type { VtItinerario } from '@/types/vt'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface EscolhaItinerarioVT {
  decisaoId: string
  colaboradorId: string
  departamentoId: string
  usuarioId: string
  alternativa: AlternativaRotaGoogleVT
  cotacaoId?: string | null
}

export type NovaEvidenciaItinerario = Omit<VtItinerario, 'id' | 'created_at'>

function uuidObrigatorio(valor: string, campo: string): string {
  if (!UUID.test(valor)) throw new Error(`${campo} precisa ser um UUID do banco.`)
  return valor
}

export async function prepararEvidenciaItinerario(
  entrada: EscolhaItinerarioVT,
): Promise<NovaEvidenciaItinerario> {
  const colaboradorId = uuidObrigatorio(entrada.colaboradorId, 'colaboradorId')
  const departamentoId = uuidObrigatorio(entrada.departamentoId, 'departamentoId')
  uuidObrigatorio(entrada.decisaoId, 'decisaoId')
  const usuarioId = uuidObrigatorio(entrada.usuarioId, 'usuarioId')
  if (!entrada.alternativa.id.trim()) throw new Error('A alternativa escolhida precisa ter um identificador.')
  if (entrada.alternativa.itinerario.pernas.length === 0) {
    throw new Error('Não é possível gravar um itinerário sem conduções.')
  }

  const itinerarioBase = {
    ...entrada.alternativa.itinerario,
    pernas: entrada.alternativa.itinerario.pernas.map((perna) => ({ ...perna })),
    evidenciaHash: null,
  }
  const evidenciaHash = await sha256Hex(jsonCanonico({
    colaboradorId,
    departamentoId,
    alternativaId: entrada.alternativa.id,
    itinerario: itinerarioBase,
    distanciaMetros: entrada.alternativa.distanciaMetros,
    duracaoSegundos: entrada.alternativa.duracaoSegundos,
  }))

  return {
    colaborador_id: colaboradorId,
    departamento_id: departamentoId,
    provedor: itinerarioBase.provedor,
    alternativa_id: entrada.alternativa.id,
    itinerario: { ...itinerarioBase, evidenciaHash },
    distancia_metros: entrada.alternativa.distanciaMetros,
    duracao_segundos: entrada.alternativa.duracaoSegundos,
    consultado_em: itinerarioBase.consultadoEm,
    evidencia_hash: evidenciaHash,
    chave_idempotencia: `${colaboradorId}:${departamentoId}:${entrada.alternativa.id}:${evidenciaHash}`,
    created_by: usuarioId,
  }
}
