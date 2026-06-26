import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEContador } from '@/hooks/useEContador'
import { useAuth } from '@/hooks/useAuth'
import { validarToken } from '@/services/econtadorApi'
import { podeVerConfiguracoes, podeConfigurarTokenEContador } from '@/lib/permissoes'
import { toast } from 'sonner'

export function ConfiguracoesPage() {
  const { salvarToken } = useEContador()
  const navigate = useNavigate()
  const { user } = useAuth()
  const perfil = user?.nivel_acesso
  const podeVer = perfil ? podeVerConfiguracoes(perfil) : false
  const podeConfigurarToken = perfil ? podeConfigurarTokenEContador(perfil) : false

  const [token, setToken] = useState('')
  const [salvando, setSalvando] = useState(false)

  const handleSalvar = async () => {
    if (!token.trim()) return
    setSalvando(true)

    // CORREÇÃO DE SEGURANÇA/ROBUSTEZ: valida o token antes de salvá-lo.
    const tokenValido = await validarToken(token.trim())
    if (!tokenValido) {
      toast.error('Token inválido ou API do e-Contador indisponível. Verifique e tente novamente.')
      setSalvando(false)
      return
    }

    await salvarToken(token.trim())
    setSalvando(false)
    setToken('')
    toast.success('Token salvo com sucesso')
    navigate('/importar/econtador')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Configurações</h2>
          <p className="text-sm text-slate-500">Gerencie integrações e parâmetros da plataforma</p>
        </div>
      </div>

      {!podeVer ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            Você não tem permissão para acessar as configurações.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">e-Contador Alterdata</CardTitle>
            <CardDescription>Token de acesso à API de funcionários</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {podeConfigurarToken ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="econtador-token">Token JWT</Label>
                  <Input
                    id="econtador-token"
                    type="password"
                    placeholder="Informe o token..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </div>
                <Button onClick={handleSalvar} disabled={!token.trim() || salvando}>
                  <Save className="w-4 h-4 mr-2" />
                  {salvando ? 'Salvando...' : 'Salvar token'}
                </Button>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Apenas perfis administrador, DP1 e DP2 podem configurar o token do e-Contador.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
