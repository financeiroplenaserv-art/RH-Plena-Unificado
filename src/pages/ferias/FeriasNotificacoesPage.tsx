import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/hooks/useAuth'
import { useFiltroPersistente } from '@/hooks/useFiltroPersistente'
import { useFerias } from '@/hooks/useFerias'
import { podeGerenciarFerias } from '@/lib/permissoes'
import { normalizarTexto } from '@/lib/escalas/normalizarTexto'
import { formatarData } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { nomeCurtoDepartamentoFuzzy, type DepartamentoFuzzy } from '@/lib/departamentos'
import type { FeriasNotificacao } from '@/types/database'
import { FeriasShell } from './FeriasShell'
import { NotificacaoFeriasDialog } from './NotificacaoFeriasDialog'

export function FeriasNotificacoesPage() {
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeGerenciar = perfil ? podeGerenciarFerias(perfil) : false

  const { loading, listarNotificacoes, registrarNotificacao } = useFerias()
  const [notificacoes, setNotificacoes] = useState<FeriasNotificacao[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoFuzzy[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)

  const [input, setInput] = useFiltroPersistente('ferias.notificacoes.draft', { busca: '', destinatario: 'todos' })
  const [aplicado, setAplicado] = useFiltroPersistente('ferias.notificacoes.aplicado', { busca: '', destinatario: 'todos' })

  const carregar = async () => {
    setCarregando(true)
    // Lista completa (sem filtro de nome_curto) para resolver o departamento
    // do colaborador no cliente — o texto legado não bate com o cadastro.
    const [lista, { data: deptData, error: erroDept }] = await Promise.all([
      listarNotificacoes(),
      supabase.from('departamentos').select('id, nome, nome_curto, empresa_id, status'),
    ])
    if (erroDept) console.error('Erro ao carregar departamentos:', erroDept)
    setNotificacoes(lista)
    setDepartamentos((deptData || []) as DepartamentoFuzzy[])
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                    {formatarData(n.data_notificacao) || '—'}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {n.colaborador ? (
                      <Link
                        to={`/ferias/colaborador/${n.colaborador.id}`}
                        title={n.solicitacao_id ? 'Ver a solicitação na ficha do colaborador' : 'Ver a ficha de férias'}
                        className="text-primary hover:underline"
                      >
                        {n.colaborador.nome_completo}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{n.colaborador?.matricula ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {n.colaborador
                      ? nomeCurtoDepartamentoFuzzy(departamentos, n.colaborador.departamento_id, n.colaborador.departamento, n.colaborador.empresa_id)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={n.destinatario === 'colaborador' ? 'info' : 'warning'}>
                      {n.destinatario === 'colaborador' ? 'Colaborador' : 'Responsável contrato'}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{n.observacao ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
