import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// We intentionally omit the Database generic so nested join queries
// don't produce `never` types. Run `supabase gen types typescript`
// to get relationship-aware types and restore the generic.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]),
            )
          } catch {
            // setAll is called from Server Components where cookies
            // cannot be written. The middleware handles session
            // refresh in those cases — this catch is intentional.
          }
        },
      },
    },
  )
}
