import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/inscripcion/[token]
 *
 * Returns the public data needed to render the registration form:
 *   - Project title, type, description
 *   - Whether registration is open
 *   - All form fields for this project type (common + type-specific)
 *   - Sessions available for preference selection
 *
 * Uses admin client because the caller is unauthenticated.
 * Returns only the data safe to expose publicly — no internal IDs
 * beyond what the form needs, and no other registrations' data.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 1. Resolve project — accept slug (post-migration 002) or legacy UUID token
  let project: unknown = null
  let projectError: unknown = null

  // Try slug first, then fall back to registration_link_token
  const bySlug = await supabase
    .from('projects')
    .select(`id, title, description, registration_open, hide_status_from_applicants, project_types(id, name, slug)`)
    .eq('slug', token)
    .maybeSingle()

  if (bySlug.data) {
    project = bySlug.data
  } else {
    const byToken = await supabase
      .from('projects')
      .select(`id, title, description, registration_open, hide_status_from_applicants, project_types(id, name, slug)`)
      .eq('registration_link_token', token)
      .maybeSingle()
    project = byToken.data
    projectError = byToken.error
  }

  if (projectError || !project) {
    return NextResponse.json(
      { error: 'Proyecto no encontrado' },
      { status: 404 },
    )
  }

  const p = project as unknown as {
    id: string; title: string; description: string | null
    registration_open: boolean; hide_status_from_applicants: boolean
    project_types: { id: string; name: string; slug: string }
  }

  if (!p.registration_open) {
    return NextResponse.json(
      { error: 'Las inscripciones para este proyecto están cerradas.' },
      { status: 403 },
    )
  }

  const projectType = p.project_types

  // 2. Fetch form fields: common fields + type-specific fields
  const { data: fields } = await supabase
    .from('form_field_definitions')
    .select(
      'field_key, label, field_type, placeholder, helper_text, is_required, options, display_order',
    )
    .is('organization_id', null) // system fields only for now
    .or(`project_type_id.is.null,project_type_id.eq.${projectType.id}`)
    .order('display_order')

  // 3. Fetch sessions for preference selection
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, scheduled_date, start_time')
    .eq('project_id', p.id)
    .eq('status', 'scheduled')
    .order('scheduled_date')

  return NextResponse.json({
    project: {
      title:       p.title,
      description: p.description,
      type:        projectType,
    },
    fields:   fields ?? [],
    sessions: sessions ?? [],
  })
}
