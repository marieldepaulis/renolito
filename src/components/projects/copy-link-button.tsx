'use client'

import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(`${window.location.origin}${url}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copiar enlace de inscripción"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied
        ? <Check className="size-4 text-emerald-500" />
        : <Copy className="size-4" />}
    </button>
  )
}
