import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEscalasLocais } from '@/hooks/useEscalasLocais'
import type { LocalTrabalho } from '@/types/database'
import { Plus, Trash2, Building2 } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { ConfirmDialog } from '@/components/corh/ConfirmDialog'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { EscalasShell } from './EscalasShell'

export function EscalasLocaisPage() {
  const { locais, loading, listar, criar, atualizar, remover, importarDeDepartamentos } = useEscalasLocais()
  const [novoNome, setNovoNome] = useState('')
  const [novoNomeCurto, setNovoNomeCurto] = useState('')
  const [editando, setEditando] = useState<LocalTrabalho | null>(null)
  const [importando, setImportando] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null)

  useEffect(() => {
    listar()
  }, [listar])

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoNome.trim()) return
    await criar({
      nome: novoNome.trim(),
      nome_curto: novoNomeCurto.trim() || novoNome.trim(),
      status: 'Ativo',
      observacao: null,
    })
    setNovoNome('')
    setNovoNomeCurto('')
  }

  const handleImportar = async () => {
    setImportando(true)
    await importarDeDepartamentos()
    setImportando(false)
  }

  return (
    <EscalasShell>
      <PageHeader backTo="/" title="Locais de Trabalho" description="Cadastro de postos e locais vinculados aos colaboradores">
        <ModuleButton
          variant="outline"
          onClick={handleImportar}
          disabled={importando || loading}
        >
          <Building2 className="h-4 w-4 mr-2" />
          {importando ? 'Importando...' : 'Importar de Departamentos'}
        </ModuleButton>
      </PageHeader>

      <ModuleCard title="Novo Local de Trabalho">
          <form onSubmit={handleCriar} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Matizes"
              />
            </div>
            <div>
              <Label htmlFor="nome_curto">Nome curto</Label>
              <Input
                id="nome_curto"
                value={novoNomeCurto}
                onChange={(e) => setNovoNomeCurto(e.target.value)}
                placeholder="Ex: Matizes"
              />
            </div>
            <ModuleButton type="submit" disabled={!novoNome.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </ModuleButton>
          </form>
      </ModuleCard>

      <ModuleCard title="Locais cadastrados">
          {loading ? (
            <p className="text-slate-500">Carregando...</p>
          ) : locais.length === 0 ? (
            <p className="text-slate-500">Nenhum local de trabalho cadastrado.</p>
          ) : (
            <div className="divide-y">
              {locais.map((local) => (
                <div key={local.id} className="py-3 flex items-center justify-between gap-4">
                  {editando?.id === local.id ? (
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        value={editando.nome}
                        onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                      />
                      <Input
                        value={editando.nome_curto || ''}
                        onChange={(e) => setEditando({ ...editando, nome_curto: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{local.nome}</p>
                      <p className="text-sm text-slate-500">{local.nome_curto}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {editando?.id === local.id ? (
                      <>
                        <ModuleButton
                          size="sm"
                          onClick={() => {
                            atualizar(local.id, {
                              nome: editando.nome,
                              nome_curto: editando.nome_curto,
                            })
                            setEditando(null)
                          }}
                        >
                          Salvar
                        </ModuleButton>
                        <ModuleButton size="sm" variant="outline" onClick={() => setEditando(null)}>
                          Cancelar
                        </ModuleButton>
                      </>
                    ) : (
                      <>
                        <ModuleButton size="sm" variant="outline" onClick={() => setEditando(local)}>
                          Editar
                        </ModuleButton>
                        <ModuleButton size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmarExclusao(local.id)}>
                          <Trash2 className="h-4 w-4" />
                        </ModuleButton>
                      </>
                    )}
                  </div>
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
        title="Excluir local de trabalho?"
        description="O local será removido permanentemente. Esta ação não pode ser desfeita."
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
