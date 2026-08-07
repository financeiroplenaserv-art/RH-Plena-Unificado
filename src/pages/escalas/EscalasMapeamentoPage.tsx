import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEscalasMapeamento } from '@/hooks/useEscalasMapeamento'
import { useEscalasLocais } from '@/hooks/useEscalasLocais'
import { nomeCurtoLocal, removerAcentos } from '@/lib/utils'
import type { MapeamentoFlitLocalTrabalho } from '@/types/database'
import { Plus, Pencil, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { EscalasShell } from './EscalasShell'

const TIPOS_MATCH: { value: MapeamentoFlitLocalTrabalho['tipo_match']; label: string }[] = [
  { value: 'dispositivo', label: 'Dispositivo (Flit Multi)' },
  { value: 'perimetro', label: 'Perímetro' },
  { value: 'turno_departamento', label: 'Turno contém Departamento' },
]

export function EscalasMapeamentoPage() {
  const { mapeamentos, loading, listar, criar, atualizar, remover } = useEscalasMapeamento()
  const { locais, listar: listarLocais } = useEscalasLocais()

  const [localId, setLocalId] = useState('')
  const [tipo, setTipo] = useState<MapeamentoFlitLocalTrabalho['tipo_match']>('dispositivo')
  const [valor, setValor] = useState('')
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroLocalId, setFiltroLocalId] = useState('')
  const [editando, setEditando] = useState<MapeamentoFlitLocalTrabalho | null>(null)

  useEffect(() => {
    listar()
    listarLocais()
  }, [listar, listarLocais])

  const mapeamentosFiltrados = useMemo(() => {
    const termo = removerAcentos(busca.trim().toLowerCase())
    return mapeamentos.filter((m) => {
      if (filtroLocalId && m.local_trabalho_id !== filtroLocalId) return false
      if (!termo) return true
      const nomeLocal = removerAcentos((nomeCurtoLocal(m.local_trabalho) || '').toLowerCase())
      const valorFlit = removerAcentos(m.valor_flit.toLowerCase())
      return nomeLocal.includes(termo) || valorFlit.includes(termo)
    })
  }, [mapeamentos, busca, filtroLocalId])

  const filtrosAtivos = busca.trim() !== '' || filtroLocalId !== ''

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!localId || !valor.trim()) return
    await criar({
      local_trabalho_id: localId,
      tipo_match: tipo,
      valor_flit: valor.trim(),
      prioridade: 100,
      ativo: true,
    })
    setValor('')
  }

  const handleSalvarEdicao = async () => {
    if (!editando || !editando.local_trabalho_id || !editando.valor_flit.trim()) return
    const sucesso = await atualizar(editando.id, {
      local_trabalho_id: editando.local_trabalho_id,
      tipo_match: editando.tipo_match,
      valor_flit: editando.valor_flit.trim(),
    })
    if (sucesso) setEditando(null)
  }

  return (
    <EscalasShell>
      <PageHeader backTo="/" title="Mapeamento Flit ↔ Local" description="Relacione dispositivos, perímetros e departamentos aos locais de trabalho" />

      <ModuleCard title="Novo mapeamento">
          <form onSubmit={handleCriar} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label>Local de Trabalho</Label>
              <Select value={localId} onValueChange={setLocalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {locais.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {nomeCurtoLocal(l)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as MapeamentoFlitLocalTrabalho['tipo_match'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_MATCH.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="valor">Valor no Flit</Label>
              <Input
                id="valor"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ex: MATIZES"
              />
            </div>
            <ModuleButton type="submit" disabled={!localId || !valor.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </ModuleButton>
          </form>
      </ModuleCard>

      <ModuleCard title="Mapeamentos cadastrados">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por local ou valor no Flit..."
              />
            </div>
            <Select value={filtroLocalId || 'todos'} onValueChange={(v) => setFiltroLocalId(v === 'todos' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os locais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os locais</SelectItem>
                {locais.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {nomeCurtoLocal(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtrosAtivos && !loading && (
            <p className="text-xs text-slate-500 mb-2">
              Exibindo {mapeamentosFiltrados.length} de {mapeamentos.length} mapeamento(s)
            </p>
          )}

          {loading ? (
            <p className="text-slate-500">Carregando...</p>
          ) : mapeamentos.length === 0 ? (
            <p className="text-slate-500">Nenhum mapeamento cadastrado.</p>
          ) : mapeamentosFiltrados.length === 0 ? (
            <p className="text-slate-500">Nenhum mapeamento encontrado para os filtros.</p>
          ) : (
            <div className="divide-y">
              {mapeamentosFiltrados.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                  {editando?.id === m.id ? (
                    <>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Select
                          value={editando.local_trabalho_id}
                          onValueChange={(v) => setEditando({ ...editando, local_trabalho_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Local" />
                          </SelectTrigger>
                          <SelectContent>
                            {locais.map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                {nomeCurtoLocal(l)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={editando.tipo_match}
                          onValueChange={(v) => setEditando({ ...editando, tipo_match: v as MapeamentoFlitLocalTrabalho['tipo_match'] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS_MATCH.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={editando.valor_flit}
                          onChange={(e) => setEditando({ ...editando, valor_flit: e.target.value })}
                          placeholder="Valor no Flit"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <ModuleButton
                          size="sm"
                          onClick={handleSalvarEdicao}
                          disabled={!editando.local_trabalho_id || !editando.valor_flit.trim()}
                        >
                          Salvar
                        </ModuleButton>
                        <ModuleButton size="sm" variant="outline" onClick={() => setEditando(null)}>
                          Cancelar
                        </ModuleButton>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">
                          {nomeCurtoLocal(m.local_trabalho) || 'Local não carregado'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {TIPOS_MATCH.find((t) => t.value === m.tipo_match)?.label} → "{m.valor_flit}"
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <ModuleButton size="sm" variant="ghost" className="text-slate-600 hover:bg-slate-100" onClick={() => setEditando(m)}>
                          <Pencil className="h-4 w-4" />
                        </ModuleButton>
                        <ModuleButton size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmarExclusao(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </ModuleButton>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
      </ModuleCard>

      <ConfirmDialog
        open={!!confirmarExclusao}
        onOpenChange={() => setConfirmarExclusao(null)}
        icon={<Trash2 className="size-6 text-red-600" />}
        iconClassName="bg-red-50"
        title="Excluir mapeamento?"
        description="O mapeamento será removido permanentemente. Esta ação não pode ser desfeita."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (confirmarExclusao) await remover(confirmarExclusao)
          setConfirmarExclusao(null)
        }}
        destructive
      />
    </EscalasShell>
  )
}
