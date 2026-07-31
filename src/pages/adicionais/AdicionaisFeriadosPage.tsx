import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Palmtree } from 'lucide-react'
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
import { AdicionaisShell } from './AdicionaisShell'
import { PageHeader } from '@/components/corh/PageHeader'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { useAuth } from '@/hooks/useAuth'
import { listarFeriados, criarFeriado, removerFeriado, type Feriado } from '@/lib/adicionais/feriados'
import { toast } from 'sonner'

function formatarDataBR(dataStr: string) {
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}

export function AdicionaisFeriadosPage() {
  const { user } = useAuth()
  const isAdmin = user?.nivel_acesso === 'admin' || user?.nivel_acesso === 'adm'

  const [feriados, setFeriados] = useState<Feriado[]>([])
  const [data, setData] = useState('')
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState<Feriado | null>(null)

  const carregar = useCallback(async () => {
    try {
      setFeriados(await listarFeriados())
    } catch (err) {
      console.error('Erro ao carregar feriados:', err)
      toast.error('Erro ao carregar os feriados')
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const handleAdicionar = async () => {
    if (!data || !nome.trim()) return
    setSalvando(true)
    try {
      await criarFeriado(data, nome.trim())
      toast.success(`Feriado ${formatarDataBR(data)} cadastrado`)
      setData('')
      setNome('')
      await carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar feriado')
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async () => {
    if (!confirmarExclusao) return
    try {
      await removerFeriado(confirmarExclusao.id)
      toast.success('Feriado removido')
      await carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover feriado')
    } finally {
      setConfirmarExclusao(null)
    }
  }

  return (
    <AdicionaisShell>
      <PageHeader
        backTo="/adicionais/contratos"
        title="Feriados"
        description="Datas que geram o adicional de feriado — conta para vínculos com o adicional no contrato e escala prevista no dia"
      />

      <ModuleCard title="Novo feriado">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <Label style={{ color: '#1F2937' }}>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label style={{ color: '#1F2937' }}>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Aniversário de Niterói, Feriado do contrato Enseada..."
              className="rounded-lg"
            />
          </div>
        </div>
        <ModuleButton onClick={handleAdicionar} disabled={!data || !nome.trim() || salvando}>
          <Plus className="w-4 h-4 mr-2" />
          {salvando ? 'Salvando...' : 'Adicionar feriado'}
        </ModuleButton>
      </ModuleCard>

      <ModuleCard title={`Feriados cadastrados (${feriados.length})`}>
        {feriados.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#94A3B8' }}>
            <Palmtree className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nenhum feriado cadastrado.
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#F1F5F9' }}>
            <Table>
              <TableHeader style={{ backgroundColor: '#F8FAFC' }}>
                <TableRow>
                  <TableHead style={{ color: '#1F2937' }}>Data</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Nome</TableHead>
                  {isAdmin && <TableHead className="w-16"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {feriados.map((f) => (
                  <TableRow key={f.id} className="hover:bg-slate-50">
                    <TableCell className="whitespace-nowrap tabular-nums" style={{ color: '#1F2937' }}>
                      {formatarDataBR(f.data)}
                    </TableCell>
                    <TableCell style={{ color: '#64748B' }}>{f.nome}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <button
                          className="p-1.5 rounded-md hover:bg-red-50 text-red-600"
                          onClick={() => setConfirmarExclusao(f)}
                          title="Excluir feriado"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ModuleCard>

      <ConfirmDialog
        open={!!confirmarExclusao}
        onOpenChange={() => setConfirmarExclusao(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Excluir feriado?"
        description={
          confirmarExclusao
            ? `${formatarDataBR(confirmarExclusao.data)} — ${confirmarExclusao.nome} será removido. O relatório de adicionais deixará de contar essa data.`
            : ''
        }
        confirmLabel="Sim, excluir"
        onConfirm={handleExcluir}
        destructive
      />
    </AdicionaisShell>
  )
}
