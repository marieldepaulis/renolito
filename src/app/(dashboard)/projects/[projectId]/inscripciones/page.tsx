import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ApplicationsTable } from '@/components/projects/applications-table'
import { ArtistLinkBanner } from '@/components/projects/artist-link-banner'

export const metadata: Metadata = { title: 'Inscripciones' }

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function InscripcionesPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Accept slug or UUID in the URL param
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const col = UUID_RE.test(projectId) ? 'id' : 'slug'

  let project: { id: string; title: string; organization_id: string; registration_link_token: string; slug?: string | null } | null = null
  {
    const { data } = await supabase
      .from('projects').select('id, title, organization_id, registration_link_token, slug').eq(col, projectId).single()
    project = data
  }

  if (!project) notFound()

  const publicId   = project.slug ?? project.registration_link_token
  const artistLink = `/inscripcion/${publicId}`

  const { data: applications } = await supabase
    .from('artist_applications')
    .select(`
      id, guest_name, guest_email, status,
      submitted_at, assigned_session_id, producer_notes,
      sessions!assigned_session_id(title, scheduled_date)
    `)
    .eq('project_id', project.id)
    .order('submitted_at', { ascending: false })

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, scheduled_date')
    .eq('project_id', project.id)
    .order('scheduled_date')

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <a href={`/projects/${projectId}`} className="hover:text-foreground">
            {project.title}
          </a>
          <span>/</span>
          <span>Inscripciones</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Inscripciones de artistas
        </h1>
        <p className="text-sm text-muted-foreground">
          {applications?.length ?? 0} solicitudes recibidas
        </p>
      </div>

      <ArtistLinkBanner artistLink={artistLink} />

      <ApplicationsTable
        applications={applications ?? []}
        sessions={sessions ?? []}
        projectId={projectId}
      />
    </div>
  )
}
