import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency } from '@/lib/utils'
import { StaffPublicView } from '@/components/staff/staff-public-view'

interface Props { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('projects').select('title').eq('registration_link_token', token).maybeSingle()
  return { title: data ? `Convocatoria técnica · ${(data as unknown as { title: string }).title}` : 'Convocatoria técnica' }
}

export default async function StaffPublicPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  // Accept slug (post-migration 002) or legacy UUID token
  let project: unknown = null
  const bySlug = await admin
    .from('projects').select('id, title, description, project_types(name)')
    .eq('slug', token).maybeSingle()
  if (bySlug.data) {
    project = bySlug.data
  } else {
    const byToken = await admin
      .from('projects').select('id, title, description, project_types(name)')
      .eq('registration_link_token', token).maybeSingle()
    project = byToken.data
  }

  if (!project) notFound()

  const p = project as unknown as {
    id: string; title: string; description: string | null
    project_types: { name: string } | null
  }

  const { data: offers } = await admin
    .from('job_offers')
    .select(`
      id, title, description, speciality,
      is_paid, estimated_rate, rate_unit, rate_currency,
      is_barter, barter_description,
      required_date, location, max_applicants
    `)
    .eq('project_id', p.id)
    .eq('status', 'open')
    .order('created_at')

  return (
    <StaffPublicView
      project={{ id: p.id, title: p.title, description: p.description, typeName: p.project_types?.name ?? null }}
      offers={(offers ?? []) as Parameters<typeof StaffPublicView>[0]['offers']}
    />
  )
}
