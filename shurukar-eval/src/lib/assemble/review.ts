import type { LayaAnswers } from '../laya/client'
import type { Scenario } from '../route'
import {
  FIT_FLOORS,
  FIT_LABELS,
  FIT_QUESTIONS,
  LABEL_PHRASES,
  LABEL_VALUES,
  isMissing,
  weightFor,
  type Fit,
} from './labels'
import { labelOf } from './scorer'

/**
 * Reads a stored run back into the per-question detail the reviewer screen
 * shows. Pure presentation of what the model returned — it recomputes nothing
 * and judges nothing.
 */

export interface ReviewQuestion {
  key: string
  label: string | null
  phrase: string | null
  confidence: number | null
  probabilities: Record<string, number>
  missing: boolean
  value: number | null
  weight: number
}

export interface ReviewFit {
  fit: Fit
  title: string
  floor: number
  questions: ReviewQuestion[]
  missing: string[]
}

export function reviewQuestion(
  key: string,
  answers: LayaAnswers,
  scenario: Scenario,
): ReviewQuestion {
  const answer = answers[key]
  const label = labelOf(key, answer, scenario)
  const normalized = label ? label.trim().toLowerCase() : null
  const table = LABEL_VALUES[key] ?? {}
  const missing = normalized === null || isMissing(normalized) || !(normalized in table)

  return {
    key,
    label,
    phrase: normalized ? (LABEL_PHRASES[key]?.[normalized] ?? null) : null,
    confidence: typeof answer?.confidence === 'number' ? answer.confidence : null,
    probabilities:
      answer?.probabilities && typeof answer.probabilities === 'object' ? answer.probabilities : {},
    missing,
    value: missing ? null : table[normalized as string],
    weight: weightFor(key),
  }
}

export function reviewFits(answers: LayaAnswers, scenario: Scenario): ReviewFit[] {
  return (Object.keys(FIT_LABELS) as Fit[]).map((fit) => {
    const questions = FIT_QUESTIONS[scenario][fit]
      .filter((key) => key in answers || Object.keys(answers).length === 0)
      .map((key) => reviewQuestion(key, answers, scenario))
    return {
      fit,
      title: FIT_LABELS[fit],
      floor: FIT_FLOORS[scenario][fit],
      questions,
      missing: questions.filter((q) => q.missing).map((q) => q.key),
    }
  })
}

/** Questions outside the three fits — authenticity and the constraint. */
export function reviewExtras(answers: LayaAnswers, scenario: Scenario): ReviewQuestion[] {
  const inFits = new Set(Object.values(FIT_QUESTIONS[scenario]).flat())
  return Object.keys(answers)
    .filter((key) => !inFits.has(key))
    .map((key) => reviewQuestion(key, answers, scenario))
}
