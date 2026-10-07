import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  CANDIDATE_INCLUDE,
  buildCandidateWhere,
  buildOrderBy,
  isAssessmentSort,
  parseFilters,
  sortRows,
  toCsv,
  type CandidateRow,
} from '@/lib/query'

/** Hard ceiling, so one export cannot pull the whole table into memory. */
const MAX_ROWS = 20_000

/**
 * CSV of the current filtered set.
 *
 * It parses the same URL with the same `parseFilters` and builds the same
 * `where` as the list screen, so the export and the view it was taken from can
 * never disagree about which candidates are in scope.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const filters = parseFilters(Object.fromEntries(searchParams.entries()))
  const where = buildCandidateWhere(filters)

  const rows = (await prisma.candidate.findMany({
    where,
    include: CANDIDATE_INCLUDE,
    orderBy: buildOrderBy(filters.sort),
    take: MAX_ROWS,
  })) as CandidateRow[]

  const ordered = isAssessmentSort(filters.sort) ? sortRows(rows, filters.sort) : rows
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(toCsv(ordered), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="shurukar-candidates-${stamp}.csv"`,
    },
  })
}
