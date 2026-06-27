'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { Upload, Trash2, Loader2, Building2, Globe, Instagram, MapPin } from 'lucide-react'

interface Org {
  id:            string
  name:          string
  slug:          string
  bio:           string | null
  logo_url:      string | null
  website_url:   string | null
  instagram_url: string | null
  city:          string | null
}

const inputCls  = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const labelCls  = 'text-sm font-medium'

export function OrgSettingsForm({ org, canEdit }: { org: Org | null; canEdit: boolean }) {
  const router  = useRouter()
  const [, startTransition] = useTransition()

  // Logo state
  const [logoUrl,      setLogoUrl]      = useState<string | null>(org?.logo_url ?? null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoDeleting,  setLogoDeleting]  = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  // Org fields
  const [name,      setName]      = useState(org?.name ?? '')
  const [bio,       setBio]       = useState(org?.bio ?? '')
  const [city,      setCity]      = useState(org?.city ?? '')
  const [website,   setWebsite]   = useState(org?.website_url ?? '')
  const [instagram, setInstagram] = useState(org?.instagram_url ?? '')

  const [saving, setSaving] = useState(false)

  // ── Logo upload ─────────────────────────────────────────
  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      toast.error('Formato no permitido. Usá PNG, JPG, WEBP o SVG.')
      return
    }
    if (file.size > 5 * 1024 * 1024) { toast.error('El archivo supera 5 MB.'); return }

    setLogoUploading(true)
    const fd = new FormData()
    fd.append('file', file)

    const res  = await fetch('/api/org/upload-logo', { method: 'POST', body: fd })
    const data = await res.json()

    if (!res.ok) { toast.error(data.error ?? 'Error al subir el logo'); setLogoUploading(false); return }

    setLogoUrl(data.url)
    setLogoUploading(false)
    toast.success('Logo actualizado')
    startTransition(() => router.refresh())
  }

  async function handleLogoDelete() {
    setLogoDeleting(true)
    const res  = await fetch('/api/org/upload-logo', { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al eliminar el logo'); setLogoDeleting(false); return }
    setLogoUrl(null)
    if (logoRef.current) logoRef.current.value = ''
    setLogoDeleting(false)
    toast.success('Logo eliminado')
    startTransition(() => router.refresh())
  }

  // ── Save org info ────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)

    const res  = await fetch('/api/org/settings', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:         name.trim(),
        bio:          bio.trim()       || null,
        city:         city.trim()      || null,
        website_url:  website.trim()   || null,
        instagram_url: instagram.trim() || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); setSaving(false); return }
    toast.success('Configuración guardada')
    setSaving(false)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-8">
      {/* ── Logo ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Logo de la productora</h2>
          <p className="text-xs text-muted-foreground">PNG, JPG o SVG · máx. 5 MB · se mostrará en la barra lateral</p>
        </div>

        <div className="flex items-center gap-5">
          {/* Preview */}
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Logo"
                width={80}
                height={80}
                className="size-full object-contain"
                unoptimized
              />
            ) : (
              <Building2 className="size-8 text-muted-foreground" />
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {canEdit && (
              <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {logoUploading
                  ? <><Loader2 className="size-4 animate-spin" /> Subiendo…</>
                  : <><Upload className="size-4" /> {logoUrl ? 'Cambiar logo' : 'Subir logo'}</>
                }
                <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden" onChange={handleLogoChange} disabled={!canEdit || logoUploading} />
              </label>
            )}
            {logoUrl && canEdit && (
              <button type="button" onClick={handleLogoDelete} disabled={logoDeleting}
                className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50">
                {logoDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {logoDeleting ? 'Eliminando…' : 'Quitar logo'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Org info ──────────────────────────────────── */}
      <form onSubmit={handleSave} className="space-y-5 border-t pt-6">
        <h2 className="text-base font-semibold">Información de la productora</h2>

        <div className="space-y-1.5">
          <label className={labelCls}><Building2 className="inline size-3.5 mr-1" />Nombre <span className="text-destructive">*</span></label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            disabled={!canEdit} placeholder="Mi Productora SRL" className={inputCls} />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}><MapPin className="inline size-3.5 mr-1" />Ciudad</label>
          <input type="text" value={city} onChange={e => setCity(e.target.value)}
            disabled={!canEdit} placeholder="Buenos Aires" className={inputCls} />
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Descripción / Bio</label>
          <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} disabled={!canEdit}
            placeholder="Productora audiovisual especializada en…"
            className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none disabled:opacity-60" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelCls}><Globe className="inline size-3.5 mr-1" />Web</label>
            <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
              disabled={!canEdit} placeholder="https://miproductora.com" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}><Instagram className="inline size-3.5 mr-1" />Instagram</label>
            <input type="url" value={instagram} onChange={e => setInstagram(e.target.value)}
              disabled={!canEdit} placeholder="https://instagram.com/miproductora" className={inputCls} />
          </div>
        </div>

        {!canEdit && (
          <p className="text-xs text-muted-foreground">Solo el owner o admin puede editar la configuración.</p>
        )}

        {canEdit && (
          <button type="submit" disabled={saving}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
      </form>
    </div>
  )
}
