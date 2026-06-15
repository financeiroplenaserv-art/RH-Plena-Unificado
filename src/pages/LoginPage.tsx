import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface LoginPageProps {
  onLogin: (email: string, senha: string) => Promise<void>
  onLoginExistente?: (email: string, senha: string) => Promise<void>
  loading?: boolean
  primeiroAcesso?: boolean
}

export function LoginPage({
  onLogin,
  onLoginExistente,
  loading = false,
  primeiroAcesso = false,
}: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [modoLogin, setModoLogin] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (primeiroAcesso && modoLogin && onLoginExistente) {
      await onLoginExistente(email, senha)
    } else {
      await onLogin(email, senha)
    }
  }

  const isLogin = !primeiroAcesso || modoLogin

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F8FAFC' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-xl mx-auto flex items-center justify-center mb-4"
            style={{ backgroundColor: '#1F2937' }}
          >
            <span className="text-white text-2xl font-bold">RH</span>
          </div>
          <div className="flex items-baseline justify-center gap-1.5">
            <h1 className="text-2xl font-bold" style={{ color: '#1F2937' }}>
              RH
            </h1>
            <span className="text-lg font-light" style={{ color: '#94A3B8' }}>
              Plena
            </span>
          </div>
          <p className="text-slate-500">Sistema Institucional Unificado</p>
        </div>

        <Card className="border-0 shadow-lg" style={{ backgroundColor: '#FFFFFF' }}>
          <CardHeader>
            <CardTitle style={{ color: '#1F2937' }}>
              {isLogin ? 'Acessar plataforma' : 'Criar primeira conta'}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? 'Digite seu e-mail e senha para continuar'
                : 'Este será o usuário administrador do sistema'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" style={{ color: '#1F2937' }}>
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-slate-200 focus-visible:ring-[#1F2937]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha" style={{ color: '#1F2937' }}>
                  Senha
                </Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="border-slate-200 focus-visible:ring-[#1F2937]"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                style={{ backgroundColor: '#1F2937' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isLogin ? 'Entrando...' : 'Criando conta...'}
                  </>
                ) : (
                  isLogin ? 'Entrar' : 'Criar conta e entrar'
                )}
              </Button>

              {primeiroAcesso && !modoLogin && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setModoLogin(true)}
                  style={{ color: '#64748B' }}
                >
                  Já tem conta? Fazer login
                </Button>
              )}

              {primeiroAcesso && modoLogin && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setModoLogin(false)}
                  style={{ color: '#64748B' }}
                >
                  Criar nova conta administradora
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          RH Ocorrências • CEU • Vale Refeição
        </p>
      </div>
    </div>
  )
}
