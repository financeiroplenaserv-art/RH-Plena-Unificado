import { describe, it, expect } from 'vitest'
import {
  extrairPeriodoFeriasEcontador,
  statusFeriasPorData,
  decidirSincronizacaoFerias,
  OBS_ECONTADOR,
  OBS_ECONTADOR_FIM_ESTIMADO,
} from './feriasEcontador'

const HOJE = '2026-09-28'

describe('extrairPeriodoFeriasEcontador', () => {
  it('extrai início e fim quando está de férias com retorno', () => {
    const periodo = extrairPeriodoFeriasEcontador({
      afastamentodescricao: 'Férias',
      afastamento: '2026-09-15T00:00:00',
      retorno: '2026-10-14T00:00:00',
    })
    expect(periodo).toEqual({ data_inicio: '2026-09-15', data_fim: '2026-10-14', fimEstimado: false })
  })

  it('sem retorno: fim estimado = início + 29 dias', () => {
    const periodo = extrairPeriodoFeriasEcontador({
      afastamentodescricao: 'Férias',
      afastamento: '2026-09-15T00:00:00',
      retorno: null,
    })
    expect(periodo).toEqual({ data_inicio: '2026-09-15', data_fim: '2026-10-14', fimEstimado: true })
  })

  it('ignora quem não está de férias ou não tem data de início', () => {
    expect(extrairPeriodoFeriasEcontador({ afastamentodescricao: 'Licença Médica', afastamento: '2026-09-15', retorno: null })).toBeNull()
    expect(extrairPeriodoFeriasEcontador({ afastamentodescricao: null, afastamento: null, retorno: null })).toBeNull()
    expect(extrairPeriodoFeriasEcontador({ afastamentodescricao: 'Férias', afastamento: null, retorno: null })).toBeNull()
  })
})

describe('statusFeriasPorData', () => {
  it('concluída quando o fim já passou', () => {
    expect(statusFeriasPorData('2026-08-01', '2026-08-30', HOJE)).toBe('concluida')
  })

  it('em andamento quando hoje está dentro do período (pontas inclusas)', () => {
    expect(statusFeriasPorData('2026-09-15', '2026-10-14', HOJE)).toBe('em_andamento')
    expect(statusFeriasPorData('2026-09-28', '2026-09-28', HOJE)).toBe('em_andamento')
  })

  it('aprovada quando o período é futuro', () => {
    expect(statusFeriasPorData('2026-10-01', '2026-10-30', HOJE)).toBe('aprovada')
  })
})

describe('decidirSincronizacaoFerias', () => {
  const periodo = { data_inicio: '2026-09-15', data_fim: '2026-10-14', fimEstimado: false }

  it('sem registro existente: inserir com status derivado e observação de origem', () => {
    const decisao = decidirSincronizacaoFerias(periodo, null, HOJE)
    expect(decisao.acao).toBe('inserir')
    if (decisao.acao !== 'inserir') return
    expect(decisao.dados).toEqual({
      data_inicio: '2026-09-15',
      data_fim: '2026-10-14',
      status: 'em_andamento',
      observacao: OBS_ECONTADOR,
    })
  })

  it('fim estimado marca a observação para confirmar com o DP', () => {
    const decisao = decidirSincronizacaoFerias({ ...periodo, fimEstimado: true }, null, HOJE)
    if (decisao.acao === 'ignorar') throw new Error('deveria inserir')
    expect(decisao.dados.observacao).toBe(OBS_ECONTADOR_FIM_ESTIMADO)
  })

  it('registro igual: ignorar', () => {
    const decisao = decidirSincronizacaoFerias(
      periodo,
      { id: 's1', data_fim: '2026-10-14', status: 'em_andamento' },
      HOJE
    )
    expect(decisao.acao).toBe('ignorar')
  })

  it('fim mudou (retorno chegou depois): atualizar', () => {
    const decisao = decidirSincronizacaoFerias(
      periodo,
      { id: 's1', data_fim: '2026-10-13', status: 'em_andamento' },
      HOJE
    )
    expect(decisao.acao).toBe('atualizar')
  })

  it('status mudou com o passar do tempo: atualizar', () => {
    const decisao = decidirSincronizacaoFerias(
      periodo,
      { id: 's1', data_fim: '2026-10-14', status: 'aprovada' },
      HOJE
    )
    expect(decisao.acao).toBe('atualizar')
  })
})
