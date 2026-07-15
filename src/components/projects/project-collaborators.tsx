'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users2, Plus, Trash2, Loader2, X, Building2, Globe } from 'lucide-react'
import { toast } from 'sonner'

export interface Collaborator {
  id: string
  name: string
  email: string
  role: string
  is_internal: boolean
  notes: string | null
  added_at: string
}

interface Props {
  projectId: string
  initial: Collaborator[]
}

const ROLES = [
  'Co-productor', 'Director', 'Asistente de producción',
  'Comunicación', 'Diseño', 'Prensa', 'Logística', 'Patrocinador', 'Colaborador',
]

export function ProjectCollaborators({ projectId, initial }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [collabs, setCollabs] = useState<Collaborator[]>(initial)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Colaborador')
  const [isInternal, setIsInternal] = useState(false)
  const [notes, setNotes] = useState('')

  const apiBase = `/api/projects/${projectId}/collaborators`
  const inputCls = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  function resetForm() {
    setName(''); setEmail(''); setRole('Colaborador'); setIsInternal(false); setNotes('')
  }

  async function handleAdd() {
    if (!name.trim() || !email.trim()) { toast.error('Nombre y email son obligatorios'); return }
    setSaving(true)
    const res = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), role, is_internal: isInternal, notes: notes || null }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); setSaving(false); return }
    setCollabs(prev => [...prev, data])
    resetForm(); setAdding(false); setSaving(false)
    toast.success(`${name} añadido como colaborador`)
    startTransition(() => router.refresh())
  }

  async function handleDelete(id: string, collabName: string) {
    setDeleting(id)
    const res = await fetch(`${apiBase}/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Error al eliminar'); setDeleting(null); return }
    setCollabs(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
    toast.success(`${collabName} eliminado`)
    startTransition(() => router.refresh())
  }

  const internal = collabs.filter(c => c.is_internal)
  const external = collabs.filter(c => !c.is_internal)

  function CollabCard({ c }: { c: Collaborator }) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
          {c.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{c.name}</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{c.role}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            <a href={`mailto:${c.email}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{c.email}</a>
            {c.notes && <span className="text-xs text-muted-foreground italic">{c.notes}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleDelete(c.id, c.name)}
          disabled={deleting === c.id}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          {deleting === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users2 className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Colaboradores</h2>
          {collabs.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {collabs.length}
            </span>
          )}
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Plus className="size-3.5" /> Añadir
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nuevo colaborador</p>
            <button type="button" onClick={() => { setAdding(false); resetForm() }}>
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>

          {/* Internal / external toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsInternal(false)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium transition-colors ${!isInternal ? 'bg-foreground text-background border-foreground' : 'hover:bg-accent'}`}
            >
              <Globe className="size-3.5" /> Externo
            </button>
            <button
              type="button"
              onClick={() => setIsInternal(true)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border py-2 text-xs font-medium transition-colors ${isInternal ? 'bg-foreground text-background border-foreground' : 'hover:bg-accent'}`}
            >
              <Building2 className="size-3.5" /> Interno
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nombre *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Rol</label>
              <input
                type="text"
                list="collab-roles"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="Co-productor, director…"
                className={inputCls}
              />
              <datalist id="collab-roles">
                {ROLES.map(r => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Notas</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" className={inputCls} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setAdding(false); resetForm() }}
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent">
              Cancelar
            </button>
            <button type="button" onClick={handleAdd} disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving && <Loader2 className="size-3 animate-spin" />}
              Añadir
            </button>
          </div>
        </div>
      )}

      {collabs.length === 0 ? (
        <div className="rounded-lg border border-dashed py-6 text-center">
          <p className="text-sm text-muted-foreground">No hay colaboradores añadidos.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {internal.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <Building2 className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internos ({internal.length})</p>
              </div>
              <div className="divide-y rounded-lg border overflow-hidden">
                {internal.map(c => <CollabCard key={c.id} c={c} />)}
              </div>
            </div>
          )}
          {external.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <Globe className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Externos ({external.length})</p>
              </div>
              <div className="divide-y rounded-lg border overflow-hidden">
                {external.map(c => <CollabCard key={c.id} c={c} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
