import { useState } from 'react'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogoMarca } from '@/components/LogoMarca'
import { atualizarSenha } from '@/lib/auth'
import { validarNovaSenha } from '@/lib/validacaoSenha'

interface RedefinirSenhaPageProps {
  /** Chamado após a senha ser redefinida com sucesso (ex.: encerrar sessão e voltar ao login). */
  onSenhaRedefinida: () => void | Promise<void>
}

/** Tela do fluxo "Esqueci a senha": o usuário chega pelo link do e-mail (sessão de recuperação). */
export function RedefinirSenhaPage({ onSenhaRedefinida }: RedefinirSenhaPageProps) {
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const invalido = validarNovaSenha(senha, confirmacao)
    if (invalido) {
      setErro(invalido)
      return
    }
    setErro(null)
    setSalvando(true)
    try {
      await atualizarSenha(senha)
      await onSenhaRedefinida()
    } catch (err) {
      console.error('Erro ao redefinir senha:', err)
      setErro('Não foi possível redefinir a senha. O link pode ter expirado — peça um novo na tela de login.')
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <LogoMarca size={56} alt="Plena" />
          <div className="text-center">
            <span className="text-xl font-semibold text-slate-900">CORH</span>
            <p className="text-sm text-slate-500">Controle Operacional e de RH</p>
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Redefinir senha</h2>
          <p className="text-slate-500 text-sm">Escolha sua nova senha de acesso</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="nova-senha" className="text-slate-700 text-sm font-medium">
              Nova senha
            </Label>
            <div className="relative">
              <Input
                id="nova-senha"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Mínimo de 6 caracteres"
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

          <div className="space-y-1.5">
            <Label htmlFor="confirmar-senha" className="text-slate-700 text-sm font-medium">
              Confirmar nova senha
            </Label>
            <Input
              id="confirmar-senha"
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Repita a nova senha"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              required
              className="h-11 border-slate-200 focus-visible:ring-[#1E3A5F] focus-visible:ring-1"
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <Button
            type="submit"
            className="w-full h-11 text-sm font-semibold bg-brand-gradient-soft text-white border-0 hover:opacity-95 hover:shadow"
            disabled={salvando}
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar nova senha'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
