import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

interface Ctx { params: Promise<{ projectId: string; sessionId: string }> }

const PatchSchema = z.object({
  title:            z.string().min(2).max(200).optional(),
  scheduled_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_time:       z.preprocess((v) => v === '' ? null : v, z.string().nullable().optional()),
  end_time:         z.preprocess((v) => v === '' ? null : v, z.string().nullable().optional()),
  location:         z.preprocess((v) => v === '' ? null : v, z.string().max(200).nullable().optional()),
  location_address: z.preprocess((v) => v === '' ? null : v, z.string().max(300).nullable().optional()),
  internal_notes:   z.preprocess((v) => v === '' ? null : v, z.string().max(2000).nullable().optional()),
  status:           z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
})

export async function PATCH(request: Request, { params }: Ctx) {
  const { projectId, sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  let body: z.infer<typeof PatchSchema>
  try { body = PatchSchema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 }) }

  const admin = createAdminClient()
  const { data: project } = await admin
    .from('projects').select('organization_id').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })

  const { data: membership } = await admin
    .from('organization_members').select('role')
    .eq('organization_id', (project as unknown as { organization_id: string }).organization_id)
    .eq('user_id', user.id).not('accepted_at', 'is', null).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const { data, error } = await admin
    .from('sessions')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', sessionId).eq('project_id', projectId)
    .select('id').single()

  if (error) { console.error('[sessions PATCH]', error.message); return NextResponse.json({ error: error.message }, { status: 500 }) }
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { projectId, sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: project } = await admin
    .from('projects').select('organization_id').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })

  const { data: membership } = await admin
    .from('organization_members').select('role')
    .eq('organization_id', (project as unknown as { organization_id: string }).organization_id)
    .eq('user_id', user.id).not('accepted_at', 'is', null).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const { error } = await admin.from('sessions').delete().eq('id', sessionId).eq('project_id', projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
