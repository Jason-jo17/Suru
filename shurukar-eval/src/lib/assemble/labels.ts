import type { Scenario } from '../route'

/**
 * Every label Laya can return, and what it is worth.
 *
 * Laya generates nothing — each answer is a typed label from a closed set — so
 * all meaning lives here, in reviewable code, rather than in model prose.
 */

/**
 * Escape labels. Missing evidence is NOT bad evidence: these lower confidence
 * and route to a human. They never contribute a low number to a fit, because
 * "we could not tell" must not read as "the founder answered badly".
 */
export const MISSING_LABELS = new Set([
  'unclear',
  'not_asked',
  'unverifiable',
  'unknown',
  'n/a',
  '',
])

export function isMissing(label: string | undefined | null): boolean {
  if (label === undefined || label === null) return true
  return MISSING_LABELS.has(String(label).trim().toLowerCase())
}

/** label -> 0-100. A label absent from a question's table is treated as missing. */
export const LABEL_VALUES: Record<string, Record<string, number>> = {
  // --- shared across scenarios ---
  motivation: { personal: 100, opportunity: 65 },
  alternatives: { workaround: 85, competitor: 70, nothing: 30 },
  willingness_to_pay: { strong: 100, weak: 50, none: 10 },
  route_to_market: { clear: 100, vague: 40 },
  // constraint_type is what the programme ACTS on (which mentor, module,
  // scheme). It is deliberately unscored — asking for help is not a weakness.
  constraint_type: { money: 50, skills: 50, network: 50 },

  // --- A: idea ---
  problem_evidence: { lived: 100, observed: 80, researched: 45, asserted: 10 },
  problem_specificity: { specific: 100, vague: 35 },
  validation_effort: { none: 0, asked_a_few: 40, asked_many: 70, tested_with_users: 100 },
  founder_proximity: { deep: 100, some: 60, none: 15 },

  // --- B: built ---
  build_evidence: { live: 100, prototype: 60 },
  usage: { active: 100, tried: 55, none: 15 },
  addresses_problem: { direct: 100, indirect: 50 },
  founder_experience: { deep: 100, some: 60, none: 15 },

  // --- C: in market ---
  users: { many: 100, some: 65, none: 10 },
  retention: { high: 100, low: 40 },
  paying: { yes: 100, no: 15 },
  revenue: { high: 100, low: 50, none: 10 },
  // Formalisation is a programme-support signal, not a quality one: an
  // unregistered trading business is normal, so "no" is not punished.
  formalisation: { yes: 100, no: 50 },
}

/** Human-readable label text for the reviewer-facing explanation. */
export const LABEL_PHRASES: Record<string, Record<string, string>> = {
  problem_evidence: {
    lived: 'suffered the problem themselves',
    observed: 'watched named people suffer it',
    researched: 'cites reports only',
    asserted: 'asserts the problem with no source',
  },
  problem_specificity: {
    specific: 'names exact pain points and who has them',
    vague: 'describes the problem broadly',
  },
  validation_effort: {
    none: 'has not tested the idea',
    asked_a_few: 'asked a few people',
    asked_many: 'asked many people',
    tested_with_users: 'tested with real users',
  },
  founder_proximity: {
    deep: 'years of experience in this exact field',
    some: 'related experience',
    none: 'no prior connection to the field',
  },
  founder_experience: {
    deep: 'years of experience in this exact field',
    some: 'related experience',
    none: 'no prior connection to the field',
  },
  motivation: {
    personal: 'a deeply personal reason for solving this',
    opportunity: 'sees a market gap',
  },
  build_evidence: { live: 'something live', prototype: 'a prototype' },
  usage: { active: 'active users', tried: 'people who tried it', none: 'no usage yet' },
  addresses_problem: {
    direct: 'the build addresses the stated problem directly',
    indirect: 'the build addresses the problem indirectly',
  },
  alternatives: {
    workaround: 'customers use a hacked-together workaround today',
    competitor: 'customers use a direct competitor today',
    nothing: 'customers do nothing about it today',
  },
  willingness_to_pay: {
    strong: 'clear evidence people will pay',
    weak: 'weak evidence people will pay',
    none: 'no evidence people will pay',
  },
  route_to_market: {
    clear: 'a clear route to the first customer',
    vague: 'a vague route to market',
  },
  users: { many: 'many users', some: 'some users', none: 'no users' },
  retention: { high: 'customers come back', low: 'customers rarely come back' },
  paying: { yes: 'paying customers', no: 'no paying customers' },
  revenue: { high: 'meaningful revenue', low: 'small revenue', none: 'no revenue' },
  formalisation: { yes: 'a registered business', no: 'an unregistered business' },
  constraint_type: {
    money: 'needs funding',
    skills: 'needs technical or business skills',
    network: 'needs connections or market access',
  },
}

export type Fit = 'founderProblem' | 'problemSolution' | 'solutionMarket'

export const FIT_LABELS: Record<Fit, string> = {
  founderProblem: 'Founder–Problem',
  problemSolution: 'Problem–Solution',
  solutionMarket: 'Solution–Market',
}

/** Which questions feed which fit, per scenario. */
export const FIT_QUESTIONS: Record<Scenario, Record<Fit, string[]>> = {
  A: {
    founderProblem: ['founder_proximity', 'motivation', 'constraint_type'],
    problemSolution: ['problem_evidence', 'problem_specificity', 'addresses_problem', 'validation_effort'],
    solutionMarket: ['alternatives', 'willingness_to_pay', 'route_to_market'],
  },
  B: {
    founderProblem: ['founder_experience', 'motivation', 'constraint_type'],
    problemSolution: ['build_evidence', 'usage', 'validation_effort', 'addresses_problem'],
    solutionMarket: ['alternatives', 'willingness_to_pay', 'route_to_market'],
  },
  C: {
    founderProblem: ['founder_experience', 'motivation', 'constraint_type'],
    problemSolution: ['users', 'retention'],
    solutionMarket: ['paying', 'revenue', 'alternatives', 'route_to_market', 'formalisation'],
  },
}

/**
 * Per-question weight inside its fit. constraint_type sits near zero: it
 * decides which mentor and which scheme a founder gets, not whether they are
 * any good, and it is surfaced prominently in the UI instead.
 */
export const QUESTION_WEIGHTS: Record<string, number> = {
  constraint_type: 0.05,
  formalisation: 0.4,
  problem_specificity: 0.8,
  addresses_problem: 0.8,
  retention: 0.9,
}

export function weightFor(key: string): number {
  return QUESTION_WEIGHTS[key] ?? 1
}

/**
 * Fit weights per scenario. One weighting across all three would rank an idea
 * against a trading business: founder–problem carries most on A, where there is
 * nothing else to judge; solution–market carries most on C.
 */
export const FIT_WEIGHTS: Record<Scenario, Record<Fit, number>> = {
  A: { founderProblem: 0.5, problemSolution: 0.35, solutionMarket: 0.15 },
  B: { founderProblem: 0.3, problemSolution: 0.45, solutionMarket: 0.25 },
  C: { founderProblem: 0.2, problemSolution: 0.3, solutionMarket: 0.5 },
}

/**
 * Floors, per fit per scenario. Below a floor the whole assessment is capped
 * and the reason is named: a weighted mean would let a strong founder paper
 * over `problem_evidence = asserted`, and the cap is more useful to a reviewer
 * than any composite.
 */
export const FIT_FLOORS: Record<Scenario, Record<Fit, number>> = {
  A: { founderProblem: 30, problemSolution: 35, solutionMarket: 20 },
  B: { founderProblem: 30, problemSolution: 40, solutionMarket: 25 },
  C: { founderProblem: 25, problemSolution: 35, solutionMarket: 40 },
}

/**
 * Categorical floors: a single label that caps regardless of any mean.
 *
 * Only substantive negative labels appear here. An escape label such as
 * `unclear` must never cap — that would punish a thin dossier as though the
 * founder had answered badly.
 */
export const LABEL_FLOORS: Array<{
  scenarios: Scenario[]
  key: string
  labels: string[]
  reason: string
}> = [
  {
    scenarios: ['A'],
    key: 'problem_evidence',
    labels: ['asserted'],
    reason: 'problem_evidence = asserted (stated with no source)',
  },
  {
    scenarios: ['A'],
    key: 'founder_proximity',
    labels: ['none'],
    reason: 'founder_proximity = none (no prior connection to the field)',
  },
  {
    scenarios: ['B'],
    key: 'usage',
    labels: ['none'],
    reason: 'usage = none (built, but nobody has used it)',
  },
  {
    scenarios: ['C'],
    key: 'users',
    labels: ['none'],
    reason: 'users = none (declared in market with no users)',
  },
]

/** Decisive questions. Low confidence or a missing answer here routes to a human. */
export const DECISIVE_QUESTIONS: Record<Scenario, string[]> = {
  A: ['problem_evidence', 'founder_proximity', 'validation_effort'],
  B: ['build_evidence', 'usage', 'founder_experience'],
  C: ['users', 'paying', 'revenue'],
}

export const BANDS = ['strong', 'promising', 'early', 'unscored'] as const
export type Band = (typeof BANDS)[number]

/**
 * Band thresholds on the composite. Bands and a within-band rank only —
 * probabilities are uncalibrated on a new task, so a percentage would be read
 * as a confidence it has not earned.
 */
export const BAND_THRESHOLDS: Array<{ band: Band; min: number }> = [
  { band: 'strong', min: 72 },
  { band: 'promising', min: 50 },
  { band: 'early', min: 0 },
]

export function bandForComposite(composite: number): Band {
  for (const { band, min } of BAND_THRESHOLDS) {
    if (composite >= min) return band
  }
  return 'early'
}
