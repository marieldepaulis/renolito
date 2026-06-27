import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Ctx { params: Promise<{ projectId: string; docId: string }> }

async function verifyAccess(projectId: string, userId: string) {
  const admin = createAdminClient()
  const { data: project } = await admin.from('projects').select('organization_id').eq('id', projectId).single()
  if (!project) return null
  const orgId = (project as unknown as { organization_id: string }).organization_id
  const { data: m } = await admin
    .from('organization_members').select('role')
    .eq('organization_id', orgId).eq('user_id', userId)
    .not('accepted_at', 'is', null).maybeSingle()
  return m ? orgId : null
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { projectId, docId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const orgId = await verifyAccess(projectId, user.id)
  if (!orgId) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('project_documents').delete().eq('id', docId).eq('project_id', projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
