import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const where: any = {}

  if (searchParams.get('district')) where.district = searchParams.get('district')
  if (searchParams.get('stage')) where.declaredStage = searchParams.get('stage')

  const band = searchParams.get('band')
  const unscored = searchParams.get('unscored')
  
  if (band || unscored === 'true') {
    where.assessments = { some: {} }
    if (band) where.assessments.some.band = band
    if (unscored === 'true') where.assessments.some.band = 'unscored'
  }

  const candidates = await prisma.candidate.findMany({
    where,
    include: { assessments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' }
  })

  let csv = 'externalId,district,block,persona,stage,band\n'
  for (const c of candidates) {
    const asm = c.assessments[0]
    const bandValue = asm?.band || 'unscored'
    csv += `${c.externalId},${c.district},${c.block},${c.persona},${c.declaredStage},${bandValue}\n`
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="candidates.csv"'
    }
  })
}
