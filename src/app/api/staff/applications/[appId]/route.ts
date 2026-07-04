import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Ctx { params: Promise<{ appId: string }> }

async function handleUpdate(request: Request, { params }: Ctx) {
  const { appId } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  // Accept JSON or form data
  let status: string | null = null
  const ct = request.headers.get('content-type') ?? ''
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const fd = await request.formData()
    status = fd.get('status') as string | null
  } else {
    try { status = (await request.json()).status } catch { /* ignore */ }
  }

  const allowed = ['pending', 'reviewing', 'accepted', 'rejected']
  if (!status || !allowed.includes(status)) {
    return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch the application + org for auth check
  const { data: app } = await admin
    .from('staff_applications')
    .select('id, organization_id, full_name, email, applicant_user_id, job_offer_id, job_offers(speciality)')
    .eq('id', appId)
    .single()

  if (!app) return NextResponse.json({ error: 'Postulación no encontrada.' }, { status: 404 })

  const orgId = (app as unknown as { organization_id: string }).organization_id

  // Verify caller belongs to the org
  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  // Update the application status
  await admin.from('staff_applications').update({ status }).eq('id', appId)

  // Auto-promote to production_staff when accepted
  if (status === 'accepted') {
    const a = app as unknown as {
      full_name: string
      email: string
      applicant_user_id: string | null
      id: string
      job_offers: { speciality: string | null } | null
    }
    await admin
      .from('production_staff')
      .upsert(
        {
          organization_id: orgId,
          user_id:         a.applicant_user_id ?? null,
          full_name:       a.full_name,
          email:           a.email,
          speciality:      a.job_offers?.speciality ?? null,
          source:          'staff_application',
          source_id:       a.id,
          status:          'active',
        },
        { onConflict: 'organization_id,email', ignoreDuplicates: false }
      )
  }

  // Form POST: redirect back; PATCH/JSON: return JSON
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const referer = request.headers.get('referer') ?? '/dashboard'
    return NextResponse.redirect(referer, { status: 303 })
  }
  return NextResponse.json({ ok: true, status })
}

export async function POST(request: Request, ctx: Ctx)  { return handleUpdate(request, ctx) }
export async function PATCH(request: Request, ctx: Ctx) { return handleUpdate(request, ctx) }
