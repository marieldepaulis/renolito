'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2, Plus, Trash2, ExternalLink,
  FileText, Receipt, Wrench, Music, File,
  Save, Users2, Upload, Download, AlertTriangle, Search, X,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────

interface Session { id: string; title: string; scheduled_date: string }
interface CrewMember {
  id: string; role_name: string; user_id: string | null
  external_name: string | null; external_email: string | null
  agreed_rate: number | null; rate_currency: string; notes: string | null
  profiles: { full_name: string; email: string } | null
}
interface ProjectDocument {
  id: string; title: string; url: string; doc_type: string; notes: string | null; created_at: string
}
interface SessionFile {
  id: string; title: string; storage_path: string; file_size: number | null; mime_type: string | null; created_at: string; url: string | null
}
interface PlatformUser { id: string; full_name: string; email: string }

interface Props { projectId: string; sessions: Session[]; initialNotes: string | null }

// ── Predefined roles ────────────────────────────────────────
const ROLE_GROUPS = [
  { group: 'Dirección', roles: ['Director/a', 'Asistente de dirección', 'Script / Continuista'] },
  { group: 'Cámara', roles: ['Director/a de fotografía', 'Operador/a cámara A', 'Operador/a cámara B', 'Operador/a cámara C', 'Asistente de cámara', 'Operador/a steady', 'Operador/a drone'] },
  { group: 'Sonido', roles: ['Sonidista', 'Microfonista', 'Operador/a de audio en sala'] },
  { group: 'Iluminación', roles: ['Gaffer / Jefe de eléctricos', 'Eléctrico', 'Operador/a de luz'] },
  { group: 'Arte', roles: ['Directora de arte', 'Maquilladora', 'Vestuarista', 'Utilero/a'] },
  { group: 'Producción', roles: ['Productor/a general', 'Coordinador/a de producción', 'Asistente de producción', 'Runner'] },
  { group: 'Post', roles: ['Editor/a', 'Colorista', 'Motion graphics', 'Técnico/a VFX'] },
]

// ── Constants ──────────────────────────────────────────────
const DOC_TYPES = [
  { value: 'contract',  label: 'Contrato',     icon: FileText },
  { value: 'budget',    label: 'Presupuesto',  icon: Receipt },
  { value: 'technical', label: 'Ficha técnica',icon: Wrench },
  { value: 'rider',     label: 'Rider',        icon: Music },
  { value: 'other',     label: 'Otro',         icon: File },
] as const
const DOC_ICON: Record<string, React.ElementType> = { contract: FileText, budget: Receipt, technical: Wrench, rider: Music, other: File }
const DOC_LABEL: Record<string, string> = { contract: 'Contrato', budget: 'Presupuesto', technical: 'Ficha técnica', rider: 'Rider', other: 'Otro' }

const inputCls = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

function MigrationBanner() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
      <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
      <div className="space-y-1">
        <p className="font-medium text-amber-900">Falta aplicar la migración de base de datos</p>
        <p className="text-amber-700">
          Para usar esta sección ejecutá el archivo{' '}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">supabase/migrations/003_gestion_interna.sql</code>{' '}
          en Supabase Dashboard → SQL Editor.
        </p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────
export function InternalHub({ projectId, sessions, initialNotes }: Props) {
  const [tab, setTab] = useState<'crew' | 'docs' | 'notes'>('crew')
  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        {([
          { key: 'crew',  label: 'Asignación de crew' },
          { key: 'docs',  label: 'Documentos privados' },
          { key: 'notes', label: 'Notas de producción' },
        ] as const).map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>{label}</button>
        ))}
      </div>
      {tab === 'crew'  && <CrewPanel  projectId={projectId} sessions={sessions} />}
      {tab === 'docs'  && <DocsPanel  projectId={projectId} />}
      {tab === 'notes' && <NotesPanel projectId={projectId} initialNotes={initialNotes} />}
    </div>
  )
}

// ── CREW PANEL ─────────────────────────────────────────────
function CrewPanel({ projectId: _, sessions }: { projectId: string; sessions: Session[] }) {
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.id ?? '')
  const [crew, setCrew]         = useState<CrewMember[]>([])
  const [loading, setLoading]   = useState(false)
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Multi-select roles
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [customRole, setCustomRole]       = useState('')
  const [roleSearch, setRoleSearch]       = useState('')

  // Person
  const [userSearch,    setUserSearch]    = useState('')
  const [userResults,   setUserResults]   = useState<PlatformUser[]>([])
  const [selectedUser,  setSelectedUser]  = useState<PlatformUser | null>(null)
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [externalName,  setExternalName]  = useState('')
  const [externalEmail, setExternalEmail] = useState('')
  const [agreedRate,    setAgreedRate]    = useState('')
  const [crewNotes,     setCrewNotes]     = useState('')
  const [adding,        setAdding]        = useState(false)
  const [removingId,    setRemovingId]    = useState<string | null>(null)
  const userSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Files per session
  const [files, setFiles]         = useState<SessionFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!selectedSessionId) return
    setLoading(true)
    setMigrationNeeded(false)
    fetch(`/api/sessions/${selectedSessionId}/crew`)
      .then(async r => {
        const d = await r.json()
        if (!r.ok) {
          if (typeof d.error === 'string' && d.error.includes('session_crew')) setMigrationNeeded(true)
          setCrew([])
        } else {
          setCrew(Array.isArray(d) ? d : [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))

    setLoadingFiles(true)
    fetch(`/api/sessions/${selectedSessionId}/files`)
      .then(async r => { const d = await r.json(); setFiles(Array.isArray(d) ? d : []); setLoadingFiles(false) })
      .catch(() => setLoadingFiles(false))
  }, [selectedSessionId])

  // Platform user search with debounce
  useEffect(() => {
    if (!userSearch.trim()) { setUserResults([]); return }
    if (userSearchRef.current) clearTimeout(userSearchRef.current)
    userSearchRef.current = setTimeout(() => {
      setSearchingUsers(true)
      fetch(`/api/org/members-search?q=${encodeURIComponent(userSearch)}`)
        .then(r => r.json()).then(d => { setUserResults(Array.isArray(d) ? d : []); setSearchingUsers(false) })
        .catch(() => setSearchingUsers(false))
    }, 300)
  }, [userSearch])

  const filteredRoles = roleSearch
    ? ROLE_GROUPS.map(g => ({ ...g, roles: g.roles.filter(r => r.toLowerCase().includes(roleSearch.toLowerCase())) })).filter(g => g.roles.length > 0)
    : ROLE_GROUPS

  const toggleRole = (role: string) =>
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])

  const allRoles = selectedRoles.concat(customRole.trim() ? [customRole.trim()] : [])

  async function handleAdd() {
    if (allRoles.length === 0) { toast.error('Seleccioná al menos un rol'); return }
    const name = selectedUser?.full_name ?? externalName.trim()
    const uid  = selectedUser?.id ?? null
    if (!name && !uid) { toast.error('Seleccioná un usuario o ingresá un nombre externo'); return }

    setAdding(true)
    let addedCount = 0
    for (const role of allRoles) {
      const res = await fetch(`/api/sessions/${selectedSessionId}/crew`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_name:      role,
          user_id:        uid,
          external_name:  uid ? null : name,
          external_email: uid ? null : (externalEmail || null),
          agreed_rate:    agreedRate || null,
          notes:          crewNotes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(`Error en "${role}": ${data.error}`); continue }
      setCrew(prev => [...prev, data])
      addedCount++
    }
    if (addedCount > 0) toast.success(`${addedCount} asignación${addedCount !== 1 ? 'es' : ''} agregada${addedCount !== 1 ? 's' : ''}`)
    setSelectedRoles([]); setCustomRole(''); setRoleSearch('')
    setSelectedUser(null); setUserSearch(''); setExternalName(''); setExternalEmail('')
    setAgreedRate(''); setCrewNotes(''); setShowForm(false)
    setAdding(false)
  }

  async function handleRemove(crewId: string) {
    setRemovingId(crewId)
    const res = await fetch(`/api/sessions/${selectedSessionId}/crew/${crewId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al eliminar'); setRemovingId(null); return }
    setCrew(prev => prev.filter(c => c.id !== crewId))
    toast.success('Removido del crew')
    setRemovingId(null)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', file.name)
    const res = await fetch(`/api/sessions/${selectedSessionId}/files`, { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al subir'); setUploadingFile(false); return }
    setFiles(prev => [data, ...prev])
    toast.success('Archivo subido')
    setUploadingFile(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFileDelete(fileId: string) {
    const res = await fetch(`/api/sessions/${selectedSessionId}/files/${fileId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al eliminar'); return }
    setFiles(prev => prev.filter(f => f.id !== fileId))
    toast.success('Archivo eliminado')
  }

  if (sessions.length === 0) {
    return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No hay sesiones en este proyecto todavía.</div>
  }

  return (
    <div className="space-y-5">
      {migrationNeeded && <MigrationBanner />}

      {/* Session selector */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Sesión</label>
        <select value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)} className={inputCls}>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {s.title} — {new Date(s.scheduled_date + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
            </option>
          ))}
        </select>
      </div>

      {/* Crew list */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando crew…</div>
      ) : (
        <div className="space-y-2">
          {crew.length === 0 && !migrationNeeded && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Sin crew asignado a esta sesión.</p>
          )}
          {crew.map(member => (
            <div key={member.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Users2 className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.profiles?.full_name ?? member.external_name ?? '—'}
                    {member.user_id && <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">Plataforma</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {member.role_name}
                    {member.agreed_rate ? ` · ${formatCurrency(member.agreed_rate, member.rate_currency)}` : ''}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => handleRemove(member.id)} disabled={removingId === member.id}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 transition-colors">
                {removingId === member.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add crew form */}
      {!migrationNeeded && (showForm ? (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
          <p className="text-sm font-medium">Agregar al crew</p>

          {/* Role multi-select */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Roles * (podés seleccionar más de uno)</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
              <input type="text" value={roleSearch} onChange={e => setRoleSearch(e.target.value)}
                placeholder="Buscar rol…" className="h-9 w-full rounded-md border bg-transparent pl-8 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="max-h-44 overflow-y-auto rounded-md border bg-background p-2 space-y-2">
              {filteredRoles.map(g => (
                <div key={g.group}>
                  <p className="px-1 py-0.5 text-xs font-semibold text-muted-foreground">{g.group}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {g.roles.map(role => (
                      <button key={role} type="button" onClick={() => toggleRole(role)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                          selectedRoles.includes(role) ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                        }`}>
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* Custom role */}
            <input type="text" value={customRole} onChange={e => setCustomRole(e.target.value)}
              placeholder="Rol personalizado (opcional)…" className={inputCls} />
            {/* Selected chips */}
            {allRoles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allRoles.map(r => (
                  <span key={r} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {r}
                    <button type="button" onClick={() => {
                      if (selectedRoles.includes(r)) toggleRole(r)
                      else if (r === customRole.trim()) setCustomRole('')
                    }}><X className="size-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Person selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Persona</label>
            {selectedUser ? (
              <div className="flex items-center justify-between rounded-md border bg-blue-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{selectedUser.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
                <button type="button" onClick={() => { setSelectedUser(null); setUserSearch('') }}>
                  <X className="size-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                  <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                    placeholder="Buscar usuario de la plataforma…"
                    className="h-9 w-full rounded-md border bg-transparent pl-8 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  {searchingUsers && <Loader2 className="absolute right-2.5 top-2.5 size-4 animate-spin text-muted-foreground" />}
                </div>
                {userResults.length > 0 && (
                  <div className="rounded-md border bg-background divide-y max-h-36 overflow-y-auto">
                    {userResults.map(u => (
                      <button key={u.id} type="button" onClick={() => { setSelectedUser(u); setUserSearch(''); setUserResults([]) }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors">
                        <span className="font-medium">{u.full_name}</span>
                        <span className="text-muted-foreground">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">O ingresá datos externos:</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={externalName} onChange={e => setExternalName(e.target.value)}
                    placeholder="Nombre completo *" className={inputCls} />
                  <input type="email" value={externalEmail} onChange={e => setExternalEmail(e.target.value)}
                    placeholder="Email (opcional)" className={inputCls} />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tarifa acordada</label>
              <input type="number" min={0} value={agreedRate} onChange={e => setAgreedRate(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Notas internas</label>
              <input type="text" value={crewNotes} onChange={e => setCrewNotes(e.target.value)} placeholder="Observaciones…" className={inputCls} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent">Cancelar</button>
            <button type="button" onClick={handleAdd} disabled={adding}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {adding && <Loader2 className="size-3.5 animate-spin" />}
              Agregar {allRoles.length > 1 ? `${allRoles.length} roles` : 'al crew'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
          <Plus className="size-4" /> Agregar al crew
        </button>
      ))}

      {/* Session files */}
      <div className="space-y-3 border-t pt-5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Archivos de esta sesión</h4>
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent ${uploadingFile ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploadingFile ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {uploadingFile ? 'Subiendo…' : 'Subir archivo'}
            <input ref={fileInputRef} type="file" className="sr-only" onChange={handleFileUpload} disabled={uploadingFile} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Los archivos son visibles para todos los miembros del crew asignados a esta sesión.</p>

        {loadingFiles ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando archivos…</div>
        ) : files.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Sin archivos adjuntos todavía.</p>
        ) : (
          <div className="space-y-1.5">
            {files.map(f => (
              <div key={f.id} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5">
                <File className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{f.title}</span>
                {f.file_size && <span className="text-xs text-muted-foreground">{(f.file_size / 1024).toFixed(0)} KB</span>}
                <div className="flex items-center gap-1 shrink-0">
                  {f.url && (
                    <a href={f.url} target="_blank" rel="noopener noreferrer"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                      <Download className="size-4" />
                    </a>
                  )}
                  <button type="button" onClick={() => handleFileDelete(f.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── DOCS PANEL ─────────────────────────────────────────────
function DocsPanel({ projectId }: { projectId: string }) {
  const [docs, setDocs]         = useState<ProjectDocument[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [title,   setTitle]   = useState('')
  const [url,     setUrl]     = useState('')
  const [docType, setDocType] = useState('other')
  const [notes,   setNotes]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/documents`)
      .then(async r => {
        const d = await r.json()
        if (!r.ok && typeof d.error === 'string' && d.error.includes('project_documents')) setMigrationNeeded(true)
        setDocs(Array.isArray(d) ? d : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [projectId])

  async function handleAdd() {
    if (!title.trim() || !url.trim()) { toast.error('Título y URL son obligatorios'); return }
    setSaving(true)
    const res = await fetch(`/api/projects/${projectId}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), url: url.trim(), doc_type: docType, notes: notes || null }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); setSaving(false); return }
    setDocs(prev => [data, ...prev])
    setTitle(''); setUrl(''); setDocType('other'); setNotes('')
    setShowForm(false); toast.success('Documento agregado'); setSaving(false)
  }

  async function handleDelete(docId: string) {
    setDeletingId(docId)
    const res = await fetch(`/api/projects/${projectId}/documents/${docId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al eliminar'); setDeletingId(null); return }
    setDocs(prev => prev.filter(d => d.id !== docId)); toast.success('Documento eliminado'); setDeletingId(null)
  }

  return (
    <div className="space-y-5">
      {migrationNeeded && <MigrationBanner />}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</div>
      ) : (
        <div className="space-y-2">
          {docs.length === 0 && !migrationNeeded && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No hay documentos privados registrados.</p>
          )}
          {docs.map(doc => {
            const Icon = DOC_ICON[doc.doc_type] ?? File
            return (
              <div key={doc.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{DOC_LABEL[doc.doc_type] ?? doc.doc_type}</span>
                  </div>
                  {doc.notes && <p className="text-xs text-muted-foreground truncate">{doc.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <ExternalLink className="size-4" />
                  </a>
                  <button type="button" onClick={() => handleDelete(doc.id)} disabled={deletingId === doc.id}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 transition-colors">
                    {deletingId === doc.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {!migrationNeeded && (showForm ? (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <p className="text-sm font-medium">Agregar documento</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Contrato Banda X" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <select value={docType} onChange={e => setDocType(e.target.value)} className={inputCls}>
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">URL / Enlace *</label>
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/…" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notas</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Firmado el 12/06…" className={inputCls} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent">Cancelar</button>
            <button type="button" onClick={handleAdd} disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving && <Loader2 className="size-3.5 animate-spin" />} Agregar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
          <Plus className="size-4" /> Agregar documento
        </button>
      ))}
    </div>
  )
}

// ── NOTES PANEL ────────────────────────────────────────────
function NotesPanel({ projectId, initialNotes }: { projectId: string; initialNotes: string | null }) {
  const [notes,  setNotes]  = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/projects/${projectId}/internal`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ production_notes: notes || null }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); setSaving(false); return }
    toast.success('Notas guardadas'); setSaving(false)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notas confidenciales del proyecto</label>
        <p className="text-xs text-muted-foreground">Visible únicamente para los miembros de tu organización. Nunca se muestra a artistas ni técnicos.</p>
        <textarea rows={12} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Logística, pendientes internos, referencias de contacto…"
          className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={handleSave} disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar notas
        </button>
      </div>
    </div>
  )
}
