import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VtTrajetosTab } from './VtTrajetosTab'
import type { VtColaborador, VtDepartamento, VtTrajetoComDetalhes } from '@/hooks/useVt'
import type { VtBilhete } from '@/types/vt'

const evidencias = vi.hoisted(() => ({ mapa: new Map<string, unknown>() }))

vi.mock('@/lib/vt/repositorioItinerarioSupabase', () => ({
  RepositorioItinerarioSupabase: class {
    buscarEvidenciasPorTrajetos = vi.fn().mockImplementation(async () => evidencias.mapa)
    buscarDecisaoPorTrajeto = vi.fn().mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000001',
      status: 'sugerida',
      itinerario_id: null,
    })
  },
}))

const COLABORADOR: VtColaborador = {
  id: 'amanda-id',
  nome_completo: 'AMANDA ARAUJO DE CASTRO',
  departamento: 'PLENA TECH ADMINISTRATIVO',
  departamento_id: 'plena-tech-id',
  cidade: 'Niterói',
  endereco: 'TRAVESSA CALDEIRA, 22, CUBANGO',
  cep: '24140-160',
  vt_optante: true,
  vt_tipo_cartao: 'bun',
  vt_bu_ativado: null,
  vt_bu_situacao: null,
  cargo: null,
}

const DEPARTAMENTO: VtDepartamento = {
  id: 'plena-tech-id',
  nome: 'PLENA TECH ADMINISTRATIVO',
  nome_curto: 'PLENA TECH ADMINISTRATIVO',
  empresa_id: 'empresa-id',
  status: 'Ativo',
  endereco: null,
  cidade: null,
  cep: null,
}

const BILHETE: VtBilhete = {
  id: 'bu-niteroi-id',
  nome: 'BU NITERÓI',
  valor_diario_centavos: 1120,
  vigente_desde: '2026-10-21',
  ativo: true,
  cartao_necessario: 'bun',
  usa_integracao: true,
}

const TRAJETO: VtTrajetoComDetalhes = {
  id: 'trajeto-amanda-id',
  colaborador_id: COLABORADOR.id,
  departamento_id: DEPARTAMENTO.id,
  bilhete_id: BILHETE.id,
  bilhete_2_id: null,
  escopo: 'intermunicipal',
  precisao_origem: 'exato',
  origem: 'link_confirmado',
  status: 'confirmado',
  valor_extra_centavos: 0,
  observacao: null,
  confirmado_por: 'usuario-id',
  confirmado_em: '2026-10-29T21:27:50.487Z',
  colaborador: COLABORADOR,
  departamento: DEPARTAMENTO,
}

function setup(
  podeGerenciar = true,
  trajeto: VtTrajetoComDetalhes = TRAJETO,
  opcoes?: {
    colaboradores?: VtColaborador[]
    extrasTrajeto?: Map<string, { nome_completo: string; status: string }>
  },
) {
  return render(
    <VtTrajetosTab
      colaboradores={opcoes?.colaboradores ?? [COLABORADOR]}
      departamentos={[DEPARTAMENTO]}
      bilhetes={[BILHETE]}
      trajetos={[trajeto]}
      extrasTrajeto={opcoes?.extrasTrajeto ?? new Map()}
      loading={false}
      usuarioId="usuario-id"
      podeGerenciar={podeGerenciar}
      salvarTrajeto={vi.fn().mockResolvedValue('trajeto-amanda-id')}
      confirmarTrajeto={vi.fn().mockResolvedValue(true)}
      removerTrajeto={vi.fn().mockResolvedValue(true)}
      recarregarTrajetos={vi.fn().mockResolvedValue(true)}
    />,
  )
}

describe('VtTrajetosTab — apresentação enxuta', () => {
  it('mostra dados verificáveis, sem transformar escopo e precisão em fatos', () => {
    setup()

    expect(screen.getByText('AMANDA ARAUJO DE CASTRO')).toBeInTheDocument()
    expect(screen.getByText('PLENA TECH ADMINISTRATIVO')).toBeInTheDocument()
    expect(screen.getByText('Cidade do posto não informada — necessária para revisar o trajeto.')).toBeInTheDocument()
    expect(screen.getByText('BU NITERÓI')).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s*11,20/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Rua e número')).not.toBeInTheDocument()
    expect(screen.queryByText('Somente bairro')).not.toBeInTheDocument()
    expect(screen.queryByText('Endereço incompleto')).not.toBeInTheDocument()
    expect(screen.getByText('Confirmado pelo RH')).toBeInTheDocument()

    expect(screen.queryByText('Intermunicipal')).not.toBeInTheDocument()
    expect(screen.queryByText('cartão: BUN', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText('exato')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ 2º bilhete' })).not.toBeInTheDocument()
    expect(screen.queryByText('Extra/dia R$')).not.toBeInTheDocument()
    expect(screen.getByTitle('Revisar itinerário')).toBeInTheDocument()
  })

  it('legado fica somente leitura e a revisão nova continua disponível', () => {
    setup()

    expect(screen.queryByRole('button', { name: 'Editar composição' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
    expect(screen.getByTitle('Revisar itinerário')).toBeInTheDocument()
  })

  it('perfil somente leitura não abre edição', () => {
    setup(false)

    expect(screen.queryByRole('button', { name: 'Editar composição' })).not.toBeInTheDocument()
    expect(screen.getByText('BU NITERÓI')).toBeInTheDocument()
  })

  it('abre a revisão em trajeto confirmado e avisa sobre a nova revisão', async () => {
    setup()

    fireEvent.click(screen.getByTitle('Revisar itinerário'))

    expect(await screen.findByText('Revisar itinerário — AMANDA ARAUJO DE CASTRO')).toBeInTheDocument()
    expect(screen.getByText(/Casa → PLENA TECH ADMINISTRATIVO/)).toBeInTheDocument()
    expect(screen.getByText(/nova revisão será criada somente ao salvar/)).toBeInTheDocument()
    expect(screen.getByText('Revisão assistida de itinerário')).toBeInTheDocument()
  })

  it('mostra a situação oficial do BU em coluna curta, sem o aviso longo', () => {
    const pessoa = { ...COLABORADOR, vt_bu_ativado: false, vt_bu_situacao: 'Suspenso Setrans' }
    setup(true, { ...TRAJETO, colaborador: pessoa }, { colaboradores: [pessoa] })

    expect(screen.getByText('Suspenso Setrans')).toBeInTheDocument()
    expect(screen.queryByText(/pode exigir integração/)).not.toBeInTheDocument()
  })

  it('inativo fica fora por padrão e aparece somente ao pedir histórico', () => {
    setup(true, { ...TRAJETO, colaborador: null }, {
      colaboradores: [],
      extrasTrajeto: new Map([['amanda-id', { nome_completo: COLABORADOR.nome_completo, status: 'Inativo' }]]),
    })

    expect(screen.queryByText(COLABORADOR.nome_completo)).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Mostrar histórico, afastados e inativos'))
    expect(screen.getByText(COLABORADOR.nome_completo)).toBeInTheDocument()
  })

  it('afastado fica fora por padrão e aparece com a caixa de histórico', () => {
    setup(true, { ...TRAJETO, colaborador: null }, {
      colaboradores: [],
      extrasTrajeto: new Map([['amanda-id', { nome_completo: COLABORADOR.nome_completo, status: 'Afastado' }]]),
    })

    expect(screen.queryByText(COLABORADOR.nome_completo)).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Mostrar histórico, afastados e inativos'))
    expect(screen.getByText(COLABORADOR.nome_completo)).toBeInTheDocument()
    expect(screen.getByText('Afastado')).toBeInTheDocument()
  })

  it('colaborador em 2 postos: linha sem rota diz "Rota ainda não cadastrada" e a outra tem aviso neutro', () => {
    const posto2: VtDepartamento = { ...DEPARTAMENTO, id: 'oscar-id', nome: 'OSCAR PEREIRA', nome_curto: 'OSCAR PEREIRA' }
    const pessoa = { ...COLABORADOR, departamento: 'OSCAR PEREIRA', departamento_id: 'oscar-id' }
    render(
      <VtTrajetosTab
        colaboradores={[pessoa]}
        departamentos={[DEPARTAMENTO, posto2]}
        bilhetes={[BILHETE]}
        trajetos={[{ ...TRAJETO, colaborador: pessoa }]}
        extrasTrajeto={new Map()}
        loading={false}
        usuarioId="usuario-id"
        podeGerenciar
        salvarTrajeto={vi.fn()}
        confirmarTrajeto={vi.fn()}
        removerTrajeto={vi.fn()}
        recarregarTrajetos={vi.fn()}
      />,
    )

    expect(screen.getByText('Rota ainda não cadastrada para este posto')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum bilhete escolhido')).not.toBeInTheDocument()
    expect(screen.getByText(/Também trabalha em OSCAR PEREIRA/)).toBeInTheDocument()
    expect(screen.getByText(/Esta rota\s+continua valendo para os dias neste posto/)).toBeInTheDocument()
  })

  it('endereço só com bairro mostra aviso âmbar junto ao nome', () => {
    setup(true, { ...TRAJETO, precisao_origem: 'bairro' })

    expect(screen.getByText('Endereço incompleto')).toBeInTheDocument()
    expect(screen.queryByText('Somente bairro')).not.toBeInTheDocument()
  })

  it('mostra as linhas orçadas (ida e volta) e o valor do dia quando há itinerário salvo', async () => {
    const perna = (linha: string, sentido: 'ida' | 'volta', sequencia: number) => ({ sequencia, linha, modal: 'onibus', sentido })
    evidencias.mapa = new Map([
      [
        TRAJETO.id,
        {
          itinerario: {
            pernas: [perna('62', 'ida', 1), perna('39A', 'ida', 2), perna('39A', 'volta', 1), perna('62', 'volta', 2)],
            calculoMotor: { valorDiaCentavos: 890 },
          },
        },
      ],
    ])
    try {
      setup()
      await waitFor(() => expect(screen.getByText('Ida: 62 → 39A · Volta: 39A → 62')).toBeInTheDocument())
      expect(screen.getByText(/R\$\s*8,90\/dia/)).toBeInTheDocument()
      expect(screen.queryByText('BU NITERÓI')).not.toBeInTheDocument()
    } finally {
      evidencias.mapa = new Map()
    }
  })
})
