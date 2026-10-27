import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuditoria } from '@/hooks/useAuditoria'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ModuleCard } from '@/components/layout/ModuleShell'
import { rotuloPerfil } from '@/lib/perfis'
import type { NivelAcesso } from '@/types/database'

interface UsuarioAcesso {
  id: string
  nome: string | null
  email: string | null
  nivel_acesso: NivelAcesso
  acesso_bloqueado: boolean
}

/**
 * Bloqueio de acesso por PESSOA (migration 164): suspende o login sem apagar o
 * perfil nem mexer nas permissões do nível — usado quando alguém sai da empresa
 * e o mesmo e-mail será usado pelo substituto. O useAuth desloga o bloqueado.
 */
export function UsuariosAcessoCard({ usuarioAtualId }: { usuarioAtualId: string }) {
  const { registrar } = useAuditoria()
  const [usuarios, setUsuarios] = useState<UsuarioAcesso[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('perfis')
      .select('id, nome, email, nivel_acesso, acesso_bloqueado')
      .order('nome')
    if (error) {
      console.error('Erro ao carregar usuários:', error)
      toast.error('Não foi possível carregar a lista de usuários.')
      setUsuarios([])
    } else {
      setUsuarios((data as UsuarioAcesso[]) || [])
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const alternarBloqueio = async (alvo: UsuarioAcesso) => {
    const bloquear = !alvo.acesso_bloqueado
    setSalvandoId(alvo.id)
    const { data, error } = await supabase
      .from('perfis')
      .update({ acesso_bloqueado: bloquear })
      .eq('id', alvo.id)
      .select('id')
    setSalvandoId(null)

    if (error || !data || data.length === 0) {
      console.error('Erro ao alterar bloqueio de acesso:', error)
      toast.error('Não foi possível alterar o acesso. Nenhuma linha foi gravada.')
      return
    }

    setUsuarios((atual) =>
      atual.map((u) => (u.id === alvo.id ? { ...u, acesso_bloqueado: bloquear } : u))
    )
    toast.success(
      bloquear
        ? `Acesso de ${alvo.nome || alvo.email} suspenso. O login passa a ser recusado.`
        : `Acesso de ${alvo.nome || alvo.email} reativado.`
    )
    await registrar({
      tabela: 'perfis',
      registro_id: alvo.id,
      operacao: 'UPDATE',
      dados_novos: {
        acao: bloquear ? 'bloquear_acesso' : 'desbloquear_acesso',
        email: alvo.email,
        executado_por: usuarioAtualId,
      },
    })
  }

  return (
    <ModuleCard title="Usuários">
      <p className="text-sm text-slate-500 mb-4">
        Bloquear suspende o login da pessoa <strong>sem apagar o perfil nem as permissões</strong> —
        útil quando alguém sai da empresa e outra pessoa vai assumir o mesmo e-mail.
        Para readmitir, é só desmarcar. O bloqueio vale no próximo login ou ao recarregar a página.
      </p>
      {carregando ? (
        <div className="flex items-center justify-center py-8 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando usuários...
        </div>
      ) : (
        <div className="space-y-2">
          {usuarios.map((u) => {
            const souEu = u.id === usuarioAtualId
            return (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {u.nome || u.email || u.id}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {rotuloPerfil(u.nivel_acesso)}
                    </Badge>
                    {u.acesso_bloqueado && (
                      <Badge variant="destructive" className="text-xs">
                        <UserX className="h-3 w-3 mr-1" />
                        Bloqueado
                      </Badge>
                    )}
                  </div>
                  {u.nome && u.email && (
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {salvandoId === u.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                  <label
                    htmlFor={`bloqueio-${u.id}`}
                    className={`text-sm ${souEu ? 'text-slate-400' : 'text-slate-700 cursor-pointer'}`}
                    title={souEu ? 'Você não pode bloquear o seu próprio acesso' : undefined}
                  >
                    Acesso bloqueado
                  </label>
                  <Checkbox
                    id={`bloqueio-${u.id}`}
                    checked={u.acesso_bloqueado}
                    disabled={souEu || salvandoId !== null}
                    onCheckedChange={() => alternarBloqueio(u)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </ModuleCard>
  )
}
