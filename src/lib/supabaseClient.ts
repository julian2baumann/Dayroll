import { createClient } from '@supabase/supabase-js'

const mode = import.meta.env.MODE
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? (mode === 'test' ? 'http://localhost:54321' : undefined)
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? (mode === 'test' ? 'test-anon-key' : undefined)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
