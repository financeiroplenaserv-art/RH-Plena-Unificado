/** Mensagem de validação da nova senha (fluxo "Esqueci a senha"), ou null se válida. */
export function validarNovaSenha(senha: string, confirmacao: string): string | null {
  if (senha.length < 6) return 'A senha deve ter pelo menos 6 caracteres'
  if (senha !== confirmacao) return 'As senhas não conferem'
  return null
}
