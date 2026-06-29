import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useEscalasMapeamento } from '@/hooks/useEscalasMapeamento'
import { useEscalasLocais } from '@/hooks/useEscalasLocais'
import type { MapeamentoFlitLocalTrabalho } from '@/types/database'
import { Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'

const TIPOS_MATCH: { value: MapeamentoFlitLocalTrabalho['tipo_match']; label: string }[] = [
  { value: 'dispositivo', label: 'Dispositivo (Flit Multi)' },
  { value: 'perimetro', label: 'Perímetro' },
  { value: 'turno_departamento', label: 'Turno contém Departamento' },
]

export function EscalasMapeamentoPage() {
  const { mapeamentos, loading, listar, criar, remover } = useEscalasMapeamento()
  const { locais, listar: listarLocais } = useEscalasLocais()

  const [localId, setLocalId] = useState('')
  const [tipo, setTipo] = useState<MapeamentoFlitLocalTrabalho['tipo_match']>('dispositivo')
  const [valor, setValor] = useState('')

  useEffect(() => {
    listar()
    listarLocais()
  }, [listar, listarLocais])

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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader backTo="/escalas" title="Mapeamento Flit ↔ Local" description="Relacione dispositivos, perímetros e departamentos aos locais de trabalho" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo mapeamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCriar} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label>Local de Trabalho</Label>
              <select
                value={localId}
                onChange={(e) => setLocalId(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Selecione</option>
                {locais.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as MapeamentoFlitLocalTrabalho['tipo_match'])}
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                {TIPOS_MATCH.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
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
            <Button type="submit" disabled={!localId || !valor.trim()} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapeamentos cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500">Carregando...</p>
          ) : mapeamentos.length === 0 ? (
            <p className="text-slate-500">Nenhum mapeamento cadastrado.</p>
          ) : (
            <div className="divide-y">
              {mapeamentos.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">
                      {m.local_trabalho?.nome || 'Local não carregado'}
                    </p>
                    <p className="text-sm text-slate-500">
                      {TIPOS_MATCH.find((t) => t.value === m.tipo_match)?.label} → "{m.valor_flit}"
                    </p>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => remover(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
