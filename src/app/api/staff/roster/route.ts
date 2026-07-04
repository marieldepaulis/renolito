import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Sin organización.' }, { status: 403 })

  const body = await req.json()
  const { full_name, email, speciality, phone } = body
  if (!full_name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Nombre y email son obligatorios.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('production_staff')
    .insert({
      organization_id: membership.organization_id,
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      speciality: speciality?.trim() || null,
      phone: phone?.trim() || null,
      source: 'manual',
      status: 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
