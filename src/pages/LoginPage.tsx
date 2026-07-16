import { useState } from 'react'
import { Loader2, Eye, EyeOff, ShieldCheck, Building2, BarChart3, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LoginPageProps {
  onLogin: (email: string, senha: string) => Promise<void>
  loading?: boolean
}

export function LoginPage({ onLogin, loading = false }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onLogin(email, senha)
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Lado esquerdo — Branding / Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 text-white overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#2563eb]">
        {/* Elementos decorativos sutis */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-12 -left-12 w-64 h-64 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white/5" />

        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/logo_plena_cab.jpg"
            alt="Plena"
            className="h-10 w-auto rounded-lg object-contain bg-white/10 p-1"
          />
          <span className="text-xl font-semibold tracking-tight">CORH</span>
        </div>

        <div className="relative z-10 space-y-8 max-w-lg">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold leading-tight">
              CORH
            </h1>
            <p className="text-2xl font-light text-blue-100">
              Controle Operacional e de RH
            </p>
            <p className="text-slate-300 text-lg max-w-md">
              Gestão unificada de colaboradores, ocorrências, uniformes, benefícios e muito mais em um só lugar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <ShieldCheck className="w-5 h-5 mt-0.5 text-blue-300" />
              <div>
                <p className="font-medium text-sm">Seguro</p>
                <p className="text-xs text-slate-300">Dados protegidos com criptografia</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <Building2 className="w-5 h-5 mt-0.5 text-blue-300" />
              <div>
                <p className="font-medium text-sm">Unificado</p>
                <p className="text-xs text-slate-300">Todos os módulos integrados</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <BarChart3 className="w-5 h-5 mt-0.5 text-blue-300" />
              <div>
                <p className="font-medium text-sm">Estratégico</p>
                <p className="text-xs text-slate-300">Dados para decisões de RH</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <Users className="w-5 h-5 mt-0.5 text-blue-300" />
              <div>
                <p className="font-medium text-sm">Colaborativo</p>
                <p className="text-xs text-slate-300">Toda a equipe conectada</p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-400">
          © {new Date().getFullYear()} CORH — Plena. Todos os direitos reservados.
        </p>
      </div>

      {/* Lado direito — Formulário */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md space-y-8">
          {/* Header mobile */}
          <div className="lg:hidden flex flex-col items-center justify-center gap-4 mb-8">
            <img
              src="/logo_plena_cab.jpg"
              alt="Plena"
              className="h-12 w-auto rounded-lg object-contain"
            />
            <div className="text-center">
              <span className="text-xl font-semibold text-slate-900">CORH</span>
              <p className="text-sm text-slate-500">Controle Operacional e de RH</p>
            </div>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-900">
              Bem-vindo de volta
            </h2>
            <p className="text-slate-500 text-sm">
              Digite seu e-mail e senha para acessar o sistema
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
              className="w-full h-11 text-sm font-medium hover:bg-[#152b4a]"
              disabled={loading}
              style={{ backgroundColor: '#1E3A5F' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400">
            Em caso de problemas, entre em contato com o administrador do sistema.
          </p>
        </div>
      </div>
    </div>
  )
}
