import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const Schema = z.object({
  offer_id:      z.string().uuid(),
  full_name:     z.string().min(2).max(200),
  email:         z.string().email(),
  cover_note:    z.preprocess((v) => v === '' ? null : v, z.string().max(3000).nullable().optional()),
  proposed_rate: z.preprocess((v) => (v === '' || v == null) ? null : Number(v), z.number().positive().nullable().optional()),
  portfolio_url: z.preprocess((v) => v === '' ? null : v, z.string().url().nullable().optional()),
  cv_url:        z.preprocess((v) => v === '' ? null : v, z.string().url().nullable().optional()),
})

export async function POST(request: Request) {
  let body: z.infer<typeof Schema>
  try { body = Schema.parse(await request.json()) }
  catch (e: unknown) {
    const msg = e instanceof z.ZodError ? e.errors[0]?.message : 'Datos inválidos.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify offer exists and is open
  const { data: offer } = await admin
    .from('job_offers')
    .select('id, organization_id, status, max_applicants')
    .eq('id', body.offer_id)
    .eq('status', 'open')
    .maybeSingle()

  if (!offer) return NextResponse.json({ error: 'Esta oferta ya no está disponible.' }, { status: 404 })

  const o = offer as unknown as { id: string; organization_id: string; max_applicants: number | null }

  // Check if applicant already applied (by email)
  const { data: existing } = await admin
    .from('staff_applications')
    .select('id')
    .eq('job_offer_id', body.offer_id)
    .eq('email', body.email.toLowerCase())
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Ya enviaste una postulación para este puesto.' }, { status: 409 })

  // Check max applicants
  if (o.max_applicants) {
    const { count } = await admin
      .from('staff_applications')
      .select('id', { count: 'exact', head: true })
      .eq('job_offer_id', body.offer_id)
    if ((count ?? 0) >= o.max_applicants) {
      return NextResponse.json({ error: 'Este puesto ya alcanzó el límite de postulantes.' }, { status: 409 })
    }
  }

  const { error } = await admin.from('staff_applications').insert({
    job_offer_id:    body.offer_id,
    organization_id: o.organization_id,
    full_name:       body.full_name,
    email:           body.email.toLowerCase(),
    cover_note:      body.cover_note ?? null,
    proposed_rate:   body.proposed_rate ?? null,
    portfolio_url:   body.portfolio_url ?? null,
    cv_url:          body.cv_url ?? null,
  })

  if (error) {
    // Table may not exist yet — migrate 003 needed
    if (error.message.includes('staff_applications')) {
      return NextResponse.json({ error: 'El sistema de postulaciones está en mantenimiento. Intentá más tarde.' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
