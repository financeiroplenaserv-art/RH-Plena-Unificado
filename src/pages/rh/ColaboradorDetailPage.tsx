import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BadgeStatus } from '@/components/BadgeStatus'
import { LoadingScreen } from '@/components/LoadingScreen'
import { gerarPDFColaborador, gerarPDFOcorrencia } from '@/lib/pdf'
import {
  ArrowLeft,
  Edit,
  Plus,
  Printer,
  Trash2,
  Eye,
  AlertTriangle,
  User,
  Calendar,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Colaborador, Ocorrencia } from '@/types/database'

export function ColaboradorDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [loading, setLoading] = useState(true)
  const [ocorrenciaParaExcluir, setOcorrenciaParaExcluir] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: colab } = await supabase
      .from('colaboradores')
      .select('*')
      .eq('id', id!)
      .single()
    setColaborador(colab as Colaborador)
    if (colab) {
      const { data: ocors } = await supabase
        .from('ocorrencias')
        .select('*')
        .eq('colaborador_id', id!)
        .order('data_ocorrencia', { ascending: false })
      setOcorrencias((ocors as Ocorrencia[]) || [])
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    // Carrega colaborador e ocorrências

    loadData()
  }, [loadData])

  const handleDeleteOcorrencia = async (ocorrenciaId: string) => {
    const { error } = await supabase.from('ocorrencias').delete().eq('id', ocorrenciaId)
    if (error) toast.error('Erro: ' + error.message)
    else {
      toast.success('Ocorrência removida')
      loadData()
    }
    setOcorrenciaParaExcluir(null)
  }

  if (loading) return <LoadingScreen mensagem="Carregando colaborador..." />
  if (!colaborador)
    return <div className="text-center py-8 text-sm text-slate-400">Colaborador não encontrado</div>

  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—')

  const ocPendentes = ocorrencias.filter((o) => o.status === 'Pendente').length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/colaboradores')}
            className="gap-1 h-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          {colaborador.foto_url ? (
            <img src={colaborador.foto_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <User className="h-5 w-5 text-slate-400" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{colaborador.nome_completo}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{colaborador.matricula}</span>
              <BadgeStatus status={colaborador.status} />
              {colaborador.cargo && <span className="text-xs text-slate-500">| {colaborador.cargo}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => colaborador && await gerarPDFColaborador(colaborador, ocorrencias)}
            className="gap-1 text-xs h-8"
          >
            <Printer className="h-3.5 w-3.5" /> Ficha PDF
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(`/rh/colaboradores/${id}/editar`)}
            className="gap-1 text-xs h-8 bg-blue-600 hover:bg-blue-700"
          >
            <Edit className="h-3.5 w-3.5" /> Editar
          </Button>
        </div>
      </div>

      <Card className="border-slate-100">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
            <div>
              <span className="text-slate-400 block">CPF</span>
              <span className="text-slate-800 font-medium">{colaborador.cpf || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Departamento</span>
              <span className="text-slate-800 font-medium">{colaborador.departamento || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Admissão</span>
              <span className="text-slate-800 font-medium">{fmtDate(colaborador.data_admissao)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Demissão</span>
              <span className="text-slate-800 font-medium">{fmtDate(colaborador.data_demissao)}</span>
            </div>

            <div>
              <span className="text-slate-400 block">E-mail</span>
              <span className="text-slate-800 font-medium">{colaborador.email || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Telefone</span>
              <span className="text-slate-800 font-medium">{colaborador.telefone || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Celular</span>
              <span className="text-slate-800 font-medium">{colaborador.celular || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">CEP</span>
              <span className="text-slate-800 font-medium">{colaborador.cep || '—'}</span>
            </div>

            <div className="col-span-2 sm:col-span-3 lg:col-span-4">
              <span className="text-slate-400 block">Endereço</span>
              <span className="text-slate-800 font-medium">
                {[colaborador.endereco, colaborador.cidade, colaborador.estado]
                  .filter(Boolean)
                  .join(' — ') || '—'}
              </span>
            </div>

            {colaborador.afastamento_motivo && (
              <div className="col-span-2 sm:col-span-3 lg:col-span-4 flex items-center gap-2 bg-orange-50 rounded px-3 py-1.5 -mx-1">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                <span className="text-orange-800 font-medium">
                  Afastado: {colaborador.afastamento_motivo} (
                  {fmtDate(colaborador.afastamento_data_inicio)} a{' '}
                  {fmtDate(colaborador.afastamento_data_fim)})
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-semibold text-slate-900">Ocorrências</h3>
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
              {ocorrencias.length}
            </span>
            {ocPendentes > 0 && (
              <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
                {ocPendentes} pendente{ocPendentes > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/rh/ocorrencias/colaborador/${id}`)}
            className="gap-1 text-xs bg-amber-600 hover:bg-amber-700"
          >
            <Plus className="h-3.5 w-3.5" /> Nova Ocorrência
          </Button>
        </div>

        {ocorrencias.length === 0 ? (
          <Card className="border-slate-100 border-dashed">
            <CardContent className="text-center py-8">
              <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">Nenhuma ocorrência registrada.</p>
              <p className="text-xs text-slate-400 mt-1">Clique em "Nova Ocorrência" para registrar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {ocorrencias.map((o) => (
              <Card
                key={o.id}
                className={`border ${
                  o.status === 'Pendente'
                    ? 'border-orange-200 bg-orange-50/20'
                    : o.status === 'Ativa'
                      ? 'border-amber-100'
                      : o.status === 'Resolvida'
                        ? 'border-emerald-100'
                        : 'border-slate-100'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-800">{o.tipo_ocorrencia}</span>
                        <BadgeStatus status={o.status} />
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {fmtDate(o.data_ocorrencia)}
                      </p>
                      <p className="text-sm text-slate-600 mt-2 leading-relaxed">{o.descricao}</p>
                    </div>
                    <div className="flex gap-0.5 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/rh/ocorrencias/${o.id}`)}
                        className="text-slate-400 hover:text-blue-600 h-7 w-7 p-0"
                        title="Ver detalhes"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => colaborador && await gerarPDFOcorrencia(colaborador, o)}
                        className="text-slate-400 hover:text-slate-700 h-7 w-7 p-0"
                        title="Gerar PDF"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      {o.status !== 'Cancelada' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setOcorrenciaParaExcluir(o.id)}
                          className="text-slate-400 hover:text-red-600 h-7 w-7 p-0"
                          title="Cancelar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!ocorrenciaParaExcluir} onOpenChange={(open) => !open && setOcorrenciaParaExcluir(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Remover ocorrência?</DialogTitle>
            <DialogDescription className="text-xs">
              Esta ação excluirá permanentemente o registro. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOcorrenciaParaExcluir(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={() => ocorrenciaParaExcluir && handleDeleteOcorrencia(ocorrenciaParaExcluir)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
