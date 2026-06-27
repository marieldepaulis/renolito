import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Ctx { params: Promise<{ sessionId: string; crewId: string }> }

export async function DELETE(_req: Request, { params }: Ctx) {
  const { sessionId, crewId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: session } = await admin.from('sessions').select('organization_id').eq('id', sessionId).single()
  if (!session) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const { data: m } = await admin
    .from('organization_members').select('role')
    .eq('organization_id', (session as unknown as { organization_id: string }).organization_id)
    .eq('user_id', user.id).not('accepted_at', 'is', null).maybeSingle()
  if (!m) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const { error } = await admin.from('session_crew').delete().eq('id', crewId).eq('session_id', sessionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
