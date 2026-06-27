'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, FileText, Upload, X, Music } from 'lucide-react'

interface Session {
  id:             string
  title:          string
  scheduled_date: string
  start_time:     string | null
}

interface Props {
  token:    string
  sessions: Session[]
  projectTitle: string
}

const inputCls = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const labelCls = 'text-sm font-medium'
const errorCls = 'text-xs text-destructive mt-1'

export function ArtistRegistrationForm({ token, sessions, projectTitle }: Props) {
  // Core fields
  const [bandName,       setBandName]       = useState('')
  const [email,          setEmail]          = useState('')
  const [phone,          setPhone]          = useState('')
  const [city,           setCity]           = useState('')
  const [sessionId,      setSessionId]      = useState('')
  // Artist-specific
  const [genre,          setGenre]          = useState('')
  const [memberCount,    setMemberCount]    = useState('')
  const [musicLinks,     setMusicLinks]     = useState('')
  const [bio,            setBio]            = useState('')
  // Presskit
  const [pkFile,         setPkFile]         = useState<File | null>(null)
  const [pkUrl,          setPkUrl]          = useState<string | null>(null)
  const [pkUploading,    setPkUploading]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // State
  const [loading,        setLoading]        = useState(false)
  const [success,        setSuccess]        = useState(false)
  const [statusUrl,      setStatusUrl]      = useState<string | null>(null)
  const [errors,         setErrors]         = useState<Record<string, string>>({})

  async function handlePkChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { toast.error('Solo se aceptan archivos PDF'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('El archivo supera 10 MB'); return }

    setPkFile(file)
    setPkUploading(true)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', 'presskit')

    const res  = await fetch('/api/applications/upload-file', { method: 'POST', body: fd })
    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? 'Error al subir el archivo')
      setPkFile(null)
      setPkUploading(false)
      return
    }
    setPkUrl(data.url)
    setPkUploading(false)
  }

  function clearPk() {
    setPkFile(null)
    setPkUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!bandName.trim())   e.bandName  = 'El nombre es obligatorio'
    if (!email.trim())      e.email     = 'El email es obligatorio'
    if (!phone.trim())      e.phone     = 'El teléfono es obligatorio'
    if (!city.trim())       e.city      = 'La ciudad es obligatoria'
    if (!genre.trim())      e.genre     = 'El género musical es obligatorio'
    if (sessions.length > 0 && !sessionId) e.session = 'Seleccioná una sesión'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    if (pkFile && !pkUrl) { toast.error('Esperá a que termine la subida del archivo'); return }
    setLoading(true)

    const res = await fetch(`/api/inscripcion/${token}/apply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name:            bandName.trim(),
        email:                email.trim(),
        phone:                phone.trim(),
        city:                 city.trim(),
        preferred_session_id: sessionId || null,
        presskit_url:         pkUrl,
        answers: {
          band_name:     bandName.trim(),
          musical_genre: genre.trim(),
          member_count:  memberCount ? Number(memberCount) : null,
          music_links:   musicLinks.trim() || null,
          bio:           bio.trim() || null,
        },
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Error al enviar la inscripción')
      setLoading(false)
      return
    }

    setStatusUrl(`${window.location.origin}/estado/${data.access_token}`)
    setSuccess(true)
    setLoading(false)
  }

  if (success && statusUrl) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <h2 className="text-xl font-semibold">¡Inscripción enviada!</h2>
        <p className="text-sm text-muted-foreground">
          Te enviamos un email con los detalles. Podés seguir el estado de tu inscripción en:
        </p>
        <a href={statusUrl}
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Ver estado de mi inscripción
        </a>
        <p className="text-xs text-muted-foreground">Guardá este enlace — no necesitás crear una cuenta.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section: Artist identity */}
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Music className="size-4" /> Datos del artista
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label className={labelCls}>Nombre de la banda o solista <span className="text-destructive">*</span></label>
            <input type="text" value={bandName} onChange={e => setBandName(e.target.value)}
              placeholder="Los Fantasmas / Ana Pérez" className={inputCls} />
            {errors.bandName && <p className={errorCls}>{errors.bandName}</p>}
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Género musical <span className="text-destructive">*</span></label>
            <input type="text" value={genre} onChange={e => setGenre(e.target.value)}
              placeholder="Rock / Jazz / Folk / Electrónica…" className={inputCls} />
            {errors.genre && <p className={errorCls}>{errors.genre}</p>}
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Número de integrantes</label>
            <input type="number" min={1} max={99} value={memberCount} onChange={e => setMemberCount(e.target.value)}
              placeholder="1" className={inputCls} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Links a su música <span className="text-xs text-muted-foreground">(Spotify, YouTube, Bandcamp…)</span></label>
          <input type="text" value={musicLinks} onChange={e => setMusicLinks(e.target.value)}
            placeholder="https://open.spotify.com/… · https://youtube.com/…" className={inputCls} />
          <p className="text-xs text-muted-foreground">Podés incluir varios links separados por · o espacios</p>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Bio / Descripción del proyecto artístico</label>
          <textarea rows={4} value={bio} onChange={e => setBio(e.target.value)}
            placeholder="Contanos sobre tu propuesta musical, trayectoria, discos publicados…"
            className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
        </div>
      </div>

      {/* Section: Contact */}
      <div className="space-y-4 border-t pt-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contacto</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelCls}>Email <span className="text-destructive">*</span></label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" placeholder="tu@email.com" className={inputCls} />
            {errors.email && <p className={errorCls}>{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Teléfono <span className="text-destructive">*</span></label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              autoComplete="tel" placeholder="+54 9 11 1234-5678" className={inputCls} />
            {errors.phone && <p className={errorCls}>{errors.phone}</p>}
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Ciudad <span className="text-destructive">*</span></label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)}
              placeholder="Buenos Aires" className={inputCls} />
            {errors.city && <p className={errorCls}>{errors.city}</p>}
          </div>
        </div>
      </div>

      {/* Session selection */}
      {sessions.length > 0 && (
        <div className="space-y-1.5 border-t pt-4">
          <label className={labelCls}>
            Sesión preferida <span className="text-destructive">*</span>
          </label>
          <select value={sessionId} onChange={e => setSessionId(e.target.value)}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">Seleccioná una sesión…</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.title} — {new Date(s.scheduled_date).toLocaleDateString('es-AR', {
                  weekday: 'short', day: '2-digit', month: 'short',
                })}{s.start_time ? ` ${s.start_time.slice(0, 5)}` : ''}
              </option>
            ))}
          </select>
          {errors.session && <p className={errorCls}>{errors.session}</p>}
        </div>
      )}

      {/* Presskit upload */}
      <div className="space-y-1.5 border-t pt-4">
        <label className={labelCls}>Dossier / Presskit <span className="text-xs text-muted-foreground">(opcional · solo PDF · máx. 10 MB)</span></label>
        {pkFile ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
            {pkUploading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
            ) : (
              <FileText className="size-4 text-emerald-600 shrink-0" />
            )}
            <span className="flex-1 truncate text-xs">{pkFile.name}</span>
            {!pkUploading && (
              <button type="button" onClick={clearPk} className="text-muted-foreground hover:text-destructive">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground hover:bg-accent transition-colors">
            <Upload className="size-4" />
            Subir Dossier o Presskit (PDF)
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handlePkChange} />
          </label>
        )}
      </div>

      <button type="submit" disabled={loading || pkUploading}
        className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50">
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Enviar inscripción
      </button>
    </form>
  )
}
