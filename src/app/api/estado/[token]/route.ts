import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/estado/[token]
 *
 * Returns the public-safe status data for a specific application,
 * identified by its access_token.
 *
 * If the producer has enabled hide_status_from_applicants, the
 * real status is masked as 'pending' in the response so the
 * applicant only sees "En revisión".
 *
 * Uses the admin client because the caller is unauthenticated.
 * Never returns internal notes or sensitive producer data.
 */

const STATUS_LABELS: Record<string, string> = {
  pending:       'En revisión',
  pre_approved:  'Preaprobado/a',
  contract_sent: 'Contrato enviado — revisa tu email',
  confirmed:     'Confirmado/a',
  rejected:      'No seleccionado/a en esta convocatoria',
  waitlisted:    'En lista de espera',
  cancelled:     'Inscripción cancelada',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: application } = await supabase
    .from('artist_applications')
    .select(`
      id, status, submitted_at, cancelled_at,
      guest_name, guest_email,
      projects!project_id(
        title, hide_status_from_applicants,
        project_types(name)
      ),
      sessions!assigned_session_id(title, scheduled_date)
    `)
    .eq('access_token', token)
    .maybeSingle()

  if (!application) {
    return NextResponse.json(
      { error: 'Inscripción no encontrada.' },
      { status: 404 },
    )
  }

  const project = application.projects as unknown as {
    title: string
    hide_status_from_applicants: boolean
    project_types: { name: string } | null
  } | null

  const assignedSession = application.sessions as unknown as {
    title: string
    scheduled_date: string
  } | null

  const hiddenStatus = project?.hide_status_from_applicants
  const visibleStatus = hiddenStatus ? 'pending' : application.status

  return NextResponse.json({
    applicant_name:    application.guest_name,
    project_title:     project?.title ?? '',
    project_type:      project?.project_types?.name ?? '',
    status:            visibleStatus,
    status_label:      STATUS_LABELS[visibleStatus] ?? 'En revisión',
    submitted_at:      application.submitted_at,
    assigned_session:  assignedSession
      ? {
          title:          assignedSession.title,
          scheduled_date: assignedSession.scheduled_date,
        }
      : null,
  })
}
