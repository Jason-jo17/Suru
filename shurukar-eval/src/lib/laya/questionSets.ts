import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { Scenario } from '../route'

export interface LayaQuestion {
  type: 'choice' | 'score'
  instructions: string
  criteria: Record<string, string> | string[]
}

export type QuestionSet = Record<string, LayaQuestion>

const DEFAULT_PATH = 'test/question-sets.json'

function resolvePath(): string {
  const configured = process.env.QUESTION_SETS_PATH || DEFAULT_PATH
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
}

let cache: { sets: Record<Scenario, QuestionSet>; version: string } | null = null

/**
 * Loads the three question sets from disk. Never inlined: the wording decides
 * accuracy, so it lives in one reviewable file.
 *
 * The version is a content hash of that file, so it changes the moment anybody
 * edits a question. Scores carrying different versions must never be compared
 * or ranked together, and a hash is the only version nobody forgets to bump.
 */
export function loadQuestionSets(): { sets: Record<Scenario, QuestionSet>; version: string } {
  if (cache) return cache

  const file = resolvePath()
  const raw = fs.readFileSync(file, 'utf8')
  const parsed = JSON.parse(raw) as Record<string, QuestionSet>

  for (const scenario of ['A', 'B', 'C'] as Scenario[]) {
    if (!parsed[scenario] || Object.keys(parsed[scenario]).length === 0) {
      throw new Error(`Question set "${scenario}" missing or empty in ${file}`)
    }
  }

  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 10)
  const version = process.env.QUESTION_SET_VERSION || `qs-${hash}`

  cache = { sets: parsed as Record<Scenario, QuestionSet>, version }
  return cache
}

export function questionSetFor(scenario: Scenario): QuestionSet {
  return loadQuestionSets().sets[scenario]
}

export function questionSetVersion(): string {
  return loadQuestionSets().version
}

/** The labels a question may come back with, including its escape label. */
export function labelsFor(question: LayaQuestion): string[] {
  return Array.isArray(question.criteria) ? question.criteria : Object.keys(question.criteria)
}

/** Test seam: forget the cached file so a changed path is picked up. */
export function resetQuestionSetCache(): void {
  cache = null
}
