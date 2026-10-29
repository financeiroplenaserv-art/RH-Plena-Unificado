import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { hojeBrasil } from '@/lib/utils'
import {
  agruparDiasPorPosto,
  aplicarCoberturas,
  calcularCargaMes,
  prontaParaGravar,
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
import {
  CHAVE_RASCUNHO_CARGA_VT,
  montarRascunhoCarga,
  validarRascunhoCarga,
  type RascunhoCargaVt,
} from '@/lib/vt/cargaRascunho'
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
  /** Optante FORA do relatório (sem match) — bloqueia a gravação (portão). */
  semEscala: boolean
  /**
   * No relatório, mas sem nenhum dia [T] — mês inteiro de férias/afastamento/
   * atestado (ou só folgas). NÃO bloqueia a gravação: valor R$ 0 ("não
   * trabalhou, não recebe"). Caso da dúvida de 27/10/2026.
   */
  semDiaDeTrabalho: boolean
  /** Dias [FR] do próprio colaborador no mês (fora da carga — informativo). */
  diasEmFerias: number
}

export interface ApoioCarga {
  colaboradores: VtColaborador[]
  departamentos: VtDepartamento[]
  trajetos: VtTrajeto[]
  bilhetes: VtBilhete[]
}

/** Estado REAL da gravação no banco para a competência carregada. */
export interface GravacaoCarga {
  /** Competência verificada — a tela só mostra o banner se bater com a atual. */
  competencia: string
  /** Quantas linhas de vt_cargas existem para a competência. */
  total: number
  /** Colaboradores gravados — o banner compara o CONJUNTO com o cálculo. */
  ids: string[]
  /** gerada_em mais recente (ISO) — null se a tabela não tem a data. */
  ultimaEm: string | null
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
  /** O que está de fato no banco para a competência (banner "gravada?"). */
  const [gravacao, setGravacao] = useState<GravacaoCarga | null>(null)
  /**
   * Pessoas parseadas do último relatório processado com sucesso — permitem
   * RECALCULAR sem o File (a aba desmonta ao trocar de aba e o File se
   * perde): registrar/excluir uma cobertura chama `reprocessar`, que refaz o
   * pipeline a partir daqui (auditoria C2 — antes o recalcular virava no-op
   * silencioso e os valores velhos eram gravados assim).
   */
  const pessoasRef = useRef<PessoaRelatorio[] | null>(null)
  const nomeArquivoRef = useRef<string | null>(null)

  /** Volta a tela ao estado vazio — falha do pipeline nunca deixa mistura de meses (auditoria C1). */
  const limparEstado = useCallback(() => {
    pessoasRef.current = null
    nomeArquivoRef.current = null
    setCompetencia(null)
    setResultados([])
    setFerias([])
    setCoberturaGeral([])
    setNomesSemMatch([])
    setCoberturaMes(null)
    setNomeArquivo(null)
    setForaDoVt(0)
    setGravacao(null)
    setLoading(false)
  }, [])

  /**
   * Lê vt_cargas da competência e devolve a contagem real (incidente de
   * 25/10/2026: a tela não mostrava se a gravação tinha acontecido e o
   * operador saía achando que estava salvo — o banco ficou vazio).
   */
  const verificarGravacao = useCallback(async (comp: string) => {
    const { data, error } = await supabase
      .from('vt_cargas')
      .select('colaborador_id, gerada_em')
      .eq('competencia', comp)
    if (error) {
      console.error('Erro ao verificar a carga gravada:', error.message)
      return
    }
    const linhas = (data ?? []) as { colaborador_id: string; gerada_em: string | null }[]
    const ultima =
      linhas
        .map((l) => l.gerada_em)
        .filter((e): e is string => !!e)
        .sort()
        .pop() ?? null
    setGravacao({ competencia: comp, total: linhas.length, ids: linhas.map((l) => l.colaborador_id), ultimaEm: ultima })
  }, [])

  /**
   * Pipeline da carga sobre as pessoas JÁ parseadas do relatório — usado pela
   * importação do arquivo e pela restauração do rascunho (27/10/2026: sair da
   * aba perdia tudo). Devolve a competência ('AAAA-MM') no sucesso, null na
   * falha. Não liga o loading — quem chama gerencia.
   */
  const processarPessoas = useCallback(
    async (pessoas: PessoaRelatorio[], nomeArq: string | null, apoio: ApoioCarga): Promise<string | null> => {
      // Auditoria C1: os estados só são PUBLICADOS no final, no sucesso —
      // antes, uma query que falhava no meio deixava os resultados do
      // relatório ANTERIOR com a competência nova (o "Gravar carga" gravaria
      // o cálculo de um mês na competência de outro). Tudo se acumula em
      // variáveis locais; na falha, limparEstado() volta a tela ao vazio.
      // O banner some no início e só volta no final, com a verificação fresca (M1).
      setGravacao(null)
      try {
        if (pessoas.length === 0 || pessoas.every((p) => p.dias.length === 0)) {
          toast.error('Nenhuma pessoa/dia encontrada — confira se é o relatório "Gestão de escalas" (aba "data")')
          limparEstado()
          return null
        }

        // Competência = mês das datas do relatório.
        const primeiraData = pessoas.flatMap((p) => p.dias).map((d) => d.data).sort()[0]
        const comp = primeiraData.slice(0, 7)
        const coberturaMesCalc = coberturaDoMesNoRelatorio(pessoas, comp)

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

        const optantes = apoio.colaboradores.filter((c) => c.vt_optante)
        const idsOptantes = new Set(optantes.map((c) => c.id))
        const casadosNaoOptantes = [...pessoaPorId.keys()].filter((id) => !idsOptantes.has(id)).length
        const foraDoVtN = nomesSemMatchLista.length + casadosNaoOptantes

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
          limparEstado()
          return null
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
            limparEstado()
            return null
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
            semEscala: !pessoa,
            semDiaDeTrabalho: !!pessoa && !pessoa.dias.some((d) => d.marca === 'trabalha'),
            diasEmFerias: pessoa ? pessoa.dias.filter((d) => d.marca === 'ferias').length : 0,
          }
        })

        lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

        // Sucesso: publica TUDO de uma vez (C1) e reverifica a gravação no
        // banco para o banner voltar sempre (M1) — inclusive ao reprocessar a
        // MESMA competência (não há efeito por mudança de competência na tela).
        pessoasRef.current = pessoas
        nomeArquivoRef.current = nomeArq
        setCompetencia(comp)
        setCoberturaMes(coberturaMesCalc)
        setNomeArquivo(nomeArq)
        setNomesSemMatch(nomesSemMatchLista)
        setForaDoVt(foraDoVtN)
        setFerias(blocos)
        setCoberturaGeral(todos)
        setResultados(lista)
        setLoading(false)
        await verificarGravacao(comp)
        return comp
      } catch (err) {
        console.error('Erro ao processar o relatório de escalas:', err)
        toast.error('Erro ao processar o relatório — tente importar de novo')
        limparEstado()
        return null
      }
    },
    [limparEstado, verificarGravacao]
  )

  /**
   * Refaz o pipeline a partir das pessoas guardadas do último processamento —
   * SEM depender do File (auditoria C2: a aba desmonta ao trocar de aba e o
   * File se perde; registrar/excluir cobertura precisa recalcular de verdade,
   * senão o portão destrava e os valores VELHOS da tabela são gravados).
   */
  const reprocessar = useCallback(
    async (apoio: ApoioCarga): Promise<boolean> => {
      const pessoas = pessoasRef.current
      if (!pessoas) return false
      setLoading(true)
      const comp = await processarPessoas(pessoas, nomeArquivoRef.current, apoio)
      return comp != null
    },
    [processarPessoas]
  )

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
        const comp = await processarPessoas(pessoas, arquivo.name, apoio)
        if (comp) {
          try {
            localStorage.setItem(
              CHAVE_RASCUNHO_CARGA_VT,
              JSON.stringify(montarRascunhoCarga(pessoas, arquivo.name, comp, new Date().toISOString()))
            )
          } catch {
            // Sem espaço no armazenamento: o rascunho é conveniência, nunca bloqueia.
          }
        }
        return comp != null
      } catch (err) {
        console.error('Erro ao importar o relatório de escalas:', err)
        toast.error('Erro ao ler o arquivo — confira se é o Excel da Gestão de escalas')
        setLoading(false)
        return false
      }
    },
    [processarPessoas]
  )

  /**
   * Restaura o rascunho do relatório salvo no aparelho ao voltar à aba
   * (incidente de 27/10/2026: sair da tela apagava o cálculo importado). O
   * pipeline roda de novo com os dados ATUAIS do banco — trajetos, coberturas
   * e fechamentos novos entram sozinhos. Rascunho inválido é descartado.
   */
  const restaurarRascunho = useCallback(
    async (apoio: ApoioCarga): Promise<boolean> => {
      let rascunho: RascunhoCargaVt | null = null
      try {
        const texto = localStorage.getItem(CHAVE_RASCUNHO_CARGA_VT)
        if (texto) rascunho = validarRascunhoCarga(JSON.parse(texto))
      } catch {
        rascunho = null
      }
      if (!rascunho) {
        try {
          localStorage.removeItem(CHAVE_RASCUNHO_CARGA_VT)
        } catch {
          // sem acesso ao armazenamento — nada a fazer
        }
        return false
      }
      setLoading(true)
      const comp = await processarPessoas(rascunho.pessoas, rascunho.nomeArquivo, apoio)
      if (comp) {
        toast.info(
          `Relatório "${rascunho.nomeArquivo ?? 'importado antes'}" restaurado — cálculo refeito com os dados atuais`
        )
      }
      return comp != null
    },
    [processarPessoas]
  )

  /**
   * Upsert por (colaborador_id, competencia) — regera a carga do mês sem
   * duplicar. Só grava quem passa no filtro único `prontaParaGravar` (sem
   * trajeto pendente, sem dia sem posto identificado e presente no
   * relatório); os demais ficam de fora e são contados.
   */
  const gravarCargas = useCallback(
    async (
      competencia: string,
      lista: ResultadoCargaColaborador[],
      usuarioId: string
    ): Promise<{ gravadas: number; puladas: number }> => {
      const prontos = lista.filter(prontaParaGravar)
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
        // Carimbo novo a cada regravação — o DEFAULT now() da coluna só vale
        // no INSERT; no upsert ele ficaria com a data da 1ª gravação.
        gerada_em: new Date().toISOString(),
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
      // Reconta no banco para o banner refletir o que ficou gravado de fato.
      await verificarGravacao(competencia)
      const gravadas = data?.length ?? 0
      if (gravadas !== prontos.length) {
        toast.error(`Só ${gravadas} de ${prontos.length} cargas foram gravadas (permissão) — confira`)
        return { gravadas, puladas: puladas + (prontos.length - gravadas) }
      }
      return { gravadas, puladas }
    },
    [verificarGravacao]
  )

  /** Excel da carga (o arquivo usado para creditar): só os cálculos completos. */
  const exportarExcel = useCallback(
    async (competencia: string, lista: ResultadoCargaColaborador[]): Promise<boolean> => {
      const prontos = lista.filter(prontaParaGravar)
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
    gravacao,
    loading,
    importarRelatorio,
    restaurarRascunho,
    reprocessar,
    gravarCargas,
    verificarGravacao,
    exportarExcel,
  }
}
