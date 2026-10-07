import { prisma } from '../db'
import type { Assessment } from '@prisma/client'
import type { LayaAnswer, LayaAnswers } from '../laya/client'
import { routingFlagsFromRun } from '../laya/client'
import { labelsFor, questionSetFor } from '../laya/questionSets'
import { decisiveContentTokens } from '../distil/buildDossier'
import type { Scenario } from '../route'
import {
  BAND_THRESHOLDS,
  DECISIVE_QUESTIONS,
  FIT_FLOORS,
  FIT_LABELS,
  FIT_QUESTIONS,
  FIT_WEIGHTS,
  LABEL_FLOORS,
  LABEL_PHRASES,
  LABEL_VALUES,
  bandForComposite,
  isMissing,
  weightFor,
  type Band,
  type Fit,
} from './labels'

/**
 * Stage 4 — assembly. Deterministic arithmetic, no second model call, and no
 * prose from the model: the reviewer-facing explanation is built here, from the
 * typed labels.
 */

/** Below this, a decisive answer is not trusted and a human decides instead. */
const CONFIDENCE_FLOOR = Number(process.env.CONFIDENCE_FLOOR || 0.1)

/**
 * Below this much content across a scenario's five decisive fields, there was
 * not enough in the dossier to band on. Measured on the values alone — see
 * `decisiveContentTokens`.
 */
const THIN_DOSSIER_TOKENS = Number(process.env.THIN_DOSSIER_TOKENS || 25)

const FITS: Fit[] = ['founderProblem', 'problemSolution', 'solutionMarket']

/**
 * The label an answer carries, whichever form it came back in:
 * `.choice` for a choice question, or `.score` as a 0-based position on the
 * scale for a score question.
 */
export function labelOf(key: string, answer: LayaAnswer | undefined, scenario: Scenario): string | null {
  if (!answer) return null
  if (typeof answer.choice === 'string' && answer.choice !== '') return answer.choice
  if (typeof answer.score === 'number') {
    const question = questionSetFor(scenario)[key]
    if (!question) return null
    const labels = labelsFor(question)
    return labels[answer.score] ?? null
  }
  return null
}

interface QuestionReading {
  key: string
  label: string | null
  value: number | null
  confidence: number | null
  missing: boolean
  weight: number
}

function read(key: string, answers: LayaAnswers, scenario: Scenario): QuestionReading {
  const answer = answers[key]
  const label = labelOf(key, answer, scenario)
  const confidence = typeof answer?.confidence === 'number' ? answer.confidence : null
  const table = LABEL_VALUES[key] ?? {}
  const normalized = label ? label.trim().toLowerCase() : null
  const missing = isMissing(normalized) || normalized === null || !(normalized in table)

  return {
    key,
    label,
    value: missing ? null : table[normalized as string],
    confidence,
    missing,
    weight: weightFor(key),
  }
}

export interface FitResult {
  fit: Fit
  score: number | null
  answered: QuestionReading[]
  missing: string[]
  belowFloor: boolean
}

/**
 * One fit score: a weighted mean over the questions that actually came back
 * with a usable label. Missing answers are excluded, never counted as zero.
 */
function scoreFit(fit: Fit, answers: LayaAnswers, scenario: Scenario): FitResult {
  const keys = FIT_QUESTIONS[scenario][fit]
  const readings = keys.map((k) => read(k, answers, scenario))
  const usable = readings.filter((r) => !r.missing && r.value !== null)
  const missing = readings.filter((r) => r.missing).map((r) => r.key)

  if (usable.length === 0) {
    return { fit, score: null, answered: readings, missing, belowFloor: false }
  }

  const totalWeight = usable.reduce((sum, r) => sum + r.weight, 0)
  const weighted = usable.reduce((sum, r) => sum + (r.value as number) * r.weight, 0)
  const score = Math.round(weighted / totalWeight)

  return {
    fit,
    score,
    answered: readings,
    missing,
    belowFloor: score < FIT_FLOORS[scenario][fit],
  }
}

export interface AssembleResult {
  band: Band
  founderProblem: number | null
  problemSolution: number | null
  solutionMarket: number | null
  composite: number | null
  cappedBy: string | null
  flags: string[]
  explanation: string[]
  confidence: number | null
  needsHuman: boolean
  fits: FitResult[]
  /** constraint_type, surfaced because it is what the programme acts on. */
  constraintType: string | null
}

/**
 * Turns typed Laya answers into bands and flags. Pure: the same answers always
 * assemble to the same assessment, which is what makes a re-score reproducible.
 */
export function assemble(
  answers: LayaAnswers,
  scenario: Scenario,
  context: {
    /** Content in the decisive fields only, from `decisiveContentTokens`. */
    decisiveTokens?: number
    routingFlags?: string[]
    unscored?: boolean
  } = {},
): AssembleResult {
  const flags = [...(context.routingFlags ?? [])]
  const explanation: string[] = []
  const fits = FITS.map((fit) => scoreFit(fit, answers, scenario))
  const byFit = Object.fromEntries(fits.map((f) => [f.fit, f])) as Record<Fit, FitResult>

  const constraintReading = read('constraint_type', answers, scenario)
  const constraintType = constraintReading.missing ? null : (constraintReading.label as string)

  // --- the model could not be reached at all ---
  if (context.unscored) {
    return {
      band: 'unscored',
      founderProblem: null,
      problemSolution: null,
      solutionMarket: null,
      composite: null,
      cappedBy: null,
      flags: [...flags, 'laya_unavailable'],
      explanation: ['Not scored: the model could not be reached. Left in the human queue.'],
      confidence: null,
      needsHuman: true,
      fits,
      constraintType,
    }
  }

  // --- submission authenticity ---
  // Not a quality judgement and never an auto-reject: flagged, capped, and left
  // for a human to close out.
  const submissionReal = read('submission_real', answers, scenario)
  const isSpam = submissionReal.label?.trim().toLowerCase() === 'spam'
  if (isSpam) flags.push('suspected_spam')

  // --- confidence and missing evidence on decisive questions ---
  const decisive = DECISIVE_QUESTIONS[scenario].map((k) => read(k, answers, scenario))
  const lowConfidence = decisive.filter(
    (r) => r.confidence !== null && r.confidence < CONFIDENCE_FLOOR,
  )
  const missingDecisive = decisive.filter((r) => r.missing)
  const thinDossier =
    context.decisiveTokens !== undefined && context.decisiveTokens < THIN_DOSSIER_TOKENS

  for (const r of lowConfidence) flags.push(`low_confidence:${r.key}`)
  for (const r of missingDecisive) flags.push(`missing_evidence:${r.key}`)
  if (thinDossier) flags.push('thin_dossier')

  const allConfidences = Object.values(answers)
    .map((a) => (typeof a?.confidence === 'number' ? a.confidence : null))
    .filter((c): c is number => c !== null)
  const confidence =
    allConfidences.length > 0
      ? Number((allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length).toFixed(3))
      : null

  const needsHuman =
    lowConfidence.length > 0 || missingDecisive.length > 0 || thinDossier || isSpam

  // A decisive answer that is missing or untrusted means there is not enough to
  // band on. That is usually a thin dossier, not a weak founder, so it routes
  // to a human rather than scoring low.
  if (lowConfidence.length > 0 || missingDecisive.length > 0 || thinDossier) {
    const reasons: string[] = []
    if (missingDecisive.length > 0) {
      reasons.push(
        `no usable answer for ${missingDecisive.map((r) => r.key).join(', ')}`,
      )
    }
    if (lowConfidence.length > 0) {
      reasons.push(
        `low model confidence on ${lowConfidence.map((r) => r.key).join(', ')}`,
      )
    }
    if (thinDossier) {
      reasons.push(
        `the dossier holds only ${context.decisiveTokens} tokens across the fields that decide this scenario`,
      )
    }

    return {
      band: 'unscored',
      founderProblem: byFit.founderProblem.score,
      problemSolution: byFit.problemSolution.score,
      solutionMarket: byFit.solutionMarket.score,
      composite: null,
      cappedBy: null,
      flags,
      explanation: [
        `Not banded — routed to a reviewer because ${reasons.join('; ')}.`,
        'Missing evidence is not bad evidence: this is not a low score.',
        ...describeAnswers(fits),
      ],
      confidence,
      needsHuman: true,
      fits,
      constraintType,
    }
  }

  // --- composite, used only for the band boundary and the within-band rank ---
  const weights = FIT_WEIGHTS[scenario]
  const scored = fits.filter((f) => f.score !== null)
  const totalWeight = scored.reduce((sum, f) => sum + weights[f.fit], 0)
  const composite =
    totalWeight > 0
      ? Math.round(
          scored.reduce((sum, f) => sum + (f.score as number) * weights[f.fit], 0) / totalWeight,
        )
      : null

  // --- floors ---
  let cappedBy: string | null = null

  for (const floor of LABEL_FLOORS) {
    if (!floor.scenarios.includes(scenario)) continue
    const reading = read(floor.key, answers, scenario)
    const label = reading.label?.trim().toLowerCase()
    if (label && floor.labels.includes(label)) {
      cappedBy = floor.reason
      break
    }
  }

  if (!cappedBy) {
    const below = fits.find((f) => f.belowFloor)
    if (below) {
      cappedBy = `${FIT_LABELS[below.fit]} ${below.score} is below its floor of ${
        FIT_FLOORS[scenario][below.fit]
      }`
    }
  }

  if (!cappedBy && isSpam) cappedBy = 'submission_real = spam'

  const band: Band = cappedBy ? 'early' : bandForComposite(composite ?? 0)

  if (cappedBy) {
    explanation.push(`Capped at "early": ${cappedBy}.`)
  } else {
    explanation.push(
      `Banded "${band}" on the ${scenario} question set (${BAND_THRESHOLDS.map(
        (t) => `${t.band} ≥ ${t.min}`,
      ).join(', ')}).`,
    )
  }
  explanation.push(...describeAnswers(fits))
  if (constraintType) {
    explanation.push(
      `Asked for help with: ${
        LABEL_PHRASES.constraint_type?.[constraintType] ?? constraintType
      }. Not scored — it decides which support they get.`,
    )
  }

  return {
    band,
    founderProblem: byFit.founderProblem.score,
    problemSolution: byFit.problemSolution.score,
    solutionMarket: byFit.solutionMarket.score,
    composite,
    cappedBy,
    flags,
    explanation,
    confidence,
    needsHuman,
    fits,
    constraintType,
  }
}

/** Plain sentences built from the labels — the model writes none of this. */
function describeAnswers(fits: FitResult[]): string[] {
  const out: string[] = []
  for (const fit of fits) {
    const phrases = fit.answered
      .filter((r) => !r.missing && r.key !== 'constraint_type' && r.label)
      .map((r) => LABEL_PHRASES[r.key]?.[r.label as string] ?? `${r.key} = ${r.label}`)
    if (phrases.length === 0) {
      out.push(`${FIT_LABELS[fit.fit]}: nothing usable came back.`)
      continue
    }
    const score = fit.score === null ? 'not scored' : String(fit.score)
    const missingNote =
      fit.missing.length > 0 ? ` Not established: ${fit.missing.join(', ')}.` : ''
    out.push(`${FIT_LABELS[fit.fit]} (${score}): ${phrases.join('; ')}.${missingNote}`)
  }
  return out
}

/**
 * Scores a stored LayaRun into an Assessment row.
 *
 * Every run produces exactly one assessment, including an unscored one — a
 * candidate who falls out of the queue entirely is the dangerous outcome.
 */
export async function assembleAssessment(layaRunId: string): Promise<Assessment> {
  const layaRun = await prisma.layaRun.findUnique({
    where: { id: layaRunId },
    include: { dossier: { include: { candidate: true } } },
  })
  if (!layaRun) throw new Error(`LayaRun not found: ${layaRunId}`)

  const scenario = layaRun.scenario as Scenario
  const routingFlags = routingFlagsFromRun(layaRun)

  let answers: LayaAnswers = {}
  try {
    answers = JSON.parse(layaRun.answers) as LayaAnswers
  } catch {
    answers = {}
  }

  const payload = (() => {
    try {
      return JSON.parse(layaRun.dossier.payload) as Record<string, string>
    } catch {
      return {}
    }
  })()

  const result = assemble(answers, scenario, {
    decisiveTokens: decisiveContentTokens(payload, scenario),
    routingFlags,
    unscored: layaRun.status === 'unscored',
  })

  const candidateId = layaRun.dossier.candidateId

  // A re-score appends. The previous assessment stays on the record — it may be
  // the one a reviewer already acted on — but stops being the one that filters
  // and ranks see.
  const [, created] = await prisma.$transaction([
    prisma.assessment.updateMany({
      where: { candidateId, isLatest: true },
      data: { isLatest: false },
    }),
    prisma.assessment.create({
      data: {
        candidateId,
        layaRunId,
        founderProblem: result.founderProblem,
        problemSolution: result.problemSolution,
        solutionMarket: result.solutionMarket,
        composite: result.composite,
        band: result.band,
        cappedBy: result.cappedBy,
        flags: JSON.stringify(result.flags),
        explanation: JSON.stringify(result.explanation),
        confidence: result.confidence,
        needsHuman: result.needsHuman,
        isLatest: true,
        scenario,
        questionSetVersion: layaRun.questionSetVersion,
        modelCheckpoint: layaRun.modelCheckpoint,
        distillerVersion: layaRun.dossier.distillerVersion,
      },
    }),
  ])

  return created
}
