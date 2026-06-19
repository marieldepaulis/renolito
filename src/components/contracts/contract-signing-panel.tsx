'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, Lock } from 'lucide-react'

interface Props {
  token:               string
  partyName:           string
  alreadySigned:       boolean
  fullySignedAlready:  boolean
}

const Schema = z.object({
  full_name: z.string().min(2, 'Escribe tu nombre completo para confirmar'),
})
type FormData = z.infer<typeof Schema>

export function ContractSigningPanel({ token, partyName, alreadySigned, fullySignedAlready }: Props) {
  const [loading,     setLoading]     = useState(false)
  const [signed,      setSigned]      = useState(alreadySigned)
  const [fullySigned, setFullySigned] = useState(fullySignedAlready)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(Schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)

    const res = await fetch(`/api/contratos/${token}/sign`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ full_name: data.full_name }),
    })

    const result = await res.json()

    if (!res.ok) {
      toast.error(result.error ?? 'Error al registrar la firma')
      setLoading(false)
      return
    }

    setSigned(true)
    setFullySigned(result.fully_signed)
    setLoading(false)
  }

  if (signed) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-3">
        <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
        <h2 className="font-semibold">Firma registrada</h2>
        {fullySigned ? (
          <p className="text-sm text-muted-foreground">
            Ambas partes han firmado. El contrato está completamente validado.
            Recibirás una copia por email.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tu firma fue registrada correctamente. El contrato quedará confirmado
            una vez que el productor también lo firme.
          </p>
        )}
      </div>
    )
  }

  if (fullySignedAlready) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-3">
        <Lock className="mx-auto size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Este contrato ya fue firmado por ambas partes.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold">Firma digital</h2>
        <p className="text-sm text-muted-foreground">
          Escribe tu nombre completo tal como aparece en el contrato para confirmar
          que aceptas los términos.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="full_name" className="text-sm font-medium">
            Nombre completo <span className="text-destructive">*</span>
          </label>
          <input
            id="full_name"
            type="text"
            autoComplete="name"
            placeholder={partyName}
            {...register('full_name')}
            className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {errors.full_name && (
            <p className="text-xs text-destructive">{errors.full_name.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Firmar contrato
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Esta firma digital tiene validez legal. Se registrará tu nombre, IP y
          la fecha exacta de la firma.
        </p>
      </form>
    </div>
  )
}
