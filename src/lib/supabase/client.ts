import { createBrowserClient } from '@supabase/ssr'

// We intentionally omit the Database generic here so that
// cross-table join queries (nested selects) don't return `never`.
// Run `supabase gen types typescript` against your project to get
// proper relationship types and restore the generic.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
