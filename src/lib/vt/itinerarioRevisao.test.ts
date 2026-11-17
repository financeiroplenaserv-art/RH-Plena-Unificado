import { describe, expect, it } from 'vitest'
import {
  ajustesNaoCopiados,
  componentesNaoCopiados,
  novaRevisaoDeDecisao,
} from '@/lib/vt/itinerarioRevisao'
import type { VtBeneficioAjuste, VtTrajetoDecisao, VtTrajetoDecisaoComponente } from '@/types/vt'

const DECISAO: VtTrajetoDecisao = {
  id: '10000000-0000-4000-8000-000000000001',
  trajeto_legado_id: '10000000-0000-4000-8000-000000000002',
  colaborador_id: '10000000-0000-4000-8000-000000000003',
  departamento_id: '10000000-0000-4000-8000-000000000004',
  revisao: 3,
  cotacao_id: 'cotacao-atual',
  status: 'confirmada',
  confirmado_por: '10000000-0000-4000-8000-000000000005',
  confirmado_em: '2026-11-01T10:00:00Z',
  vigente_desde: '2026-11-01',
  vigente_ate: null,
  origem: 'legado',
  referencias_legadas_nao_resolvidas: ['10000000-0000-4000-8000-000000000006'],
  itinerario_id: '10000000-0000-4000-8000-000000000007',
}

const COMPONENTES: VtTrajetoDecisaoComponente[] = [{
  id: '10000000-0000-4000-8000-000000000008',
  decisao_trajeto_id: DECISAO.id,
  pacote_id: '10000000-0000-4000-8000-000000000009',
  ordem: 1,
}]

const AJUSTES: VtBeneficioAjuste[] = [{
  id: '10000000-0000-4000-8000-00000000000a',
  decisao_trajeto_id: DECISAO.id,
  valor_diario_centavos: 200,
  motivo: 'Complemento autorizado',
  autor_id: DECISAO.confirmado_por,
  vigente_desde: '2026-11-01',
  vigente_ate: null,
  origem: 'manual',
}]

describe('nova revisão da decisão', () => {
  it('nasce sugerida, preserva a composição e não altera a decisão confirmada', () => {
    const antes = structuredClone(DECISAO)
    const nova = novaRevisaoDeDecisao(DECISAO, '2026-11-17')

    expect(nova).toMatchObject({
      trajeto_legado_id: DECISAO.trajeto_legado_id,
      colaborador_id: DECISAO.colaborador_id,
      departamento_id: DECISAO.departamento_id,
      revisao: 4,
      cotacao_id: DECISAO.cotacao_id,
      status: 'sugerida',
      confirmado_por: null,
      confirmado_em: null,
      vigente_desde: '2026-11-17',
      origem: 'manual',
      itinerario_id: null,
    })
    expect(nova.referencias_legadas_nao_resolvidas).toEqual(DECISAO.referencias_legadas_nao_resolvidas)
    expect(nova.referencias_legadas_nao_resolvidas).not.toBe(DECISAO.referencias_legadas_nao_resolvidas)
    expect(DECISAO).toEqual(antes)
  })

  it('copia somente componentes ausentes, sem duplicar pacote ou ordem', () => {
    const destino = [{ pacote_id: COMPONENTES[0].pacote_id, ordem: 99 }]
    expect(componentesNaoCopiados(COMPONENTES, destino)).toEqual([])
    expect(componentesNaoCopiados(COMPONENTES, [])).toEqual(COMPONENTES)
  })

  it('copia somente ajustes cuja vigência e conteúdo ainda não existam', () => {
    expect(ajustesNaoCopiados(AJUSTES, [AJUSTES[0]])).toEqual([])
    expect(ajustesNaoCopiados(AJUSTES, [])).toEqual(AJUSTES)
    expect(ajustesNaoCopiados(AJUSTES, [{ ...AJUSTES[0], valor_diario_centavos: 300 }])).toEqual(AJUSTES)
  })
})
