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
import { useAdicionaisContratuais } from '@/hooks/useAdicionaisContratuais'
import { useColaboradores } from '@/hooks/useColaboradores'
import { AdicionaisPageWrapper, AdicionaisCard, AdicionaisButton } from './AdicionaisPageWrapper'
import { PageHeader } from '@/components/PageHeader'
import { parsePontoPDF, calcularPeriodoPDF, resumoPonto, normalizarMatricula, type PontoColaborador } from '@/lib/adicionais/importarPonto'
import { toast } from 'sonner'
import type { StatusDiaAdicional } from '@/types/adicionais'

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

export function ImportarPontoPage() {
  const { contratos, vinculos, calendario, listarVinculos, listarCalendario, salvarDiaCalendario, excluirDiaCalendario, criarVinculo } = useAdicionaisContratuais()
  const { colaboradores, listar: listarColaboradores } = useColaboradores()

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [processando, setProcessando] = useState(false)
  const [dados, setDados] = useState<PontoColaborador[]>([])
  const [colaboradorExpandido, setColaboradorExpandido] = useState<string | null>(null)
  const [lancarOcorrencias, setLancarOcorrencias] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resumoImportacao, setResumoImportacao] = useState<{ nome: string; matricula: string; encontrado: boolean }[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listarVinculos()
    listarColaboradores()
  }, [listarVinculos, listarColaboradores])

  const mapColaboradorPorMatricula = useMemo(() => {
    const m = new Map<string, typeof colaboradores[0]>()
    ;(colaboradores || []).forEach(c => {
      const normalizada = normalizarMatricula(c.matricula)
      if (normalizada) m.set(normalizada, c)
    })
    return m
  }, [colaboradores])

  const mapColaboradorPorNome = useMemo(() => {
    const m = new Map<string, typeof colaboradores[0]>()
    ;(colaboradores || []).forEach(c => {
      m.set(c.nome_completo.toLowerCase().trim(), c)
    })
    return m
  }, [colaboradores])

  const encontrarColaborador = (colaborador: PontoColaborador) => {
    const matriculaNormalizada = normalizarMatricula(colaborador.matricula)
    if (matriculaNormalizada) {
      const porMatricula = mapColaboradorPorMatricula.get(matriculaNormalizada)
      if (porMatricula) return porMatricula
    }
    return mapColaboradorPorNome.get(colaborador.nome.toLowerCase().trim()) || null
  }

  const encontrarVinculo = (colaboradorId: string, data: string) => {
    if (!Array.isArray(vinculos)) return null
    return vinculos.find(v =>
      v.colaborador_id === colaboradorId &&
      v.data_inicio <= data &&
      v.data_fim >= data
    ) || null
  }

  const garantirVinculo = async (
    colaboradorId: string,
    data: string,
    periodo: { inicio: string; fim: string } | null,
    cacheVinculos: Map<string, typeof vinculos[0]>
  ) => {
    const cacheado = cacheVinculos.get(colaboradorId)
    if (cacheado) return cacheado

    const existente = encontrarVinculo(colaboradorId, data)
    if (existente) return existente

    if (!contratos || contratos.length === 0) {
      toast.error('Nenhum contrato cadastrado. Cadastre um contrato antes de importar.')
      return null
    }

    // Usa o primeiro contrato como padrão para vínculos criados automaticamente
    const contratoPadrao = contratos[0]
    const inicio = periodo?.inicio || '2026-01-01'
    const fim = periodo?.fim || '2026-12-31'

    const novo = await criarVinculo({
      contrato_id: contratoPadrao.id,
      colaborador_id: colaboradorId,
      data_inicio: inicio,
      data_fim: fim,
    })

    if (novo) {
      cacheVinculos.set(colaboradorId, novo)
      await listarVinculos()
      return novo
    }
    return null
  }

  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArquivo(file)
      setDados([])
      setResumoImportacao(null)
    }
  }

  const handleProcessar = async () => {
    if (!arquivo) return
    setProcessando(true)
    try {
      const resultado = await parsePontoPDF(arquivo)
      setDados(resultado)
      if (resultado.length === 0) {
        toast.warning('Nenhum dado de ponto encontrado no PDF')
        setResumoImportacao([])
      } else {
        const resumo = resultado.map(c => {
          const col = encontrarColaborador(c)
          return { nome: c.nome, matricula: c.matricula, encontrado: !!col }
        })
        setResumoImportacao(resumo)
        resumo.forEach(r => {
          if (r.encontrado) {
            toast.success(`Colaborador encontrado: ${r.nome} (Matrícula: ${r.matricula || '—'})`)
          } else {
            toast.error(`Colaborador NÃO encontrado: ${r.nome} (Matrícula: ${r.matricula || '—'}) - Verificar cadastro`)
          }
        })
      }
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
      novo[idxColaborador] = { ...novo[idxColaborador] }
      novo[idxColaborador].dias = [...novo[idxColaborador].dias]
      novo[idxColaborador].dias[idxDia] = { ...novo[idxColaborador].dias[idxDia], status, revisao: false }
      return novo
    })
  }

  const handleConfirmar = async () => {
    setImportando(true)
    let importados = 0
    let naoEncontrados = 0

    const periodo = calcularPeriodoPDF(dados)
    if (periodo) {
      const vinculosAfetados = new Set<string>()
      for (const c of dados) {
        const colaborador = encontrarColaborador(c)
        if (!colaborador) continue
        for (const dia of c.dias) {
          const vinculo = encontrarVinculo(colaborador.id, dia.data)
          if (vinculo) vinculosAfetados.add(vinculo.id)
        }
      }

      const diasParaExcluir = calendario.filter(d =>
        vinculosAfetados.has(d.vinculo_id) &&
        d.data >= periodo.inicio &&
        d.data <= periodo.fim
      )


      for (const dia of diasParaExcluir) {
        await excluirDiaCalendario(dia.vinculo_id, dia.data)
      }
    }

    const cacheVinculos = new Map<string, typeof vinculos[0]>()

    for (const c of dados) {
      const colaborador = encontrarColaborador(c)
      if (!colaborador) {
        naoEncontrados++
        continue
      }

      for (const dia of c.dias) {
        const vinculo = await garantirVinculo(colaborador.id, dia.data, periodo, cacheVinculos)
        if (!vinculo) continue

        await salvarDiaCalendario({
          vinculo_id: vinculo.id,
          data: dia.data,
          status: dia.status,
          intrajornada: false,
        })
        importados++
      }
    }

    if (periodo) {
      await listarCalendario({ dataInicio: periodo.inicio, dataFim: periodo.fim })
    }

    setImportando(false)
    toast.success(`${importados} dia(s) importado(s)`)
    if (naoEncontrados > 0) {
      toast.warning(`${naoEncontrados} colaborador(es) não encontrado(s)`)
    }
    setDados([])
    setArquivo(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCancelar = () => {
    setArquivo(null)
    setDados([])
    setResumoImportacao(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const temRevisao = dados.some(c => c.dias.some(d => d.revisao))

  return (
    <AdicionaisPageWrapper>
      <PageHeader title="Importar Ponto" description="Importe o PDF do ponto para preencher o calendário automaticamente" />

      <AdicionaisCard title="Upload do PDF">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleSelecionarArquivo}
            />
            <AdicionaisButton variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Selecionar arquivo
            </AdicionaisButton>
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

          <AdicionaisButton onClick={handleProcessar} disabled={!arquivo || processando}>
            {processando ? 'Processando...' : 'Processar PDF'}
          </AdicionaisButton>
        </div>
      </AdicionaisCard>

      {resumoImportacao && resumoImportacao.length > 0 && (
        <AdicionaisCard title="Resumo dos colaboradores do PDF">
          <div className="space-y-2">
            {resumoImportacao.map((r, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm px-3 py-2 rounded-lg"
                style={{ backgroundColor: r.encontrado ? '#F0FDF4' : '#FEF2F2', color: r.encontrado ? '#166534' : '#991B1B' }}
              >
                <span className="font-medium">{r.nome}</span>
                <span>
                  Matrícula: {r.matricula || '—'} — {r.encontrado ? '✅ Encontrado' : '⚠️ Não encontrado'}
                </span>
              </div>
            ))}
          </div>
        </AdicionaisCard>
      )}

      {dados.length > 0 && (
        <>
          <AdicionaisCard title="Pré-visualização">
            {temRevisao && (
              <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                Existem dias marcados para revisão. Verifique antes de confirmar.
              </div>
            )}

            <div className="space-y-3">
              {dados.map((c, idxColaborador) => {
                const resumo = resumoPonto(c)
                const colaborador = encontrarColaborador(c)
                const expandido = colaboradorExpandido === `${idxColaborador}`
                return (
                  <div key={idxColaborador} className="border rounded-xl overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
                    <button
                      type="button"
                      onClick={() => setColaboradorExpandido(expandido ? null : `${idxColaborador}`)}
                      className="w-full px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 text-left"
                    >
                      <div>
                        <div className="font-medium" style={{ color: '#1F2937' }}>{c.nome}</div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>Matrícula: {c.matricula || '—'} {colaborador ? '✅ Encontrado' : '⚠️ Não encontrado'}</div>
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
                            {c.dias.map((dia, idxDia) => (
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
                                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>{EMOJI_STATUS[value as StatusDiaAdicional]} {label}</SelectItem>
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
          </AdicionaisCard>

          <AdicionaisCard title="Opções">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#1F2937' }}>
              <input
                type="checkbox"
                checked={lancarOcorrencias}
                onChange={e => setLancarOcorrencias(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              Lançar ocorrências automaticamente para Faltas e Atestados (opcional, futuro)
            </label>
          </AdicionaisCard>

          <div className="flex gap-2">
            <AdicionaisButton onClick={handleConfirmar} disabled={importando}>
              <Save className="w-4 h-4 mr-2" />
              {importando ? 'Importando...' : 'Confirmar importação'}
            </AdicionaisButton>
            <AdicionaisButton variant="outline" onClick={handleCancelar} disabled={importando}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </AdicionaisButton>
          </div>
        </>
      )}
    </AdicionaisPageWrapper>
  )
}
