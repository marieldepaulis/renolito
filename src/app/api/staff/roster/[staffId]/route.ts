import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Ctx { params: Promise<{ staffId: string }> }

async function getOrgId(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()
  return data?.organization_id ?? null
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { staffId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sin organización.' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('production_staff')
    .update({
      status:     body.status,
      speciality: body.speciality,
      phone:      body.phone,
    })
    .eq('id', staffId)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { staffId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sin organización.' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('production_staff')
    .delete()
    .eq('id', staffId)
    .eq('organization_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
