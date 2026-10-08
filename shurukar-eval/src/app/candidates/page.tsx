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
  sortRows,
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

  const [totalCount, districts, blocks, languages, versions] = await Promise.all([
    prisma.candidate.count({ where }),
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
    unscored: scoreRows.filter((r) => {
      const latest = r.assessments[0]
      if (!latest) return true
      return latest.questionSetVersion !== currentVersion || latest.band === 'unscored'
    }).length,
    stale: staleCount,
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
    <div className="min-h-screen bg-[#090D16] text-[#F8FAFC] p-4 md:p-8 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              ShuruKar Evaluation Workbench
            </h1>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5 font-mono">
            Bands and ranks, never a single number. Scores are uncalibrated — nothing here rejects
            anybody.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-[#64748B]">move</span>
          <kbd>J</kbd>
          <kbd>K</kbd>
          <span className="text-[#64748B] ml-1">search</span>
          <kbd>/</kbd>
        </div>
      </div>

      <HeaderStats />

      <ScoreButton initial={scoreCounts} />

      <CohortIntelligence />

      <Filters
        districts={districts.map((d) => d.district)}
        blocks={blocks.map((b) => b.block)}
        languages={languages.map((l) => l.language)}
        questionSetVersions={versions.map((v) => v.questionSetVersion as string)}
        total={totalCount}
      />

      <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-[#111827] border-b border-[#1E293B] text-[#64748B] uppercase tracking-wider text-[11px] select-none">
                <th className="py-2.5 px-3 w-10 text-center border-r border-[#1E293B]">#</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">External id</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">District / block</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">Persona</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B] text-center">Stage</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B] text-center" title="Founder–Problem · Problem–Solution · Solution–Market">
                  FP · PS · SM
                </th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">Band</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B] text-center">Conf</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">Needs</th>
                <th className="py-2.5 px-3 border-r border-[#1E293B]">Flags</th>
                <th className="py-2.5 px-3">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-[#64748B]">
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
                  <tr key={c.id} className="hover:bg-[#111827] transition-colors">
                    <td className="py-2 px-3 text-center text-[#475569] border-r border-[#1E293B]">
                      {(page - 1) * perPage + idx + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-[#1E293B]">
                      <Link
                        href={`/candidates/${c.id}`}
                        className="text-sky-300 hover:text-sky-200 hover:underline"
                      >
                        {c.externalId}
                      </Link>
                    </td>
                    <td className="py-2 px-3 border-r border-[#1E293B] text-[#94A3B8]">
                      {c.district} <span className="text-[#475569]">/</span> {c.block}
                    </td>
                    <td className="py-2 px-3 border-r border-[#1E293B] text-[#94A3B8]">
                      {c.persona}
                    </td>
                    <td className="py-2 px-3 border-r border-[#1E293B] text-center">
                      <span className="text-[#94A3B8]">{a?.scenario ?? '—'}</span>
                      <span className="text-[#475569] ml-1">{c.declaredStage}</span>
                    </td>
                    <td className="py-2 px-3 border-r border-[#1E293B]">
                      <div className="flex items-center gap-1 justify-center">
                        <FitChip score={a?.founderProblem ?? null} label="Founder–Problem" />
                        <FitChip score={a?.problemSolution ?? null} label="Problem–Solution" />
                        <FitChip score={a?.solutionMarket ?? null} label="Solution–Market" />
                      </div>
                    </td>
                    <td className="py-2 px-3 border-r border-[#1E293B]">
                      <div className="flex items-center gap-1.5">
                        <BandChip band={a?.band ?? 'unscored'} title={a?.cappedBy ?? undefined} />
                        {rank && rank.outOf > 1 && (
                          <span className="text-[10px] text-[#475569]" title="rank within this band">
                            {rank.rank}/{rank.outOf}
                          </span>
                        )}
                      </div>
                      {a?.cappedBy && (
                        <span className="block text-[10px] text-amber-400/70 mt-0.5 truncate max-w-[220px]">
                          capped: {a.cappedBy}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 border-r border-[#1E293B] text-center text-[#94A3B8]">
                      {a?.confidence === null || a?.confidence === undefined
                        ? '—'
                        : a.confidence.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 border-r border-[#1E293B]">
                      {a?.needsHuman ? (
                        <span className="text-sky-300">human</span>
                      ) : (
                        <span className="text-[#475569]">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 border-r border-[#1E293B]">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {flags.length === 0 ? (
                          <span className="text-[#475569]">—</span>
                        ) : (
                          flags.map((f) => <FlagChip key={f} flag={f} />)
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {a?.reviewerDecision ? (
                        <span className="text-[#F8FAFC]">{a.reviewerDecision.replace('_', ' ')}</span>
                      ) : (
                        <span className="text-[#475569]">unreviewed</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-auto border-t border-[#1E293B] p-3 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-[#64748B]">
          <span>
            Showing <span className="text-white">{rows.length}</span> of{' '}
            <span className="text-white">{totalCount}</span> · page{' '}
            <span className="text-white">{page}</span> of{' '}
            <span className="text-white">{totalPages}</span>
            {assessmentSort && totalCount > SORT_SCAN_LIMIT && (
              <span className="text-amber-400/80">
                {' '}
                · fit sort covers the first {SORT_SCAN_LIMIT} rows of this filter
              </span>
            )}
          </span>
          <span className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="px-2 py-1 rounded border border-[#334155] hover:bg-[#1E293B] text-[#94A3B8]"
              >
                ← prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref(page + 1)}
                className="px-2 py-1 rounded border border-[#334155] hover:bg-[#1E293B] text-[#94A3B8]"
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
