'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Trash2, Loader2, X, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

export interface SessionStaffMember {
  id: string
  name: string
  email: string | null
  role: string | null
  notes: string | null
  production_staff_id: string | null
  created_at: string
}

interface StaffOption {
  id: string
  full_name: string
  email: string
  speciality: string | null
}

interface Props {
  projectId: string
  sessionId: string
  initial: SessionStaffMember[]
  staffOptions: StaffOption[]
}

const ROLES = [
  'Director técnico', 'Técnico de sonido', 'Técnico de iluminación',
  'Fotógrafo', 'Videógrafo', 'Asistente', 'Stage manager',
  'Catering', 'Seguridad', 'Producción', 'Otro',
]

export function SessionStaff({ projectId, sessionId, initial, staffOptions }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [members, setMembers] = useState<SessionStaffMember[]>(initial)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [notes, setNotes] = useState('')

  const apiBase = `/api/projects/${projectId}/sessions/${sessionId}/staff`
  const inputCls = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  function pickFromRoster(id: string) {
    setSelectedStaffId(id)
    if (!id) { setName(''); setEmail(''); return }
    const m = staffOptions.find(s => s.id === id)
    if (m) {
      setName(m.full_name)
      setEmail(m.email)
      if (!role && m.speciality) setRole(m.speciality)
    }
  }

  async function handleAdd() {
    if (!name.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    const res = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email || null,
        role: role || null,
        notes: notes || null,
        production_staff_id: selectedStaffId || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); setSaving(false); return }
    setMembers(prev => [...prev, data])
    setName(''); setEmail(''); setRole(''); setNotes(''); setSelectedStaffId('')
    setAdding(false); setSaving(false)
    toast.success(`${name} asignado a la sesión`)
    startTransition(() => router.refresh())
  }

  async function handleDelete(id: string, memberName: string) {
    setDeleting(id)
    const res = await fetch(`${apiBase}/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Error al eliminar'); setDeleting(null); return }
    setMembers(prev => prev.filter(m => m.id !== id))
    setDeleting(null)
    toast.success(`${memberName} eliminado de la sesión`)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Staff asignado</h2>
          {members.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {members.length}
            </span>
          )}
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Plus className="size-3.5" /> Asignar
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Asignar persona</p>
            <button type="button" onClick={() => { setAdding(false); setSelectedStaffId(''); setName(''); setEmail(''); setRole(''); setNotes('') }}>
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>

          {staffOptions.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Desde Mi Staff</label>
              <select value={selectedStaffId} onChange={e => pickFromRoster(e.target.value)} className={inputCls}>
                <option value="">— Elegir del roster o ingresar manualmente —</option>
                {staffOptions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}{s.speciality ? ` · ${s.speciality}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nombre *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Función en la sesión</label>
              <input
                type="text"
                list="session-roles"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="Técnico de sonido, fotógrafo…"
                className={inputCls}
              />
              <datalist id="session-roles">
                {ROLES.map(r => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Notas</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" className={inputCls} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAdding(false)}
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent">
              Cancelar
            </button>
            <button type="button" onClick={handleAdd} disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving && <Loader2 className="size-3 animate-spin" />}
              Asignar
            </button>
          </div>
        </div>
      )}

      {/* Member list */}
      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed py-6 text-center">
          <p className="text-sm text-muted-foreground">Ningún staff asignado a esta sesión.</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                {m.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  {m.production_staff_id && (
                    <span title="Del roster oficial">
                      <UserCheck className="size-3.5 text-emerald-600 shrink-0" />
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {m.role && <span className="text-xs text-muted-foreground">{m.role}</span>}
                  {m.email && <span className="text-xs text-muted-foreground">{m.email}</span>}
                  {m.notes && <span className="text-xs text-muted-foreground italic">{m.notes}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(m.id, m.name)}
                disabled={deleting === m.id}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                {deleting === m.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
