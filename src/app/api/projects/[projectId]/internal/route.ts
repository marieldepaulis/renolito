import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

interface Ctx { params: Promise<{ projectId: string }> }

const PatchSchema = z.object({
  production_notes: z.preprocess((v) => v === '' ? null : v, z.string().max(10000).nullable()),
})

export async function PATCH(request: Request, { params }: Ctx) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  let body: z.infer<typeof PatchSchema>
  try { body = PatchSchema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 }) }

  const admin = createAdminClient()
  const { data: project } = await admin
    .from('projects').select('organization_id').eq('id', projectId).single()
  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })

  const { data: membership } = await admin
    .from('organization_members').select('role')
    .eq('organization_id', (project as unknown as { organization_id: string }).organization_id)
    .eq('user_id', user.id).not('accepted_at', 'is', null).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

  const { error } = await admin
    .from('projects')
    .update({ production_notes: body.production_notes, updated_at: new Date().toISOString() })
    .eq('id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
