import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CalendarHeart,
  ClipboardList,
  Coins,
  FileBarChart,
  MapPin,
  Receipt,
  Scale,
  ScrollText,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/corh/PageHeader'
import { EmptyState } from '@/components/corh/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { verificarPermissao } from '@/lib/permissoes'

interface RelatorioItem {
  titulo: string
  descricao: string
  link: string
  icon: LucideIcon
  // Mesma permissão de rota da tela de destino — o card só aparece para
  // quem consegue abrir a tela (espelha o ProtectedRoute do App.tsx).
  rotaAcao: string
}

interface RelatorioGrupo {
  modulo: string
  itens: RelatorioItem[]
}

const GRUPOS: RelatorioGrupo[] = [
  {
    modulo: 'Extras',
    itens: [
      {
        titulo: 'Relatório Semanal',
        descricao: 'Extras por período com totais por colaborador e categoria; exporta em Excel.',
        link: '/extras/relatorio',
        icon: Coins,
        rotaAcao: 'extras',
      },
      {
        titulo: 'Balanço Operacional',
        descricao: 'Resumo diário da operação (faltas, coberturas e reforços) para o relatório de WhatsApp.',
        link: '/extras/balanco',
        icon: Scale,
        rotaAcao: 'extras',
      },
      {
        titulo: 'Recibos de Pagamento',
        descricao: 'Geração, assinatura e controle de pagamento dos recibos de extras.',
        link: '/extras/recibos',
        icon: Receipt,
        rotaAcao: 'extras',
      },
    ],
  },
  {
    modulo: 'Adicionais',
    itens: [
      {
        titulo: 'Relatório de Adicionais',
        descricao: 'Insalubridade, periculosidade e feriados por vínculo e período; exporta CSV e Excel.',
        link: '/adicionais/relatorio',
        icon: ClipboardList,
        rotaAcao: 'adicionais',
      },
    ],
  },
  {
    modulo: 'CEU',
    itens: [
      {
        titulo: 'Relatórios do CEU',
        descricao: 'Entregas por colaborador, data, item, vencimento e estoque; exporta em Excel.',
        link: '/ceu/relatorios',
        icon: FileBarChart,
        rotaAcao: 'ceu',
      },
    ],
  },
  {
    modulo: 'Férias',
    itens: [
      {
        titulo: 'Painel CLT de Férias',
        descricao: 'Situação de cada colaborador (em gozo, agendado, a vencer, vencido); exporta em Excel.',
        link: '/ferias',
        icon: CalendarHeart,
        rotaAcao: 'ferias',
      },
    ],
  },
  {
    modulo: 'Escalas',
    itens: [
      {
        titulo: 'Local de Trabalho Diário',
        descricao: 'Onde cada colaborador trabalhou em cada dia, com exportação do período.',
        link: '/escalas',
        icon: MapPin,
        rotaAcao: 'escalas',
      },
    ],
  },
  {
    modulo: 'Benefícios (VR)',
    itens: [
      {
        titulo: 'Projetos de VR',
        descricao: 'Resultados do cálculo de vale-refeição e comprovantes por projeto.',
        link: '/vr/projetos',
        icon: UtensilsCrossed,
        rotaAcao: 'vr',
      },
    ],
  },
  {
    modulo: 'Gestão',
    itens: [
      {
        titulo: 'Auditoria',
        descricao: 'Trilha de ações dos usuários no sistema (quem fez o quê, quando).',
        link: '/auditoria',
        icon: ScrollText,
        rotaAcao: 'auditoria',
      },
    ],
  },
]

export function RelatoriosPage() {
  const { user } = useAuth()

  if (!user) return null

  const gruposVisiveis = GRUPOS.map((grupo) => ({
    ...grupo,
    itens: grupo.itens.filter((item) => verificarPermissao(user.nivel_acesso, 'rota', item.rotaAcao)),
  })).filter((grupo) => grupo.itens.length > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description="Atalhos para os relatórios e exportações de cada módulo"
        showBackButton={false}
      />

      {gruposVisiveis.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<BarChart3 className="size-6" />}
              title="Nenhum relatório disponível"
              description="Seu perfil não tem acesso a nenhuma tela de relatório no momento."
            />
          </CardContent>
        </Card>
      ) : (
        gruposVisiveis.map((grupo) => (
          <section key={grupo.modulo} className="space-y-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              {grupo.modulo}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {grupo.itens.map((item) => (
                <Link key={item.link} to={item.link} className="group">
                  <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-accent/30">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                        <item.icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-foreground">{item.titulo}</p>
                        <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
                          {item.descricao}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
