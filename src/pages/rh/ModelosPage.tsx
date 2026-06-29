import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { PageHeader } from '@/components/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { podeGerenciarModelosOcorrencia } from '@/lib/permissoes'
import type { ModeloOcorrencia } from '@/types/database'

const MODELOS_PADRAO = [
  { nome: 'Atraso - 1ª Ocorrência', tipo: 'Advertência Verbal' },
  { nome: 'Atraso - Reincidência', tipo: 'Advertência Escrita' },
  { nome: 'Conduta Inadequada', tipo: 'Advertência Verbal' },
  { nome: 'Advertência Escrita', tipo: 'Advertência Escrita' },
  { nome: 'Falta - Reincidência', tipo: 'Suspensão' },
  { nome: 'Suspensão - 1 Dia', tipo: 'Suspensão' },
  { nome: 'Suspensão - 2 Dias', tipo: 'Suspensão' },
  { nome: 'Suspensão - 3 Dias', tipo: 'Suspensão' },
  { nome: 'Primeira Suspensão', tipo: 'Suspensão' },
  { nome: 'Segunda Suspensão', tipo: 'Suspensão' },
  { nome: 'Terceira Suspensão', tipo: 'Suspensão' },
  { nome: 'Falta Não Justificada', tipo: 'Falta' },
  { nome: 'Falta - Justificada (Atestado)', tipo: 'Falta' },
  { nome: 'Falta - Abonada', tipo: 'Falta' },
  { nome: 'Falta - Luto', tipo: 'Falta' },
  { nome: 'Falta - Doação de Sangue', tipo: 'Falta' },
  { nome: 'Falta - Vestibular', tipo: 'Falta' },
  { nome: 'Falta - Casamento', tipo: 'Falta' },
  { nome: 'Falta - Internação Filho(a)', tipo: 'Falta' },
  { nome: 'Falta - Convocação Eleitoral', tipo: 'Falta' },
  { nome: 'Falta - Convocação Audiência', tipo: 'Falta' },
  { nome: 'Afastamento - Luto', tipo: 'Afastamento' },
  { nome: 'Afastamento - Licença Maternidade', tipo: 'Afastamento' },
  { nome: 'Afastamento - Licença Paternidade', tipo: 'Afastamento' },
  { nome: 'Afastamento - Acidente de Trabalho', tipo: 'Afastamento' },
  { nome: 'Afastamento - Doença', tipo: 'Afastamento' },
  { nome: 'Afastamento Solic. Sindicato', tipo: 'Afastamento' },
  { nome: 'INSS', tipo: 'Afastamento' },
  { nome: 'Férias', tipo: 'Férias' },
  { nome: 'Férias Vendidas', tipo: 'Férias' },
  { nome: 'Mudança de Função', tipo: 'Mudança de Contrato' },
  { nome: 'Substituição Temporária', tipo: 'Substituição' },
  { nome: 'Substituição Definitiva', tipo: 'Substituição' },
  { nome: 'Troca Temporária', tipo: 'Troca' },
  { nome: 'Troca Definitiva', tipo: 'Troca' },
  { nome: 'Transferência de Setor', tipo: 'Transferência' },
  { nome: 'Promoção', tipo: 'Promoção' },
  { nome: 'Desligamento - Pedido', tipo: 'Desligado' },
  { nome: 'Desligamento - Justa Causa', tipo: 'Desligado' },
  { nome: 'Falecimento do Colaborador', tipo: 'Desligado' },
  { nome: 'PDL', tipo: 'Outros' },
  { nome: 'Extras OP Limpeza', tipo: 'Outros' },
  { nome: 'Rejeição', tipo: 'Outros' },
  { nome: 'Acerto de Escala', tipo: 'Outros' },
  { nome: 'Cobertura Temporária', tipo: 'Outros' },
  { nome: 'Liberação de Escala', tipo: 'Outros' },
  { nome: 'Retira Vínculo do Funcionário', tipo: 'Outros' },
  { nome: 'Readmissão do Funcionário', tipo: 'Outros' },
  { nome: 'Muda Falta Não Just. p/ Just.', tipo: 'Outros' },
  { nome: 'Emissão de Crachá', tipo: 'Outros' },
]

export function ModelosPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeGerenciar = perfil ? podeGerenciarModelosOcorrencia(perfil) : false

  const [modelos, setModelos] = useState<ModeloOcorrencia[]>([])
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('')
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [removerId, setRemoverId] = useState<string | null>(null)

  const loadModelos = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('modelos_ocorrencia').select('*').order('tipo')
    setModelos((data as ModeloOcorrencia[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // Carrega modelos

    loadModelos()
  }, [loadModelos])

  const cadastrarPadroes = async () => {
    const existentes = modelos.map((m) => m.nome)
    const novos = MODELOS_PADRAO.filter((m) => !existentes.includes(m.nome))
    if (novos.length === 0) {
      toast.info('Todos os modelos já estão cadastrados')
      return
    }
    const { error } = await supabase
      .from('modelos_ocorrencia')
      .insert(
        novos.map((m) => ({
          nome: m.nome,
          tipo: m.tipo,
          texto_padrao: `Ocorrência registrada em {data}.`,
        }))
      )
    if (error) toast.error('Erro: ' + error.message)
    else {
      toast.success(`${novos.length} modelos cadastrados`)
      loadModelos()
    }
  }

  const adicionar = async () => {
    if (!nome || !tipo) {
      toast.error('Preencha nome e tipo')
      return
    }
    const { error } = await supabase.from('modelos_ocorrencia').insert({
      nome,
      tipo,
      texto_padrao: texto || 'Ocorrência registrada em {data}.',
    })
    if (error) toast.error('Erro: ' + error.message)
    else {
      toast.success('Modelo adicionado')
      setNome('')
      setTipo('')
      setTexto('')
      loadModelos()
    }
  }

  const deletar = async (id: string) => {
    await supabase.from('modelos_ocorrencia').delete().eq('id', id)
    setRemoverId(null)
    loadModelos()
  }

  const porTipo: Record<string, ModeloOcorrencia[]> = {}
  modelos.forEach((m) => {
    if (!porTipo[m.tipo]) porTipo[m.tipo] = []
    porTipo[m.tipo].push(m)
  })

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader title="Modelos de Ocorrência" description={`${modelos.length} modelos cadastrados`}>
        {podeGerenciar && (
          <Button
            onClick={cadastrarPadroes}
            size="sm"
            className="text-xs bg-slate-900 hover:bg-slate-800"
          >
            Cadastrar 46 Padrões
          </Button>
        )}
      </PageHeader>

      {podeGerenciar && (
      <Card className="border-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Adicionar Novo Modelo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Falta - Abonada"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Input
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                placeholder="Ex: Falta, Suspensão..."
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Texto Padrão (opcional)</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder="Texto que aparece ao selecionar este modelo..."
            />
          </div>
          <Button onClick={adicionar} size="sm" className="text-xs h-8">
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </CardContent>
      </Card>
      )}

      {loading ? (
        <LoadingScreen mensagem="Carregando modelos..." className="py-8" />
      ) : (
        Object.entries(porTipo).map(([tipo, lista]) => (
          <Card key={tipo} className="border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {tipo} ({lista.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-50">
                {lista.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between py-2 px-1 group"
                  >
                    <span className="text-sm text-slate-700">{m.nome}</span>
                    {podeGerenciar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoverId(m.id)}
                        className="text-slate-300 hover:text-red-500 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!removerId} onOpenChange={(open) => !open && setRemoverId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Excluir modelo?</DialogTitle>
            <DialogDescription className="text-xs">
              Esta ação não pode ser desfeita. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRemoverId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={() => removerId && deletar(removerId)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
