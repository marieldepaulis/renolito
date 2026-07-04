import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CalendarDays, Receipt } from 'lucide-react'

export const metadata: Metadata = { title: 'Finanzas del proyecto' }

interface Props { params: Promise<{ projectId: string }> }

const CATEGORY_LABEL: Record<string, string> = {
  studio:    'Estudio / local',
  equipment: 'Equipamiento',
  crew:      'Crew / personal',
  transport: 'Transporte',
  catering:  'Catering',
  other:     'Otro',
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount)
}

type Expense = {
  id: string
  category: string
  description: string
  amount: number
  currency: string
  expense_date: string | null
}

type SessionWithExpenses = {
  id: string
  title: string
  scheduled_date: string
  expenses: Expense[]
  total: number
  currency: string
}

export default async function ProjectFinanzasPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const col = UUID_RE.test(projectId) ? 'id' : 'slug'
  const { data: project } = await supabase
    .from('projects').select('id, title').eq(col, projectId).single()
  if (!project) notFound()

  const admin = createAdminClient()

  // All sessions for this project
  const { data: sessionsRaw } = await supabase
    .from('sessions')
    .select('id, title, scheduled_date')
    .eq('project_id', project.id)
    .order('scheduled_date', { ascending: false })

  const sessions = sessionsRaw ?? []

  // All expenses for this project
  let allExpenses: (Expense & { session_id: string })[] = []
  try {
    const { data } = await admin
      .from('session_expenses')
      .select('id, session_id, category, description, amount, currency, expense_date')
      .eq('project_id', project.id)
      .order('expense_date', { ascending: false })
    allExpenses = (data ?? []) as typeof allExpenses
  } catch {
    // Migration not yet applied
  }

  // Group expenses by session
  const expensesBySession = new Map<string, Expense[]>()
  for (const e of allExpenses) {
    if (!expensesBySession.has(e.session_id)) expensesBySession.set(e.session_id, [])
    expensesBySession.get(e.session_id)!.push(e)
  }

  const sessionRows: SessionWithExpenses[] = sessions.map(s => {
    const exps = expensesBySession.get(s.id) ?? []
    const currencies = new Set(exps.map(e => e.currency))
    const dominantCurrency = currencies.size === 1 ? [...currencies][0] : 'EUR'
    return {
      ...s,
      expenses: exps,
      total: exps.reduce((sum, e) => sum + Number(e.amount), 0),
      currency: dominantCurrency,
    }
  })

  // Project-level totals per currency
  const totalsByCurrency: Record<string, number> = {}
  for (const e of allExpenses) {
    totalsByCurrency[e.currency] = (totalsByCurrency[e.currency] ?? 0) + Number(e.amount)
  }

  // Category breakdown across the whole project
  const byCategory: Record<string, number> = {}
  for (const e of allExpenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount)
  }
  const mainCurrency = Object.keys(totalsByCurrency).length === 1
    ? Object.keys(totalsByCurrency)[0]
    : 'EUR'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/projects/${projectId}`} className="hover:text-foreground">{project.title}</Link>
          <span>/</span>
          <span>Finanzas</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Finanzas del proyecto</h1>
      </div>

      {allExpenses.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Receipt className="mx-auto size-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No hay gastos registrados.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Añade gastos desde el detalle de cada sesión.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Total proyecto */}
            <div className="rounded-lg border bg-card p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total gastos proyecto</p>
              {Object.entries(totalsByCurrency).map(([cur, amt]) => (
                <p key={cur} className="text-2xl font-bold">{fmt(amt, cur)}</p>
              ))}
            </div>
            {/* Nº de sesiones con gastos */}
            <div className="rounded-lg border bg-card p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Sesiones con gastos</p>
              <p className="text-2xl font-bold">{sessionRows.filter(s => s.expenses.length > 0).length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">de {sessions.length} sesiones</p>
            </div>
            {/* Media por sesión */}
            {Object.keys(totalsByCurrency).length === 1 && sessions.length > 0 && (
              <div className="rounded-lg border bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Media por sesión</p>
                <p className="text-2xl font-bold">
                  {fmt(totalsByCurrency[mainCurrency] / sessions.filter(s => (expensesBySession.get(s.id) ?? []).length > 0).length || 0, mainCurrency)}
                </p>
              </div>
            )}
          </div>

          {/* Category breakdown */}
          {Object.keys(byCategory).length > 1 && (
            <div className="rounded-lg border bg-card p-5 space-y-3">
              <h2 className="text-sm font-semibold">Desglose por categoría</h2>
              <div className="space-y-2">
                {Object.entries(byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amt]) => {
                    const pct = Math.round((amt / (totalsByCurrency[mainCurrency] ?? amt)) * 100)
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{CATEGORY_LABEL[cat] ?? cat}</span>
                          <span className="font-medium">{fmt(amt, mainCurrency)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Per-session breakdown */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold">Gastos por sesión</h2>
            {sessionRows.map(s => (
              <div key={s.id} className="rounded-lg border bg-card overflow-hidden">
                {/* Session header */}
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                    <Link
                      href={`/projects/${projectId}/sesiones/${s.id}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {s.title}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(s.scheduled_date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {s.expenses.length > 0 && (
                    <span className="shrink-0 font-semibold text-sm">{fmt(s.total, s.currency)}</span>
                  )}
                </div>

                {s.expenses.length === 0 ? (
                  <p className="px-5 py-3 text-xs text-muted-foreground">Sin gastos registrados.</p>
                ) : (
                  <div className="divide-y">
                    {s.expenses.map(e => (
                      <div key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{e.description}</p>
                          <p className="text-xs text-muted-foreground">{CATEGORY_LABEL[e.category] ?? e.category}</p>
                        </div>
                        <span className="shrink-0 text-sm font-medium">{fmt(Number(e.amount), e.currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
