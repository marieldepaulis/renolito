import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(null)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  const { data: tech } = await supabase
    .from('technician_profiles')
    .select('id, bio, cv_url, portfolio_url, daily_rate, rate_currency')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    full_name:     profile?.full_name ?? null,
    email:         profile?.email ?? null,
    cv_url:        (tech as unknown as { cv_url?: string } | null)?.cv_url ?? null,
    portfolio_url: (tech as unknown as { portfolio_url?: string } | null)?.portfolio_url ?? null,
    daily_rate:    (tech as unknown as { daily_rate?: number } | null)?.daily_rate ?? null,
    bio:           (tech as unknown as { bio?: string } | null)?.bio ?? null,
  })
}
