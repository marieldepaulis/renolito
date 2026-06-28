import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NewSessionForm } from '@/components/sessions/new-session-form'

export const metadata: Metadata = { title: 'Nueva sesión' }

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function NuevaSesionPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const _col = /^[0-9a-f-]{36}$/i.test(projectId) ? 'id' : 'slug'
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, organization_id')
    .eq(_col, projectId)
    .single()

  if (!project) notFound()

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', (project as unknown as { organization_id: string }).organization_id)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!membership) redirect('/dashboard')

  const backHref = `/projects/${projectId}/sesiones`

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/projects/${projectId}`} className="hover:text-foreground">
            {project.title}
          </Link>
          <span>/</span>
          <Link href={backHref} className="hover:text-foreground">
            Sesiones
          </Link>
          <span>/</span>
          <span>Nueva sesión</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva sesión</h1>
        <p className="text-sm text-muted-foreground">
          Añade una sesión de trabajo o grabación a este proyecto
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <NewSessionForm projectId={projectId} backHref={backHref} />
      </div>
    </div>
  )
}
