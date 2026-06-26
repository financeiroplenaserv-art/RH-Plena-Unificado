import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || ''
const key = process.env.VITE_SUPABASE_ANON_KEY || ''

const supabase = createClient(url, key)

async function main() {
  const { data, error } = await supabase.from('departamentos').select('*').order('nome')
  if (error) {
    console.error('Erro:', error)
    return
  }
  console.log('Total:', data?.length)
  data?.forEach((d: { id: string; nome: string; nome_curto: string | null; status: string }) => {
    console.log(`${d.id} | ${d.nome} | ${d.nome_curto || 'NULL'} | ${d.status}`)
  })
}

main()
