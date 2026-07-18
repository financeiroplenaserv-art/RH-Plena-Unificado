import { useEffect, useState } from 'react'
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
import type { MapeamentoFlitLocalTrabalho } from '@/types/database'
import { Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { EscalasShell } from './EscalasShell'

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
                      {l.nome}
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
                  <ModuleButton size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => remover(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </ModuleButton>
                </div>
              ))}
            </div>
          )}
      </ModuleCard>
    </EscalasShell>
  )
}
