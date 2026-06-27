import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const Schema = z.object({
  offer_id:      z.string().uuid(),
  full_name:     z.string().min(2).max(200),
  email:         z.string().email(),
  cover_note:    z.preprocess((v) => v === '' ? null : v, z.string().max(3000).nullable().optional()),
  proposed_rate: z.preprocess((v) => (v === '' || v == null) ? null : Number(v), z.number().positive().nullable().optional()),
  portfolio_url: z.preprocess((v) => v === '' ? null : v, z.string().url().nullable().optional()),
  cv_url:        z.preprocess((v) => v === '' ? null : v, z.string().url().nullable().optional()),
})

export async function POST(request: Request) {
  let body: z.infer<typeof Schema>
  try { body = Schema.parse(await request.json()) }
  catch (e: unknown) {
    const msg = e instanceof z.ZodError ? e.errors[0]?.message : 'Datos inválidos.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify offer exists and is open — include project and org owner email
  const { data: offer } = await admin
    .from('job_offers')
    .select(`
      id, title, organization_id, status, max_applicants,
      projects(id, title),
      organizations(name, owner_id)
    `)
    .eq('id', body.offer_id)
    .eq('status', 'open')
    .maybeSingle()

  if (!offer) return NextResponse.json({ error: 'Esta oferta ya no está disponible.' }, { status: 404 })

  const o = offer as unknown as {
    id: string; title: string; organization_id: string; max_applicants: number | null
    projects: { id: string; title: string } | null
    organizations: { name: string; owner_id: string } | null
  }

  // Check duplicate
  const { data: existing } = await admin
    .from('staff_applications')
    .select('id')
    .eq('job_offer_id', body.offer_id)
    .eq('email', body.email.toLowerCase())
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Ya enviaste una postulación para este puesto.' }, { status: 409 })

  // Check max applicants
  if (o.max_applicants) {
    const { count } = await admin
      .from('staff_applications')
      .select('id', { count: 'exact', head: true })
      .eq('job_offer_id', body.offer_id)
    if ((count ?? 0) >= o.max_applicants) {
      return NextResponse.json({ error: 'Este puesto ya alcanzó el límite de postulantes.' }, { status: 409 })
    }
  }

  const { error } = await admin.from('staff_applications').insert({
    job_offer_id:    body.offer_id,
    organization_id: o.organization_id,
    full_name:       body.full_name,
    email:           body.email.toLowerCase(),
    cover_note:      body.cover_note ?? null,
    proposed_rate:   body.proposed_rate ?? null,
    portfolio_url:   body.portfolio_url ?? null,
    cv_url:          body.cv_url ?? null,
  })

  if (error) {
    if (error.message.includes('staff_applications')) {
      return NextResponse.json({ error: 'El sistema de postulaciones está en mantenimiento. Intentá más tarde.' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notify org owner by email
  if (o.organizations?.owner_id) {
    const { data: ownerProfile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('id', o.organizations.owner_id)
      .single()

    if (ownerProfile) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://renolito-delta.vercel.app'
      const projectId = o.projects?.id
      const staffUrl = projectId ? `${appUrl}/projects/${projectId}/staff` : `${appUrl}/dashboard`

      await admin.from('email_notifications').insert({
        organization_id: o.organization_id,
        recipient_email: (ownerProfile as unknown as { email: string }).email,
        recipient_name:  (ownerProfile as unknown as { full_name: string }).full_name,
        template_name:   'new_staff_application',
        subject:         `Nueva postulación: ${body.full_name} se postuló para "${o.title}"`,
        body_html:       buildNotificationEmail({
          ownerName:    (ownerProfile as unknown as { full_name: string }).full_name,
          applicantName: body.full_name,
          applicantEmail: body.email,
          offerTitle:   o.title,
          projectTitle: o.projects?.title ?? '',
          coverNote:    body.cover_note ?? null,
          proposedRate: body.proposed_rate ?? null,
          portfolioUrl: body.portfolio_url ?? null,
          cvUrl:        body.cv_url ?? null,
          staffUrl,
        }),
        metadata: { job_offer_id: body.offer_id },
      }) // fire-and-forget — errors here don't fail the request
    }
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

function buildNotificationEmail(data: {
  ownerName: string; applicantName: string; applicantEmail: string
  offerTitle: string; projectTitle: string
  coverNote: string | null; proposedRate: number | null
  portfolioUrl: string | null; cvUrl: string | null
  staffUrl: string
}) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;max-width:580px;margin:0 auto;padding:24px;color:#1a1a1a;background:#fff">
  <div style="border-bottom:2px solid #18181b;padding-bottom:16px;margin-bottom:24px">
    <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a">Renolito Sessions</p>
  </div>

  <h2 style="margin:0 0 4px">Nueva postulación recibida</h2>
  <p style="margin:0 0 24px;color:#71717a">Para la oferta <strong style="color:#1a1a1a">${data.offerTitle}</strong>${data.projectTitle ? ` · ${data.projectTitle}` : ''}</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <tr>
      <td style="padding:10px 12px;background:#f4f4f5;border-radius:6px 6px 0 0;border-bottom:1px solid #e4e4e7">
        <p style="margin:0;font-size:12px;color:#71717a;font-weight:500">NOMBRE</p>
        <p style="margin:4px 0 0;font-size:15px;font-weight:600">${data.applicantName}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:10px 12px;background:#f4f4f5;border-bottom:1px solid #e4e4e7">
        <p style="margin:0;font-size:12px;color:#71717a;font-weight:500">EMAIL</p>
        <p style="margin:4px 0 0;font-size:15px"><a href="mailto:${data.applicantEmail}" style="color:#18181b">${data.applicantEmail}</a></p>
      </td>
    </tr>
    ${data.proposedRate ? `
    <tr>
      <td style="padding:10px 12px;background:#f4f4f5;border-bottom:1px solid #e4e4e7">
        <p style="margin:0;font-size:12px;color:#71717a;font-weight:500">TARIFA PROPUESTA</p>
        <p style="margin:4px 0 0;font-size:15px">${data.proposedRate}</p>
      </td>
    </tr>` : ''}
    ${data.coverNote ? `
    <tr>
      <td style="padding:10px 12px;background:#f4f4f5;border-radius:0 0 6px 6px">
        <p style="margin:0;font-size:12px;color:#71717a;font-weight:500">PRESENTACIÓN</p>
        <p style="margin:4px 0 0;font-size:14px;line-height:1.5;white-space:pre-wrap">${data.coverNote}</p>
      </td>
    </tr>` : ''}
  </table>

  ${(data.portfolioUrl || data.cvUrl) ? `
  <div style="margin-bottom:24px;display:flex;gap:8px;flex-wrap:wrap">
    ${data.portfolioUrl ? `<a href="${data.portfolioUrl}" style="display:inline-block;padding:8px 14px;border:1px solid #e4e4e7;border-radius:6px;font-size:13px;font-weight:500;text-decoration:none;color:#18181b">🔗 Portfolio / Web</a>` : ''}
    ${data.cvUrl ? `<a href="${data.cvUrl}" style="display:inline-block;padding:8px 14px;border:1px solid #e4e4e7;border-radius:6px;font-size:13px;font-weight:500;text-decoration:none;color:#18181b">📄 Descargar CV</a>` : ''}
  </div>` : ''}

  <a href="${data.staffUrl}" style="display:inline-block;background:#18181b;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
    Ver todas las postulaciones →
  </a>

  <hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0 16px" />
  <p style="color:#71717a;font-size:12px;margin:0">Este email fue generado automáticamente por Renolito Sessions.</p>
</body>
</html>`.trim()
}
