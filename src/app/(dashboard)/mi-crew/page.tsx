import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CalendarDays, MapPin, Clock, Download } from 'lucide-react'

export const metadata: Metadata = { title: 'Mis asignaciones de crew' }

export default async function MiCrewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Check if session_crew exists (migration may not be applied yet)
  let assignments: unknown[] = []
  try {
    const { data } = await admin
      .from('session_crew')
      .select(`
        id, role_name, agreed_rate, rate_currency, notes,
        sessions(
          id, title, scheduled_date, start_time, end_time, location,
          projects(id, title)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    assignments = data ?? []
  } catch {
    // Migration not yet applied
  }

  type Assignment = {
    id: string
    role_name: string
    agreed_rate: number | null
    rate_currency: string
    notes: string | null
    sessions: {
      id: string
      title: string
      scheduled_date: string
      start_time: string | null
      end_time: string | null
      location: string | null
      projects: { id: string; title: string } | null
    } | null
  }

  const items = assignments as Assignment[]

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mis asignaciones</h1>
        <p className="text-sm text-muted-foreground">
          Sesiones en las que has sido asignado como crew técnico.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm font-medium">No tenés asignaciones de crew todavía.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cuando un productor te asigne a una sesión, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(a => {
            const s = a.sessions
            if (!s) return null
            return (
              <div key={a.id} className="rounded-lg border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      {s.projects?.title ?? '—'}
                    </p>
                    <h3 className="font-medium">{s.title}</h3>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                    {a.role_name}
                  </span>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-4" />
                    {new Date(s.scheduled_date + 'T12:00:00').toLocaleDateString('es', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
                  </span>
                  {(s.start_time || s.end_time) && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4" />
                      {s.start_time?.slice(0, 5)}{s.end_time ? ` – ${s.end_time.slice(0, 5)}` : ''}
                    </span>
                  )}
                  {s.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4" /> {s.location}
                    </span>
                  )}
                  {a.agreed_rate && (
                    <span className="font-medium text-foreground">
                      {new Intl.NumberFormat('es-AR', { style: 'currency', currency: a.rate_currency }).format(a.agreed_rate)}
                    </span>
                  )}
                </div>

                {a.notes && (
                  <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    {a.notes}
                  </p>
                )}

                <SessionFilesPreview sessionId={s.id} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

async function SessionFilesPreview({ sessionId }: { sessionId: string }) {
  const admin = createAdminClient()
  let files: { id: string; title: string; storage_path: string; mime_type: string | null }[] = []
  try {
    const { data } = await admin
      .from('session_files')
      .select('id, title, storage_path, mime_type')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
    files = (data ?? []) as typeof files
  } catch { /* table may not exist */ }

  if (files.length === 0) return null

  return (
    <div className="border-t pt-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Archivos de la sesión</p>
      <div className="space-y-1">
        {files.map(f => (
          <a key={f.id} href={`/api/sessions/${sessionId}/files/${f.id}/download`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors">
            <Download className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{f.title}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
