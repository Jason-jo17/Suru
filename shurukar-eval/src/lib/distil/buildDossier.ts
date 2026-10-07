import { prisma } from '../db'
import type { Dossier } from '@prisma/client'
import { composeBackground, stripIdentity } from './identity'
import { CLAIMED_FIELDS, markClaimed, marketFindingFor } from './provenance'

/**
 * The distiller is the highest-risk component in the system: a change here
 * silently changes every score with no error anywhere. Bump this on any change
 * to the shape, the ordering, the budget or the stripping it depends on.
 */
export const DISTILLER_VERSION = 'distiller-2.0'

/** Target budget for decisive content. Laya reads 512 tokens per question. */
export const TOKEN_BUDGET = 400

/** Hard per-value ceiling, so one long answer cannot eat the whole budget. */
const MAX_TOKENS_PER_VALUE = 90

export type Scenario = 'A' | 'B' | 'C'

/**
 * Scenario for a declared stage. Routing on the *declared* stage only; the
 * Laya client is what detects a contradiction between stage and traction.
 */
export function scenarioForStage(declaredStage: string): Scenario {
  if (declaredStage === 'built') return 'B'
  if (declaredStage === 'in_market') return 'C'
  return 'A'
}

/**
 * Decisive ordering, per scenario. The fields each scenario's questions need
 * most come first; the first five are never dropped to fit the budget.
 */
const DECISIVE_ORDER: Record<Scenario, string[]> = {
  // A (idea): there is nothing but the problem and the founder to judge.
  A: [
    'problem',
    'founder_background',
    'who_has_it',
    'motivation',
    'validation_done',
    'customers_spoken_to',
    'alternatives_today',
    'willingness_to_pay',
    'route_to_market',
    'market_finding',
    'constraint',
    'access_route',
    'declared_stage',
    'prior_venture_closed',
    'growth_ambition',
    'aspiration',
    'team_size',
    'time_commitment',
    'commitment_type',
    'registration_status',
  ],
  // B (built): what exists and whether anyone touched it.
  B: [
    'problem',
    'validation_done',
    'users_count',
    'founder_background',
    'who_has_it',
    'motivation',
    'customers_spoken_to',
    'alternatives_today',
    'willingness_to_pay',
    'route_to_market',
    'market_finding',
    'constraint',
    'access_route',
    'declared_stage',
    'time_in_line',
    'prior_venture_closed',
    'growth_ambition',
    'aspiration',
    'team_size',
    'time_commitment',
    'commitment_type',
    'registration_status',
  ],
  // C (in market): traction first, because that is what carries the weight.
  C: [
    'paying_customers',
    'users_count',
    'monthly_income',
    'retention_signal',
    'problem',
    'founder_background',
    'route_to_market',
    'access_route',
    'alternatives_today',
    'willingness_to_pay',
    'registration_status',
    'market_finding',
    'motivation',
    'who_has_it',
    'constraint',
    'declared_stage',
    'time_in_line',
    'validation_done',
    'prior_venture_closed',
    'growth_ambition',
    'aspiration',
    'team_size',
    'time_commitment',
    'commitment_type',
  ],
}

/** Never truncated, whatever the budget. */
export const PROTECTED_COUNT = 5

/** The fields a scenario's questions need most, in order. */
export function decisiveFields(scenario: Scenario): string[] {
  return DECISIVE_ORDER[scenario].slice(0, PROTECTED_COUNT)
}

/**
 * Rough token estimate. Deliberately conservative for Devanagari, where a
 * character carries fewer bytes per token than Latin text.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const byChars = Math.ceil(text.length / 3.5)
  const byWords = Math.ceil(words * 1.4)
  return Math.max(byChars, byWords)
}

function truncateToTokens(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text
  const words = text.trim().split(/\s+/)
  let out = ''
  for (const w of words) {
    const next = out ? `${out} ${w}` : w
    if (estimateTokens(next) > maxTokens) break
    out = next
  }
  return out ? `${out} …` : text.slice(0, maxTokens * 3)
}

/**
 * How much actual content a dossier carries in the fields that decide the
 * score — the values only, with no key names or JSON punctuation.
 *
 * This is what "thin" has to be measured on. A total token count is inflated
 * by key names and structural overhead, so a dossier holding four one-word
 * answers can look the same size as one holding a real account.
 */
export function decisiveContentTokens(
  payload: Record<string, string>,
  scenario: Scenario,
): number {
  return decisiveFields(scenario).reduce(
    (sum, field) => sum + estimateTokens(payload[field] ?? ''),
    0,
  )
}

/**
 * Raw answers (by stable fieldId) -> the JSON sent as Laya's `state`.
 *
 * Records what was said, identity-stripped and provenance-marked. It does not
 * rate, rank or soften anything: a distiller that wrote "strong domain
 * experience" would have done Laya's job badly, and the score would then
 * measure this function's opinion.
 */
export function distil(
  answers: Record<string, string>,
  scenario: Scenario,
  opts: { name?: string } = {},
): { payload: Record<string, string>; tokenCount: number; dropped: string[] } {
  const strip = (v: string | undefined) => (v ? stripIdentity(v, opts) : '')

  const candidateFields: Record<string, string> = {
    problem: strip(answers.problem_solution),
    who_has_it: strip(answers.who_will_use),
    founder_background:
      composeBackground(answers.founder_proximity, answers.time_in_line, opts) ?? '',
    motivation: [strip(answers.purpose), strip(answers.inspiration)]
      .filter((v, i, all) => v && all.indexOf(v) === i)
      .join(' '),
    alternatives_today: strip(answers.alternatives_today),
    validation_done: strip(answers.validation_done),
    customers_spoken_to: strip(answers.customers_spoken_to),
    users_count: strip(answers.users_count),
    paying_customers: strip(answers.paying_customers),
    monthly_income: strip(answers.monthly_income),
    retention_signal: strip(answers.retention_signal),
    willingness_to_pay: strip(answers.willingness_to_pay),
    route_to_market: strip(answers.route_to_market),
    access_route: strip(answers.access_route),
    constraint: strip(answers.constraint),
    declared_stage: strip(answers.declared_stage),
    time_in_line: strip(answers.time_in_line),
    prior_venture_closed: strip(answers.prior_venture_closed),
    growth_ambition: strip(answers.growth_ambition),
    aspiration: strip(answers.aspiration),
    team_size: strip(answers.team_size),
    time_commitment: strip(answers.time_commitment),
    commitment_type: strip(answers.commitment_type),
    registration_status: strip(answers.registration_status),
  }

  // A dated, sourced market yardstick for the sector the founder named.
  const sectorText = [answers.problem_solution, answers.who_will_use, answers.founder_proximity]
    .filter(Boolean)
    .join(' ')
  const marketFinding = marketFindingFor(sectorText)
  if (marketFinding) candidateFields.market_finding = marketFinding

  // Mark the founder's own unverified numbers as claims.
  for (const field of Object.keys(candidateFields)) {
    if (CLAIMED_FIELDS.has(field) && candidateFields[field]) {
      candidateFields[field] = markClaimed(candidateFields[field])
    }
  }

  const order = DECISIVE_ORDER[scenario]
  const payload: Record<string, string> = {}
  const dropped: string[] = []
  let tokenCount = 0

  order.forEach((field, index) => {
    const raw = candidateFields[field]
    if (!raw || !raw.trim()) return

    const value = truncateToTokens(raw.trim(), MAX_TOKENS_PER_VALUE)
    const cost = estimateTokens(value) + estimateTokens(field) + 4 // JSON overhead

    if (index >= PROTECTED_COUNT && tokenCount + cost > TOKEN_BUDGET) {
      dropped.push(field)
      return
    }

    payload[field] = value
    tokenCount += cost
  })

  return { payload, tokenCount, dropped }
}

/**
 * Builds and stores a dossier for a candidate.
 *
 * Stored dossiers are immutable: this only ever appends a new version. When the
 * newest version is byte-identical and came from this same distiller, it is
 * reused rather than duplicated — that is still never a rewrite, so a score
 * someone already acted on keeps the exact input it was produced from.
 */
export async function buildDossier(
  candidateId: string,
  opts: { forceNewVersion?: boolean } = {},
): Promise<Dossier> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { responses: true },
  })
  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`)

  const answers: Record<string, string> = {}
  let name: string | undefined
  for (const r of candidate.responses) {
    if (r.value == null || r.value.trim() === '') continue
    if (r.fieldId === 'name') {
      name = r.value
      continue // the name itself never enters the dossier
    }
    answers[r.fieldId] = r.value
  }

  const scenario = scenarioForStage(candidate.declaredStage)
  const { payload, tokenCount } = distil(answers, scenario, { name })
  const serialized = JSON.stringify(payload)

  const latest = await prisma.dossier.findFirst({
    where: { candidateId },
    orderBy: { version: 'desc' },
  })

  if (
    latest &&
    !opts.forceNewVersion &&
    latest.payload === serialized &&
    latest.distillerVersion === DISTILLER_VERSION
  ) {
    return latest
  }

  return prisma.dossier.create({
    data: {
      candidateId,
      version: (latest?.version ?? 0) + 1,
      payload: serialized,
      tokenCount,
      distillerVersion: DISTILLER_VERSION,
    },
  })
}
