import { prisma } from '../db'
import type { LayaRun } from '@prisma/client'
import { questionSetFor, questionSetVersion, type QuestionSet } from './questionSets'
import { routeCandidate, type Scenario } from '../route'

/**
 * Laya client.
 *
 * The one rule that outranks everything else here: **this module never
 * throws.** Laya is not a hard dependency. Any non-200, timeout or network
 * error returns a null result and the run is persisted as `unscored`, which is
 * a correct and visible state that leaves the candidate in the human queue.
 *
 * It also never falls back to another scorer. An LLM standing in for Laya would
 * silently change what the score means, which is worse than no score.
 */

const DEFAULT_BASE_URL = 'https://autoextract.theboringpeople.in/api/laya'

export const ENGLISH_CHECKPOINT = 'convaiinnovations/laya'
export const MULTILINGUAL_CHECKPOINT = 'convaiinnovations/laya-multilingual'

/** Max states the batch endpoint accepts in one call. */
export const MAX_BATCH = 64

function baseUrl(): string {
  return (process.env.LAYA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function timeoutMs(): number {
  return Number(process.env.LAYA_TIMEOUT_MS || 90_000)
}

function maxAttempts(): number {
  return Number(process.env.LAYA_MAX_ATTEMPTS || 4)
}

export interface LayaAnswer {
  choice?: string
  score?: number
  /** P(true) as returned by the model. */
  noul?: number
  probabilities?: Record<string, number>
  confidence?: number
}

export type LayaAnswers = Record<string, LayaAnswer>

export interface LayaOutcome {
  status: 'scored' | 'unscored'
  /** null whenever status is 'unscored'. Never a partial or invented result. */
  answers: LayaAnswers | null
  error?: string
  httpStatus?: number
  latencyMs: number
  attempts: number
  /** Set when the key is missing, revoked or expired — needs a human alert. */
  authFailure?: boolean
}

/**
 * The English checkpoint on Hinglish is a silent accuracy loss, not a visible
 * error, so anything that is not plainly English goes to the multilingual one.
 */
export function checkpointFor(language: string | null | undefined): string {
  const lang = (language || '').trim().toLowerCase()
  return lang === 'english' || lang === 'en' ? ENGLISH_CHECKPOINT : MULTILINGUAL_CHECKPOINT
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Honours Retry-After in both its seconds and HTTP-date forms. */
function retryAfterMs(res: Response, fallback: number): number {
  const header = res.headers.get('Retry-After')
  if (!header) return fallback
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(header)
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now())
  return fallback
}

interface PostResult {
  ok: boolean
  body?: unknown
  error?: string
  httpStatus?: number
  attempts: number
  authFailure?: boolean
}

/**
 * One POST with the full retry policy. Resolves — never rejects.
 *
 *   503  model loading after a deploy, or busy. Backoff and retry; expect a few
 *        minutes of this after any deployment.
 *   429  honour Retry-After.
 *   401  key missing, revoked or expired. Alert, stop, do not fall back.
 *   5xx / timeout / network  retry, then give up as unscored.
 */
async function post(pathname: string, payload: unknown): Promise<PostResult> {
  const apiKey = process.env.LAYA_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      error: 'LAYA_API_KEY not set',
      attempts: 0,
      authFailure: true,
    }
  }

  const url = `${baseUrl()}${pathname}`
  const limit = maxAttempts()
  let attempts = 0
  let lastError = 'unknown error'
  let lastStatus: number | undefined

  while (attempts < limit) {
    attempts++
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs())

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      lastStatus = res.status

      if (res.status === 401 || res.status === 403) {
        // Never retried and never worked around: a bad key must be fixed by a
        // human, and silently scoring with something else would corrupt the set.
        console.error(
          `[laya] ${res.status} from ${pathname}: API key missing, revoked or expired. ` +
            `Runs will be recorded as unscored until it is replaced. No fallback scorer is used.`,
        )
        return {
          ok: false,
          error: `${res.status} unauthorized — LAYA_API_KEY rejected`,
          httpStatus: res.status,
          attempts,
          authFailure: true,
        }
      }

      if (res.status === 503) {
        lastError = '503 model loading or busy'
        if (attempts < limit) {
          // Deploys can take minutes; grow the wait rather than hammering.
          await sleep(retryAfterMs(res, Math.min(30_000, 5_000 * 2 ** (attempts - 1))))
          continue
        }
        break
      }

      if (res.status === 429) {
        lastError = '429 rate limited'
        if (attempts < limit) {
          await sleep(retryAfterMs(res, 10_000))
          continue
        }
        break
      }

      if (!res.ok) {
        lastError = `HTTP ${res.status}`
        if (res.status >= 500 && attempts < limit) {
          await sleep(Math.min(20_000, 2_000 * 2 ** (attempts - 1)))
          continue
        }
        break
      }

      return { ok: true, body: await res.json(), httpStatus: res.status, attempts }
    } catch (err) {
      const e = err as Error
      lastError = e.name === 'AbortError' ? `timeout after ${timeoutMs()}ms` : e.message
      if (attempts < limit) {
        await sleep(Math.min(20_000, 2_000 * 2 ** (attempts - 1)))
        continue
      }
    } finally {
      clearTimeout(timer)
    }
  }

  return { ok: false, error: lastError, httpStatus: lastStatus, attempts }
}

function parseAnswers(body: unknown): LayaAnswers | null {
  if (!body || typeof body !== 'object') return null
  const answers = (body as { answers?: unknown }).answers
  if (!answers || typeof answers !== 'object') return null
  return answers as LayaAnswers
}

/** Scores one state. Never throws. */
export async function callSystemOne(
  state: Record<string, string>,
  questions: QuestionSet,
  model: string,
): Promise<LayaOutcome> {
  const start = Date.now()
  const result = await post('/v1/systemone', { state, questions, model })
  const latencyMs = Date.now() - start

  if (!result.ok) {
    return {
      status: 'unscored',
      answers: null,
      error: result.error,
      httpStatus: result.httpStatus,
      latencyMs,
      attempts: result.attempts,
      authFailure: result.authFailure,
    }
  }

  const answers = parseAnswers(result.body)
  if (!answers) {
    return {
      status: 'unscored',
      answers: null,
      error: 'response had no answers object',
      httpStatus: result.httpStatus,
      latencyMs,
      attempts: result.attempts,
    }
  }

  return { status: 'scored', answers, httpStatus: result.httpStatus, latencyMs, attempts: result.attempts }
}

/**
 * Scores up to MAX_BATCH states in one call — the cheap path for a cohort, and
 * the right answer to a 429. Returns one outcome per input state, in order.
 * Never throws: a failed batch yields an unscored outcome for every state.
 */
export async function callSystemOneBatch(
  states: Record<string, string>[],
  questions: QuestionSet,
  model: string,
): Promise<LayaOutcome[]> {
  if (states.length === 0) return []
  if (states.length > MAX_BATCH) {
    const head = await callSystemOneBatch(states.slice(0, MAX_BATCH), questions, model)
    const tail = await callSystemOneBatch(states.slice(MAX_BATCH), questions, model)
    return [...head, ...tail]
  }

  const start = Date.now()
  const result = await post('/v1/systemone/batch', { states, questions, model })
  const latencyMs = Date.now() - start

  const failure = (error: string): LayaOutcome[] =>
    states.map(() => ({
      status: 'unscored' as const,
      answers: null,
      error,
      httpStatus: result.httpStatus,
      latencyMs,
      attempts: result.attempts,
      authFailure: result.authFailure,
    }))

  if (!result.ok) return failure(result.error || 'batch failed')

  const body = result.body as { results?: unknown[]; answers?: unknown[] } | null
  const rows = (body?.results ?? body?.answers) as unknown[] | undefined
  if (!Array.isArray(rows) || rows.length !== states.length) {
    return failure(
      `batch returned ${Array.isArray(rows) ? rows.length : 'no'} results for ${states.length} states`,
    )
  }

  return rows.map((row) => {
    const answers = parseAnswers(row) ?? parseAnswers({ answers: row })
    if (!answers) {
      return {
        status: 'unscored' as const,
        answers: null,
        error: 'batch row had no answers object',
        httpStatus: result.httpStatus,
        latencyMs,
        attempts: result.attempts,
      }
    }
    return {
      status: 'scored' as const,
      answers,
      httpStatus: result.httpStatus,
      latencyMs,
      attempts: result.attempts,
    }
  })
}

async function get(pathname: string): Promise<{ ok: boolean; body?: unknown; error?: string }> {
  const apiKey = process.env.LAYA_API_KEY
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs())
  try {
    const res = await fetch(`${baseUrl()}${pathname}`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: controller.signal,
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return { ok: true, body: await res.json() }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  } finally {
    clearTimeout(timer)
  }
}

/** GET /v1/health. Never throws. */
export function health() {
  return get('/v1/health')
}

/** GET /v1/whoami. Never throws. */
export function whoami() {
  return get('/v1/whoami')
}

/**
 * Persists one run. Always writes a row — `scored` with answers, or `unscored`
 * with the reason — because a candidate who falls out of the queue entirely is
 * the outcome this system most needs to avoid.
 */
export async function persistLayaRun(args: {
  dossierId: string
  scenario: Scenario
  modelCheckpoint: string
  questions: QuestionSet
  routingFlags?: string[]
  outcome: LayaOutcome
}): Promise<LayaRun> {
  const { dossierId, scenario, modelCheckpoint, questions, outcome } = args
  return prisma.layaRun.create({
    data: {
      dossierId,
      scenario,
      questionSetVersion: questionSetVersion(),
      modelCheckpoint,
      // Stored with the routing flags beside them, so a reviewer can always see
      // exactly which questions were asked and why that set was chosen.
      questionsSent: JSON.stringify({ questions, routingFlags: args.routingFlags ?? [] }),
      answers: JSON.stringify(outcome.answers ?? {}),
      status: outcome.status,
      error: outcome.error ?? null,
      latencyMs: outcome.latencyMs,
    },
  })
}

export interface ScoreOptions {
  scenario?: Scenario
  routingFlags?: string[]
}

/**
 * Scores a stored dossier and persists the LayaRun.
 *
 * Always writes a row: `scored` with answers, or `unscored` with the reason.
 * The only throw is a dossier id that does not exist, which is a programming
 * error rather than a model outage.
 */
export async function scoreDossier(dossierId: string, opts: ScoreOptions = {}): Promise<LayaRun> {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { candidate: { include: { responses: true } } },
  })
  if (!dossier) throw new Error(`Dossier not found: ${dossierId}`)

  const candidate = dossier.candidate

  let scenario = opts.scenario
  let routingFlags = opts.routingFlags ?? []
  if (!scenario) {
    const answers: Record<string, string> = {}
    for (const r of candidate.responses) {
      if (r.value?.trim()) answers[r.fieldId] = r.value
    }
    const routing = routeCandidate(answers, candidate.declaredStage)
    scenario = routing.scenario
    routingFlags = routing.flags
  }

  const questions = questionSetFor(scenario)
  const modelCheckpoint = checkpointFor(candidate.language)
  const state = JSON.parse(dossier.payload) as Record<string, string>

  const outcome = await callSystemOne(state, questions, modelCheckpoint)

  return persistLayaRun({
    dossierId,
    scenario,
    modelCheckpoint,
    questions,
    routingFlags,
    outcome,
  })
}

/** The questions as sent, read back off a stored run. */
export function questionsFromRun(run: Pick<LayaRun, 'questionsSent'>): QuestionSet {
  try {
    const parsed = JSON.parse(run.questionsSent)
    if (parsed && typeof parsed === 'object') {
      if (parsed.questions && typeof parsed.questions === 'object') return parsed.questions as QuestionSet
      return parsed as QuestionSet
    }
  } catch {
    // unreadable run metadata; the caller falls back to the live question set
  }
  return {}
}

/** Routing flags, read back off a stored run. */
export function routingFlagsFromRun(run: Pick<LayaRun, 'questionsSent'>): string[] {
  try {
    const parsed = JSON.parse(run.questionsSent)
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.routingFlags)) {
      return parsed.routingFlags as string[]
    }
  } catch {
    // a run written before this field existed; no flags to read
  }
  return []
}
