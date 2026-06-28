import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CalendarDays, MapPin, Clock, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Sesiones' }

interface Props {
  params: Promise<{ projectId: string }>
}

const SESSION_STATUS: Record<string, { label: string; class: string }> = {
  scheduled:   { label: 'Programada',   class: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'En curso',     class: 'bg-yellow-100 text-yellow-700' },
  completed:   { label: 'Completada',   class: 'bg-emerald-100 text-emerald-700' },
  cancelled:   { label: 'Cancelada',    class: 'bg-red-100 text-red-600' },
}

export default async function SesionesPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const _col = /^[0-9a-f-]{36}$/i.test(projectId) ? 'id' : 'slug'
  const { data: project } = await supabase
    .from('projects')
    .select('id, title')
    .eq(_col, projectId)
    .single()

  if (!project) notFound()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, scheduled_date, start_time, end_time, location, status')
    .eq('project_id', projectId)
    .order('scheduled_date')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">
              {project.title}
            </Link>
            <span>/</span>
            <span>Sesiones</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sesiones</h1>
          <p className="text-sm text-muted-foreground">
            {sessions?.length ?? 0} sesiones planificadas
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/sesiones/nueva`}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          Nueva sesión
        </Link>
      </div>

      {!sessions || sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <CalendarDays className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No hay sesiones creadas para este proyecto.
          </p>
          <Link
            href={`/projects/${projectId}/sesiones/nueva`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Añadir primera sesión
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const status = SESSION_STATUS[session.status]
            return (
              <Link
                key={session.id}
                href={`/projects/${projectId}/sesiones/${session.id}`}
                className="flex items-start gap-5 rounded-lg border bg-card p-5 transition-colors hover:bg-accent"
              >
                {/* Date block */}
                <div className="flex w-14 flex-col items-center rounded-md border bg-muted py-2 text-center">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {new Date(session.scheduled_date).toLocaleString('es', { month: 'short' })}
                  </span>
                  <span className="text-2xl font-bold leading-none">
                    {new Date(session.scheduled_date).getDate()}
                  </span>
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{session.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.class}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {session.start_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {session.start_time.slice(0, 5)}
                        {session.end_time ? ` – ${session.end_time.slice(0, 5)}` : ''}
                      </span>
                    )}
                    {session.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {session.location}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
