import type { Prisma } from '@prisma/client'
import { prisma } from './db'
import { BANDS, FIT_LABELS, type Band, type Fit } from './assemble/labels'

/**
 * One filter vocabulary, shared by the list screen and the CSV export.
 *
 * Both read the same URL and build the same `where`, so an export can never
 * disagree with the filtered view it was taken from — a reviewer sharing a
 * filtered URL and a reviewer exporting it must get the same rows.
 */

export interface Filters {
  district?: string
  block?: string
  q?: string
  stage?: string
  persona?: string
  band?: string
  language?: string
  sector?: string
  registrationStatus?: string
  reviewerStatus?: string
  flagType?: string
  hasFlags?: boolean
  unscoredOnly?: boolean
  needsHumanOnly?: boolean
  fpMin?: number
  fpMax?: number
  psMin?: number
  psMax?: number
  smMin?: number
  smMax?: number
  confidenceMin?: number
  questionSetVersion?: string
  sort?: string
  page?: number
  perPage?: number
}

export const STAGES = [
  { value: 'idea', label: 'Idea' },
  { value: 'built', label: 'Built' },
  { value: 'in_market', label: 'In market' },
]

export const PERSONAS = [
  { value: 'student', label: 'Student' },
  { value: 'farmer', label: 'Farmer' },
  { value: 'micro_entrepreneur', label: 'Micro-entrepreneur' },
  { value: 'professional', label: 'Professional' },
  { value: 'homemaker', label: 'Homemaker' },
  { value: 'other', label: 'Other' },
]

export const REVIEWER_STATUSES = [
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'advance', label: 'Advance' },
  { value: 'hold', label: 'Hold' },
  { value: 'needs_info', label: 'Needs info' },
]

export const REGISTRATION_STATUSES = [
  { value: 'registered', label: 'Registered' },
  { value: 'unregistered', label: 'Unregistered' },
]

export const FLAG_TYPES = [
  { value: 'suspected_spam', label: 'Suspected spam' },
  { value: 'stage_contradiction', label: 'Stage contradiction' },
  { value: 'thin_dossier', label: 'Thin dossier' },
  { value: 'low_confidence', label: 'Low confidence' },
  { value: 'missing_evidence', label: 'Missing evidence' },
  { value: 'laya_unavailable', label: 'Laya unavailable' },
]

export const SORTS = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'fp_desc', label: 'Founder–Problem, high to low' },
  { value: 'fp_asc', label: 'Founder–Problem, low to high' },
  { value: 'ps_desc', label: 'Problem–Solution, high to low' },
  { value: 'ps_asc', label: 'Problem–Solution, low to high' },
  { value: 'sm_desc', label: 'Solution–Market, high to low' },
  { value: 'sm_asc', label: 'Solution–Market, low to high' },
  { value: 'confidence_desc', label: 'Confidence, high to low' },
  { value: 'confidence_asc', label: 'Confidence, low to high' },
]

export const DEFAULT_PER_PAGE = 50

function num(value: string | undefined | null): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Reads filters off URL search params. The URL is the whole state. */
export function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const one = (key: string): string | undefined => {
    const v = params[key]
    const s = Array.isArray(v) ? v[0] : v
    return s && s !== '' ? s : undefined
  }
  return {
    district: one('district'),
    block: one('block'),
    q: one('q'),
    stage: one('stage'),
    persona: one('persona'),
    band: one('band'),
    language: one('language'),
    sector: one('sector'),
    registrationStatus: one('registrationStatus'),
    reviewerStatus: one('reviewerStatus'),
    flagType: one('flagType'),
    hasFlags: one('hasFlags') === 'true',
    unscoredOnly: one('unscored') === 'true',
    needsHumanOnly: one('needsHuman') === 'true',
    fpMin: num(one('fpMin')),
    fpMax: num(one('fpMax')),
    psMin: num(one('psMin')),
    psMax: num(one('psMax')),
    smMin: num(one('smMin')),
    smMax: num(one('smMax')),
    confidenceMin: num(one('confidenceMin')),
    questionSetVersion: one('questionSetVersion'),
    sort: one('sort') ?? 'date_desc',
    page: num(one('page')) ?? 1,
    perPage: num(one('perPage')) ?? DEFAULT_PER_PAGE,
  }
}

/** Serialises filters back to a query string, so a view is shareable. */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams()
  const set = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '' || value === false) return
    params.set(key, String(value))
  }
  set('district', filters.district)
  set('sector', filters.sector)
  set('block', filters.block)
  set('q', filters.q)
  set('stage', filters.stage)
  set('persona', filters.persona)
  set('band', filters.band)
  set('language', filters.language)
  set('registrationStatus', filters.registrationStatus)
  set('reviewerStatus', filters.reviewerStatus)
  set('flagType', filters.flagType)
  if (filters.hasFlags) params.set('hasFlags', 'true')
  if (filters.unscoredOnly) params.set('unscored', 'true')
  if (filters.needsHumanOnly) params.set('needsHuman', 'true')
  set('fpMin', filters.fpMin)
  set('fpMax', filters.fpMax)
  set('psMin', filters.psMin)
  set('psMax', filters.psMax)
  set('smMin', filters.smMin)
  set('smMax', filters.smMax)
  set('confidenceMin', filters.confidenceMin)
  set('questionSetVersion', filters.questionSetVersion)
  if (filters.sort && filters.sort !== 'date_desc') params.set('sort', filters.sort)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))
  return params
}

function range(min?: number, max?: number): Prisma.IntNullableFilter | undefined {
  if (min === undefined && max === undefined) return undefined
  const f: Prisma.IntNullableFilter = {}
  if (min !== undefined) f.gte = min
  if (max !== undefined) f.lte = max
  return f
}

/**
 * The Prisma `where` for a set of filters.
 *
 * Assessment criteria always target `isLatest`, so a superseded score from an
 * earlier run can never keep a candidate in a reviewer's filtered view.
 */
export function buildCandidateWhere(filters: Filters): Prisma.CandidateWhereInput {
  const where: Prisma.CandidateWhereInput = {}
  const and: Prisma.CandidateWhereInput[] = []

  if (filters.district) where.district = filters.district
  if (filters.block) where.block = filters.block
  if (filters.stage) where.declaredStage = filters.stage
  if (filters.persona) where.persona = filters.persona
  if (filters.language) where.language = filters.language

  // Free-text search is a separate field from the exact district filter, so the
  // export and the list can never interpret one box two different ways.
  if (filters.q) {
    and.push({
      OR: [
        { externalId: { contains: filters.q } },
        { district: { contains: filters.q } },
        { block: { contains: filters.q } },
      ],
    })
  }

  if (filters.registrationStatus) {
    and.push({ seedBank: { status: filters.registrationStatus } })
  }

  // Sector lives on the SEED Bank because it is derived for every candidate,
  // including the ones who are never banded.
  if (filters.sector) {
    and.push({ seedBank: { sector: filters.sector } })
  }

  const assessment: Prisma.AssessmentWhereInput = { isLatest: true }
  let assessmentFiltered = false

  if (filters.unscoredOnly) {
    assessment.band = 'unscored'
    assessmentFiltered = true
  } else if (filters.band) {
    assessment.band = filters.band
    assessmentFiltered = true
  }

  if (filters.needsHumanOnly) {
    assessment.needsHuman = true
    assessmentFiltered = true
  }

  if (filters.reviewerStatus) {
    assessment.reviewerDecision =
      filters.reviewerStatus === 'unreviewed' ? null : filters.reviewerStatus
    assessmentFiltered = true
  }

  if (filters.flagType) {
    assessment.flags = { contains: filters.flagType }
    assessmentFiltered = true
  } else if (filters.hasFlags) {
    assessment.flags = { not: '[]' }
    assessmentFiltered = true
  }

  const fp = range(filters.fpMin, filters.fpMax)
  const ps = range(filters.psMin, filters.psMax)
  const sm = range(filters.smMin, filters.smMax)
  if (fp) {
    assessment.founderProblem = fp
    assessmentFiltered = true
  }
  if (ps) {
    assessment.problemSolution = ps
    assessmentFiltered = true
  }
  if (sm) {
    assessment.solutionMarket = sm
    assessmentFiltered = true
  }
  if (filters.confidenceMin !== undefined) {
    assessment.confidence = { gte: filters.confidenceMin }
    assessmentFiltered = true
  }
  if (filters.questionSetVersion) {
    assessment.questionSetVersion = filters.questionSetVersion
    assessmentFiltered = true
  }

  if (assessmentFiltered) and.push({ assessments: { some: assessment } })
  if (and.length > 0) where.AND = and

  return where
}

export type CandidateOrder = Prisma.CandidateOrderByWithRelationInput

/**
 * Database-level ordering. Only the date sorts can be expressed here; a fit or
 * confidence sort lives on the to-many assessment relation, which Prisma cannot
 * order a parent by, so `sortRows` applies those over the page that was read.
 */
export function buildOrderBy(sort: string | undefined): CandidateOrder[] {
  return sort === 'date_asc' ? [{ createdAt: 'asc' }] : [{ createdAt: 'desc' }]
}

/**
 * Sort keys that have to be applied to the assessment rather than the
 * candidate. Prisma cannot order a parent by a to-many child's column, so these
 * are applied after the page is read, over the assessment the row carries.
 */
const ASSESSMENT_SORTS: Record<string, { key: string; dir: 1 | -1 }> = {
  fp_desc: { key: 'founderProblem', dir: -1 },
  fp_asc: { key: 'founderProblem', dir: 1 },
  ps_desc: { key: 'problemSolution', dir: -1 },
  ps_asc: { key: 'problemSolution', dir: 1 },
  sm_desc: { key: 'solutionMarket', dir: -1 },
  sm_asc: { key: 'solutionMarket', dir: 1 },
  confidence_desc: { key: 'confidence', dir: -1 },
  confidence_asc: { key: 'confidence', dir: 1 },
}

export function isAssessmentSort(sort: string | undefined): boolean {
  return Boolean(sort && sort in ASSESSMENT_SORTS)
}

export interface CandidateRow {
  id: string
  externalId: string
  district: string
  block: string
  persona: string
  declaredStage: string
  language: string
  createdAt: Date
  assessments: Array<{
    band: string
    scenario: string | null
    founderProblem: number | null
    problemSolution: number | null
    solutionMarket: number | null
    composite: number | null
    confidence: number | null
    cappedBy: string | null
    flags: string
    needsHuman: boolean
    reviewerDecision: string | null
    reviewerNote: string | null
    questionSetVersion: string | null
    modelCheckpoint: string | null
  }>
  seedBank?: {
    status: string | null
    constraintType: string | null
    aspiration: string | null
    complete: boolean
  } | null
}

/** Applies a fit/confidence sort to rows already read from the database. */
export function sortRows<T extends CandidateRow>(rows: T[], sort: string | undefined): T[] {
  const spec = sort ? ASSESSMENT_SORTS[sort] : undefined
  if (!spec) return rows
  return [...rows].sort((a, b) => {
    const av = (a.assessments[0] as Record<string, unknown> | undefined)?.[spec.key]
    const bv = (b.assessments[0] as Record<string, unknown> | undefined)?.[spec.key]
    const an = typeof av === 'number' ? av : null
    const bn = typeof bv === 'number' ? bv : null
    // Unscored rows sort last whichever direction is asked for: they are not
    // low scores, so they must never be presented as the bottom of a ranking.
    if (an === null && bn === null) return 0
    if (an === null) return 1
    if (bn === null) return -1
    return (an - bn) * spec.dir
  })
}

export const CANDIDATE_INCLUDE = {
  assessments: {
    where: { isLatest: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
  seedBank: true,
} satisfies Prisma.CandidateInclude

/**
 * Within-band rank, over the candidates the current filter selects.
 *
 * Ranking is per band AND per question-set version and checkpoint: scores
 * produced by different question sets are not comparable, so they are never
 * ranked against each other.
 */
export async function withinBandRanks(
  rows: CandidateRow[],
): Promise<Map<string, { rank: number; outOf: number }>> {
  const out = new Map<string, { rank: number; outOf: number }>()
  const scored = rows.filter((r) => r.assessments[0]?.composite !== null && r.assessments[0])
  if (scored.length === 0) return out

  const groups = new Map<string, CandidateRow[]>()
  for (const row of scored) {
    const a = row.assessments[0]
    const key = `${a.band}::${a.questionSetVersion ?? '-'}::${a.modelCheckpoint ?? '-'}`
    const g = groups.get(key)
    if (g) g.push(row)
    else groups.set(key, [row])
  }

  for (const [key, group] of groups) {
    const [band, questionSetVersion, modelCheckpoint] = key.split('::')
    const peers = await prisma.assessment.findMany({
      where: {
        isLatest: true,
        band,
        questionSetVersion: questionSetVersion === '-' ? null : questionSetVersion,
        modelCheckpoint: modelCheckpoint === '-' ? null : modelCheckpoint,
        composite: { not: null },
      },
      select: { candidateId: true, composite: true },
      orderBy: { composite: 'desc' },
    })
    const position = new Map(peers.map((p, i) => [p.candidateId, i + 1]))
    for (const row of group) {
      out.set(row.id, { rank: position.get(row.id) ?? 0, outOf: peers.length })
    }
  }

  return out
}

const CSV_COLUMNS = [
  'external_id',
  'district',
  'block',
  'persona',
  'declared_stage',
  'scenario',
  'language',
  'band',
  'founder_problem',
  'problem_solution',
  'solution_market',
  'confidence',
  'capped_by',
  'flags',
  'needs_human',
  'constraint_type',
  'registration_status',
  'aspiration',
  'seed_bank_complete',
  'reviewer_decision',
  'reviewer_note',
  'question_set_version',
  'model_checkpoint',
]

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV of exactly the rows handed in — the same rows the filter returned. */
export function toCsv(rows: CandidateRow[]): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const row of rows) {
    const a = row.assessments[0]
    let flags: string[] = []
    try {
      flags = a ? (JSON.parse(a.flags) as string[]) : []
    } catch {
      flags = []
    }
    lines.push(
      [
        row.externalId,
        row.district,
        row.block,
        row.persona,
        row.declaredStage,
        a?.scenario ?? '',
        row.language,
        a?.band ?? 'unscored',
        a?.founderProblem,
        a?.problemSolution,
        a?.solutionMarket,
        a?.confidence,
        a?.cappedBy,
        flags.join('; '),
        a?.needsHuman ? 'yes' : 'no',
        row.seedBank?.constraintType,
        row.seedBank?.status,
        row.seedBank?.aspiration,
        row.seedBank?.complete ? 'yes' : 'no',
        a?.reviewerDecision ?? 'unreviewed',
        a?.reviewerNote,
        a?.questionSetVersion,
        a?.modelCheckpoint,
      ]
        .map(cell)
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export { BANDS, FIT_LABELS }
export type { Band, Fit }
