import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

interface Ctx { params: Promise<{ offerId: string }> }

const PatchSchema = z.object({
  status:             z.enum(['open', 'filled', 'closed']).optional(),
  title:              z.string().min(2).max(200).optional(),
  speciality:         z.string().min(2).max(100).optional(),
  description:        z.preprocess((v) => v === '' ? null : v, z.string().max(2000).nullable().optional()),
  barter_description: z.preprocess((v) => v === '' ? null : v, z.string().max(500).nullable().optional()),
  required_date:      z.preprocess((v) => v === '' ? null : v, z.string().nullable().optional()),
  max_applicants:     z.preprocess((v) => v == null ? null : Number(v), z.number().int().positive().nullable().optional()),
})

export async function PATCH(request: Request, { params }: Ctx) {
  const { offerId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: offer } = await admin
    .from('job_offers').select('organization_id').eq('id', offerId).single()
  if (!offer) return NextResponse.json({ error: 'Oferta no encontrada.' }, { status: 404 })

  const { data: membership } = await admin
    .from('organization_members').select('role')
    .eq('organization_id', (offer as unknown as { organization_id: string }).organization_id)
    .eq('user_id', user.id).not('accepted_at', 'is', null).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const { error } = await admin
    .from('job_offers')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', offerId)

  if (error) {
    console.error('[job-offers PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { offerId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: offer } = await admin
    .from('job_offers').select('organization_id').eq('id', offerId).single()
  if (!offer) return NextResponse.json({ error: 'Oferta no encontrada.' }, { status: 404 })

  const { data: membership } = await admin
    .from('organization_members').select('role')
    .eq('organization_id', (offer as unknown as { organization_id: string }).organization_id)
    .eq('user_id', user.id).not('accepted_at', 'is', null).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const { error } = await admin.from('job_offers').delete().eq('id', offerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
