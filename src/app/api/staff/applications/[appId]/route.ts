import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Ctx { params: Promise<{ appId: string }> }

export async function POST(request: Request, { params }: Ctx) {
  const { appId } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  // Read status from form data or JSON
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

  // Verify ownership via org membership
  const { data: app } = await admin
    .from('staff_applications')
    .select('organization_id')
    .eq('id', appId)
    .single()

  if (!app) return NextResponse.json({ error: 'Postulación no encontrada.' }, { status: 404 })

  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', (app as unknown as { organization_id: string }).organization_id)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  await admin.from('staff_applications').update({ status }).eq('id', appId)

  // Redirect back to the staff page (form POST)
  const referer = request.headers.get('referer') ?? '/dashboard'
  return NextResponse.redirect(referer, { status: 303 })
}

export async function PATCH(request: Request, { params }: Ctx) {
  return POST(request, { params })
}
