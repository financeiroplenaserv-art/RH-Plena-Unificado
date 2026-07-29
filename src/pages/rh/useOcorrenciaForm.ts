import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { gerarPDFOcorrencia } from '@/lib/pdf'
import type { Ocorrencia, Colaborador } from '@/types/database'
import {
  TIPOS_OCORRENCIA,
  exigeDocumento,
} from '@/lib/ocorrencias/tiposOcorrencia'

export interface FormularioOcorrencia {
  colaborador_id: string
  macro_grupo: string
  titulo: string
  tipo_ocorrencia: string
  data_ocorrencia: string
  descricao: string
  status: string
  tipo_penalidade: string
  base_legal: string
  gravidade: string
  data_hora_ocorrido: string
  local_ocorrido: string
  defesa_funcionario: string
  medida_corretiva: string
  prazo_acompanhamento: string
  testemunha_1_nome: string
  testemunha_1_cargo: string
  testemunha_2_nome: string
  testemunha_2_cargo: string
}

const COLUNAS_OCORRENCIA_FORM = 'id, colaborador_id, empresa_id, colaborador_nome, tipo_ocorrencia, macro_grupo, titulo, data_ocorrencia, descricao, status, tipo_penalidade, base_legal, gravidade, data_hora_ocorrido, local_ocorrido, defesa_funcionario, medida_corretiva, prazo_acompanhamento, testemunha_1_nome, testemunha_1_cargo, testemunha_2_nome, testemunha_2_cargo, usuario_id, created_at, updated_at'

export function useOcorrenciaForm() {
  const navigate = useNavigate()
  const { id, colaboradorId } = useParams()

  const isEdicao = Boolean(id)
  const [ocorrenciaOriginal, setOcorrenciaOriginal] = useState<Ocorrencia | null>(null)

  const [colabSelecionado, setColabSelecionado] = useState<Colaborador | null>(null)
  const [empresaSelecionada, setEmpresaSelecionada] = useState<{
    nome: string
    cnpj: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingOcorrencia, setLoadingOcorrencia] = useState(isEdicao)

  const [form, setForm] = useState<FormularioOcorrencia>({
    colaborador_id: colaboradorId || '',
    macro_grupo: '',
    titulo: '',
    tipo_ocorrencia: '',
    data_ocorrencia: new Date().toISOString().split('T')[0],
    descricao: '',
    status: 'Pendente',
    tipo_penalidade: '',
    base_legal: '',
    gravidade: '',
    data_hora_ocorrido: '',
    local_ocorrido: '',
    defesa_funcionario: '',
    medida_corretiva: '',
    prazo_acompanhamento: '',
    testemunha_1_nome: '',
    testemunha_1_cargo: '',
    testemunha_2_nome: '',
    testemunha_2_cargo: '',
  })

  const tiposFiltrados = form.macro_grupo
    ? TIPOS_OCORRENCIA.filter((t) => t.macroGrupo === form.macro_grupo)
    : []

  const carregarEmpresa = useCallback(async (empresaId: string | null) => {
    if (!empresaId) return
    const { data } = await supabase
      .from('empresas')
      .select('nome, cnpj')
      .eq('id', empresaId)
      .single()
    if (data) setEmpresaSelecionada(data as { nome: string; cnpj: string })
  }, [])

  const carregarColaborador = useCallback(async (colabId: string) => {
    const { data } = await supabase
      .from('colaboradores')
      .select('id, nome_completo, matricula, cargo, empresa_id')
      .eq('id', colabId)
      .single()
    if (data) {
      setColabSelecionado(data as Colaborador)
      carregarEmpresa(data.empresa_id || null)
    }
  }, [carregarEmpresa])

  useEffect(() => {
    if (!isEdicao || !id) return

    const carregar = async () => {
      setLoadingOcorrencia(true)
      const { data, error } = await supabase
        .from('ocorrencias')
        .select(COLUNAS_OCORRENCIA_FORM)
        .eq('id', id)
        .single()

      if (error || !data) {
        toast.error('Erro ao carregar ocorrência: ' + (error?.message || 'Não encontrada'))
        navigate('/rh/ocorrencias')
        return
      }

      const o = data as Ocorrencia
      setOcorrenciaOriginal(o)

      setForm({
        colaborador_id: o.colaborador_id || '',
        macro_grupo: o.macro_grupo || '',
        titulo: o.titulo || '',
        tipo_ocorrencia: o.tipo_ocorrencia || '',
        data_ocorrencia: o.data_ocorrencia || new Date().toISOString().split('T')[0],
        descricao: o.descricao || '',
        status: o.status || 'Pendente',
        tipo_penalidade: o.tipo_penalidade || '',
        base_legal: o.base_legal || '',
        gravidade: o.gravidade || '',
        data_hora_ocorrido: o.data_hora_ocorrido || '',
        local_ocorrido: o.local_ocorrido || '',
        defesa_funcionario: o.defesa_funcionario || '',
        medida_corretiva: o.medida_corretiva || '',
        prazo_acompanhamento: o.prazo_acompanhamento || '',
        testemunha_1_nome: o.testemunha_1_nome || '',
        testemunha_1_cargo: o.testemunha_1_cargo || '',
        testemunha_2_nome: o.testemunha_2_nome || '',
        testemunha_2_cargo: o.testemunha_2_cargo || '',
      })

      if (o.colaborador_id) {
        await carregarColaborador(o.colaborador_id)
      }

      setLoadingOcorrencia(false)
    }

    carregar()
  }, [isEdicao, id, navigate, carregarColaborador])

  const handleColaboradorChange = (colab: Colaborador | null) => {
    setColabSelecionado(colab)
    setForm((prev) => ({ ...prev, colaborador_id: colab?.id || '' }))
    carregarEmpresa(colab?.empresa_id || null)
  }

  const handleMacroGrupoChange = (macroGrupo: string) => {
    setForm((prev) => ({
      ...prev,
      macro_grupo: macroGrupo,
      tipo_ocorrencia: '',
      tipo_penalidade: '',
      gravidade: '',
      base_legal: '',
      descricao: '',
    }))
  }

  const handleTipoPenalidadeChange = (tipo: string) => {
    const modelo = TIPOS_OCORRENCIA.find((t) => t.tipo === tipo)
    if (modelo) {
      const nomeEmpresa = empresaSelecionada?.nome || '[EMPRESA]'
      const cnpjEmpresa = empresaSelecionada?.cnpj || '[CNPJ]'
      const textoComEmpresa = modelo.texto
        .replace(/\[EMPRESA\]/g, nomeEmpresa)
        .replace(/\[CNPJ\]/g, cnpjEmpresa)

      setForm((prev) => ({
        ...prev,
        tipo_penalidade: modelo.tipo,
        gravidade: modelo.gravidade,
        base_legal: modelo.baseLegal,
        tipo_ocorrencia: modelo.tipo,
        descricao: textoComEmpresa,
      }))
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.colaborador_id) {
      toast.error('Selecione um colaborador')
      return
    }
    if (!form.titulo.trim()) {
      toast.error('Informe um título para a ocorrência')
      return
    }
    if (!form.tipo_penalidade) {
      toast.error('Selecione o tipo de ocorrência')
      return
    }
    if (!form.descricao.trim()) {
      toast.error('O campo "Descrição" é obrigatório')
      return
    }
    if (!form.defesa_funcionario.trim()) {
      toast.error('O campo "Defesa do Funcionário" é obrigatório')
      return
    }

    setLoading(true)

    const precisaDocumento = exigeDocumento(form.tipo_penalidade)
    const statusFinal = isEdicao ? ocorrenciaOriginal?.status || 'Ativa' : (precisaDocumento ? 'Pendente' : 'Ativa')

    const payload: Record<string, string | null> = {
      ...form,
      status: statusFinal,
      empresa_id: colabSelecionado?.empresa_id || ocorrenciaOriginal?.empresa_id || null,
    }
    if (colabSelecionado) payload.colaborador_nome = colabSelecionado.nome_completo

    for (const [k, v] of Object.entries(payload)) {
      if (v === '') payload[k] = null
    }

    let data, error

    if (isEdicao && id) {
      const result = await supabase
        .from('ocorrencias')
        .update(payload as Partial<Ocorrencia>)
        .eq('id', id)
        .select(COLUNAS_OCORRENCIA_FORM)
        .single()
      data = result.data
      error = result.error
    } else {
      const result = await supabase
        .from('ocorrencias')
        .insert(payload as Partial<Ocorrencia>)
        .select(COLUNAS_OCORRENCIA_FORM)
        .single()
      data = result.data
      error = result.error
    }

    if (error) {
      toast.error(isEdicao ? 'Erro ao salvar alterações: ' + error.message : 'Erro ao registrar: ' + error.message)
    } else {
      toast.success(isEdicao ? 'Ocorrência atualizada com sucesso.' : (precisaDocumento ? 'Ocorrência registrada como PENDENTE. Anexe documentos comprobatórios para ativar.' : 'Ocorrência registrada como ATIVA.'))
      if (colabSelecionado && data) {
        // Falha no PDF não pode travar a tela nem impedir a navegação —
        // a ocorrência já está salva e o PDF pode ser gerado depois.
        try {
          await gerarPDFOcorrencia(colabSelecionado, data as Ocorrencia, undefined, undefined, empresaSelecionada)
        } catch (pdfErr) {
          console.error('Erro ao gerar PDF da ocorrência:', pdfErr)
          toast.warning('Ocorrência salva, mas o PDF não pôde ser gerado agora. Você pode gerá-lo na tela de detalhes.')
        }
      }
      navigate(`/rh/ocorrencias/${(data as Ocorrencia).id}`)
    }
    setLoading(false)
  }

  return {
    isEdicao,
    form,
    colabSelecionado,
    empresaSelecionada,
    loading,
    loadingOcorrencia,
    tiposFiltrados,
    handleColaboradorChange,
    handleMacroGrupoChange,
    handleTipoPenalidadeChange,
    handleChange,
    handleSubmit,
  }
}
