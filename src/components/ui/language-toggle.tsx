'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

export function LanguageToggle() {
  const locale             = useLocale()
  const router             = useRouter()
  const [pending, startTr] = useTransition()

  async function toggle() {
    const next = locale === 'es' ? 'en' : 'es'
    await fetch('/api/locale', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ locale: next }),
    })
    startTr(() => { router.refresh() })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={locale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50 disabled:opacity-50"
    >
      <span className="text-base leading-none">{locale === 'es' ? '🇬🇧' : '🇪🇸'}</span>
      <span>{locale === 'es' ? 'English' : 'Español'}</span>
    </button>
  )
}
