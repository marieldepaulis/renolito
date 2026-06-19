import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const BodySchema = z.object({
  name:    z.string().min(2).max(150),
  country: z.string().length(2),
  city:    z.string().min(2).max(100),
})

export async function POST(request: Request) {
  // 1. Verify the user is authenticated (server-side, no RLS issues)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  // 2. Validate body
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
  }

  // 3. Use admin client — bypasses RLS, we already verified the user above
  const admin = createAdminClient()

  // 4. Ensure the profile row exists (trigger may not have fired on first signup)
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!existingProfile) {
    await admin.from('profiles').insert({
      id:        user.id,
      email:     user.email ?? '',
      full_name: (user.user_metadata?.full_name as string | undefined)
                 ?? user.email?.split('@')[0]
                 ?? '',
    })
  }

  // 5. Check the user doesn't already have an org
  const { data: existing } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Ya tienes una organización.' }, { status: 409 })
  }

  // 6. Create the organization
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name:     body.name,
      country:  body.country,
      city:     body.city,
      owner_id: user.id,
    })
    .select('id')
    .single()

  if (orgError) {
    console.error('[onboarding] org insert:', orgError.message)
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  // 7. Create the owner membership (trigger should do this, but we do it
  //    explicitly to guarantee it even if the trigger didn't fire)
  const { error: memberError } = await admin
    .from('organization_members')
    .upsert({
      organization_id: org.id,
      user_id:         user.id,
      role:            'owner',
      accepted_at:     new Date().toISOString(),
    }, { onConflict: 'organization_id,user_id' })

  if (memberError) {
    console.error('[onboarding] member insert:', memberError.message)
    // Org was created — roll it back to keep data consistent
    await admin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, organization_id: org.id })
}
