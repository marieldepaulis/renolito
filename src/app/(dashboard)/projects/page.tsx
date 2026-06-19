import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Plus, FolderOpen, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Proyectos' }

const STATUS_LABEL: Record<string, string> = {
  draft:     'Borrador',
  active:    'Activo',
  completed: 'Completado',
  archived:  'Archivado',
}

const STATUS_CLASS: Record<string, string> = {
  draft:     'bg-zinc-100 text-zinc-600',
  active:    'bg-emerald-100 text-emerald-700',
  completed: 'bg-blue-100 text-blue-700',
  archived:  'bg-zinc-100 text-zinc-400',
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!membership) redirect('/onboarding')

  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, title, status, registration_open, registration_link_token,
      created_at, updated_at,
      project_types(name, icon)
    `)
    .eq('organization_id', membership.organization_id)
    .order('updated_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            {projects?.length ?? 0} proyectos en tu workspace
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <Plus className="size-4" />
          Nuevo proyecto
        </Link>
      </div>

      {!projects || projects.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-20 text-center">
          <FolderOpen className="size-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium">Sin proyectos todavía</p>
            <p className="text-sm text-muted-foreground">
              Crea tu primer proyecto y genera el link de inscripción
            </p>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            <Plus className="size-4" />
            Crear proyecto
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Proyecto</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Inscripción</th>
                <th className="px-5 py-3 font-medium">Actualizado</th>
                <th className="px-5 py-3 font-medium">Link público</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="transition-colors hover:bg-accent"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium hover:underline"
                    >
                      {project.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {(project.project_types as unknown as { name: string } | null)?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[project.status]}`}
                    >
                      {STATUS_LABEL[project.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`text-xs ${project.registration_open ? 'text-emerald-600' : 'text-muted-foreground'}`}
                    >
                      {project.registration_open ? 'Abierta' : 'Cerrada'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {formatDate(project.updated_at, {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/inscripcion/${project.registration_link_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Ver form <ExternalLink className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
