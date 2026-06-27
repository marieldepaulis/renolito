import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

interface Ctx { params: Promise<{ projectId: string }> }

const BodySchema = z.object({
  title:            z.string().min(2).max(200),
  scheduled_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  start_time:       z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  end_time:         z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  location:         z.string().max(200).optional().nullable(),
  location_address: z.string().max(300).optional().nullable(),
  internal_notes:   z.string().max(2000).optional().nullable(),
})

export async function POST(request: Request, { params }: Ctx) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: project } = await admin
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .single()

  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })

  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', (project as unknown as { organization_id: string }).organization_id)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const { data: session, error } = await admin
    .from('sessions')
    .insert({
      project_id:       projectId,
      organization_id:  (project as unknown as { organization_id: string }).organization_id,
      title:            body.title,
      scheduled_date:   body.scheduled_date,
      start_time:       body.start_time ?? null,
      end_time:         body.end_time ?? null,
      location:         body.location ?? null,
      location_address: body.location_address ?? null,
      internal_notes:   body.internal_notes ?? null,
      status:           'scheduled',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[sessions POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: session.id })
}
