'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, Loader2, CheckCircle2, Circle, X } from 'lucide-react'

type ProjectStatus = 'draft' | 'active' | 'completed' | 'cancelled'

interface Props {
  projectId:   string
  title:       string
  description: string | null
  status:      ProjectStatus
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft:     'Borrador',
  active:    'Activo',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const STATUS_NEXT: Partial<Record<ProjectStatus, ProjectStatus>> = {
  draft:  'active',
  active: 'completed',
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  draft:     'bg-zinc-100 text-zinc-600',
  active:    'bg-emerald-100 text-emerald-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-600',
}

export function ProjectActions({ projectId, title, description, status }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Edit modal
  const [editOpen,   setEditOpen]   = useState(false)
  const [editTitle,  setEditTitle]  = useState(title)
  const [editDesc,   setEditDesc]   = useState(description ?? '')
  const [editLoading, setEditLoading] = useState(false)

  // Delete modal
  const [deleteOpen,    setDeleteOpen]    = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  // Status
  const [statusLoading, setStatusLoading] = useState(false)
  const nextStatus = STATUS_NEXT[status]

  async function handleStatusChange() {
    if (!nextStatus) return
    setStatusLoading(true)
    const res = await fetch(`/api/projects/${projectId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: nextStatus }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Error al actualizar el estado')
    } else {
      toast.success(`Proyecto marcado como "${STATUS_LABEL[nextStatus]}"`)
      startTransition(() => router.refresh())
    }
    setStatusLoading(false)
  }

  async function handleEdit() {
    if (!editTitle.trim()) return
    setEditLoading(true)
    const res = await fetch(`/api/projects/${projectId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        title:       editTitle.trim(),
        description: editDesc.trim() || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Error al guardar los cambios')
    } else {
      toast.success('Proyecto actualizado')
      setEditOpen(false)
      startTransition(() => router.refresh())
    }
    setEditLoading(false)
  }

  async function handleDelete() {
    if (deleteConfirm !== title) return
    setDeleteLoading(true)
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Error al eliminar el proyecto')
      setDeleteLoading(false)
      return
    }
    toast.success('Proyecto eliminado')
    router.push('/projects')
  }

  const baseInput = 'flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <>
      {/* Action bar */}
      <div className="flex items-center gap-2">
        {/* Status badge */}
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[status]}`}>
          {STATUS_LABEL[status]}
        </span>

        {/* Publish / advance status */}
        {nextStatus && (
          <button
            type="button"
            onClick={handleStatusChange}
            disabled={statusLoading || isPending}
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            {statusLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <CheckCircle2 className="size-3.5" />}
            {nextStatus === 'active' ? 'Publicar' : 'Marcar completado'}
          </button>
        )}

        {/* Edit */}
        <button
          type="button"
          onClick={() => { setEditTitle(title); setEditDesc(description ?? ''); setEditOpen(true) }}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
        >
          <Pencil className="size-3.5" />
          Editar
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => { setDeleteConfirm(''); setDeleteOpen(true) }}
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-card px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/5"
        >
          <Trash2 className="size-3.5" />
          Eliminar
        </button>
      </div>

      {/* ── Edit modal ──────────────────────────────────────────────── */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Editar proyecto</h2>
              <button type="button" onClick={() => setEditOpen(false)}>
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre del proyecto</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={baseInput}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Descripción</label>
                <textarea
                  rows={4}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Descripción opcional del proyecto…"
                  className={`${baseInput} resize-none`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t px-5 py-4">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEdit}
                disabled={editLoading || !editTitle.trim()}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {editLoading && <Loader2 className="size-4 animate-spin" />}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete modal ─────────────────────────────────────────────── */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold text-destructive">Eliminar proyecto</h2>
              <button type="button" onClick={() => setDeleteOpen(false)}>
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">
                Esta acción es <strong>irreversible</strong>. Se eliminarán todas las sesiones,
                inscripciones, contratos y ofertas de trabajo asociadas.
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Escribe <span className="font-mono text-foreground">"{title}"</span> para confirmar
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={title}
                  className={baseInput}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t px-5 py-4">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading || deleteConfirm !== title}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteLoading && <Loader2 className="size-4 animate-spin" />}
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
