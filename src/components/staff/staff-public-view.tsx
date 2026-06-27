'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, FileText, Upload, X, User, Zap } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Offer {
  id: string; title: string; description: string; speciality: string
  is_paid: boolean; estimated_rate: number | null; rate_unit: string | null; rate_currency: string
  is_barter: boolean; barter_description: string | null
  required_date: string | null; location: string | null; max_applicants: number | null
}

interface Props {
  project: { id: string; title: string; description: string | null; typeName: string | null }
  offers: Offer[]
}

interface TechProfile {
  full_name: string | null
  email: string | null
  cv_url: string | null
  portfolio_url: string | null
  daily_rate: number | null
  bio: string | null
}

const inputCls = 'flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export function StaffPublicView({ project, offers }: Props) {
  const [techProfile, setTechProfile] = useState<TechProfile | null>(null)

  useEffect(() => {
    fetch('/api/me/tech-profile')
      .then(r => r.json())
      .then(data => { if (data?.email) setTechProfile(data) })
      .catch(() => null)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-sm font-medium text-muted-foreground">{project.typeName ?? 'Producción audiovisual'}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{project.title}</h1>
          {project.description && <p className="mt-2 text-base text-muted-foreground">{project.description}</p>}
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
            Convocatoria técnica · Staff
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {techProfile && (
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <User className="size-4 shrink-0" />
            <span>Sesión iniciada como <strong>{techProfile.full_name}</strong> — tu perfil técnico se cargará automáticamente.</span>
          </div>
        )}

        {offers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="font-medium">No hay puestos abiertos en este momento.</p>
            <p className="mt-1 text-sm text-muted-foreground">Volvé a revisar más tarde.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {offers.length} puesto{offers.length !== 1 ? 's' : ''} disponible{offers.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-5">
              {offers.map(offer => (
                <OfferCard key={offer.id} offer={offer} techProfile={techProfile} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function OfferCard({ offer, techProfile }: { offer: Offer; techProfile: TechProfile | null }) {
  const [fullName,     setFullName]     = useState('')
  const [email,        setEmail]        = useState('')
  const [coverNote,    setCoverNote]    = useState('')
  const [proposedRate, setProposedRate] = useState('')
  const [portfolio,    setPortfolio]    = useState('')
  const [cvFile,       setCvFile]       = useState<File | null>(null)
  const [cvUrl,        setCvUrl]        = useState<string | null>(null)
  const [cvUploading,  setCvUploading]  = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [submitted,    setSubmitted]    = useState(false)
  const [profileFilled, setProfileFilled] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Pre-fill when tech profile loads
  useEffect(() => {
    if (!techProfile || profileFilled) return
    setFullName(techProfile.full_name ?? '')
    setEmail(techProfile.email ?? '')
    setPortfolio(techProfile.portfolio_url ?? '')
    setCoverNote(techProfile.bio ?? '')
    if (techProfile.daily_rate) setProposedRate(String(techProfile.daily_rate))
    if (techProfile.cv_url) setCvUrl(techProfile.cv_url)
    setProfileFilled(true)
  }, [techProfile, profileFilled])

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
    const res = await fetch('/api/applications/upload-file', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al subir el CV'); setCvFile(null); setCvUploading(false); return }
    setCvUrl(data.url)
    setCvUploading(false)
  }

  function clearCv() {
    setCvFile(null)
    // Only clear the URL if not from saved profile
    if (!techProfile?.cv_url) setCvUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) { toast.error('Nombre y email son obligatorios'); return }
    if (cvFile && !cvUrl) { toast.error('Esperá a que termine la subida del CV'); return }
    setSubmitting(true)
    const res = await fetch('/api/staff/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offer_id:      offer.id,
        full_name:     fullName.trim(),
        email:         email.trim(),
        cover_note:    coverNote || null,
        proposed_rate: proposedRate ? Number(proposedRate) : null,
        portfolio_url: portfolio || null,
        cv_url:        cvUrl,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al enviar'); setSubmitting(false); return }
    setSubmitted(true)
    setSubmitting(false)
  }

  const usingProfile = !!techProfile && profileFilled

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">{offer.title}</h2>
          <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{offer.speciality}</span>
        </div>
        <div className="text-right shrink-0">
          {offer.is_barter ? (
            <div>
              <p className="text-sm font-semibold text-purple-700">Intercambio</p>
              {offer.barter_description && <p className="text-xs text-muted-foreground">{offer.barter_description}</p>}
            </div>
          ) : offer.is_paid && offer.estimated_rate ? (
            <p className="text-sm font-semibold text-emerald-700">
              {formatCurrency(offer.estimated_rate, offer.rate_currency)}
              {offer.rate_unit && <span className="text-xs font-normal text-muted-foreground">/{offer.rate_unit}</span>}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Colaborativo</p>
          )}
        </div>
      </div>

      {offer.description && <p className="text-sm text-muted-foreground leading-relaxed">{offer.description}</p>}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {offer.required_date && (
          <span>📅 {new Date(offer.required_date + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        )}
        {offer.location && <span>📍 {offer.location}</span>}
        {offer.max_applicants && <span>👥 Máx. {offer.max_applicants} postulantes</span>}
      </div>

      <div className="border-t pt-4">
        {submitted ? (
          <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-emerald-700">
            <CheckCircle2 className="size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">¡Postulación enviada!</p>
              <p className="text-xs">La producción revisará tu perfil y se contactará con vos. Revisá tu email para la confirmación.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Postularme a este puesto</p>
              {usingProfile && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  <Zap className="size-3" /> Datos de tu perfil
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nombre completo *</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputCls} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Presentación / experiencia relevante</label>
              <textarea rows={3} value={coverNote} onChange={e => setCoverNote(e.target.value)}
                placeholder="Contame sobre tu experiencia…"
                className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tarifa propuesta (opcional)</label>
                <input type="number" min={0} value={proposedRate} onChange={e => setProposedRate(e.target.value)}
                  placeholder="0" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Portfolio / web (opcional)</label>
                <input type="url" value={portfolio} onChange={e => setPortfolio(e.target.value)}
                  placeholder="https://…" className={inputCls} />
              </div>
            </div>

            {/* CV */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">CV / Dossier técnico (opcional · solo PDF · máx. 10 MB)</label>
              {cvUrl && !cvFile ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <FileText className="size-4 text-emerald-600 shrink-0" />
                  <span className="flex-1 truncate text-xs text-emerald-700">CV guardado en tu perfil</span>
                  <a href={cvUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 underline">Ver</a>
                  <button type="button" onClick={() => setCvUrl(null)} className="text-muted-foreground hover:text-destructive ml-1">
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : cvFile ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  {cvUploading
                    ? <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
                    : <FileText className="size-4 text-emerald-600 shrink-0" />}
                  <span className="flex-1 truncate text-xs">{cvFile.name}</span>
                  {!cvUploading && (
                    <button type="button" onClick={clearCv} className="text-muted-foreground hover:text-destructive">
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground hover:bg-accent transition-colors">
                  <Upload className="size-4" />
                  Subir CV / Dossier técnico (PDF)
                  <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleCvChange} />
                </label>
              )}
            </div>

            <button type="submit" disabled={submitting || cvUploading}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {usingProfile ? (submitting ? 'Enviando…' : 'Enviar con mi perfil') : (submitting ? 'Enviando…' : 'Enviar postulación')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
