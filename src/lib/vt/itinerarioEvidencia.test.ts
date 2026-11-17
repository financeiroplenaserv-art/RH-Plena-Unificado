import { describe, expect, it } from 'vitest'
import { adaptarRotasGoogle } from '@/lib/vt/googleRoutes'
import { RESPOSTA_ACACIO } from '@/lib/vt/googleRoutesFixture'
import { prepararEvidenciaItinerario, type EscolhaItinerarioVT } from '@/lib/vt/itinerarioEvidencia'

const IDS = {
  decisao: '10000000-0000-4000-8000-000000000001',
  pessoa: '10000000-0000-4000-8000-000000000002',
  posto: '10000000-0000-4000-8000-000000000003',
  usuario: '10000000-0000-4000-8000-000000000004',
}

function entrada(): EscolhaItinerarioVT {
  return {
    decisaoId: IDS.decisao,
    colaboradorId: IDS.pessoa,
    departamentoId: IDS.posto,
    usuarioId: IDS.usuario,
    alternativa: adaptarRotasGoogle(RESPOSTA_ACACIO, {
      consultadoEm: '2026-11-16T12:00:00Z',
      precisao: 'exata',
      sentido: 'ida',
      municipioOrigem: 'Niterói',
      municipioDestino: 'Niterói',
    })[0],
  }
}

describe('evidência do itinerário escolhido', () => {
  it('gera hash e chave estáveis sem alterar a alternativa em memória', async () => {
    const escolha = entrada()
    const primeira = await prepararEvidenciaItinerario(escolha)
    const segunda = await prepararEvidenciaItinerario(escolha)

    expect(primeira).toEqual(segunda)
    expect(primeira.evidencia_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(primeira.itinerario.evidenciaHash).toBe(primeira.evidencia_hash)
    expect(primeira.chave_idempotencia).toBe(
      `${IDS.pessoa}:${IDS.posto}:google-1:${primeira.evidencia_hash}`,
    )
    expect(primeira.created_by).toBe(IDS.usuario)
    expect(escolha.alternativa.itinerario.evidenciaHash).toBeNull()
  })

  it('muda o hash quando a evidência muda', async () => {
    const original = entrada()
    const alterada = entrada()
    alterada.alternativa.distanciaMetros += 1

    expect((await prepararEvidenciaItinerario(original)).evidencia_hash)
      .not.toBe((await prepararEvidenciaItinerario(alterada)).evidencia_hash)
  })

  it('recusa rota vazia e IDs locais que não existem no banco', async () => {
    const vazia = entrada()
    vazia.alternativa.itinerario.pernas = []
    await expect(prepararEvidenciaItinerario(vazia)).rejects.toThrow('sem conduções')

    await expect(prepararEvidenciaItinerario({ ...entrada(), decisaoId: 'trajeto:decisao:1' }))
      .rejects.toThrow('UUID')
  })
})
