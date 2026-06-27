import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

/**
 * POST /api/inscripcion/[token]/apply
 *
 * Submits a new artist application for a project identified by its
 * public registration_link_token.
 *
 * Uses the admin client (service role) because the applicant is
 * unauthenticated. All authorization is done manually in this handler:
 *   - Token validity
 *   - Registration open flag
 *   - Duplicate prevention (same email per project)
 *
 * On success, queues a confirmation email and returns the access_token
 * so the browser can redirect to the status page.
 */

const BodySchema = z.object({
  // Core identity fields always present
  full_name:           z.string().min(2).max(200),
  email:               z.string().email(),
  phone:               z.string().min(5).max(30),
  city:                z.string().min(2).max(100),
  preferred_session_id: z.string().uuid().optional().nullable(),
  // Presskit PDF (optional — post migration 004)
  presskit_url:         z.preprocess((v) => v === '' ? null : v, z.string().url().nullable().optional()),
  // All other dynamic form answers, keyed by field_key
  answers: z.record(z.string(), z.unknown()),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createAdminClient()

  // 1. Parse body
  let body: z.infer<typeof BodySchema>
  try {
    const raw = await request.json()
    body = BodySchema.parse(raw)
  } catch {
    return NextResponse.json(
      { error: 'Datos del formulario inválidos.' },
      { status: 400 },
    )
  }

  // 2. Resolve project
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, organization_id, registration_open, project_types(name)')
    .eq('registration_link_token', token)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })
  }

  if (!project.registration_open) {
    return NextResponse.json(
      { error: 'Las inscripciones están cerradas.' },
      { status: 403 },
    )
  }

  // 3. Prevent duplicate applications (same email + project)
  const { count: existing } = await supabase
    .from('artist_applications')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('guest_email', body.email.toLowerCase())

  if ((existing ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Ya existe una inscripción con este email para este proyecto.' },
      { status: 409 },
    )
  }

  // 4. Create the application (organization_id auto-filled by DB trigger)
  // Try with presskit_url first; fall back if column not yet added (pre-migration 004)
  let application: { id: string; access_token: string } | null = null
  let appError: unknown = null

  const artistAnswers = body.answers as Record<string, unknown>

  const insertPayload: Record<string, unknown> = {
    project_id:           project.id,
    guest_email:          body.email.toLowerCase(),
    guest_name:           body.full_name,
    preferred_session_id: body.preferred_session_id ?? null,
  }

  // Add music-specific columns if migration 004 has been applied
  if (body.presskit_url)             insertPayload.presskit_url  = body.presskit_url
  if (artistAnswers.musical_genre)   insertPayload.musical_genre = artistAnswers.musical_genre
  if (artistAnswers.member_count)    insertPayload.member_count  = Number(artistAnswers.member_count)
  if (artistAnswers.music_links)     insertPayload.music_links   = artistAnswers.music_links
  if (artistAnswers.band_name)       insertPayload.band_name     = artistAnswers.band_name

  const result = await supabase
    .from('artist_applications')
    .insert(insertPayload)
    .select('id, access_token')
    .single()

  if (result.error && (
    result.error.message.includes('presskit_url') ||
    result.error.message.includes('musical_genre') ||
    result.error.message.includes('band_name')
  )) {
    // Migration 004 not yet applied — retry without the new columns
    const fallback = await supabase
      .from('artist_applications')
      .insert({
        project_id:           project.id,
        guest_email:          body.email.toLowerCase(),
        guest_name:           body.full_name,
        preferred_session_id: body.preferred_session_id ?? null,
      })
      .select('id, access_token')
      .single()
    application = fallback.data
    appError    = fallback.error
  } else {
    application = result.data
    appError    = result.error
  }

  if (appError || !application) {
    console.error('[apply]', (appError as { message?: string } | null)?.message)
    return NextResponse.json(
      { error: 'Error al guardar la inscripción. Inténtalo de nuevo.' },
      { status: 500 },
    )
  }

  // 5. Save all form answers (one row per field)
  //    Include the identity fields as answers too for the producer's view
  const allAnswers: { field_key: string; label: string; value: unknown }[] = [
    { field_key: 'full_name', label: 'Nombre completo', value: body.full_name },
    { field_key: 'email',     label: 'Email',            value: body.email },
    { field_key: 'phone',     label: 'Teléfono',         value: body.phone },
    { field_key: 'city',      label: 'Ciudad',           value: body.city },
    ...Object.entries(body.answers).map(([key, value]) => ({
      field_key: key,
      label:     key, // the client should send the label too; for now key is used
      value,
    })),
  ]

  // Fetch field labels to store accurate snapshots
  const { data: fieldDefs } = await supabase
    .from('form_field_definitions')
    .select('field_key, label')
    .in('field_key', allAnswers.map((a) => a.field_key))

  const labelMap = Object.fromEntries(
    (fieldDefs ?? []).map((f) => [f.field_key, f.label]),
  )

  const answerRows = allAnswers
    .filter((a) => a.value !== undefined && a.value !== null && a.value !== '')
    .map((a) => ({
      application_id: application.id,
      field_key:      a.field_key,
      field_label:    labelMap[a.field_key] ?? a.field_key,
      answer:         a.value as import('@/types/database').Json,
    }))

  if (answerRows.length > 0) {
    await supabase.from('artist_application_answers').insert(answerRows)
  }

  // 6. Queue confirmation email
  await supabase.from('email_notifications').insert({
    organization_id: project.organization_id,
    recipient_email: body.email.toLowerCase(),
    recipient_name:  body.full_name,
    template_name:   'application_received',
    subject:         `Tu inscripción a "${project.title}" ha sido recibida`,
    body_html:       buildConfirmationEmail({
      name:        body.full_name,
      projectTitle: project.title,
      accessToken: application.access_token,
    }),
    metadata: {
      project_id:    project.id,
      application_id: application.id,
    },
  })

  // 7. Write activity log
  await supabase.from('activity_logs').insert({
    organization_id: project.organization_id,
    actor_id:        null, // guest action
    entity_type:     'artist_application',
    entity_id:       application.id,
    action:          'application_submitted',
    metadata:        {
      guest_name:  body.full_name,
      guest_email: body.email,
    },
  })

  return NextResponse.json({
    success:      true,
    access_token: application.access_token,
  })
}

function buildConfirmationEmail({
  name,
  projectTitle,
  accessToken,
}: {
  name: string
  projectTitle: string
  accessToken: string
}): string {
  const statusUrl = `${process.env.NEXT_PUBLIC_APP_URL}/estado/${accessToken}`

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="margin-bottom:8px">Hola, ${name} 👋</h2>
  <p>Tu inscripción al proyecto <strong>${projectTitle}</strong> ha sido recibida correctamente.</p>
  <p>Puedes seguir el estado de tu solicitud en tiempo real usando el siguiente enlace:</p>
  <p style="margin:24px 0">
    <a
      href="${statusUrl}"
      style="background:#18181b;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600"
    >
      Ver estado de mi inscripción
    </a>
  </p>
  <p style="color:#71717a;font-size:14px">
    También puedes copiar este enlace directamente:<br />
    <span style="font-family:monospace;font-size:12px">${statusUrl}</span>
  </p>
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0" />
  <p style="color:#71717a;font-size:12px">
    Si no enviaste esta solicitud, puedes ignorar este email con seguridad.
  </p>
</body>
</html>
  `.trim()
}
