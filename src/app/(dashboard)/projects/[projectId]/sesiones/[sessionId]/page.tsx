import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SessionDetail } from '@/components/sessions/session-detail'
import { SessionExpenses } from '@/components/sessions/session-expenses'
import { SessionStaff } from '@/components/sessions/session-staff'
import type { Expense } from '@/components/sessions/session-expenses'
import type { SessionStaffMember } from '@/components/sessions/session-staff'

export const metadata: Metadata = { title: 'Sesión' }

interface Props { params: Promise<{ projectId: string; sessionId: string }> }

export default async function SessionDetailPage({ params }: Props) {
  const { projectId, sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const UUID_RE = /^[0-9a-f-]{36}$/i
  const col = UUID_RE.test(projectId) ? 'id' : 'slug'
  const { data: project } = await supabase
    .from('projects').select('id, title, organization_id').eq(col, projectId).single()
  if (!project) notFound()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, scheduled_date, start_time, end_time, location, location_address, internal_notes, status')
    .eq('id', sessionId).eq('project_id', project.id).single()
  if (!session) notFound()

  const admin = createAdminClient()

  // Load expenses
  let expenses: Expense[] = []
  try {
    const { data } = await admin
      .from('session_expenses')
      .select('id, category, description, amount, currency, expense_date, created_at')
      .eq('session_id', sessionId)
      .eq('project_id', project.id)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
    expenses = (data ?? []) as Expense[]
  } catch { /* migration pending */ }

  // Load session staff assignments
  let sessionStaff: SessionStaffMember[] = []
  try {
    const { data } = await admin
      .from('session_staff')
      .select('id, name, email, role, notes, production_staff_id, created_at')
      .eq('session_id', sessionId)
      .eq('project_id', project.id)
      .order('created_at')
    sessionStaff = (data ?? []) as SessionStaffMember[]
  } catch { /* migration pending */ }

  // Load production_staff roster for the org (to offer as quick-pick)
  let staffOptions: { id: string; full_name: string; email: string; speciality: string | null }[] = []
  try {
    const org = project as unknown as { organization_id: string }
    const { data } = await admin
      .from('production_staff')
      .select('id, full_name, email, speciality')
      .eq('organization_id', org.organization_id)
      .eq('status', 'active')
      .order('full_name')
    staffOptions = (data ?? []) as typeof staffOptions
  } catch { /* migration pending */ }

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

      {/* Session info + edit/delete */}
      <div className="rounded-lg border bg-card p-6">
        <SessionDetail
          projectId={projectId}
          session={session as Parameters<typeof SessionDetail>[0]['session']}
          backHref={`/projects/${projectId}/sesiones`}
        />
      </div>

      {/* Staff asignado */}
      <div className="rounded-lg border bg-card p-6">
        <SessionStaff
          projectId={projectId}
          sessionId={session.id}
          initial={sessionStaff}
          staffOptions={staffOptions}
        />
      </div>

      {/* Expenses */}
      <div className="rounded-lg border bg-card p-6">
        <SessionExpenses
          projectId={projectId}
          sessionId={session.id}
          initial={expenses}
        />
      </div>
    </div>
  )
}
