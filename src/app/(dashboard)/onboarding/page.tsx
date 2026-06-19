import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm } from '@/components/onboarding/onboarding-form'

export const metadata: Metadata = { title: 'Configura tu organización' }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // If they already have an org, skip onboarding
  const { data: membership } = await supabase
    .from('org_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membership) redirect('/dashboard')

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Bienvenido/a</h1>
          <p className="text-sm text-muted-foreground">
            Crea tu organización productora para comenzar
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <OnboardingForm userId={user.id} />
        </div>
      </div>
    </div>
  )
}
