import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { hojeBrasil } from '@/lib/utils'
import {
  agruparDiasPorPosto,
  aplicarCoberturas,
  calcularCargaMes,
  resolverPostoDoRelatorio,
  situacaoCoberturaRelatorio,
  valorDaCarga,
  type DetalheCargaPosto,
  type FeriasBloco,
  type LinhaEscalaDia,
  type MarcasPorDia,
  type SituacaoCoberturaRelatorio,
} from '@/lib/vt/carga'
import {
  casarColaboradores,
  coberturaDoMesNoRelatorio,
  parseGestaoEscalas,
  periodosDeFerias,
  type CoberturaMesRelatorio,
  type PessoaRelatorio,
} from '@/lib/vt/gestaoEscalasFlit'
import { formatarCentavos } from '@/lib/vt/bilhetes'
import { ajusteDoFechamento, competenciaAnterior } from '@/lib/vt/fechamento'
import type { VtColaborador, VtDepartamento } from '@/hooks/useVt'
import type { VtBilhete, VtCobertura, VtTrajeto } from '@/types/vt'

// Carga mensal de VT pelo relatório "Gestão de escalas" do Flit (decisão da
// gestora, 21/10/2026 — docs/PLANO_MODULO_VT.md §6): o relatório (Excel,
// gerado ~dia 25 com o mês seguinte) é a FONTE OFICIAL — a leitura antiga de
// locais_trabalho_diario saiu da carga. Só entram os dias [T] dos optantes;
// [F]/[FR]/[AF]/[AT]/vazio não entram (não trabalhou, não recebe). Cobertura
// de férias (vt_coberturas) vence o relatório: o dia do ferista conta no posto
// coberto, inclusive em folga/vazio do relatório dele (o Flit não mostra o
// destino — por isso o registro existe). Posto sem trajeto confirmado e dia
// sem posto identificado NUNCA ganham custo inventado: aparecem como pendência
// e seguram a gravação (portão na tela).

export interface ResultadoCargaColaborador {
  colaborador_id: string
  nome: string
  detalhe: DetalheCargaPosto[]
  necessidade_centavos: number
  /**
   * Ajuste do fechamento da competência anterior (migrations 161/162):
   * crédito − desconto — pode ser positivo (trabalhou fora da carga) ou
   * negativo (faltou).
   */
  ajuste_centavos: number
  /** Parte do ajuste que é desconto (positivo) — para o texto da coluna Total. */
  ajusteDescontoCentavos: number
  /** Parte do ajuste que é crédito (positivo) — para o texto da coluna Total. */
  ajusteCreditoCentavos: number
  /** Desconto que passou da necessidade e foi truncado pelo piso 0 (centavos, positivo) — não se perde em silêncio: a tela avisa. */
  ajusteExcedenteCentavos: number
  valor_centavos: number
  /** Postos escalados sem trajeto confirmado (não somaram). */
  pendentes: { departamento_id: string; rotulo: string; dias: number }[]
  /** Dias cujo posto (texto do relatório) não casou com nenhum departamento. */
  diasSemPostoIdentificado: number
  locaisNaoIdentificados: string[]
  /** Optante sem dia de trabalho no relatório (ou fora dele — sem match). */
  semEscala: boolean
  /** Dias [FR] do próprio colaborador no mês (fora da carga — informativo). */
  diasEmFerias: number
}

export interface ApoioCarga {
  colaboradores: VtColaborador[]
  departamentos: VtDepartamento[]
  trajetos: VtTrajeto[]
  bilhetes: VtBilhete[]
}

/**
 * Completude do relatório para TODOS, optantes ou não (decisão da gestora,
 * 23/10/2026): cada pessoa precisa estar escalada com posto identificado, de
 * férias/afastada, ou cobrindo alguém. Visão de conferência — não bloqueia a
 * gravação (o VT dos optantes não depende dos demais).
 */
export interface PessoaCoberturaRelatorio {
  colaborador_id: string
  nome: string
  optante: boolean
  situacao: SituacaoCoberturaRelatorio
  /** Dias [T] com posto identificado (inclui os sintetizados por cobertura). */
  diasTrabalho: number
  diasTrabalhoSemPosto: number
  locaisNaoIdentificados: string[]
  /** [FR] + [AF] + [AT]. */
  diasAusencia: number
}

/** Último dia do mês da competência ('AAAA-MM') como string local. */
function fimDoMes(competencia: string): string {
  const [a, m] = competencia.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}

export function useVtCarga() {
  const [resultados, setResultados] = useState<ResultadoCargaColaborador[]>([])
  const [ferias, setFerias] = useState<FeriasBloco[]>([])
  const [competencia, setCompetencia] = useState<string | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  /** Pessoas do relatório fora do VT: sem match no cadastro ou não optantes. */
  const [foraDoVt, setForaDoVt] = useState(0)
  /** Completude de TODOS os casados (optantes ou não) — visão de conferência. */
  const [coberturaGeral, setCoberturaGeral] = useState<PessoaCoberturaRelatorio[]>([])
  /** Nomes do relatório sem match no cadastro (nunca palpite). */
  const [nomesSemMatch, setNomesSemMatch] = useState<string[]>([])
  /** O relatório traz o mês inteiro? (só aviso — não bloqueia a gravação). */
  const [coberturaMes, setCoberturaMes] = useState<CoberturaMesRelatorio | null>(null)
  const [loading, setLoading] = useState(false)

  const importarRelatorio = useCallback(
    async (arquivo: File, apoio: ApoioCarga): Promise<boolean> => {
      setLoading(true)
      try {
        const XLSX = await import('@e965/xlsx')
        const buffer = await arquivo.arrayBuffer()
        const workbook = XLSX.read(buffer)
        const planilha = workbook.Sheets['data'] ?? workbook.Sheets[workbook.SheetNames[0]]
        const linhasBrutas = XLSX.utils.sheet_to_json(planilha, { header: 1, defval: '' }) as unknown[][]
        const pessoas = parseGestaoEscalas(linhasBrutas)
        if (pessoas.length === 0 || pessoas.every((p) => p.dias.length === 0)) {
          toast.error('Nenhuma pessoa/dia encontrada — confira se é o relatório "Gestão de escalas" (aba "data")')
          setLoading(false)
          return false
        }

        // Competência = mês das datas do relatório.
        const primeiraData = pessoas.flatMap((p) => p.dias).map((d) => d.data).sort()[0]
        const comp = primeiraData.slice(0, 7)
        setCompetencia(comp)
        setCoberturaMes(coberturaDoMesNoRelatorio(pessoas, comp))
        setNomeArquivo(arquivo.name)

        // A lista do useVt já é só de ativos (listarColaboradores filtra) — o
        // match recebe status 'Ativo' explícito para a regra "só ativos".
        const casamento = casarColaboradores(
          pessoas.map((p) => p.nome),
          apoio.colaboradores.map((c) => ({ id: c.id, nome_completo: c.nome_completo, status: 'Ativo' }))
        )
        const pessoaPorId = new Map<string, PessoaRelatorio>()
        const nomesSemMatchLista: string[] = []
        for (const p of pessoas) {
          const c = casamento.get(p.nome)
          if (c?.id) pessoaPorId.set(c.id, p)
          else nomesSemMatchLista.push(p.nome)
        }
        setNomesSemMatch(nomesSemMatchLista)

        const optantes = apoio.colaboradores.filter((c) => c.vt_optante)
        const idsOptantes = new Set(optantes.map((c) => c.id))
        const casadosNaoOptantes = [...pessoaPorId.keys()].filter((id) => !idsOptantes.has(id)).length
        setForaDoVt(nomesSemMatchLista.length + casadosNaoOptantes)

        // Coberturas que tocam o mês (todas — o pipeline usa as com ferista;
        // o clamp ao mês evita sintetizar dias fora da competência).
        const inicioMes = `${comp}-01`
        const fimMes = fimDoMes(comp)
        const { data: dadosCoberturas, error: erroCoberturas } = await supabase
          .from('vt_coberturas')
          .select('*')
          .lte('data_inicio', fimMes)
          .gte('data_fim', inicioMes)
        if (erroCoberturas) {
          console.error('Erro ao ler coberturas do VT:', erroCoberturas.message)
          toast.error('Erro ao carregar as coberturas de férias')
          setLoading(false)
          return false
        }
        const coberturas = ((dadosCoberturas as VtCobertura[]) ?? []).map((c) => ({
          ...c,
          data_inicio: c.data_inicio < inicioMes ? inicioMes : c.data_inicio,
          data_fim: c.data_fim > fimMes ? fimMes : c.data_fim,
        }))

        // local(posto em texto) → departamento: fuzzy, mesma regra do projeto.
        const resolver = (nome: string) => {
          const dep = resolverPostoDoRelatorio(apoio.departamentos, nome)
          return dep ? { id: dep.id, rotulo: dep.nome_curto?.trim() || dep.nome.trim() } : null
        }
        const rotuloDoDepartamento = (depId: string) => {
          const dep = apoio.departamentos.find((d) => d.id === depId)
          return dep?.nome_curto?.trim() || dep?.nome.trim() || '—'
        }

        // Pipeline: dias [T] do relatório → coberturas (vencem) → agrupar.
        const linhas: LinhaEscalaDia[] = []
        const marcasPorDia: MarcasPorDia = new Map()
        for (const [id, pessoa] of pessoaPorId) {
          marcasPorDia.set(id, new Map(pessoa.dias.map((d) => [d.data, d.marca])))
          for (const d of pessoa.dias) {
            if (d.marca !== 'trabalha') continue
            linhas.push({
              colaborador_id: id,
              data: d.data,
              local_nome: pessoa.departamentoTexto || null,
              local_nome_curto: null,
            })
          }
        }
        const linhasComCobertura = aplicarCoberturas(linhas, coberturas, rotuloDoDepartamento, marcasPorDia)
        const { porColaborador, naoIdentificados } = agruparDiasPorPosto(linhasComCobertura, resolver)

        // Blocos [FR] do relatório = as férias do mês (dirigem o portão).
        const blocos: FeriasBloco[] = []
        for (const [id, pessoa] of pessoaPorId) {
          const depTitular = pessoa.departamentoTexto
            ? resolverPostoDoRelatorio(apoio.departamentos, pessoa.departamentoTexto)
            : null
          for (const b of periodosDeFerias(pessoa.dias)) {
            blocos.push({
              colaborador_id: id,
              data_inicio: b.inicio,
              data_fim: b.fim,
              departamento_id: depTitular?.id ?? null,
            })
          }
        }
        setFerias(blocos)

        // Completude de TODOS os casados (optantes ou não) — decisão da
        // gestora, 23/10/2026: conferência de que cada pessoa está em algum
        // lugar (posto identificado, férias/afastamento, ou cobrindo alguém).
        const nomePorId = new Map(apoio.colaboradores.map((c) => [c.id, c.nome_completo]))
        const todos: PessoaCoberturaRelatorio[] = []
        for (const [id, pessoa] of pessoaPorId) {
          const porPosto = porColaborador.get(id)
          const diasTrabalho = porPosto
            ? Array.from(porPosto.values()).reduce((acc, v) => acc + v.dias, 0)
            : 0
          const semPosto = naoIdentificados.get(id)
          const diasTrabalhoSemPosto = semPosto
            ? Array.from(semPosto.values()).reduce((acc, n) => acc + n, 0)
            : 0
          const diasAusencia = pessoa.dias.filter(
            (d) => d.marca === 'ferias' || d.marca === 'afastado' || d.marca === 'atestado'
          ).length
          todos.push({
            colaborador_id: id,
            nome: nomePorId.get(id) ?? pessoa.nome,
            optante: idsOptantes.has(id),
            situacao: situacaoCoberturaRelatorio({
              diasTrabalhoIdentificados: diasTrabalho,
              diasTrabalhoSemPosto,
              diasAusencia,
            }),
            diasTrabalho,
            diasTrabalhoSemPosto,
            locaisNaoIdentificados: semPosto ? Array.from(semPosto.keys()) : [],
            diasAusencia,
          })
        }
        todos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        setCoberturaGeral(todos)

        // Ajuste do fechamento do mês anterior (Fase 2b): faltou → desconta;
        // trabalhou fora da carga → credita (ajuste = crédito − desconto).
        // Erro de leitura ABORTA — nunca calcular com ajuste 0 fingindo que
        // não há fechamento.
        const fechamentoPorColab = new Map<string, ReturnType<typeof ajusteDoFechamento>>()
        const idsOpt = optantes.map((c) => c.id)
        const compAnt = competenciaAnterior(comp)
        for (let i = 0; i < idsOpt.length; i += 100) {
          const { data: fechs, error: erroFech } = await supabase
            .from('vt_fechamentos')
            .select('colaborador_id, desconto_centavos, credito_centavos')
            .eq('competencia', compAnt)
            .in('colaborador_id', idsOpt.slice(i, i + 100))
          if (erroFech) {
            console.error('Erro ao ler fechamentos do VT:', erroFech.message)
            toast.error('Erro ao carregar o fechamento do mês anterior — carga não calculada')
            setLoading(false)
            return false
          }
          for (const f of (fechs ?? []) as {
            colaborador_id: string
            desconto_centavos: number
            credito_centavos: number | null
          }[]) {
            fechamentoPorColab.set(f.colaborador_id, ajusteDoFechamento(f))
          }
        }

        const hoje = hojeBrasil()
        const lista: ResultadoCargaColaborador[] = optantes.map((c) => {
          const porPosto = porColaborador.get(c.id)
          const diasPorPosto = porPosto
            ? Array.from(porPosto.entries()).map(([departamento_id, v]) => ({
                departamento_id,
                rotulo: v.rotulo,
                dias: v.dias,
                diasCobertura: v.diasCobertura,
                diasTreinamento: v.diasTreinamento,
                datas: v.datas,
              }))
            : []
          const calc = calcularCargaMes(
            diasPorPosto,
            apoio.trajetos.filter((t) => t.colaborador_id === c.id),
            apoio.bilhetes,
            hoje
          )
          const semMatchLocal = naoIdentificados.get(c.id)
          const diasSemPosto = semMatchLocal ? Array.from(semMatchLocal.values()).reduce((a, b) => a + b, 0) : 0
          const fech = fechamentoPorColab.get(c.id)
          const ajuste = fech?.ajuste ?? 0
          const valor = valorDaCarga(calc.necessidade_centavos, ajuste)
          const excedente = valor.ajusteMaiorQueNecessidade ? -(calc.necessidade_centavos + ajuste) : 0
          const pessoa = pessoaPorId.get(c.id)
          return {
            colaborador_id: c.id,
            nome: c.nome_completo,
            detalhe: calc.detalhe,
            necessidade_centavos: calc.necessidade_centavos,
            ajuste_centavos: ajuste,
            ajusteDescontoCentavos: fech?.desconto ?? 0,
            ajusteCreditoCentavos: fech?.credito ?? 0,
            ajusteExcedenteCentavos: excedente,
            valor_centavos: valor.valor_centavos,
            pendentes: calc.pendentes,
            diasSemPostoIdentificado: diasSemPosto,
            locaisNaoIdentificados: semMatchLocal ? Array.from(semMatchLocal.keys()) : [],
            semEscala: !pessoa || !pessoa.dias.some((d) => d.marca === 'trabalha'),
            diasEmFerias: pessoa ? pessoa.dias.filter((d) => d.marca === 'ferias').length : 0,
          }
        })

        lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        setResultados(lista)
        setLoading(false)
        return true
      } catch (err) {
        console.error('Erro ao importar o relatório de escalas:', err)
        toast.error('Erro ao ler o arquivo — confira se é o Excel da Gestão de escalas')
        setLoading(false)
        return false
      }
    },
    []
  )

  /**
   * Upsert por (colaborador_id, competencia) — regera a carga do mês sem
   * duplicar. Só grava cálculo COMPLETO (sem posto pendente de trajeto e sem
   * dia sem posto identificado); os demais ficam de fora e são contados.
   */
  const gravarCargas = useCallback(
    async (
      competencia: string,
      lista: ResultadoCargaColaborador[],
      usuarioId: string
    ): Promise<{ gravadas: number; puladas: number }> => {
      const prontos = lista.filter((r) => r.pendentes.length === 0 && r.diasSemPostoIdentificado === 0)
      const puladas = lista.length - prontos.length
      if (prontos.length === 0) {
        return { gravadas: 0, puladas }
      }
      const linhas = prontos.map((r) => ({
        colaborador_id: r.colaborador_id,
        competencia,
        detalhe: r.detalhe,
        necessidade_centavos: r.necessidade_centavos,
        ajuste_centavos: r.ajuste_centavos,
        valor_centavos: r.valor_centavos,
        gerada_por: usuarioId,
      }))
      const { data, error } = await supabase
        .from('vt_cargas')
        .upsert(linhas, { onConflict: 'colaborador_id,competencia' })
        .select('id')
      if (error) {
        console.error('Erro ao gravar cargas de VT:', error.message)
        toast.error('Erro ao gravar as cargas')
        return { gravadas: 0, puladas }
      }
      const gravadas = data?.length ?? 0
      if (gravadas !== prontos.length) {
        toast.error(`Só ${gravadas} de ${prontos.length} cargas foram gravadas (permissão) — confira`)
        return { gravadas, puladas: puladas + (prontos.length - gravadas) }
      }
      return { gravadas, puladas }
    },
    []
  )

  /** Excel da carga (o arquivo usado para creditar): só os cálculos completos. */
  const exportarExcel = useCallback(
    async (competencia: string, lista: ResultadoCargaColaborador[]): Promise<boolean> => {
      const prontos = lista.filter((r) => r.pendentes.length === 0 && r.diasSemPostoIdentificado === 0)
      if (prontos.length === 0) {
        toast.info('Nenhuma carga pronta para exportar (há pendências de trajeto ou posto).')
        return false
      }
      try {
        const XLSX = await import('@e965/xlsx')
        const dados = prontos.map((r) => ({
          Colaborador: r.nome,
          Postos: r.detalhe
            .map((d) => `${d.posto} ${d.dias}d × ${formatarCentavos(d.custo_dia_centavos)}`)
            .join('; '),
          'Total a creditar (R$)': r.valor_centavos / 100,
        }))
        const worksheet = XLSX.utils.json_to_sheet(dados)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Carga VT')
        XLSX.writeFile(workbook, `vt_carga_${competencia}.xlsx`)
        toast.success(`${dados.length} carga(s) exportada(s) para Excel.`)
        if (prontos.length < lista.length) {
          toast.info(`${lista.length - prontos.length} optante(s) com pendência ficaram fora do Excel.`)
        }
        return true
      } catch (err) {
        console.error('Erro ao exportar Excel do VT:', err)
        toast.error('Erro ao exportar o Excel')
        return false
      }
    },
    []
  )

  return {
    resultados,
    ferias,
    competencia,
    nomeArquivo,
    foraDoVt,
    coberturaGeral,
    nomesSemMatch,
    coberturaMes,
    loading,
    importarRelatorio,
    gravarCargas,
    exportarExcel,
  }
}
