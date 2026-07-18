import { useEffect, useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePermissoes } from '@/hooks/usePermissoes'
import { useAuth } from '@/hooks/useAuth'
import { useAuditoria } from '@/hooks/useAuditoria'
import { toast } from 'sonner'
import type { NivelAcesso, PermissaoPerfil } from '@/types/database'
import { Loader2, RotateCcw } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '@/components/corh/PageHeader'
import { ModuleShell, ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'

const PERFIS: { valor: NivelAcesso; label: string }[] = [
  { valor: 'adm', label: 'Administrador (adm)' },
  { valor: 'gestor', label: 'Gestor' },
  { valor: 'rh', label: 'RH' },
  { valor: 'dp1', label: 'DP1' },
  { valor: 'dp2', label: 'DP2' },
  { valor: 'mesa', label: 'Mesa' },
  { valor: 'inspetoria', label: 'Inspetoria' },
  { valor: 'financeiro', label: 'Financeiro' },
  { valor: 'visualizador', label: 'Visualizador' },
]

interface PermissaoConfig {
  recurso: string
  acao: string
  label: string
  grupo: string
}

const PERMISSOES_CONFIG: PermissaoConfig[] = [
  // Dados mestres
  { recurso: 'empresa', acao: 'editar', label: 'Editar empresas', grupo: 'Dados Mestres' },
  { recurso: 'empresa', acao: 'excluir', label: 'Excluir empresas', grupo: 'Dados Mestres' },
  { recurso: 'departamento', acao: 'editar', label: 'Editar departamentos', grupo: 'Dados Mestres' },
  { recurso: 'departamento', acao: 'excluir', label: 'Excluir departamentos', grupo: 'Dados Mestres' },
  { recurso: 'departamento', acao: 'importar', label: 'Importar departamentos', grupo: 'Dados Mestres' },
  { recurso: 'colaborador', acao: 'editar_basico', label: 'Editar dados básicos do colaborador', grupo: 'Dados Mestres' },
  { recurso: 'colaborador', acao: 'editar_completo', label: 'Editar dados completos do colaborador', grupo: 'Dados Mestres' },
  { recurso: 'colaborador', acao: 'cadastrar', label: 'Cadastrar colaborador', grupo: 'Dados Mestres' },
  { recurso: 'colaborador', acao: 'excluir', label: 'Excluir colaborador', grupo: 'Dados Mestres' },
  { recurso: 'colaborador', acao: 'importar', label: 'Importar colaboradores (e-Contador)', grupo: 'Dados Mestres' },
  { recurso: 'colaborador', acao: 'exportar', label: 'Exportar colaboradores', grupo: 'Dados Mestres' },

  // Integrações
  { recurso: 'econtador', acao: 'gerenciar', label: 'Gerenciar e-Contador', grupo: 'Integrações' },
  { recurso: 'configuracoes', acao: 'configurar_token', label: 'Configurar token do e-Contador', grupo: 'Integrações' },

  // Ocorrências
  { recurso: 'ocorrencia', acao: 'criar', label: 'Criar ocorrências', grupo: 'Ocorrências' },
  { recurso: 'ocorrencia', acao: 'editar', label: 'Editar ocorrências', grupo: 'Ocorrências' },
  { recurso: 'ocorrencia', acao: 'cancelar', label: 'Cancelar ocorrências', grupo: 'Ocorrências' },
  { recurso: 'ocorrencia', acao: 'ver_detalhes', label: 'Ver detalhes da ocorrência', grupo: 'Ocorrências' },
  { recurso: 'ocorrencia', acao: 'aprovar', label: 'Aprovar ocorrências', grupo: 'Ocorrências' },
  { recurso: 'ocorrencia', acao: 'anexar', label: 'Anexar arquivos em ocorrências', grupo: 'Ocorrências' },
  { recurso: 'ocorrencia', acao: 'adicionar_testemunha', label: 'Adicionar testemunhas', grupo: 'Ocorrências' },
  { recurso: 'ocorrencia', acao: 'gerar_pdf', label: 'Gerar PDF da ocorrência', grupo: 'Ocorrências' },
  { recurso: 'ocorrencia', acao: 'gerenciar_modelos', label: 'Gerenciar modelos de ocorrência', grupo: 'Ocorrências' },

  // Extras
  { recurso: 'extras', acao: 'editar', label: 'Criar/editar extras', grupo: 'Extras' },
  { recurso: 'extras', acao: 'editar_categoria', label: 'Editar categorias de valor', grupo: 'Extras' },
  { recurso: 'extras', acao: 'excluir_categoria', label: 'Excluir categorias de valor', grupo: 'Extras' },
  { recurso: 'extras', acao: 'gerenciar_recibo', label: 'Gerenciar recibos de extras', grupo: 'Extras' },
  { recurso: 'extras', acao: 'marcar_pago', label: 'Marcar extras como Pago', grupo: 'Extras' },
  { recurso: 'extras', acao: 'cancelar_recibo', label: 'Cancelar/excluir recibo', grupo: 'Extras' },
  { recurso: 'extras', acao: 'ver_relatorio', label: 'Ver relatório de extras', grupo: 'Extras' },
  { recurso: 'extras', acao: 'ver_balanco', label: 'Ver balanço de extras', grupo: 'Extras' },
  { recurso: 'extras', acao: 'enviar_comunicacao', label: 'Enviar comunicação de extras', grupo: 'Extras' },

  // VR
  { recurso: 'vr', acao: 'visualizar', label: 'Visualizar projetos VR', grupo: 'VR' },
  { recurso: 'vr', acao: 'gerenciar', label: 'Gerenciar projetos VR', grupo: 'VR' },

  // Adicionais contratuais
  { recurso: 'adicionais', acao: 'editar_contrato', label: 'Editar contratos', grupo: 'Adicionais' },
  { recurso: 'adicionais', acao: 'editar_vinculo', label: 'Editar vínculos', grupo: 'Adicionais' },
  { recurso: 'adicionais', acao: 'editar_calendario', label: 'Editar calendário', grupo: 'Adicionais' },
  { recurso: 'adicionais', acao: 'ver_relatorio', label: 'Ver relatório de adicionais', grupo: 'Adicionais' },

  // Alertas e configurações
  { recurso: 'alertas', acao: 'gerenciar', label: 'Gerenciar alertas', grupo: 'Alertas / Configurações' },
  { recurso: 'configuracoes', acao: 'ver', label: 'Ver configurações', grupo: 'Alertas / Configurações' },
  { recurso: 'auditoria', acao: 'ver', label: 'Ver auditoria', grupo: 'Alertas / Configurações' },

  // Escalas
  { recurso: 'escala', acao: 'visualizar', label: 'Visualizar escalas', grupo: 'Escalas' },
  { recurso: 'escala', acao: 'editar_local', label: 'Editar locais de trabalho', grupo: 'Escalas' },
  { recurso: 'escala', acao: 'mapear_flit', label: 'Mapear Flit ↔ Local', grupo: 'Escalas' },
  { recurso: 'escala', acao: 'importar', label: 'Importar Excel do Flit', grupo: 'Escalas' },
  { recurso: 'escala', acao: 'confirmar_manual', label: 'Confirmar local manualmente', grupo: 'Escalas' },
  { recurso: 'escala', acao: 'editar_dia', label: 'Editar local de um dia', grupo: 'Escalas' },

  // Menus
  { recurso: 'menu', acao: 'dashboard', label: 'Ver menu Dashboard', grupo: 'Menus' },
  { recurso: 'menu', acao: 'colaboradores', label: 'Ver menu Colaboradores', grupo: 'Menus' },
  { recurso: 'menu', acao: 'empresas', label: 'Ver menu Empresas', grupo: 'Menus' },
  { recurso: 'menu', acao: 'departamentos', label: 'Ver menu Departamentos', grupo: 'Menus' },
  { recurso: 'menu', acao: 'econtador', label: 'Ver menu e-Contador', grupo: 'Menus' },
  { recurso: 'menu', acao: 'rh', label: 'Ver menu Ocorrências', grupo: 'Menus' },
  { recurso: 'menu', acao: 'extras', label: 'Ver menu Extras', grupo: 'Menus' },
  { recurso: 'menu', acao: 'vr', label: 'Ver menu Benefícios (VR)', grupo: 'Menus' },
  { recurso: 'menu', acao: 'ceu', label: 'Ver menu Uniformes (CEU)', grupo: 'Menus' },
  { recurso: 'menu', acao: 'adicionais', label: 'Ver menu Adicionais', grupo: 'Menus' },
  { recurso: 'menu', acao: 'alertas', label: 'Ver menu Alertas', grupo: 'Menus' },
  { recurso: 'menu', acao: 'auditoria', label: 'Ver menu Auditoria', grupo: 'Menus' },
  { recurso: 'menu', acao: 'permissoes', label: 'Ver menu Permissões', grupo: 'Menus' },
  { recurso: 'menu', acao: 'relatorios', label: 'Ver menu Relatórios', grupo: 'Menus' },
  { recurso: 'menu', acao: 'ferias', label: 'Ver menu Férias', grupo: 'Menus' },

  // Rotas
  { recurso: 'rota', acao: 'colaboradores', label: 'Acessar rotas de colaboradores', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'empresas', label: 'Acessar rotas de empresas', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'departamentos', label: 'Acessar rotas de departamentos', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'ocorrencias', label: 'Acessar rotas de ocorrências', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'extras', label: 'Acessar rotas de extras', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'vr', label: 'Acessar rotas de VR', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'ceu', label: 'Acessar rotas de CEU', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'adicionais', label: 'Acessar rotas de adicionais', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'importar_econtador', label: 'Acessar importação e-Contador', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'configuracoes', label: 'Acessar configurações', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'auditoria', label: 'Acessar auditoria', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'permissoes', label: 'Acessar tela de permissões', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'alertas', label: 'Acessar alertas', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'relatorios', label: 'Acessar relatórios', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'ferias', label: 'Acessar férias', grupo: 'Rotas' },
  { recurso: 'rota', acao: 'mobile_falta', label: 'Acessar lançamento mobile de falta', grupo: 'Rotas' },
]

export function PermissoesPage() {
  const { user, loading: authLoading } = useAuth()
  const { permissoes, loading, salvando, carregarPermissoes, salvarPermissoes, resetarPerfil } =
    usePermissoes()
  const { registrar } = useAuditoria()
  const [perfilSelecionado, setPerfilSelecionado] = useState<NivelAcesso>('rh')
  const [dialogResetAberto, setDialogResetAberto] = useState(false)
  const [resetando, setResetando] = useState(false)

  useEffect(() => {
    carregarPermissoes()
  }, [carregarPermissoes])

  const permissoesPorChave = useMemo(() => {
    const map = new Map<string, boolean>()
    permissoes.forEach((p) => {
      map.set(`${p.perfil}:${p.recurso}:${p.acao}`, p.permitido)
    })
    return map
  }, [permissoes])

  const permissoesAtuais = useMemo(() => {
    return PERMISSOES_CONFIG.map((cfg) => {
      const chave = `${perfilSelecionado}:${cfg.recurso}:${cfg.acao}`
      return {
        ...cfg,
        permitido: permissoesPorChave.get(chave) ?? false,
      }
    })
  }, [perfilSelecionado, permissoesPorChave])

  const togglePermissao = (recurso: string, acao: string) => {
    const novasPermissoes: PermissaoPerfil[] = PERMISSOES_CONFIG.map((cfg) => {
      const chave = `${perfilSelecionado}:${cfg.recurso}:${cfg.acao}`
      const atual = permissoesPorChave.get(chave) ?? false
      return {
        perfil: perfilSelecionado,
        recurso: cfg.recurso,
        acao: cfg.acao,
        permitido:
          cfg.recurso === recurso && cfg.acao === acao ? !atual : atual,
      }
    })
    salvarPermissoes(novasPermissoes)
  }

  const grupos = useMemo(() => {
    const map = new Map<string, typeof permissoesAtuais>()
    permissoesAtuais.forEach((p) => {
      if (!map.has(p.grupo)) map.set(p.grupo, [])
      map.get(p.grupo)!.push(p)
    })
    return Array.from(map.entries())
  }, [permissoesAtuais])

  const handleReset = async () => {
    setResetando(true)
    const resultado = await resetarPerfil(perfilSelecionado)
    setResetando(false)
    setDialogResetAberto(false)

    if (resultado.sucesso) {
      toast.success(resultado.mensagem)
      await registrar({
        tabela: 'permissoes_perfil',
        registro_id: perfilSelecionado,
        operacao: 'CANCEL',
        dados_novos: {
          acao: 'reset_perfil_padrao',
          perfil: perfilSelecionado,
          executado_por: user?.id,
        },
      })
    } else {
      toast.error(resultado.mensagem)
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Carregando usuário...
      </div>
    )
  }

  if (!user || (user.nivel_acesso !== 'adm' && user.nivel_acesso !== 'admin')) {
    console.warn('Tentativa de acesso à /permissoes sem perfil administrativo:', user?.nivel_acesso)
    toast.error('Acesso restrito a administradores')
    return <Navigate to="/" replace />
  }

  return (
    <ModuleShell>
      <PageHeader backTo="/" title="Permissões" />

      <ModuleCard title="Selecionar perfil">
          <div className="w-full max-w-sm">
            <Label htmlFor="perfil" className="mb-2 block">
              Perfil
            </Label>
            <Select
              value={perfilSelecionado}
              onValueChange={(v) => setPerfilSelecionado(v as NivelAcesso)}
            >
              <SelectTrigger id="perfil">
                <SelectValue placeholder="Selecione um perfil" />
              </SelectTrigger>
              <SelectContent>
                {PERFIS.map((p) => (
                  <SelectItem key={p.valor} value={p.valor}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
            <p className="text-sm text-slate-500">
              As alterações são salvas imediatamente ao marcar/desmarcar. O perfil <strong>Administrador</strong> sempre tem acesso total.
            </p>
            <ModuleButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogResetAberto(true)}
              disabled={resetando || salvando}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar padrão deste perfil
            </ModuleButton>
          </div>
      </ModuleCard>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Carregando permissões...
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(([grupo, itens]) => (
            <ModuleCard key={grupo} title={grupo}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {itens.map((item) => (
                    <div
                      key={`${item.recurso}-${item.acao}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50"
                    >
                      <Label
                        htmlFor={`${item.recurso}-${item.acao}`}
                        className="text-sm text-slate-700 cursor-pointer"
                      >
                        {item.label}
                      </Label>
                      <Checkbox
                        id={`${item.recurso}-${item.acao}`}
                        checked={item.permitido}
                        disabled={salvando}
                        onCheckedChange={() =>
                          togglePermissao(item.recurso, item.acao)
                        }
                      />
                    </div>
                  ))}
                </div>
          </ModuleCard>
          ))}
        </div>
      )}

      {salvando && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Salvando...
        </div>
      )}

      <Dialog open={dialogResetAberto} onOpenChange={setDialogResetAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar padrão do perfil</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja restaurar as permissões do perfil{' '}
              <strong>{PERFIS.find((p) => p.valor === perfilSelecionado)?.label}</strong> para o
              padrão seguro? Todas as customizações manuais deste perfil serão perdidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <ModuleButton
              type="button"
              variant="outline"
              onClick={() => setDialogResetAberto(false)}
              disabled={resetando}
            >
              Cancelar
            </ModuleButton>
            <ModuleButton
              type="button"
              variant="danger"
              onClick={handleReset}
              disabled={resetando}
            >
              {resetando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restaurando...
                </>
              ) : (
                'Restaurar padrão'
              )}
            </ModuleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
