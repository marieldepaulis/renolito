'use client'

import { useState } from 'react'
import { Copy, Check, ExternalLink, Music } from 'lucide-react'
import Link from 'next/link'

export function ArtistLinkBanner({ artistLink }: { artistLink: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + artistLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback — select the text
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Music className="size-4 text-primary shrink-0" />
        <span className="text-xs font-medium text-primary">Link para artistas:</span>
        <span className="truncate font-mono text-xs text-muted-foreground">{artistLink}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          {copied ? 'Copiado' : 'Copiar link'}
        </button>
        <Link href={artistLink} target="_blank"
          className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
          <ExternalLink className="size-3.5" /> Ver
        </Link>
      </div>
    </div>
  )
}
