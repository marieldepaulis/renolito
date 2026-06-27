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

async function getOrgId(projectId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('projects').select('organization_id').eq('id', projectId).single()
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
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const orgId = await getOrgId(projectId)
  if (!orgId) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })
  if (!(await verifyMembership(orgId, user.id))) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_documents')
    .select('id, title, url, doc_type, notes, created_at')
    .eq('project_id', projectId)
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

  const orgId = await getOrgId(projectId)
  if (!orgId) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })
  if (!(await verifyMembership(orgId, user.id))) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_documents')
    .insert({ project_id: projectId, organization_id: orgId, ...body })
    .select('id, title, url, doc_type, notes, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
