import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({ locale: z.enum(['es', 'en']) })

export async function POST(request: Request) {
  let locale: 'es' | 'en'
  try {
    const body = Body.parse(await request.json())
    locale = body.locale
  } catch {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('locale', locale, {
    path:     '/',
    maxAge:   60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  })
  return response
}
