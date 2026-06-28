import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SessionDetail } from '@/components/sessions/session-detail'

export const metadata: Metadata = { title: 'Sesión' }

interface Props { params: Promise<{ projectId: string; sessionId: string }> }

export default async function SessionDetailPage({ params }: Props) {
  const { projectId, sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const _col = /^[0-9a-f-]{36}$/i.test(projectId) ? 'id' : 'slug'
  const { data: project } = await supabase
    .from('projects').select('id, title').eq(_col, projectId).single()
  if (!project) notFound()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, scheduled_date, start_time, end_time, location, location_address, internal_notes, status')
    .eq('id', sessionId).eq('project_id', project.id).single()
  if (!session) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/projects/${projectId}`} className="hover:text-foreground">{project.title}</Link>
          <span>/</span>
          <Link href={`/projects/${projectId}/sesiones`} className="hover:text-foreground">Sesiones</Link>
          <span>/</span>
          <span>{session.title}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{session.title}</h1>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <SessionDetail
          projectId={projectId}
          session={session as Parameters<typeof SessionDetail>[0]['session']}
          backHref={`/projects/${projectId}/sesiones`}
        />
      </div>
    </div>
  )
}
