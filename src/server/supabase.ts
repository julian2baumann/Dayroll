import { createClient } from '@supabase/supabase-js'

const required = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`)
  }
  return value
}

export function createSupabaseServiceClient(options: { url?: string; serviceKey?: string } = {}) {
  const supabaseUrl = options.url ?? process.env.SUPABASE_URL
  const serviceKey = options.serviceKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  return createClient(
    required(supabaseUrl, 'SUPABASE_URL'),
    required(serviceKey, 'SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
