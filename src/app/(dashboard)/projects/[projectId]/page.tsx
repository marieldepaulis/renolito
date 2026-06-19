import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, Briefcase, CalendarDays, FileText, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { CopyLinkButton } from '@/components/projects/copy-link-button'

export const metadata: Metadata = { title: 'Proyecto' }

interface Props {
  params: Promise<{ projectId: string }>
}

const NAV = [
  { label: 'Inscripciones',     href: 'inscripciones', icon: Users },
  { label: 'Staff técnico',     href: 'staff',          icon: Briefcase },
  { label: 'Sesiones',          href: 'sesiones',       icon: CalendarDays },
  { label: 'Contratos',         href: 'contratos',      icon: FileText },
]

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select(`
      id, title, description, status, registration_open,
      registration_link_token, hide_status_from_applicants,
      created_at, updated_at,
      project_types(name, icon)
    `)
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  const [artistCount, techCount, sessionCount] = await Promise.all([
    supabase
      .from('artist_applications')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
    supabase
      .from('job_offers')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
  ])

  const registrationUrl = `/inscripcion/${project.registration_link_token}`
  const type = (project.project_types as unknown as { name: string } | null)?.name ?? '—'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/projects" className="hover:text-foreground">
              Proyectos
            </Link>
            <span>/</span>
            <span>{project.title}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {type} · Actualizado{' '}
            {formatDate(project.updated_at, { day: '2-digit', month: 'short' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              project.status === 'active'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {project.registration_open ? 'Inscripción abierta' : 'Inscripción cerrada'}
          </span>
        </div>
      </div>

      {/* Registration link */}
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <span className="flex-1 truncate font-mono text-sm text-muted-foreground">
          {typeof window === 'undefined'
            ? registrationUrl
            : `${window.location.origin}${registrationUrl}`}
        </span>
        <CopyLinkButton url={registrationUrl} />
        <Link
          href={registrationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-4" />
        </Link>
      </div>

      {/* Sub-navigation */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {NAV.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={`/projects/${projectId}/${href}`}
            className="flex flex-col items-center gap-3 rounded-lg border bg-card p-5 text-center transition-colors hover:bg-accent"
          >
            <Icon className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{artistCount.count ?? 0}</p>
          <p className="text-sm text-muted-foreground">Inscripciones</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{techCount.count ?? 0}</p>
          <p className="text-sm text-muted-foreground">Ofertas de trabajo</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{sessionCount.count ?? 0}</p>
          <p className="text-sm text-muted-foreground">Sesiones</p>
        </div>
      </div>

      {project.description && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-2 text-sm font-medium">Descripción</h2>
          <p className="text-sm text-muted-foreground">{project.description}</p>
        </div>
      )}
    </div>
  )
}

