import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, Briefcase, CalendarDays, FileText, ExternalLink, Lock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { CopyLinkButton } from '@/components/projects/copy-link-button'
import { ProjectActions } from '@/components/projects/project-actions'

export const metadata: Metadata = { title: 'Proyecto' }

interface Props {
  params: Promise<{ projectId: string }>
}

const NAV = [
  { label: 'Inscripciones',     href: 'inscripciones',    icon: Users },
  { label: 'Staff técnico',     href: 'staff',            icon: Briefcase },
  { label: 'Sesiones',          href: 'sesiones',         icon: CalendarDays },
  { label: 'Contratos',         href: 'contratos',        icon: FileText },
  { label: 'Gestión Interna',   href: 'gestion-interna',  icon: Lock, private: true },
]

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const selectFields = `id, title, description, status, registration_open,
    registration_link_token, slug, hide_status_from_applicants,
    created_at, updated_at, project_types(name, icon)`

  let project: unknown = null
  {
    const col = UUID_RE.test(projectId) ? 'id' : 'slug'
    const { data } = await supabase.from('projects').select(selectFields).eq(col, projectId).single()
    project = data
  }

  if (!project) notFound()

  const resolvedId = (project as unknown as { id: string }).id
  const [artistCount, techCount, sessionCount] = await Promise.all([
    supabase
      .from('artist_applications')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', resolvedId),
    supabase
      .from('job_offers')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', resolvedId),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', resolvedId),
  ])

  const p = project as unknown as {
    id: string; title: string; description: string | null; status: string
    registration_open: boolean; registration_link_token: string; slug?: string | null
    hide_status_from_applicants: boolean; created_at: string; updated_at: string
    project_types: { name: string; icon?: string } | null
  }

  // Use slug if available (post-migration 002), otherwise fall back to UUID token
  const publicId       = p.slug ?? p.registration_link_token
  const registrationUrl = `/inscripcion/${publicId}`
  const staffUrl        = `/staff/${publicId}`
  const type = p.project_types?.name ?? '—'

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
            <span>{p.title}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>
          <p className="text-sm text-muted-foreground">
            {type} · Actualizado{' '}
            {formatDate(p.updated_at, { day: '2-digit', month: 'short' })}
          </p>
        </div>
        <ProjectActions
          projectId={projectId}
          title={p.title}
          description={p.description ?? null}
          status={p.status as 'draft' | 'active' | 'completed' | 'cancelled'}
        />
      </div>

      {/* Registration links — artists + staff */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Link para artistas</p>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
            <span className="flex-1 truncate font-mono text-xs text-muted-foreground">{registrationUrl}</span>
            <CopyLinkButton url={registrationUrl} />
            <Link href={registrationUrl} target="_blank" rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground">
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Link para staff técnico</p>
          <div className="flex items-center gap-2 rounded-lg border bg-amber-50 px-3 py-2.5">
            <span className="flex-1 truncate font-mono text-xs text-muted-foreground">{staffUrl}</span>
            <CopyLinkButton url={staffUrl} />
            <Link href={staffUrl} target="_blank" rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground">
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {NAV.map(({ label, href, icon: Icon, private: isPrivate }) => (
          <Link
            key={href}
            href={`/projects/${projectId}/${href}`}
            className={`flex flex-col items-center gap-3 rounded-lg border p-5 text-center transition-colors hover:bg-accent ${
              isPrivate ? 'border-dashed bg-muted/20' : 'bg-card'
            }`}
          >
            <Icon className={`size-6 ${isPrivate ? 'text-amber-600' : 'text-muted-foreground'}`} />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </div>

      {/* Quick stats — clickable */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { count: artistCount.count ?? 0,  label: 'Inscripciones',      href: 'inscripciones' },
          { count: techCount.count ?? 0,    label: 'Ofertas de trabajo',  href: 'staff' },
          { count: sessionCount.count ?? 0, label: 'Sesiones',            href: 'sesiones' },
        ].map(({ count, label, href }) => (
          <Link key={href} href={`/projects/${projectId}/${href}`}
            className="group rounded-lg border bg-card p-4 text-center transition-colors hover:bg-accent hover:border-primary/20">
            <p className="text-2xl font-bold group-hover:text-primary transition-colors">{count}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </Link>
        ))}
      </div>

      {p.description && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-2 text-sm font-medium">Descripción</h2>
          <p className="text-sm text-muted-foreground">{p.description}</p>
        </div>
      )}
    </div>
  )
}

