import { describe, expect, it } from 'vitest'
import type {
  AjusteBeneficioVT,
  ComponenteDecisaoTrajetoVT,
  DecisaoTrajetoVT,
  VersaoPrecoPacoteVT,
} from '@/lib/vt/contratosTarifarios'
import {
  ajusteDeLinha,
  ajusteParaLinha,
  componenteDeLinha,
  componenteParaLinha,
  decisaoDeLinha,
  decisaoParaLinha,
  versaoPrecoDeLinha,
  versaoPrecoParaLinha,
} from '@/lib/vt/adaptadoresSql'

const IDS = {
  preco: '10000000-0000-4000-8000-000000000001',
  pacote: '10000000-0000-4000-8000-000000000002',
  bilhete: '10000000-0000-4000-8000-000000000003',
  decisao: '10000000-0000-4000-8000-000000000004',
  trajeto: '10000000-0000-4000-8000-000000000005',
  pessoa: '10000000-0000-4000-8000-000000000006',
  posto: '10000000-0000-4000-8000-000000000007',
  componente: '10000000-0000-4000-8000-000000000008',
  ajuste: '10000000-0000-4000-8000-000000000009',
  usuario: '10000000-0000-4000-8000-00000000000a',
}

const PRECO: VersaoPrecoPacoteVT = {
  id: IDS.preco,
  pacoteId: IDS.pacote,
  valorDiarioCentavos: 1120,
  vigenteDesde: '2026-10-21',
  vigenteAte: null,
  bilheteLegadoId: IDS.bilhete,
}

const DECISAO: DecisaoTrajetoVT = {
  id: IDS.decisao,
  trajetoLegadoId: IDS.trajeto,
  colaboradorId: IDS.pessoa,
  departamentoId: IDS.posto,
  revisao: 1,
  cotacaoId: null,
  custoDiarioCentavos: null,
  status: 'confirmada',
  confirmadaPor: IDS.usuario,
  confirmadaEm: '2026-11-01T10:00:00Z',
  vigenteDesde: '2026-11-15',
  vigenteAte: null,
  origem: 'legado',
  referenciasLegadasNaoResolvidas: [IDS.bilhete],
}

const COMPONENTE: ComponenteDecisaoTrajetoVT = {
  id: IDS.componente,
  decisaoTrajetoId: IDS.decisao,
  pacoteId: IDS.pacote,
  ordem: 1,
}

const AJUSTE: AjusteBeneficioVT = {
  id: IDS.ajuste,
  decisaoTrajetoId: IDS.decisao,
  valorDiarioCentavos: 250,
  motivo: 'Complemento autorizado',
  autorId: IDS.usuario,
  vigenteDesde: '2026-11-15',
  vigenteAte: null,
  origem: 'legado',
}

describe('adaptadores SQL ↔ domínio', () => {
  it('faz ida e volta preservando UUIDs, origem e referências legadas', () => {
    expect(versaoPrecoDeLinha(versaoPrecoParaLinha(PRECO))).toEqual(PRECO)
    expect(decisaoDeLinha(decisaoParaLinha(DECISAO))).toEqual(DECISAO)
    expect(componenteDeLinha(componenteParaLinha(COMPONENTE))).toEqual(COMPONENTE)
    expect(ajusteDeLinha(ajusteParaLinha(AJUSTE))).toEqual(AJUSTE)
  })

  it('preserva origem manual quando o domínio não informa legado', () => {
    const decisao = { ...DECISAO, origem: undefined }
    const ajuste = { ...AJUSTE, origem: undefined }

    expect(decisaoParaLinha(decisao).origem).toBe('manual')
    expect(ajusteParaLinha(ajuste).origem).toBe('manual')
  })

  it('recusa IDs locais que não podem ser persistidos no PostgreSQL', () => {
    expect(() => versaoPrecoParaLinha({ ...PRECO, id: 'legado_bu_niteroi' }))
      .toThrow('UUID')
    expect(() => decisaoParaLinha({ ...DECISAO, id: 'tr1:decisao:1' }))
      .toThrow('UUID')
    expect(() => componenteParaLinha({ ...COMPONENTE, pacoteId: 'legado_bu_niteroi' }))
      .toThrow('UUID')
    expect(() => ajusteParaLinha({ ...AJUSTE, decisaoTrajetoId: 'tr1:decisao:1' }))
      .toThrow('UUID')
  })
})
