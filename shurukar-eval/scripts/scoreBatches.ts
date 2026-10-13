import fs from 'fs'
import path from 'path'
import { prisma } from '../src/lib/db'
import { health, whoami } from '../src/lib/laya/client'
import { questionSetVersion } from '../src/lib/laya/questionSets'
import { pendingCandidateIds } from '../src/lib/pending'
import { runPipelineForCohort } from '../src/lib/pipeline'

/**
 * Scores the cohort in small batches, each one fully persisted before the next
 * starts, so an interruption — a dead terminal, an expired key, Laya going
 * down — keeps every batch already finished. Re-running picks up exactly the
 * candidates still pending (never assessed, or the run never reached Laya).
 *
 *   npm run score:batches -- --batch 10 --exclude-state Karnataka
 *   npm run score:batches -- --max-batches 3        # a bounded slice
 *
 * Stops on an auth failure, and after two consecutive batches in which no
 * candidate reached Laya: at that point another batch only burns time.
 */

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2)
  const inline = argv.find((a) => a.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i !== -1 ? argv[i + 1] : undefined
}

const LOG = path.resolve(process.cwd(), 'scoring-log.jsonl')

function log(entry: Record<string, unknown>) {
  fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n')
}

async function main() {
  const batchSize = Math.max(1, Number(arg('batch') ?? 10))
  const maxBatches = arg('max-batches') ? Number(arg('max-batches')) : Infinity
  const excludeStates = (arg('exclude-state') ?? '').split(',').filter(Boolean)

  if (!process.env.LAYA_API_KEY) {
    console.error('LAYA_API_KEY is not set — every run would land unscored. Not starting.')
    process.exitCode = 1
    return
  }
  const [h, w] = await Promise.all([health(), whoami()])
  console.log(`laya health: ${h.ok ? 'ok' : `unavailable (${h.error})`}`)
  if (!w.ok) {
    console.error(`laya whoami failed (${w.error}) — key rejected or gateway down. Not starting.`)
    process.exitCode = 1
    return
  }

  const pending = await pendingCandidateIds({ excludeStates })
  const total = await prisma.candidate.count()
  const batches = Math.ceil(pending.length / batchSize)
  console.log(
    `question set ${questionSetVersion()} · ${total} candidates · ${pending.length} pending` +
      `${excludeStates.length ? ` (excluding ${excludeStates.join(', ')})` : ''}` +
      ` · ${batches} batch(es) of ${batchSize}\n`,
  )
  if (pending.length === 0) return

  const ext = new Map(
    (
      await prisma.candidate.findMany({
        where: { id: { in: pending } },
        select: { id: true, externalId: true, state: true },
      })
    ).map((c) => [c.id, `${c.externalId.slice(0, 8)} ${c.state}`]),
  )

  const bandTotals: Record<string, number> = {}
  let deadBatches = 0

  for (let b = 0; b < batches && b < maxBatches; b++) {
    const ids = pending.slice(b * batchSize, (b + 1) * batchSize)
    const started = Date.now()
    console.log(`batch ${b + 1}/${batches} — ${ids.length} candidates`)

    const assessments = await runPipelineForCohort(ids)

    const runs = await prisma.layaRun.findMany({
      where: { id: { in: assessments.map((a) => a.layaRunId).filter(Boolean) as string[] } },
      select: { id: true, status: true, error: true },
    })
    const runById = new Map(runs.map((r) => [r.id, r]))
    let reached = 0
    let authFailed = false

    for (const a of assessments) {
      const run = a.layaRunId ? runById.get(a.layaRunId) : undefined
      if (run?.status === 'scored') reached++
      if (run?.error && /unauthori[sz]ed|LAYA_API_KEY/i.test(run.error)) authFailed = true
      bandTotals[a.band] = (bandTotals[a.band] ?? 0) + 1
      console.log(
        `  ${(ext.get(a.candidateId) ?? a.candidateId).padEnd(22)} ${a.scenario ?? '-'} ` +
          `${a.band.padEnd(10)} FP ${String(a.founderProblem ?? '--').padStart(3)} ` +
          `PS ${String(a.problemSolution ?? '--').padStart(3)} SM ${String(a.solutionMarket ?? '--').padStart(3)}` +
          `${run?.status === 'unscored' ? `  [not reached: ${run.error}]` : ''}`,
      )
    }

    const secs = ((Date.now() - started) / 1000).toFixed(0)
    console.log(`  → ${reached}/${assessments.length} reached Laya in ${secs}s\n`)
    log({ batch: b + 1, of: batches, size: ids.length, reached, seconds: Number(secs) })

    if (authFailed) {
      console.error('Laya rejected the key. Stopping; finished batches are saved. Replace the key and re-run.')
      process.exitCode = 1
      break
    }
    deadBatches = reached === 0 ? deadBatches + 1 : 0
    if (deadBatches >= 2) {
      console.error('Two batches in a row never reached Laya. Stopping; re-run later to resume.')
      process.exitCode = 1
      break
    }
  }

  const left = await pendingCandidateIds({ excludeStates })
  console.log(
    `bands this run: ${Object.entries(bandTotals).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'}` +
      `\nstill pending: ${left.length}`,
  )
}

main()
  .catch((err) => {
    console.error(`\nBatch scoring failed: ${(err as Error).message}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
