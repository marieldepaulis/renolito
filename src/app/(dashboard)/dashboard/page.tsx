import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FolderOpen, Users, Briefcase, Plus, ArrowRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const t        = await getTranslations('Dashboard')
  const tStatus  = await getTranslations('Status')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(id, name)')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const orgId   = membership.organization_id
  const orgName = (membership.organizations as unknown as { name: string } | null)?.name ?? ''

  const [projectsRes, pendingArtistsRes, pendingTechRes, recentActivityRes] =
    await Promise.all([
      supabase
        .from('projects')
        .select('id, title, status, registration_open, created_at, slug')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('artist_applications')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'pending'),
      supabase
        .from('technician_applications')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'pending'),
      supabase
        .from('activity_logs')
        .select('id, entity_type, action, metadata, created_at, actor_id, profiles(full_name)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(6),
    ])

  const projects       = projectsRes.data ?? []
  const pendingArtists = pendingArtistsRes.count ?? 0
  const pendingTech    = pendingTechRes.count ?? 0
  const activity       = recentActivityRes.data ?? []

  const stats = [
    {
      label: t('activeProjects'),
      value: projects.filter((p) => p.status === 'active').length,
      icon:  FolderOpen,
      href:  '/projects',
    },
    {
      label: t('pendingArtists'),
      value: pendingArtists,
      icon:  Users,
      href:  '/projects',
    },
    {
      label: t('pendingStaff'),
      value: pendingTech,
      icon:  Briefcase,
      href:  '/bolsa-de-trabajo',
    },
  ]

  const statusLabel: Record<string, string> = {
    draft:     tStatus('draft'),
    active:    tStatus('active'),
    completed: tStatus('completed'),
    archived:  tStatus('archived'),
  }

  const statusColor: Record<string, string> = {
    draft:     'text-muted-foreground',
    active:    'text-emerald-600',
    completed: 'text-blue-600',
    archived:  'text-zinc-400',
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{orgName}</p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          {t('newProject')}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-4 rounded-lg border bg-card p-5 transition-colors hover:bg-accent"
          >
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Icon className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent projects */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-medium">{t('recentProjects')}</h2>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {t('viewAll')} <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="divide-y">
            {projects.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <FolderOpen className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t('noProjects')}</p>
                <Link
                  href="/projects/new"
                  className="text-sm font-medium text-foreground underline underline-offset-4"
                >
                  {t('createFirst')}
                </Link>
              </div>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${(project as unknown as { slug?: string }).slug ?? project.id}`}
                  className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-accent"
                >
                  <div>
                    <p className="text-sm font-medium">{project.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(project.created_at, {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium ${statusColor[project.status]}`}>
                    {statusLabel[project.status]}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Activity log */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-medium">{t('recentActivity')}</h2>
          </div>
          <div className="divide-y">
            {activity.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <p className="text-sm text-muted-foreground">{t('noActivity')}</p>
              </div>
            ) : (
              activity.map((log) => {
                const actor = (log.profiles as unknown as { full_name: string } | null)
                  ?.full_name ?? t('system')
                const meta = log.metadata as Record<string, string> | null
                return (
                  <div key={log.id} className="px-5 py-3.5">
                    <p className="text-sm">
                      <span className="font-medium">{actor}</span>{' '}
                      <span className="text-muted-foreground">
                        {log.action.replace(/_/g, ' ')}
                        {meta?.to ? ` → ${meta.to}` : ''}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(log.created_at, {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
