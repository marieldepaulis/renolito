import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Ctx { params: Promise<{ sessionId: string }> }

async function getOrgId(sessionId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('sessions').select('organization_id').eq('id', sessionId).single()
  return (data as unknown as { organization_id: string } | null)?.organization_id ?? null
}

async function verifyMembership(orgId: string, userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('organization_members').select('role')
    .eq('organization_id', orgId).eq('user_id', userId)
    .not('accepted_at', 'is', null).maybeSingle()
  return !!data
}

export async function GET(_req: Request, { params }: Ctx) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const orgId = await getOrgId(sessionId)
  if (!orgId) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 })

  // Org members OR assigned crew can list files
  const admin = createAdminClient()
  const isMember = await verifyMembership(orgId, user.id)
  if (!isMember) {
    const { data: crewRow } = await admin
      .from('session_crew').select('id').eq('session_id', sessionId).eq('user_id', user.id).maybeSingle()
    if (!crewRow) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('session_files')
    .select('id, title, storage_path, file_size, mime_type, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Generate signed URLs for each file
  const withUrls = await Promise.all((data ?? []).map(async (f) => {
    const { data: signed } = await admin.storage
      .from('session-files')
      .createSignedUrl(f.storage_path, 3600) // 1h
    return { ...f, url: signed?.signedUrl ?? null }
  }))

  return NextResponse.json(withUrls)
}

export async function POST(request: Request, { params }: Ctx) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const orgId = await getOrgId(sessionId)
  if (!orgId) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 })
  if (!(await verifyMembership(orgId, user.id))) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const title = (formData.get('title') as string | null)?.trim() || null

  if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 })

  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const storagePath = `${orgId}/${sessionId}/${fileName}`

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('session-files')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[session files upload]', uploadError.message)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data, error } = await admin
    .from('session_files')
    .insert({
      session_id:    sessionId,
      organization_id: orgId,
      title:         title ?? file.name,
      storage_path:  storagePath,
      file_size:     file.size,
      mime_type:     file.type,
      uploaded_by:   user.id,
    })
    .select('id, title, storage_path, file_size, mime_type, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: signed } = await admin.storage
    .from('session-files').createSignedUrl(storagePath, 3600)

  return NextResponse.json({ ...data, url: signed?.signedUrl ?? null }, { status: 201 })
}
