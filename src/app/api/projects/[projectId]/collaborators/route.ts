import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

interface Ctx { params: Promise<{ projectId: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PostSchema = z.object({
  name:        z.string().min(1).max(200),
  email:       z.string().email('Email inválido'),
  role:        z.string().max(100).default('collaborator'),
  is_internal: z.boolean().default(false),
  notes:       z.preprocess((v) => v === '' ? null : v, z.string().max(500).nullable().optional()),
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
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const project = await resolveProject(projectId)
  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })
  if (!(await verifyMembership(project.organization_id, user.id))) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_collaborators')
    .select('id, name, email, role, is_internal, notes, added_at')
    .eq('project_id', project.id)
    .order('added_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: Ctx) {
  const { projectId } = await params
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

  // If is_internal, try to find user_id by email among org members
  const admin = createAdminClient()
  let linkedUserId: string | null = null
  if (body.is_internal) {
    const { data: profile } = await admin
      .from('profiles').select('id').eq('email', body.email).maybeSingle()
    linkedUserId = (profile as unknown as { id: string } | null)?.id ?? null
  }

  const { data, error } = await admin
    .from('project_collaborators')
    .insert({
      project_id: project.id,
      organization_id: project.organization_id,
      user_id: linkedUserId,
      name: body.name,
      email: body.email,
      role: body.role,
      is_internal: body.is_internal,
      notes: body.notes ?? null,
    })
    .select('id, name, email, role, is_internal, notes, added_at')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Este colaborador ya está añadido.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
