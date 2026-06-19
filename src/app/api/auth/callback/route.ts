import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase Auth callback handler.
 *
 * Called after:
 *   - Email/password confirmation (new sign-ups)
 *   - Magic link login
 *   - OAuth provider login (Google, etc.)
 *   - Password reset flow
 *
 * Exchanges the `code` param from the URL for a session cookie.
 * Always redirects after handling — never renders HTML.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]),
          )
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback]', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_exchange_failed`)
  }

  // Redirect to the originally requested protected page, or dashboard
  const safeNext = next.startsWith('/') ? next : '/dashboard'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
