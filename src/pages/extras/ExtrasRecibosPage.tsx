import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, DollarSign, RefreshCcw, Trash2, X, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useExtras } from '@/hooks/useExtras'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useEmpresas } from '@/hooks/useEmpresas'
import { useExtrasRecibos } from '@/hooks/useExtrasRecibos'
import { useAuth } from '@/hooks/useAuth'
import { AssinaturaCanvas, type AssinaturaCanvasRef } from '@/components/extras/AssinaturaCanvas'
import { ExtrasShell } from './ExtrasShell'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { PageHeader } from '@/components/corh/PageHeader'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { gerarReciboExtraPDF } from '@/lib/extrasRecibos'
import {
  podeGerenciarReciboExtra,
  podeMarcarExtraComoPago,
  podeCancelarReciboExtra,
} from '@/lib/permissoes'
import type { Extra, ReciboExtra } from '@/types/extras'

function getInicioSemana(data: Date): Date {
  const d = new Date(data)
  const dia = d.getDay()
  const diff = d.getDate() - dia
  return new Date(d.setDate(diff))
}

function formatarDataInput(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function formatarDataBR(data: string | null) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface GrupoSubstituto {
  substituto_id: string | null
  substituto_nome: string
  extras: Extra[]
  valorTotal: number
}

export function ExtrasRecibosPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeGerenciarRecibo = perfil ? podeGerenciarReciboExtra(perfil) : false
  const podeMarcarPago = perfil ? podeMarcarExtraComoPago(perfil) : false
  const podeCancelarRecibo = perfil ? podeCancelarReciboExtra(perfil) : false

  const hoje = new Date()
  const inicioSemana = getInicioSemana(hoje)
  const fimSemana = new Date(inicioSemana)
  fimSemana.setDate(fimSemana.getDate() + 6)

  const [dataInicio, setDataInicio] = useState(formatarDataInput(inicioSemana))
  const [dataFim, setDataFim] = useState(formatarDataInput(fimSemana))
  const [empresaId, setEmpresaId] = useState<string>('')
  const [modalAberto, setModalAberto] = useState(false)
  const [reciboParaAssinar, setReciboParaAssinar] = useState<ReciboExtra | null>(null)
  const [grupoSelecionado, setGrupoSelecionado] = useState<GrupoSubstituto | null>(null)
  const [marcarPago, setMarcarPago] = useState(false)
  const [emitindo, setEmitindo] = useState(false)
  const [modoPapel, setModoPapel] = useState(false)
  const [filtroNome, setFiltroNome] = useState('')
  const [ordemNome, setOrdemNome] = useState<'asc' | 'desc' | null>('asc')
  const [reciboParaRemover, setReciboParaRemover] = useState<string | null>(null)
  const [grupoParaPagar, setGrupoParaPagar] = useState<GrupoSubstituto | null>(null)

  const { extras, loading: loadingExtras, listar, atualizar } = useExtras()
  const { colaboradores, listarResumido: listarColaboradores } = useColaboradores()
  const { empresas, listar: listarEmpresas } = useEmpresas()
  const { recibos, listar: listarRecibos, criar, assinar, remover } = useExtrasRecibos()
  const assinaturaRef = useRef<AssinaturaCanvasRef>(null)

  useEffect(() => {
    listarColaboradores()
    listarEmpresas()
  }, [listarColaboradores, listarEmpresas])

  useEffect(() => {
    listar({ dataInicio, dataFim })
    listarRecibos({ dataInicio, dataFim })
  }, [dataInicio, dataFim, listar, listarRecibos])

  const mapColaborador = useMemo(() => {
    const m = new Map<string, { nome_completo: string; matricula?: string | null; cpf?: string | null; cargo?: string | null; departamento?: string | null }>()
    colaboradores.forEach(c => m.set(c.id, c))
    return m
  }, [colaboradores])

  const empresaPadrao = useMemo(() => ({
    id: '',
    nome: '[Empresa não selecionada]',
    cnpj: null,
  }), [])

  const empresaSelecionada = useMemo(() => {
    const empresa = empresaId
      ? empresas.find(e => e.id === empresaId)
      : empresas[0]

    return empresa || empresaPadrao
  }, [empresas, empresaId, empresaPadrao])

  const grupos = useMemo<GrupoSubstituto[]>(() => {
    const mapa = new Map<string, GrupoSubstituto>()
    extras
      // Faltas de controle interno (gera_extra=false) não entram no
      // balanço/recibos de pagamento — só aparecem no relatório diário.
      .filter(e => e.status !== 'Cancelado' && e.gera_extra !== false)
      .forEach(extra => {
        const chave = extra.substituto_id || extra.substituto_nome || 'nao_informado'
        if (!mapa.has(chave)) {
          mapa.set(chave, {
            substituto_id: extra.substituto_id,
            substituto_nome: extra.substituto_nome || 'Não informado',
            extras: [],
            valorTotal: 0,
          })
        }
        const grupo = mapa.get(chave)!
        grupo.extras.push(extra)
        grupo.valorTotal += Number(extra.valor) || 0
      })

    let lista = Array.from(mapa.values())
      .filter(g => g.substituto_nome !== 'Não informado')

    if (filtroNome.trim()) {
      const termo = filtroNome.toLowerCase()
      lista = lista.filter(g => g.substituto_nome.toLowerCase().includes(termo))
    }

    if (ordemNome === 'asc') {
      lista = lista.sort((a, b) => a.substituto_nome.localeCompare(b.substituto_nome))
    } else if (ordemNome === 'desc') {
      lista = lista.sort((a, b) => b.substituto_nome.localeCompare(a.substituto_nome))
    }

    return lista
  }, [extras, filtroNome, ordemNome])

  const recibosAssinados = useMemo(() => recibos.filter(r => r.status === 'assinado'), [recibos])

  const abrirModalAssinatura = (recibo: ReciboExtra, grupo: GrupoSubstituto) => {
    setReciboParaAssinar(recibo)
    setGrupoSelecionado(grupo)
    setMarcarPago(false)
    setModalAberto(true)
  }

  const handleGerarRecibo = async (grupo: GrupoSubstituto) => {
    const jaExiste = recibos.some(r => {
      const mesmoColaborador = grupo.substituto_id ? r.colaborador_id === grupo.substituto_id : r.colaborador_nome === grupo.substituto_nome
      return mesmoColaborador && r.data_inicio === dataInicio && r.data_fim === dataFim && r.status !== 'cancelado'
    })

    if (jaExiste && !modoPapel) {
      const reciboExistente = recibos.find(r => {
        const mesmoColaborador = grupo.substituto_id ? r.colaborador_id === grupo.substituto_id : r.colaborador_nome === grupo.substituto_nome
        return mesmoColaborador && r.data_inicio === dataInicio && r.data_fim === dataFim && r.status !== 'cancelado'
      })
      if (reciboExistente) {
        abrirModalAssinatura(reciboExistente, grupo)
      }
      return
    }

    const recibo = await criar({
      colaborador_id: grupo.substituto_id,
      colaborador_nome: grupo.substituto_nome,
      data_inicio: dataInicio,
      data_fim: dataFim,
      valor_total: grupo.valorTotal,
      quantidade_extras: grupo.extras.length,
      assinatura_colaborador: null,
      extras_ids: grupo.extras.map(e => e.id),
      marcar_pago: false,
      status: modoPapel ? 'assinado' : 'pendente_assinatura',
      data_assinatura: modoPapel ? new Date().toISOString() : null,
      usuario_id: null,
    })

    if (!recibo) return

    listarRecibos({ dataInicio, dataFim })

    if (modoPapel) {
      const colab = grupo.substituto_id ? mapColaborador.get(grupo.substituto_id) : undefined
      try {
        await gerarReciboExtraPDF(
          { nome: grupo.substituto_nome, cpf: colab?.cpf },
          grupo.extras,
          recibo.data_inicio,
          recibo.data_fim,
          '',
          recibo.id,
          { nome: empresaSelecionada?.nome, cnpj: empresaSelecionada?.cnpj },
          recibo.data_assinatura,
          true
        )
        toast.success('Recibo para impressão gerado')
      } catch (err) {
        console.error('Erro ao gerar recibo para impressão:', err)
        toast.error('Erro ao gerar PDF: ' + (err instanceof Error ? err.message : 'erro desconhecido'))
      }
      return
    }

    abrirModalAssinatura(recibo, grupo)
  }

  const handleAssinar = async () => {
    if (!reciboParaAssinar || !grupoSelecionado) return
    if (assinaturaRef.current?.isEmpty()) {
      toast.error('É necessário assinar antes de confirmar')
      return
    }

    setEmitindo(true)
    const assinatura = assinaturaRef.current?.toDataURL() || ''

    const recibo = await assinar(reciboParaAssinar.id, assinatura, marcarPago)

    if (recibo) {
      const colab = grupoSelecionado.substituto_id
        ? mapColaborador.get(grupoSelecionado.substituto_id)
        : undefined

      try {
        await gerarReciboExtraPDF(
          {
            nome: grupoSelecionado.substituto_nome,
            cpf: colab?.cpf,
          },
          grupoSelecionado.extras,
          recibo.data_inicio,
          recibo.data_fim,
          assinatura,
          recibo.id,
          { nome: empresaSelecionada?.nome, cnpj: empresaSelecionada?.cnpj },
          recibo.data_assinatura
        )
      } catch (err) {
        console.error('Erro ao gerar PDF assinado:', err)
        toast.error('Erro ao gerar PDF: ' + (err instanceof Error ? err.message : 'erro desconhecido'))
        setEmitindo(false)
        return
      }

      setModalAberto(false)
      setReciboParaAssinar(null)
      setGrupoSelecionado(null)
      assinaturaRef.current?.limpar()
      listarRecibos({ dataInicio, dataFim })
      listar({ dataInicio, dataFim })
    }

    setEmitindo(false)
  }

  const handleReemitirPDF = async (recibo: ReciboExtra) => {
    const grupo: GrupoSubstituto = {
      substituto_id: recibo.colaborador_id,
      substituto_nome: recibo.colaborador_nome || 'Não informado',
      extras: extras.filter(e => recibo.extras_ids.includes(e.id)),
      valorTotal: recibo.valor_total,
    }

    const colab = grupo.substituto_id ? mapColaborador.get(grupo.substituto_id) : undefined

    try {
      await gerarReciboExtraPDF(
        {
          nome: grupo.substituto_nome,
          cpf: colab?.cpf,
        },
        grupo.extras,
        recibo.data_inicio,
        recibo.data_fim,
        recibo.assinatura_colaborador || '',
        recibo.id,
        { nome: empresaSelecionada?.nome, cnpj: empresaSelecionada?.cnpj },
        recibo.data_assinatura
      )
    } catch (err) {
      console.error('Erro ao reemitir PDF do recibo:', err)
      toast.error('Erro ao gerar PDF: ' + (err instanceof Error ? err.message : 'erro desconhecido'))
    }
  }

  const handleRemoverRecibo = async (id: string) => {
    setReciboParaRemover(id)
  }

  const confirmarRemoverRecibo = async () => {
    if (!reciboParaRemover) return
    const ok = await remover(reciboParaRemover)
    if (ok) listarRecibos({ dataInicio, dataFim })
    setReciboParaRemover(null)
  }

  const marcarExtrasComoPago = async (grupo: GrupoSubstituto) => {
    const pendentes = grupo.extras.filter(e => e.status !== 'Pago')
    if (pendentes.length === 0) {
      toast.info('Todos os extras deste colaborador já estão pagos')
      return
    }

    // CORREÇÃO DE SEGURANÇA/COMPLIANCE: só permite marcar como pago se houver
    // recibo assinado para o colaborador no período. Isso garante prova de pagamento.
    const reciboAssinado = recibos.find(r => {
      const mesmoColaborador = grupo.substituto_id ? r.colaborador_id === grupo.substituto_id : r.colaborador_nome === grupo.substituto_nome
      return mesmoColaborador && r.data_inicio === dataInicio && r.data_fim === dataFim && r.status === 'assinado'
    })

    if (!reciboAssinado) {
      toast.error('É necessário gerar o recibo (com assinatura digital ou em papel) antes de marcar os extras como pagos.')
      return
    }

    // Amarração recibo ↔ extras: todos os extras a pagar devem constar no recibo
    // e o valor total do recibo deve corresponder à soma dos extras do grupo.
    const idsNoRecibo = new Set(reciboAssinado.extras_ids || [])
    const todosIdsNoRecibo = pendentes.every(e => idsNoRecibo.has(e.id))
    const valorPendentes = pendentes.reduce((s, e) => s + (Number(e.valor) || 0), 0)
    const valorBate = Math.abs(reciboAssinado.valor_total - valorPendentes) < 0.01

    if (!todosIdsNoRecibo || !valorBate) {
      toast.error(
        'Os extras atuais não correspondem ao recibo assinado. Gere um novo recibo antes de marcar como pago.'
      )
      return
    }

    setGrupoParaPagar(grupo)
  }

  const confirmarMarcarComoPago = async () => {
    if (!grupoParaPagar) return
    const pendentes = grupoParaPagar.extras.filter(e => e.status !== 'Pago')

    let sucessos = 0
    for (const extra of pendentes) {
      const ok = await atualizar(extra.id, { status: 'Pago' })
      if (ok) sucessos++
    }

    if (sucessos > 0) {
      toast.success(`${sucessos} extra(s) marcado(s) como Pago`)
      await listar({ dataInicio, dataFim })
      await listarRecibos({ dataInicio, dataFim })
    }
    setGrupoParaPagar(null)
  }

  const totalGeral = useMemo(() => grupos.reduce((acc, g) => acc + g.valorTotal, 0), [grupos])

  return (
    <ExtrasShell>
      <PageHeader backTo="/extras/lancamentos" title="Recibos de Extras" description="Gere recibos de pagamento com assinatura digital" />

      <ModuleCard title="Filtros">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Data início</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Data fim</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Colaborador</Label>
            <Input
              type="text"
              placeholder="Filtrar por nome"
              value={filtroNome}
              onChange={e => setFiltroNome(e.target.value)}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Empresa</Label>
            <select
              value={empresaId}
              onChange={e => setEmpresaId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm"
            >
              <option value="">{empresas.length > 0 ? empresas[0].nome : 'Selecione uma empresa'}</option>
              {empresas.map(empresa => (
                <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Modo de emissão</Label>
            <label className="flex items-center gap-2 text-sm cursor-pointer h-10">
              <input
                type="checkbox"
                checked={modoPapel}
                onChange={e => setModoPapel(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span>Emissão em papel (sem assinatura digital)</span>
            </label>
          </div>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
            <ModuleButton variant="outline" size="sm" onClick={() => { listar({ dataInicio, dataFim }); listarRecibos({ dataInicio, dataFim }) }}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Atualizar
            </ModuleButton>
          </div>
        </div>
      </ModuleCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ModuleCard title="Colaboradores com extras">
          <div className="text-2xl font-bold" style={{ color: '#1F2937' }}>{grupos.length}</div>
        </ModuleCard>
        <ModuleCard title="Total de extras">
          <div className="text-2xl font-bold" style={{ color: '#1F2937' }}>
            {grupos.reduce((acc, g) => acc + g.extras.length, 0)}
          </div>
        </ModuleCard>
        <ModuleCard title="Valor total do período">
          <div className="text-2xl font-bold" style={{ color: '#1F2937' }}>{formatarMoeda(totalGeral)}</div>
        </ModuleCard>
      </div>

      <ModuleCard title={`Colaboradores com extras (${grupos.length})`}>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    onClick={() => setOrdemNome(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-1 font-medium hover:text-slate-700"
                  >
                    Colaborador
                    {ordemNome === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  </button>
                </TableHead>
                <TableHead>Qtd. extras</TableHead>
                <TableHead>Valor total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingExtras ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : grupos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8" style={{ color: '#94A3B8' }}>
                    Nenhum colaborador com extras no período
                  </TableCell>
                </TableRow>
              ) : (
                grupos.map(grupo => {
                  const todosPagos = grupo.extras.every(e => e.status === 'Pago')
                  const algumPago = grupo.extras.some(e => e.status === 'Pago')
                  const reciboJaEmitido = recibos.some(r => {
                    const mesmoColaborador = grupo.substituto_id ? r.colaborador_id === grupo.substituto_id : r.colaborador_nome === grupo.substituto_nome
                    return mesmoColaborador && r.data_inicio === dataInicio && r.data_fim === dataFim && r.status === 'assinado'
                  })
                  return (
                    <TableRow key={grupo.substituto_id || grupo.substituto_nome}>
                      <TableCell className="font-medium break-words">{grupo.substituto_nome}</TableCell>
                      <TableCell>{grupo.extras.length}</TableCell>
                      <TableCell>{formatarMoeda(grupo.valorTotal)}</TableCell>
                      <TableCell>
                        {todosPagos ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Pago</span>
                        ) : algumPago ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Parcial</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Pendente</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {podeMarcarPago && !todosPagos && (
                            <ModuleButton variant="outline" size="sm" onClick={() => marcarExtrasComoPago(grupo)} title="Marcar extras como pagos">
                              <DollarSign className="w-4 h-4" />
                            </ModuleButton>
                          )}
                          {reciboJaEmitido && !modoPapel ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                              Recibo já emitido
                            </span>
                          ) : (
                            podeGerenciarRecibo && (
                              <ModuleButton size="sm" onClick={() => handleGerarRecibo(grupo)}>
                                <FileText className="w-4 h-4 mr-2" />
                                {modoPapel ? 'Gerar para impressão' : 'Gerar e assinar'}
                              </ModuleButton>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </ModuleCard>

      {recibosAssinados.length > 0 && (
        <ModuleCard title={`Recibos assinados (${recibosAssinados.length})`}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Qtd.</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data assinatura</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recibosAssinados.map(recibo => (
                  <TableRow key={recibo.id}>
                    <TableCell className="font-medium break-words">{recibo.colaborador_nome}</TableCell>
                    <TableCell className="break-words">{formatarDataBR(recibo.data_inicio)} a {formatarDataBR(recibo.data_fim)}</TableCell>
                    <TableCell>{recibo.quantidade_extras}</TableCell>
                    <TableCell>{formatarMoeda(recibo.valor_total)}</TableCell>
                    <TableCell>{recibo.data_assinatura ? formatarDataBR(recibo.data_assinatura.split('T')[0]) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <ModuleButton variant="outline" size="sm" onClick={() => handleReemitirPDF(recibo)}>
                          <FileText className="w-4 h-4 mr-2" />
                          PDF
                        </ModuleButton>
                        {podeCancelarRecibo && (
                          <ModuleButton variant="outline" size="sm" onClick={() => handleRemoverRecibo(recibo.id)} title="Remover">
                            <Trash2 className="w-4 h-4" />
                          </ModuleButton>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ModuleCard>
      )}

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => setModalAberto(false)}
            className="absolute right-4 top-4 p-1 rounded-md hover:bg-slate-100 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
          <DialogHeader>
            <DialogTitle>Assinar recibo</DialogTitle>
            <DialogDescription>
              {grupoSelecionado && (
                <>
                  Recibo de <strong>{grupoSelecionado.substituto_nome}</strong> — período{' '}
                  {formatarDataBR(reciboParaAssinar?.data_inicio || null)} a {formatarDataBR(reciboParaAssinar?.data_fim || null)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {grupoSelecionado && reciboParaAssinar && (
            <div className="space-y-6">
              <ModuleCard title="Resumo" className="!p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs" style={{ color: '#94A3B8' }}>Quantidade de extras</div>
                    <div className="text-lg font-semibold">{grupoSelecionado.extras.length}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: '#94A3B8' }}>Valor total</div>
                    <div className="text-lg font-semibold">{formatarMoeda(grupoSelecionado.valorTotal)}</div>
                  </div>
                </div>
              </ModuleCard>

              <ModuleCard title="Extras do período" className="!p-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupoSelecionado.extras.map(extra => (
                        <TableRow key={extra.id}>
                          <TableCell>{formatarDataBR(extra.data_ocorrencia)}</TableCell>
                          <TableCell>{extra.departamento_nome || '—'}</TableCell>
                          <TableCell>{extra.motivo}</TableCell>
                          <TableCell>{formatarMoeda(Number(extra.valor) || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ModuleCard>

              <div className="space-y-2">
                <Label style={{ color: '#1F2937' }}>Assinatura do colaborador</Label>
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
                  <AssinaturaCanvas ref={assinaturaRef} width={600} height={160} className="w-full" />
                </div>
                <p className="text-xs" style={{ color: '#94A3B8' }}>Peça para o colaborador assinar no quadro acima com o dedo ou mouse.</p>
              </div>

              {podeMarcarPago && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marcarPago}
                    onChange={e => setMarcarPago(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  Marcar os extras como <strong>Pago</strong> após assinar
                </label>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <ModuleButton variant="outline" size="sm" onClick={() => assinaturaRef.current?.limpar()}>
              Limpar assinatura
            </ModuleButton>
            <ModuleButton size="sm" onClick={handleAssinar} disabled={emitindo}>
              {emitindo ? 'Assinando...' : 'Confirmar e gerar PDF'}
            </ModuleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!reciboParaRemover}
        onOpenChange={() => setReciboParaRemover(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Remover recibo?"
        description="O recibo será removido permanentemente. Esta ação não pode ser desfeita."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={confirmarRemoverRecibo}
        destructive
      />

      <ConfirmDialog
        open={!!grupoParaPagar}
        onOpenChange={() => setGrupoParaPagar(null)}
        icon={<DollarSign className="size-6 text-primary" />}
        iconClassName="bg-accent"
        title="Marcar como pago?"
        description={
          grupoParaPagar
            ? `Marcar ${grupoParaPagar.extras.filter(e => e.status !== 'Pago').length} extra(s) de ${grupoParaPagar.substituto_nome} como Pago?`
            : ''
        }
        confirmLabel="Sim, marcar"
        cancelLabel="Cancelar"
        onConfirm={confirmarMarcarComoPago}
      />
    </ExtrasShell>
  )
}
