import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const BodySchema = z.object({
  project_id:        z.string().uuid(),
  title:             z.string().min(2).max(200),
  description:       z.string().min(2).max(2000),
  speciality:        z.string().min(1).max(100),
  is_paid:           z.boolean().default(true),
  is_barter:         z.boolean().default(false),
  estimated_rate:    z.number().positive().optional().nullable(),
  rate_unit:         z.enum(['hour', 'day', 'project', 'session']).optional().nullable(),
  rate_currency:     z.string().length(3).default('EUR'),
  barter_description: z.string().max(500).optional().nullable(),
  max_applicants:    z.number().int().positive().optional().nullable(),
  required_date:     z.string().optional().nullable(),
  location:          z.string().max(200).optional().nullable(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify user is a member of the org that owns this project
  const { data: project } = await admin
    .from('projects')
    .select('organization_id')
    .eq('id', body.project_id)
    .single()

  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })

  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', project.organization_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const { data: offer, error } = await admin
    .from('job_offers')
    .insert({
      organization_id:    project.organization_id,
      project_id:         body.project_id,
      created_by:         user.id,
      title:              body.title,
      description:        body.description,
      speciality:         body.speciality,
      is_paid:            body.is_paid,
      is_barter:          body.is_barter,
      estimated_rate:     body.estimated_rate ?? null,
      rate_unit:          body.rate_unit ?? null,
      rate_currency:      body.rate_currency,
      barter_description: body.barter_description ?? null,
      max_applicants:     body.max_applicants ?? null,
      required_date:      body.required_date ?? null,
      location:           body.location ?? null,
      status:             'open',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[job-offers] insert:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: offer.id })
}
