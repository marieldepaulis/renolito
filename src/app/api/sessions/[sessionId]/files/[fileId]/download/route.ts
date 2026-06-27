import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Ctx { params: Promise<{ sessionId: string; fileId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { sessionId, fileId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const admin = createAdminClient()

  // Verify access: org member OR assigned crew
  const { data: session } = await admin.from('sessions').select('organization_id').eq('id', sessionId).single()
  if (!session) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })

  const orgId = (session as unknown as { organization_id: string }).organization_id

  const { data: m } = await admin.from('organization_members').select('role')
    .eq('organization_id', orgId).eq('user_id', user.id).not('accepted_at', 'is', null).maybeSingle()

  if (!m) {
    const { data: c } = await admin.from('session_crew').select('id')
      .eq('session_id', sessionId).eq('user_id', user.id).maybeSingle()
    if (!c) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })
  }

  const { data: fileRow } = await admin.from('session_files').select('storage_path')
    .eq('id', fileId).eq('session_id', sessionId).single()
  if (!fileRow) return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 })

  const storagePath = (fileRow as unknown as { storage_path: string }).storage_path
  const { data, error } = await admin.storage.from('session-files').createSignedUrl(storagePath, 60)
  if (error || !data) return NextResponse.json({ error: 'No se pudo generar el enlace.' }, { status: 500 })

  return NextResponse.redirect(data.signedUrl)
}
