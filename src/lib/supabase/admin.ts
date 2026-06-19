import { createClient } from '@supabase/supabase-js'

// ⚠️  SERVICE ROLE — bypasses ALL RLS. Server-only. Never expose to the browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
    },
  )
}
