/**
 * Etapa 1 — shadow mode do novo núcleo tarifário.
 * Não acessa Supabase nem Google, não grava trajetos/cargas e não altera o banco.
 * Uso: npx tsx --tsconfig tsconfig.scripts.json scripts/vt/shadow-cotacao.ts
 */

import fs from 'fs'
import { cotarCatraca } from '../../src/lib/vt/cotarCatraca'
import { REGRAS_OFICIAIS_VT } from '../../src/lib/vt/regrasOficiais'
import { compararPacoteLegadoComCotacao } from '../../src/lib/vt/adaptadoresLegados'
import { formatarCentavos } from '../../src/lib/vt/bilhetes'
import type { FatosCartaoVT, PernaItinerarioVT } from '../../src/lib/vt/contratosTarifarios'

const CARTAO: FatosCartaoVT = {
  personalizacao: 'usuario',
  vinculadoCpf: true,
  bui: 'ativo',
  bun: 'ativo',
  jae: 'disponivel',
  situacaoConsultadaEm: '2026-11-14',
}

interface Caso {
  id: string
  descricao: string
  pacoteAtual: string
  valorAtual: number
  pernas: PernaItinerarioVT[]
  cartao?: FatosCartaoVT
}

function perna(parcial: Partial<PernaItinerarioVT>): PernaItinerarioVT {
  return {
    sequencia: 1,
    linha: 'L1',
    variante: null,
    operadora: 'Operadora',
    modal: 'onibus',
    categoriaServico: 'urbano_convencional',
    sistemaTarifario: 'riocard',
    escopo: 'municipal',
    municipioOrigem: 'Niterói',
    municipioDestino: 'Niterói',
    sentido: 'ida',
    embarque: { local: 'A', dataHoraPrevista: '2026-11-16T09:00:00Z' },
    desembarque: { local: 'B', dataHoraPrevista: '2026-11-16T09:20:00Z' },
    tarifaCentavos: null,
    tarifaVigenteDesde: '2026-01-01',
    ...parcial,
  }
}

function segunda(parcial: Partial<PernaItinerarioVT> = {}): PernaItinerarioVT {
  return perna({ sequencia: 2, linha: 'L2', embarque: { local: 'C', dataHoraPrevista: '2026-11-16T09:30:00Z' }, ...parcial })
}

const sg = () => perna({ municipioOrigem: 'São Gonçalo', municipioDestino: 'São Gonçalo' })
const rio = () => perna({ municipioOrigem: 'Rio de Janeiro', municipioDestino: 'Rio de Janeiro', sistemaTarifario: 'jae' })
const inter = (linha = '484M') => perna({ linha, escopo: 'intermunicipal', municipioOrigem: 'São Gonçalo', municipioDestino: 'Niterói', sistemaTarifario: 'detro' })

const CASOS: Caso[] = [
  {
    id: 'BUN-01',
    descricao: 'Duas linhas diferentes de Niterói, mesmo sentido e 30 minutos',
    pacoteAtual: 'BU NITERÓI', valorAtual: 1120, pernas: [perna({}), segunda()],
  },
  {
    id: 'BUN-02',
    descricao: 'Duas validações na mesma linha de Niterói — não integra',
    pacoteAtual: 'BU NITERÓI', valorAtual: 1120, pernas: [perna({}), segunda({ linha: 'L1' })],
  },
  {
    id: 'BUI-01',
    descricao: 'Municipal de SG + 484M, BUI ativo',
    pacoteAtual: 'BILHETE ÚNICO INTERMUNICIPAL', valorAtual: 1880, pernas: [sg(), segunda(inter())],
  },
  {
    id: 'NIT-EXC-01',
    descricao: '484M + municipal de Niterói — exceção: BUI não cobre o municipal',
    pacoteAtual: 'BILHETE ÚNICO INTERMUNICIPAL', valorAtual: 1880, pernas: [inter(), segunda()],
  },
  {
    id: 'RIO-01',
    descricao: 'Intermunicipal + municipal do Rio com BUI — não somar Jaé',
    pacoteAtual: 'BUI + CARTÃO JAE RJ', valorAtual: 3280, pernas: [inter(), segunda(rio())],
  },
  {
    id: 'RIO-02',
    descricao: 'Intermunicipal + municipal do Rio sem BUI — cartões e tarifas separados',
    pacoteAtual: 'BUI + CARTÃO JAE RJ', valorAtual: 3280, pernas: [inter(), segunda(rio())],
    cartao: { ...CARTAO, bui: 'nao_possui' },
  },
  {
    id: 'SG-492M',
    descricao: '492M direta: tarifa comum R$ 9,10 é menor que BUI',
    pacoteAtual: 'BILHETE ÚNICO INTERMUNICIPAL', valorAtual: 1880,
    pernas: [inter('492M')],
  },
  {
    id: 'SG-100D',
    descricao: '100D direta: BUI na catraca; base patronal fica pendente',
    pacoteAtual: 'PASSAGEM SÃO GONÇALO', valorAtual: 1420,
    pernas: [perna({ linha: '100D', escopo: 'intermunicipal', municipioOrigem: 'Niterói', municipioDestino: 'Rio de Janeiro', sistemaTarifario: 'detro' })],
  },
  {
    id: 'TRILHO-01',
    descricao: 'Trem + metrô com BUI, dentro de 120 minutos',
    pacoteAtual: 'ÔNIBUS, TREM E METRÔ', valorAtual: 2880,
    pernas: [
      perna({ modal: 'trem', escopo: 'intermunicipal', municipioOrigem: 'São Gonçalo', municipioDestino: 'Rio de Janeiro', sistemaTarifario: 'supervia' }),
      segunda({ modal: 'metro', municipioOrigem: 'Rio de Janeiro', municipioDestino: 'Rio de Janeiro', sistemaTarifario: 'metrorio' }),
    ],
  },
  {
    id: 'EVID-01',
    descricao: 'Municipal SG + 484M sem horário da segunda validação',
    pacoteAtual: 'BILHETE ÚNICO INTERMUNICIPAL', valorAtual: 1880,
    pernas: [sg(), segunda({ ...inter(), embarque: { local: 'C', dataHoraPrevista: null } })],
  },
  {
    id: 'EVID-02',
    descricao: 'Três pernas — excedente e combinação exigem revisão',
    pacoteAtual: 'BILHETE ÚNICO INTERMUNICIPAL', valorAtual: 1880,
    pernas: [sg(), segunda(inter()), perna({ sequencia: 3, linha: 'L3' })],
  },
  {
    id: 'EVID-03',
    descricao: 'Linha intermunicipal sem tarifa conhecida — não inventar valor',
    pacoteAtual: 'BILHETE ÚNICO INTERMUNICIPAL', valorAtual: 1880,
    pernas: [perna({ linha: 'DESCONHECIDA', escopo: 'intermunicipal', municipioOrigem: 'Maricá', municipioDestino: 'Niterói' })],
  },
]

const linhas: string[] = []
const observacoes: string[] = []
const contagens = new Map<string, number>()
for (const caso of CASOS) {
  const cotacao = cotarCatraca(
    { pernas: caso.pernas, provedor: 'manual', consultadoEm: '2026-11-14T12:00:00Z', precisao: 'manual', evidenciaHash: `shadow-${caso.id}` },
    caso.cartao ?? CARTAO,
    REGRAS_OFICIAIS_VT,
    '2026-11-16',
  )
  const comparacao = compararPacoteLegadoComCotacao(caso.valorAtual, cotacao)
  contagens.set(comparacao.status, (contagens.get(comparacao.status) ?? 0) + 1)
  const valorNovo = comparacao.valorCotadoDiaCentavos == null ? '—' : formatarCentavos(comparacao.valorCotadoDiaCentavos)
  const pendencias = cotacao.pendencias.map((item) => item.codigo).join(', ') || '—'
  linhas.push(`| ${caso.id} | ${caso.descricao} | ${formatarCentavos(caso.valorAtual)} | ${cotacao.status} / ${cotacao.alternativaEscolhidaId ?? '—'} | ${valorNovo} | ${comparacao.status} | ${pendencias} |`)
  if (comparacao.basePatronalPendente) {
    observacoes.push(`**${caso.id}:** a cotação é da catraca. A substituição do pacote patronal pelo BUI direto continua pendente de DP/jurídico/Riocard.`)
  }
}

const arquivoPocAntiga = 'dados-locais/poc_rotas_api_2026-11-02.csv'
const registrosPocAntiga = fs.existsSync(arquivoPocAntiga)
  ? fs.readFileSync(arquivoPocAntiga, 'utf-8').split('\n').filter((linha) => linha.trim()).length - 1
  : 0

const relatorio = `# VT — shadow mode da nova cotação (14/11/2026)\n\n` +
  `Somente leitura. Nenhum trajeto, carga, preço ou dado do banco foi alterado. Os casos são estruturados e não contêm dados pessoais.\n\n` +
  `## Resumo\n\n` +
  [...contagens.entries()].map(([status, quantidade]) => `- ${status}: ${quantidade}`).join('\n') +
  `\n\n## Casos\n\n` +
  `| Caso | Descrição | Pacote atual/dia | Nova cotação | Novo valor/dia | Comparação | Pendências |\n` +
  `|---|---|---:|---|---:|---|---|\n` +
  linhas.join('\n') +
  (observacoes.length > 0 ? `\n\n${observacoes.join('\n\n')}` : '') +
  `\n\n## Limite da POC antiga\n\n` +
  `A POC de 02/11/2026 contém ${registrosPocAntiga} registros, mas o CSV não preserva horários de validação, tarifas estruturadas, origem/destino de cada perna e demais evidências exigidas pelo novo contrato. Por isso ela não foi usada para confirmar preços nesta etapa. Uma nova coleta/adaptação será necessária antes da comparação em escala.\n`

const out = 'dados-locais/vt_shadow_2026-11-14.md'
fs.writeFileSync(out, relatorio)
console.log(`Shadow mode: ${CASOS.length} casos`)
for (const [status, quantidade] of contagens) console.log(`${status}: ${quantidade}`)
console.log(`Relatório: ${out}`)
