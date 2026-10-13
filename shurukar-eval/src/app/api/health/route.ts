import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Unauthenticated liveness check for the container: app up, database reachable. */
export async function GET() {
  try {
    await prisma.candidate.count()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
