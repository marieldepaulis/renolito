import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

interface Ctx { params: Promise<{ projectId: string }> }

const PatchSchema = z.object({
  title:       z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status:      z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
})

async function getVerifiedMembership(projectId: string, userId: string) {
  const admin = createAdminClient()
  const { data: project } = await admin
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .single()
  if (!project) return null

  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .maybeSingle()
  if (!membership) return null

  return { organizationId: project.organization_id, role: membership.role }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const membership = await getVerifiedMembership(projectId, user.id)
  if (!membership) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('projects')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .select('id, title, status')
    .single()

  if (error) {
    console.error('[projects PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, project: data })
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const membership = await getVerifiedMembership(projectId, user.id)
  if (!membership) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) {
    console.error('[projects DELETE]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
