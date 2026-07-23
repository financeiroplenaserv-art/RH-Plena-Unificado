import { useEffect, useMemo, useState } from 'react'
import { Bell, BellPlus } from 'lucide-react'
import { PageHeader } from '@/components/corh/PageHeader'
import { Filters } from '@/components/corh/Filters'
import { DataTable } from '@/components/corh/DataTable'
import { StatusBadge } from '@/components/corh/StatusBadge'
import { EmptyState } from '@/components/corh/EmptyState'
import { Button } from '@/components/corh/Button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { useFerias } from '@/hooks/useFerias'
import { podeGerenciarFerias } from '@/lib/permissoes'
import { normalizarTexto } from '@/lib/escalas/normalizarTexto'
import type { FeriasNotificacao } from '@/types/database'
import { FeriasShell } from './FeriasShell'
import { NotificacaoFeriasDialog } from './NotificacaoFeriasDialog'

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}

export function FeriasNotificacoesPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeGerenciar = perfil ? podeGerenciarFerias(perfil) : false

  const { loading, listarNotificacoes, registrarNotificacao } = useFerias()
  const [notificacoes, setNotificacoes] = useState<FeriasNotificacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)

  const [input, setInput] = useState({ busca: '', destinatario: 'todos' })
  const [aplicado, setAplicado] = useState(input)

  const carregar = async () => {
    setCarregando(true)
    const lista = await listarNotificacoes()
    setNotificacoes(lista)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtradas = useMemo(() => {
    const busca = normalizarTexto(aplicado.busca)
    return notificacoes.filter((n) => {
      if (aplicado.destinatario !== 'todos' && n.destinatario !== aplicado.destinatario) return false
      if (busca) {
        const nome = normalizarTexto(n.colaborador?.nome_completo)
        const matricula = normalizarTexto(n.colaborador?.matricula)
        if (!nome.includes(busca) && !matricula.includes(busca)) return false
      }
      return true
    })
  }, [notificacoes, aplicado])

  const aplicarFiltros = () => setAplicado(input)
  const limparFiltros = () => {
    const vazio = { busca: '', destinatario: 'todos' }
    setInput(vazio)
    setAplicado(vazio)
  }

  return (
    <FeriasShell>
      <PageHeader backTo="/" title="Notificações de férias" description="Avisos enviados aos colaboradores e aos responsáveis pelos contratos">
        {podeGerenciar && (
          <Button variant="primary" size="sm" onClick={() => setModal(true)}>
            <BellPlus className="size-4" />
            Registrar notificação
          </Button>
        )}
      </PageHeader>

      <Filters onApply={aplicarFiltros} onClear={limparFiltros} loading={carregando} className="mb-4">
        <div>
          <Label>Buscar</Label>
          <Input
            placeholder="Nome ou matrícula"
            value={input.busca}
            onChange={(e) => setInput((v) => ({ ...v, busca: e.target.value }))}
          />
        </div>
        <div>
          <Label>Destinatário</Label>
          <Select value={input.destinatario} onValueChange={(v) => setInput((prev) => ({ ...prev, destinatario: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="colaborador">Ao colaborador</SelectItem>
              <SelectItem value="responsavel_contrato">Responsável pelo contrato</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Filters>

      <DataTable title="Notificações registradas" count={filtradas.length}>
        {filtradas.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-6" />}
            title="Nenhuma notificação registrada"
            description="Registre os avisos de férias enviados aos colaboradores e aos responsáveis pelos contratos."
          />
        ) : (
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Data</th>
                <th className="px-3 py-3">Colaborador</th>
                <th className="px-3 py-3">Matrícula</th>
                <th className="px-3 py-3">Departamento</th>
                <th className="px-3 py-3">Destinatário</th>
                <th className="px-5 py-3">Observação</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((n) => (
                <tr key={n.id} className="border-b border-border/60 hover:bg-accent/40">
                  <td className="px-5 py-3 tabular-nums whitespace-nowrap">{formatarData(n.data_notificacao)}</td>
                  <td className="px-3 py-3 font-medium text-foreground">{n.colaborador?.nome_completo ?? '-'}</td>
                  <td className="px-3 py-3 tabular-nums text-muted-foreground">{n.colaborador?.matricula ?? '-'}</td>
                  <td className="px-3 py-3">{n.colaborador?.departamento ?? '-'}</td>
                  <td className="px-3 py-3">
                    <StatusBadge variant={n.destinatario === 'colaborador' ? 'info' : 'warning'}>
                      {n.destinatario === 'colaborador' ? 'Colaborador' : 'Responsável contrato'}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{n.observacao ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataTable>

      <NotificacaoFeriasDialog
        open={modal}
        onOpenChange={setModal}
        loading={loading}
        onSalvar={async (notificacao) => {
          const ok = await registrarNotificacao(notificacao)
          if (ok) await carregar()
          return ok
        }}
      />
    </FeriasShell>
  )
}
