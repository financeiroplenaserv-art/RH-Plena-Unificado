import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, FileText, X, AlertTriangle, Save } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useAdicionaisContratuais } from '@/hooks/useAdicionaisContratuais'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useAuth } from '@/hooks/useAuth'
import { AdicionaisShell } from './AdicionaisShell'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { PageHeader } from '@/components/corh/PageHeader'
import { extrairPaginasPosicionais } from '@/lib/pdfPosicional'
import {
  parsePaginasEspelho,
  casarColaborador,
  planejarOcorrencias,
  marcarDuplicadas,
  montarPayloadInsert,
  formatarDataBR,
  type ColaboradorResumo,
  type EspelhoColaborador,
  type OcorrenciaExistente,
  type StatusMatch,
} from '@/lib/ocorrencias/importacaoPonto'
import {
  espelhoParaPonto,
  periodoDosEspelhos,
  resumoPontoEspelho,
  type PontoEspelho,
} from '@/lib/adicionais/importarEspelho'
import { podeCriarOcorrencia } from '@/lib/permissoes'
import { mascararCPF } from '@/lib/utils'
import { toast } from 'sonner'
import type { StatusDiaAdicional } from '@/types/adicionais'
import type { Ocorrencia } from '@/types/database'

const EMOJI_STATUS: Record<StatusDiaAdicional, string> = {
  trabalhou: '✅',
  falta: '❌',
  ferias: '🏖️',
  afastado: '🏥',
  folga: '🏠',
  folga_substituicao: '👥',
}

const STATUS_LABELS: Record<StatusDiaAdicional, string> = {
  trabalhou: 'Trabalhou',
  falta: 'Falta',
  ferias: 'Férias',
  afastado: 'Afastado',
  folga: 'FO Folga sem substituição',
  folga_substituicao: 'FS Folga com substituição',
}

const TAMANHO_LOTE_OCORRENCIAS = 100
const TAMANHO_LOTE_IDS = 50
const TIMEOUT_CHAMADA_MS = 60_000

/**
 * Garante que uma chamada ao Supabase nunca deixe a tela presa em "Importando...":
 * se o banco não responder em `ms`, rejeita com erro legível indicando a etapa.
 * (Caso real: o insert gravava no servidor, mas a resposta nunca chegava ao
 * navegador — a promise ficava pendente para sempre e nem try/finally salvava.)
 */
function comTimeout<T>(promessa: PromiseLike<T>, ms: number, rotulo: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promessa),
    new Promise<T>((_, rejeita) =>
      setTimeout(
        () => rejeita(new Error(`${rotulo}: o banco de dados não respondeu em ${Math.round(ms / 1000)}s. Verifique a conexão e tente novamente.`)),
        ms
      )
    ),
  ])
}

/** Marcador de etapa no console — diagnóstico de travamentos da importação. */
function marcarEtapa(etapa: string) {
  console.info(`[importar-ponto] ${etapa}`)
}

/** Espelho processado: dados do PDF + match do cadastro + estrutura editável da prévia. */
interface EspelhoProcessado {
  espelho: EspelhoColaborador
  ponto: PontoEspelho
  colaborador: ColaboradorResumo | null
  match: StatusMatch
}

/**
 * Reflete as edições manuais de status da prévia na classificação usada no
 * planejamento das ocorrências (o parser original não é alterado).
 */
function espelhoComEdicoes(proc: EspelhoProcessado): EspelhoColaborador {
  return {
    ...proc.espelho,
    dias: proc.espelho.dias.map((dia, i) => {
      const editado = proc.ponto.dias[i]
      if (!editado) return dia
      if (editado.status === 'falta' && dia.classificacao !== 'falta') {
        return { ...dia, classificacao: 'falta' as const, categoria: 'Falta' }
      }
      // 'afastado' manual vira atestado apenas quando o dia não era afastamento real
      if (editado.status === 'afastado' && dia.classificacao !== 'atestado' && dia.categoria !== 'Afastado') {
        return { ...dia, classificacao: 'atestado' as const, categoria: 'Atestado' }
      }
      // Dia que era falta/atestado e foi alterado para outro status não gera ocorrência
      if (
        (dia.classificacao === 'falta' || dia.classificacao === 'atestado') &&
        editado.status !== 'falta' &&
        editado.status !== 'afastado'
      ) {
        return { ...dia, classificacao: 'outro' as const }
      }
      return dia
    }),
  }
}

export function ImportarPontoPage() {
  const { user } = useAuth()
  const podeLancarOcorrencias = user ? podeCriarOcorrencia(user.nivel_acesso) : false
  const { vinculos, listarVinculos, listarCalendario, salvarDiaCalendario, excluirDiaCalendario } = useAdicionaisContratuais()
  const { listarResumido: listarColaboradores } = useColaboradores()

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [processando, setProcessando] = useState(false)
  const [dados, setDados] = useState<EspelhoProcessado[]>([])
  const [colaboradorExpandido, setColaboradorExpandido] = useState<string | null>(null)
  const [lancarOcorrencias, setLancarOcorrencias] = useState(true)
  const [importando, setImportando] = useState(false)
  const [resumoImportacao, setResumoImportacao] = useState<{ nome: string; cpf: string; matricula: string; encontrado: boolean; diverge: boolean }[] | null>(null)
  const [existentesOcorrencias, setExistentesOcorrencias] = useState<OcorrenciaExistente[]>([])
  const [desmarcadasOcorrencias, setDesmarcadasOcorrencias] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** Chave única da ocorrência planejada (colaborador + início + tipo). */
  const chavePlanejada = (p: { colaborador: ColaboradorResumo | null; dataInicio: string; tipo: string }) =>
    `${p.colaborador?.id}|${p.dataInicio}|${p.tipo}`

  // Ocorrências planejadas: recalculadas a partir da prévia, então edições
  // manuais de status (ex.: falta → trabalhou) suprimem/criam ocorrências.
  const planejadas = useMemo(() => {
    const lista = dados.flatMap((p) => planejarOcorrencias(espelhoComEdicoes(p), p.colaborador, p.match))
    marcarDuplicadas(lista, existentesOcorrencias)
    return lista
  }, [dados, existentesOcorrencias])

  useEffect(() => {
    listarVinculos()
  }, [listarVinculos])

  /** Todos os vínculos do colaborador que cobrem a data (um colab pode ter 2+ adicionais). */
  const encontrarVinculos = (colaboradorId: string, data: string) => {
    if (!Array.isArray(vinculos)) return []
    return vinculos.filter(v =>
      v.colaborador_id === colaboradorId &&
      v.data_inicio <= data &&
      v.data_fim >= data
    )
  }

  /** Badge da prévia: o colaborador tem algum vínculo cobrindo o período do espelho? */
  const temVinculoNoEspelho = (proc: EspelhoProcessado): boolean => {
    if (!proc.colaborador || !Array.isArray(vinculos) || proc.ponto.dias.length === 0) return false
    const datas = proc.ponto.dias.map((d) => d.data)
    const inicio = datas.reduce((a, b) => (b < a ? b : a))
    const fim = datas.reduce((a, b) => (b > a ? b : a))
    return vinculos.some(
      (v) => v.colaborador_id === proc.colaborador!.id && v.data_inicio <= fim && v.data_fim >= inicio
    )
  }

  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArquivo(file)
      setDados([])
      setResumoImportacao(null)
      setExistentesOcorrencias([])
      setDesmarcadasOcorrencias(new Set())
      setDesmarcadasOcorrencias(new Set())
    }
  }

  const handleProcessar = async () => {
    if (!arquivo) return
    setProcessando(true)
    try {
      const paginas = await extrairPaginasPosicionais(arquivo)
      const espelhos = parsePaginasEspelho(paginas).filter((e) => e.dias.length > 0)
      if (espelhos.length === 0) {
        toast.warning('Nenhum espelho de ponto reconhecido neste PDF. Confira se é o relatório “CORH - Adicionais e Ocorrências” exportado do Flit.')
        setDados([])
        setResumoImportacao([])
        return
      }

      const colaboradores = await listarColaboradores()

      const processados: EspelhoProcessado[] = espelhos.map((espelho) => {
        const { colaborador, match } = casarColaborador(espelho, colaboradores)
        return { espelho, colaborador, match, ponto: espelhoParaPonto(espelho, colaborador) }
      })
      setDados(processados)

      // Deduplicação das ocorrências contra o banco (as planejadas são
      // recalculadas por memo a partir de `dados` + esta lista de existentes)
      const periodo = periodoDosEspelhos(espelhos)
      const ids = [...new Set(processados.map((p) => p.colaborador?.id).filter(Boolean))] as string[]
      let existentes: OcorrenciaExistente[] = []
      if (ids.length > 0 && periodo) {
        for (let i = 0; i < ids.length; i += TAMANHO_LOTE_IDS) {
          const { data, error } = await supabase
            .from('ocorrencias')
            .select('colaborador_id, data_ocorrencia, tipo_ocorrencia')
            .in('colaborador_id', ids.slice(i, i + TAMANHO_LOTE_IDS))
            .gte('data_ocorrencia', periodo.inicio)
            .lte('data_ocorrencia', periodo.fim)
          if (error) throw new Error('Erro ao verificar duplicidades: ' + error.message)
          existentes = existentes.concat((data as OcorrenciaExistente[]) || [])
        }
      }
      setExistentesOcorrencias(existentes)

      const resumo = processados.map((p) => ({
        nome: p.ponto.nome,
        cpf: p.espelho.cpfPdf,
        matricula: p.ponto.matricula,
        encontrado: !!p.colaborador,
        diverge: p.match === 'NOME_DIVERGE',
      }))
      setResumoImportacao(resumo)
      resumo.forEach(r => {
        if (r.diverge) {
          toast.warning(`Nome diverge do cadastro: ${r.nome} (CPF: ${r.cpf || '—'}) — casado pelo CPF`)
        } else if (r.encontrado) {
          toast.success(`Colaborador encontrado: ${r.nome} (Matrícula: ${r.matricula || '—'})`)
        } else {
          toast.error(`Colaborador NÃO encontrado: ${r.nome} (CPF: ${r.cpf || '—'}) - Verificar cadastro`)
        }
      })
    } catch (err) {
      console.error('Erro ao processar PDF de ponto:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao processar PDF')
    } finally {
      setProcessando(false)
    }
  }

  const handleAlterarStatus = (idxColaborador: number, idxDia: number, status: StatusDiaAdicional) => {
    setDados(prev => {
      const novo = [...prev]
      const alvo = novo[idxColaborador]
      const dias = [...alvo.ponto.dias]
      dias[idxDia] = { ...dias[idxDia], status, revisao: false }
      novo[idxColaborador] = { ...alvo, ponto: { ...alvo.ponto, dias } }
      return novo
    })
  }

  const handleConfirmar = async () => {
    if (!user) return
    setImportando(true)
    // Tudo dentro de try/finally: qualquer exceção (ex.: falha de rede ou sessão
    // expirada no insert — casos em que o supabase-js REJEITA a promise em vez de
    // retornar `{ error }`) não pode deixar o botão travado em "Importando...".
    try {
      let importados = 0
      let naoEncontrados = 0
      marcarEtapa('confirmar: início')

      const periodo = periodoDosEspelhos(dados.map(d => d.espelho))
      if (periodo) {
        // Carrega o calendário do período ANTES de excluir: o estado `calendario`
        // não é carregado nesta tela, então a exclusão precisa do retorno da busca.
        const calendarioPeriodo = await comTimeout(
          listarCalendario({ dataInicio: periodo.inicio, dataFim: periodo.fim }),
          TIMEOUT_CHAMADA_MS,
          'Leitura do calendário de adicionais'
        )
        marcarEtapa('calendário do período carregado')

        const vinculosAfetados = new Set<string>()
        for (const c of dados) {
          if (!c.colaborador) continue
          for (const dia of c.ponto.dias) {
            for (const v of encontrarVinculos(c.colaborador.id, dia.data)) vinculosAfetados.add(v.id)
          }
        }

        const diasParaExcluir = (calendarioPeriodo || []).filter(d =>
          vinculosAfetados.has(d.vinculo_id) &&
          d.data >= periodo.inicio &&
          d.data <= periodo.fim
        )


        for (const dia of diasParaExcluir) {
          await comTimeout(
            excluirDiaCalendario(dia.vinculo_id, dia.data),
            TIMEOUT_CHAMADA_MS,
            'Exclusão de dias antigos do calendário'
          )
        }
        if (diasParaExcluir.length > 0) marcarEtapa(`${diasParaExcluir.length} dia(s) antigo(s) excluído(s)`)
      }

      // Colaboradores sem vínculo NÃO têm dias importados para o calendário
      // (adicionais são exceção — vínculo é criado manualmente na aba Vínculos).
      // As ocorrências deles são lançadas normalmente mais abaixo.
      const semVinculo = new Set<string>()

      for (const c of dados) {
        if (!c.colaborador) {
          naoEncontrados++
          continue
        }

        for (const dia of c.ponto.dias) {
          const vinculosDia = encontrarVinculos(c.colaborador.id, dia.data)
          if (vinculosDia.length === 0) {
            semVinculo.add(c.colaborador.id)
            continue
          }
          // Um colaborador pode ter mais de um vínculo (ex.: 2 adicionais) — grava em todos
          for (const vinculo of vinculosDia) {
            await comTimeout(
              salvarDiaCalendario({
                vinculo_id: vinculo.id,
                data: dia.data,
                status: dia.status,
                intrajornada: false,
              }),
              TIMEOUT_CHAMADA_MS,
              'Gravação dos dias no calendário'
            )
            importados++
          }
        }
      }
      if (importados > 0) marcarEtapa(`${importados} dia(s) gravado(s) no calendário`)

      if (periodo) {
        await comTimeout(
          listarCalendario({ dataInicio: periodo.inicio, dataFim: periodo.fim }),
          TIMEOUT_CHAMADA_MS,
          'Atualização do calendário de adicionais'
        )
      }

      // Lançamento das ocorrências (opcional, ligado por padrão para quem tem permissão)
      let ocorrenciasCriadas = 0
      let duplicadasIgnoradas = 0
      const errosOcorrencias: string[] = []
      if (lancarOcorrencias && podeLancarOcorrencias) {
        // As planejadas (memo) já refletem as edições manuais de status da prévia;
        // desmarcadas na lista não são inseridas
        const validas = planejadas.filter(
          (p) => !p.duplicada && p.match === 'OK' && p.colaborador && !desmarcadasOcorrencias.has(chavePlanejada(p))
        )
        duplicadasIgnoradas = planejadas.filter((p) => p.duplicada).length
        marcarEtapa(`ocorrências: ${validas.length} válida(s) para inserir`)

        for (let i = 0; i < validas.length; i += TAMANHO_LOTE_OCORRENCIAS) {
          const lote = validas.slice(i, i + TAMANHO_LOTE_OCORRENCIAS)
          const payloads = lote.map((p) => montarPayloadInsert(p, user.id))
          try {
            marcarEtapa(`insert do lote ${i / TAMANHO_LOTE_OCORRENCIAS + 1} enviado (${lote.length} ocorrência(s))`)
            const { error } = await comTimeout(
              supabase
                .from('ocorrencias')
                .insert(payloads as Partial<Ocorrencia>[]),
              TIMEOUT_CHAMADA_MS,
              'Gravação das ocorrências'
            )
            marcarEtapa(`insert do lote ${i / TAMANHO_LOTE_OCORRENCIAS + 1} respondido`)
            if (error) {
              errosOcorrencias.push(`Lote ${i / TAMANHO_LOTE_OCORRENCIAS + 1}: ${error.message}`)
            } else {
              ocorrenciasCriadas += lote.length
            }
          } catch (err) {
            // Promise rejeitada ou timeout: registra e segue para o próximo lote
            errosOcorrencias.push(
              `Lote ${i / TAMANHO_LOTE_OCORRENCIAS + 1}: ${err instanceof Error ? err.message : 'falha de comunicação com o banco'}`
            )
          }
        }
      }

      const partes = [`${importados} dia(s) importado(s)`]
      if (lancarOcorrencias && podeLancarOcorrencias) {
        partes.push(`${ocorrenciasCriadas} ocorrência(s) criada(s)`)
        if (duplicadasIgnoradas > 0) partes.push(`${duplicadasIgnoradas} duplicada(s) ignorada(s)`)
      }
      toast.success(partes.join(', '))
      if (errosOcorrencias.length > 0) {
        toast.warning(`Erro ao criar ocorrências: ${errosOcorrencias.join(' | ')}`)
      }
      if (naoEncontrados > 0) {
        toast.warning(`${naoEncontrados} colaborador(es) não encontrado(s)`)
      }
      if (semVinculo.size > 0) {
        toast.warning(
          `${semVinculo.size} colaborador(es) sem vínculo de adicional — dias não importados para o calendário (ocorrências lançadas normalmente).`,
          { duration: 6000 }
        )
      }
      setDados([])
      setArquivo(null)
      setResumoImportacao(null)
      setExistentesOcorrencias([])
      setDesmarcadasOcorrencias(new Set())
      if (fileInputRef.current) fileInputRef.current.value = ''
      marcarEtapa('confirmar: fim')
    } catch (err) {
      marcarEtapa(`confirmar: FALHOU — ${err instanceof Error ? err.message : String(err)}`)
      console.error('Erro inesperado na importação de ponto:', err)
      toast.error(
        err instanceof Error
          ? `A importação falhou: ${err.message}`
          : 'A importação falhou por um erro inesperado. Tente novamente.'
      )
    } finally {
      setImportando(false)
    }
  }

  const handleCancelar = () => {
    setArquivo(null)
    setDados([])
    setResumoImportacao(null)
    setExistentesOcorrencias([])
    setDesmarcadasOcorrencias(new Set())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const temRevisao = dados.some(c => c.ponto.dias.some(d => d.revisao))

  const resumoOcorrencias = useMemo(() => ({
    faltas: planejadas.filter((p) => p.tipo === 'Falta Injustificada' && !p.duplicada && p.match === 'OK').length,
    atestados: planejadas.filter((p) => p.tipo === 'Falta Justificada (atestado)' && !p.duplicada && p.match === 'OK').length,
    licencas: planejadas.filter((p) => p.tipo.startsWith('Licença Médica') && !p.duplicada && p.match === 'OK').length,
    duplicadas: planejadas.filter((p) => p.duplicada).length,
  }), [planejadas])

  // Linhas da prévia de ocorrências (só match OK) e contagem das selecionadas
  const ocorrenciasVisiveis = planejadas.filter((p) => p.colaborador && p.match === 'OK')
  const selecionadasOcorrencias = ocorrenciasVisiveis.filter(
    (p) => !p.duplicada && !desmarcadasOcorrencias.has(chavePlanejada(p))
  )
  const todasMarcadas = selecionadasOcorrencias.length === ocorrenciasVisiveis.filter((p) => !p.duplicada).length

  const toggleOcorrencia = (p: (typeof ocorrenciasVisiveis)[number]) => {
    const chave = chavePlanejada(p)
    setDesmarcadasOcorrencias((atual) => {
      const novo = new Set(atual)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  }

  const toggleTodasOcorrencias = () => {
    if (todasMarcadas) {
      setDesmarcadasOcorrencias(new Set(ocorrenciasVisiveis.filter((p) => !p.duplicada).map(chavePlanejada)))
    } else {
      setDesmarcadasOcorrencias(new Set())
    }
  }

  return (
    <AdicionaisShell>
      <PageHeader backTo="/adicionais/contratos" title="Importar Ponto" description="Exporte do Flit o relatório “CORH - Adicionais e Ocorrências” (PDF) e importe aqui: o mesmo arquivo preenche o calendário dos adicionais e lança as ocorrências de faltas e atestados" />

      <ModuleCard title="Upload do PDF">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleSelecionarArquivo}
            />
            <ModuleButton variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Selecionar arquivo
            </ModuleButton>
            {arquivo && (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#1F2937' }}>
                <FileText className="w-4 h-4" />
                {arquivo.name}
                <button onClick={handleCancelar} className="text-red-600 hover:text-red-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <ModuleButton onClick={handleProcessar} disabled={!arquivo || processando}>
            {processando ? 'Processando...' : 'Processar PDF'}
          </ModuleButton>
        </div>
      </ModuleCard>

      {resumoImportacao && resumoImportacao.length > 0 && (
        <ModuleCard title="Resumo dos colaboradores do PDF">
          <div className="space-y-2">
            {resumoImportacao.map((r, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: r.encontrado && !r.diverge ? '#F0FDF4' : r.diverge ? '#FFFBEB' : '#FEF2F2',
                  color: r.encontrado && !r.diverge ? '#166534' : r.diverge ? '#92400E' : '#991B1B',
                }}
              >
                <span className="font-medium">{r.nome}</span>
                <span>
                  CPF: {mascararCPF(r.cpf) || '—'} — Matrícula: {r.matricula || '—'} —{' '}
                  {r.diverge ? '⚠️ Nome diverge (casado pelo CPF)' : r.encontrado ? '✅ Encontrado' : '⚠️ Não encontrado'}
                </span>
              </div>
            ))}
          </div>
        </ModuleCard>
      )}

      {dados.length > 0 && (
        <>
          <ModuleCard title="Pré-visualização">
            {temRevisao && (
              <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                Existem dias marcados para revisão. Verifique antes de confirmar.
              </div>
            )}

            <div className="space-y-3">
              {dados.map((c, idxColaborador) => {
                const resumo = resumoPontoEspelho(c.ponto)
                const expandido = colaboradorExpandido === `${idxColaborador}`
                return (
                  <div key={idxColaborador} className="border rounded-xl overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
                    <button
                      type="button"
                      onClick={() => setColaboradorExpandido(expandido ? null : `${idxColaborador}`)}
                      className="w-full px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 text-left"
                    >
                      <div>
                        <div className="font-medium" style={{ color: '#1F2937' }}>{c.ponto.nome}</div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>
                          CPF: {mascararCPF(c.espelho.cpfPdf) || '—'} — Matrícula: {c.ponto.matricula || '—'}{' '}
                          {c.match === 'NOME_DIVERGE' ? '⚠️ Nome diverge' : c.colaborador ? '✅ Encontrado' : '⚠️ Não encontrado'}
                          {c.colaborador && (temVinculoNoEspelho(c) ? ' — 🔗 Com vínculo' : ' — ⚠️ Sem vínculo (só ocorrências)')}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700">✅ {resumo.trabalhou}</span>
                        <span className="px-2 py-1 rounded bg-slate-50 text-slate-700">🏠 {resumo.folga}</span>
                        <span className="px-2 py-1 rounded bg-red-50 text-red-700">❌ {resumo.falta}</span>
                        <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">🏖️ {resumo.ferias}</span>
                        <span className="px-2 py-1 rounded bg-amber-50 text-amber-700">🏥 {resumo.afastado}</span>
                        {resumo.revisao > 0 && <span className="px-2 py-1 rounded bg-amber-50 text-amber-700">⚠️ {resumo.revisao}</span>}
                      </div>
                    </button>

                    {expandido && (
                      <div className="border-t" style={{ borderColor: '#F1F5F9' }}>
                        <Table>
                          <TableHeader style={{ backgroundColor: '#F8FAFC' }}>
                            <TableRow>
                              <TableHead style={{ color: '#1F2937' }}>Dia</TableHead>
                              <TableHead style={{ color: '#1F2937' }}>Status</TableHead>
                              <TableHead style={{ color: '#1F2937' }}>Horários / Observação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {c.ponto.dias.map((dia, idxDia) => (
                              <TableRow key={idxDia} className="hover:bg-slate-50">
                                <TableCell style={{ color: '#1F2937' }}>{dia.dataOriginal}</TableCell>
                                <TableCell>
                                  <Select
                                    value={dia.status}
                                    onValueChange={(v) => handleAlterarStatus(idxColaborador, idxDia, v as StatusDiaAdicional)}
                                  >
                                    <SelectTrigger className="w-52 rounded-lg">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(Object.entries(STATUS_LABELS) as [StatusDiaAdicional, string][]).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>{EMOJI_STATUS[value]} {label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell style={{ color: '#64748B' }}>
                                  <div className="text-sm">{dia.horarios.join(' ') || dia.observacao || '—'}</div>
                                  {dia.revisao && <span className="text-xs text-amber-600">Revisar</span>}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ModuleCard>

          {podeLancarOcorrencias && (
            <>
            <ModuleCard title="Opções">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#1F2937' }}>
                <input
                  type="checkbox"
                  checked={lancarOcorrencias}
                  onChange={e => setLancarOcorrencias(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                Lançar ocorrências automaticamente para Faltas e Atestados
              </label>
              {lancarOcorrencias && planejadas.length > 0 && (
                <p className="mt-2 text-xs" style={{ color: '#64748B' }}>
                  Serão criadas: {resumoOcorrencias.faltas} falta(s), {resumoOcorrencias.atestados} atestado(s),{' '}
                  {resumoOcorrencias.licencas} licença(s) médica(s).
                  {resumoOcorrencias.duplicadas > 0 && ` ${resumoOcorrencias.duplicadas} ocorrência(s) já existente(s) será(ão) ignorada(s).`}
                </p>
              )}
            </ModuleCard>

            {lancarOcorrencias && ocorrenciasVisiveis.length > 0 && (
              <ModuleCard title={`Ocorrências que serão lançadas (${selecionadasOcorrencias.length})`}>
                <div className="mb-2">
                  <button type="button" onClick={toggleTodasOcorrencias} className="text-xs text-[#0F6CBD] hover:underline">
                    {todasMarcadas ? 'Desmarcar todas' : 'Marcar todas'}
                  </button>
                </div>
                <div className="border rounded-lg overflow-hidden border-slate-200 max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader style={{ backgroundColor: '#F8FAFC' }}>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead style={{ color: '#1F2937' }}>Colaborador</TableHead>
                        <TableHead style={{ color: '#1F2937' }}>Tipo</TableHead>
                        <TableHead style={{ color: '#1F2937' }}>Período</TableHead>
                        <TableHead style={{ color: '#1F2937' }}>Dias</TableHead>
                        <TableHead style={{ color: '#1F2937' }}>Status inicial</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ocorrenciasVisiveis.map((p) => {
                        const chave = chavePlanejada(p)
                        const marcada = !p.duplicada && !desmarcadasOcorrencias.has(chave)
                        return (
                          <TableRow key={chave} className={p.duplicada ? 'opacity-50' : marcada ? 'hover:bg-slate-50' : 'opacity-60 hover:bg-slate-50'}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={marcada}
                                disabled={p.duplicada}
                                onChange={() => toggleOcorrencia(p)}
                                className="h-4 w-4 accent-[#0F6CBD] disabled:opacity-30"
                              />
                            </TableCell>
                            <TableCell style={{ color: '#1F2937' }}>{p.colaborador!.nome_completo}</TableCell>
                            <TableCell style={{ color: '#1F2937' }}>{p.titulo}</TableCell>
                            <TableCell className="whitespace-nowrap" style={{ color: '#64748B' }}>
                              {p.dataInicio === p.dataFim
                                ? formatarDataBR(p.dataInicio)
                                : `${formatarDataBR(p.dataInicio)} a ${formatarDataBR(p.dataFim)}`}
                            </TableCell>
                            <TableCell style={{ color: '#64748B' }}>{p.dias}</TableCell>
                            <TableCell>
                              {p.duplicada ? (
                                <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-500">Já existe — será ignorada</span>
                              ) : p.status === 'Pendente' ? (
                                <span className="px-2 py-1 rounded text-xs bg-amber-50 text-amber-700">Pendente (aguarda anexo)</span>
                              ) : (
                                <span className="px-2 py-1 rounded text-xs bg-emerald-50 text-emerald-700">Ativa</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                <p className="mt-2 text-xs" style={{ color: '#94A3B8' }}>
                  Linhas esmaecidas já existem no banco e não serão criadas novamente. Desmarque as que não devem ser lançadas.
                </p>
              </ModuleCard>
            )}
            </>
          )}

          <div className="flex gap-2">
            <ModuleButton onClick={handleConfirmar} disabled={importando}>
              <Save className="w-4 h-4 mr-2" />
              {importando ? 'Importando...' : 'Confirmar importação'}
            </ModuleButton>
            <ModuleButton variant="outline" onClick={handleCancelar} disabled={importando}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </ModuleButton>
          </div>
        </>
      )}
    </AdicionaisShell>
  )
}
