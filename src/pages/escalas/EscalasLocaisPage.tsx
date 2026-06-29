import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useEscalasLocais } from '@/hooks/useEscalasLocais'
import type { LocalTrabalho } from '@/types/database'
import { Plus, Trash2, Building2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'

export function EscalasLocaisPage() {
  const { locais, loading, listar, criar, atualizar, remover, importarDeDepartamentos } = useEscalasLocais()
  const [novoNome, setNovoNome] = useState('')
  const [novoNomeCurto, setNovoNomeCurto] = useState('')
  const [editando, setEditando] = useState<LocalTrabalho | null>(null)
  const [importando, setImportando] = useState(false)

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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Locais de Trabalho" description="Cadastro de postos e locais vinculados aos colaboradores">
        <Button
          variant="outline"
          onClick={handleImportar}
          disabled={importando || loading}
          className="flex items-center gap-2"
        >
          <Building2 className="h-4 w-4" />
          {importando ? 'Importando...' : 'Importar de Departamentos'}
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo Local de Trabalho</CardTitle>
        </CardHeader>
        <CardContent>
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
            <Button type="submit" disabled={!novoNome.trim()} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Locais cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
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
                        <Button
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
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditando(null)}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditando(local)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => remover(local.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
