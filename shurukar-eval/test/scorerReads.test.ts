/**
 * Regression tests for the two defects that made the first live run unusable.
 * Run: npx tsx test/scorerReads.test.ts
 *
 * Both were silent. Neither threw, neither failed a typecheck, and both showed
 * up only as candidates mysteriously landing `unscored`.
 */
import assert from 'node:assert/strict'
import { answerConfidenceOf, chanceRatioOf, labelOf } from '../src/lib/assemble/scorer'
import type { LayaAnswer } from '../src/lib/laya/client'

let failures = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  pass  ${name}`)
  } catch (err) {
    failures++
    console.log(`  FAIL  ${name}`)
    console.log(`        ${(err as Error).message.split('\n')[0]}`)
  }
}

console.log('\nDefect 1 — the app thresholded `confidence`, a peakedness metric,')
console.log('instead of `answer_confidence`, which is P(chosen label).\n')

// Taken verbatim from a live /v1/systemone response on an unambiguous case.
const live: LayaAnswer = {
  choice: 'lived',
  probabilities: { lived: 0.5156, observed: 0.129, researched: 0.1272, asserted: 0.0717, unclear: 0.1565 },
  confidence: 0.1629,
  answer_confidence: 0.5156,
}

test('reads answer_confidence, not confidence', () => {
  assert.equal(answerConfidenceOf(live), 0.5156)
})

test('a clear winner is NOT near chance (this is the 10-of-12 bug)', () => {
  const ratio = chanceRatioOf(live, answerConfidenceOf(live))
  assert.ok(ratio !== null && ratio > 1.25, `ratio was ${ratio}, expected > 1.25`)
})

test('falls back to probabilities when answer_confidence is absent', () => {
  const { answer_confidence: _omitted, ...legacy } = live
  assert.equal(answerConfidenceOf(legacy), 0.5156)
})

test('a genuinely flat distribution still trips the floor', () => {
  const flat: LayaAnswer = {
    choice: 'a',
    probabilities: { a: 0.26, b: 0.25, c: 0.25, d: 0.24 },
    answer_confidence: 0.26,
  }
  const ratio = chanceRatioOf(flat, answerConfidenceOf(flat))
  assert.ok(ratio !== null && ratio < 1.25, `ratio was ${ratio}, expected < 1.25`)
})

test('the ratio is scale-free across label counts', () => {
  // Same distance above chance, two and six labels: both must read alike.
  const two: LayaAnswer = { choice: 'y', probabilities: { y: 0.75, n: 0.25 }, answer_confidence: 0.75 }
  const six: LayaAnswer = {
    choice: 'a',
    probabilities: { a: 0.25, b: 0.15, c: 0.15, d: 0.15, e: 0.15, f: 0.15 },
    answer_confidence: 0.25,
  }
  assert.equal(chanceRatioOf(two, 0.75), 1.5)
  assert.equal(chanceRatioOf(six, 0.25), 1.5)
})

test('no distribution means no ratio, never a confident default', () => {
  assert.equal(chanceRatioOf({ choice: 'x', answer_confidence: 0.9 }, 0.9), null)
})

console.log('\nDefect 2 — a score question returns a FRACTIONAL position on the')
console.log('scale, and the label array was indexed with it raw.\n')

test('a fractional score resolves to a label', () => {
  // validation_effort: ["none", "asked_a_few", "asked_many", "tested_with_users"]
  const label = labelOf('validation_effort', { score: 2.0296 }, 'A')
  assert.equal(label, 'asked_many')
})

test('every stored score in the live cohort was fractional', () => {
  for (const score of [2.0296, 0.9809, 1.1635, 1.0752, 1.6703, 1.8128, 1.2235, 1.9284, 2.1021]) {
    assert.notEqual(labelOf('validation_effort', { score }, 'A'), null, `score ${score} read as missing`)
  }
})

test('rounds to the nearest position, not toward zero', () => {
  assert.equal(labelOf('validation_effort', { score: 1.8128 }, 'A'), 'asked_many')
  assert.equal(labelOf('validation_effort', { score: 1.1635 }, 'A'), 'asked_a_few')
})

test('clamps instead of falling off either end', () => {
  assert.equal(labelOf('validation_effort', { score: 9 }, 'A'), 'tested_with_users')
  assert.equal(labelOf('validation_effort', { score: -3 }, 'A'), 'none')
})

test('a choice answer still wins over a score', () => {
  assert.equal(labelOf('validation_effort', { choice: 'none', score: 3 }, 'A'), 'none')
})

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
