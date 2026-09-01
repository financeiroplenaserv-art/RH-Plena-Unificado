import { describe, expect, it } from 'vitest'
import {
  analisesDoEvento,
  aplicarResponsavelAnalise,
  buscaTextual,
  diaDe,
  eventosPorAssunto,
  eventosPorResponsavel,
  filaAprovacao,
  filtrarChecklists,
  filtrarColetas,
  filtrarEventos,
  filtrarPor,
  fmtMin,
  horaDe,
  kpisChecklists,
  kpisEventos,
  kpisVisitas,
  mapaAnalises,
  mapaQas,
  media,
  minDe,
  opcoesDe,
  opcoesLocais,
  opcoesPessoas,
  producaoPorDiaInspetor,
  respEv,
  responsavelEvento,
  slaEventos,
  statusSync,
  varianteConclusao,
  varianteSla,
  VARIANTES_CONCLUSAO,
  visitasPorDia,
  visitasPorInspetor,
} from './agregacoes'
import type { BiChecklist, BiColeta, BiEvento } from '@/types/bi'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function ck(parcial: Partial<BiChecklist>): BiChecklist {
  return {
    id: 1,
    numero: 10,
    ano: 2026,
    checklist_id: 5,
    checklist_nome: 'Checklist Diário',
    local_id: 1,
    site_nome: 'CBO Niterói',
    responsavel_id: 7,
    responsavel_nome: 'Ana',
    data_planejada: '2026-08-10T12:00:00+00:00',
    data_inicio: '2026-08-10T13:00:00+00:00',
    data_termino: '2026-08-10T15:00:00+00:00',
    conclusao_nome: 'Aprovado',
    url: 'https://exemplo.com/ck.pdf',
    ...parcial,
  }
}

function coleta(parcial: Partial<BiColeta>): BiColeta {
  return {
    id: 1,
    local_id: 1,
    funcionario: 'Carlos',
    usuario_id: 3,
    data_local: '2026-08-10T10:00:00+00:00',
    data_termino: '2026-08-10T11:30:00+00:00',
    area: 'Recepção',
    site_nome: 'CBO Niterói',
    site_cidade: 'Niterói',
    site_uf: 'RJ',
    motivo_visita: 'Rotina',
    observacao: null,
    tipo_coleta: 'Inspeção',
    tempo_minutos: 90,
    ...parcial,
  }
}

function evento(parcial: Partial<BiEvento>): BiEvento {
  return {
    id: 1,
    numero: 20,
    ano: 2026,
    local_id: 1,
    evento_id: 9,
    evento_nome: 'Lâmpada queimada',
    subtipo_nome: 'Manutenção',
    site_nome: 'CBO Niterói',
    site_cidade: 'Niterói',
    site_uf: 'RJ',
    usuario_nome: 'Bruno',
    usuario_ultimo_nome: 'Ana',
    data_evento: '2026-08-01T09:00:00+00:00',
    data_finalizacao: '2026-08-03T21:00:00+00:00', // 2,5 dias depois
    status_texto: 'Concluído',
    sla: 'DENTRO',
    observacao: 'obs',
    acoes_realizadas: null,
    acoes_realizadas_finalizacao: 'Trocada',
    ...parcial,
  }
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

describe('filtros por período/pessoa/local', () => {
  const F = { di: '2026-08-01', df: '2026-08-31', pessoa: '', local: '' }

  it('checklists: usa data_planejada, com fallback para data_inicio', () => {
    const lista = [
      ck({ id: 1, data_planejada: '2026-08-10T12:00:00+00:00' }),
      ck({ id: 2, data_planejada: null, data_inicio: '2026-08-05T12:00:00+00:00', responsavel_nome: 'Carlos' }),
      ck({ id: 3, data_planejada: '2026-07-10T12:00:00+00:00' }),
      ck({ id: 4, data_planejada: '2026-08-10T12:00:00+00:00', responsavel_nome: 'Ana' }),
    ]
    expect(filtrarChecklists(lista, F).map((c) => c.id)).toEqual([1, 2, 4])
    expect(filtrarChecklists(lista, { ...F, pessoa: 'Ana' }).map((c) => c.id)).toEqual([1, 4])
    expect(filtrarChecklists(lista, { ...F, local: 'Outro' })).toEqual([])
  })

  it('coletas: filtra por data_local, funcionário e site', () => {
    const lista = [
      coleta({ id: 1 }),
      coleta({ id: 2, data_local: '2026-09-01T10:00:00+00:00' }),
      coleta({ id: 3, funcionario: 'Duda' }),
      coleta({ id: 4, site_nome: 'CBO Macaé' }),
    ]
    expect(filtrarColetas(lista, F).map((v) => v.id)).toEqual([1, 3, 4])
    expect(filtrarColetas(lista, { ...F, pessoa: 'Duda' }).map((v) => v.id)).toEqual([3])
    expect(filtrarColetas(lista, { ...F, local: 'CBO Macaé' }).map((v) => v.id)).toEqual([4])
  })

  it('eventos: pessoa casa com responsável atual OU com quem abriu', () => {
    const lista = [
      evento({ id: 1 }), // resp Ana, aberto por Bruno
      evento({ id: 2, usuario_ultimo_nome: null }), // resp cai para Bruno
      evento({ id: 3, data_evento: '2026-07-15T09:00:00+00:00' }),
    ]
    expect(filtrarEventos(lista, F).map((e) => e.id)).toEqual([1, 2])
    expect(filtrarEventos(lista, { ...F, pessoa: 'Bruno' }).map((e) => e.id)).toEqual([1, 2])
    expect(filtrarEventos(lista, { ...F, pessoa: 'Ana' }).map((e) => e.id)).toEqual([1])
  })

  it('período aberto (di/df vazios) não filtra nada', () => {
    const lista = [ck({ id: 1, data_planejada: '2020-01-01T00:00:00+00:00' })]
    expect(filtrarChecklists(lista, { di: '', df: '', pessoa: '', local: '' })).toHaveLength(1)
  })

  it('diaDe extrai YYYY-MM-DD do ISO 8601', () => {
    expect(diaDe('2026-08-19T13:00:00+00:00')).toBe('2026-08-19')
    expect(diaDe(null)).toBe('')
  })

  it('diaDe usa o dia civil de Brasília, não o UTC nem o do dispositivo', () => {
    // 01h30 UTC = 22h30 BRT do dia anterior — independente do fuso da máquina
    expect(diaDe('2026-08-19T01:30:00+00:00')).toBe('2026-08-18')
    expect(diaDe('2026-08-19T02:59:00+00:00')).toBe('2026-08-18')
    expect(diaDe('2026-08-19T03:00:00+00:00')).toBe('2026-08-19')
    expect(diaDe('data-invalida')).toBe('data-inval')
  })

  it('horaDe exibe a hora de Brasília', () => {
    expect(horaDe('2026-08-22T02:09:00+00:00')).toBe('23:09') // visita de 23h09 BRT do dia 21
    expect(horaDe('2026-08-19T13:00:00+00:00')).toBe('10:00')
    expect(horaDe(null)).toBe('-')
    expect(horaDe('lixo')).toBe('-')
  })
})

describe('opções de pessoa/local', () => {
  it('une responsável de checklist, inspetor de coleta e responsável/autor de evento', () => {
    const pessoas = opcoesPessoas(
      [ck({ responsavel_nome: 'Ana' })],
      [coleta({ funcionario: 'Carlos' })],
      [evento({ usuario_ultimo_nome: null, usuario_nome: 'Bruno' })]
    )
    expect(pessoas).toEqual(['Ana', 'Bruno', 'Carlos'])
  })

  it('une site_nome das três fontes sem repetição', () => {
    const locais = opcoesLocais(
      [ck({ site_nome: 'CBO Niterói' })],
      [coleta({ site_nome: 'CBO Niterói' })],
      [evento({ site_nome: 'CBO Macaé' })]
    )
    expect(locais).toEqual(['CBO Macaé', 'CBO Niterói'])
  })
})

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

describe('minDe', () => {
  it('prioriza tempo_minutos quando presente', () => {
    expect(minDe(coleta({ tempo_minutos: 45 }))).toBe(45)
    expect(minDe(coleta({ tempo_minutos: 0 }))).toBe(0)
  })

  it('cai para a diferença das datas quando tempo_minutos é null', () => {
    expect(minDe(coleta({ tempo_minutos: null }))).toBe(90)
  })

  it('nunca devolve negativo e devolve null sem dados', () => {
    expect(
      minDe(
        coleta({
          tempo_minutos: null,
          data_local: '2026-08-10T11:30:00+00:00',
          data_termino: '2026-08-10T10:00:00+00:00',
        })
      )
    ).toBe(0)
    expect(minDe(coleta({ tempo_minutos: null, data_termino: null }))).toBeNull()
  })
})

describe('fmtMin / media', () => {
  it('formata minutos', () => {
    expect(fmtMin(90)).toBe('1h 30min')
    expect(fmtMin(45)).toBe('45min')
    expect(fmtMin(60)).toBe('1h 00min')
    expect(fmtMin(null)).toBe('-')
  })

  it('média ignora null/NaN e devolve null sem valores', () => {
    expect(media([1, null, 3, undefined])).toBe(2)
    expect(media([null, NaN])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Visitas
// ---------------------------------------------------------------------------

describe('visitas', () => {
  const visitas = [
    coleta({ id: 1, data_local: '2026-08-10T10:00:00+00:00', tempo_minutos: 60 }),
    coleta({ id: 2, data_local: '2026-08-10T14:00:00+00:00', tempo_minutos: 30, site_nome: 'CBO Macaé' }),
    coleta({ id: 3, data_local: '2026-08-11T09:00:00+00:00', tempo_minutos: null, data_termino: null, funcionario: 'Duda' }),
  ]

  it('KPIs agregam visitas, inspetores, locais, dias e tempo total', () => {
    expect(kpisVisitas(visitas)).toEqual({
      visitas: 3,
      inspetoresAtivos: 2,
      locaisVisitados: 2,
      diasComVisita: 2,
      minutosTotais: 90,
    })
  })

  it('visitasPorDia ordena por data', () => {
    expect(visitasPorDia(visitas)).toEqual([
      { dia: '2026-08-10', qtd: 2 },
      { dia: '2026-08-11', qtd: 1 },
    ])
  })

  it('visitasPorInspetor ordena por quantidade desc', () => {
    expect(visitasPorInspetor(visitas)).toEqual([
      { inspetor: 'Carlos', qtd: 2 },
      { inspetor: 'Duda', qtd: 1 },
    ])
  })

  it('produção por dia×inspetor soma tempo e conta locais distintos', () => {
    const prod = producaoPorDiaInspetor(visitas)
    expect(prod).toEqual([
      { dia: '2026-08-11', inspetor: 'Duda', qtd: 1, minutos: 0, locais: 1 },
      { dia: '2026-08-10', inspetor: 'Carlos', qtd: 2, minutos: 90, locais: 2 },
    ])
  })

  it('produção filtrada por inspetor', () => {
    const prod = producaoPorDiaInspetor(visitas, 'Carlos')
    expect(prod).toHaveLength(1)
    expect(prod[0].inspetor).toBe('Carlos')
  })
})

// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------

describe('checklists', () => {
  const lista = [
    ck({ id: 1, conclusao_nome: 'Aprovado' }),
    ck({ id: 2, conclusao_nome: 'Aguardando Autorização' }),
    ck({ id: 3, conclusao_nome: 'Reprovado' }),
    ck({ id: 4, conclusao_nome: null }),
  ]

  it('KPIs contam por conclusão', () => {
    expect(kpisChecklists(lista)).toEqual({ total: 4, aguardando: 1, aprovados: 1, reprovados: 1 })
  })

  it('fila de aprovação só tem Aguardando Autorização', () => {
    expect(filaAprovacao(lista).map((c) => c.id)).toEqual([2])
  })

  it('mapaQas indexa as respostas pelo id do checklist', () => {
    const mapa = mapaQas([
      { id: 2, qas: { p1: { grupo_perguntas: 'Geral', pergunta: 'P?', respostas: 'Sim', observacoes: null } } },
      { id: 9, qas: null },
    ])
    expect(Object.keys(mapa[2])).toHaveLength(1)
    expect(mapa[9]).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

describe('badge de conclusão (mapa de classes)', () => {
  it('cobre o mapa do template', () => {
    expect(VARIANTES_CONCLUSAO['Aguardando Autorização']).toBe('warning')
    expect(VARIANTES_CONCLUSAO['Aprovado']).toBe('success')
    expect(VARIANTES_CONCLUSAO['Finalizado']).toBe('success')
    expect(VARIANTES_CONCLUSAO['Reprovado']).toBe('danger')
    expect(VARIANTES_CONCLUSAO['Não Realizado']).toBe('danger')
    expect(VARIANTES_CONCLUSAO['Cancelado']).toBe('neutral')
  })

  it('desconhecido/vazio cai no neutro', () => {
    expect(varianteConclusao('Outro')).toBe('neutral')
    expect(varianteConclusao(null)).toBe('neutral')
  })

  it('SLA: DENTRO success, FORA danger, resto neutro', () => {
    expect(varianteSla('DENTRO')).toBe('success')
    expect(varianteSla('FORA')).toBe('danger')
    expect(varianteSla(null)).toBe('neutral')
  })
})

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

describe('eventos', () => {
  const lista = [
    evento({ id: 1, sla: 'DENTRO' }), // finalizado em 2,5 d
    evento({ id: 2, sla: 'FORA', data_finalizacao: null, status_texto: 'Em andamento' }),
    evento({ id: 3, sla: 'DENTRO', data_evento: '2026-08-10T00:00:00+00:00', data_finalizacao: '2026-08-11T12:00:00+00:00' }), // 1,5 d
    evento({ id: 4, sla: null, data_finalizacao: null, usuario_ultimo_nome: 'Carlos', evento_nome: 'Vazamento' }),
  ]

  it('KPIs: abertos, finalizados, SLA % e tempo médio', () => {
    const k = kpisEventos(lista)
    expect(k.total).toBe(4)
    expect(k.emAberto).toBe(2)
    expect(k.finalizados).toBe(2)
    expect(k.slaDentro).toBe(2)
    expect(k.slaPct).toBe(50)
    expect(k.tempoMedioDias).toBe(2) // média de 2,5 e 1,5
  })

  it('slaEventos fatia dentro/fora', () => {
    expect(slaEventos(lista)).toEqual({ dentro: 2, fora: 2 })
  })

  it('KPIs com lista vazia não quebram', () => {
    expect(kpisEventos([])).toEqual({ total: 0, emAberto: 0, finalizados: 0, slaDentro: 0, slaPct: 0, tempoMedioDias: null })
  })

  it('eventosPorAssunto ordena desc e limita', () => {
    const muitos = Array.from({ length: 15 }, (_, i) => evento({ id: i + 10, evento_nome: `Assunto ${i}` }))
    const top = eventosPorAssunto([...lista, ...muitos], 12)
    expect(top).toHaveLength(12)
    expect(top[0].qtd).toBeGreaterThanOrEqual(top[11].qtd)
    // sem limite explícito vale o top 12 do template
    expect(eventosPorAssunto(muitos)).toHaveLength(12)
  })

  it('eventosPorResponsavel agrega e ordena por total desc', () => {
    const rr = eventosPorResponsavel(lista)
    expect(rr.map((r) => r.nome)).toEqual(['Ana', 'Carlos'])
    const ana = rr[0]
    expect(ana.total).toBe(3)
    expect(ana.emAberto).toBe(1)
    expect(ana.finalizados).toBe(2)
    expect(ana.slaPct).toBe(67)
    expect(ana.tempoMedioDias).toBe(2)
  })

  it('respEv prefere o responsável atual', () => {
    expect(respEv(evento({}))).toBe('Ana')
    expect(respEv(evento({ usuario_ultimo_nome: null }))).toBe('Bruno')
    expect(respEv(evento({ usuario_ultimo_nome: null, usuario_nome: null }))).toBe('—')
  })

  it('mapa de análises por evento, ordenadas por data', () => {
    const mapa = mapaAnalises([
      { id: 1, evento_id: 7, responsavel_nome: 'Ana', tipo_analise_nome: 'Nota', descricao: 'b', data_analise: '2026-08-05T10:00:00+00:00' },
      { id: 2, evento_id: 7, responsavel_nome: 'Ana', tipo_analise_nome: 'Nota', descricao: 'a', data_analise: '2026-08-01T10:00:00+00:00' },
      { id: 3, evento_id: null, responsavel_nome: 'Ana', tipo_analise_nome: null, descricao: null, data_analise: null },
    ])
    expect(mapa[7]).toHaveLength(2)
    expect(analisesDoEvento(mapa, 7).map((a) => a.descricao)).toEqual(['a', 'b'])
    expect(analisesDoEvento(mapa, 999)).toEqual([])
  })

  it('responsavelEvento usa a pessoa da análise mais recente (decisão 01/09/2026)', () => {
    const ev = evento({ usuario_nome: 'Eliane Azevedo', usuario_ultimo_nome: 'Eliane Azevedo' })
    const ans = [
      { id: 1, evento_id: 1, responsavel_nome: 'Carlos', tipo_analise_nome: 'Nota', descricao: null, data_analise: '2026-08-01T10:00:00+00:00' },
      { id: 2, evento_id: 1, responsavel_nome: 'Alexandre Avila', tipo_analise_nome: 'Em Análise', descricao: null, data_analise: '2026-09-01T09:50:00+00:00' },
    ]
    expect(responsavelEvento(ev, ans)).toBe('Alexandre Avila')
    // fora de ordem na entrada: vale a mais recente pela data
    expect(responsavelEvento(ev, [ans[1], ans[0]])).toBe('Alexandre Avila')
    // sem análise: cai para quem trata/abriu o evento
    expect(responsavelEvento(ev, [])).toBe('Eliane Azevedo')
    // análise sem responsável preenchido é ignorada
    expect(
      responsavelEvento(ev, [
        { id: 3, evento_id: 1, responsavel_nome: null, tipo_analise_nome: 'Nota', descricao: null, data_analise: '2026-09-02T10:00:00+00:00' },
      ])
    ).toBe('Eliane Azevedo')
  })

  it('aplicarResponsavelAnalise aplica o responsável da análise preservando o autor', () => {
    const ev = evento({ id: 7, usuario_nome: 'Eliane Azevedo', usuario_ultimo_nome: 'Eliane Azevedo' })
    const mapa = mapaAnalises([
      { id: 1, evento_id: 7, responsavel_nome: 'Alexandre Avila', tipo_analise_nome: 'Em Análise', descricao: null, data_analise: '2026-09-01T09:50:00+00:00' },
    ])
    const [r] = aplicarResponsavelAnalise([ev], mapa)
    expect(r.usuario_ultimo_nome).toBe('Alexandre Avila')
    expect(r.usuario_nome).toBe('Eliane Azevedo')
    // sem análise com responsável: retorna o próprio objeto, sem cópia
    expect(aplicarResponsavelAnalise([ev], {})[0]).toBe(ev)
  })
})

// ---------------------------------------------------------------------------
// Busca textual
// ---------------------------------------------------------------------------

describe('buscaTextual', () => {
  it('casa com qualquer campo e ignora termo vazio', () => {
    const lista = [ck({ id: 1, site_nome: 'CBO Macaé' }), ck({ id: 2, site_nome: 'CBO Niterói' })]
    expect(buscaTextual(lista, 'macaé').map((c) => c.id)).toEqual([1])
    expect(buscaTextual(lista, '  ')).toHaveLength(2)
  })
})

describe('filtros de igualdade por aba', () => {
  it('opcoesDe devolve valores distintos ordenados, sem null/vazio', () => {
    const lista = [
      ck({ id: 1, conclusao_nome: 'Reprovado' }),
      ck({ id: 2, conclusao_nome: 'Aprovado' }),
      ck({ id: 3, conclusao_nome: 'Aprovado' }),
      ck({ id: 4, conclusao_nome: null }),
    ]
    expect(opcoesDe(lista, (c) => c.conclusao_nome)).toEqual(['Aprovado', 'Reprovado'])
    expect(opcoesDe([], (c: BiChecklist) => c.conclusao_nome)).toEqual([])
  })

  it('filtrarPor filtra por igualdade; vazio não filtra', () => {
    const lista = [
      evento({ id: 1, sla: 'DENTRO' }),
      evento({ id: 2, sla: 'FORA' }),
      evento({ id: 3, sla: null }),
    ]
    expect(filtrarPor(lista, (e) => e.sla, 'FORA').map((e) => e.id)).toEqual([2])
    expect(filtrarPor(lista, (e) => e.sla, '')).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// Frescor do sync (bi_sync_log)
// ---------------------------------------------------------------------------

describe('statusSync', () => {
  const agora = new Date('2026-08-20T12:00:00+00:00')

  it('null sem registro de sync', () => {
    expect(statusSync(null, agora)).toBeNull()
    expect(statusSync(undefined, agora)).toBeNull()
  })

  it('ok quando a última execução foi bem-sucedida e recente', () => {
    expect(statusSync({ executado_em: '2026-08-20T09:30:00+00:00', ok: true }, agora)).toBe('ok')
  })

  it('erro quando a última execução falhou', () => {
    expect(statusSync({ executado_em: '2026-08-20T09:30:00+00:00', ok: false }, agora)).toBe('erro')
  })

  it('atrasado quando o último sucesso tem mais de 26h', () => {
    // 27h atrás
    expect(statusSync({ executado_em: '2026-08-19T09:00:00+00:00', ok: true }, agora)).toBe('atrasado')
    // 25h atrás ainda está ok
    expect(statusSync({ executado_em: '2026-08-19T11:00:00+00:00', ok: true }, agora)).toBe('ok')
  })

  it('data inválida não quebra (null)', () => {
    expect(statusSync({ executado_em: 'lixo', ok: true }, agora)).toBeNull()
  })
})
