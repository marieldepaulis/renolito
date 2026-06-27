import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const Schema = z.object({
  name:          z.string().min(2).max(200),
  bio:           z.preprocess(v => v === '' ? null : v, z.string().max(1000).nullable().optional()),
  city:          z.preprocess(v => v === '' ? null : v, z.string().max(100).nullable().optional()),
  website_url:   z.preprocess(v => v === '' ? null : v, z.string().url().nullable().optional()),
  instagram_url: z.preprocess(v => v === '' ? null : v, z.string().url().nullable().optional()),
})

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  let body: z.infer<typeof Schema>
  try { body = Schema.parse(await request.json()) }
  catch (e: unknown) {
    const msg = e instanceof z.ZodError ? e.errors[0]?.message : 'Datos inválidos.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Sin organización.' }, { status: 403 })
  if (!['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Solo el owner o admin puede editar la configuración.' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('organizations')
    .update({
      name:          body.name,
      bio:           body.bio          ?? null,
      city:          body.city         ?? null,
      website_url:   body.website_url  ?? null,
      instagram_url: body.instagram_url ?? null,
    })
    .eq('id', membership.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
