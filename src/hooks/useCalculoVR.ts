import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { VRConfiguracao, VRResultadoCalculo, VRColaboradorPonto, VRColaboradorEscala } from '@/types'
import { parsePDFPonto } from '@/lib/vr/pdfParser'
import { parseExcelEscala } from '@/lib/vr/excelParser'
import { calcularVR, carregarDatasNascimento, gerarArquivoVRPAT, gerarArquivoAlterdata, gerarExcelConferencia } from '@/lib/vr/calculoVR'
import { extrairTextoPDF } from '@/lib/vr/pdfExtractor'

interface EstadoCalculo {
  pdfAnterior: Map<string, VRColaboradorPonto>
  pdfAtual: Map<string, VRColaboradorPonto>
  escala: VRColaboradorEscala[]
  datasNascimento: Map<string, string>
  cpfsPorNome: Map<string, string>
  matriculasPorCpf: Map<string, string>
  matriculasPorNome: Map<string, string>
}

export function useCalculoVR() {
  const [estado, setEstado] = useState<EstadoCalculo>({
    pdfAnterior: new Map(),
    pdfAtual: new Map(),
    escala: [],
    datasNascimento: new Map(),
    cpfsPorNome: new Map(),
    matriculasPorCpf: new Map(),
    matriculasPorNome: new Map(),
  })
  const [resultados, setResultados] = useState<VRResultadoCalculo[]>([])
  const [loading, setLoading] = useState(false)

  const limpar = useCallback(() => {
    setEstado({
      pdfAnterior: new Map(),
      pdfAtual: new Map(),
      escala: [],
      datasNascimento: new Map(),
      cpfsPorNome: new Map(),
      matriculasPorCpf: new Map(),
      matriculasPorNome: new Map(),
    })
    setResultados([])
  }, [])

  const processarPdfAnterior = useCallback(async (file: File) => {
    const texto = await extrairTextoPDF(file)
    const pdfAnterior = parsePDFPonto(texto)
    setEstado(prev => ({ ...prev, pdfAnterior }))
    toast.success(`PDF anterior processado: ${pdfAnterior.size} colaboradores`)
    return pdfAnterior
  }, [])

  const processarPdfAtual = useCallback(async (file: File) => {
    const texto = await extrairTextoPDF(file)
    const pdfAtual = parsePDFPonto(texto)
    setEstado(prev => ({ ...prev, pdfAtual }))
    toast.success(`PDF atual processado: ${pdfAtual.size} colaboradores`)
    return pdfAtual
  }, [])

  const processarEscala = useCallback(async (file: File) => {
    const ab = await file.arrayBuffer()
    const escala = parseExcelEscala(ab)
    setEstado(prev => ({ ...prev, escala }))
    toast.success(`Escala processada: ${escala.length} colaboradores`)
    return escala
  }, [])

  const processarBase = useCallback(async (file: File) => {
    const ab = await file.arrayBuffer()
    const { datas, cpfsPorNome, matriculasPorCpf, matriculasPorNome } = carregarDatasNascimento(ab)
    setEstado(prev => ({ ...prev, datasNascimento: datas, cpfsPorNome, matriculasPorCpf, matriculasPorNome }))
    toast.success(`Base processada: ${datas.size} datas de nascimento`)
    return { datas, cpfsPorNome, matriculasPorCpf, matriculasPorNome }
  }, [])

  const calcular = useCallback(async (config: VRConfiguracao) => {
    setLoading(true)
    try {
      const { pdfAnterior, pdfAtual, escala, cpfsPorNome, matriculasPorCpf, matriculasPorNome } = estado

      if (pdfAtual.size === 0 && escala.length === 0) {
        toast.error('Importe o PDF atual ou a escala antes de calcular')
        return []
      }

      const calculados = calcularVR(
        pdfAnterior,
        pdfAtual,
        escala,
        config,
        cpfsPorNome,
        matriculasPorCpf,
        matriculasPorNome
      )

      setResultados(calculados)
      toast.success(`Cálculo concluído: ${calculados.length} resultados`)
      return calculados
    } finally {
      setLoading(false)
    }
  }, [estado])

  const exportarPAT = useCallback((config: VRConfiguracao) => {
    return gerarArquivoVRPAT(resultados, config, estado.datasNascimento)
  }, [resultados, estado.datasNascimento])

  const exportarAlterdata = useCallback((config: VRConfiguracao) => {
    return gerarArquivoAlterdata(resultados, config)
  }, [resultados])

  const exportarConferencia = useCallback((config: VRConfiguracao) => {
    return gerarExcelConferencia(resultados, config)
  }, [resultados])

  const atualizarResultado = useCallback((index: number, patch: Partial<VRResultadoCalculo>, valorVR?: number) => {
    setResultados(prev => {
      const novo = [...prev]
      novo[index] = { ...novo[index], ...patch }
      if ((patch.diasElegiveis !== undefined || patch.extra !== undefined) && valorVR !== undefined) {
        const extra = novo[index].extra || 0
        novo[index].valorBruto = novo[index].diasElegiveis * valorVR + extra
      }
      return novo
    })
  }, [])

  const removerResultado = useCallback((index: number) => {
    setResultados(prev => prev.filter((_, i) => i !== index))
  }, [])

  return {
    estado,
    resultados,
    loading,
    processarPdfAnterior,
    processarPdfAtual,
    processarEscala,
    processarBase,
    calcular,
    exportarPAT,
    exportarAlterdata,
    exportarConferencia,
    atualizarResultado,
    removerResultado,
    setResultados,
    limpar,
  }
}
