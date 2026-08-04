import { useCallback, useEffect, useMemo, useState } from 'react'
import { Save, Ruler, Search, X } from 'lucide-react'
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
import { CeuShell } from './CeuShell'
import { PageHeader } from '@/components/corh/PageHeader'
import { FiltrosAtivosBadge } from '@/components/corh/FiltrosAtivosBadge'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { useColaboradores } from '@/hooks/useColaboradores'
import { useAuth } from '@/hooks/useAuth'
import { podeRegistrarEntregaCEU } from '@/lib/permissoes'
import { listarTamanhos, salvarTamanhos, type TamanhosInput } from '@/lib/ceu/tamanhos'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { abreviarFuncao } from '@/lib/escalas/funcao'
import { toast } from 'sonner'
import type { CeuTamanhos, Colaborador } from '@/types/database'

const FORM_VAZIO: TamanhosInput = {
  tamanho_camisa: '',
  tamanho_calca: '',
  tamanho_calcado: '',
  tamanho_luva: '',
}

export function CeuTamanhosPage() {
  const { user } = useAuth()
  const podeEditar = user ? podeRegistrarEntregaCEU(user.nivel_acesso) : false
  // Somente ativos: quem ficar inativo some da lista no próximo carregamento
  const { colaboradores, listarResumido: listarColaboradores } = useColaboradores()

  const [mapaTamanhos, setMapaTamanhos] = useState<Map<string, CeuTamanhos>>(new Map())
  const [editando, setEditando] = useState<Colaborador | null>(null)
  const [form, setForm] = useState<TamanhosInput>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useFiltroPersistente('ceu.tamanhos.busca', '')

  const carregarTamanhos = useCallback(async () => {
    try {
      setMapaTamanhos(await listarTamanhos())
    } catch (err) {
      console.error('Erro ao carregar tamanhos:', err)
      toast.error('Erro ao carregar os tamanhos cadastrados')
    }
  }, [])

  useEffect(() => {
    listarColaboradores({ status: 'Ativo' })
    carregarTamanhos()
  }, [listarColaboradores, carregarTamanhos])

  const abrirEdicao = (colab: Colaborador) => {
    const t = mapaTamanhos.get(colab.id)
    setEditando(colab)
    setForm({
      tamanho_camisa: t?.tamanho_camisa || '',
      tamanho_calca: t?.tamanho_calca || '',
      tamanho_calcado: t?.tamanho_calcado || '',
      tamanho_luva: t?.tamanho_luva || '',
    })
  }

  const handleSalvar = async () => {
    if (!editando || !user) return
    setSalvando(true)
    try {
      await salvarTamanhos(editando.id, form, user.id)
      toast.success(`Tamanhos de ${editando.nome_completo} salvos`)
      await carregarTamanhos()
      setEditando(null)
      setForm(FORM_VAZIO)
    } catch (err) {
      console.error('Erro ao salvar tamanhos:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar tamanhos')
    } finally {
      setSalvando(false)
    }
  }

  // Todos os ativos aparecem — com ou sem tamanho — para o usuário completar
  const linhasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const ordenados = [...(colaboradores || [])].sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
    if (!termo) return ordenados
    return ordenados.filter(
      (c) =>
        c.nome_completo.toLowerCase().includes(termo) ||
        c.matricula.toLowerCase().includes(termo) ||
        (c.cargo || '').toLowerCase().includes(termo) ||
        abreviarFuncao(c.cargo).toLowerCase().includes(termo)
    )
  }, [colaboradores, busca])

  const comTamanho = useMemo(
    () => (colaboradores || []).filter((c) => mapaTamanhos.has(c.id)).length,
    [colaboradores, mapaTamanhos]
  )

  return (
    <CeuShell>
      <PageHeader
        backTo="/ceu/movimentacoes"
        title="Tamanhos"
        description={`Medidas de uniforme e EPI — ${comTamanho} de ${(colaboradores || []).length} colaboradores ativos com tamanho cadastrado`}
      />

      {editando && (
        <ModuleCard title={`Tamanhos de ${editando.nome_completo}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label style={{ color: '#1F2937' }}>Camisa</Label>
                <Input
                  value={form.tamanho_camisa}
                  onChange={(e) => setForm((p) => ({ ...p, tamanho_camisa: e.target.value }))}
                  placeholder="Ex.: M, G, GG"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label style={{ color: '#1F2937' }}>Calça</Label>
                <Input
                  value={form.tamanho_calca}
                  onChange={(e) => setForm((p) => ({ ...p, tamanho_calca: e.target.value }))}
                  placeholder="Ex.: 40, 42"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label style={{ color: '#1F2937' }}>Calçado</Label>
                <Input
                  value={form.tamanho_calcado}
                  onChange={(e) => setForm((p) => ({ ...p, tamanho_calcado: e.target.value }))}
                  placeholder="Ex.: 40, 41"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label style={{ color: '#1F2937' }}>Luva</Label>
                <Input
                  value={form.tamanho_luva}
                  onChange={(e) => setForm((p) => ({ ...p, tamanho_luva: e.target.value }))}
                  placeholder="Ex.: P, M, G, XG"
                  className="rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {podeEditar && (
                <ModuleButton onClick={handleSalvar} disabled={salvando}>
                  <Save className="w-4 h-4 mr-2" />
                  {salvando ? 'Salvando...' : 'Salvar tamanhos'}
                </ModuleButton>
              )}
              <ModuleButton variant="outline" onClick={() => { setEditando(null); setForm(FORM_VAZIO) }}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </ModuleButton>
            </div>
          </div>
        </ModuleCard>
      )}

      <ModuleCard
        title={
          <>
            Colaboradores ativos ({linhasFiltradas.length})
            <FiltrosAtivosBadge total={busca.trim() !== '' ? 1 : 0} onLimpar={() => setBusca('')} />
          </>
        }
      >
        <div className="mb-4 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94A3B8' }} />
          <Input
            placeholder="Buscar por nome, matrícula ou função..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10 rounded-lg"
          />
        </div>

        {linhasFiltradas.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#94A3B8' }}>
            <Ruler className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nenhum colaborador encontrado para a busca.
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#F1F5F9' }}>
            <Table>
              <TableHeader style={{ backgroundColor: '#F8FAFC' }}>
                <TableRow>
                  <TableHead style={{ color: '#1F2937' }}>Colaborador</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Função</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Camisa</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Calça</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Calçado</TableHead>
                  <TableHead style={{ color: '#1F2937' }}>Luva</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasFiltradas.map((colab) => {
                  const t = mapaTamanhos.get(colab.id)
                  const semTamanho = !t
                  return (
                    <TableRow key={colab.id} className="hover:bg-slate-50">
                      <TableCell style={{ color: '#1F2937' }}>
                        <div className="font-medium">{colab.nome_completo}</div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>{colab.matricula}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap" style={{ color: '#64748B' }} title={colab.cargo || undefined}>
                        {abreviarFuncao(colab.cargo)}
                      </TableCell>
                      <TableCell style={{ color: semTamanho ? '#CBD5E1' : '#64748B' }}>{t?.tamanho_camisa || '—'}</TableCell>
                      <TableCell style={{ color: semTamanho ? '#CBD5E1' : '#64748B' }}>{t?.tamanho_calca || '—'}</TableCell>
                      <TableCell style={{ color: semTamanho ? '#CBD5E1' : '#64748B' }}>{t?.tamanho_calcado || '—'}</TableCell>
                      <TableCell style={{ color: semTamanho ? '#CBD5E1' : '#64748B' }}>{t?.tamanho_luva || '—'}</TableCell>
                      <TableCell>
                        {podeEditar && (
                          <ModuleButton variant="outline" size="sm" onClick={() => abrirEdicao(colab)}>
                            {semTamanho ? 'Preencher' : 'Editar'}
                          </ModuleButton>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ModuleCard>
    </CeuShell>
  )
}
