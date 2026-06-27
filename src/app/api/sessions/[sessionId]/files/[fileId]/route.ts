import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Ctx { params: Promise<{ sessionId: string; fileId: string }> }

export async function DELETE(_req: Request, { params }: Ctx) {
  const { sessionId, fileId } = await params
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

  // Get storage path before deleting DB row
  const { data: fileRow } = await admin
    .from('session_files').select('storage_path').eq('id', fileId).eq('session_id', sessionId).single()

  const { error } = await admin.from('session_files').delete().eq('id', fileId).eq('session_id', sessionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Remove from storage (best effort)
  if (fileRow) {
    await admin.storage.from('session-files').remove([(fileRow as unknown as { storage_path: string }).storage_path])
  }

  return NextResponse.json({ success: true })
}
