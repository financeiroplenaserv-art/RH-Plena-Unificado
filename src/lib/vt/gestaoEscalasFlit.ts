// Parser do relatório "Gestão de escalas" do Flit (Excel) — fonte oficial da
// carga mensal de VT (decisão da gestora, 21/10/2026 — docs/PLANO_MODULO_VT.md
// §6). O relatório é gerado ~dia 25 já com o mês seguinte programado.
//
// Formato real (validado com o arquivo da gestora): aba "data", cabeçalho
// ["Colaborador","Empresa","Departamento","Cargo","Horário","01/10/2026 - Qui.", ...]
// — uma coluna por dia do mês. Célula de dia: "[T] 07:00 - 12:00 - 13:00 -
// 19:00" (trabalha, com horários), "[F]" (folga), "[FR]" (férias), "[AF]"
// (afastado), "[AT]" (atestado) ou vazio. O posto vem da coluna Departamento
// (a coluna Horário também embute o posto — não usar, regra do briefing).

import { removerAcentos } from '@/lib/utils'

export type MarcaDia = 'trabalha' | 'folga' | 'ferias' | 'afastado' | 'atestado' | 'vazio'

export interface DiaRelatorio {
  data: string // 'AAAA-MM-DD'
  marca: MarcaDia
  /** Célula crua (com os horários no caso [T]). */
  texto: string
}

export interface PessoaRelatorio {
  nome: string
  departamentoTexto: string
  cargo: string
  horario: string
  dias: DiaRelatorio[]
}

const DIA_CABECALHO = /(\d{2})\/(\d{2})\/(\d{4})/

/** "01/10/2026 - Qui." → '2026-10-01' (montagem por string, sem Date). */
function parseDataCabecalho(texto: string): string | null {
  const m = String(texto).match(DIA_CABECALHO)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

function marcaDaCelula(texto: string): MarcaDia {
  const t = texto.trim().toUpperCase()
  if (t === '') return 'vazio'
  // Ordem importa: [FR]/[AF]/[AT] antes de [F]/[T].
  if (t.startsWith('[FR]')) return 'ferias'
  if (t.startsWith('[AF]')) return 'afastado'
  if (t.startsWith('[AT]')) return 'atestado'
  if (t.startsWith('[T]')) return 'trabalha'
  if (t.startsWith('[F]')) return 'folga'
  return 'vazio' // marca desconhecida: não é dia de trabalho
}

/**
 * Linhas já extraídas do xlsx (header: 1) → pessoas com os dias marcados.
 * A primeira linha é o cabeçalho; as colunas de dia são as que têm data.
 */
export function parseGestaoEscalas(linhas: unknown[][]): PessoaRelatorio[] {
  if (linhas.length === 0) return []
  const cabecalho = linhas[0].map((c) => String(c ?? '').trim())
  // Índices das colunas de dia (as que casam com a data) e dos campos fixos.
  const colunasDias: { indice: number; data: string }[] = []
  for (let i = 0; i < cabecalho.length; i++) {
    const data = parseDataCabecalho(cabecalho[i])
    if (data) colunasDias.push({ indice: i, data })
  }
  const pessoas: PessoaRelatorio[] = []
  for (let l = 1; l < linhas.length; l++) {
    const linha = linhas[l]
    const nome = String(linha[0] ?? '').trim()
    if (!nome) continue
    // Rodapé do Flit ("Legenda das escalas:" e a linha "[AF] - Afastado | [AT] -
    // Atestado...") não é pessoa: nome começando por colchete ou "Legenda", ou
    // linha sem Empresa e sem Departamento. Sem este corte a legenda entrava como
    // "nome sem match" e inflava os contadores (simulação de 23/10/2026).
    if (/^(\[|legenda das escalas)/i.test(nome)) continue
    if (!String(linha[1] ?? '').trim() && !String(linha[2] ?? '').trim()) continue
    pessoas.push({
      nome,
      departamentoTexto: String(linha[2] ?? '').trim(),
      cargo: String(linha[3] ?? '').trim(),
      horario: String(linha[4] ?? '').trim(),
      dias: colunasDias.map(({ indice, data }) => {
        const texto = String(linha[indice] ?? '').trim()
        return { data, marca: marcaDaCelula(texto), texto }
      }),
    })
  }
  return pessoas
}

/** Diferença em dias entre duas datas ISO (string) — via UTC, sem fuso. */
function diffDias(de: string, ate: string): number {
  const [a1, m1, d1] = de.split('-').map(Number)
  const [a2, m2, d2] = ate.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000)
}

export interface PeriodoFerias {
  inicio: string
  fim: string
  /** Dias NÃO-[FR] dentro do período mesclado (buracos de folga/trabalho do Flit). */
  diasIntercalados: number
}

/**
 * Blocos de férias ([FR]) → períodos início/fim. O relatório real do Flit
 * QUEBRA as férias com o padrão da escala vazando no meio (casos reais de
 * 22/10/2026: Leandro 10–30 com [F] no dia 12 e [T] no 15; Lourene 1–23 com
 * [T] no 12) — blocos [FR] separados por buraco de ATÉ 2 dias (qualquer
 * conteúdo) mesclam num período só, do primeiro ao último [FR] da cadeia.
 * Buraco de 3+ dias NÃO mescla (é outra férias ou volta real ao trabalho).
 * A contagem da carga não muda: [T] dentro do período segue contando trabalho
 * (regra "nunca a menos"; artefato do Flit se ajusta na reconciliação).
 */
export function periodosDeFerias(dias: DiaRelatorio[]): PeriodoFerias[] {
  const periodos: PeriodoFerias[] = []
  let aberto: PeriodoFerias | null = null
  for (const d of dias) {
    if (d.marca !== 'ferias') continue
    if (!aberto) {
      aberto = { inicio: d.data, fim: d.data, diasIntercalados: 0 }
      continue
    }
    const buraco = diffDias(aberto.fim, d.data) - 1
    if (buraco <= 2) {
      aberto.diasIntercalados += buraco
      aberto.fim = d.data
    } else {
      periodos.push(aberto)
      aberto = { inicio: d.data, fim: d.data, diasIntercalados: 0 }
    }
  }
  if (aberto) periodos.push(aberto)
  return periodos
}

/** Normalização do match de nomes: sem acento, maiúsculas, espaços simples. */
function normalizarNome(nome: string): string {
  return removerAcentos(nome).toUpperCase().replace(/\s+/g, ' ').trim()
}

export type CasamentoColaborador = { id: string } | { id: null } // id null = pendente

/**
 * Casa os nomes do relatório com os colaboradores ATIVOS por nome normalizado.
 * Exatamente 1 ativo com o nome → ok; 0 ou 2+ → pendente (NUNCA palpite —
 * regra "importação nunca grava palpite", AGENTS.md §12).
 */
export function casarColaboradores(
  nomes: string[],
  colaboradores: { id: string; nome_completo: string; status: string | null }[]
): Map<string, CasamentoColaborador> {
  const porNome = new Map<string, string[]>()
  for (const c of colaboradores) {
    if (c.status !== 'Ativo') continue
    const chave = normalizarNome(c.nome_completo)
    const lista = porNome.get(chave) ?? []
    lista.push(c.id)
    porNome.set(chave, lista)
  }
  const resultado = new Map<string, CasamentoColaborador>()
  for (const nome of nomes) {
    const matches = porNome.get(normalizarNome(nome)) ?? []
    resultado.set(nome, matches.length === 1 ? { id: matches[0] } : { id: null })
  }
  return resultado
}

export interface CoberturaMesRelatorio {
  /** Primeiro e último dia (colunas de data) do relatório dentro da competência. */
  primeiro: string | null
  ultimo: string | null
  /** Dias do mês da competência sem coluna no relatório ('AAAA-MM-DD'). */
  diasFaltando: string[]
  completo: boolean
}

/**
 * O relatório precisa trazer o mês da carga INTEIRO (dia 1 ao último). Caso
 * real de 23/10/2026: o relatório de outubro vinha só até 30/10. Só AVISA —
 * não bloqueia a gravação (os dias ausentes ficam sem VT na carga).
 */
export function coberturaDoMesNoRelatorio(pessoas: PessoaRelatorio[], competencia: string): CoberturaMesRelatorio {
  const datas = new Set<string>()
  for (const p of pessoas) for (const d of p.dias) if (d.data.startsWith(competencia)) datas.add(d.data)
  const [ano, mes] = competencia.split('-').map(Number)
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const diasFaltando: string[] = []
  for (let d = 1; d <= ultimoDia; d++) {
    const iso = `${competencia}-${String(d).padStart(2, '0')}`
    if (!datas.has(iso)) diasFaltando.push(iso)
  }
  const ordenadas = [...datas].sort()
  return {
    primeiro: ordenadas[0] ?? null,
    ultimo: ordenadas[ordenadas.length - 1] ?? null,
    diasFaltando,
    completo: diasFaltando.length === 0,
  }
}
