import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAlertas } from '@/hooks/useAlertas'
import { useAuth } from '@/hooks/useAuth'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingScreen } from '@/components/LoadingScreen'
import { PageHeader } from '@/components/PageHeader'
import { podeGerenciarAlertas } from '@/lib/permissoes'
import type { Alerta } from '@/types/database'
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  CalendarClock,
  Users,
  CheckCircle,
  Archive,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const tipoLabels: Record<string, string> = {
  SUSPENSAO_LIMITE: 'Limite de Suspensão',
  ESTABILIDADE: 'Estabilidade',
  FALTAS_EXCESSIVAS: 'Faltas Excessivas',
  PRAZO_DEFESA: 'Prazo de Defesa',
  OCORRENCIA_PENDENTE: 'Ocorrência Pendente',
  PROGRESSAO_DISCIPLINAR: 'Progressão Disciplinar',
  HOMOLOGACAO_NECESSARIA: 'Homologação Necessária',
}

const severidadeCores: Record<string, { bg: string; border: string; text: string; icon: string }> =
  {
    critica: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500' },
    alta: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-700',
      icon: 'text-orange-500',
    },
    media: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: 'text-amber-500',
    },
    baixa: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
  }

const tipoIcones: Record<string, LucideIcon> = {
  SUSPENSAO_LIMITE: CalendarClock,
  ESTABILIDADE: ShieldAlert,
  FALTAS_EXCESSIVAS: Users,
  PRAZO_DEFESA: CalendarClock,
  OCORRENCIA_PENDENTE: Bell,
  PROGRESSAO_DISCIPLINAR: TrendingUp,
  HOMOLOGACAO_NECESSARIA: ShieldAlert,
}

export function AlertasPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeGerenciar = perfil ? podeGerenciarAlertas(perfil) : false

  const { alertas, loading, loadAlertas, marcarComoLido, arquivar, gerarAlertasAutomaticos } =
    useAlertas()
  const [filtroSeveridade, setFiltroSeveridade] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('ativo')
  const [gerando, setGerando] = useState(false)
  const [stats, setStats] = useState({ total: 0, criticos: 0, altos: 0, medios: 0 })

  useEffect(() => {
    loadAlertas(filtroStatus || undefined)
  }, [filtroStatus, loadAlertas])

  useEffect(() => {
    const loadStats = async () => {
      const { data } = await supabase.from('alertas').select('severidade, status')
      if (data) {
        const alertasData = data as Alerta[]
        setStats({
          total: alertasData.length,
          criticos: alertasData.filter((a) => a.severidade === 'critica' && a.status === 'ativo').length,
          altos: alertasData.filter((a) => a.severidade === 'alta' && a.status === 'ativo').length,
          medios: alertasData.filter((a) => a.severidade === 'media' && a.status === 'ativo').length,
        })
      }
    }
    loadStats()
  }, [alertas])

  const handleGerarAlertas = async () => {
    setGerando(true)
    await gerarAlertasAutomaticos()
    await loadAlertas(filtroStatus || undefined)
    setGerando(false)
  }

  const alertasFiltrados = filtroSeveridade
    ? alertas.filter((a) => a.severidade === filtroSeveridade)
    : alertas

  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '')

  return (
    <div className="space-y-4">
      <PageHeader backTo="/" title="Alertas" description="Alertas automáticos de conformidade legal">
        {stats.criticos > 0 && (
          <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
            {stats.criticos} crítico{stats.criticos > 1 ? 's' : ''}
          </span>
        )}
        {podeGerenciar && (
          <Button
            size="sm"
            onClick={handleGerarAlertas}
            disabled={gerando}
            className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${gerando ? 'animate-spin' : ''}`} />{' '}
            {gerando ? 'Analisando...' : 'Verificar Alertas'}
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'bg-slate-100 text-slate-700' },
          { label: 'Críticos', value: stats.criticos, color: 'bg-red-100 text-red-700' },
          { label: 'Altos', value: stats.altos, color: 'bg-orange-100 text-orange-700' },
          { label: 'Médios', value: stats.medios, color: 'bg-amber-100 text-amber-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg p-3 ${s.color}`}>
            <p className="text-xs opacity-70">{s.label}</p>
            <p className="text-xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1.5">
          <Button
            variant={filtroStatus === 'ativo' ? 'default' : 'outline'}
            onClick={() => setFiltroStatus('ativo')}
            size="sm"
            className="text-xs h-8"
          >
            Ativos
          </Button>
          <Button
            variant={filtroStatus === 'lido' ? 'default' : 'outline'}
            onClick={() => setFiltroStatus('lido')}
            size="sm"
            className="text-xs h-8"
          >
            Lidos
          </Button>
          <Button
            variant={filtroStatus === '' ? 'default' : 'outline'}
            onClick={() => setFiltroStatus('')}
            size="sm"
            className="text-xs h-8"
          >
            Todos
          </Button>
        </div>
        <Select value={filtroSeveridade} onValueChange={setFiltroSeveridade}>
          <SelectTrigger className="h-8 text-xs w-full sm:w-44">
            <SelectValue placeholder="Todas severidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas severidades</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {loading ? (
          <LoadingScreen mensagem="Carregando alertas..." className="py-8" />
        ) : alertasFiltrados.length === 0 ? (
          <Card className="border-slate-100">
            <CardContent className="text-center py-8 text-sm text-slate-400">
              <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              Nenhum alerta encontrado.
              <p className="text-xs text-slate-400 mt-1">
                Clique em "Verificar Alertas" para gerar alertas automáticos.
              </p>
            </CardContent>
          </Card>
        ) : (
          alertasFiltrados.map((a) => {
            const cor = severidadeCores[a.severidade] || severidadeCores.media
            const Icone = tipoIcones[a.tipo] || AlertTriangle
            return (
              <Card key={a.id} className={`border ${cor.border} ${cor.bg} transition-all`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icone className={`h-5 w-5 mt-0.5 flex-shrink-0 ${cor.icon}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium uppercase ${cor.bg} ${cor.text}`}
                        >
                          {a.severidade}
                        </span>
                        <span className="text-xs text-slate-500">
                          {tipoLabels[a.tipo] || a.tipo}
                        </span>
                        {a.data_vencimento && (
                          <span className="text-xs text-slate-400">
                            Vence: {fmtDate(a.data_vencimento)}
                          </span>
                        )}
                      </div>
                      <h4 className={`text-sm font-medium ${cor.text}`}>{a.titulo}</h4>
                      <p className="text-xs text-slate-600 mt-1">{a.descricao}</p>
                      {a.colaborador && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() =>
                            a.colaborador_id && navigate(`/rh/colaboradores/${a.colaborador_id}`)
                          }
                          className="text-xs text-blue-600 h-auto p-0 mt-1"
                        >
                          Ver colaborador: {a.colaborador.nome_completo} ({a.colaborador.matricula})
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {a.status === 'ativo' && podeGerenciar && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => marcarComoLido(a.id)}
                          className="text-slate-400 hover:text-emerald-600 h-7 w-7 p-0"
                          title="Marcar como lido"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {podeGerenciar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => arquivar(a.id)}
                        className="text-slate-400 hover:text-slate-600 h-7 w-7 p-0"
                        title="Arquivar"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <Card className="border-slate-100 bg-slate-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Base Legal dos Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-600 space-y-1">
          <p>
            <strong>Art. 482 CLT:</strong> Progressão disciplinar: Advertência Verbal → Escrita →
            Suspensão → Desligamento
          </p>
          <p>
            <strong>Art. 474 CLT:</strong> Suspensão máxima de 30 dias contínuos ou 90 dias alternados
            no ano
          </p>
          <p>
            <strong>Art. 853 CLT:</strong> Estabilidade: 1 ano após acidente de trabalho, gestante,
            sindicalizado
          </p>
          <p>
            <strong>Art. 211 CLT:</strong> Faltas justificadas (atestado, eleição, casamento, luto,
            etc.)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
