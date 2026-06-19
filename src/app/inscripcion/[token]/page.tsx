import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicRegistrationForm } from '@/components/forms/public-registration-form'

export const metadata: Metadata = { title: 'Inscripción' }

interface Props {
  params: Promise<{ token: string }>
}

interface ProjectData {
  project: {
    title: string
    description: string | null
    type: { id: string; name: string; slug: string }
  }
  fields: Array<{
    field_key: string
    label: string
    field_type: string
    placeholder: string | null
    helper_text: string | null
    is_required: boolean
    options: Array<{ value: string; label: string }> | null
    display_order: number
  }>
  sessions: Array<{
    id: string
    title: string
    scheduled_date: string
    start_time: string | null
  }>
}

async function getProjectData(token: string): Promise<ProjectData | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `http://localhost:${process.env.PORT ?? 3000}`

  const res = await fetch(`${baseUrl}/api/inscripcion/${token}`, {
    next: { revalidate: 60 }, // Cache for 60s — form fields rarely change
  })

  if (!res.ok) return null
  return res.json()
}

export default async function InscripcionPage({ params }: Props) {
  const { token } = await params
  const data = await getProjectData(token)

  if (!data) notFound()

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Project header */}
        <div className="mb-10 space-y-2 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {data.project.type.name}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            {data.project.title}
          </h1>
          {data.project.description && (
            <p className="text-muted-foreground">{data.project.description}</p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <PublicRegistrationForm
            token={token}
            fields={data.fields}
            sessions={data.sessions}
          />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Al enviar este formulario recibirás un email con un enlace para
          seguir el estado de tu inscripción en tiempo real.
        </p>
      </div>
    </div>
  )
}
