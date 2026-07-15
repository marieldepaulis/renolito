import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

interface Ctx { params: Promise<{ projectId: string; sessionId: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PostSchema = z.object({
  name:                z.string().min(1).max(200),
  email:               z.preprocess((v) => v === '' ? null : v, z.string().email().nullable().optional()),
  role:                z.preprocess((v) => v === '' ? null : v, z.string().max(100).nullable().optional()),
  notes:               z.preprocess((v) => v === '' ? null : v, z.string().max(500).nullable().optional()),
  production_staff_id: z.string().uuid().nullable().optional(),
})

async function resolveProject(projectId: string) {
  const admin = createAdminClient()
  const col = UUID_RE.test(projectId) ? 'id' : 'slug'
  const { data } = await admin.from('projects').select('id, organization_id').eq(col, projectId).single()
  return data as { id: string; organization_id: string } | null
}

async function verifyMembership(orgId: string, userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('organization_members').select('role')
    .eq('organization_id', orgId).eq('user_id', userId)
    .not('accepted_at', 'is', null).maybeSingle()
  return !!data
}

export async function GET(_req: Request, { params }: Ctx) {
  const { projectId, sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const project = await resolveProject(projectId)
  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })
  if (!(await verifyMembership(project.organization_id, user.id))) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('session_staff')
    .select('id, name, email, role, notes, production_staff_id, created_at')
    .eq('session_id', sessionId)
    .eq('project_id', project.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: Ctx) {
  const { projectId, sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  let body: z.infer<typeof PostSchema>
  try { body = PostSchema.parse(await request.json()) }
  catch (e: unknown) {
    const msg = e instanceof z.ZodError ? e.errors[0]?.message : 'Datos inválidos.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const project = await resolveProject(projectId)
  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })
  if (!(await verifyMembership(project.organization_id, user.id))) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('session_staff')
    .insert({
      session_id: sessionId,
      project_id: project.id,
      production_staff_id: body.production_staff_id ?? null,
      name: body.name,
      email: body.email ?? null,
      role: body.role ?? null,
      notes: body.notes ?? null,
    })
    .select('id, name, email, role, notes, production_staff_id, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
