import { useState } from 'react'
import { Loader2, Eye, EyeOff, ShieldCheck, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [modoLogin, setModoLogin] = useState(false)

  const isLogin = !primeiroAcesso || modoLogin

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (primeiroAcesso && modoLogin && onLoginExistente) {
      await onLoginExistente(email, senha)
    } else {
      await onLogin(email, senha)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Lado esquerdo — Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white" style={{ background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)' }}>
        <div className="flex items-center gap-3">
          <img
            src="/logo_plena_cab.jpg"
            alt="Plena"
            className="h-10 w-auto rounded-lg object-contain bg-white/10 p-1"
          />
          <span className="text-xl font-semibold tracking-tight">CORH</span>
        </div>

        <div className="space-y-6 max-w-md">
          <img
            src="/logo_plena.jpg"
            alt="Plena 30 Anos"
            className="w-48 h-48 object-contain rounded-2xl bg-white/5 p-4 border border-white/10"
          />
          <h1 className="text-4xl font-bold leading-tight">
            Gestão de RH unificada para o seu negócio
          </h1>
          <p className="text-slate-300 text-lg">
            Controle de colaboradores, ocorrências, uniformes, benefícios e muito mais em um só lugar.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
              <ShieldCheck className="w-5 h-5 mt-0.5" style={{ color: '#2563EB' }} />
              <div>
                <p className="font-medium text-sm">Seguro</p>
                <p className="text-xs text-slate-400">Dados protegidos com criptografia</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
              <Building2 className="w-5 h-5 mt-0.5" style={{ color: '#2563EB' }} />
              <div>
                <p className="font-medium text-sm">Unificado</p>
                <p className="text-xs text-slate-400">Todos os módulos integrados</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} CORH — Plena. Todos os direitos reservados.
        </p>
      </div>

      {/* Lado direito — Formulário */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md space-y-8">
          {/* Header mobile */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <img
              src="/logo_plena_cab.jpg"
              alt="Plena"
              className="h-10 w-auto rounded-lg object-contain"
            />
            <span className="text-xl font-semibold text-slate-900">CORH</span>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-900">
              {isLogin ? 'Bem-vindo de volta' : 'Criar primeira conta'}
            </h2>
            <p className="text-xs font-medium tracking-wider text-[#1E3A5F] uppercase">
              Controle Operacional e de RH
            </p>
            <p className="text-slate-500 text-sm">
              {isLogin
                ? 'Digite seu e-mail e senha para acessar o sistema'
                : 'Este será o usuário administrador inicial do sistema'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700 text-sm font-medium">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 border-slate-200 focus-visible:ring-[#1E3A5F] focus-visible:ring-1"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha" className="text-slate-700 text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="h-11 border-slate-200 pr-10 focus-visible:ring-[#1E3A5F] focus-visible:ring-1"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-sm font-medium"
              disabled={loading}
              style={{ backgroundColor: '#1E3A5F' }}
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

            {primeiroAcesso && (
              <div className="text-center">
                {modoLogin ? (
                  <button
                    type="button"
                    onClick={() => setModoLogin(false)}
                    className="text-sm text-[#1E3A5F] hover:underline font-medium"
                  >
                    Criar nova conta administradora
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setModoLogin(true)}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Já tem conta? <span className="text-[#1E3A5F] hover:underline font-medium">Fazer login</span>
                  </button>
                )}
              </div>
            )}
          </form>

          <p className="text-center text-xs text-slate-400">
            Em caso de problemas, entre em contato com o administrador do sistema.
          </p>
        </div>
      </div>
    </div>
  )
}
