import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'

const BUCKET = 'applications-cvs'
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Formato inválido. Usa multipart/form-data.' }, { status: 400 })
  }

  let formData: FormData
  try { formData = await request.formData() }
  catch { return NextResponse.json({ error: 'Error al leer el archivo.' }, { status: 400 }) }

  const file = formData.get('file')
  const kind = (formData.get('kind') as string | null) ?? 'cv' // 'cv' | 'presskit'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el límite de 10 MB.' }, { status: 413 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Solo se aceptan archivos PDF.' }, { status: 415 })
  }

  const ext  = 'pdf'
  const path = `${kind}/${randomUUID()}.${ext}`

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'application/pdf', upsert: false })

  if (uploadError) {
    if (uploadError.message.toLowerCase().includes('bucket')) {
      return NextResponse.json({
        error: 'El bucket de almacenamiento aún no fue creado. Seguí las instrucciones de la migración 004.',
      }, { status: 503 })
    }
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({ url: publicData.publicUrl }, { status: 201 })
}
