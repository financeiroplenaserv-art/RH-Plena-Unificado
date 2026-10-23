import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { extrairPaginasPosicionais } from '@/lib/pdfPosicional'
import {
  normalizarCPF,
  parsePaginasEspelho,
  type EspelhoColaborador,
} from '@/lib/ocorrencias/importacaoPonto'
import {
  baixarArquivo,
  listarArquivosQueTocamPeriodo,
  type PontoEspelhoArquivo,
} from '@/lib/adicionais/pontoEspelhoArquivos'
import { escolherConjuntoDoPeriodo, ordenarParaMescla } from '@/lib/vt/escolherEspelho'
import {
  conciliarCarga,
  diasDoEspelho,
  type DiasEspelho,
  type ResultadoFechamento,
} from '@/lib/vt/fechamento'
import type { VtCarga } from '@/types/vt'

// Fechamento do VT (Fase 2b — decisão da gestora, 23/10/2026): confere a carga
// do mês civil contra o ponto real (os espelhos dos DOIS períodos que cobrem o
// mês — ponto fecha 20→19; cada período pode vir em vários arquivos, mesclados
// com a regra "dia repetido → vale o enviado mais recentemente"). Faltou
// (qualquer motivo) → desconta; trabalhou fora da carga → credita no posto de
// referência (decisão de 23/10/2026). Dia sem linha no espelho = não
// conferido, nunca desconta sem evidência. O resultado é gravado em
// vt_fechamentos (migrations 161/162) e a carga do mês seguinte lê
// crédito − desconto como ajuste_centavos. Toda escrita confere as linhas afetadas
// (anti-falso-sucesso, AGENTS.md §12).

export interface CargaComColaborador extends VtCarga {
  nome: string
  cpf: string | null
}

export interface EspelhosDoPeriodo {
  /** Arquivos arquivados cujo período toca o período de ponto. */
  arquivos: PontoEspelhoArquivo[]
  /** Conjunto sugerido (cobre o período com o menor número de arquivos). */
  sugeridos: PontoEspelhoArquivo[]
}

export interface PreviaFechamento {
  colaborador_id: string
  nome: string
  resultado: ResultadoFechamento | null // null = carga antiga sem datas no detalhe, ou fora dos espelhos
  semEspelho: boolean // colaborador não aparece em nenhum dos espelhos
  jaFechadoEm: string | null // updated_at do fechamento já gravado, se houver
}

/** Períodos de ponto (20→19) que cobrem o mês civil: A = 20/(m−1) → 19/m, B = 20/m → 19/(m+1). */
export function periodosDePontoDoMes(competencia: string): { a: [string, string]; b: [string, string] } {
  const [ano, mes] = competencia.split('-').map(Number)
  const iso = (a: number, m: number, d: number) =>
    `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const [anoAnt, mesAnt] = mes === 1 ? [ano - 1, 12] : [ano, mes - 1]
  const [anoSeg, mesSeg] = mes === 12 ? [ano + 1, 1] : [ano, mes + 1]
  return {
    a: [iso(anoAnt, mesAnt, 20), iso(ano, mes, 19)],
    b: [iso(ano, mes, 20), iso(anoSeg, mesSeg, 19)],
  }
}

/**
 * Mescla os dias dos espelhos do colaborador na competência. Os espelhos já
 * chegam na ordem de mescla (arquivo mais antigo primeiro): o dia repetido
 * fica com o arquivo enviado mais recentemente.
 */
function mesclarDias(espelhos: EspelhoColaborador[], competencia: string): DiasEspelho {
  const mapa: DiasEspelho = new Map()
  for (const esp of espelhos) {
    for (const [data, dia] of diasDoEspelho(esp, competencia)) mapa.set(data, dia)
  }
  return mapa
}

export function useVtFechamento() {
  const [competencias, setCompetencias] = useState<string[]>([])
  const [cargas, setCargas] = useState<CargaComColaborador[]>([])
  const [previas, setPrevias] = useState<PreviaFechamento[]>([])
  const [fechadosEm, setFechadosEm] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [processando, setProcessando] = useState(false)

  /** Competências que têm carga gravada (mais recente primeiro). */
  const listarCompetencias = useCallback(async (): Promise<void> => {
    const { data, error } = await supabase
      .from('vt_cargas')
      .select('competencia')
      .order('competencia', { ascending: false })
    if (error) {
      console.error('Erro ao listar competências de VT:', error.message)
      toast.error('Erro ao carregar as competências')
      return
    }
    setCompetencias([...new Set((data ?? []).map((r) => r.competencia as string))])
  }, [])

  /** Cargas do mês + nome/CPF do colaborador + carimbo de quem já tem fechamento. */
  const carregarCargas = useCallback(async (competencia: string): Promise<boolean> => {
    setLoading(true)
    setPrevias([])
    const [{ data: linhas, error: erroCargas }, { data: fechados }] = await Promise.all([
      supabase.from('vt_cargas').select('*').eq('competencia', competencia),
      supabase.from('vt_fechamentos').select('colaborador_id, updated_at').eq('competencia', competencia),
    ])
    if (erroCargas) {
      console.error('Erro ao carregar cargas do VT:', erroCargas.message)
      toast.error('Erro ao carregar as cargas do mês')
      setLoading(false)
      return false
    }
    const ids = (linhas ?? []).map((r) => r.colaborador_id as string)
    // Em lotes de 100: .in() com todos os ids estoura o limite de URL do
    // gateway quando o número de optantes cresce (233 ids ≈ 9 KB hoje).
    const colabs: { id: string; nome_completo: string; cpf: string | null }[] = []
    let erroColabs: { message: string } | null = null
    for (let i = 0; i < ids.length && !erroColabs; i += 100) {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('id, nome_completo, cpf')
        .in('id', ids.slice(i, i + 100))
      if (error) erroColabs = error
      else colabs.push(...((data ?? []) as typeof colabs))
    }
    if (erroColabs) {
      console.error('Erro ao carregar colaboradores das cargas:', erroColabs.message)
      toast.error('Erro ao carregar os colaboradores')
      setLoading(false)
      return false
    }
    const porId = new Map(colabs.map((c) => [c.id, c]))
    const lista = ((linhas ?? []) as VtCarga[]).map((c) => ({
      ...c,
      nome: (porId.get(c.colaborador_id)?.nome_completo as string) ?? '—',
      cpf: (porId.get(c.colaborador_id)?.cpf as string | null) ?? null,
    }))
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    setCargas(lista)
    setFechadosEm(
      new Map(((fechados ?? []) as { colaborador_id: string; updated_at: string }[]).map((f) => [f.colaborador_id, f.updated_at]))
    )
    setLoading(false)
    return true
  }, [])

  /**
   * Espelhos arquivados que tocam cada período de ponto do mês + a sugestão
   * (o conjunto que cobre o período — pode ser mais de um arquivo).
   */
  const espelhosDoMes = useCallback(
    async (competencia: string): Promise<{ a: EspelhosDoPeriodo; b: EspelhosDoPeriodo } | null> => {
      const { a, b } = periodosDePontoDoMes(competencia)
      try {
        const [listaA, listaB] = await Promise.all([
          listarArquivosQueTocamPeriodo(a[0], a[1]),
          listarArquivosQueTocamPeriodo(b[0], b[1]),
        ])
        return {
          a: { arquivos: listaA, sugeridos: escolherConjuntoDoPeriodo(listaA, a[0], a[1]) },
          b: { arquivos: listaB, sugeridos: escolherConjuntoDoPeriodo(listaB, b[0], b[1]) },
        }
      } catch (err) {
        console.error('Erro ao listar espelhos arquivados:', err)
        toast.error('Erro ao carregar os espelhos arquivados')
        return null
      }
    },
    []
  )

  /**
   * Processa o fechamento: baixa e parseia os espelhos escolhidos (os dois
   * períodos, em quantos pedaços vierem), casa por CPF (mesma regra da
   * importação de ponto — nunca palpite) e concilia cada carga. Ordem de
   * leitura = mais antigo primeiro: no dia repetido vale o enviado mais
   * recentemente.
   */
  const processar = useCallback(
    async (competencia: string, arquivos: PontoEspelhoArquivo[]): Promise<boolean> => {
      if (cargas.length === 0 || arquivos.length === 0) return false
      setProcessando(true)
      try {
        const unicos = [...new Map(arquivos.map((a) => [a.id, a])).values()]
        const espelhos: EspelhoColaborador[] = []
        for (const arquivo of ordenarParaMescla(unicos)) {
          const file = await baixarArquivo(arquivo)
          const paginas = await extrairPaginasPosicionais(file)
          espelhos.push(...parsePaginasEspelho(paginas))
        }
        if (espelhos.length === 0) {
          toast.error('Nenhum colaborador encontrado nos espelhos — confira os arquivos')
          setProcessando(false)
          return false
        }
        const porCpf = new Map<string, EspelhoColaborador[]>()
        for (const esp of espelhos) {
          const cpf = normalizarCPF(esp.cpfPdf)
          if (!cpf) continue
          const lista = porCpf.get(cpf) ?? []
          lista.push(esp)
          porCpf.set(cpf, lista)
        }
        const lista: PreviaFechamento[] = cargas.map((carga) => {
          // Carga antiga = posto sem a lista de datas (gerada antes da Fase 2b).
          // Carga nova sem nenhum posto (optante sem escala) é conferida: só
          // pode gerar "trabalhou fora da carga — sem posto, conferir".
          const cargaAntiga = (carga.detalhe ?? []).some((d) => d.datas === undefined)
          const espDoColaborador = carga.cpf ? porCpf.get(normalizarCPF(carga.cpf)) : undefined
          const resultado =
            !cargaAntiga && espDoColaborador
              ? conciliarCarga(carga.detalhe ?? [], mesclarDias(espDoColaborador, competencia))
              : null
          return {
            colaborador_id: carga.colaborador_id,
            nome: carga.nome,
            resultado,
            semEspelho: !cargaAntiga && !espDoColaborador,
            jaFechadoEm: fechadosEm.get(carga.colaborador_id) ?? null,
          }
        })
        setPrevias(lista)
        setProcessando(false)
        return true
      } catch (err) {
        console.error('Erro ao processar o fechamento:', err)
        toast.error('Erro ao ler os espelhos de ponto')
        setProcessando(false)
        return false
      }
    },
    [cargas, fechadosEm]
  )

  /** Grava o fechamento (upsert por colaborador × competência — refazer não duplica). */
  const gravar = useCallback(
    async (competencia: string, usuarioId: string): Promise<boolean> => {
      const prontas = previas.filter((p) => p.resultado)
      if (prontas.length === 0) {
        toast.info('Nada a gravar — processe os espelhos primeiro.')
        return false
      }
      setLoading(true)
      const linhas = prontas.map((p) => ({
        colaborador_id: p.colaborador_id,
        competencia,
        detalhe: p.resultado!.detalhe,
        dias_planejados: p.resultado!.diasPlanejados,
        dias_trabalhados: p.resultado!.diasTrabalhados,
        dias_descontados: p.resultado!.diasDescontados,
        dias_nao_conferidos: p.resultado!.diasNaoConferidos,
        desconto_centavos: p.resultado!.descontoCentavos,
        dias_creditados: p.resultado!.diasCreditados,
        credito_centavos: p.resultado!.creditoCentavos,
        dias_fora_sem_posto: p.resultado!.diasForaSemPosto.length,
        fechado_por: usuarioId,
        updated_at: new Date().toISOString(),
      }))
      const { data, error } = await supabase
        .from('vt_fechamentos')
        .upsert(linhas, { onConflict: 'colaborador_id,competencia' })
        .select('id')
      setLoading(false)
      if (error) {
        console.error('Erro ao gravar o fechamento:', error.message)
        toast.error('Erro ao gravar o fechamento')
        return false
      }
      if (!data || data.length !== linhas.length) {
        toast.error(`Só ${data?.length ?? 0} de ${linhas.length} fechamentos foram gravados (permissão) — confira`)
        return false
      }
      toast.success(
        `Fechamento de ${linhas.length} colaborador(es) gravado — desconto e crédito entram na carga do mês seguinte`
      )
      return true
    },
    [previas]
  )

  return {
    competencias,
    cargas,
    previas,
    loading,
    processando,
    listarCompetencias,
    carregarCargas,
    espelhosDoMes,
    processar,
    gravar,
  }
}
