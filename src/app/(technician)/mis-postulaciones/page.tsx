import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mis postulaciones' }

const STATUS_LABELS: Record<string, string> = {
  pending:       'Pendiente',
  pre_approved:  'Pre-aprobado',
  contract_sent: 'Contrato enviado',
  confirmed:     'Confirmado',
  rejected:      'Rechazado',
  waitlisted:    'En espera',
  cancelled:     'Cancelado',
}

const STATUS_COLORS: Record<string, string> = {
  pending:       'bg-zinc-100 text-zinc-700',
  pre_approved:  'bg-yellow-100 text-yellow-700',
  contract_sent: 'bg-blue-100 text-blue-700',
  confirmed:     'bg-emerald-100 text-emerald-700',
  rejected:      'bg-red-100 text-red-700',
  waitlisted:    'bg-orange-100 text-orange-700',
  cancelled:     'bg-zinc-100 text-zinc-400',
}

export default async function MisPostulacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: applications } = await supabase
    .from('technician_applications')
    .select(`
      id, status, cover_letter, proposed_rate, submitted_at,
      job_offers(title, is_paid, compensation_amount,
        projects(title, project_types(name)),
        organizations(name, city)
      )
    `)
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mis postulaciones</h1>
        <p className="text-sm text-muted-foreground">
          Historial de tus postulaciones a ofertas de trabajo técnico
        </p>
      </div>

      {!applications || applications.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">
            Aún no te postulaste a ninguna oferta. Explora la{' '}
            <a href="/bolsa-de-trabajo" className="underline">bolsa de trabajo</a>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const offer = app.job_offers as unknown as {
              title: string
              is_paid: boolean
              compensation_amount: number | null
              projects: { title: string; project_types: { name: string } | null } | null
              organizations: { name: string; city: string | null } | null
            } | null

            return (
              <div key={app.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="font-medium">{offer?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {offer?.organizations?.name} · {offer?.organizations?.city}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {offer?.projects?.title} · {offer?.projects?.project_types?.name}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[app.status] ?? STATUS_COLORS.pending}`}>
                      {STATUS_LABELS[app.status] ?? 'Pendiente'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(app.submitted_at)}
                    </span>
                  </div>
                </div>
                {app.cover_letter && (
                  <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
                    {app.cover_letter}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
