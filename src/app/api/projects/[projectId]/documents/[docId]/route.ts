import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Ctx { params: Promise<{ projectId: string; docId: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function verifyAccess(projectId: string, userId: string) {
  const admin = createAdminClient()
  const col = UUID_RE.test(projectId) ? 'id' : 'slug'
  const { data: project } = await admin.from('projects').select('id, organization_id').eq(col, projectId).single()
  if (!project) return null
  const p = project as unknown as { id: string; organization_id: string }
  const { data: m } = await admin
    .from('organization_members').select('role')
    .eq('organization_id', p.organization_id).eq('user_id', userId)
    .not('accepted_at', 'is', null).maybeSingle()
  return m ? { orgId: p.organization_id, uuid: p.id } : null
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { projectId, docId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const proj = await verifyAccess(projectId, user.id)
  if (!proj) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('project_documents').delete().eq('id', docId).eq('project_id', proj.uuid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
