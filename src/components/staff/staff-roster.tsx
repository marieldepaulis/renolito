'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Mail, Phone, Loader2, Trash2, X, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'

type StaffMember = {
  id:         string
  full_name:  string
  email:      string
  speciality: string | null
  phone:      string | null
  source:     string
  status:     string
  joined_at:  string
}

const SOURCE_LABEL: Record<string, string> = {
  staff_application:      'Postulación pública',
  technician_application: 'Perfil técnico',
  manual:                 'Añadido manualmente',
}

const SOURCE_COLOR: Record<string, string> = {
  staff_application:      'bg-blue-100 text-blue-700',
  technician_application: 'bg-purple-100 text-purple-700',
  manual:                 'bg-zinc-100 text-zinc-600',
}

export function StaffRoster({ initial }: { initial: StaffMember[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [members, setMembers] = useState<StaffMember[]>(initial)
  const [adding,   setAdding]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [busy,     setBusy]     = useState<string | null>(null)

  // New member form
  const [name,       setName]       = useState('')
  const [email,      setEmail]      = useState('')
  const [speciality, setSpeciality] = useState('')
  const [phone,      setPhone]      = useState('')

  const active   = members.filter(m => m.status === 'active')
  const inactive = members.filter(m => m.status === 'inactive')

  const inputCls = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  async function handleAdd() {
    if (!name.trim() || !email.trim()) { toast.error('Nombre y email son obligatorios'); return }
    setSaving(true)
    const res = await fetch('/api/staff/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name, email, speciality, phone }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); setSaving(false); return }
    setMembers(prev => [data, ...prev])
    setName(''); setEmail(''); setSpeciality(''); setPhone('')
    setAdding(false); setSaving(false)
    toast.success(`${name} añadido al staff`)
    startTransition(() => router.refresh())
  }

  async function toggleStatus(m: StaffMember) {
    const next = m.status === 'active' ? 'inactive' : 'active'
    setBusy(m.id)
    const res = await fetch(`/api/staff/roster/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (!res.ok) { toast.error('Error al actualizar'); setBusy(null); return }
    setMembers(prev => prev.map(x => x.id === m.id ? { ...x, status: next } : x))
    setBusy(null)
    toast.success(next === 'active' ? 'Miembro reactivado' : 'Miembro desactivado')
  }

  async function handleDelete(m: StaffMember) {
    if (!confirm(`¿Eliminar a ${m.full_name} del staff?`)) return
    setBusy(m.id)
    const res = await fetch(`/api/staff/roster/${m.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Error al eliminar'); setBusy(null); return }
    setMembers(prev => prev.filter(x => x.id !== m.id))
    setBusy(null)
    toast.success(`${m.full_name} eliminado del staff`)
  }

  function MemberCard({ m }: { m: StaffMember }) {
    const isDisabled = m.status === 'inactive'
    return (
      <div className={`rounded-lg border bg-card p-4 transition-opacity ${isDisabled ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
            {m.full_name.charAt(0)}
          </div>
          {/* Info */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">{m.full_name}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_COLOR[m.source] ?? 'bg-zinc-100 text-zinc-600'}`}>
                {SOURCE_LABEL[m.source] ?? m.source}
              </span>
              {isDisabled && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Inactivo</span>
              )}
            </div>
            {m.speciality && (
              <p className="text-xs text-muted-foreground">{m.speciality}</p>
            )}
            <div className="flex flex-wrap gap-3 pt-0.5">
              <a href={`mailto:${m.email}`}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="size-3" /> {m.email}
              </a>
              {m.phone && (
                <a href={`tel:${m.phone}`}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Phone className="size-3" /> {m.phone}
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Desde {new Date(m.joined_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => toggleStatus(m)}
              disabled={busy === m.id}
              title={isDisabled ? 'Reactivar' : 'Desactivar'}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
            >
              {busy === m.id ? <Loader2 className="size-4 animate-spin" /> : isDisabled ? <UserCheck className="size-4" /> : <UserX className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(m)}
              disabled={busy === m.id}
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mi Staff</h1>
          <p className="text-sm text-muted-foreground">
            Equipo oficial de la productora · {active.length} activo{active.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            <Plus className="size-4" /> Añadir miembro
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-lg border bg-muted/30 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Nuevo miembro del staff</p>
            <button type="button" onClick={() => setAdding(false)}><X className="size-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nombre completo *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ana García" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ana@ejemplo.com" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Especialidad</label>
              <input type="text" value={speciality} onChange={e => setSpeciality(e.target.value)} placeholder="Técnico de sonido, fotógrafo…" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Teléfono</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+34 600 000 000" className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)}
              className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent">Cancelar</button>
            <button type="button" onClick={handleAdd} disabled={saving}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving && <Loader2 className="size-4 animate-spin" />} Guardar
            </button>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <Users className="size-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">No hay staff registrado todavía.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              El equipo se añade automáticamente cuando aceptas una postulación,<br />
              o puedes añadir miembros manualmente.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active */}
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Activos ({active.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map(m => <MemberCard key={m.id} m={m} />)}
              </div>
            </div>
          )}
          {/* Inactive */}
          {inactive.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Inactivos ({inactive.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {inactive.map(m => <MemberCard key={m.id} m={m} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
