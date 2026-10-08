import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { questionSetVersion } from '@/lib/laya/questionSets'
import { runPipelineForCohort } from '@/lib/pipeline'

/**
 * Scores candidates on demand, so a reviewer never has to reach for a terminal.
 *
 * Three scopes:
 *   unscored  — never banded, OR banded against a question set that is no
 *               longer the current one. Both are the same problem from a
 *               reviewer's chair: there is no usable score on this row now.
 *   stale     — only the version mismatch.
 *   all       — re-score the cohort.
 *
 * Long-running by nature: Laya takes roughly half a second to a second per
 * question per candidate, so a cohort of 50 is minutes, not seconds.
 */
export const maxDuration = 600
export const dynamic = 'force-dynamic'

type Scope = 'pending' | 'stale' | 'all'

/**
 * Running the pipeline again only helps a candidate the pipeline has not yet
 * seen under the current question set. It CANNOT rescue one that ran and came
 * back `unscored`: that outcome means spam, a dossier too thin to band on, or a
 * decisive answer the model could not separate from chance. Those need a human
 * or better intake, and re-running them is a hundred seconds that changes
 * nothing — which is exactly what the first version of this endpoint did.
 *
 *   pending — never assessed, or assessed against a superseded question set.
 *             The only scope where another run is the right answer.
 *   stale   — only the version mismatch.
 *   all     — re-score everything, including the unscoreable.
 */
async function candidateIdsFor(scope: Scope): Promise<string[]> {
  if (scope === 'all') {
    const all = await prisma.candidate.findMany({ select: { id: true } })
    return all.map((c) => c.id)
  }

  const version = questionSetVersion()
  const candidates = await prisma.candidate.findMany({
    select: {
      id: true,
      assessments: {
        where: { isLatest: true },
        select: { band: true, questionSetVersion: true },
        take: 1,
      },
    },
  })

  return candidates
    .filter((c) => {
      const latest = c.assessments[0]
      if (!latest) return true
      const stale = latest.questionSetVersion !== version
      if (scope === 'stale') return stale
      return stale
    })
    .map((c) => c.id)
}

/**
 * Ran under the current question set and still could not be banded. Counted
 * separately so the UI never offers a button that cannot change them.
 */
async function unscoreableCount(): Promise<number> {
  return prisma.assessment.count({
    where: { isLatest: true, band: 'unscored', questionSetVersion: questionSetVersion() },
  })
}

export async function GET() {
  const [pending, stale, unscoreable, total] = await Promise.all([
    candidateIdsFor('pending'),
    candidateIdsFor('stale'),
    unscoreableCount(),
    prisma.candidate.count(),
  ])
  return NextResponse.json({
    questionSetVersion: questionSetVersion(),
    pending: pending.length,
    stale: stale.length,
    unscoreable,
    total,
    layaConfigured: Boolean(process.env.LAYA_API_KEY),
  })
}

export async function POST(request: Request) {
  let scope: Scope = 'pending'
  try {
    const body = (await request.json()) as { scope?: Scope }
    if (body.scope === 'all' || body.scope === 'stale' || body.scope === 'pending') {
      scope = body.scope
    }
  } catch {
    // An empty body means the default scope. Not an error.
  }

  const ids = await candidateIdsFor(scope)
  if (ids.length === 0) {
    return NextResponse.json({ scope, requested: 0, scored: 0, stillUnscored: 0, bands: {} })
  }

  const started = Date.now()
  try {
    const assessments = await runPipelineForCohort(ids)
    const bands: Record<string, number> = {}
    for (const a of assessments) bands[a.band] = (bands[a.band] ?? 0) + 1

    return NextResponse.json({
      scope,
      requested: ids.length,
      scored: assessments.length,
      stillUnscored: bands.unscored ?? 0,
      bands,
      elapsedMs: Date.now() - started,
      questionSetVersion: questionSetVersion(),
      // Laya being down is not an error here: every candidate lands `unscored`,
      // which is the correct visible state rather than a failed request.
      layaConfigured: Boolean(process.env.LAYA_API_KEY),
    })
  } catch (err) {
    return NextResponse.json(
      {
        scope,
        requested: ids.length,
        scored: 0,
        error: (err as Error).message,
        elapsedMs: Date.now() - started,
      },
      { status: 500 },
    )
  }
}
