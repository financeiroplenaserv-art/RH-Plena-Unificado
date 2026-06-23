import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY precisam estar configurados no .env')
}

export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseKey || ''
)

declare module '@supabase/supabase-js' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SupabaseClient<Database> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from(table: string): any
  }
}
