import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js Middleware — runs on every matching request before rendering.
 *
 * Responsibilities:
 *   1. Refresh the Supabase session (keeps auth cookies alive).
 *   2. Protect dashboard routes: redirect to /login if not authenticated.
 *   3. Redirect already-authenticated users away from auth pages.
 *
 * The session refresh MUST happen here (not just in layouts) because
 * middleware runs before Server Components and can write cookies to
 * both the request and the response via the pattern below.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2]),
          )
        },
      },
    },
  )

  // getUser() validates the session with the Supabase Auth server on
  // every request. This is the only safe way — do NOT use getSession()
  // in middleware because it only reads the cookie without server validation.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Route guards ─────────────────────────────────────────────────

  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/projects') ||
    pathname.startsWith('/bolsa-de-trabajo') ||
    pathname.startsWith('/mi-perfil-tecnico') ||
    pathname.startsWith('/mis-postulaciones') ||
    pathname.startsWith('/perfil') ||
    pathname.startsWith('/configuracion')

  if (isProtectedRoute && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password')

  if (isAuthRoute && user) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *   - _next/static  (static files)
     *   - _next/image   (image optimization)
     *   - favicon.ico
     *   - Common image extensions
     *
     * Public routes (inscripcion, estado, contrato) are intentionally
     * NOT protected here — their API routes use createAdminClient()
     * to validate tokens server-side.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
