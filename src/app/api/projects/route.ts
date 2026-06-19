import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const BodySchema = z.object({
  organization_id:            z.string().uuid(),
  project_type_id:            z.string().uuid(),
  title:                      z.string().min(1).max(200),
  description:                z.string().max(1000).optional().nullable(),
  start_date:                 z.string().optional().nullable(),
  end_date:                   z.string().optional().nullable(),
  max_participants:            z.number().int().positive().optional().nullable(),
  location:                   z.string().max(200).optional().nullable(),
  is_public:                  z.boolean().default(true),
  requires_session_selection: z.boolean().default(false),
})

export async function POST(request: Request) {
  // 1. Verify auth server-side
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  // 2. Validate body
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  }

  // 3. Verify the user belongs to the organization they're creating under
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', body.organization_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'No perteneces a esta organización.' }, { status: 403 })
  }

  // 4. Insert project with admin client (bypasses RLS, auth already verified above)
  const { data: project, error } = await admin
    .from('projects')
    .insert({
      organization_id:            body.organization_id,
      project_type_id:            body.project_type_id,
      created_by:                 user.id,
      title:                      body.title,
      description:                body.description ?? null,
      start_date:                 body.start_date ?? null,
      end_date:                   body.end_date ?? null,
      max_participants:           body.max_participants ?? null,
      location:                   body.location ?? null,
      is_public:                  body.is_public,
      requires_session_selection: body.requires_session_selection,
      status:                     'draft',
      registration_status:        'closed',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[projects] insert:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: project.id })
}
