import { useEffect, useMemo, useState } from 'react'
import { ModuleCard } from '@/components/layout/ModuleShell'
import { useCEUEntregas } from '@/hooks/useCEUEntregas'
import { useCEUItens } from '@/hooks/useCEUItens'
import { hojeBrasil } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { nomeCurtoDepartamentoFuzzy, type DepartamentoFuzzy } from '@/lib/departamentos'
import { CeuShell } from './CeuShell'
import { PageHeader } from '@/components/corh/PageHeader'
import { CeuReciboModal, type DadosEntrega } from '@/components/ceu/CeuReciboModal'
import { prepararGruposRecibo, gerarRecibosLoteHTML } from '@/lib/ceu/emissaoRecibos'
import { toast } from 'sonner'
import type { Colaborador } from '@/types/database'
import { downloadFile } from './relatorios/relatorios.utils'
import { ABAS, type AbaId } from './relatorios/abas'
import { AbasRelatorio } from './relatorios/AbasRelatorio'
import { FiltrosRelatorioCard } from './relatorios/FiltrosRelatorioCard'
import { useFiltrosRelatorio } from './relatorios/useFiltrosRelatorio'
import { exportarExcel, exportarTSV } from './relatorios/exportacao'
import { AbaColaborador } from './relatorios/AbaColaborador'
import { AbaData } from './relatorios/AbaData'
import { AbaItens } from './relatorios/AbaItens'
import { AbaVencimento } from './relatorios/AbaVencimento'
import { AbaEstoque } from './relatorios/AbaEstoque'

export function CeuRelatoriosPage() {
  const { itens, loading: loadingItens, listar: listarItens } = useCEUItens()
  const { entregas, loading: loadingEntregas, listar: listarEntregas, proximoNumeroRecibo, registrarEmissaoRecibo } = useCEUEntregas()

  const [modalRecibo, setModalRecibo] = useState(false)
  const [dadosRecibo, setDadosRecibo] = useState<DadosEntrega | DadosEntrega[] | null>(null)
  const [gerandoRecibo, setGerandoRecibo] = useState(false)
  const [departamentos, setDepartamentos] = useState<DepartamentoFuzzy[]>([])

  const [abaAtiva, setAbaAtiva] = useState<AbaId>('colaborador')

  useEffect(() => {
    listarItens()
    listarEntregas()
    supabase
      .from('departamentos')
      .select('id, nome, nome_curto, empresa_id')
      .then(({ data }) => setDepartamentos((data || []) as DepartamentoFuzzy[]))
  }, [listarItens, listarEntregas])

  const dadosItens = itens
  const dadosEntregas = entregas

  const filtros = useFiltrosRelatorio(dadosEntregas)
  const { entregasFiltradas } = filtros

  const colaboradoresUnicos = useMemo(() => {
    const map = new Map<string, Colaborador>()
    dadosEntregas.forEach((e) => {
      if (e.colaborador && !map.has(e.colaborador_id)) {
        map.set(e.colaborador_id, e.colaborador)
      }
    })
    return Array.from(map.values()).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
  }, [dadosEntregas])

  // O select de Item do filtro mostra apenas itens com movimentação — item de
  // cadastro sem nenhuma entrega só levaria a "Nenhum resultado encontrado".
  const itensComMovimentacao = useMemo(() => {
    const ids = new Set(dadosEntregas.map((e) => e.item_id))
    return dadosItens.filter((i) => ids.has(i.id))
  }, [dadosItens, dadosEntregas])

  const handleExportarExcel = () => exportarExcel(abaAtiva, entregasFiltradas, dadosItens)
  const handleExportarTSV = () => exportarTSV(abaAtiva, entregasFiltradas, dadosItens)

  const handleGerarRecibo = async (colaboradorId: string) => {
    const entregasDoColab = entregasFiltradas.filter((e) => e.colaborador_id === colaboradorId)
    if (entregasDoColab.length === 0) return
    setGerandoRecibo(true)
    try {
      const grupos = await prepararGruposRecibo(entregasDoColab, { proximoNumeroRecibo, registrarEmissaoRecibo })
      setDadosRecibo(grupos.length === 1 ? grupos[0] : grupos)
      setModalRecibo(true)
    } finally {
      setGerandoRecibo(false)
    }
  }

  const handleRelatorioLote = async () => {
    if (entregasFiltradas.length === 0) {
      toast.error('Nenhuma entrega nos filtros aplicados')
      return
    }
    setGerandoRecibo(true)
    try {
      const { html, total } = await gerarRecibosLoteHTML(entregasFiltradas, { proximoNumeroRecibo, registrarEmissaoRecibo })
      if (total === 0) {
        toast.error('Nenhum recibo pôde ser gerado')
        return
      }
      downloadFile(html, `recibos_lote_${hojeBrasil()}.html`, 'text/html;charset=utf-8')
      toast.success(`${total} recibo(s) gerado(s)`)
    } finally {
      setGerandoRecibo(false)
    }
  }

  const renderConteudoAba = () => {
    if (abaAtiva === 'colaborador') {
      return (
        <AbaColaborador
          colaboradoresUnicos={colaboradoresUnicos}
          entregasFiltradas={entregasFiltradas}
          nomeDepartamento={(c) => nomeCurtoDepartamentoFuzzy(departamentos, c.departamento_id, c.departamento, c.empresa_id)}
          exportarExcel={handleExportarExcel}
          onGerarRecibo={handleGerarRecibo}
          onRelatorioLote={handleRelatorioLote}
          processando={gerandoRecibo}
        />
      )
    }

    if (abaAtiva === 'data') {
      return <AbaData entregasFiltradas={entregasFiltradas} />
    }

    if (abaAtiva === 'itens') {
      return <AbaItens dadosItens={dadosItens} entregasFiltradas={entregasFiltradas} />
    }

    if (abaAtiva === 'vencimento') {
      return <AbaVencimento dadosItens={dadosItens} dadosEntregas={dadosEntregas} />
    }

    if (abaAtiva === 'estoque') {
      return <AbaEstoque dadosItens={dadosItens} />
    }

    return null
  }

  return (
    <CeuShell>
      <div className="space-y-6">
        <PageHeader backTo="/ceu/movimentacoes" title="Relatórios CEU" description="Análise de entregas, itens e alertas" />

        <FiltrosRelatorioCard
          filtros={filtros}
          colaboradoresUnicos={colaboradoresUnicos}
          dadosItens={dadosItens}
          itensComMovimentacao={itensComMovimentacao}
          dadosEntregas={dadosEntregas}
          onExportarExcel={handleExportarExcel}
          onExportarTSV={handleExportarTSV}
        />

        <AbasRelatorio abaAtiva={abaAtiva} onAbaChange={setAbaAtiva} />

        <ModuleCard title={ABAS.find((a) => a.id === abaAtiva)?.label || ''}>
          {(loadingItens || loadingEntregas) ? (
            <div className="text-center py-12 text-slate-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3B82F6] mx-auto mb-2" />
              Carregando dados...
            </div>
          ) : (
            renderConteudoAba()
          )}
        </ModuleCard>

        <CeuReciboModal isOpen={modalRecibo} onClose={() => setModalRecibo(false)} dadosEntrega={dadosRecibo} />
      </div>
    </CeuShell>
  )
}
