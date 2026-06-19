import Link from 'next/link'
import { Music, Camera, Video, Mic, ArrowRight, CheckCircle2 } from 'lucide-react'

const features = [
  'Formularios de inscripción dinámicos por tipo de proyecto',
  'Flujo de preaprobación con estados en tiempo real',
  'Contratos digitales autocompletados con firma electrónica',
  'Módulo financiero con gestión de intercambios/especie',
  'Bolsa de trabajo para crew técnico',
  'Arquitectura multi-tenant (cada productora aislada)',
]

const projectTypes = [
  { icon: Music,  label: 'Musical' },
  { icon: Camera, label: 'Fotográfico' },
  { icon: Video,  label: 'Audiovisual' },
  { icon: Mic,    label: 'Podcast' },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <span className="font-semibold tracking-tight">
            Plataforma Producción
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          En desarrollo activo
        </div>
        <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
          Gestión profesional para
          <br />
          <span className="text-muted-foreground">productores independientes</span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
          Coordina artistas, crew técnico, contratos y finanzas desde un único
          panel privado. Comparte un link público y deja que los candidatos se
          inscriban solos.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Empezar gratis <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      {/* Project types */}
      <section className="border-y bg-muted/30 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <p className="mb-8 text-center text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Diseñado para todo tipo de producción
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {projectTypes.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-5" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight">
          Todo lo que necesitas en un solo lugar
        </h2>
        <ul className="mx-auto grid max-w-2xl gap-3">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
              <span className="text-muted-foreground">{f}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Plataforma de Producción Audiovisual
      </footer>
    </main>
  )
}
