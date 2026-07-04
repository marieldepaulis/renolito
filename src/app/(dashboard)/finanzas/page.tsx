import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Receipt, TrendingDown, FolderOpen } from 'lucide-react'

export const metadata: Metadata = { title: 'Finanzas' }

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount)
}

export default async function FinanzasGlobalPage() {
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

  const orgId = membership.organization_id

  // All projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, slug, status')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  const allProjects = projects ?? []

  // All session expenses across all org projects
  const admin = createAdminClient()
  type Expense = { project_id: string; amount: number; currency: string; session_id: string }
  let expenses: Expense[] = []
  try {
    const projectIds = allProjects.map(p => p.id)
    if (projectIds.length > 0) {
      const { data } = await admin
        .from('session_expenses')
        .select('project_id, amount, currency, session_id')
        .in('project_id', projectIds)
      expenses = (data ?? []) as Expense[]
    }
  } catch {
    // Migration not yet applied
  }

  // Roll up by project
  type ProjectRow = {
    id: string; title: string; slug: string | null; status: string
    totals: Record<string, number>
    expenseCount: number
  }

  const projectMap = new Map<string, ProjectRow>()
  for (const p of allProjects) {
    projectMap.set(p.id, { ...p, slug: (p as unknown as { slug?: string }).slug ?? null, totals: {}, expenseCount: 0 })
  }
  for (const e of expenses) {
    const row = projectMap.get(e.project_id)
    if (!row) continue
    row.totals[e.currency] = (row.totals[e.currency] ?? 0) + Number(e.amount)
    row.expenseCount++
  }

  const rows = [...projectMap.values()]
  const projectsWithExpenses = rows.filter(r => r.expenseCount > 0)

  // Global totals per currency
  const globalTotals: Record<string, number> = {}
  for (const e of expenses) {
    globalTotals[e.currency] = (globalTotals[e.currency] ?? 0) + Number(e.amount)
  }

  const totalExpenses = expenses.length
  const mainCurrency = Object.keys(globalTotals).length === 1 ? Object.keys(globalTotals)[0] : null

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de gastos de todos los proyectos de la productora.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="size-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total gastos</p>
          </div>
          {Object.keys(globalTotals).length === 0 ? (
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          ) : Object.entries(globalTotals).map(([cur, amt]) => (
            <p key={cur} className="text-2xl font-bold">{fmt(amt, cur)}</p>
          ))}
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="size-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Proyectos con gastos</p>
          </div>
          <p className="text-2xl font-bold">{projectsWithExpenses.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">de {allProjects.length} proyectos</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="size-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total partidas</p>
          </div>
          <p className="text-2xl font-bold">{totalExpenses}</p>
          <p className="text-xs text-muted-foreground mt-0.5">gastos registrados</p>
        </div>
      </div>

      {/* Per-project table */}
      {allProjects.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">No hay proyectos todavía.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Desglose por proyecto</h2>
          </div>
          <div className="divide-y">
            {rows.map(p => {
              const publicId = p.slug ?? p.id
              const hasExpenses = p.expenseCount > 0
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/projects/${publicId}/finanzas`}
                      className="text-sm font-medium hover:underline"
                    >
                      {p.title}
                    </Link>
                    {p.status !== 'active' && (
                      <span className="ml-2 text-xs text-muted-foreground capitalize">{p.status}</span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {hasExpenses ? (
                      <>
                        {Object.entries(p.totals).map(([cur, amt]) => (
                          <p key={cur} className="text-sm font-semibold">{fmt(amt, cur)}</p>
                        ))}
                        <p className="text-xs text-muted-foreground">{p.expenseCount} partida{p.expenseCount !== 1 ? 's' : ''}</p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin gastos</span>
                    )}
                  </div>
                  <Link
                    href={`/projects/${publicId}/finanzas`}
                    className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    Ver detalle
                  </Link>
                </div>
              )
            })}
          </div>
          {mainCurrency && rows.length > 0 && (
            <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3">
              <span className="text-sm font-semibold">Total general</span>
              <span className="text-base font-bold">{fmt(globalTotals[mainCurrency], mainCurrency)}</span>
            </div>
          )}
        </div>
      )}

      {expenses.length === 0 && allProjects.length > 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <Receipt className="mx-auto size-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No hay gastos registrados en ningún proyecto.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Añade gastos desde el detalle de cada sesión dentro de un proyecto.
          </p>
        </div>
      )}
    </div>
  )
}
