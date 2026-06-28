import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

interface Ctx { params: Promise<{ sessionId: string }> }

const PostSchema = z.object({
  role_name:      z.string().min(1).max(100),
  user_id:        z.string().uuid().nullable().optional(),
  external_name:  z.preprocess((v) => v === '' ? null : v, z.string().max(200).nullable().optional()),
  external_email: z.preprocess((v) => v === '' ? null : v, z.string().email().nullable().optional()),
  agreed_rate:    z.preprocess((v) => (v === '' || v == null) ? null : Number(v), z.number().positive().nullable().optional()),
  rate_currency:  z.string().max(3).default('EUR'),
  notes:          z.preprocess((v) => v === '' ? null : v, z.string().max(1000).nullable().optional()),
})

async function getSessionOrg(sessionId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('sessions').select('organization_id').eq('id', sessionId).single()
  return (data as unknown as { organization_id: string } | null)?.organization_id ?? null
}

async function verifyMembership(orgId: string, userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('organization_members').select('role')
    .eq('organization_id', orgId).eq('user_id', userId)
    .not('accepted_at', 'is', null).maybeSingle()
  return !!data
}

export async function GET(_req: Request, { params }: Ctx) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const orgId = await getSessionOrg(sessionId)
  if (!orgId) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 })
  if (!(await verifyMembership(orgId, user.id))) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('session_crew')
    .select('id, role_name, user_id, external_name, external_email, agreed_rate, rate_currency, notes, profiles(full_name, email)')
    .eq('session_id', sessionId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: Ctx) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  let body: z.infer<typeof PostSchema>
  try { body = PostSchema.parse(await request.json()) }
  catch (e: unknown) {
    const msg = e instanceof z.ZodError ? e.errors[0]?.message : 'Datos inválidos.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  if (!body.user_id && !body.external_name) {
    return NextResponse.json({ error: 'Ingresá el nombre o seleccioná un usuario.' }, { status: 400 })
  }

  const orgId = await getSessionOrg(sessionId)
  if (!orgId) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 })
  if (!(await verifyMembership(orgId, user.id))) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('session_crew')
    .insert({ session_id: sessionId, organization_id: orgId, ...body })
    .select('id, role_name, user_id, external_name, external_email, agreed_rate, rate_currency, notes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
