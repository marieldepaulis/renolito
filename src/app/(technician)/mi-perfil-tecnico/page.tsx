import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TechnicianProfileForm } from '@/components/technician/technician-profile-form'

export const metadata: Metadata = { title: 'Mi perfil técnico' }

export default async function MiPerfilTecnicoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: specialties }, { data: mySpecialties }] =
    await Promise.all([
      supabase
        .from('technician_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('specialties')
        .select('id, name, category')
        .order('category')
        .order('name'),
      supabase
        .from('technician_specialties')
        .select('specialty_id, years_experience, is_primary')
        .eq('user_id', user.id),
    ])

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi perfil técnico</h1>
        <p className="text-sm text-muted-foreground">
          Tu perfil público en la bolsa de trabajo y directorio de técnicos
        </p>
      </div>
      <div className="rounded-xl border bg-card p-6">
        <TechnicianProfileForm
          userId={user.id}
          existingProfile={profile}
          specialties={specialties ?? []}
          mySpecialties={mySpecialties ?? []}
        />
      </div>
    </div>
  )
}
