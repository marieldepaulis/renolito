import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/contratos/[token]
 *
 * Returns the full contract content for the public signing page.
 * Identified by signing_token (not the contract's DB id).
 * Uses admin client — caller is unauthenticated.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase  = createAdminClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select(`
      id, status, expires_at, custom_clauses, notes,
      signed_by_party_at, signed_by_producer_at,
      artist_applications(guest_name, guest_email),
      technician_applications(user_id,
        profiles:user_id(full_name, avatar_url)
      ),
      projects(title, project_types(name),
        organizations(name, city)
      ),
      sessions(title, scheduled_date, start_time)
    `)
    .eq('signing_token', token)
    .maybeSingle()

  if (!contract) {
    return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 })
  }

  if (contract.expires_at && new Date(contract.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'Este enlace de firma ha expirado.' },
      { status: 410 },
    )
  }

  if (contract.status === 'cancelled' || contract.status === 'rejected') {
    return NextResponse.json(
      { error: 'Este contrato ya no está disponible.' },
      { status: 410 },
    )
  }

  const artistApp    = contract.artist_applications as unknown as { guest_name: string; guest_email: string } | null
  const techApp      = contract.technician_applications as unknown as {
    profiles: { full_name: string; avatar_url: string | null } | null
  } | null
  const project      = contract.projects as unknown as {
    title: string
    project_types: { name: string } | null
    organizations: { name: string; city: string | null } | null
  } | null
  const session      = contract.sessions as unknown as {
    title: string; scheduled_date: string; start_time: string | null
  } | null

  const partyName = artistApp?.guest_name
    ?? techApp?.profiles?.full_name
    ?? 'Firmante'

  return NextResponse.json({
    status:               contract.status,
    already_signed:       contract.signed_by_party_at !== null,
    producer_signed:      contract.signed_by_producer_at !== null,
    party_name:           partyName,
    project_title:        project?.title ?? '',
    project_type:         project?.project_types?.name ?? '',
    organization_name:    project?.organizations?.name ?? '',
    organization_city:    project?.organizations?.city ?? '',
    session_title:        session?.title ?? null,
    session_date:         session?.scheduled_date ?? null,
    session_start_time:   session?.start_time ?? null,
    custom_clauses:       contract.custom_clauses,
    notes:                contract.notes,
  })
}
