import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProjectCollaborators } from '@/components/projects/project-collaborators'
import type { Collaborator } from '@/components/projects/project-collaborators'

export const metadata: Metadata = { title: 'Colaboradores' }

interface Props { params: Promise<{ projectId: string }> }

export default async function ColaboradoresPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const col = UUID_RE.test(projectId) ? 'id' : 'slug'
  const { data: project } = await supabase
    .from('projects').select('id, title').eq(col, projectId).single()
  if (!project) notFound()

  const admin = createAdminClient()
  let collaborators: Collaborator[] = []
  try {
    const { data } = await admin
      .from('project_collaborators')
      .select('id, name, email, role, is_internal, notes, added_at')
      .eq('project_id', project.id)
      .order('added_at')
    collaborators = (data ?? []) as Collaborator[]
  } catch { /* migration pending */ }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/projects/${projectId}`} className="hover:text-foreground">{project.title}</Link>
          <span>/</span>
          <span>Colaboradores</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Colaboradores del proyecto</h1>
        <p className="text-sm text-muted-foreground">
          Equipo extendido e internos vinculados a este proyecto.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <ProjectCollaborators projectId={projectId} initial={collaborators} />
      </div>
    </div>
  )
}
