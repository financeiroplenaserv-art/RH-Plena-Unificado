import { supabase } from '@/lib/supabase'

export async function loginComEmail(email: string, senha: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw error
  return data
}

export async function cadastrarComEmail(email: string, senha: string) {
  const { data, error } = await supabase.auth.signUp({ email, password: senha })
  if (error) throw error
  return data
}

export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function recuperarSenha(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  })
  if (error) throw error
}
