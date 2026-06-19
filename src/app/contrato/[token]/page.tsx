import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContractSigningPanel } from '@/components/contracts/contract-signing-panel'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Firma de contrato' }

interface Props {
  params: Promise<{ token: string }>
}

interface ContractData {
  status:             string
  already_signed:     boolean
  producer_signed:    boolean
  party_name:         string
  project_title:      string
  project_type:       string
  organization_name:  string
  organization_city:  string
  session_title:      string | null
  session_date:       string | null
  session_start_time: string | null
  custom_clauses:     string | null
  notes:              string | null
}

async function getContract(token: string): Promise<ContractData | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `http://localhost:${process.env.PORT ?? 3000}`

  const res = await fetch(`${baseUrl}/api/contratos/${token}`, {
    cache: 'no-store',
  })

  if (!res.ok) return null
  return res.json()
}

export default async function ContratoPage({ params }: Props) {
  const { token } = await params
  const data = await getContract(token)

  if (!data) notFound()

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {data.organization_name} · {data.organization_city}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Contrato de participación
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.project_title} · {data.project_type}
          </p>
        </div>

        {/* Contract body */}
        <div className="rounded-xl border bg-card p-6 space-y-4 text-sm leading-relaxed">
          <p>
            Por medio del presente instrumento, <strong>{data.organization_name}</strong> y{' '}
            <strong>{data.party_name}</strong> acuerdan los términos de participación en el
            proyecto <em>{data.project_title}</em>.
          </p>

          {data.session_title && data.session_date && (
            <p>
              <strong>Sesión asignada:</strong> {data.session_title} —{' '}
              {formatDate(data.session_date, {
                weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
              })}
              {data.session_start_time && ` a las ${data.session_start_time.slice(0, 5)}`}
            </p>
          )}

          {data.custom_clauses && (
            <div>
              <p className="font-medium">Cláusulas adicionales:</p>
              <div className="mt-1 whitespace-pre-line text-muted-foreground">
                {data.custom_clauses}
              </div>
            </div>
          )}

          {data.notes && (
            <div>
              <p className="font-medium">Notas:</p>
              <p className="text-muted-foreground">{data.notes}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground border-t pt-3">
            Al firmar este documento de forma digital aceptas todos los términos
            anteriores. Tu firma quedará registrada con fecha, hora y dirección IP.
          </p>
        </div>

        {/* Signing panel */}
        <ContractSigningPanel
          token={token}
          partyName={data.party_name}
          alreadySigned={data.already_signed}
          fullySignedAlready={data.status === 'fully_signed'}
        />
      </div>
    </div>
  )
}
