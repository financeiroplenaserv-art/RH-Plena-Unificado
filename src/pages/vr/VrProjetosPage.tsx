import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Edit, FileText, Search, Calendar, Upload, Download, History } from 'lucide-react'
import { useProjetosVR } from '@/hooks/useProjetosVR'
import { Input } from '@/components/ui/input'
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
import { formatarData } from '@/lib/utils'
import { LoadingScreen } from '@/components/LoadingScreen'
import { VrPage } from '@/components/vr/VrPage'
import { VrHeader } from '@/components/vr/VrHeader'
import { VrCard } from '@/components/vr/VrCard'
import { VrButton } from '@/components/vr/VrButton'
import { toast } from 'sonner'
import type { ProjetoVR } from '@/types'

function downloadFile(content: string | Blob, filename: string, type: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function VrProjetosPage() {
  const navigate = useNavigate()
  const { projetos, loading, listar, excluir, criar } = useProjetosVR()
  const [busca, setBusca] = useState('')
  const [filtroDataCorte, setFiltroDataCorte] = useState('')
  const [excluirId, setExcluirId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listar()
  }, [listar])

  const handleExcluir = async (id: string) => {
    await excluir(id)
    setExcluirId(null)
    listar()
  }

  const projetosFiltrados = projetos.filter((projeto) => {
    const matchBusca = !busca || projeto.nome.toLowerCase().includes(busca.toLowerCase())
    const matchData = !filtroDataCorte || projeto.data_corte === filtroDataCorte
    return matchBusca && matchData
  })

  const exportarBackupJSON = () => {
    const dados = {
      gerado_em: new Date().toISOString(),
      modulo: 'VR',
      projetos: projetos.map((p) => ({
        ...p,
        configuracao_json: p.configuracao_json || {},
      })),
    }
    downloadFile(JSON.stringify(dados, null, 2), `backup_vr_projetos_${new Date().toISOString().split('T')[0]}.json`, 'application/json')
    toast.success('Backup de projetos exportado')
  }

  const importarBackupJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const texto = await file.text()
      const dados = JSON.parse(texto)
      if (!dados.projetos || !Array.isArray(dados.projetos)) {
        toast.error('Arquivo de backup inválido')
        return
      }
      let sucesso = 0
      for (const p of dados.projetos as ProjetoVR[]) {
        const rest = Object.fromEntries(
          Object.entries(p).filter(([key]) => key !== 'id' && key !== 'created_at')
        ) as Omit<ProjetoVR, 'id' | 'created_at'>
        const result = await criar({
          ...rest,
          nome: `${rest.nome} (restaurado)`,
        })
        if (result) sucesso++
      }
      toast.success(`${sucesso} projeto(s) restaurado(s)`)
      listar()
    } catch {
      toast.error('Erro ao importar backup')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <VrPage>
      <VrHeader
        title="Vale Refeição"
        subtitle="Cálculo e emissão de arquivos VR PAT e Alterdata"
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <VrButton onClick={() => navigate('/vr/projetos/novo')} size="lg">
          <Plus className="w-5 h-5 mr-2" />
          Novo projeto
        </VrButton>
        <div className="flex flex-wrap gap-2">
          <VrButton variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Importar backup JSON
          </VrButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={importarBackupJSON}
          />
          <VrButton variant="outline" size="sm" onClick={exportarBackupJSON}>
            <Download className="w-4 h-4 mr-2" />
            Exportar backup JSON
          </VrButton>
        </div>
      </div>

      <VrCard title="Filtros" icon={<Search className="w-4 h-4" />} color="blue">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome do projeto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <Input
              type="date"
              value={filtroDataCorte}
              onChange={(e) => setFiltroDataCorte(e.target.value)}
              className="w-auto"
            />
          </div>
        </div>
      </VrCard>

      <VrCard title={`Projetos (${projetosFiltrados.length})`} icon={<History className="w-4 h-4" />} color="blue">
        {loading ? (
          <LoadingScreen className="h-64" />
        ) : projetosFiltrados.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            Nenhum projeto encontrado. Clique em "Novo projeto" para começar.
          </div>
        ) : (
          <div className="border-2 border-slate-200 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableHead>Projeto</TableHead>
                  <TableHead>Data de corte</TableHead>
                  <TableHead>Efetivação</TableHead>
                  <TableHead>VR</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projetosFiltrados.map((projeto) => {
                  const config = projeto.configuracao_json as Record<string, unknown> | undefined
                  return (
                    <TableRow
                      key={projeto.id}
                      className="cursor-pointer hover:bg-blue-50"
                      onClick={() => navigate(`/vr/projetos/${projeto.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-slate-900">{projeto.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatarData(projeto.data_corte)}</TableCell>
                      <TableCell>{formatarData(projeto.data_efetivacao)}</TableCell>
                      <TableCell>
                        {config?.valorVR ? `R$ ${Number(config.valorVR).toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <VrButton
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/vr/projetos/${projeto.id}/editar`)
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </VrButton>
                          <VrButton
                            variant="danger"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExcluirId(projeto.id)
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </VrButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </VrCard>

      <Dialog open={!!excluirId} onOpenChange={(open) => !open && setExcluirId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Excluir projeto VR?</DialogTitle>
            <DialogDescription className="text-xs">
              Esta ação não pode ser desfeita. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <VrButton variant="outline" size="sm" onClick={() => setExcluirId(null)}>
              Cancelar
            </VrButton>
            <VrButton variant="danger" size="sm" onClick={() => excluirId && handleExcluir(excluirId)}>
              Excluir
            </VrButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VrPage>
  )
}
