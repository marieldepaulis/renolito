import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate } from '@/lib/utils'
import { Clock, Search, CheckCircle2, XCircle, Download, ExternalLink } from 'lucide-react'

export const metadata: Metadata = { title: 'Mis postulaciones' }

const TECH_STATUS: Record<string, { label: string; cls: string }> = {
  pending:       { label: 'Pendiente',        cls: 'bg-zinc-100 text-zinc-700' },
  pre_approved:  { label: 'Pre-aprobado',     cls: 'bg-yellow-100 text-yellow-700' },
  contract_sent: { label: 'Contrato enviado', cls: 'bg-blue-100 text-blue-700' },
  confirmed:     { label: 'Confirmado',       cls: 'bg-emerald-100 text-emerald-700' },
  rejected:      { label: 'Rechazado',        cls: 'bg-red-100 text-red-700' },
  waitlisted:    { label: 'En espera',        cls: 'bg-orange-100 text-orange-700' },
  cancelled:     { label: 'Cancelado',        cls: 'bg-zinc-100 text-zinc-400' },
}

const STAFF_STATUS: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pending:   { label: 'Pendiente',   cls: 'bg-zinc-100 text-zinc-600',       icon: Clock },
  reviewing: { label: 'En revisión', cls: 'bg-blue-100 text-blue-700',       icon: Search },
  accepted:  { label: 'Aceptado',    cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected:  { label: 'Rechazado',   cls: 'bg-red-100 text-red-600',         icon: XCircle },
}

const STATUS_MSG: Record<string, string> = {
  pending:   'Tu postulación fue recibida y está en espera de revisión.',
  reviewing: 'La producción está revisando tu perfil. Pronto tendrás novedades.',
  accepted:  '¡Felicitaciones! Tu postulación fue aceptada. Te contactarán pronto.',
  rejected:  'En esta ocasión eligieron otro perfil. Seguí postulándote a otras oportunidades.',
}

export default async function MisPostulacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .single()

  // 1. Technician applications (platform users applying to internal offers)
  const { data: techApps } = await supabase
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

  // 2. Staff applications (public job board submissions)
  const admin = createAdminClient()
  const email = profile?.email?.toLowerCase() ?? ''

  const { data: byUser } = await admin
    .from('staff_applications')
    .select(`id, full_name, email, cover_note, proposed_rate, portfolio_url, cv_url, status, created_at,
      job_offers(id, title, speciality, projects(id, title))`)
    .eq('applicant_user_id', user.id)
    .order('created_at', { ascending: false })

  const { data: byEmail } = await admin
    .from('staff_applications')
    .select(`id, full_name, email, cover_note, proposed_rate, portfolio_url, cv_url, status, created_at,
      job_offers(id, title, speciality, projects(id, title))`)
    .eq('email', email)
    .is('applicant_user_id', null)
    .order('created_at', { ascending: false })

  const seen = new Set<string>()
  const staffApps = [...(byUser ?? []), ...(byEmail ?? [])].filter(a => {
    if (seen.has(a.id)) return false; seen.add(a.id); return true
  })

  const hasTech  = (techApps?.length ?? 0) > 0
  const hasStaff = staffApps.length > 0
  const hasAny   = hasTech || hasStaff

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mis postulaciones</h1>
        <p className="text-sm text-muted-foreground">Seguí el estado de tus postulaciones a ofertas de trabajo.</p>
      </div>

      {!hasAny ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">
            Aún no te postulaste a ninguna oferta. Explorá la{' '}
            <a href="/bolsa-de-trabajo" className="underline">bolsa de trabajo</a>.
          </p>
        </div>
      ) : (
        <>
          {/* Bolsa de trabajo (staff_applications) */}
          {hasStaff && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Postulaciones a la bolsa de trabajo</h2>
              <div className="space-y-3">
                {staffApps.map(app => {
                  const a    = app as unknown as {
                    id: string; full_name: string; email: string; cover_note: string | null
                    proposed_rate: number | null; portfolio_url: string | null; cv_url: string | null
                    status: string; created_at: string
                    job_offers: { id: string; title: string; speciality: string; projects: { title: string } | null } | null
                  }
                  const cfg = STAFF_STATUS[a.status] ?? STAFF_STATUS.pending
                  const Icon = cfg.icon
                  return (
                    <div key={a.id} className="rounded-lg border bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xs text-muted-foreground">{a.job_offers?.projects?.title ?? '—'}</p>
                          <p className="font-medium leading-tight">{a.job_offers?.title ?? 'Oferta'}</p>
                          {a.job_offers?.speciality && (
                            <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {a.job_offers.speciality}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
                            <Icon className="size-3" /> {cfg.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                        </div>
                      </div>
                      <p className={`rounded-md px-3 py-2 text-xs border ${
                        a.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        a.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                        a.status === 'reviewing' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-zinc-50 text-muted-foreground border-zinc-100'
                      }`}>
                        {STATUS_MSG[a.status] ?? STATUS_MSG.pending}
                      </p>
                      {(a.portfolio_url || a.cv_url) && (
                        <div className="flex gap-2">
                          {a.portfolio_url && (
                            <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors">
                              <ExternalLink className="size-3.5" /> Portfolio enviado
                            </a>
                          )}
                          {a.cv_url && (
                            <a href={a.cv_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors">
                              <Download className="size-3.5" /> CV enviado
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Technician applications */}
          {hasTech && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold">Postulaciones internas de crew</h2>
              <div className="space-y-3">
                {(techApps ?? []).map(app => {
                  const offer = app.job_offers as unknown as {
                    title: string; is_paid: boolean; compensation_amount: number | null
                    projects: { title: string; project_types: { name: string } | null } | null
                    organizations: { name: string; city: string | null } | null
                  } | null
                  const s = TECH_STATUS[app.status] ?? TECH_STATUS.pending
                  return (
                    <div key={app.id} className="rounded-lg border bg-card p-4 space-y-1.5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <p className="font-medium">{offer?.title}</p>
                          <p className="text-sm text-muted-foreground">{offer?.organizations?.name} · {offer?.organizations?.city}</p>
                          <p className="text-xs text-muted-foreground">{offer?.projects?.title} · {offer?.projects?.project_types?.name}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(app.submitted_at)}</span>
                        </div>
                      </div>
                      {app.cover_letter && <p className="text-xs text-muted-foreground line-clamp-2">{app.cover_letter}</p>}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
