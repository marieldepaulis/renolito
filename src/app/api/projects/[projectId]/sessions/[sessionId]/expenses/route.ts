import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params { params: Promise<{ projectId: string; sessionId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId, sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const col = UUID_RE.test(projectId) ? 'id' : 'slug'
  const { data: project } = await supabase.from('projects').select('id').eq(col, projectId).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('session_expenses')
    .select('id, category, description, amount, currency, expense_date, created_at')
    .eq('session_id', sessionId)
    .eq('project_id', project.id)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId, sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const col = UUID_RE.test(projectId) ? 'id' : 'slug'
  const { data: project } = await supabase.from('projects').select('id').eq(col, projectId).single()
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { category, description, amount, currency, expense_date } = body
  if (!description?.trim() || amount == null) {
    return NextResponse.json({ error: 'Descripción y monto son obligatorios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('session_expenses')
    .insert({
      session_id:   sessionId,
      project_id:   project.id,
      category:     category ?? 'other',
      description:  description.trim(),
      amount:       Number(amount),
      currency:     currency ?? 'EUR',
      expense_date: expense_date || null,
      created_by:   user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
