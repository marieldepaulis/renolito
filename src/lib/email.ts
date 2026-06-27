export async function sendEmail(options: {
  to:      string
  subject: string
  html:    string
}): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — skipping:', options.subject)
    return
  }
  const { Resend } = await import('resend')
  const resend = new Resend(key)
  await resend.emails.send({
    from:    process.env.EMAIL_FROM ?? 'Renolito Sessions <noreply@renolito.com>',
    to:      options.to,
    subject: options.subject,
    html:    options.html,
  })
}
