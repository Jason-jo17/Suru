/**
 * A local stand-in for the Laya endpoint, for exercising the SCORED code path.
 *
 * This is a test harness, not a scorer and not a fallback. It proves the
 * plumbing — that labels, probabilities and confidences travel from an HTTP
 * response through assembly into bands, flags and the reviewer screen. It says
 * nothing whatsoever about whether Laya would agree with any of it, and the
 * pipeline must never be pointed at this in anything but a local test.
 *
 *   npm run stub:laya              # listens on 4555
 *   LAYA_API_KEY=test LAYA_BASE_URL=http://localhost:4555 npm run score
 *
 * Labels come from each fixture candidate's `_expected.answers` where it names
 * one, and otherwise from a fixed middle-of-the-scale default, so a run is
 * deterministic and a band is reproducible.
 */
import http from 'http'
import { labelsFor, loadQuestionSets, type LayaQuestion } from '../src/lib/laya/questionSets'
import { readExport } from '../src/lib/ingest/readExport'
import { normalizeRecord } from '../src/lib/ingest/fieldMap'
import { LABEL_VALUES } from '../src/lib/assemble/labels'

const PORT = Number(process.env.STUB_PORT || 4555)

interface Fixture {
  words: Set<string>
  answers: Record<string, string | number>
}

/** Distinctive words, for matching a stripped dossier back to its fixture. */
function words(text: string): Set<string> {
  return new Set(
    (text ?? '')
      .toLowerCase()
      // \p{M} keeps Devanagari vowel marks attached; without it every Hindi
      // word shatters into one-character fragments and matches nothing.
      .split(/[^\p{L}\p{N}\p{M}]+/u)
      .filter((w) => w.length > 3),
  )
}

const fixtures: Fixture[] = readExport('test/candidates.json').map((row) => {
  const expected = (row as Record<string, unknown>)._expected as
    | { answers?: Record<string, string | number> }
    | undefined
  // Through the field map first: a fixture row may arrive with Hindi headers,
  // in which case its raw keys are Hindi sentences, not stable field ids.
  const answers = normalizeRecord(row)
  const source = [answers.problem_solution, answers.who_will_use, answers.founder_proximity]
    .filter(Boolean)
    .join(' ')
  return { words: words(source), answers: expected?.answers ?? {} }
})

/**
 * Matches a state back to the fixture it came from by word overlap, which
 * survives identity stripping and truncation in a way a prefix match does not.
 */
function fixtureFor(state: Record<string, string>): Fixture | undefined {
  const stateWords = words(
    [state.problem, state.who_has_it, state.founder_background].filter(Boolean).join(' '),
  )
  if (stateWords.size === 0) return undefined

  let best: Fixture | undefined
  let bestScore = 0
  for (const fixture of fixtures) {
    let overlap = 0
    for (const w of stateWords) if (fixture.words.has(w)) overlap++
    const score = overlap / Math.max(1, Math.min(stateWords.size, fixture.words.size))
    if (score > bestScore) {
      bestScore = score
      best = fixture
    }
  }
  // Below this the match is coincidence, and guessing a fixture would put the
  // wrong pinned labels on a candidate.
  return bestScore >= 0.5 ? best : undefined
}

/**
 * A genuinely middling default for any question the fixture does not pin.
 *
 * Chosen by value rather than by position: on a two-label scale the positional
 * middle is the *best* label, which would make every unpinned candidate look
 * strong and tell us nothing.
 */
function defaultLabel(key: string, question: LayaQuestion): string {
  const labels = labelsFor(question).filter(
    (l) => !['unclear', 'unknown', 'not_asked', 'unverifiable'].includes(l),
  )
  if (labels.length === 0) return 'unclear'
  const table = LABEL_VALUES[key]
  if (!table) return labels[Math.floor((labels.length - 1) / 2)]
  return labels.reduce((best, l) =>
    Math.abs((table[l] ?? 50) - 50) < Math.abs((table[best] ?? 50) - 50) ? l : best,
  )
}

function answerFor(key: string, question: LayaQuestion, fixture: Fixture | undefined) {
  const pinned = fixture?.answers?.[key]
  const labels = labelsFor(question)

  let label: string
  if (typeof pinned === 'string') label = pinned
  else if (typeof pinned === 'number') label = labels[pinned] ?? defaultLabel(key, question)
  else label = defaultLabel(key, question)

  const index = labels.indexOf(label)
  // A peaked but not degenerate distribution, so the UI has something real to
  // draw and the confidence routing has something to act on.
  const probabilities: Record<string, number> = {}
  const peak = 0.72
  const rest = labels.length > 1 ? (1 - peak) / (labels.length - 1) : 0
  for (const l of labels) probabilities[l] = l === label ? peak : rest

  return {
    choice: question.type === 'choice' ? label : undefined,
    score: question.type === 'score' ? Math.max(0, index) : undefined,
    noul: peak,
    probabilities,
    confidence: peak,
  }
}

function answersFor(state: Record<string, string>, questions: Record<string, LayaQuestion>) {
  const fixture = fixtureFor(state)
  const out: Record<string, unknown> = {}
  for (const [key, question] of Object.entries(questions)) {
    out[key] = answerFor(key, question, fixture)
  }
  return out
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? ''
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  if (!req.headers.authorization?.startsWith('Bearer ')) {
    return json(401, { error: 'missing bearer token' })
  }
  if (url.endsWith('/v1/health')) return json(200, { status: 'ok', stub: true })
  if (url.endsWith('/v1/whoami')) return json(200, { key: 'stub', stub: true })

  const { sets } = loadQuestionSets()
  void sets

  try {
    const payload = JSON.parse(await readBody(req)) as {
      state?: Record<string, string>
      states?: Record<string, string>[]
      questions: Record<string, LayaQuestion>
    }

    if (url.endsWith('/v1/systemone/batch')) {
      const states = payload.states ?? []
      return json(200, {
        results: states.map((state) => ({ answers: answersFor(state, payload.questions) })),
      })
    }
    if (url.endsWith('/v1/systemone')) {
      return json(200, { answers: answersFor(payload.state ?? {}, payload.questions) })
    }
  } catch (err) {
    return json(400, { error: (err as Error).message })
  }

  return json(404, { error: `no stub route for ${url}` })
})

server.listen(PORT, () => {
  console.log(`laya stub listening on http://localhost:${PORT}`)
  console.log('This is a TEST HARNESS. It is not a scorer and never a fallback for Laya.')
})
