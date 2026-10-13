import { prisma } from './db'
import { questionSetVersion } from './laya/questionSets'

/**
 * Which candidates another pipeline run can actually help.
 *
 *   never assessed, or assessed under a superseded question set, or
 *   the latest run never reached Laya (timeout, 5xx, network, missing key).
 *
 * The last case matters for a long batch: a run that died on the wire is
 * persisted as `unscored` so the candidate stays visible, but nothing about the
 * founder was judged, so it must be retried. A run Laya *answered* and the
 * assembly still could not band (spam, thin dossier, low confidence) is not
 * pending — another run returns the same answer.
 */
export async function pendingCandidateIds(
  opts: { excludeStates?: string[] } = {},
): Promise<string[]> {
  const version = questionSetVersion()
  const excluded = (opts.excludeStates ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean)

  const candidates = await prisma.candidate.findMany({
    select: {
      id: true,
      state: true,
      assessments: {
        where: { isLatest: true },
        select: { questionSetVersion: true, layaRunId: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const inScope = candidates.filter((c) => !excluded.includes(c.state.trim().toLowerCase()))

  const runIds = inScope
    .map((c) => c.assessments[0]?.layaRunId)
    .filter((id): id is string => Boolean(id))
  const failedRuns = new Set(
    (
      await prisma.layaRun.findMany({
        where: { id: { in: runIds }, status: 'unscored' },
        select: { id: true },
      })
    ).map((r) => r.id),
  )

  return inScope
    .filter((c) => {
      const latest = c.assessments[0]
      if (!latest) return true
      if (latest.questionSetVersion !== version) return true
      return Boolean(latest.layaRunId && failedRuns.has(latest.layaRunId))
    })
    .map((c) => c.id)
}

/** Latest assessments Laya answered under the current set but could not band. */
export async function unscoreableCount(): Promise<number> {
  const rows = await prisma.assessment.findMany({
    where: { isLatest: true, band: 'unscored', questionSetVersion: questionSetVersion() },
    select: { layaRunId: true },
  })
  const runIds = rows.map((r) => r.layaRunId).filter((id): id is string => Boolean(id))
  if (runIds.length === 0) return 0
  return prisma.layaRun.count({ where: { id: { in: runIds }, status: 'scored' } })
}
