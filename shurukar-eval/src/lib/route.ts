import { scenarioForStage, type Scenario } from './distil/buildDossier'

export type { Scenario }

export interface Routing {
  scenario: Scenario
  /** Declared stage, kept so a reviewer can see it was overridden. */
  declaredScenario: Scenario
  flags: string[]
}

const ZERO = /^(0|none|zero|nil|no|koi nahi|कोई नहीं|-|na|n\/a)$/i
const VERY_FEW = /^(1-5|1 to 5|1 - 5|1–5|one to five)$/i

function isZero(value: string | undefined): boolean {
  if (!value) return false
  return ZERO.test(value.trim())
}

function isVeryFew(value: string | undefined): boolean {
  if (!value) return false
  return VERY_FEW.test(value.trim())
}

/**
 * Picks the question set for a candidate.
 *
 * Routing is on the *declared* stage, with one override: a founder who says
 * "in market" but reports no paying customers and no users is answering the
 * built-stage questions, not the in-market ones. The override is flagged, never
 * silent — a reviewer has to be able to see that the stage was reinterpreted.
 *
 * This never lowers a band on its own. It only decides which questions are
 * asked, so the right scenario weighting applies.
 */
export function routeCandidate(
  answers: Record<string, string>,
  declaredStage: string,
): Routing {
  const declaredScenario = scenarioForStage(declaredStage)
  const flags: string[] = []
  let scenario = declaredScenario

  if (declaredScenario === 'C') {
    const noPaying = isZero(answers.paying_customers)
    const noUsers = isZero(answers.users_count)
    const fewUsers = isVeryFew(answers.users_count)
    const noRevenue = isZero(answers.monthly_income)

    if (noPaying && (noUsers || fewUsers || noRevenue)) {
      scenario = 'B'
      flags.push(
        'stage_contradiction: declared in_market but reported no paying customers — ' +
          'scored on the built-stage question set',
      )
    }
  }

  return { scenario, declaredScenario, flags }
}
