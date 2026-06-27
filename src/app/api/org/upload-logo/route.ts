import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'

const BUCKET   = 'logos'
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED  = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  // Get user's organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Sin organización.' }, { status: 403 })
  if (!['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Solo el owner o admin puede cambiar el logo.' }, { status: 403 })
  }

  let formData: FormData
  try { formData = await request.formData() }
  catch { return NextResponse.json({ error: 'Error al leer el archivo.' }, { status: 400 }) }

  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'El archivo supera 5 MB.' }, { status: 413 })
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Formato no permitido. Usá PNG, JPG, WEBP o SVG.' }, { status: 415 })
  }

  const ext  = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1]
  const path = `${membership.organization_id}/${randomUUID()}.${ext}`

  const admin = createAdminClient()

  // Delete previous logo if it exists
  const { data: org } = await admin
    .from('organizations').select('logo_url').eq('id', membership.organization_id).single()
  const prevUrl = (org as unknown as { logo_url: string | null } | null)?.logo_url
  if (prevUrl) {
    const prevPath = prevUrl.split(`/${BUCKET}/`)[1]
    if (prevPath) await admin.storage.from(BUCKET).remove([prevPath])
  }

  // Upload new logo
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    if (uploadError.message.toLowerCase().includes('bucket')) {
      return NextResponse.json({
        error: 'El bucket "logos" no existe todavía. Crealo en Supabase Dashboard → Storage → New bucket (nombre: logos, público: Sí).',
      }, { status: 503 })
    }
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path)
  const logoUrl = publicData.publicUrl

  // Save URL to organization
  await admin.from('organizations').update({ logo_url: logoUrl }).eq('id', membership.organization_id)

  return NextResponse.json({ url: logoUrl }, { status: 200 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id).not('accepted_at', 'is', null).limit(1).maybeSingle()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organizations').select('logo_url').eq('id', membership.organization_id).single()

  const prevUrl = (org as unknown as { logo_url: string | null } | null)?.logo_url
  if (prevUrl) {
    const prevPath = prevUrl.split(`/${BUCKET}/`)[1]
    if (prevPath) await admin.storage.from(BUCKET).remove([prevPath])
  }

  await admin.from('organizations').update({ logo_url: null }).eq('id', membership.organization_id)
  return NextResponse.json({ success: true })
}
