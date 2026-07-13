import { useEffect, useRef, useState } from 'react'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Calculator, Download, FileSpreadsheet, FileText, Trash2, Upload, Save,
  ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, FileDown, Search, Receipt,
  FileClock, CalendarDays, Users, FilterX
} from 'lucide-react'
import { useProjetosVR } from '@/hooks/useProjetosVR'
import { useResultadosVR } from '@/hooks/useResultadosVR'
import { useCalculoVR } from '@/hooks/useCalculoVR'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatarData, formatarCPF } from '@/lib/utils'
import { toast } from 'sonner'
import { LoadingScreen } from '@/components/LoadingScreen'
import { VrShell } from './VrShell'
import {
  gerarComprovanteIndividualHTML,
  gerarComprovanteGeralHTML,
  gerarRecibosLoteHTML,
} from '@/lib/vr/comprovanteVR'
import { uploadVRArquivo } from '@/lib/vr/storageVR'
import { podeGerenciarVR } from '@/lib/permissoes'
import type { ProjetoVR, VRConfiguracao, VRResultadoCalculo } from '@/types'

function downloadConteudo(conteudo: string, nome: string, mimeType: string) {
  const blob = new Blob([conteudo], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

interface ValidacaoItem {
  cpf: string
  nome: string
  erros: string[]
  avisos: string[]
}

function validarResultados(lista: VRResultadoCalculo[]): ValidacaoItem[] {
  return lista.map(r => {
    const erros: string[] = []
    const avisos: string[] = []
    if (!r.cpf || r.cpf.length !== 11) erros.push('CPF inválido')
    if (!r.nome?.trim()) erros.push('Nome ausente')
    if (!r.matricula?.trim()) erros.push('Matrícula ausente')
    if (r.diasElegiveis < 0) erros.push('Dias elegíveis negativos')
    if (r.diasPdf === 0 && r.diasEscala === 0) avisos.push('Sem dias no PDF nem escala')
    if (r.diasElegiveis > 31) avisos.push('Dias elegíveis acima de 31')
    if (r.valorBruto <= 0) erros.push('Valor bruto zero ou negativo')
    return { cpf: r.cpf, nome: r.nome, erros, avisos }
  })
}

type StatusFiltro = 'todos' | 'elegivel' | 'nao_elegivel' | 'parcial'

function statusDoResultado(r: VRResultadoCalculo): StatusFiltro {
  if (r.diasElegiveis === 0) return 'nao_elegivel'
  if (r.diasElegiveis >= Math.max(r.diasPdf, r.diasEscala)) return 'elegivel'
  return 'parcial'
}

export function VrProjetoDetailPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeEditar = perfil ? podeGerenciarVR(perfil) : false

  const { id } = useParams<{ id: string }>()
  const { buscarPorId } = useProjetosVR()
  const { resultados: resultadosSalvos, listarPorProjeto, salvarLote } = useResultadosVR()
  const {
    resultados,
    loading,
    estado,
    processarPdfAnterior,
    processarPdfAtual,
    processarEscala,
    processarBase,
    calcular,
    limpar,
    exportarPAT,
    exportarAlterdata,
    exportarConferencia,
    atualizarResultado,
    removerResultado,
    setResultados
  } = useCalculoVR()

  const [projeto, setProjeto] = useState<ProjetoVR | null>(null)
  const [config, setConfig] = useState<VRConfiguracao | null>(null)
  const [arquivos, setArquivos] = useState<{ tipo: string; nome: string }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [mostrarValidacao, setMostrarValidacao] = useState(false)

  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos')
  const [confirmarRemoverZero, setConfirmarRemoverZero] = useState(false)

  const refPdfAnterior = useRef<HTMLInputElement>(null)
  const refPdfAtual = useRef<HTMLInputElement>(null)
  const refEscala = useRef<HTMLInputElement>(null)
  const refBase = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    limpar()
    const carregar = async () => {
      const p = await buscarPorId(id)
      if (p) {
        setProjeto(p)
        const cfg = (p.configuracao_json || {}) as Record<string, unknown>
        setConfig(cfg as unknown as VRConfiguracao)
      }
      await listarPorProjeto(id)

      try {
        const rascunho = localStorage.getItem(`vr_rascunho_${id}`)
        if (rascunho) {
          const dados = JSON.parse(rascunho) as { resultados: VRResultadoCalculo[]; arquivos: { tipo: string; nome: string }[] }
          if (dados.resultados?.length) setResultados(dados.resultados)
          if (dados.arquivos?.length) setArquivos(dados.arquivos)
        }
      } catch (err) {
        console.error('Erro ao parsear rascunho VR:', err)
      }

      setCarregando(false)
    }
    carregar()
  }, [id, buscarPorId, listarPorProjeto, limpar, setResultados])

  useEffect(() => {
    if (resultadosSalvos.length > 0 && resultados.length === 0) {
      const convertidos: VRResultadoCalculo[] = resultadosSalvos.map(r => ({
        cpf: r.cpf || '',
        nome: r.nome || '',
        matricula: r.matricula || '',
        diasElegiveis: r.dias_elegiveis,
        diasPdf: r.dias_pdf,
        diasEscala: r.dias_escala,
        diasAbatimento: r.dias_abatimento,
        valorBruto: Number(r.valor_bruto),
        extra: Number(r.extra),
        detalhes: Array.isArray(r.detalhes_json) ? r.detalhes_json as string[] : []
      }))
      setResultados(convertidos)
    }
  }, [resultadosSalvos, resultados.length, setResultados])

  useEffect(() => {
    if (!id) return
    if (resultados.length === 0 && arquivos.length === 0) return
    localStorage.setItem(`vr_rascunho_${id}`, JSON.stringify({ resultados, arquivos }))
  }, [id, resultados, arquivos])

  const handleArquivo = async (
    e: React.ChangeEvent<HTMLInputElement>,
    processador: (file: File) => Promise<unknown>,
    tipo: 'pdf_anterior' | 'pdf_atual' | 'escala' | 'base'
  ) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    try {
      await processador(file)
      await uploadVRArquivo(id, tipo, file)
      setArquivos(prev => [...prev.filter(a => a.tipo !== tipo), { tipo, nome: file.name }])
      toast.success(`${file.name} processado`)
    } catch (err: unknown) {
      console.error('Erro ao processar arquivo VR:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao processar arquivo')
    } finally {
      e.target.value = ''
    }
  }

  const handleCalcular = async () => {
    if (!config) return
    await calcular(config)
    setMostrarValidacao(true)
  }

  const handleSalvarResultados = async () => {
    if (!id || !projeto) return
    const items = resultados.map(r => ({
      projeto_id: id,
      colaborador_id: null as string | null,
      nome: r.nome,
      cpf: r.cpf,
      matricula: r.matricula,
      dias_elegiveis: r.diasElegiveis,
      dias_pdf: r.diasPdf,
      dias_escala: r.diasEscala,
      dias_abatimento: r.diasAbatimento,
      valor_bruto: r.valorBruto,
      extra: r.extra || 0,
      detalhes_json: r.detalhes
    }))
    await salvarLote(id, items)
  }

  const handleExportarPAT = () => {
    if (!config) return
    const conteudo = exportarPAT(config)
    downloadConteudo(conteudo, `VR_PAT_${projeto?.nome || 'exportacao'}.txt`, 'text/plain;charset=iso-8859-1')
  }

  const handleExportarAlterdata = () => {
    if (!config) return
    const { conteudo, gerados, puladosSemMatricula } = exportarAlterdata(config)
    downloadConteudo(conteudo, `Alterdata_${config.empresaAlterdata}_${config.dataCorte}.txt`, 'text/plain')
    if (puladosSemMatricula > 0) {
      toast.warning(`${puladosSemMatricula} colaboradores sem matrícula foram pulados`)
    }
    toast.success(`${gerados} linhas geradas no Alterdata`)
  }

  const handleExportarConferencia = () => {
    if (!config) return
    const conteudo = exportarConferencia(config)
    downloadConteudo(conteudo, `Conferencia_VR_${projeto?.nome || 'exportacao'}.xls`, 'application/vnd.ms-excel')
  }

  const handleExportarComprovantes = () => {
    if (!config) return
    const html = gerarComprovanteGeralHTML(resultados, config)
    downloadConteudo(html, `Comprovantes_VR_${projeto?.nome || 'exportacao'}.html`, 'text/html')
  }

  const handleTodosOsRecibos = () => {
    if (!config) return
    const html = gerarRecibosLoteHTML(resultados, config, projeto?.nome)
    downloadConteudo(html, `Recibos_VR_${projeto?.nome || 'exportacao'}.html`, 'text/html')
    toast.success('Recibos em lote gerados')
  }

  const handleComprovanteIndividual = (r: VRResultadoCalculo) => {
    if (!config) return
    const html = gerarComprovanteIndividualHTML(r, config)
    downloadConteudo(html, `Comprovante_VR_${r.nome.replace(/\s+/g, '_')}.html`, 'text/html')
  }

  const toggleExpandir = (index: number) => {
    setExpandidos(prev => {
      const novo = new Set(prev)
      if (novo.has(index)) novo.delete(index)
      else novo.add(index)
      return novo
    })
  }

  const handleRemoverZeroDias = () => {
    const comDias = resultados.filter(r => r.diasElegiveis > 0)
    const removidos = resultados.length - comDias.length
    setResultados(comDias)
    setConfirmarRemoverZero(false)
    toast.success(`${removidos} colaborador(es) com 0 dias removido(s)`)
  }

  const resultadosFiltrados = resultados.filter(r => {
    const matchBusca = !busca ||
      r.nome.toLowerCase().includes(busca.toLowerCase()) ||
      r.cpf.includes(busca)
    const status = statusDoResultado(r)
    const matchStatus = statusFiltro === 'todos' || status === statusFiltro
    return matchBusca && matchStatus
  })

  const totalElegiveis = resultados.reduce((s, r) => s + r.diasElegiveis, 0)
  const totalValor = resultados.reduce((s, r) => s + r.valorBruto, 0)
  const validacoes = validarResultados(resultados)
  const totalErros = validacoes.reduce((s, v) => s + v.erros.length, 0)
  const totalAvisos = validacoes.reduce((s, v) => s + v.avisos.length, 0)

  const pdfAnteriorArq = arquivos.find(a => a.tipo === 'pdf_anterior')
  const pdfAtualArq = arquivos.find(a => a.tipo === 'pdf_atual')
  const escalaArq = arquivos.find(a => a.tipo === 'escala')
  const baseArq = arquivos.find(a => a.tipo === 'base')

  if (carregando) {
    return <LoadingScreen mensagem="Carregando projeto..." />
  }

  if (!projeto || !config) {
    return (
      <VrShell>
        <VrHeader title="Projeto não encontrado" />
        <ModuleCard>
          <p className="text-center text-slate-700">O projeto solicitado não existe ou foi removido.</p>
        </ModuleCard>
      </VrShell>
    )
  }

  return (
    <VrShell>
      <VrHeader
        title={projeto.nome}
        subtitle={`Corte ${formatarData(projeto.data_corte)} • Efetivação ${formatarData(projeto.data_efetivacao)} • VR R$ ${Number(config.valorVR).toFixed(2)}`}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ModuleButton variant="outline" size="sm" onClick={() => navigate('/vr/projetos')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </ModuleButton>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeEditar && (
            <ModuleButton variant="outline" size="sm" onClick={() => navigate(`/vr/projetos/${id}/editar`)}>
              Editar configuração
            </ModuleButton>
          )}
        </div>
      </div>

      {/* Cards de upload coloridos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ModuleCard title="PDF anterior (abatimentos)" icon={<FileClock className="w-4 h-4" />}>
          <input
            ref={refPdfAnterior}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={e => handleArquivo(e, processarPdfAnterior, 'pdf_anterior')}
          />
          <ModuleButton variant="outline" className="w-full" onClick={() => refPdfAnterior.current?.click()} disabled={!podeEditar}>
            <Upload className="w-4 h-4 mr-2" />
            Importar PDF
          </ModuleButton>
          {pdfAnteriorArq && (
            <div className="mt-3 text-sm text-slate-700 bg-blue-50 p-2 rounded-md">
              <p className="font-medium truncate">{pdfAnteriorArq.nome}</p>
              <p className="text-xs text-slate-500">{estado.pdfAnterior.size} colaborador(es)</p>
            </div>
          )}
          {!pdfAnteriorArq && (
            <p className="mt-3 text-xs text-slate-500">PDF de ponto do mês anterior para abatimento.</p>
          )}
        </ModuleCard>

        <ModuleCard title="PDF atual (dias trabalhados)" icon={<FileText className="w-4 h-4" />}>
          <input
            ref={refPdfAtual}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={e => handleArquivo(e, processarPdfAtual, 'pdf_atual')}
          />
          <ModuleButton variant="outline" className="w-full" onClick={() => refPdfAtual.current?.click()} disabled={!podeEditar}>
            <Upload className="w-4 h-4 mr-2" />
            Importar PDF
          </ModuleButton>
          {pdfAtualArq && (
            <div className="mt-3 text-sm text-slate-700 bg-blue-50 p-2 rounded-md">
              <p className="font-medium truncate">{pdfAtualArq.nome}</p>
              <p className="text-xs text-slate-500">{estado.pdfAtual.size} colaborador(es)</p>
            </div>
          )}
          {!pdfAtualArq && (
            <p className="mt-3 text-xs text-slate-500">PDF de ponto do mês de corte.</p>
          )}
        </ModuleCard>

        <ModuleCard title="Escala futura" icon={<CalendarDays className="w-4 h-4" />}>
          <input
            ref={refEscala}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => handleArquivo(e, processarEscala, 'escala')}
          />
          <ModuleButton variant="outline" className="w-full border-amber-500 text-amber-700 hover:bg-amber-50" onClick={() => refEscala.current?.click()} disabled={!podeEditar}>
            <Upload className="w-4 h-4 mr-2" />
            Importar escala
          </ModuleButton>
          {escalaArq && (
            <div className="mt-3 text-sm text-slate-700 bg-amber-50 p-2 rounded-md">
              <p className="font-medium truncate">{escalaArq.nome}</p>
              <p className="text-xs text-slate-500">{estado.escala.length} colaborador(es)</p>
            </div>
          )}
          {!escalaArq && (
            <p className="mt-3 text-xs text-slate-500">Planilha de escala futura (.xlsx/.xls).</p>
          )}
        </ModuleCard>

        <ModuleCard title="Base matrícula/nascimento" icon={<Users className="w-4 h-4" />}>
          <input
            ref={refBase}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => handleArquivo(e, processarBase, 'base')}
          />
          <ModuleButton variant="outline" className="w-full border-green-600 text-green-700 hover:bg-green-50" onClick={() => refBase.current?.click()} disabled={!podeEditar}>
            <Upload className="w-4 h-4 mr-2" />
            Importar base
          </ModuleButton>
          {baseArq && (
            <div className="mt-3 text-sm text-slate-700 bg-green-50 p-2 rounded-md">
              <p className="font-medium truncate">{baseArq.nome}</p>
              <p className="text-xs text-slate-500">{estado.datasNascimento.size} registro(s)</p>
            </div>
          )}
          {!baseArq && (
            <p className="mt-3 text-xs text-slate-500">Base com matrícula e data de nascimento.</p>
          )}
        </ModuleCard>
      </div>

      {/* Botões grandes de ação */}
      <ModuleCard title="Ações principais" icon={<Calculator className="w-4 h-4" />}>
        <div className="flex flex-wrap gap-3">
          {podeEditar && (
            <ModuleButton onClick={handleCalcular} disabled={loading} size="lg">
              <Calculator className="w-5 h-5 mr-2" />
              {loading ? 'Calculando...' : 'Calcular VR'}
            </ModuleButton>
          )}

          {resultados.length > 0 && (
            <>
              {podeEditar && (
                <ModuleButton variant="outline" size="lg" onClick={handleSalvarResultados}>
                  <Save className="w-5 h-5 mr-2" />
                  Salvar resultados
                </ModuleButton>
              )}
              <ModuleButton variant="primary" size="lg" onClick={handleTodosOsRecibos}>
                <Receipt className="w-5 h-5 mr-2" />
                Todos os recibos
              </ModuleButton>
              {podeEditar && (
                <>
                  <ModuleButton variant="outline" size="lg" onClick={handleExportarPAT}>
                    <FileText className="w-5 h-5 mr-2" />
                    TXT PAT
                  </ModuleButton>
                  <ModuleButton variant="outline" size="lg" onClick={handleExportarAlterdata}>
                    <FileText className="w-5 h-5 mr-2" />
                    TXT Alterdata
                  </ModuleButton>
                  <ModuleButton variant="outline" size="lg" onClick={handleExportarConferencia}>
                    <FileSpreadsheet className="w-5 h-5 mr-2" />
                    Conferência
                  </ModuleButton>
                </>
              )}
              <ModuleButton variant="outline" size="lg" onClick={handleExportarComprovantes}>
                <Download className="w-5 h-5 mr-2" />
                Comprovantes
              </ModuleButton>
            </>
          )}
        </div>
      </ModuleCard>

      {resultados.length > 0 && (
        <>
          {mostrarValidacao && (totalErros > 0 || totalAvisos > 0) && (
            <ModuleCard title="Validação dos dados" icon={<AlertTriangle className="w-4 h-4" />} color={totalErros > 0 ? 'red' : 'yellow'}>
              <div className="space-y-3">
                {totalErros > 0 && (
                  <div className="flex items-center gap-2 text-red-700 font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    {totalErros} erro(s) encontrado(s)
                  </div>
                )}
                {totalAvisos > 0 && totalErros === 0 && (
                  <div className="flex items-center gap-2 text-yellow-700 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {totalAvisos} aviso(s) — revise antes de exportar
                  </div>
                )}
                <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                  {validacoes.flatMap((v, idx) =>
                    [...v.erros.map(e => `Erro: ${v.nome} (${v.cpf}) — ${e}`), ...v.avisos.map(a => `Aviso: ${v.nome} (${v.cpf}) — ${a}`)].map((msg, i) => (
                      <li key={`${idx}-${i}`} className={msg.startsWith('Erro') ? 'text-red-700' : 'text-yellow-700'}>
                        {msg}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </ModuleCard>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ModuleCard title="Total de colaboradores" icon={<Users className="w-4 h-4" />}>
              <div className="text-3xl font-bold text-blue-700">{resultados.length}</div>
            </ModuleCard>
            <ModuleCard title="Dias elegíveis" icon={<CheckCircle2 className="w-4 h-4" />}>
              <div className="text-3xl font-bold text-green-700">{totalElegiveis}</div>
            </ModuleCard>
            <ModuleCard title="Valor total" icon={<FileText className="w-4 h-4" />}>
              <div className="text-3xl font-bold text-purple-700">R$ {totalValor.toFixed(2)}</div>
            </ModuleCard>
          </div>

          <ModuleCard title="Resultados" icon={<Search className="w-4 h-4" />}>
            <div className="flex flex-col lg:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nome ou CPF..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-full lg:w-56">
                <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="elegivel">Elegível</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                    <SelectItem value="nao_elegivel">Não elegível</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {podeEditar && (
                <ModuleButton variant="danger" size="sm" onClick={() => setConfirmarRemoverZero(true)}>
                  <FilterX className="w-4 h-4 mr-2" />
                  Remover 0 dias
                </ModuleButton>
              )}
            </div>

            {resultados.some(r => r.diasElegiveis === 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Colaboradores com 0 dias elegíveis</p>
                  <p className="text-xs">
                    Eles podem estar de férias, afastados ou de folga. Só use "Remover 0 dias" se tiver certeza de que não devem constar no TXT deste mês.
                  </p>
                </div>
              </div>
            )}

            <div className="border-2 border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead className="text-center">PDF</TableHead>
                    <TableHead className="text-center">Escala</TableHead>
                    <TableHead className="text-center">Abat.</TableHead>
                    <TableHead className="text-center">Elegíveis</TableHead>
                    <TableHead className="text-right">Extra (R$)</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultadosFiltrados.map((r) => {
                    const idxOriginal = resultados.indexOf(r)
                    const expandido = expandidos.has(idxOriginal)
                    const status = statusDoResultado(r)
                    return (
                      <>
                        <TableRow key={idxOriginal} className="group hover:bg-blue-50">
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => toggleExpandir(idxOriginal)}
                              className="p-1 rounded hover:bg-slate-200"
                            >
                              {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {status === 'elegivel' && <span className="w-2 h-2 rounded-full bg-green-500" title="Elegível" />}
                              {status === 'parcial' && <span className="w-2 h-2 rounded-full bg-amber-500" title="Parcial" />}
                              {status === 'nao_elegivel' && <span className="w-2 h-2 rounded-full bg-red-500" title="Não elegível" />}
                              {r.nome}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-500">{formatarCPF(r.cpf)}</TableCell>
                          <TableCell className="text-slate-500">{r.matricula || '—'}</TableCell>
                          <TableCell className="text-center">{r.diasPdf}</TableCell>
                          <TableCell className="text-center">{r.diasEscala}</TableCell>
                          <TableCell className="text-center">{r.diasAbatimento}</TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              value={r.diasElegiveis}
                              onChange={e => {
                                if (!podeEditar) return
                                const dias = parseInt(e.target.value) || 0
                                atualizarResultado(idxOriginal, { diasElegiveis: dias }, config.valorVR)
                              }}
                              readOnly={!podeEditar}
                              className="h-7 text-xs w-20 mx-auto text-center"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={r.extra || 0}
                              onChange={e => {
                                if (!podeEditar) return
                                const extra = parseFloat(e.target.value) || 0
                                atualizarResultado(idxOriginal, { extra }, config.valorVR)
                              }}
                              readOnly={!podeEditar}
                              className="h-7 text-xs w-28 ml-auto text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">R$ {r.valorBruto.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="Comprovante individual"
                                onClick={() => handleComprovanteIndividual(r)}
                              >
                                <FileDown className="w-4 h-4" />
                              </button>
                              {podeEditar && (
                                <button
                                  type="button"
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  onClick={() => removerResultado(idxOriginal)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandido && (
                          <TableRow className="bg-slate-50">
                            <TableCell colSpan={11} className="p-0">
                              <div className="px-4 py-3">
                                <h4 className="text-sm font-semibold text-slate-700 mb-2">Detalhes do cálculo</h4>
                                {r.detalhes && r.detalhes.length > 0 ? (
                                  <ul className="text-sm list-disc list-inside text-slate-600 space-y-1">
                                    {r.detalhes.map((d, idx) => (
                                      <li key={idx}>{d}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-slate-500">Nenhum detalhe disponível.</p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Exibindo {resultadosFiltrados.length} de {resultados.length} colaboradores
            </p>
          </ModuleCard>
        </>
      )}

      {resultados.length === 0 && !loading && (
        <ModuleCard title="Comece o cálculo" icon={<Calculator className="w-4 h-4" />}>
          <div className="py-12 text-center text-slate-600">
            Importe os arquivos e clique em <strong>Calcular VR</strong> para visualizar os resultados.
          </div>
        </ModuleCard>
      )}

      <Dialog open={confirmarRemoverZero} onOpenChange={setConfirmarRemoverZero}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Remover colaboradores com 0 dias?</DialogTitle>
            <DialogDescription className="text-xs space-y-2">
              <p>
                {resultados.filter(r => r.diasElegiveis === 0).length} colaborador(es) serão removidos da lista.
              </p>
              <p className="text-amber-600 font-medium">
                Atenção: colaboradores com 0 dias podem estar de férias, afastados ou com folga no período.
                Só remova se tiver certeza de que não devem constar no TXT deste mês.
              </p>
              <p>Esta ação não pode ser desfeita após recarregar a página.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <ModuleButton variant="outline" size="sm" onClick={() => setConfirmarRemoverZero(false)}>
              Cancelar
            </ModuleButton>
            <ModuleButton variant="danger" size="sm" onClick={handleRemoverZeroDias}>
              Remover
            </ModuleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VrShell>
  )
}
