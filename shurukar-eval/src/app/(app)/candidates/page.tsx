import Link from 'next/link'
import Filters from '@/components/Filters'
import HeaderStats from '@/components/HeaderStats'
import CohortIntelligence from '@/components/CohortIntelligence'
import ScoreButton from '@/components/ScoreButton'
import { questionSetVersion } from '@/lib/laya/questionSets'
import { BandChip, FitChip, FlagChip } from '@/components/BandChip'
import { prisma } from '@/lib/db'
import {
  CANDIDATE_INCLUDE,
  buildCandidateWhere,
  buildOrderBy,
  isAssessmentSort,
  parseFilters,
  candidateName,
  personaLabel,
  sortRows,
  stageLabel,
  withinBandRanks,
  type CandidateRow,
} from '@/lib/query'

export const dynamic = 'force-dynamic'

/** An assessment sort has to see the whole filtered set, not one page of it. */
const SORT_SCAN_LIMIT = 5000

export default async function CandidatesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const searchParams = await props.searchParams
  const filters = parseFilters(searchParams)
  const where = buildCandidateWhere(filters)

  const page = Math.max(1, filters.page ?? 1)
  const perPage = filters.perPage ?? 50
  const assessmentSort = isAssessmentSort(filters.sort)

  const [totalCount, states, districts, blocks, languages, versions] = await Promise.all([
    prisma.candidate.count({ where }),
    prisma.candidate.findMany({ distinct: ['state'], select: { state: true }, orderBy: { state: 'asc' } }),
    prisma.candidate.findMany({ distinct: ['district'], select: { district: true }, orderBy: { district: 'asc' } }),
    prisma.candidate.findMany({ distinct: ['block'], select: { block: true }, orderBy: { block: 'asc' } }),
    prisma.candidate.findMany({ distinct: ['language'], select: { language: true }, orderBy: { language: 'asc' } }),
    prisma.assessment.findMany({
      where: { isLatest: true, questionSetVersion: { not: null } },
      distinct: ['questionSetVersion'],
      select: { questionSetVersion: true },
    }),
  ])

  // Fit and confidence sorts live on the assessment relation, which Prisma
  // cannot order a parent by, so those are sorted in memory over the filtered
  // set and then paged. Date sorts page in the database as normal.
  let rows: CandidateRow[]
  if (assessmentSort) {
    const all = (await prisma.candidate.findMany({
      where,
      include: CANDIDATE_INCLUDE,
      orderBy: buildOrderBy('date_desc'),
      take: SORT_SCAN_LIMIT,
    })) as CandidateRow[]
    rows = sortRows(all, filters.sort).slice((page - 1) * perPage, page * perPage)
  } else {
    rows = (await prisma.candidate.findMany({
      where,
      include: CANDIDATE_INCLUDE,
      orderBy: buildOrderBy(filters.sort),
      skip: (page - 1) * perPage,
      take: perPage,
    })) as CandidateRow[]
  }

  const ranks = await withinBandRanks(rows)
  // Seeds the scoring button so its first paint names real numbers. A
  // candidate needs scoring when it has no latest assessment, when that
  // assessment is `unscored`, or when it was produced by a question set that is
  // no longer current — a score from another version is not comparable.
  const currentVersion = questionSetVersion()
  const scoreRows = await prisma.candidate.findMany({
    select: {
      assessments: {
        where: { isLatest: true },
        select: { band: true, questionSetVersion: true },
        take: 1,
      },
    },
  })
  const staleCount = scoreRows.filter(
    (r) => r.assessments[0] && r.assessments[0].questionSetVersion !== currentVersion,
  ).length
  const scoreCounts = {
    // Only candidates a rerun can actually help: never assessed, or assessed
    // under a superseded question set. A candidate that ran and came back
    // `unscored` is counted separately — another run cannot change it.
    pending: scoreRows.filter((r) => {
      const latest = r.assessments[0]
      if (!latest) return true
      return latest.questionSetVersion !== currentVersion
    }).length,
    stale: staleCount,
    unscoreable: scoreRows.filter(
      (r) =>
        r.assessments[0]?.band === 'unscored' &&
        r.assessments[0]?.questionSetVersion === currentVersion,
    ).length,
    total: scoreRows.length,
    layaConfigured: Boolean(process.env.LAYA_API_KEY),
    questionSetVersion: currentVersion,
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage))

  const pageHref = (n: number) => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      const value = Array.isArray(v) ? v[0] : v
      if (value) params.set(k, value)
    }
    params.set('page', String(n))
    return `/candidates?${params.toString()}`
  }

  return (
    <div className="min-h-screen text-ink px-4 py-6 md:px-10 md:py-10 flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-900 px-3 py-0.5 text-sm font-medium">
            Scored by Laya
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-semibold mt-3 leading-tight">
            Shurukar
          </h1>
          <p className="text-lg text-ink-2 mt-1">Founder review</p>
          <p className="text-sm text-ink-3 mt-1 max-w-2xl">
            Bands and ranks, never a single number. Scores are uncalibrated — nothing here rejects
            anybody.
          </p>
        </div>
        <a
          href={`/api/export?${new URLSearchParams(
            Object.entries(searchParams).flatMap(([k, v]) => {
              const value = Array.isArray(v) ? v[0] : v
              return value && k !== 'page' ? [[k, value]] : []
            }),
          ).toString()}`}
          className="inline-flex items-center gap-2 rounded-full bg-accent hover:bg-accent-hover text-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors"
        >
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </a>
      </div>

      <HeaderStats />

      <ScoreButton initial={scoreCounts} />

      <CohortIntelligence />

      <Filters
        states={states.map((s) => s.state)}
        districts={districts.map((d) => d.district)}
        blocks={blocks.map((b) => b.block)}
        languages={languages.map((l) => l.language)}
        questionSetVersions={versions.map((v) => v.questionSetVersion as string)}
        total={totalCount}
      />

      <div className="bg-surface border border-line rounded-card shadow-card overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-line text-ink-3 text-xs font-semibold select-none">
                <th className="py-3 px-3 w-10 text-center border-r border-line">#</th>
                <th className="py-3 px-3 border-r border-line min-w-[180px]">Founder</th>
                <th className="py-3 px-3 border-r border-line">District / block</th>
                <th className="py-3 px-3 border-r border-line">Persona</th>
                <th className="py-3 px-3 border-r border-line text-center">Stage</th>
                <th className="py-3 px-3 border-r border-line text-center" title="Founder–Problem · Problem–Solution · Solution–Market">
                  FP · PS · SM
                </th>
                <th className="py-3 px-3 border-r border-line">Band</th>
                <th className="py-3 px-3 border-r border-line text-center">Conf</th>
                <th className="py-3 px-3 border-r border-line">Needs</th>
                <th className="py-3 px-3 border-r border-line">Flags</th>
                <th className="py-3 px-3">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-ink-3">
                    No candidates match this filter.
                  </td>
                </tr>
              )}
              {rows.map((c, idx) => {
                const a = c.assessments[0]
                let flags: string[] = []
                try {
                  flags = a ? (JSON.parse(a.flags) as string[]) : []
                } catch {
                  flags = []
                }
                const rank = ranks.get(c.id)
                return (
                  <tr key={c.id} className="hover:bg-surface-2 transition-colors align-middle">
                    <td className="py-3 px-3 text-center text-ink-4 border-r border-line">
                      {(page - 1) * perPage + idx + 1}
                    </td>
                    <td className="py-3 px-3 border-r border-line">
                      <Link
                        href={`/candidates/${c.id}`}
                        className="font-semibold text-ink hover:text-accent transition-colors"
                      >
                        {candidateName(c) ?? 'Unnamed founder'}
                      </Link>
                      <span className="block text-[11px] text-ink-4 font-mono" title={c.externalId}>
                        {c.externalId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="py-3 px-3 border-r border-line text-ink-2">
                      {c.district} <span className="text-ink-4">/</span> {c.block}
                      <span className="block text-[10px] text-ink-4">{c.state}</span>
                    </td>
                    <td className="py-3 px-3 border-r border-line text-ink-2">
                      {personaLabel(c.persona)}
                    </td>
                    <td className="py-3 px-3 border-r border-line text-center">
                      <span className="text-ink-2">{a?.scenario ?? '—'}</span>
                      <span className="text-ink-4 ml-1">{stageLabel(c.declaredStage)}</span>
                    </td>
                    <td className="py-3 px-3 border-r border-line">
                      <div className="flex items-center gap-1 justify-center">
                        <FitChip score={a?.founderProblem ?? null} label="Founder–Problem" />
                        <FitChip score={a?.problemSolution ?? null} label="Problem–Solution" />
                        <FitChip score={a?.solutionMarket ?? null} label="Solution–Market" />
                      </div>
                    </td>
                    <td className="py-3 px-3 border-r border-line">
                      <div className="flex items-center gap-1.5">
                        <BandChip band={a?.band ?? 'unscored'} title={a?.cappedBy ?? undefined} />
                        {rank && rank.outOf > 1 && (
                          <span className="text-[10px] text-ink-4" title="rank within this band">
                            {rank.rank}/{rank.outOf}
                          </span>
                        )}
                      </div>
                      {a?.cappedBy && (
                        <span className="block text-[10px] text-amber-700 mt-0.5 truncate max-w-[220px]">
                          capped: {a.cappedBy}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 border-r border-line text-center text-ink-2">
                      {a?.confidence === null || a?.confidence === undefined
                        ? '—'
                        : a.confidence.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 border-r border-line">
                      {a?.needsHuman ? (
                        <span className="text-indigo-700">human</span>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 border-r border-line">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {flags.length === 0 ? (
                          <span className="text-ink-4">—</span>
                        ) : (
                          flags.map((f) => <FlagChip key={f} flag={f} />)
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {a?.reviewerDecision ? (
                        <span className="text-ink">{a.reviewerDecision.replace('_', ' ')}</span>
                      ) : (
                        <span className="text-ink-4">unreviewed</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-auto border-t border-line p-3 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-ink-3">
          <span>
            Showing <span className="text-ink">{rows.length}</span> of{' '}
            <span className="text-ink">{totalCount}</span> · page{' '}
            <span className="text-ink">{page}</span> of{' '}
            <span className="text-ink">{totalPages}</span>
            {assessmentSort && totalCount > SORT_SCAN_LIMIT && (
              <span className="text-amber-700">
                {' '}
                · fit sort covers the first {SORT_SCAN_LIMIT} rows of this filter
              </span>
            )}
          </span>
          <span className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="px-2 py-1 rounded border border-line-strong hover:bg-muted text-ink-2"
              >
                ← prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref(page + 1)}
                className="px-2 py-1 rounded border border-line-strong hover:bg-muted text-ink-2"
              >
                next →
              </Link>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
