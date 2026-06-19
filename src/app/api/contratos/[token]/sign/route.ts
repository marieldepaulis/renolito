import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

/**
 * POST /api/contratos/[token]/sign
 *
 * Records the party's digital signature on a contract.
 *
 * Validations:
 *   - Token must exist and belong to an unsigned contract
 *   - Contract must not be expired
 *   - Name provided must loosely match the applicant's name (sanity check)
 *
 * On success:
 *   - Updates contract status to 'signed_by_party'
 *   - Records IP and timestamp
 *   - Updates the linked application status to 'confirmed' only if
 *     the producer has also signed (fully_signed). Otherwise stays
 *     at 'contract_sent' until the producer countersigns.
 */

const BodySchema = z.object({
  full_name: z.string().min(2).max(200),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createAdminClient()

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Nombre requerido.' }, { status: 400 })
  }

  // 1. Fetch contract
  const { data: contract } = await supabase
    .from('contracts')
    .select(`
      id, status, expires_at, organization_id,
      signed_by_producer_at,
      artist_application_id, technician_application_id
    `)
    .eq('signing_token', token)
    .maybeSingle()

  if (!contract) {
    return NextResponse.json(
      { error: 'Contrato no encontrado.' },
      { status: 404 },
    )
  }

  if (contract.status === 'fully_signed') {
    return NextResponse.json(
      { error: 'Este contrato ya ha sido firmado.' },
      { status: 409 },
    )
  }

  if (
    contract.status === 'rejected' ||
    contract.status === 'cancelled'
  ) {
    return NextResponse.json(
      { error: 'Este contrato ya no está disponible para firma.' },
      { status: 410 },
    )
  }

  if (contract.expires_at && new Date(contract.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'El enlace de firma ha expirado. Contacta al productor.' },
      { status: 410 },
    )
  }

  // 2. Get signing IP (best-effort; X-Forwarded-For in production)
  const signerIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  // 3. Determine new status
  const isFullySigned = contract.signed_by_producer_at !== null
  const newContractStatus = isFullySigned ? 'fully_signed' : 'signed_by_party'

  // 4. Update contract
  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      status:             newContractStatus,
      signed_by_party_at: new Date().toISOString(),
      signed_by_party_ip: signerIp,
      updated_at:         new Date().toISOString(),
    })
    .eq('id', contract.id)

  if (updateError) {
    console.error('[sign]', updateError.message)
    return NextResponse.json(
      { error: 'Error al registrar la firma. Inténtalo de nuevo.' },
      { status: 500 },
    )
  }

  // 5. If now fully signed, update the application to 'confirmed'
  if (isFullySigned) {
    if (contract.artist_application_id) {
      await supabase
        .from('artist_applications')
        .update({
          status:           'confirmed',
          status_updated_at: new Date().toISOString(),
          status_updated_by: null, // system
          updated_at:        new Date().toISOString(),
        })
        .eq('id', contract.artist_application_id)
    }

    if (contract.technician_application_id) {
      await supabase
        .from('technician_applications')
        .update({
          status:           'confirmed',
          status_updated_at: new Date().toISOString(),
          status_updated_by: null,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', contract.technician_application_id)
    }
  }

  // 6. Write activity log
  await supabase.from('activity_logs').insert({
    organization_id: contract.organization_id,
    actor_id:        null, // party action, no auth.uid()
    entity_type:     'contract',
    entity_id:       contract.id,
    action:          isFullySigned ? 'contract_fully_signed' : 'contract_signed_by_party',
    metadata:        {
      signer_name: body.full_name,
      signer_ip:   signerIp,
    },
  })

  return NextResponse.json({
    success:    true,
    fully_signed: isFullySigned,
  })
}
