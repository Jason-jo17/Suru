/**
 * The acceptance suite from the build spec, runnable: `npm run acceptance`.
 *
 * It runs against a scratch database so it never touches dev data, and it
 * reports which checks it could actually make — with no LAYA_API_KEY the
 * band and label checks are skipped, and everything landing `unscored` is
 * itself the thing being tested.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'shurukar-acceptance-'))
process.env.DATABASE_URL = `file:${path.join(scratch, 'acceptance.db')}`

execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
  stdio: 'pipe',
  env: process.env,
})

/* eslint-disable import/first */
import { prisma } from '../src/lib/db'
import { assertAllMapped } from '../src/lib/ingest/fieldMap'
import { ingestCandidate } from '../src/lib/ingest/ingest'
import { buildDossier, distil, scenarioForStage } from '../src/lib/distil/buildDossier'
import { checkpointFor } from '../src/lib/laya/client'
import { routeCandidate } from '../src/lib/route'
import { runPipelineForCohort } from '../src/lib/pipeline'
import { assemble } from '../src/lib/assemble/scorer'
import { normalizeRecord } from '../src/lib/ingest/fieldMap'
import { readExport } from '../src/lib/ingest/readExport'

type Status = 'pass' | 'fail' | 'skip'
interface Check {
  id: string
  title: string
  status: Status
  detail: string
}
const checks: Check[] = []

function record(id: string, title: string, status: Status, detail: string) {
  checks.push({ id, title, status, detail })
}

function expect(id: string, title: string, ok: boolean, detail: string) {
  record(id, title, ok ? 'pass' : 'fail', detail)
}

const FIXTURE = 'test/candidates.json'
const scored = Boolean(process.env.LAYA_API_KEY)
/**
 * True when the run is pointed at a local stub rather than Laya. The label and
 * band checks then only prove the plumbing — they say nothing about whether
 * Laya would return those labels, and are reported as such.
 */
const stubbed = /localhost|127\.0\.0\.1/.test(process.env.LAYA_BASE_URL ?? '')

async function main() {
  const records = readExport(FIXTURE)
  const expectations = new Map<string, Record<string, unknown>>(
    records.map((r) => [
      String(r.external_id),
      (r as Record<string, unknown>)._expected as Record<string, unknown>,
    ]),
  )

  // ---------------------------------------------------------------- 1. ingest
  const headers = new Set<string>()
  for (const r of records) for (const k of Object.keys(r)) headers.add(k)
  assertAllMapped([...headers])

  for (let i = 0; i < records.length; i++) await ingestCandidate(records[i], i + 1)
  const loaded = await prisma.candidate.count()
  expect(
    '1a',
    'ingest loads all 12 candidates',
    loaded === 12,
    `${loaded} candidates loaded from ${FIXTURE}`,
  )

  let threw = false
  let thrownMessage = ''
  try {
    assertAllMapped([...headers, 'मुझे किस तरह की मदद चाहिए'])
  } catch (err) {
    threw = true
    thrownMessage = (err as Error).message
  }
  expect(
    '1b',
    'assertAllMapped throws, listing the unmapped column',
    threw && thrownMessage.includes('मुझे किस तरह की मदद चाहिए'),
    threw ? 'threw and named the column' : 'did NOT throw on an unmapped column',
  )

  const hindiRow = await prisma.candidate.findUnique({
    where: { externalId: 'hindi-01' },
    include: { responses: true },
  })
  const hindiFields = new Set(hindiRow?.responses.map((r) => r.fieldId) ?? [])
  expect(
    '1c',
    'a row with Hindi column headers maps to stable field ids',
    hindiFields.has('problem_solution') && hindiFields.has('founder_proximity'),
    `hindi-01 stored ${hindiFields.size} fields: ${[...hindiFields].slice(0, 6).join(', ')}…`,
  )

  // ------------------------------------------------- 2. determinism / replay
  const sample = await prisma.candidate.findUnique({
    where: { externalId: 'market-01' },
    include: { responses: true },
  })
  const sampleAnswers = Object.fromEntries(
    (sample?.responses ?? []).filter((r) => r.value.trim()).map((r) => [r.fieldId, r.value]),
  )
  const scenarioA = scenarioForStage(sample!.declaredStage)
  const d1 = distil(sampleAnswers, scenarioA, { name: 'Sunita Devi' })
  const d2 = distil(sampleAnswers, scenarioA, { name: 'Sunita Devi' })
  expect(
    '2a',
    'the distiller is deterministic',
    JSON.stringify(d1.payload) === JSON.stringify(d2.payload) && d1.tokenCount === d2.tokenCount,
    `two runs produced ${JSON.stringify(d1.payload) === JSON.stringify(d2.payload) ? 'identical' : 'DIFFERENT'} payloads (${d1.tokenCount} tokens)`,
  )

  const frozenAnswers = {
    submission_real: { choice: 'genuine', confidence: 0.9 },
    users: { choice: 'some', confidence: 0.8 },
    retention: { choice: 'high', confidence: 0.8 },
    paying: { choice: 'yes', confidence: 0.85 },
    revenue: { choice: 'low', confidence: 0.7 },
    founder_experience: { choice: 'deep', confidence: 0.9 },
    motivation: { choice: 'personal', confidence: 0.8 },
    constraint_type: { choice: 'money', confidence: 0.9 },
    alternatives: { choice: 'workaround', confidence: 0.75 },
    route_to_market: { choice: 'clear', confidence: 0.8 },
    formalisation: { choice: 'yes', confidence: 0.9 },
  }
  const a1 = assemble(frozenAnswers, 'C', { decisiveTokens: 300 })
  const a2 = assemble(frozenAnswers, 'C', { decisiveTokens: 300 })
  expect(
    '2b',
    're-assembling the same answers gives an identical assessment',
    JSON.stringify(a1) === JSON.stringify(a2),
    JSON.stringify(a1) === JSON.stringify(a2)
      ? `both produced band "${a1.band}", composite ${a1.composite}`
      : 'assembly is NOT reproducible',
  )

  const firstDossier = await buildDossier(sample!.id)
  const secondDossier = await buildDossier(sample!.id)
  const forced = await buildDossier(sample!.id, { forceNewVersion: true })
  const versions = await prisma.dossier.findMany({
    where: { candidateId: sample!.id },
    orderBy: { version: 'asc' },
  })
  expect(
    '2c',
    'a stored dossier is never rewritten; a re-score appends a version',
    firstDossier.id === secondDossier.id &&
      forced.version === 2 &&
      versions.length === 2 &&
      versions[0].payload === firstDossier.payload,
    `unchanged rebuild reused v${firstDossier.version}; forced rebuild wrote v${forced.version}; ` +
      `${versions.length} immutable rows on disk`,
  )

  // ------------------------------------------------------------ 5. routing
  const hinglish = await prisma.candidate.findUnique({ where: { externalId: 'hinglish-01' } })
  expect(
    '5',
    'hinglish-01 routes to the multilingual checkpoint',
    checkpointFor(hinglish!.language) === 'convaiinnovations/laya-multilingual',
    `language "${hinglish!.language}" -> ${checkpointFor(hinglish!.language)}`,
  )

  const marketTwo = await prisma.candidate.findUnique({
    where: { externalId: 'market-02' },
    include: { responses: true },
  })
  const m2Answers = Object.fromEntries(
    marketTwo!.responses.filter((r) => r.value.trim()).map((r) => [r.fieldId, r.value]),
  )
  const m2Routing = routeCandidate(m2Answers, marketTwo!.declaredStage)
  expect(
    '5b',
    'in_market with no traction is re-routed to B and flagged',
    m2Routing.scenario === 'B' && m2Routing.flags.some((f) => f.startsWith('stage_contradiction')),
    `declared ${m2Routing.declaredScenario} -> scored ${m2Routing.scenario}; flags: ${m2Routing.flags.length}`,
  )

  // ------------------------------------------- identity never reaches Laya
  for (const [externalId, exp] of expectations) {
    const mustNot = (exp?.dossier_must_not_contain as string[]) ?? []
    if (mustNot.length === 0) continue
    const candidate = await prisma.candidate.findUnique({ where: { externalId } })
    const dossier = await buildDossier(candidate!.id)
    const leaked = mustNot.filter((needle) =>
      dossier.payload.toLowerCase().includes(needle.toLowerCase()),
    )
    expect(
      'id',
      `identity is stripped from ${externalId}'s dossier`,
      leaked.length === 0,
      leaked.length === 0
        ? `none of ${mustNot.length} identity markers present`
        : `LEAKED: ${leaked.join(', ')}`,
    )
  }

  // ------------------------------------------------------ provenance marking
  for (const [externalId, exp] of expectations) {
    const mustHave = (exp?.dossier_must_contain as string[]) ?? []
    if (mustHave.length === 0) continue
    const candidate = await prisma.candidate.findUnique({ where: { externalId } })
    const dossier = await buildDossier(candidate!.id)
    const absent = mustHave.filter(
      (needle) => !dossier.payload.toLowerCase().includes(needle.toLowerCase()),
    )
    expect(
      'prov',
      `${externalId}'s dossier keeps its substance and provenance`,
      absent.length === 0,
      absent.length === 0 ? `all of ${mustHave.join(', ')} present` : `MISSING: ${absent.join(', ')}`,
    )
  }

  // ----------------------------------------- budget: never over, never empty
  const allDossiers = await prisma.candidate.findMany({ select: { id: true, externalId: true } })
  const overBudget: string[] = []
  for (const c of allDossiers) {
    const d = await buildDossier(c.id)
    if (d.tokenCount > 400) overBudget.push(`${c.externalId}=${d.tokenCount}`)
  }
  expect(
    'budget',
    'every dossier stays inside the 400-token budget',
    overBudget.length === 0,
    overBudget.length === 0 ? 'all 12 within budget' : `over: ${overBudget.join(', ')}`,
  )

  // ------------------------------------------------- 6. pipeline with no key
  const all = await prisma.candidate.findMany({ select: { id: true, externalId: true } })
  let pipelineThrew: string | null = null
  try {
    await runPipelineForCohort(all.map((c) => c.id))
  } catch (err) {
    pipelineThrew = (err as Error).message
  }
  expect(
    '6a',
    'the whole pipeline runs without throwing',
    pipelineThrew === null,
    pipelineThrew === null ? 'completed cleanly' : `THREW: ${pipelineThrew}`,
  )

  const assessments = await prisma.assessment.findMany({ include: { candidate: true } })
  const latest = new Map<string, (typeof assessments)[number]>()
  for (const a of assessments.sort((x, y) => +x.createdAt - +y.createdAt)) {
    latest.set(a.candidate.externalId, a)
  }
  expect(
    '6b',
    'every candidate has an assessment — nobody falls out of the queue',
    latest.size === 12,
    `${latest.size}/12 candidates carry an assessment`,
  )

  if (!scored) {
    const unscored = [...latest.values()].filter((a) => a.band === 'unscored')
    expect(
      '6c',
      'with LAYA_API_KEY unset, every candidate lands unscored',
      unscored.length === latest.size,
      `${unscored.length}/${latest.size} unscored`,
    )
  }

  // ------------------------------------------------ 4. the SEED Bank record
  const abandoned = await prisma.candidate.findUnique({
    where: { externalId: 'abandoned-01' },
    include: { seedBank: true, assessments: true },
  })
  const seed = abandoned?.seedBank
  const seedFields = {
    aspiration: seed?.aspiration,
    block: seed?.block,
    status: seed?.status,
    constraintType: seed?.constraintType,
  }
  const seedMissing = Object.entries(seedFields)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  const abandonedBand = latest.get('abandoned-01')?.band
  expect(
    '4',
    'abandoned-01 lands unscored WITH a complete SEED Bank record',
    seed?.complete === true &&
      seedMissing.length === 0 &&
      abandonedBand === 'unscored',
    `band=${abandonedBand}; seed-bank complete=${seed?.complete}; ` +
      `aspiration=${JSON.stringify(seed?.aspiration)}, block=${JSON.stringify(seed?.block)}, ` +
      `status=${JSON.stringify(seed?.status)}, constraint=${JSON.stringify(seed?.constraintType)}` +
      (seedMissing.length ? `; MISSING ${seedMissing.join(', ')}` : ''),
  )

  const seedTotal = await prisma.seedBankRecord.count()
  expect(
    '4b',
    'every candidate has a SEED Bank record, scored or not',
    seedTotal === 12,
    `${seedTotal}/12 records`,
  )

  // -------------------------------- missing evidence must not lower the band
  const thinLabels = {
    submission_real: { choice: 'genuine', confidence: 0.9 },
    problem_evidence: { choice: 'unclear', confidence: 0.9 },
    founder_proximity: { choice: 'unclear', confidence: 0.9 },
    validation_effort: { choice: 'unclear', confidence: 0.9 },
    motivation: { choice: 'personal', confidence: 0.9 },
  }
  const thin = assemble(thinLabels, 'A', { decisiveTokens: 300 })
  expect(
    '8',
    'missing evidence routes to a human instead of pushing the band down',
    thin.band === 'unscored' && thin.needsHuman && thin.cappedBy === null,
    `band=${thin.band}, needsHuman=${thin.needsHuman}, cappedBy=${thin.cappedBy}, ` +
      `flags=[${thin.flags.join(', ')}]`,
  )

  const assertedLabels = {
    ...thinLabels,
    problem_evidence: { choice: 'asserted', confidence: 0.9 },
    founder_proximity: { choice: 'deep', confidence: 0.9 },
    validation_effort: { choice: 'tested_with_users', confidence: 0.9 },
    problem_specificity: { choice: 'specific', confidence: 0.9 },
    alternatives: { choice: 'workaround', confidence: 0.9 },
    willingness_to_pay: { choice: 'strong', confidence: 0.9 },
    route_to_market: { choice: 'clear', confidence: 0.9 },
    constraint_type: { choice: 'money', confidence: 0.9 },
  }
  const asserted = assemble(assertedLabels, 'A', { decisiveTokens: 300 })
  expect(
    'floor',
    'a floor caps a strong founder who only asserts the problem',
    asserted.band === 'early' && asserted.cappedBy !== null,
    `band=${asserted.band}, cappedBy=${asserted.cappedBy}`,
  )

  // ------------------------------- 3. spam, and the scored-mode label checks
  if (scored) {
    for (const [externalId, exp] of expectations) {
      const expectedAnswers = (exp?.answers as Record<string, string | number>) ?? {}
      if (Object.keys(expectedAnswers).length === 0) continue
      const assessment = latest.get(externalId)
      const run = assessment?.layaRunId
        ? await prisma.layaRun.findUnique({ where: { id: assessment.layaRunId } })
        : null
      if (!run || run.status !== 'scored') {
        record('3', `${externalId} label checks`, 'skip', `run was ${run?.status ?? 'absent'}`)
        continue
      }
      const got = JSON.parse(run.answers) as Record<string, { choice?: string; score?: number }>
      const wrong = Object.entries(expectedAnswers).filter(([key, want]) => {
        const actual = got[key]
        if (!actual) return true
        return typeof want === 'number' ? actual.score !== want : actual.choice !== want
      })
      expect(
        '3',
        `${externalId} returns the expected labels`,
        wrong.length === 0,
        wrong.length === 0
          ? `${Object.keys(expectedAnswers).join(', ')} all as expected`
          : `mismatched: ${wrong.map(([k, v]) => `${k} wanted ${v} got ${JSON.stringify(got[k])}`).join('; ')}`,
      )
    }

    // The fixture's bands are HAND LABELS — the spec's "label the 12 by hand,
    // run them, and compare". A stub returns filler for every question the
    // fixture does not pin, so it cannot be held to them; the comparison is
    // reported either way, but only a real endpoint can fail it.
    for (const [externalId, exp] of expectations) {
      const wantBand = exp?.band as string | undefined
      if (!wantBand) continue
      const got = latest.get(externalId)?.band
      if (stubbed && got !== wantBand) {
        record(
          'band',
          `${externalId}: hand label "${wantBand}"`,
          'skip',
          `stub produced "${got}" — only a real endpoint can settle this`,
        )
        continue
      }
      expect('band', `${externalId} lands in band "${wantBand}"`, got === wantBand, `got "${got}"`)
    }
  } else {
    record(
      '3',
      'spam-01 comes back submission_real != genuine',
      'skip',
      'needs LAYA_API_KEY — the model has to answer for this check to mean anything',
    )
    record('band', 'band expectations', 'skip', 'needs LAYA_API_KEY')
  }

  // -------------------------------------------------------------- 7. export
  const patna = await prisma.candidate.findMany({ where: { district: 'Patna' } })
  const { buildCandidateWhere, toCsv } = await import('../src/lib/query')
  const where = buildCandidateWhere({ district: 'Patna' })
  const filtered = await prisma.candidate.findMany({
    where,
    include: {
      assessments: { orderBy: { createdAt: 'desc' }, take: 1 },
      seedBank: true,
    },
  })
  const csv = toCsv(filtered)
  const csvLines = csv.trim().split('\n')
  expect(
    '7',
    'the list filter and the CSV export agree on one district',
    filtered.length === patna.length && csvLines.length === patna.length + 1,
    `${patna.length} candidates in Patna; filter returned ${filtered.length}; ` +
      `CSV has ${csvLines.length - 1} data rows`,
  )

  // ------------------------------------------------------------------ report
  const width = Math.max(...checks.map((c) => c.title.length))
  console.log('\nAcceptance — ShuruKar evaluation layer')
  console.log(
    `mode: ${
      scored
        ? stubbed
          ? 'scored against a LOCAL STUB — label and band rows prove the code path, not Laya accuracy'
          : 'scored (LAYA_API_KEY present)'
        : 'unscored (no LAYA_API_KEY)'
    }\n`,
  )
  for (const c of checks) {
    const mark = c.status === 'pass' ? 'PASS' : c.status === 'fail' ? 'FAIL' : 'SKIP'
    console.log(`  [${mark}] ${c.id.padEnd(6)} ${c.title.padEnd(width)}  ${c.detail}`)
  }
  const failed = checks.filter((c) => c.status === 'fail')
  const skipped = checks.filter((c) => c.status === 'skip')
  console.log(
    `\n${checks.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`,
  )
  if (failed.length > 0) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error(`\nAcceptance run failed: ${(err as Error).stack}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    fs.rmSync(scratch, { recursive: true, force: true })
  })
