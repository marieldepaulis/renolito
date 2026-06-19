import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FileText } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Contratos' }

interface Props {
  params: Promise<{ projectId: string }>
}

const CONTRACT_STATUS: Record<string, { label: string; class: string }> = {
  draft:           { label: 'Borrador',        class: 'bg-zinc-100 text-zinc-600' },
  sent:            { label: 'Enviado',          class: 'bg-blue-100 text-blue-700' },
  viewed:          { label: 'Visto',            class: 'bg-yellow-100 text-yellow-700' },
  signed_by_party: { label: 'Firmado (parte)',  class: 'bg-orange-100 text-orange-700' },
  fully_signed:    { label: 'Firmado',          class: 'bg-emerald-100 text-emerald-700' },
  rejected:        { label: 'Rechazado',        class: 'bg-red-100 text-red-600' },
  cancelled:       { label: 'Cancelado',        class: 'bg-zinc-100 text-zinc-400' },
}

export default async function ContratosPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('id, title, organization_id')
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  // Fetch contracts linked to artist applications of this project
  const { data: contracts } = await supabase
    .from('contracts')
    .select(`
      id, status, sent_at, signed_by_party_at, fully_signed:signed_by_producer_at,
      created_at, expires_at,
      artist_applications!artist_application_id(
        guest_name, guest_email
      ),
      technician_applications!technician_application_id(
        technician_profiles(profiles(full_name, email))
      )
    `)
    .eq('organization_id', project.organization_id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/projects/${projectId}`} className="hover:text-foreground">
            {project.title}
          </Link>
          <span>/</span>
          <span>Contratos</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Contratos</h1>
        <p className="text-sm text-muted-foreground">
          {contracts?.length ?? 0} contratos generados
        </p>
      </div>

      {!contracts || contracts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <FileText className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Los contratos se generan automáticamente al preaporbar una inscripción.
          </p>
          <Link
            href={`/projects/${projectId}/inscripciones`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Ver inscripciones
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Persona</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Enviado</th>
                <th className="px-5 py-3 font-medium">Firmado</th>
                <th className="px-5 py-3 font-medium">Expira</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contracts.map((contract) => {
                const artistApp = contract.artist_applications as unknown as {
                  guest_name: string; guest_email: string
                } | null
                const techApp = contract.technician_applications as unknown as {
                  technician_profiles: {
                    profiles: { full_name: string; email: string } | null
                  } | null
                } | null
                const name = artistApp?.guest_name
                  ?? techApp?.technician_profiles?.profiles?.full_name
                  ?? '—'
                const status = CONTRACT_STATUS[contract.status]
                return (
                  <tr key={contract.id} className="transition-colors hover:bg-accent">
                    <td className="px-5 py-3.5 font-medium">{name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.class}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {contract.sent_at
                        ? formatDate(contract.sent_at, { day: '2-digit', month: 'short' })
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {contract.signed_by_party_at
                        ? formatDate(contract.signed_by_party_at, { day: '2-digit', month: 'short' })
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {contract.expires_at
                        ? formatDate(contract.expires_at, { day: '2-digit', month: 'short' })
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
