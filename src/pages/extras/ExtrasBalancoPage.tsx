import { useEffect, useMemo, useState } from 'react'
import { Copy, RefreshCcw, Plus, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useExtras } from '@/hooks/useExtras'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useDepartamentos } from '@/hooks/useDepartamentos'
import { ExtrasShell } from './ExtrasShell'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { PageHeader } from '@/components/PageHeader'
import { formatarData, nomeDepartamento } from '@/lib/utils'
import { toast } from 'sonner'
import type { Extra } from '@/types/extras'

function subtrairUmDia(dataStr: string): string {
  const data = new Date(dataStr + 'T00:00:00')
  data.setDate(data.getDate() - 1)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function formatarComunicacao(extra: Extra): string {
  if (!extra.comunicacao_tipo || extra.comunicacao_tipo === 'Não se aplica') return 'Não se aplica'
  const partes: string[] = [extra.comunicacao_tipo]
  if (extra.comunicacao_data) partes.push(formatarData(extra.comunicacao_data))
  if (extra.comunicacao_hora) partes.push(extra.comunicacao_hora)
  if (extra.comunicacao_detalhes) partes.push(extra.comunicacao_detalhes)
  return partes.join(' ')
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const RODAPE_BALANCO = `Demais Operações:

Operacional S/O
Zelador (Dia): S/O
Encarregado / Zelador (Noite anterior): S/O
Medidas disciplinares: S/O
Jardinagem: S/O

Porteiros / ASG / Faltistas em apoio
(FA LIMP 01) –
(FA LIMP 02) –
(FA PORT 01) –
(FA PORT 02) –`

export function ExtrasBalancoPage() {
  const navigate = useNavigate()
  const hoje = new Date().toISOString().split('T')[0]
  const [dataSelecionada, setDataSelecionada] = useState(hoje)
  const [mensagemEditada, setMensagemEditada] = useState('')

  const { extras, loading, listar } = useExtras()
  const { colaboradores, listar: listarColaboradores } = useColaboradores()
  const { departamentos, listar: listarDepartamentos } = useDepartamentos()

  useEffect(() => {
    listarColaboradores()
    listarDepartamentos()
  }, [listarColaboradores, listarDepartamentos])

  useEffect(() => {
    listar({ dataInicio: dataSelecionada, dataFim: dataSelecionada })
  }, [dataSelecionada, listar])

  const mapColaborador = useMemo(() => {
    const m = new Map<string, { nome: string; departamento_id: string | null }>()
    colaboradores.forEach(c => m.set(c.id, { nome: c.nome_completo, departamento_id: c.departamento_id }))
    return m
  }, [colaboradores])

  const mapDepartamento = useMemo(() => {
    const m = new Map<string, string>()
    departamentos.forEach(d => m.set(d.id, nomeDepartamento(d)))
    return m
  }, [departamentos])

  const extrasDia = useMemo(() => extras.filter(e => e.data_ocorrencia === dataSelecionada), [extras, dataSelecionada])

  const extrasPortariaNoiteAnterior = useMemo(() => {
    const diaAnterior = subtrairUmDia(dataSelecionada)
    return extras.filter(e =>
      e.data_ocorrencia === diaAnterior &&
      e.categoria === 'Portaria' &&
      e.turno === 'Noite anterior'
    )
  }, [extras, dataSelecionada])

  const departamentoDoExtra = (extra: Extra): string => {
    if (extra.departamento_nome) return extra.departamento_nome
    if (!extra.colaborador_ausente_id) return 'Não informado'
    const col = mapColaborador.get(extra.colaborador_ausente_id)
    if (!col || !col.departamento_id) return 'Não informado'
    return mapDepartamento.get(col.departamento_id) || 'Não informado'
  }

  const gerarMensagem = () => {
    const dataFormatada = formatarData(dataSelecionada)
    let texto = `Bom dia!\n\n*Balanço Operacional – ${dataFormatada}*\n`

    const categoriasDia = [...new Set(extrasDia.map(e => e.categoria))].sort()

    if (extrasDia.length === 0 && extrasPortariaNoiteAnterior.length === 0) {
      texto += '\n_Nenhuma ocorrência registrada._'
    }

    categoriasDia.forEach(categoria => {
      const daCategoria = extrasDia.filter(e => e.categoria === categoria)
      const porDepartamento = daCategoria.reduce((acc, extra) => {
        const dept = departamentoDoExtra(extra)
        if (!acc[dept]) acc[dept] = []
        acc[dept].push(extra)
        return acc
      }, {} as Record<string, Extra[]>)

      texto += `\n*${categoria}*\n`
      Object.entries(porDepartamento).forEach(([dept, itens]) => {
        texto += `\n*Departamento:* ${dept}\n`
        itens.forEach(extra => {
          const ausente = extra.colaborador_ausente_nome || 'Não se aplica'
          const substituto = extra.substituto_nome || 'Não informado'
          const comunicacao = formatarComunicacao(extra)
          const faturado = extra.extra_faturado ? ' 💰 *FATURADO*' : ''
          texto += `• *Ausente:* ${ausente}${faturado}\n`
          texto += `  *Substituto:* ${substituto}\n`
          texto += `  *Valor:* ${formatarMoeda(extra.valor)}\n`
          texto += `  *Cliente:* ${comunicacao}\n\n`
        })
      })
    })

    if (extrasPortariaNoiteAnterior.length > 0) {
      const dataAnteriorFormatada = formatarData(subtrairUmDia(dataSelecionada))
      const porDepartamento = extrasPortariaNoiteAnterior.reduce((acc, extra) => {
        const dept = departamentoDoExtra(extra)
        if (!acc[dept]) acc[dept] = []
        acc[dept].push(extra)
        return acc
      }, {} as Record<string, Extra[]>)

      texto += `\n*Portaria – Noite anterior (${dataAnteriorFormatada})*\n`
      Object.entries(porDepartamento).forEach(([dept, itens]) => {
        texto += `\n*Departamento:* ${dept}\n`
        itens.forEach(extra => {
          const ausente = extra.colaborador_ausente_nome || 'Não se aplica'
          const substituto = extra.substituto_nome || 'Não informado'
          const comunicacao = formatarComunicacao(extra)
          const faturado = extra.extra_faturado ? ' 💰 *FATURADO*' : ''
          texto += `• *Ausente:* ${ausente}${faturado}\n`
          texto += `  *Substituto:* ${substituto}\n`
          texto += `  *Valor:* ${formatarMoeda(extra.valor)}\n`
          texto += `  *Cliente:* ${comunicacao}\n\n`
        })
      })
    }

    return `${texto.trim()}\n\n${RODAPE_BALANCO}`
  }

  useEffect(() => {
    const novaMensagem = gerarMensagem()
    setMensagemEditada(novaMensagem)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extrasDia, extrasPortariaNoiteAnterior, dataSelecionada, mapColaborador, mapDepartamento])

  const copiarFallback = (texto: string): boolean => {
    const textarea = document.createElement('textarea')
    textarea.value = texto
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    try {
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      document.body.removeChild(textarea)
      return false
    }
  }

  const handleCopiar = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(mensagemEditada)
      } else {
        const ok = copiarFallback(mensagemEditada)
        if (!ok) throw new Error('Fallback falhou')
      }
      toast.success('Mensagem copiada para a área de transferência')
    } catch {
      toast.error('Erro ao copiar mensagem')
    }
  }

  const handleWhatsApp = () => {
    const texto = mensagemEditada.trim()
    if (!texto) {
      toast.error('Gere a mensagem do balanço antes de enviar pelo WhatsApp')
      return
    }
    // WhatsApp tem limite prático para URLs muito longas; trunca com aviso se necessário
    const MAX_WHATSAPP_URL = 3000
    let textoFinal = texto
    if (encodeURIComponent(texto).length > MAX_WHATSAPP_URL) {
      const truncado = texto.slice(0, 2000)
      textoFinal = `${truncado}\n\n[Mensagem truncada - copie o restante pelo botão Copiar]`
      toast.info('Mensagem muito longa; enviada parte inicial pelo WhatsApp')
    }
    const url = `https://wa.me/?text=${encodeURIComponent(textoFinal)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleRegenerar = () => {
    const novaMensagem = gerarMensagem()
    setMensagemEditada(novaMensagem)
  }

  const totalOcorrencias = extrasDia.length + extrasPortariaNoiteAnterior.length
  const totalValor = [...extrasDia, ...extrasPortariaNoiteAnterior].reduce((acc, e) => acc + (e.valor || 0), 0)
  const comunicacoesPendentes = extrasDia.filter(e =>
    !e.comunicacao_tipo || e.comunicacao_tipo === 'Não se aplica'
  ).length

  return (
    <ExtrasShell>
      <PageHeader backTo="/extras/lancamentos" title="Balanço Operacional" description="Gere a mensagem diária para envio no WhatsApp">
        <ModuleButton onClick={() => navigate('/extras/novo')}>
          <Plus className="w-4 h-4 mr-2" />
          Novo extra
        </ModuleButton>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ModuleCard title="Data do balanço">
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Selecione a data</Label>
            <Input
              type="date"
              value={dataSelecionada}
              onChange={e => setDataSelecionada(e.target.value)}
              className="rounded-lg"
            />
          </div>
        </ModuleCard>

        <ModuleCard title="Resumo">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold" style={{ color: '#1F2937' }}>{totalOcorrencias}</div>
              <div className="text-xs" style={{ color: '#94A3B8' }}>Ocorrências</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: '#1F2937' }}>{formatarMoeda(totalValor)}</div>
              <div className="text-xs" style={{ color: '#94A3B8' }}>Valor total</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: comunicacoesPendentes > 0 ? '#EF4444' : '#22C55E' }}>{comunicacoesPendentes}</div>
              <div className="text-xs" style={{ color: '#94A3B8' }}>Sem comunicação</div>
            </div>
          </div>
        </ModuleCard>

        <ModuleCard title="Ações">
          <div className="flex flex-wrap gap-2">
            <ModuleButton variant="outline" size="sm" onClick={handleRegenerar}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Gerar novamente
            </ModuleButton>
            <ModuleButton size="sm" onClick={handleCopiar}>
              <Copy className="w-4 h-4 mr-2" />
              Copiar mensagem
            </ModuleButton>
            <ModuleButton size="sm" variant="outline" onClick={handleWhatsApp}>
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </ModuleButton>
          </div>
        </ModuleCard>
      </div>

      <ModuleCard title="Mensagem para o WhatsApp">
        {loading ? (
          <p className="text-center py-8" style={{ color: '#94A3B8' }}>Carregando ocorrências...</p>
        ) : (
          <div className="space-y-4">
            <Textarea
              value={mensagemEditada}
              onChange={e => setMensagemEditada(e.target.value)}
              rows={20}
              className="rounded-lg font-mono text-sm whitespace-pre-wrap"
            />
            <div className="flex justify-between items-center text-xs" style={{ color: '#94A3B8' }}>
              <span>{mensagemEditada.length} caracteres</span>
              <span>Você pode editar o texto antes de copiar</span>
            </div>
          </div>
        )}
      </ModuleCard>
    </ExtrasShell>
  )
}
