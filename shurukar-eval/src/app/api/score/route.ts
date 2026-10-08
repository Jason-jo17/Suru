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

type Scope = 'unscored' | 'stale' | 'all'

/**
 * A candidate needs scoring when it has no latest assessment at all, when that
 * assessment is `unscored`, or when it was produced by a question set that is
 * no longer current — comparing across versions is not meaningful, so a stale
 * row is as unusable as a missing one.
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
      return stale || latest.band === 'unscored'
    })
    .map((c) => c.id)
}

export async function GET() {
  const [unscored, stale, total] = await Promise.all([
    candidateIdsFor('unscored'),
    candidateIdsFor('stale'),
    prisma.candidate.count(),
  ])
  return NextResponse.json({
    questionSetVersion: questionSetVersion(),
    unscored: unscored.length,
    stale: stale.length,
    total,
    layaConfigured: Boolean(process.env.LAYA_API_KEY),
  })
}

export async function POST(request: Request) {
  let scope: Scope = 'unscored'
  try {
    const body = (await request.json()) as { scope?: Scope }
    if (body.scope === 'all' || body.scope === 'stale' || body.scope === 'unscored') {
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
