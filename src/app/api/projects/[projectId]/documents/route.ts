import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

interface Ctx { params: Promise<{ projectId: string }> }

const PostSchema = z.object({
  title:    z.string().min(1).max(200),
  url:      z.string().url('URL inválida'),
  doc_type: z.enum(['contract', 'budget', 'technical', 'rider', 'other']).default('other'),
  notes:    z.preprocess((v) => v === '' ? null : v, z.string().max(1000).nullable().optional()),
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function getOrgAndId(projectId: string): Promise<{ orgId: string; uuid: string } | null> {
  const admin = createAdminClient()
  const col = UUID_RE.test(projectId) ? 'id' : 'slug'
  const { data } = await admin.from('projects').select('id, organization_id').eq(col, projectId).single()
  if (!data) return null
  const d = data as unknown as { id: string; organization_id: string }
  return { orgId: d.organization_id, uuid: d.id }
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
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const proj = await getOrgAndId(projectId)
  if (!proj) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })
  if (!(await verifyMembership(proj.orgId, user.id))) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_documents')
    .select('id, title, url, doc_type, notes, created_at')
    .eq('project_id', proj.uuid)
    .order('created_at', { ascending: false })

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

  const proj = await getOrgAndId(projectId)
  if (!proj) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })
  if (!(await verifyMembership(proj.orgId, user.id))) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_documents')
    .insert({ project_id: proj.uuid, organization_id: proj.orgId, ...body })
    .select('id, title, url, doc_type, notes, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
