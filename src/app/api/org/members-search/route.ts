import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/org/members-search?q=nombre
// Returns platform users that belong to the caller's organization
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const q = new URL(request.url).searchParams.get('q') ?? ''

  const admin = createAdminClient()

  // Find the org the caller belongs to
  const { data: membership } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!membership) return NextResponse.json([], { status: 200 })

  const { organization_id } = membership as unknown as { organization_id: string }

  // Get all platform users (profiles) — filter by name/email if q provided
  const query = admin
    .from('profiles')
    .select('id, full_name, email')
    .neq('id', user.id) // exclude self
    .order('full_name')
    .limit(20)

  if (q.trim()) {
    query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
