'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Upload, FileText, X, CheckCircle2,
  Globe, Instagram, Linkedin, Film, MapPin, Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Specialty {
  id:       string
  name:     string
  category: string
}

interface MySpecialty {
  specialty_id:     string
  years_experience: number | null
  is_primary:       boolean
}

// Column names as they exist in the real DB schema
interface TechnicianProfile {
  id:                   string
  bio:                  string | null
  hourly_rate:          number | null  // added via migration
  daily_rate:           number | null  // original column name
  rate_currency:        string         // original column name
  is_available_for_hire: boolean       // original column name
  availability_notes:   string | null  // added via migration
  website_url:          string | null
  instagram_url:        string | null
  linkedin_url:         string | null
  showreel_url:         string | null
  portfolio_url:        string | null
  equipment_description: string | null
  location:             string | null  // added via migration
  cv_url:               string | null  // added via migration
}

interface Props {
  userId:          string
  existingProfile: TechnicianProfile | null
  specialties:     Specialty[]
  mySpecialties:   MySpecialty[]
}

const inputCls  = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const labelCls  = 'text-sm font-medium'
const sectionCls = 'space-y-3 border-t pt-5'

export function TechnicianProfileForm({ userId, existingProfile, specialties, mySpecialties }: Props) {
  const supabase = createClient()

  // Form state (direct controlled inputs — no react-hook-form needed for this)
  const [bio,            setBio]            = useState(existingProfile?.bio ?? '')
  const [hourlyRate,     setHourlyRate]     = useState(existingProfile?.hourly_rate?.toString() ?? '')
  const [dailyRate,      setDailyRate]      = useState(existingProfile?.daily_rate?.toString() ?? '')
  const [currency,       setCurrency]       = useState(existingProfile?.rate_currency ?? 'EUR')
  const [isAvailable,    setIsAvailable]    = useState(existingProfile?.is_available_for_hire ?? false)
  const [availNotes,     setAvailNotes]     = useState(existingProfile?.availability_notes ?? '')
  const [location,       setLocation]       = useState(existingProfile?.location ?? '')
  const [websiteUrl,     setWebsiteUrl]     = useState(existingProfile?.website_url ?? '')
  const [instagramUrl,   setInstagramUrl]   = useState(existingProfile?.instagram_url ?? '')
  const [linkedinUrl,    setLinkedinUrl]    = useState(existingProfile?.linkedin_url ?? '')
  const [showreelUrl,    setShowreelUrl]    = useState(existingProfile?.showreel_url ?? '')
  const [equipment,      setEquipment]      = useState(existingProfile?.equipment_description ?? '')

  // Specialties
  const [selectedIds, setSelectedIds] = useState<string[]>(
    mySpecialties.map(s => s.specialty_id)
  )

  // CV upload
  const [cvFile,      setCvFile]      = useState<File | null>(null)
  const [cvUrl,       setCvUrl]       = useState<string | null>(existingProfile?.cv_url ?? null)
  const [cvUploading, setCvUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)

  // ── CV upload ────────────────────────────────────────────
  async function handleCvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { toast.error('Solo se aceptan archivos PDF'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('El archivo supera 10 MB'); return }
    setCvFile(file)
    setCvUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', 'cv')
    const res  = await fetch('/api/applications/upload-file', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al subir el CV'); setCvFile(null); setCvUploading(false); return }
    setCvUrl(data.url)
    setCvUploading(false)
    toast.success('CV subido correctamente')
  }

  function clearCv() {
    setCvFile(null)
    setCvUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Specialties toggle ───────────────────────────────────
  function toggleSpecialty(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  // ── Submit ───────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (cvFile && !cvUrl) { toast.error('Esperá a que termine la subida del CV'); return }
    setLoading(true)

    // 1. Upsert technician_profiles using real column names
    const profilePayload: Record<string, unknown> = {
      user_id:              userId,
      bio:                  bio || null,
      hourly_rate:          hourlyRate ? Number(hourlyRate) : null,
      daily_rate:           dailyRate  ? Number(dailyRate)  : null,
      rate_currency:        currency,
      is_available_for_hire: isAvailable,
      website_url:          websiteUrl   || null,
      instagram_url:        instagramUrl || null,
      linkedin_url:         linkedinUrl  || null,
      showreel_url:         showreelUrl  || null,
      equipment_description: equipment  || null,
    }

    // These columns exist only after migrations — add them safely
    if (availNotes !== undefined)  profilePayload.availability_notes = availNotes || null
    if (location   !== undefined)  profilePayload.location           = location   || null
    if (cvUrl      !== undefined)  profilePayload.cv_url             = cvUrl

    const { data: upserted, error: profileError } = await supabase
      .from('technician_profiles')
      .upsert(profilePayload, { onConflict: 'user_id' })
      .select('id')
      .single()

    if (profileError) {
      // Retry without migration-added columns if they don't exist yet
      if (
        profileError.message.includes('availability_notes') ||
        profileError.message.includes('location') ||
        profileError.message.includes('cv_url') ||
        profileError.message.includes('hourly_rate')
      ) {
        const { data: u2, error: e2 } = await supabase
          .from('technician_profiles')
          .upsert({
            user_id:              userId,
            bio:                  bio || null,
            daily_rate:           dailyRate ? Number(dailyRate) : null,
            rate_currency:        currency,
            is_available_for_hire: isAvailable,
            website_url:          websiteUrl   || null,
            instagram_url:        instagramUrl || null,
            linkedin_url:         linkedinUrl  || null,
            showreel_url:         showreelUrl  || null,
            equipment_description: equipment  || null,
          }, { onConflict: 'user_id' })
          .select('id').single()
        if (e2) { toast.error('Error al guardar el perfil: ' + e2.message); setLoading(false); return }
        await saveSpecialties(u2!.id)
      } else {
        toast.error('Error al guardar el perfil: ' + profileError.message)
        setLoading(false)
        return
      }
    } else {
      await saveSpecialties(upserted!.id)
    }

    toast.success('Perfil guardado correctamente')
    setLoading(false)
  }

  // Specialties use technician_profiles.id (not user_id!)
  async function saveSpecialties(profileId: string) {
    const prevIds  = mySpecialties.map(s => s.specialty_id)
    const toDelete = prevIds.filter(id => !selectedIds.includes(id))
    const toInsert = selectedIds.filter(id => !prevIds.includes(id))

    if (toDelete.length > 0) {
      await supabase
        .from('technician_specialties')
        .delete()
        .eq('technician_id', profileId)
        .in('specialty_id', toDelete)
    }

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from('technician_specialties')
        .insert(toInsert.map(id => ({
          technician_id: profileId,
          specialty_id:  id,
          is_primary:    false,
        })))
      if (error) toast.error('Error al guardar especialidades: ' + error.message)
    }
  }

  const grouped = specialties.reduce<Record<string, Specialty[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Disponibilidad ────────────────────────── */}
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <button
          type="button"
          role="switch"
          aria-checked={isAvailable}
          onClick={() => setIsAvailable(v => !v)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            isAvailable ? 'bg-emerald-500' : 'bg-input'
          }`}
        >
          <span className={`pointer-events-none inline-block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
            isAvailable ? 'translate-x-4' : 'translate-x-0'
          }`} />
        </button>
        <div>
          <p className="text-sm font-medium leading-none">
            {isAvailable ? '✅ Disponible para contratar' : 'No disponible actualmente'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Controla si aparecés en el directorio de técnicos</p>
        </div>
      </div>

      {/* ── Bio ─────────────────────────────────────── */}
      <div className="space-y-1.5">
        <label className={labelCls}>Bio profesional</label>
        <textarea rows={4} value={bio} onChange={e => setBio(e.target.value)}
          placeholder="Contá sobre tu experiencia, proyectos destacados y lo que te diferencia…"
          className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
      </div>

      {/* ── Ubicación y disponibilidad ────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelCls}><MapPin className="inline size-3.5 mr-1" />Ubicación</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Buenos Aires, Argentina" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}><Clock className="inline size-3.5 mr-1" />Nota de disponibilidad</label>
          <input type="text" value={availNotes} onChange={e => setAvailNotes(e.target.value)}
            placeholder="Disponible fines de semana…" className={inputCls} />
        </div>
      </div>

      {/* ── Tarifas ───────────────────────────────── */}
      <div className={sectionCls}>
        <p className="text-sm font-semibold">Tarifas</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Tarifa por hora</label>
            <input type="number" min={0} value={hourlyRate} onChange={e => setHourlyRate(e.target.value)}
              placeholder="0" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Tarifa por día</label>
            <input type="number" min={0} value={dailyRate} onChange={e => setDailyRate(e.target.value)}
              placeholder="0" className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Moneda</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — Libra esterlina</option>
              <option value="USD">USD — Dólar</option>
              <option value="CHF">CHF — Franco suizo</option>
              <option value="ARS">ARS — Peso arg.</option>
              <option value="MXN">MXN — Peso mex.</option>
              <option value="BRL">BRL — Real</option>
              <option value="COP">COP — Peso col.</option>
              <option value="GBP">GBP — Libra</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Especialidades ─────────────────────────── */}
      <div className={sectionCls}>
        <p className="text-sm font-semibold">Especialidades</p>
        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay especialidades cargadas en el sistema todavía.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map(s => (
                    <button key={s.id} type="button" onClick={() => toggleSpecialty(s.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selectedIds.includes(s.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'border hover:bg-accent'
                      }`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {selectedIds.length > 0 && (
          <p className="text-xs text-muted-foreground">{selectedIds.length} especialidad{selectedIds.length !== 1 ? 'es' : ''} seleccionada{selectedIds.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* ── Equipo ────────────────────────────────── */}
      <div className={sectionCls}>
        <p className="text-sm font-semibold">Equipamiento propio</p>
        <textarea rows={3} value={equipment} onChange={e => setEquipment(e.target.value)}
          placeholder="Cámara Sony FX3, lentes Sigma Art, monitor de campo, trípode…"
          className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
      </div>

      {/* ── Links ─────────────────────────────────── */}
      <div className={sectionCls}>
        <p className="text-sm font-semibold">Links</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ['websiteUrl',   websiteUrl,   setWebsiteUrl,   Globe,      'https://mipagina.com',       'Web / Portfolio'],
            ['showreelUrl',  showreelUrl,  setShowreelUrl,  Film,       'https://vimeo.com/...',       'Showreel'],
            ['instagramUrl', instagramUrl, setInstagramUrl, Instagram,  'https://instagram.com/...',   'Instagram'],
            ['linkedinUrl',  linkedinUrl,  setLinkedinUrl,  Linkedin,   'https://linkedin.com/in/...', 'LinkedIn'],
          ] as const).map(([key, value, setter, Icon, placeholder, label]) => (
            <div key={key} className="space-y-1.5">
              <label className={labelCls}><Icon className="inline size-3.5 mr-1" />{label}</label>
              <input type="url" value={value} onChange={e => setter(e.target.value)}
                placeholder={placeholder} className={inputCls} />
            </div>
          ))}
        </div>
      </div>

      {/* ── CV / Dossier ───────────────────────────── */}
      <div className={sectionCls}>
        <p className="text-sm font-semibold">CV / Dossier técnico</p>
        <p className="text-xs text-muted-foreground">Subí tu CV en PDF para que las producciones puedan descargarlo directamente desde tu perfil.</p>

        {cvUrl ? (
          <div className="flex items-center gap-3 rounded-lg border bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-700">CV subido</p>
              <a href={cvUrl} target="_blank" rel="noopener noreferrer"
                className="truncate text-xs text-emerald-600 hover:underline">{cvUrl}</a>
            </div>
            <button type="button" onClick={clearCv}
              className="shrink-0 text-muted-foreground hover:text-destructive">
              <X className="size-4" />
            </button>
          </div>
        ) : cvFile && cvUploading ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-xs">{cvFile.name}</span>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground hover:bg-accent transition-colors">
            <Upload className="size-4" />
            Subir CV o Dossier (PDF · máx. 10 MB)
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleCvChange} />
          </label>
        )}
      </div>

      <button type="submit" disabled={loading || cvUploading}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50">
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? 'Guardando…' : 'Guardar perfil'}
      </button>
    </form>
  )
}
